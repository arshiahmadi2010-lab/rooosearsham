const navEl = document.getElementById('siteNav');
  if (navEl) {
    const syncNav = () => navEl.classList.toggle('scrolled', window.scrollY > 40);
    window.addEventListener('scroll', syncNav, { passive: true });
    syncNav();
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!reduceMotion){
    const revealEls = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: .15 });
    revealEls.forEach(el => io.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
  }

// ---------- filter tabs (products / gallery) ----------
document.querySelectorAll('.filter-tabs').forEach(tabGroup => {
  const gridId = tabGroup.id === 'filterTabs' ? 'productGrid' : 'galleryGrid';
  const grid = document.getElementById(gridId);
  if(!grid) return;
  tabGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-tab');
    if(!btn) return;
    tabGroup.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
    grid.querySelectorAll('[data-cat]').forEach(item => {
      const show = filter === 'all' || item.dataset.cat === filter;
      item.style.display = show ? '' : 'none';
    });
  });
});

// ---------- contact form removed ----------

// ==================== LIVE CONTENT FROM THE API ====================
// Loads real data (products, gallery, site texts) from the backend and
// replaces the placeholder content baked into the HTML.

async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el && value !== undefined && value !== null) el.textContent = value;
}

let siteSettings = {};
let categoryLabels = {};
const categoriesReady = (async function loadCategories() {
  try {
    const data = await fetchJSON("/api/categories");
    const cats = (data && data.categories) || [];
    categoryLabels = Object.fromEntries(cats.map(c => [c.slug, c.label]));
    const tabs = document.getElementById("filterTabs");
    if (tabs && cats.length) {
      tabs.innerHTML = `<button class="filter-tab active" data-filter="all">همه</button>` +
        cats.map(c => `<button class="filter-tab" data-filter="${c.slug}">${c.label}</button>`).join("");
    }
    return categoryLabels;
  } catch { return {}; }
})();
function copy(key, fallback = "") { return siteSettings[key] ?? fallback; }

// ---------- site texts / settings ----------

// ---------- managed site images ----------
async function loadSiteMedia() {
  try {
    const data = await fetchJSON("/api/site-media");
    const media = data?.media || [];
    const bySlot = Object.fromEntries(media.map(m => [m.slot_key, m]));
    document.querySelectorAll("[data-media]").forEach(el => {
      const m = bySlot[el.dataset.media];
      if (!m || !m.image_url) { el.style.display = "none"; return; }
      el.src = m.image_url;
      el.style.display = "block";
      el.style.width = m.width || "auto";
      el.style.height = m.height || "auto";
      el.style.objectFit = m.object_fit || "cover";
      el.style.objectPosition = m.object_position || "center";
    });
    document.querySelectorAll("[data-media-bg]").forEach(el => {
      const m = bySlot[el.dataset.mediaBg];
      if (!m || !m.image_url) return;
      el.style.backgroundImage = `url("${m.image_url}")`;
      el.style.backgroundSize = (m.width && m.width !== "auto") || (m.height && m.height !== "auto") ? `${m.width || "auto"} ${m.height || "auto"}` : "cover";
      el.style.backgroundPosition = m.object_position || "center";
      el.style.backgroundRepeat = "no-repeat";
    });
  } catch {}
}
loadSiteMedia().then(initHeroSlider);

// ---------- hero banner slider ----------
function initHeroSlider() {
  const slider = document.getElementById("heroSlider");
  if (!slider) return;
  const slides = [...slider.querySelectorAll(".hero-slide")].filter(s => s.style.display !== "none");
  if (!slides.length) return;
  const dotsBox = document.getElementById("heroSliderDots");
  let i = 0;
  slides.forEach((s, idx) => s.classList.toggle("active", idx === 0));
  if (slides.length > 1 && dotsBox) {
    dotsBox.innerHTML = slides.map((_, idx) => `<button data-i="${idx}" class="${idx === 0 ? "active" : ""}"></button>`).join("");
    const dots = [...dotsBox.querySelectorAll("button")];
    function show(n) {
      i = n;
      slides.forEach((s, idx) => s.classList.toggle("active", idx === i));
      dots.forEach((d, idx) => d.classList.toggle("active", idx === i));
    }
    dots.forEach(d => d.addEventListener("click", () => show(Number(d.dataset.i))));
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) setInterval(() => show((i + 1) % slides.length), 6000);
  }
}

