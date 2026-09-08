const API = ""; // same-origin — Pages Functions live at /api/*

// ---------- small helpers ----------
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}

async function api(path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "خطایی رخ داد.");
  return data;
}

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/avif",
  "image/gif", "image/bmp", "image/tiff",
  "image/x-icon", "image/vnd.microsoft.icon",
  "image/heic", "image/heif",
];
const MAX_UPLOAD_BYTES = 1.5 * 1024 * 1024;

async function uploadFile(file) {
  if (!file.type || !file.type.startsWith("image/")) {
    throw new Error("فایل انتخابی یک تصویر نیست.");
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error(`فرمت «${file.type}» پشتیبانی نمی‌شود. فرمت‌های مجاز: JPG، PNG، WebP، AVIF، GIF، BMP، TIFF، ICO، HEIC/HEIF.`);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    throw new Error(`حجم تصویر (${sizeMb} مگابایت) بیشتر از حد مجاز (۱.۵ مگابایت) است.`);
  }
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(API + "/api/admin/upload", { method: "POST", body: fd, credentials: "same-origin" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "آپلود ناموفق بود.");
  return data.url;
}

// ---------- auth / boot ----------
const loginScreen = document.getElementById("loginScreen");
const adminShell = document.getElementById("adminShell");

async function checkSession() {
  try {
    await api("/api/admin/me");
    showDashboard();
  } catch {
    loginScreen.style.display = "flex";
    adminShell.style.display = "none";
  }
}

function showDashboard() {
  loginScreen.style.display = "none";
  adminShell.style.display = "flex";
  loadProducts();
  loadGallery();
  loadSiteMedia();
  loadSettings();
  loadTheme();
  loadCategories();
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const errEl = document.getElementById("loginError");
  errEl.classList.remove("show");
  try {
    await api("/api/login", { method: "POST", body: JSON.stringify({ username, password }) });
    showDashboard();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.add("show");
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" });
  location.reload();
});

// ---------- nav switching ----------
document.getElementById("adminNav").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-panel]");
  if (!btn) return;
  document.querySelectorAll(".admin-nav button").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  const panel = btn.dataset.panel;
  document.querySelectorAll(".admin-panel").forEach((p) => p.classList.toggle("active", p.dataset.panel === panel));
});

// ==================== PRODUCTS ====================
const productModal = document.getElementById("productModal");
const productForm = document.getElementById("productForm");
let currentProductImages = [];

function openProductModal(product = null) {
  document.getElementById("productModalTitle").textContent = product ? "ویرایش محصول" : "محصول جدید";
  document.getElementById("productId").value = product ? product.id : "";
  document.getElementById("productName").value = product ? product.name : "";
  populateProductCategorySelect(product ? product.category : (categoriesCache[0]?.slug || ""));
  document.getElementById("productDesc").value = product ? product.description : "";
  document.getElementById("productActive").checked = product ? !!product.active : true;
  currentProductImages = product && product.images ? [...product.images] : [];
  document.getElementById("productSort").value = product ? (product.sort_order || 0) : 0;
  renderImageList("productImagePreview", currentProductImages);
  productModal.classList.add("show");
}
function closeProductModal() { productModal.classList.remove("show"); }

function renderPreview(containerId, url) {
  const el = document.getElementById(containerId);
  el.innerHTML = url ? `<img src="${url}" alt="">` : "";
}

document.getElementById("newProductBtn").addEventListener("click", () => openProductModal());
document.getElementById("productCancelBtn").addEventListener("click", closeProductModal);

document.getElementById("productUploadDrop").addEventListener("click", () => document.getElementById("productImageInput").click());
document.getElementById("productImageInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    toast("در حال آپلود تصویر...");
    for (const f of e.target.files) { currentProductImages.push(await uploadFile(f)); }
    renderImageList("productImagePreview", currentProductImages);
  } catch (err) { toast(err.message); }
});

productForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("productId").value;
  const payload = {
    name: document.getElementById("productName").value,
    category: document.getElementById("productCategory").value,
    description: document.getElementById("productDesc").value,
    images: currentProductImages,
    sort_order: Number(document.getElementById("productSort").value || 0),
    features: [],
    active: document.getElementById("productActive").checked ? 1 : 0,
  };
  try {
    if (id) {
      await api(`/api/admin/products/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/admin/products", { method: "POST", body: JSON.stringify(payload) });
    }
    closeProductModal();
    toast("محصول ذخیره شد.");
    loadProducts();
  } catch (err) { toast(err.message); }
});

async function loadProducts() {
  try {
    const { products } = await api("/api/admin/products");
    const body = document.getElementById("productsTableBody");
    const query = (document.getElementById("productSearch")?.value || "").trim().toLowerCase();
    const filteredProducts = products.filter(p => !query || p.name.toLowerCase().includes(query) || categoryLabel(p.category).toLowerCase().includes(query));
    document.getElementById("statProducts").textContent = products.length;
    body.innerHTML = filteredProducts.map((p) => `
      <tr>
        <td>${p.images && p.images[0] ? `<img class="admin-thumb" src="${p.images[0]}">` : `<div class="admin-thumb"></div>`}</td>
        <td>${p.name}</td>
        <td>${categoryLabel(p.category)}</td>
        <td>${p.sort_order ?? 0}</td>
        <td><span class="status-pill ${p.active ? "on" : "off"}">${p.active ? "فعال" : "غیرفعال"}</span></td>
        <td>
          <div class="row-actions">
            <button class="edit" data-edit="${p.id}">ویرایش</button>
            <button data-del="${p.id}">حذف</button>
          </div>
        </td>
      </tr>`).join("") || `<tr><td colspan="6" style="color:var(--muted); text-align:center; padding:24px;">هنوز محصولی اضافه نشده است.</td></tr>`;

    body.querySelectorAll("[data-edit]").forEach((btn) =>
      btn.addEventListener("click", () => openProductModal(products.find((p) => p.id == btn.dataset.edit))));
    body.querySelectorAll("[data-del]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (!confirm("این محصول حذف شود؟")) return;
        await api(`/api/admin/products/${btn.dataset.del}`, { method: "DELETE" });
        toast("محصول حذف شد.");
        loadProducts();
      }));
  } catch (err) { toast(err.message); }
}

let categoriesCache = [];
function categoryLabel(cat) {
  const found = categoriesCache.find(c => c.slug === cat);
  return found ? found.label : cat;
}
function populateProductCategorySelect(selectedSlug) {
  const sel = document.getElementById("productCategory");
  sel.innerHTML = categoriesCache.map(c => `<option value="${escapeAttr(c.slug)}">${escapeHtml(c.label)}</option>`).join("");
  if (selectedSlug) sel.value = selectedSlug;
}

function renderImageList(containerId, urls) {
  const el = document.getElementById(containerId);
  el.innerHTML = urls.map((url, i) => `<div class="image-chip"><img src="${escapeAttr(url)}" alt=""><button type="button" data-img-index="${i}" title="حذف">×</button></div>`).join("");
  el.querySelectorAll("[data-img-index]").forEach(btn => btn.addEventListener("click", () => { currentProductImages.splice(Number(btn.dataset.imgIndex),1); renderImageList(containerId,currentProductImages); }));
}
document.getElementById("productSearch")?.addEventListener("input", loadProducts);

// ==================== GALLERY ====================
const galleryModal = document.getElementById("galleryModal");
let currentGalleryImage = "";

document.getElementById("newGalleryBtn").addEventListener("click", () => {
  currentGalleryImage = "";
  renderPreview("galleryImagePreview", "");
  document.getElementById("galleryForm").reset();
  galleryModal.classList.add("show");
});
document.getElementById("galleryCancelBtn").addEventListener("click", () => galleryModal.classList.remove("show"));

document.getElementById("galleryUploadDrop").addEventListener("click", () => document.getElementById("galleryImageInput").click());
document.getElementById("galleryImageInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    toast("در حال آپلود تصویر...");
    currentGalleryImage = await uploadFile(file);
    renderPreview("galleryImagePreview", currentGalleryImage);
  } catch (err) { toast(err.message); }
});

document.getElementById("galleryForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentGalleryImage) { toast("ابتدا یک تصویر آپلود کنید."); return; }
  const payload = {
    image_url: currentGalleryImage,
    category: document.getElementById("galleryCategory").value,
    caption: document.getElementById("galleryCaption").value,
  };
  try {
    await api("/api/admin/gallery", { method: "POST", body: JSON.stringify(payload) });
    galleryModal.classList.remove("show");
    toast("تصویر اضافه شد.");
    loadGallery();
  } catch (err) { toast(err.message); }
});

async function loadGallery() {
  try {
    const { images } = await api("/api/gallery");
    document.getElementById("statGallery").textContent = images.length;
    const body = document.getElementById("galleryTableBody");
    body.innerHTML = images.map((g) => `
      <tr>
        <td><img class="admin-thumb" src="${g.image_url}"></td>
        <td>${g.category || "—"}</td>
        <td>${g.caption || "—"}</td>
        <td><div class="row-actions"><button data-del="${g.id}">حذف</button></div></td>
      </tr>`).join("") || `<tr><td colspan="4" style="color:var(--muted); text-align:center; padding:24px;">هنوز تصویری اضافه نشده است.</td></tr>`;

    body.querySelectorAll("[data-del]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (!confirm("این تصویر حذف شود؟")) return;
        await api(`/api/admin/gallery/${btn.dataset.del}`, { method: "DELETE" });
        toast("تصویر حذف شد.");
        loadGallery();
      }));
  } catch (err) { toast(err.message); }
}

// ==================== SITE MEDIA ====================
const siteMediaModal = document.getElementById("siteMediaModal");
let currentSiteMediaImage = "";
const SITE_MEDIA_SLOTS = [
  ["home.hero", "صفحه اصلی — بنر اسلایدر (۱)", "اسلاید اول بنر اصلی (اگر فقط همین پر شود، بنر ثابت می‌ماند)"],
  ["home.hero_slide_2", "صفحه اصلی — بنر اسلایدر (۲)", "اسلاید دوم بنر اصلی (اختیاری)"],
  ["home.hero_slide_3", "صفحه اصلی — بنر اسلایدر (۳)", "اسلاید سوم بنر اصلی (اختیاری)"],
  ["home.about", "صفحه اصلی — درباره ما", "تصویر کنار بخش درباره رز آرشام"],
  ["about.hero", "درباره ما — هدر", "تصویر پس‌زمینه هدر صفحه درباره ما"],
  ["about.story", "درباره ما — داستان", "تصویر بخش داستان و فلسفه"],
  ["products.hero", "محصولات — هدر", "تصویر پس‌زمینه هدر صفحه محصولات"],
  ["gallery.hero", "گالری — هدر", "تصویر پس‌زمینه هدر صفحه گالری"],
  ["contact.hero", "تماس با ما — هدر", "تصویر پس‌زمینه هدر صفحه تماس با ما"]
];

function openSiteMediaModal(item = null, slotKey = "") {
  currentSiteMediaImage = item?.image_url || "";
  document.getElementById("siteMediaId").value = item?.id || "";
  document.getElementById("siteMediaSlot").value = item?.slot_key || slotKey;
  document.getElementById("siteMediaTitle").value = item?.title || SITE_MEDIA_SLOTS.find(x => x[0] === (item?.slot_key || slotKey))?.[1] || "";
  document.getElementById("siteMediaWidth").value = item?.width || "auto";
  document.getElementById("siteMediaHeight").value = item?.height || "auto";
  document.getElementById("siteMediaFit").value = item?.object_fit || "cover";
  document.getElementById("siteMediaPosition").value = item?.object_position || "center";
  document.getElementById("siteMediaActive").checked = item ? !!item.active : true;
  document.getElementById("siteMediaModalTitle").textContent = item ? "ویرایش تصویر" : "افزودن تصویر";
  renderPreview("siteMediaPreview", currentSiteMediaImage);
  siteMediaModal.classList.add("show");
}

document.getElementById("siteMediaCancelBtn")?.addEventListener("click", () => siteMediaModal.classList.remove("show"));
document.getElementById("siteMediaUploadDrop")?.addEventListener("click", () => document.getElementById("siteMediaInput").click());
document.getElementById("siteMediaInput")?.addEventListener("change", async (e) => {
  const file = e.target.files[0]; if (!file) return;
  try { toast("در حال آپلود تصویر..."); currentSiteMediaImage = await uploadFile(file); renderPreview("siteMediaPreview", currentSiteMediaImage); }
  catch (err) { toast(err.message); }
});
document.getElementById("siteMediaForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentSiteMediaImage) { toast("ابتدا یک تصویر انتخاب کنید."); return; }
  try {
    await api("/api/admin/site-media", { method: "POST", body: JSON.stringify({
      slot_key: document.getElementById("siteMediaSlot").value,
      title: document.getElementById("siteMediaTitle").value,
      image_url: currentSiteMediaImage,
      width: document.getElementById("siteMediaWidth").value || "auto",
      height: document.getElementById("siteMediaHeight").value || "auto",
      object_fit: document.getElementById("siteMediaFit").value,
      object_position: document.getElementById("siteMediaPosition").value || "center",
      active: document.getElementById("siteMediaActive").checked ? 1 : 0
    })});
    siteMediaModal.classList.remove("show"); toast("تصویر ذخیره شد."); loadSiteMedia();
  } catch (err) { toast(err.message); }
});

async function loadSiteMedia() {
  try {
    const { media = [] } = await api("/api/admin/site-media");
    const box = document.getElementById("siteMediaGrid");
    box.innerHTML = SITE_MEDIA_SLOTS.map(([slot,title,desc]) => {
      const item = media.find(m => m.slot_key === slot);
      return `<div class="site-media-card">
        <div class="site-media-card-head"><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(desc)}</p></div><span class="media-slot">${escapeHtml(slot)}</span></div>
        <div class="site-media-preview">${item ? `<img src="${escapeAttr(item.image_url)}" alt="">` : `<span>تصویری ثبت نشده</span>`}</div>
        <div class="site-media-meta">${item ? `اندازه: ${escapeHtml(item.width || "auto")} × ${escapeHtml(item.height || "auto")} · ${escapeHtml(item.object_fit || "cover")}` : "پیش‌فرض سایت فعال است"}</div>
        <div class="row-actions"><button class="edit" data-media-edit="${escapeAttr(slot)}">${item ? "ویرایش / تغییر" : "افزودن تصویر"}</button>${item ? `<button data-media-del="${item.id}">حذف</button>` : ""}</div>
      </div>`;
    }).join("");
    box.querySelectorAll("[data-media-edit]").forEach(btn => btn.addEventListener("click", () => openSiteMediaModal(media.find(m => m.slot_key === btn.dataset.mediaEdit), btn.dataset.mediaEdit)));
    box.querySelectorAll("[data-media-del]").forEach(btn => btn.addEventListener("click", async () => {
      if (!confirm("این تصویر از سایت حذف شود؟")) return;
      try { await api(`/api/admin/site-media/${btn.dataset.mediaDel}`, { method: "DELETE" }); toast("تصویر حذف شد."); loadSiteMedia(); }
      catch (err) { toast(err.message); }
    }));
  } catch (err) { toast(err.message); }
}

// ==================== SETTINGS ====================
function settingsLabel(key, item) {
  const labels = {
    site: "متن‌های عمومی سایت", home: "صفحه اصلی", products: "صفحه محصولات", gallery: "صفحه گالری", about: "صفحه درباره ما", contact: "صفحه تماس با ما", detail: "صفحه جزئیات محصول"
  };
  return item.label.replace(/^site \/ /, "");
}

function renderSettingsFields(settings) {
  const box = document.getElementById("settingsFields");
  const entries = Object.entries(window.SITE_TEXTS || {});
  const grouped = {};
  entries.forEach(([key, item]) => {
    const group = key.split('.')[0];
    (grouped[group] ||= []).push([key, item]);
  });
  const order = ["site", "home", "products", "gallery", "about", "contact", "detail"];
  box.innerHTML = order.filter(g => grouped[g]).map(group => `
    <div class="settings-group">
      <h3>${settingsGroupTitle(group)}</h3>
      ${grouped[group].map(([key,item]) => {
        const value = settings[key] !== undefined ? settings[key] : item.default;
        const multiline = value.length > 90 || /description|text|note|copyright|credit/.test(key);
        return `<div class="form-field"><label for="setting_${key.replace(/[^a-zA-Z0-9_-]/g,'_')}">${item.label}</label>${multiline ? `<textarea id="setting_${key.replace(/[^a-zA-Z0-9_-]/g,'_')}" data-setting-key="${key}">${escapeHtml(value)}</textarea>` : `<input id="setting_${key.replace(/[^a-zA-Z0-9_-]/g,'_')}" data-setting-key="${key}" type="text" value="${escapeAttr(value)}">`}</div>`;
      }).join("")}
    </div>`).join("");
}
function settingsGroupTitle(group) {
  return ({site:"متن‌های عمومی و هدر/فوتر",home:"صفحه اصلی",products:"صفحه محصولات",gallery:"صفحه گالری",about:"صفحه درباره ما",contact:"صفحه تماس با ما",detail:"صفحه جزئیات محصول"})[group] || group;
}
function escapeHtml(v) { return String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function escapeAttr(v) { return escapeHtml(v).replace(/"/g,"&quot;"); }

async function loadSettings() {
  try {
    const { settings } = await api("/api/settings");
    renderSettingsFields(settings || {});
  } catch (err) { toast(err.message); }
}

document.getElementById("saveSettingsBtn").addEventListener("click", async () => {
  const payload = {};
  document.querySelectorAll("#settingsFields [data-setting-key]").forEach((el) => { payload[el.dataset.settingKey] = el.value; });
  try {
    await api("/api/admin/settings", { method: "PUT", body: JSON.stringify(payload) });
    toast("همه متن‌ها ذخیره شد.");
  } catch (err) { toast(err.message); }
});

// ==================== APPEARANCE / THEME ====================
const THEME_COLORS = [
  { key: "theme.bg", label: "پس‌زمینه سایت", fallback: "#EAF7FF" },
  { key: "theme.ink", label: "رنگ متن اصلی", fallback: "#123047" },
  { key: "theme.rose", label: "رنگ اصلی (روشن)", fallback: "#55B9E8" },
  { key: "theme.rose_deep", label: "رنگ اصلی (تیره)", fallback: "#1684B8" },
  { key: "theme.sage", label: "رنگ ثانویه (روشن)", fallback: "#69B7D9" },
  { key: "theme.sage_deep", label: "رنگ ثانویه (تیره)", fallback: "#0F5F82" },
  { key: "theme.sage_pale", label: "رنگ زمینه بخش‌ها", fallback: "#D3EEFA" },
];
let themeSettingsCache = {};

function renderThemeColors() {
  const grid = document.getElementById("themeColorGrid");
  grid.innerHTML = THEME_COLORS.map(c => `
    <div class="theme-color-item">
      <input type="color" id="color_${c.key}" value="${(themeSettingsCache[c.key] || c.fallback)}">
      <span>${c.label}</span>
    </div>`).join("");
  grid.querySelectorAll("input[type=color]").forEach(input => {
    input.addEventListener("input", applyThemePreview);
  });
}

function applyThemePreview() {
  const map = { "theme.bg": "--bg", "theme.ink": "--ink", "theme.rose": "--rose", "theme.rose_deep": "--rose-deep", "theme.sage": "--sage", "theme.sage_deep": "--sage-deep", "theme.sage_pale": "--sage-pale" };
  const vars = THEME_COLORS.map(c => `${map[c.key]}:${document.getElementById("color_" + c.key).value}`);
  let styleEl = document.getElementById("themePreviewStyle");
  if (!styleEl) { styleEl = document.createElement("style"); styleEl.id = "themePreviewStyle"; document.head.appendChild(styleEl); }
  styleEl.textContent = `:root{${vars.join(";")}}`;
}

async function loadTheme() {
  try {
    const { settings } = await api("/api/admin/settings");
    themeSettingsCache = settings || {};
    renderThemeColors();
    applyThemePreview();
    document.getElementById("themeFontDisplay").value = themeSettingsCache["theme.font_display"] || "Vazirmatn";
    document.getElementById("themeFontBody").value = themeSettingsCache["theme.font_body"] || "IBM Plex Sans Arabic";
    loadAdvanced();
  } catch (err) { toast(err.message); }
}

document.getElementById("saveThemeBtn").addEventListener("click", async () => {
  const payload = {};
  THEME_COLORS.forEach(c => { payload[c.key] = document.getElementById("color_" + c.key).value; });
  payload["theme.font_display"] = document.getElementById("themeFontDisplay").value;
  payload["theme.font_body"] = document.getElementById("themeFontBody").value;
  try {
    await api("/api/admin/settings", { method: "PUT", body: JSON.stringify(payload) });
    themeSettingsCache = { ...themeSettingsCache, ...payload };
    toast("تغییرات ظاهری ذخیره شد.");
  } catch (err) { toast(err.message); }
});

document.getElementById("resetThemeBtn").addEventListener("click", async () => {
  if (!confirm("رنگ‌ها به حالت پیش‌فرض بازگردانده شوند؟")) return;
  const payload = {};
  THEME_COLORS.forEach(c => { payload[c.key] = c.fallback; });
  payload["theme.font_display"] = "Vazirmatn";
  payload["theme.font_body"] = "IBM Plex Sans Arabic";
  try {
    await api("/api/admin/settings", { method: "PUT", body: JSON.stringify(payload) });
    themeSettingsCache = { ...themeSettingsCache, ...payload };
    renderThemeColors();
    applyThemePreview();
    document.getElementById("themeFontDisplay").value = "Vazirmatn";
    document.getElementById("themeFontBody").value = "IBM Plex Sans Arabic";
    toast("رنگ‌ها بازنشانی شد.");
  } catch (err) { toast(err.message); }
});

// ==================== ACCOUNT / PASSWORD ====================
document.getElementById("passwordForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("passwordError");
  errEl.style.display = "none";
  const currentPassword = document.getElementById("currentPassword").value;
  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  if (newPassword !== confirmPassword) {
    errEl.textContent = "رمز جدید و تکرار آن یکسان نیستند.";
    errEl.style.display = "block";
    return;
  }
  try {
    await api("/api/admin/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });
    toast("رمز عبور با موفقیت تغییر کرد.");
    e.target.reset();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = "block";
  }
});

// ==================== ADVANCED: LAYOUT, SEO, CUSTOM CSS, BACKUP ====================
const LAYOUT_TOGGLES = [
  { key: "visibility.about", label: "بخش «درباره ما»" },
  { key: "visibility.products", label: "بخش «محصولات»" },
  { key: "visibility.process", label: "بخش «فرآیند تولید»" },
  { key: "visibility.gallery_preview", label: "بخش «نگاهی به گالری»" },
];

function renderLayoutToggles() {
  const list = document.getElementById("layoutToggleList");
  list.innerHTML = LAYOUT_TOGGLES.map(t => `
    <div class="layout-toggle-row">
      <span>${t.label}</span>
      <label class="switch">
        <input type="checkbox" data-vis-key="${t.key}" ${themeSettingsCache[t.key] !== "0" ? "checked" : ""}>
        <span class="slider"></span>
      </label>
    </div>`).join("");
  list.querySelectorAll("[data-vis-key]").forEach(input => {
    input.addEventListener("change", async () => {
      const payload = { [input.dataset.visKey]: input.checked ? "1" : "0" };
      try {
        await api("/api/admin/settings", { method: "PUT", body: JSON.stringify(payload) });
        themeSettingsCache[input.dataset.visKey] = payload[input.dataset.visKey];
        toast("چیدمان صفحه اصلی به‌روز شد.");
      } catch (err) { toast(err.message); }
    });
  });
}

document.getElementById("saveSeoBtn").addEventListener("click", async () => {
  const payload = { "seo.meta_description": document.getElementById("seoDescription").value };
  try {
    await api("/api/admin/settings", { method: "PUT", body: JSON.stringify(payload) });
    Object.assign(themeSettingsCache, payload);
    toast("سئو و برندینگ ذخیره شد.");
  } catch (err) { toast(err.message); }
});

document.getElementById("faviconUploadDrop").addEventListener("click", () => document.getElementById("faviconInput").click());
document.getElementById("faviconInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const url = await uploadFile(file);
    await api("/api/admin/settings", { method: "PUT", body: JSON.stringify({ "seo.favicon_url": url }) });
    themeSettingsCache["seo.favicon_url"] = url;
    document.getElementById("faviconPreview").innerHTML = `<img src="${url}" alt="">`;
    toast("فاوآیکون ذخیره شد.");
  } catch (err) { toast(err.message); }
});

document.getElementById("saveCustomCssBtn").addEventListener("click", async () => {
  const payload = { "theme.custom_css": document.getElementById("customCssEditor").value };
  try {
    await api("/api/admin/settings", { method: "PUT", body: JSON.stringify(payload) });
    themeSettingsCache["theme.custom_css"] = payload["theme.custom_css"];
    toast("CSS اختصاصی ذخیره شد.");
  } catch (err) { toast(err.message); }
});

document.getElementById("exportSettingsBtn").addEventListener("click", async () => {
  try {
    const { settings } = await api("/api/admin/settings");
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rose-arsham-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    toast("فایل پشتیبان دانلود شد.");
  } catch (err) { toast(err.message); }
});

document.getElementById("importSettingsBtn").addEventListener("click", () => document.getElementById("importSettingsInput").click());
document.getElementById("importSettingsInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    if (typeof payload !== "object" || Array.isArray(payload)) throw new Error("فایل پشتیبان معتبر نیست.");
    if (!confirm("تمام تنظیمات فعلی با فایل پشتیبان جایگزین می‌شود. ادامه می‌دهی؟")) return;
    await api("/api/admin/settings", { method: "PUT", body: JSON.stringify(payload) });
    toast("بازیابی انجام شد. صفحه رفرش می‌شود...");
    setTimeout(() => location.reload(), 1200);
  } catch (err) { toast(err.message); }
});

function loadAdvanced() {
  renderLayoutToggles();
  loadSectionOrder();
  document.getElementById("seoDescription").value = themeSettingsCache["seo.meta_description"] || "";
  document.getElementById("customCssEditor").value = themeSettingsCache["theme.custom_css"] || "";
  if (themeSettingsCache["seo.favicon_url"]) {
    document.getElementById("faviconPreview").innerHTML = `<img src="${themeSettingsCache["seo.favicon_url"]}" alt="">`;
  }
  document.getElementById("csEnabled").checked = themeSettingsCache["comingsoon_enabled"] === "1";
  document.getElementById("csText").value = themeSettingsCache["comingsoon_text"] || "";
  document.getElementById("csPassword").value = themeSettingsCache["comingsoon_password"] || "";
}

document.getElementById("saveComingSoonBtn").addEventListener("click", async () => {
  const payload = {
    comingsoon_enabled: document.getElementById("csEnabled").checked ? "1" : "0",
    comingsoon_text: document.getElementById("csText").value,
    comingsoon_password: document.getElementById("csPassword").value,
  };
  try {
    await api("/api/admin/settings", { method: "PUT", body: JSON.stringify(payload) });
    Object.assign(themeSettingsCache, payload);
    toast("تنظیمات حالت به‌زودی ذخیره شد.");
  } catch (err) { toast(err.message); }
});

document.querySelectorAll("[data-go]").forEach(btn => btn.addEventListener("click", () => document.querySelector(`button[data-panel="${btn.dataset.go}"]`)?.click()));
document.getElementById("quickProduct")?.addEventListener("click", () => openProductModal());
document.getElementById("quickGallery")?.addEventListener("click", () => document.getElementById("newGalleryBtn").click());
checkSession();

// ==================== CATEGORIES ====================
async function loadCategories() {
  try {
    const { categories } = await api("/api/admin/categories");
    categoriesCache = categories;
    populateProductCategorySelect();
    const body = document.getElementById("categoriesTableBody");
    if (!body) return;
    body.innerHTML = categories.map(c => `
      <tr>
        <td><input type="text" value="${escapeAttr(c.label)}" data-cat-label="${c.id}" style="border:1.3px solid var(--line); border-radius:8px; padding:6px 10px; width:100%;"></td>
        <td style="color:var(--muted); font-size:12.5px;">${escapeHtml(c.slug)}</td>
        <td><div class="row-actions"><button data-cat-save="${c.id}">ذخیره</button><button data-cat-del="${c.id}">حذف</button></div></td>
      </tr>`).join("") || `<tr><td colspan="3" style="color:var(--muted); text-align:center; padding:20px;">دسته‌بندی‌ای ثبت نشده است.</td></tr>`;

    body.querySelectorAll("[data-cat-save]").forEach(btn => btn.addEventListener("click", async () => {
      const id = btn.dataset.catSave;
      const label = body.querySelector(`[data-cat-label="${id}"]`).value.trim();
      if (!label) { toast("نام دسته‌بندی نمی‌تواند خالی باشد."); return; }
      try {
        await api(`/api/admin/categories/${id}`, { method: "PUT", body: JSON.stringify({ label }) });
        toast("دسته‌بندی ذخیره شد.");
        loadCategories();
      } catch (err) { toast(err.message); }
    }));
    body.querySelectorAll("[data-cat-del]").forEach(btn => btn.addEventListener("click", async () => {
      if (!confirm("این دسته‌بندی حذف شود؟")) return;
      try {
        await api(`/api/admin/categories/${btn.dataset.catDel}`, { method: "DELETE" });
        toast("دسته‌بندی حذف شد.");
        loadCategories();
      } catch (err) { toast(err.message); }
    }));
  } catch (err) { toast(err.message); }
}

document.getElementById("addCategoryBtn")?.addEventListener("click", async () => {
  const input = document.getElementById("newCategoryLabel");
  const label = input.value.trim();
  if (!label) { toast("نام دسته‌بندی را وارد کن."); return; }
  try {
    await api("/api/admin/categories", { method: "POST", body: JSON.stringify({ label }) });
    input.value = "";
    toast("دسته‌بندی اضافه شد.");
    loadCategories();
  } catch (err) { toast(err.message); }
});

// ==================== HOMEPAGE SECTION ORDER ====================
const SECTION_ORDER_ITEMS = [
  { id: "about", label: "درباره ما" },
  { id: "products", label: "محصولات" },
  { id: "process", label: "فرآیند تولید" },
  { id: "gallery", label: "نگاهی به گالری" },
];
let currentSectionOrder = SECTION_ORDER_ITEMS.map(s => s.id);

function renderSectionOrder() {
  const list = document.getElementById("sectionOrderList");
  if (!list) return;
  list.innerHTML = currentSectionOrder.map((id, idx) => {
    const item = SECTION_ORDER_ITEMS.find(s => s.id === id);
    if (!item) return "";
    return `
    <li data-order-id="${id}" style="display:flex; align-items:center; justify-content:space-between; border:1.3px solid var(--line); border-radius:10px; padding:10px 14px;">
      <span>${item.label}</span>
      <div style="display:flex; gap:6px;">
        <button type="button" class="btn-small" data-move-up="${idx}" ${idx === 0 ? "disabled" : ""}>▲</button>
        <button type="button" class="btn-small" data-move-down="${idx}" ${idx === currentSectionOrder.length - 1 ? "disabled" : ""}>▼</button>
      </div>
    </li>`;
  }).join("");
  list.querySelectorAll("[data-move-up]").forEach(btn => btn.addEventListener("click", () => {
    const i = Number(btn.dataset.moveUp);
    [currentSectionOrder[i - 1], currentSectionOrder[i]] = [currentSectionOrder[i], currentSectionOrder[i - 1]];
    renderSectionOrder();
  }));
  list.querySelectorAll("[data-move-down]").forEach(btn => btn.addEventListener("click", () => {
    const i = Number(btn.dataset.moveDown);
    [currentSectionOrder[i + 1], currentSectionOrder[i]] = [currentSectionOrder[i], currentSectionOrder[i + 1]];
    renderSectionOrder();
  }));
}

function loadSectionOrder() {
  try {
    const saved = JSON.parse(themeSettingsCache["home.sections_order"] || "null");
    if (Array.isArray(saved) && saved.length) currentSectionOrder = saved;
  } catch {}
  renderSectionOrder();
}

document.getElementById("saveSectionOrderBtn")?.addEventListener("click", async () => {
  try {
    await api("/api/admin/settings", { method: "PUT", body: JSON.stringify({ "home.sections_order": JSON.stringify(currentSectionOrder) }) });
    themeSettingsCache["home.sections_order"] = JSON.stringify(currentSectionOrder);
    toast("چیدمان صفحه اصلی ذخیره شد.");
  } catch (err) { toast(err.message); }
});

// ---------- visual page editor (GrapesJS) ----------
let gjsEditor = null;
const GJS_PAGE_TITLES = { index: "صفحه اصلی", about: "درباره ما", gallery: "گالری", contact: "تماس با ما", products: "محصولات" };

document.getElementById("openVisualEditorBtn")?.addEventListener("click", async () => {
  const page = document.getElementById("gjsPage").value;
  document.getElementById("gjsPageLabel").textContent = GJS_PAGE_TITLES[page] || page;
  document.getElementById("gjsOverlay").style.display = "flex";
  if (!gjsEditor) {
    gjsEditor = grapesjs.init({
      container: "#gjsEditor",
      height: "100%",
      storageManager: false,
      fromElement: false,
      canvas: {
        styles: [
          "/style.css",
          "https://fonts.googleapis.com/css2?family=Vazirmatn:wght@200;300;400;600;700&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600&display=swap",
        ],
      },
    });
    gjsEditor.on("load", () => {
      const doc = gjsEditor.Canvas.getDocument();
      if (doc && doc.documentElement) doc.documentElement.setAttribute("dir", "rtl");
    });
    gjsEditor.on("component:selected", (c) => {
      const cur = c.getStyle();
      if (cur.position === "absolute") return;
      const el = c.getEl();
      if (!el) return;
      const parent = el.offsetParent || el.parentElement;
      if (!parent) return;
      const rect = el.getBoundingClientRect();
      const prect = parent.getBoundingClientRect();
      c.addStyle({ position: "absolute", top: (rect.top - prect.top) + "px", left: (rect.left - prect.left) + "px", margin: 0 });
    });
  }
  let html = themeSettingsCache["page_html_" + page] || "";
  let css = themeSettingsCache["page_css_" + page] || "";
  if (!html) {
    const res = await fetch("/" + page + ".html");
    html = await res.text();
    html = `<base href="${location.origin}/">` + html;
  }
  gjsEditor.setComponents(html);
  gjsEditor.setStyle(css);
});

document.getElementById("gjsSaveBtn")?.addEventListener("click", async () => {
  const page = document.getElementById("gjsPage").value;
  const payload = { ["page_html_" + page]: gjsEditor.getHtml(), ["page_css_" + page]: gjsEditor.getCss() };
  try {
    await api("/api/admin/settings", { method: "PUT", body: JSON.stringify(payload) });
    Object.assign(themeSettingsCache, payload);
    toast("صفحه ذخیره شد.");
  } catch (err) { toast(err.message); }
});

document.getElementById("gjsResetBtn")?.addEventListener("click", async () => {
  const page = document.getElementById("gjsPage").value;
  const payload = { ["page_html_" + page]: "", ["page_css_" + page]: "" };
  try {
    await api("/api/admin/settings", { method: "PUT", body: JSON.stringify(payload) });
    Object.assign(themeSettingsCache, payload);
    toast("به حالت پیش‌فرض برگشت.");
    document.getElementById("gjsOverlay").style.display = "none";
  } catch (err) { toast(err.message); }
});

document.getElementById("gjsCloseBtn")?.addEventListener("click", () => {
  document.getElementById("gjsOverlay").style.display = "none";
});
