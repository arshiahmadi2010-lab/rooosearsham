const navEl = document.getElementById('siteNav');
  window.addEventListener('scroll', () => {
    navEl.classList.toggle('scrolled', window.scrollY > 40);
  });

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

// ---------- contact form ----------
const contactForm = document.getElementById('contactForm');
if(contactForm){
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = document.getElementById('formStatus');
    const data = Object.fromEntries(new FormData(contactForm).entries());
    status.className = 'form-status show';
    status.textContent = copy("site.contact.sending", "در حال ارسال...");
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if(!res.ok) throw new Error('failed');
      status.className = 'form-status show ok';
      status.textContent = copy("site.contact.success", "پیام شما با موفقیت ارسال شد. به‌زودی با شما تماس می‌گیریم.");
      contactForm.reset();
    } catch (err) {
      status.className = 'form-status show err';
      status.textContent = copy("site.contact.error", "ارسال پیام ممکن نشد. لطفاً بعداً دوباره تلاش کنید یا مستقیم تماس بگیرید.");
    }
  });
}

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
const categoryLabels = { facial: "دستمال کاغذی صورت", toilet: "دستمال توالت", towel: "حوله کاغذی", napkin: "دستمال سفره" };
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
loadSiteMedia();

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
  if (s["site.category.facial"]) categoryLabels.facial = s["site.category.facial"];
  if (s["site.category.toilet"]) categoryLabels.toilet = s["site.category.toilet"];
  if (s["site.category.towel"]) categoryLabels.towel = s["site.category.towel"];
  if (s["site.category.napkin"]) categoryLabels.napkin = s["site.category.napkin"];
  const phoneLink = document.getElementById("contactPhone") || document.getElementById("footerPhone");
  if (phoneLink && s.contact_phone) {
    document.querySelectorAll('a[href^="tel:"]').forEach((a) => { a.href = "tel:" + s.contact_phone.replace(/[^0-9+]/g, ""); });
  }
  if (s.contact_email) {
    document.querySelectorAll('a[href^="mailto:"]').forEach((a) => { a.href = "mailto:" + s.contact_email; });
  }
  return s;
})();

function productCardHTML(p) {
  const img = p.images && p.images[0] ? p.images[0] : null;
  return `
    <a href="product-detail.html?id=${p.id}" class="product-card link-card" data-cat="${p.category}">
      <div class="card-thumb" ${img ? `style="background-image:url('${img}'); background-size:cover; background-position:center;"` : ""}></div>
      <h3>${p.name}</h3>
      <p>${p.description || ""}</p>
      <span class="product-link">${copy("site.product_detail.cta", "مشاهده جزئیات ←")}</span>
    </a>`;
}

function galleryItemHTML(g) {
  return `<div class="g-item" data-cat="${g.category || ""}" style="background-image:url('${g.image_url}'); background-size:cover; background-position:center;"></div>`;
}

// ---------- homepage: top products + gallery preview ----------
(async function loadHomeSections() {
  await settingsReady;
  const homeGrid = document.getElementById("homeProductGrid");
  if (homeGrid) {
    const data = await fetchJSON("/api/products");
    const products = (data && data.products) || [];
    homeGrid.innerHTML = products.length
      ? products.slice(0, 4).map(productCardHTML).join("")
      : `<p style="grid-column:1/-1; text-align:center; color:var(--muted); padding:30px 0;">${copy("site.empty.no_products_home", "هنوز محصولی اضافه نشده — به‌زودی از پنل ادمین اضافه می‌شود.")}</p>`;
  }

  const homeGallery = document.getElementById("homeGalleryGrid");
  if (homeGallery) {
    const data = await fetchJSON("/api/gallery");
    const images = (data && data.images) || [];
    if (images.length) {
      homeGallery.innerHTML = images.slice(0, 6).map((g, i) => {
        const cls = ["g1", "g2", "g3", "g4", "g5", "g6"][i % 6];
        return `<div class="g-item ${cls}" style="background-image:url('${g.image_url}'); background-size:cover; background-position:center;"></div>`;
      }).join("");
    } else {
      homeGallery.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:var(--muted); padding:30px 0;">${copy("site.empty.no_images_home", "هنوز تصویری اضافه نشده است.")}</p>`;
    }
  }
})();

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
    media.style.backgroundImage = `url('${p.images[0]}')`;
    media.style.backgroundSize = "cover";
    media.style.backgroundPosition = "center";
  }

  const featuresEl = document.getElementById("detailFeatures");
  if (p.features && p.features.length) {
    featuresEl.innerHTML = p.features.map((f) => `
      <li><svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9.5L7 13.5L15 4.5" stroke="#3E5636" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>${f}</li>
    `).join("");
  }

  wrap.style.display = "grid";
})();