const settingsReady = (async function loadSettings() {
  const data = await fetchJSON("/api/settings");
  if (!data || !data.settings) return {};
  const s = data.settings;
  siteSettings = s;

  // Apply admin-customized theme colors/font, if any are set.
  const themeMap = { "theme.bg": "--bg", "theme.rose": "--rose", "theme.rose_deep": "--rose-deep", "theme.sage": "--sage", "theme.sage_deep": "--sage-deep", "theme.sage_pale": "--sage-pale", "theme.ink": "--ink" };
  const themeVars = Object.entries(themeMap).filter(([k]) => s[k]).map(([k, v]) => `${v}:${s[k]}`);
  const fontChoices = { "Vazirmatn": "Vazirmatn:wght@200;300;400;600;700", "IBM Plex Sans Arabic": "IBM+Plex+Sans+Arabic:wght@300;400;500;600", "Noto Sans Arabic": "Noto+Sans+Arabic:wght@300;400;500;600;700", "Rubik": "Rubik:wght@300;400;500;600;700", "Almarai": "Almarai:wght@300;400;700;800" };
  [s["theme.font_display"], s["theme.font_body"]].forEach((f) => {
    if (f && fontChoices[f] && !document.querySelector(`link[data-font="${f}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet"; link.dataset.font = f;
      link.href = `https://fonts.googleapis.com/css2?family=${fontChoices[f]}&display=swap`;
      document.head.appendChild(link);
    }
  });
  if (s["theme.font_display"]) themeVars.push(`--font-display:'${s["theme.font_display"]}', sans-serif`);
  if (s["theme.font_body"]) themeVars.push(`--font-body:'${s["theme.font_body"]}', sans-serif`);
  if (themeVars.length) {
    const styleEl = document.createElement("style");
    styleEl.textContent = `:root{${themeVars.join(";")}}`;
    document.head.appendChild(styleEl);
  }
  if (s["theme.custom_css"]) {
    const customEl = document.createElement("style");
    customEl.id = "custom-site-css";
    customEl.textContent = s["theme.custom_css"];
    document.head.appendChild(customEl);
  }

  // SEO: meta description + favicon
  if (s["seo.meta_description"]) {
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) { metaDesc = document.createElement("meta"); metaDesc.name = "description"; document.head.appendChild(metaDesc); }
    metaDesc.setAttribute("content", s["seo.meta_description"]);
  }
  if (s["seo.favicon_url"]) {
    let icon = document.querySelector('link[rel="icon"]');
    if (!icon) { icon = document.createElement("link"); icon.rel = "icon"; document.head.appendChild(icon); }
    icon.href = s["seo.favicon_url"];
  }

  // Section visibility toggles (homepage sections can be hidden from admin)
  const visibilityMap = { "visibility.about": "about", "visibility.products": "products", "visibility.process": "process", "visibility.gallery_preview": "gallery" };
  Object.entries(visibilityMap).forEach(([key, id]) => {
    if (s[key] === "0") { const el = document.getElementById(id); if (el) el.style.display = "none"; }
  });

  // Homepage section reordering (admin-controlled)
  if (s["home.sections_order"]) {
    try {
      const order = JSON.parse(s["home.sections_order"]);
      const container = document.querySelector(".hero")?.parentElement;
      if (container && Array.isArray(order)) {
        const footer = document.querySelector("footer");
        order.forEach((id) => {
          const el = document.getElementById(id);
          if (el) container.insertBefore(el, footer);
        });
      }
    } catch {}
  }

  // Every static editable text on the site is marked with data-setting.
  document.querySelectorAll("[data-setting]").forEach((el) => {
    const key = el.dataset.setting;
    if (s[key] !== undefined && s[key] !== null) el.textContent = s[key];
  });

  setText("contactPhone", s.contact_phone);
  setText("contactEmail", s.contact_email);
  setText("contactAddress", s.contact_address);
  setText("footerPhone", s.contact_phone);
  setText("footerEmail", s.contact_email);
  const phoneLink = document.getElementById("contactPhone") || document.getElementById("footerPhone");
  if (phoneLink && s.contact_phone) {
    document.querySelectorAll('a[href^="tel:"]').forEach((a) => { a.href = "tel:" + s.contact_phone.replace(/[^0-9+]/g, ""); });
  }
  if (s.contact_email) {
    document.querySelectorAll('a[href^="mailto:"]').forEach((a) => { a.href = "mailto:" + s.contact_email; });
  }
  return s;
})();

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]));
}

