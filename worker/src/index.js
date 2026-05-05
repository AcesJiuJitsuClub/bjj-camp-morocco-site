/**
 * BJJ Camp Morocco · Form Handler Worker
 *
 * Endpoints:
 *   POST /apply          — Application form (homepage)
 *   POST /subscribe      — Inner Circle newsletter (homepage + footer)
 *   POST /verify-session — Stripe Checkout session verification (welcome page)
 *   POST /intake         — Post-purchase sizing / dietary intake (welcome page)
 *
 * Both endpoints:
 *   - Create-or-update contact in ActiveCampaign (deduped by email)
 *   - Add contact to "Prospect" list
 *   - Set custom fields where provided
 *   - Apply lifecycle + behavior tags
 *   - CORS-locked to allowed origins
 *   - Failures logged, never leak AC errors to the client
 */

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const corsHeaders = buildCorsHeaders(origin, env);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, corsHeaders);
    }

    const url = new URL(request.url);
    try {
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ ok: false, error: 'invalid_json' }, 400, corsHeaders);
      }

      if (url.pathname === '/apply') {
        return await handleApply(body, env, corsHeaders);
      }
      if (url.pathname === '/subscribe') {
        return await handleSubscribe(body, env, corsHeaders);
      }
      if (url.pathname === '/verify-session') {
        return await handleVerifySession(body, env, corsHeaders);
      }
      if (url.pathname === '/intake') {
        return await handleIntake(body, env, corsHeaders);
      }
      return jsonResponse({ ok: false, error: 'not_found' }, 404, corsHeaders);
    } catch (err) {
      console.error('Unhandled error:', err);
      return jsonResponse({ ok: false, error: 'server_error' }, 500, corsHeaders);
    }
  },
};

// ─────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────

async function handleApply(body, env, corsHeaders) {
  const { name, email, belt, path, intent, camp = 'oct-8-2026' } = body || {};

  if (!isNonEmpty(name) || !isValidEmail(email) || !isNonEmpty(belt) || !isNonEmpty(path) || !isNonEmpty(intent)) {
    return jsonResponse({ ok: false, error: 'missing_fields' }, 400, corsHeaders);
  }

  const [firstName, ...rest] = name.trim().split(/\s+/);
  const lastName = rest.join(' ');

  try {
    const contactId = await syncContact(env, { email, firstName, lastName, fields: [
      { field: env.AC_FIELD_BELT, value: belt },
      { field: env.AC_FIELD_PATH, value: path },
      { field: env.AC_FIELD_INTENT, value: intent },
      { field: env.AC_FIELD_CAMP, value: camp },
    ]});

    await addContactToList(env, contactId, env.AC_LIST_PROSPECT);

    await applyTags(env, contactId, [
      'application_submitted',
      `applied-${camp}`,
      `belt-${slug(belt)}`,
      `path-${slug(path)}`,
      `intent-${slug(intent)}`,
    ]);

    return jsonResponse({ ok: true }, 200, corsHeaders);
  } catch (err) {
    console.error('handleApply error:', err);
    return jsonResponse({ ok: false, error: 'submission_failed' }, 502, corsHeaders);
  }
}

async function handleSubscribe(body, env, corsHeaders) {
  const { name = '', email, belt = '' } = body || {};

  if (!isValidEmail(email)) {
    return jsonResponse({ ok: false, error: 'invalid_email' }, 400, corsHeaders);
  }

  const [firstName, ...rest] = String(name).trim().split(/\s+/);
  const lastName = rest.join(' ');

  const fields = [];
  if (isNonEmpty(belt)) {
    fields.push({ field: env.AC_FIELD_BELT, value: belt });
  }

  try {
    const contactId = await syncContact(env, { email, firstName, lastName, fields });
    await addContactToList(env, contactId, env.AC_LIST_PROSPECT);

    const tags = ['innercircle'];
    if (isNonEmpty(belt)) tags.push(`belt-${slug(belt)}`);
    await applyTags(env, contactId, tags);

    return jsonResponse({ ok: true }, 200, corsHeaders);
  } catch (err) {
    console.error('handleSubscribe error:', err);
    return jsonResponse({ ok: false, error: 'submission_failed' }, 502, corsHeaders);
  }
}

