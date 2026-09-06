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

async function uploadFile(file) {
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
  loadMessages();
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
  document.getElementById("productCategory").value = product ? product.category : "facial";
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

function categoryLabel(cat) {
  return { facial: "دستمال صورت", toilet: "دستمال توالت", towel: "حوله کاغذی", napkin: "دستمال سفره" }[cat] || cat;
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
  ["home.hero", "صفحه اصلی — تصویر اصلی", "تصویر بزرگ بخش اول صفحه اصلی"],
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

// ==================== MESSAGES ====================
async function loadMessages() {
  try {
    const { messages } = await api("/api/admin/messages");
    document.getElementById("statMessages").textContent = messages.length;
    const body = document.getElementById("messagesTableBody");
    body.innerHTML = messages.map((m) => `
      <tr>
        <td>${m.name}</td>
        <td>${m.email}${m.phone ? " / " + m.phone : ""}</td>
        <td style="max-width:260px;">${m.message}</td>
        <td style="white-space:nowrap; color:var(--muted); font-size:12.5px;">${m.created_at}</td>
        <td><div class="row-actions"><button data-del="${m.id}">حذف</button></div></td>
      </tr>`).join("") || `<tr><td colspan="6" style="color:var(--muted); text-align:center; padding:24px;">پیامی دریافت نشده است.</td></tr>`;

    body.querySelectorAll("[data-del]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (!confirm("این پیام حذف شود؟")) return;
        await api(`/api/admin/messages/${btn.dataset.del}`, { method: "DELETE" });
        loadMessages();
      }));
  } catch (err) { toast(err.message); }
}

document.querySelectorAll("[data-go]").forEach(btn => btn.addEventListener("click", () => document.querySelector(`button[data-panel="${btn.dataset.go}"]`)?.click()));
document.getElementById("quickProduct")?.addEventListener("click", () => openProductModal());
document.getElementById("quickGallery")?.addEventListener("click", () => document.getElementById("newGalleryBtn").click());
checkSession();