function productCardHTML(p) {
  const img = p.images && p.images[0] ? p.images[0] : null;
  const name = escapeHTML(p.name || "محصول رز آرشام");
  const description = escapeHTML(p.description || "");
  const category = escapeHTML(p.category || "");
  const href = `product-detail.html?id=${encodeURIComponent(p.id)}`;
  return `
    <a href="${href}" class="product-card link-card" data-cat="${category}" aria-label="مشاهده ${name}">
      <div class="card-thumb">${img ? `<img src="${escapeHTML(img)}" alt="${name}" loading="lazy" decoding="async">` : `<div class="card-thumb-empty" aria-hidden="true"><span>رز آرشام</span></div>`}</div>
      <h3>${name}</h3>
      <p>${description}</p>
      <span class="product-link">${escapeHTML(copy("site.product_detail.cta", "مشاهده جزئیات ←"))}</span>
    </a>`;
}

function galleryItemHTML(g) {
  const url = escapeHTML(g.image_url || "");
  const label = escapeHTML(categoryLabels[g.category] || g.category || "گالری");
  return `<div class="g-item" data-cat="${escapeHTML(g.category || "")}" data-label="${label}" style="background-image:url('${url}'); background-size:cover; background-position:center;" role="img" aria-label="${label}"></div>`;
}

// ---------- homepage: top products + gallery preview ----------
(async function loadHomeSections() {
  await settingsReady;
  const homeGrid = document.getElementById("homeProductGrid");
  if (homeGrid) {
    const data = await fetchJSON("/api/products");
    const products = (data && data.products) || [];
    homeGrid.innerHTML = products.length
      ? products.slice(0, 8).map(productCardHTML).join("")
      : `<p style="grid-column:1/-1; text-align:center; color:var(--muted); padding:30px 0;">${copy("site.empty.no_products_home", "هنوز محصولی اضافه نشده — به‌زودی از پنل ادمین اضافه می‌شود.")}</p>`;
    initHomeProductSlider();
  }

  const homeGallery = document.getElementById("homeGalleryGrid");
  if (homeGallery) {
    const data = await fetchJSON("/api/gallery");
    const images = (data && data.images) || [];
    if (images.length) {
      homeGallery.innerHTML = images.slice(0, 6).map((g, i) => {
        const cls = ["g1", "g2", "g3", "g4", "g5", "g6"][i % 6];
        return `<div class="g-item ${cls}" data-label="${escapeHTML(categoryLabels[g.category] || g.category || "گالری")}" style="background-image:url('${escapeHTML(g.image_url || "")}'); background-size:cover; background-position:center;"></div>`;
      }).join("");
    } else {
      homeGallery.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:var(--muted); padding:30px 0;">${copy("site.empty.no_images_home", "هنوز تصویری اضافه نشده است.")}</p>`;
    }
  }
})();

// ---------- homepage product slider controls ----------
function initHomeProductSlider(){
  const viewport = document.getElementById("homeProductViewport");
  const slider = document.getElementById("homeProductGrid");
  const prev = document.getElementById("homeProductPrev");
  const next = document.getElementById("homeProductNext");
  const count = document.getElementById("homeProductCount");
  if (!viewport || !slider || !prev || !next || !count) return;

  if (slider.dataset.sliderReady === "1") return;
  const originalCards = [...slider.querySelectorAll(".product-card")];
  if (!originalCards.length || originalCards[0].tagName === "P") {
    count.textContent = "00 / 00";
    prev.style.display = "none";
    next.style.display = "none";
    return;
  }

  slider.dataset.sliderReady = "1";
  const total = originalCards.length;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let index = 0;
  let timer = null;
  let isPointerDown = false;
  let startX = 0;
  let startY = 0;
  let moved = false;

  // Duplicate the first set so the carousel can keep moving without exposing an empty edge.
  originalCards.forEach(card => slider.appendChild(card.cloneNode(true)));

  const getStep = () => {
    const card = slider.querySelector(".product-card");
    if (!card) return 0;
    const styles = getComputedStyle(slider);
    const gap = parseFloat(styles.columnGap || styles.gap || "0") || 0;
    return card.getBoundingClientRect().width + gap;
  };

  const render = (animate = true) => {
    const card = slider.querySelector(".product-card");
    const step = getStep();
    const cardWidth = card ? card.getBoundingClientRect().width : 0;
    const viewportWidth = viewport.getBoundingClientRect().width;
    const centerOffset = Math.max(0, (viewportWidth - cardWidth) / 2);
    slider.style.transition = animate && !reduceMotion ? "transform 450ms cubic-bezier(.22,.8,.22,1)" : "none";
    slider.style.transform = `translate3d(${centerOffset - (index * step)}px,0,0)`;
    const logical = ((index % total) + total) % total;
    count.textContent = `${String(logical + 1).padStart(2,"0")} / ${String(total).padStart(2,"0")}`;
  };

  const go = (delta, animate = true) => {
    index += delta;
    render(animate);
  };

  slider.addEventListener("transitionend", () => {
    if (index >= total) {
      index -= total;
      render(false);
    }
    if (index < 0) {
      index += total;
      render(false);
    }
  });

  const stopAuto = () => {
    if (timer) { clearInterval(timer); timer = null; }
  };
  const startAuto = () => {
    stopAuto();
    if (reduceMotion || total < 2) return;
    timer = setInterval(() => {
      if (!document.hidden && !isPointerDown) go(1);
    }, 1900);
  };

  prev.addEventListener("click", () => { stopAuto(); go(-1); startAuto(); });
  next.addEventListener("click", () => { stopAuto(); go(1); startAuto(); });

  viewport.addEventListener("mouseenter", stopAuto);
  viewport.addEventListener("mouseleave", startAuto);
  viewport.addEventListener("focusin", stopAuto);
  viewport.addEventListener("focusout", startAuto);

  viewport.addEventListener("pointerdown", e => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    isPointerDown = true; moved = false; startX = e.clientX; startY = e.clientY; stopAuto();
  });
  viewport.addEventListener("pointermove", e => {
    if (!isPointerDown) return;
    if (Math.abs(e.clientX - startX) > 8 || Math.abs(e.clientY - startY) > 8) moved = true;
  });
  viewport.addEventListener("pointerup", e => {
    if (!isPointerDown) return;
    const dx = e.clientX - startX;
    isPointerDown = false;
    if (moved && Math.abs(dx) > 45) go(dx < 0 ? 1 : -1);
    startAuto();
  });
  viewport.addEventListener("pointercancel", () => { isPointerDown = false; startAuto(); });

  window.addEventListener("resize", () => render(false), {passive:true});
  document.addEventListener("visibilitychange", () => document.hidden ? stopAuto() : startAuto());
  render(false);
  startAuto();
}