async function handleVerifySession(body, env, corsHeaders) {
  const sessionId = body?.session_id;
  if (!isValidStripeSessionId(sessionId)) {
    return jsonResponse({ ok: false, error: 'invalid_session' }, 400, corsHeaders);
  }

  try {
    const session = await retrieveCheckoutSession(env, sessionId);
    if (session.payment_status !== 'paid') {
      return jsonResponse({ ok: false, error: 'not_paid' }, 200, corsHeaders);
    }

    const email = session.customer_details?.email ?? '';
    const name = session.customer_details?.name ?? '';
    const amount = typeof session.amount_total === 'number' ? session.amount_total / 100 : 0;
    const currency = String(session.currency || '').toUpperCase();
    const productName = getLineItemProductName(session);
    const tier = parseTierFromProductName(productName);
    const customFields = mapStripeCustomFields(session.custom_fields);

    return jsonResponse({
      ok: true,
      verified: true,
      email,
      name,
      amount,
      currency,
      tier,
      product_name: productName,
      session_id: sessionId,
      custom_fields: customFields,
    }, 200, corsHeaders);
  } catch (err) {
    console.error('handleVerifySession error:', err);
    return jsonResponse({ ok: false, error: 'verification_failed' }, 502, corsHeaders);
  }
}

async function handleIntake(body, env, corsHeaders) {
  const {
    session_id: sessionId,
    email,
    sizing_system: sizingSystem,
    gi_size: giSize,
    tshirt_size: tshirtSize,
    rashguard_size: rashguardSize,
    dietary = '',
  } = body || {};

  if (!isValidStripeSessionId(sessionId)) {
    return jsonResponse({ ok: false, error: 'invalid_session' }, 400, corsHeaders);
  }
  if (!isValidEmail(email)) {
    return jsonResponse({ ok: false, error: 'invalid_email' }, 400, corsHeaders);
  }
  if (sizingSystem !== "Men's" && sizingSystem !== "Women's") {
    return jsonResponse({ ok: false, error: 'missing_fields' }, 400, corsHeaders);
  }
  if (!isNonEmpty(giSize) || !isNonEmpty(tshirtSize) || !isNonEmpty(rashguardSize)) {
    return jsonResponse({ ok: false, error: 'missing_fields' }, 400, corsHeaders);
  }

  try {
    const session = await retrieveCheckoutSession(env, sessionId);
    if (session.payment_status !== 'paid') {
      return jsonResponse({ ok: false, error: 'verification_failed' }, 403, corsHeaders);
    }
    const sessionEmail = session.customer_details?.email;
    if (!sessionEmail || String(sessionEmail).trim().toLowerCase() !== String(email).trim().toLowerCase()) {
      return jsonResponse({ ok: false, error: 'verification_failed' }, 403, corsHeaders);
    }

    const productName = getLineItemProductName(session);
    const tier = parseTierFromProductName(productName);
    const fullName = String(session.customer_details?.name || '').trim();
    const [firstName, ...rest] = fullName ? fullName.split(/\s+/) : [''];
    const lastName = rest.join(' ');

    const contactId = await syncContact(env, { email, firstName, lastName, fields: [] });
    await addContactToList(env, contactId, env.AC_LIST_MEMBER);

    const sizingTag = `sizing-${String(sizingSystem).toLowerCase().replace(/'/g, '')}`;
    const tags = [
      'member',
      'camp-03-confirmed',
      `tier-${tier}`,
      sizingTag,
      `gi-${String(giSize).toLowerCase()}`,
      `tshirt-${String(tshirtSize).toLowerCase()}`,
      `rashguard-${String(rashguardSize).toLowerCase()}`,
    ];
    if (isNonEmpty(dietary)) tags.push('has-dietary-notes');
    await applyTags(env, contactId, tags);

    return jsonResponse({ ok: true }, 200, corsHeaders);
  } catch (err) {
    console.error('handleIntake error:', err);
    return jsonResponse({ ok: false, error: 'submission_failed' }, 502, corsHeaders);
  }
}

// ─────────────────────────────────────────────────────────────
// Stripe
// ─────────────────────────────────────────────────────────────

