(() => {
  const onReady = (fn) => {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
    else fn();
  };
  const qsa = (root, selector) => Array.from(root.querySelectorAll(selector));

  function initMobileHeader() {
    qsa(document, ".ai-header").forEach((header) => {
      const button = header.querySelector(".ai-menu-button");
      const menu = header.querySelector(".ai-nav-menu");
      if (!(button instanceof HTMLButtonElement) || !(menu instanceof HTMLElement)) return;
      button.setAttribute("aria-expanded", "false");
      const close = () => {
        header.classList.remove("is-menu-open");
        button.setAttribute("aria-expanded", "false");
      };
      const toggle = () => {
        const open = !header.classList.contains("is-menu-open");
        header.classList.toggle("is-menu-open", open);
        button.setAttribute("aria-expanded", open ? "true" : "false");
      };
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle();
      });
      qsa(menu, "a").forEach((link) => link.addEventListener("click", close));
      document.addEventListener("click", (event) => {
        if (!header.contains(event.target)) close();
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") close();
      });
    });
  }

  function initHeroSliders() {
    qsa(document, ".ai-photo-hero").forEach((hero) => {
      if (!(hero instanceof HTMLElement)) return;
      const slides = qsa(hero, ".hero-bg span");
      if (!slides.length) return;
      const radios = qsa(hero, "input.hero-radio").filter((item) => item instanceof HTMLInputElement);
      const status = qsa(hero, ".ai-hero-status span");
      let index = Math.max(0, radios.findIndex((item) => item.checked));
      if (index < 0 || index >= slides.length) index = 0;
      let timer = 0;
      const setSlide = (next, manual = false) => {
        index = (next + slides.length) % slides.length;
        hero.dataset.activeSlide = String(index + 1);
        slides.forEach((slide, slideIndex) => slide.classList.toggle("is-active", slideIndex === index));
        const radio = radios[index];
        if (radio instanceof HTMLInputElement) radio.checked = true;
        status.forEach((item) => {
          if (!(item instanceof HTMLElement)) return;
          const text = item.textContent || "";
          const matches = new RegExp(String(index + 1).padStart(2, "0") + "\\s*/").test(text) || item.classList.contains("s" + (index + 1));
          item.classList.toggle("is-active", matches);
        });
        if (manual) restart();
      };
      const restart = () => {
        if (timer) window.clearInterval(timer);
        timer = window.setInterval(() => setSlide(index + 1), 6000);
      };
      qsa(hero, ".ai-arrow[for]").forEach((control) => {
        control.addEventListener("click", () => {
          const target = String(control.getAttribute("for") || "");
          const matched = target.match(/(\d+)$/);
          if (matched) setSlide(Number(matched[1]) - 1, true);
        });
      });
      radios.forEach((radio, radioIndex) => radio.addEventListener("change", () => setSlide(radioIndex, true)));
      setSlide(index);
      restart();
    });
  }

  function initProductsTabs() {
    qsa(document, ".products-category-showcase").forEach((section) => {
      if (!(section instanceof HTMLElement)) return;
      const buttons = qsa(section, ".products-tab, [data-product-category]").filter((item) => item instanceof HTMLElement);
      if (!buttons.length) return;
      const panels = qsa(section, "[data-product-category-panel]").filter((item) => item instanceof HTMLElement);
      const cards = qsa(section, ".products-card").filter((item) => item instanceof HTMLElement);
      const updateFallbackCards = (label) => {
        cards.forEach((card, cardIndex) => {
          const title = card.querySelector("h3");
          const image = card.querySelector("img");
          const names = [
            "Standard Model",
            "Export Series",
            "Heavy Duty Assembly",
            "Custom Unit",
            "Compact Type",
            "High Flow Version",
            "Corrosion Resistant Series",
            "Project Spare Kit"
          ];
          const nextName = (label + " " + names[cardIndex % names.length]).trim();
          if (title) title.textContent = nextName.toUpperCase();
          if (image instanceof HTMLImageElement && /placehold\.co/i.test(image.src)) {
            image.src = "https://placehold.co/560x420/f8fafc/244aa5?text=" + encodeURIComponent(nextName).replace(/%20/g, "+");
            image.alt = nextName;
          }
        });
      };
      const activate = (button) => {
        const label = String(button.getAttribute("data-product-category") || button.textContent || "").trim();
        if (!label) return;
        buttons.forEach((item) => {
          const active = item === button;
          item.classList.toggle("is-active", active);
          item.setAttribute("aria-selected", active ? "true" : "false");
        });
        let panelFound = false;
        panels.forEach((panel) => {
          const active = String(panel.getAttribute("data-product-category-panel") || "").toLowerCase() === label.toLowerCase();
          panel.hidden = !active;
          panel.classList.toggle("is-active", active);
          panelFound = panelFound || active;
        });
        if (!panelFound) updateFallbackCards(label);
        const firstPage = section.querySelector("#products-page-1");
        if (firstPage instanceof HTMLInputElement) firstPage.checked = true;
      };
      buttons.forEach((button, buttonIndex) => {
        if (!button.hasAttribute("data-product-category")) button.setAttribute("data-product-category", String(button.textContent || "").trim());
        button.setAttribute("role", "tab");
        button.addEventListener("click", (event) => {
          event.preventDefault();
          activate(button);
        });
        if (button.classList.contains("is-active") || buttonIndex === 0) button.setAttribute("aria-selected", button.classList.contains("is-active") ? "true" : "false");
      });
      const initial = buttons.find((button) => button.classList.contains("is-active")) || buttons[0];
      activate(initial);
    });
  }

  onReady(() => {
    initMobileHeader();
    initHeroSliders();
    initProductsTabs();
  });
})();