// ---------- products.html: full catalog ----------
(async function loadFullProducts() {
  await settingsReady;
  const grid = document.getElementById("productGrid");
  if (!grid) return;
  const data = await fetchJSON("/api/products");
  const products = (data && data.products) || [];
  grid.innerHTML = products.length
    ? products.map(productCardHTML).join("")
    : `<p style="grid-column:1/-1; text-align:center; color:var(--muted); padding:40px 0;">${copy("site.empty.no_products", "هنوز محصولی اضافه نشده — به‌زودی از پنل ادمین اضافه می‌شود.")}</p>`;
})();

// ---------- gallery.html: full gallery ----------
(async function loadFullGallery() {
  await settingsReady;
  const grid = document.getElementById("galleryGrid");
  if (!grid) return;
  const data = await fetchJSON("/api/gallery");
  const images = (data && data.images) || [];
  grid.innerHTML = images.length
    ? images.map(galleryItemHTML).join("")
    : `<p style="grid-column:1/-1; text-align:center; color:var(--muted); padding:40px 0;">${copy("site.empty.no_images", "هنوز تصویری اضافه نشده است.")}</p>`;
})();

// ---------- product-detail.html: single product ----------
(async function loadProductDetail() {
  await settingsReady;
  await categoriesReady;
  const wrap = document.getElementById("detailLoaded");
  if (!wrap) return;
  const emptyEl = document.getElementById("detailEmpty");
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  if (!id) { emptyEl.style.display = "block"; return; }

  const data = await fetchJSON(`/api/products/${id}`);
  if (!data || !data.product) { emptyEl.style.display = "block"; return; }

  const p = data.product;
  document.title = `${p.name} | رز آرشام`;
  setText("breadcrumbName", p.name);
  setText("detailCategory", categoryLabels[p.category] || p.category);
  setText("detailName", p.name);
  setText("detailDesc", p.description || "");

  const media = document.getElementById("detailMedia");
  if (p.images && p.images[0]) {
    media.style.backgroundImage = `url("${String(p.images[0]).replace(/(["\\])/g, "\\$1")}")`;
    media.style.backgroundSize = "cover";
    media.style.backgroundPosition = "center";
  }

  const featuresEl = document.getElementById("detailFeatures");
  if (p.features && p.features.length) {
    featuresEl.innerHTML = p.features.map((f) => `
      <li><svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M3 9.5L7 13.5L15 4.5" stroke="#3E5636" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>${escapeHTML(f)}</li>
    `).join("");
  }

  wrap.style.display = "grid";
})();

// ---------- mobile nav toggle ----------
(function () {
  const toggle = document.getElementById("navToggle");
  const links = document.querySelector(".nav-links");
  if (!toggle || !links) return;
  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  links.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => {
      links.classList.remove("open");
      toggle.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
})();