async function stripeFetch(env, path) {
  return fetch(`https://api.stripe.com${path}`, {
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
}

async function retrieveCheckoutSession(env, sessionId) {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  const q = 'expand[]=line_items&expand[]=customer';
  const path = `/v1/checkout/sessions/${encodeURIComponent(sessionId)}?${q}`;
  const res = await stripeFetch(env, path);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`stripe response not json: ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(`stripe ${res.status}: ${text.slice(0, 500)}`);
  }
  return json;
}

function getLineItemProductName(session) {
  const items = session?.line_items?.data;
  if (!Array.isArray(items) || items.length === 0) return '';
  const li = items[0];
  if (isNonEmpty(li.description)) return li.description.trim();
  const price = li.price;
  if (price && typeof price === 'object') {
    const prod = price.product;
    if (prod && typeof prod === 'object' && isNonEmpty(prod.name)) return prod.name.trim();
    if (typeof prod === 'string') return prod;
  }
  return '';
}

function parseTierFromProductName(productName) {
  const s = String(productName);
  if (/gold/i.test(s)) return 'gold';
  if (/vip/i.test(s)) return 'vip';
  if (/founding/i.test(s)) return 'founding';
  return 'unknown';
}

function mapStripeCustomFields(customFields) {
  const out = {};
  if (!Array.isArray(customFields)) return out;

  for (const field of customFields) {
    const keyRaw = field.key != null ? String(field.key) : '';
    const labelRaw = field.label?.custom != null ? String(field.label.custom) : '';
    const key = keyRaw.toLowerCase();
    const label = labelRaw.toLowerCase();
    const hay = `${key} ${label}`;
    const value = field.text?.value ?? field.dropdown?.value ?? '';

    if (hay.includes('belt') || label.includes('belt rank')) {
      out.belt_rank = value;
    } else if (hay.includes('emergency')) {
      out.emergency_contact = value;
    } else if (hay.includes('anything') || hay.includes('should know') || /notes|other info|tell us/i.test(hay)) {
      out.anything_we_should_know = value;
    }
  }
  return out;
}

function isValidStripeSessionId(id) {
  return typeof id === 'string' && (id.startsWith('cs_live_') || id.startsWith('cs_test_'));
}

// ─────────────────────────────────────────────────────────────
// ActiveCampaign API helpers
// ─────────────────────────────────────────────────────────────

async function syncContact(env, { email, firstName, lastName, fields }) {
  const payload = {
    contact: {
      email,
      firstName: firstName || '',
      lastName: lastName || '',
      ...(fields.length ? { fieldValues: fields } : {}),
    },
  };

  const res = await acFetch(env, '/api/3/contact/sync', { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`contact/sync failed: ${res.status} ${text}`);
  }
  const json = await res.json();
  if (!json?.contact?.id) throw new Error('contact/sync: no id returned');
  return json.contact.id;
}

async function addContactToList(env, contactId, listId) {
  const payload = {
    contactList: {
      list: Number(listId),
      contact: Number(contactId),
      status: 1, // 1 = active subscriber
    },
  };

  const res = await acFetch(env, '/api/3/contactLists', { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok && res.status !== 422) { // 422 often means already subscribed — not fatal
    const text = await res.text();
    throw new Error(`contactLists failed: ${res.status} ${text}`);
  }
}

async function applyTags(env, contactId, tagNames) {
  // AC requires tag IDs, not names. We resolve/create tags first.
  for (const name of tagNames) {
    try {
      const tagId = await ensureTag(env, name);
      await tagContact(env, contactId, tagId);
    } catch (err) {
      console.error(`Tag "${name}" failed:`, err.message);
      // Continue applying the other tags; one failure shouldn't drop the whole submission.
    }
  }
}

async function ensureTag(env, tagName) {
  // Try to find existing tag (search is exact-match-prefix, so we filter results)
  const search = await acFetch(env, `/api/3/tags?search=${encodeURIComponent(tagName)}&limit=100`);
  if (search.ok) {
    const data = await search.json();
    const found = (data.tags || []).find(t => t.tag === tagName);
    if (found) return found.id;
  }

  // Not found — create it
  const create = await acFetch(env, '/api/3/tags', {
    method: 'POST',
    body: JSON.stringify({ tag: { tag: tagName, tagType: 'contact' } }),
  });
  if (!create.ok) {
    const text = await create.text();
    throw new Error(`create tag failed: ${create.status} ${text}`);
  }
  const json = await create.json();
  return json.tag.id;
}

async function tagContact(env, contactId, tagId) {
  const res = await acFetch(env, '/api/3/contactTags', {
    method: 'POST',
    body: JSON.stringify({ contactTag: { contact: Number(contactId), tag: Number(tagId) } }),
  });
  if (!res.ok && res.status !== 422) {
    const text = await res.text();
    throw new Error(`contactTags failed: ${res.status} ${text}`);
  }
}

function acFetch(env, path, init = {}) {
  return fetch(`${env.AC_API_URL}${path}`, {
    ...init,
    headers: {
      'Api-Token': env.AC_API_KEY,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────

function isNonEmpty(v) { return typeof v === 'string' && v.trim().length > 0; }
function isValidEmail(v) { return isNonEmpty(v) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function slug(s) { return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

function jsonResponse(body, status, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function buildCorsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0] || '*';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}
