/* ====================================================================
 * BJJ Camp Morocco · Homepage interactions
 * Only the behaviors needed for the static homepage:
 *   1. Sticky-nav active-link tracking + smooth scroll
 *   2. Floating-label inputs (active class)
 *   3. Belt pill picker
 *   4. Choice-card picker (path / intent)
 *   5. Form validation + submit + thank-you swap
 *   6. FAQ accordion (single-open at a time)
 * ==================================================================== */

(function () {
  "use strict";

  // ----- TOKENS used inline (must match Tailwind config) -----
  const TOKEN = {
    ink: "#0E0C0A",
    bone: "#F2EBDC",
    sand: "#F1E9D8",
    sandSoft: "#EAE0CB",
    gold: "#C9A96E",
  };

  // ====================================================================
  // 1 · STICKY NAV — active link tracking + smooth scroll
  // ====================================================================
  const navLinks = document.querySelectorAll("[data-nav-link]");
  const sectionIds = ["experience", "schedule", "testimonials", "faq"];

  // Smooth scroll behavior is set on html, but ensure offset for sticky header
  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      const id = link.getAttribute("data-nav-link");
      const target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        const y = target.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top: y, behavior: "smooth" });
      }
    });
  });

  // Active link via IntersectionObserver
  const setActive = (activeId) => {
    navLinks.forEach((link) => {
      const id = link.getAttribute("data-nav-link");
      const underline = link.querySelector("[data-nav-underline]");
      const isActive = id === activeId;
      if (underline) {
        underline.style.transform = isActive ? "scaleX(1)" : "scaleX(0)";
      }
      link.style.color = isActive ? TOKEN.gold : "";
    });
  };

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 }
    );
    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
  }

  // ====================================================================
  // 2 · FLOATING-LABEL INPUTS
  // ====================================================================
  document.querySelectorAll("[data-field] input").forEach((input) => {
    const wrap = input.closest("[data-field]");
    const updateLabel = () => {
      const focused = document.activeElement === input;
      const filled = input.value.length > 0;
      const label = wrap.querySelector("span");
      if (!label) return;
      if (focused || filled) {
        label.style.top = "-10px";
        label.style.fontSize = "10px";
        label.style.color = TOKEN.ink;
      } else {
        label.style.top = "24px";
        label.style.fontSize = "13px";
        label.style.color = "rgba(14,12,10,0.5)";
      }
    };
    input.addEventListener("focus", updateLabel);
    input.addEventListener("blur", updateLabel);
    input.addEventListener("input", () => { updateLabel(); checkValid(); });
    updateLabel();
  });

  // ====================================================================
  // 3 · BELT PILL PICKER
  // ====================================================================
  const formData = { name: "", email: "", belt: "", path: "", intent: "" };

  document.querySelectorAll("[data-pill-group='belt'] [data-pill]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const value = btn.dataset.pill;
      formData.belt = value;
      btn.parentElement.querySelectorAll("[data-pill]").forEach((b) => {
        const isActive = b.dataset.pill === value;
        if (isActive) {
          b.style.background = TOKEN.ink;
          b.style.color = TOKEN.bone;
          b.style.borderColor = TOKEN.ink;
        } else {
          b.style.background = "transparent";
          b.style.color = "rgba(14,12,10,0.7)";
          b.style.borderColor = "rgba(14,12,10,0.14)";
        }
      });
      checkValid();
    });

    btn.addEventListener("mouseenter", () => {
      if (formData.belt !== btn.dataset.pill) {
        btn.style.borderColor = TOKEN.ink;
        btn.style.color = TOKEN.ink;
      }
    });
    btn.addEventListener("mouseleave", () => {
      if (formData.belt !== btn.dataset.pill) {
        btn.style.borderColor = "rgba(14,12,10,0.14)";
        btn.style.color = "rgba(14,12,10,0.7)";
      }
    });
  });

  // ====================================================================
  // 4 · CHOICE-CARD PICKER (path / intent)
  // ====================================================================
  const setChoiceActive = (btn, isActive) => {
    const num = btn.querySelector("[data-choice-num]");
    const title = btn.querySelector("[data-choice-title]");
    const sub = btn.querySelector("[data-choice-sub]");
    const cta = btn.querySelector("[data-choice-cta]");

    if (isActive) {
      btn.style.background = TOKEN.ink;
      btn.style.color = TOKEN.bone;
      btn.style.borderColor = TOKEN.ink;
      if (num) num.style.color = TOKEN.gold;
      if (title) {
        title.style.color = TOKEN.gold;
        title.style.fontStyle = "italic";
        title.style.fontWeight = "400";
      }
      if (sub) sub.style.color = "rgba(242,235,220,0.7)";
      if (cta) {
        cta.textContent = "Selected ✓";
        cta.style.color = TOKEN.gold;
      }
    } else {
      btn.style.background = "transparent";
      btn.style.color = TOKEN.ink;
      btn.style.borderColor = "rgba(14,12,10,0.14)";
      if (num) num.style.color = "rgba(14,12,10,0.45)";
      if (title) {
        title.style.color = TOKEN.ink;
        title.style.fontStyle = "normal";
        title.style.fontWeight = "300";
      }
      if (sub) sub.style.color = "rgba(14,12,10,0.55)";
      if (cta) {
        cta.textContent = "Select →";
        cta.style.color = "rgba(14,12,10,0.3)";
      }
    }
  };

  document.querySelectorAll("[data-choice-group]").forEach((group) => {
    const key = group.dataset.choiceGroup;
    group.querySelectorAll("[data-choice]").forEach((btn) => {
      btn.addEventListener("click", () => {
        formData[key] = btn.dataset.choice;
        group.querySelectorAll("[data-choice]").forEach((b) => {
          setChoiceActive(b, b === btn);
        });
        checkValid();
      });
    });
  });

  // ====================================================================
  // 5 · FORM VALIDATION + SUBMIT
  // ====================================================================
  const submitBtn = document.querySelector("[data-submit]");
  const stepCounter = document.querySelector("[data-step-counter]");
  const form = document.querySelector("[data-application-form]");
  const thankYou = document.querySelector("[data-thank-you]");
  const thankName = document.querySelector("[data-thank-name]");
  const thankEmail = document.querySelector("[data-thank-email]");

  function checkValid() {
    formData.name = document.getElementById("field-name").value.trim();
    formData.email = document.getElementById("field-email").value.trim();
    const filled = ["name","email","belt","path","intent"].filter((k) => formData[k]).length;
    const valid = filled === 5 && /\S+@\S+\.\S+/.test(formData.email);

    if (stepCounter) stepCounter.textContent = filled;

    if (submitBtn) {
      if (valid) {
        submitBtn.disabled = false;
        submitBtn.classList.remove("opacity-40", "cursor-not-allowed");
        submitBtn.classList.add("cursor-pointer");
      } else {
        submitBtn.disabled = true;
        submitBtn.classList.add("opacity-40", "cursor-not-allowed");
        submitBtn.classList.remove("cursor-pointer");
      }
    }
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      // Re-check validity using existing logic
      checkValid();
      if (submitBtn && submitBtn.disabled) return;

      const originalBtnText = submitBtn ? submitBtn.textContent : "";

      // Replace any existing error message (don't stack)
      const existingError = form.querySelector(".form-error");
      if (existingError) existingError.remove();

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending...";
      }

      try {
        const payload = {
          name: formData.name,
          email: formData.email,
          belt: formData.belt,
          path: formData.path,
          intent: formData.intent,
        };

        const res = await fetch("https://bjj-camp-forms.bjjcamp.workers.dev/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        let data = null;
        try {
          data = await res.json();
        } catch {
          data = null;
        }

        if (res.ok && data && data.ok === true) {
          // Hide form, show thank-you
          form.classList.add("hidden");
          if (thankYou) {
            thankYou.classList.remove("hidden");
            if (thankName) thankName.textContent = (formData.name.split(" ")[0]) || "Thank you";
            if (thankEmail) thankEmail.textContent = formData.email;
          }
          return;
        }

        throw new Error("Apply failed");
      } catch (err) {
        console.error("Application submit failed:", err);

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText;
        }

        const errorDiv = document.createElement("div");
        errorDiv.className = "form-error";
        errorDiv.textContent = "Something went wrong. Please try again or email mikal@bjjcampmorocco.com directly.";
        errorDiv.style.cssText = "color: rgba(220, 38, 38, 0.9); font-size: 13px; margin-bottom: 12px;";

        if (submitBtn && submitBtn.parentElement) {
          submitBtn.parentElement.insertBefore(errorDiv, submitBtn);
        } else {
          form.appendChild(errorDiv);
        }
      }
    });
  }

  // ====================================================================
  // 6 · FAQ ACCORDION
  // ====================================================================
  document.querySelectorAll("[data-faq-toggle]").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const item = toggle.closest("[data-faq-item]");
      const body = item.querySelector("[data-faq-body]");
      const plus = toggle.querySelector("[data-faq-plus]");
      const isOpen = item.dataset.open === "true";

      // Close all
      document.querySelectorAll("[data-faq-item]").forEach((other) => {
        const otherBody = other.querySelector("[data-faq-body]");
        const otherPlus = other.querySelector("[data-faq-plus]");
        const otherToggle = other.querySelector("[data-faq-toggle]");
        other.dataset.open = "false";
        if (otherToggle) otherToggle.setAttribute("aria-expanded", "false");
        if (otherBody) {
          otherBody.style.maxHeight = "0";
          otherBody.style.opacity = "0";
          otherBody.style.paddingTop = "0";
          otherBody.style.paddingBottom = "0";
        }
        if (otherPlus) otherPlus.style.transform = "rotate(0deg)";
      });

      // Open self if was closed
      if (!isOpen && body) {
        item.dataset.open = "true";
        toggle.setAttribute("aria-expanded", "true");
        body.style.maxHeight = body.scrollHeight + 100 + "px";
        body.style.opacity = "1";
        body.style.paddingTop = "0";
        body.style.paddingBottom = "32px";
        if (plus) plus.style.transform = "rotate(45deg)";
      }
    });
  });

  // Initialize step counter
  checkValid();
})();
