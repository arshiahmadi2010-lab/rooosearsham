const API = ""; // same-origin — Cloudflare Worker live at /api/*

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
  initProAdmin();
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


// ==================== PRO ADMIN UX ====================
const PANEL_TITLES = {dashboard:"داشبورد",products:"محصولات",gallery:"گالری تصاویر","site-media":"تصاویر سایت",settings:"متن‌های سایت",appearance:"ظاهر و تم سایت",advanced:"تنظیمات پیشرفته",account:"حساب کاربری"};
const ACTIVITY_KEY = "rosearsham_admin_activity_v1";
let lastLoadedAt = null;
function addActivity(text, type="edit") {
  try {
    const list = JSON.parse(localStorage.getItem(ACTIVITY_KEY) || "[]");
    list.unshift({text, type, at:new Date().toISOString()});
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(list.slice(0,12)));
  } catch {}
  renderActivity();
}
function relativeTime(iso){
  const d=Date.now()-new Date(iso).getTime(), m=Math.floor(d/60000);
  if(m<1) return "همین الان"; if(m<60) return `${m} دقیقه پیش`; const h=Math.floor(m/60); if(h<24) return `${h} ساعت پیش`; return `${Math.floor(h/24)} روز پیش`;
}
function renderActivity(){
  const box=document.getElementById("activityList"); if(!box) return;
  let list=[]; try{list=JSON.parse(localStorage.getItem(ACTIVITY_KEY)||"[]")}catch{}
  box.innerHTML=list.length?list.map(x=>`<div class="activity-item"><i class="activity-dot ${escapeAttr(x.type)}"></i><div><strong>${escapeHtml(x.text)}</strong><small>${relativeTime(x.at)}</small></div></div>`).join(""):`<div class="empty-state">هنوز فعالیتی در این نشست ثبت نشده.</div>`;
}
async function loadDashboardStats(){
  try{
    const d=await api("/api/admin/dashboard");
    document.getElementById("statProducts").textContent=d.counts.products;
    document.getElementById("statGallery").textContent=d.counts.gallery;
    document.getElementById("statMedia").textContent=d.counts.media;
    document.getElementById("statSettings").textContent=d.counts.settings;
    document.getElementById("statProductsMeta").textContent=`${d.counts.activeProducts} محصول فعال`;
    document.getElementById("statGalleryMeta").textContent=`${d.counts.gallery} تصویر قابل نمایش`;
    const badge=document.getElementById("healthBadge"); badge.textContent=d.health.ok?"همه‌چیز سالم":"نیاز به بررسی"; badge.className="health-badge "+(d.health.ok?"ok":"warn");
    document.getElementById("healthList").innerHTML=d.health.items.map(i=>`<div class="health-row"><span><i class="health-icon ${i.ok?'ok':'warn'}">${i.ok?'✓':'!'}</i>${escapeHtml(i.label)}</span><small>${escapeHtml(i.detail)}</small></div>`).join("");
    lastLoadedAt=new Date(); updateSyncLabel();
  }catch(err){ const b=document.getElementById("healthBadge"); if(b){b.textContent="خطا در بررسی";b.className="health-badge warn"} }
}
function updateSyncLabel(){ const el=document.getElementById("adminLastSync"); if(el&&lastLoadedAt) el.textContent=`آخرین همگام‌سازی: ${lastLoadedAt.toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'})}`; }
function refreshCurrentData(){
  loadDashboardStats(); loadProducts(); loadGallery(); loadSiteMedia(); loadSettings(); loadTheme(); loadCategories();
  toast("اطلاعات پنل به‌روزرسانی شد.");
}
function openCommandPalette(){ const b=document.getElementById("commandBackdrop"),i=document.getElementById("commandInput"); b.classList.add("show"); b.setAttribute("aria-hidden","false"); i.value=""; renderCommands(""); setTimeout(()=>i.focus(),20); }
function closeCommandPalette(){ const b=document.getElementById("commandBackdrop"); b.classList.remove("show"); b.setAttribute("aria-hidden","true"); }
const COMMANDS=[
  ["dashboard","داشبورد","نمای کلی و سلامت سیستم","D"],["products","محصولات","افزودن و مدیریت محصولات","P"],["gallery","گالری تصاویر","مدیریت گالری","G"],["site-media","تصاویر سایت","بنرها و تصاویر ثابت","M"],["settings","متن‌های سایت","ویرایش متن‌ها","S"],["appearance","ظاهر و تم سایت","رنگ و فونت","A"],["advanced","تنظیمات پیشرفته","نقشه، سئو، CSS و پشتیبان‌گیری","X"],["account","حساب کاربری","تغییر رمز عبور","U"]
];
function renderCommands(q){const box=document.getElementById("commandResults"); if(!box)return; const n=q.trim().toLowerCase(); const rows=COMMANDS.filter(x=>!n||x[1].toLowerCase().includes(n)||x[2].toLowerCase().includes(n)).map((x,i)=>`<button class="command-item ${i===0?'selected':''}" data-command-panel="${x[0]}"><span class="cmd-key">${x[3]}</span><span><b>${x[1]}</b><small>${x[2]}</small></span><em>↵</em></button>`).join(""); box.innerHTML=rows||`<div class="empty-state">نتیجه‌ای پیدا نشد.</div>`; box.querySelectorAll("[data-command-panel]").forEach(btn=>btn.addEventListener("click",()=>{document.querySelector(`button[data-panel="${btn.dataset.commandPanel}"]`)?.click();closeCommandPalette();})); }
function initProAdmin(){
  renderActivity();
  document.getElementById("commandBtn")?.addEventListener("click",openCommandPalette);
  document.getElementById("refreshBtn")?.addEventListener("click",refreshCurrentData);
  document.getElementById("clearActivityBtn")?.addEventListener("click",()=>{localStorage.removeItem(ACTIVITY_KEY);renderActivity();toast("تاریخچه فعالیت این نشست پاک شد.");});
  document.getElementById("commandBackdrop")?.addEventListener("click",e=>{if(e.target.id==="commandBackdrop")closeCommandPalette()});
  document.getElementById("commandInput")?.addEventListener("input",e=>renderCommands(e.target.value));
  document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();openCommandPalette()} if(e.key==="Escape")closeCommandPalette();});
  document.querySelectorAll(".shortcut[data-go]").forEach(b=>b.addEventListener("click",()=>document.querySelector(`button[data-panel="${b.dataset.go}"]`)?.click()));
  ["p","g","s","a"].forEach(k=>document.addEventListener("keydown",e=>{if(e.target.matches("input,textarea,select"))return;if(e.key.toLowerCase()===k){const panel={p:"products",g:"gallery",s:"settings",a:"appearance"}[k];document.querySelector(`button[data-panel="${panel}"]`)?.click();}}));
  document.querySelectorAll("#adminNav button[data-panel]").forEach(btn=>btn.addEventListener("click",()=>{document.getElementById("adminPageTitle").textContent=PANEL_TITLES[btn.dataset.panel]||btn.textContent.trim();}));
  loadDashboardStats();
}

// ==================== PRODUCTS ====================
const productModal = document.getElementById("productModal");
const productForm = document.getElementById("productForm");
let currentProductImages = [];
let currentProductFeatures = [];

function openProductModal(product = null) {
  document.getElementById("productModalTitle").textContent = product ? "ویرایش محصول" : "محصول جدید";
  document.getElementById("productId").value = product ? product.id : "";
  document.getElementById("productName").value = product ? product.name : "";
  populateProductCategorySelect(product ? product.category : (categoriesCache[0]?.slug || ""));
  document.getElementById("productDesc").value = product ? product.description : "";
  document.getElementById("productActive").checked = product ? !!product.active : true;
  currentProductImages = product && product.images ? [...product.images] : [];
  currentProductFeatures = product && product.features ? [...product.features] : [];
  document.getElementById("productSort").value = product ? (product.sort_order || 0) : 0;
  renderImageList("productImagePreview", currentProductImages);
  renderProductFeatures();
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

const PRODUCT_DRAFT_KEY = "rosearsham_product_draft_v1";
function saveProductDraft(){
  try { localStorage.setItem(PRODUCT_DRAFT_KEY, JSON.stringify({name:document.getElementById("productName").value,category:document.getElementById("productCategory").value,description:document.getElementById("productDesc").value,sort_order:document.getElementById("productSort").value,active:document.getElementById("productActive").checked,images:currentProductImages,features:currentProductFeatures,at:new Date().toISOString()})); } catch {}
}
["productName","productCategory","productDesc","productSort","productActive"].forEach(id=>document.getElementById(id)?.addEventListener("input",saveProductDraft));

productForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("productId").value;
  const payload = {
    name: document.getElementById("productName").value,
    category: document.getElementById("productCategory").value,
    description: document.getElementById("productDesc").value,
    images: currentProductImages,
    sort_order: Number(document.getElementById("productSort").value || 0),
    features: currentProductFeatures.filter(v => v.trim()),
    active: document.getElementById("productActive").checked ? 1 : 0,
  };
  try {
    if (id) {
      await api(`/api/admin/products/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/admin/products", { method: "POST", body: JSON.stringify(payload) });
    }
    closeProductModal();
    localStorage.removeItem(PRODUCT_DRAFT_KEY);
    toast("محصول ذخیره شد.");
    addActivity(id ? "محصول ویرایش شد" : "محصول جدید ایجاد شد", "product");
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
            <button data-dup="${p.id}">کپی</button>
            <button data-del="${p.id}">حذف</button>
          </div>
        </td>
      </tr>`).join("") || `<tr><td colspan="6" style="color:var(--muted); text-align:center; padding:24px;">هنوز محصولی اضافه نشده است.</td></tr>`;

    body.querySelectorAll("[data-edit]").forEach((btn) =>
      btn.addEventListener("click", () => openProductModal(products.find((p) => p.id == btn.dataset.edit))));
    body.querySelectorAll("[data-dup]").forEach((btn) => btn.addEventListener("click", async () => {
        const p = products.find(x => x.id == btn.dataset.dup);
        if (!p) return;
        try {
          await api("/api/admin/products", { method: "POST", body: JSON.stringify({name: `${p.name} - کپی`, category:p.category, description:p.description, images:p.images||[], sort_order:Number(p.sort_order||0)+1, features:p.features||[], active:0}) });
          toast("یک کپی از محصول ساخته شد."); addActivity("یک محصول کپی شد", "product"); loadProducts();
        } catch(err){ toast(err.message); }
      }));
    body.querySelectorAll("[data-del]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (!confirm("این محصول حذف شود؟")) return;
        await api(`/api/admin/products/${btn.dataset.del}`, { method: "DELETE" });
        toast("محصول حذف شد.");
        addActivity("یک محصول حذف شد", "delete");
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
function renderProductFeatures() {
  const box = document.getElementById("productFeaturesList");
  if (!box) return;
  box.innerHTML = currentProductFeatures.map((value, i) => `<div class="repeatable-row"><input type="text" value="${escapeAttr(value)}" data-feature-index="${i}" placeholder="مثلاً: لطافت بالا"><button type="button" class="btn-small secondary" data-feature-del="${i}">×</button></div>`).join("");
  box.querySelectorAll("[data-feature-index]").forEach(input => input.addEventListener("input", () => { currentProductFeatures[Number(input.dataset.featureIndex)] = input.value; }));
  box.querySelectorAll("[data-feature-del]").forEach(btn => btn.addEventListener("click", () => { currentProductFeatures.splice(Number(btn.dataset.featureDel),1); renderProductFeatures(); }));
}
document.getElementById("addProductFeatureBtn")?.addEventListener("click", () => { currentProductFeatures.push(""); renderProductFeatures(); setTimeout(() => document.querySelector("#productFeaturesList input:last-child")?.focus(), 0); });

document.getElementById("productSearch")?.addEventListener("input", loadProducts);

// ==================== GALLERY ====================
const galleryModal = document.getElementById("galleryModal");
let currentGalleryImage = "";

function openGalleryModal(image = null) {
  currentGalleryImage = image?.image_url || "";
  document.getElementById("galleryId").value = image?.id || "";
  document.getElementById("galleryCategory").value = image?.category || "";
  document.getElementById("galleryCaption").value = image?.caption || "";
  document.getElementById("gallerySort").value = image?.sort_order || 0;
  document.getElementById("galleryModalTitle").textContent = image ? "ویرایش تصویر گالری" : "افزودن تصویر گالری";
  renderPreview("galleryImagePreview", currentGalleryImage);
  galleryModal.classList.add("show");
}

document.getElementById("newGalleryBtn").addEventListener("click", () => openGalleryModal());
document.getElementById("galleryCancelBtn").addEventListener("click", () => galleryModal.classList.remove("show"));

document.getElementById("galleryUploadDrop").addEventListener("click", () => document.getElementById("galleryImageInput").click());
document.getElementById("galleryImageInput").addEventListener("change", async (e) => {
  const files = [...e.target.files];
  if (!files.length) return;
  try { toast("در حال آپلود تصویر..."); currentGalleryImage = await uploadFile(files[0]); renderPreview("galleryImagePreview", currentGalleryImage); }
  catch (err) { toast(err.message); }
});

document.getElementById("galleryForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentGalleryImage) { toast("ابتدا یک تصویر آپلود کنید."); return; }
  const id = document.getElementById("galleryId").value;
  const payload = { image_url: currentGalleryImage, category: document.getElementById("galleryCategory").value, caption: document.getElementById("galleryCaption").value, sort_order: Number(document.getElementById("gallerySort").value || 0) };
  try {
    await api(id ? `/api/admin/gallery/${id}` : "/api/admin/gallery", { method: id ? "PUT" : "POST", body: JSON.stringify(payload) });
    galleryModal.classList.remove("show"); toast(id ? "تصویر گالری ویرایش شد." : "تصویر اضافه شد."); loadGallery();
  } catch (err) { toast(err.message); }
});

async function loadGallery() {
  try {
    const { images } = await api("/api/gallery");
    document.getElementById("statGallery").textContent = images.length;
    const body = document.getElementById("galleryTableBody");
    body.innerHTML = images.map((g) => `
      <tr>
        <td><img class="admin-thumb" src="${escapeAttr(g.image_url)}" loading="lazy"></td>
        <td>${escapeHtml(g.category || "—")}</td>
        <td>${escapeHtml(g.caption || "—")}</td>
        <td>${Number(g.sort_order || 0)}</td>
        <td><div class="row-actions"><button class="edit" data-gallery-edit="${g.id}">ویرایش</button><button data-del="${g.id}">حذف</button></div></td>
      </tr>`).join("") || `<tr><td colspan="5" style="color:var(--muted); text-align:center; padding:24px;">هنوز تصویری اضافه نشده است.</td></tr>`;
    body.querySelectorAll("[data-gallery-edit]").forEach(btn => btn.addEventListener("click", () => openGalleryModal(images.find(g => g.id == btn.dataset.galleryEdit))));
    body.querySelectorAll("[data-del]").forEach(btn => btn.addEventListener("click", async () => {
      if (!confirm("این تصویر حذف شود؟")) return;
      try { await api(`/api/admin/gallery/${btn.dataset.del}`, { method: "DELETE" }); toast("تصویر حذف شد."); loadGallery(); } catch (err) { toast(err.message); }
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
    themeSettingsCache = { ...themeSettingsCache, ...(settings || {}) };
    renderSettingsFields(settings || {});
  } catch (err) { toast(err.message); }
}

document.getElementById("saveSettingsBtn").addEventListener("click", async () => {
  const payload = {};
  document.querySelectorAll("#settingsFields [data-setting-key]").forEach((el) => { payload[el.dataset.settingKey] = el.value; });
  try {
    await api("/api/admin/settings", { method: "PUT", body: JSON.stringify(payload) });
    toast("همه متن‌ها ذخیره شد.");
    addActivity("متن‌های سایت به‌روزرسانی شد", "text");
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
    addActivity("ظاهر و تم سایت تغییر کرد", "theme");
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

document.getElementById("saveContactLinksBtn")?.addEventListener("click", async () => {
  const payload = {
    "site.map.embed_url": document.getElementById("mapEmbedUrl").value.trim(),
    "site.map.open_url": document.getElementById("mapOpenUrl").value.trim(),
    "site.map.title": document.getElementById("mapTitle").value.trim(),
    "site.social.instagram_url": document.getElementById("instagramUrl").value.trim(),
    "site.social.telegram_url": document.getElementById("telegramUrl").value.trim(),
    "site.social.linkedin_url": document.getElementById("linkedinUrl").value.trim()
  };
  try { await api("/api/admin/settings", { method: "PUT", body: JSON.stringify(payload) }); Object.assign(themeSettingsCache, payload); toast("اطلاعات تماس و لینک‌ها ذخیره شد."); }
  catch (err) { toast(err.message); }
});

document.getElementById("saveCustomCssBtn").addEventListener("click", async () => {
  const payload = { "theme.custom_css": document.getElementById("customCssEditor").value };
  try {
    await api("/api/admin/settings", { method: "PUT", body: JSON.stringify(payload) });
    themeSettingsCache["theme.custom_css"] = payload["theme.custom_css"];
    toast("CSS اختصاصی ذخیره شد.");
    addActivity("CSS اختصاصی ذخیره شد", "theme");
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
  document.getElementById("mapEmbedUrl").value = themeSettingsCache["site.map.embed_url"] || "";
  document.getElementById("mapOpenUrl").value = themeSettingsCache["site.map.open_url"] || "";
  document.getElementById("mapTitle").value = themeSettingsCache["site.map.title"] || "موقعیت دفتر مرکزی";
  document.getElementById("instagramUrl").value = themeSettingsCache["site.social.instagram_url"] || "";
  document.getElementById("telegramUrl").value = themeSettingsCache["site.social.telegram_url"] || "";
  document.getElementById("linkedinUrl").value = themeSettingsCache["site.social.linkedin_url"] || "";
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


// ==================== PRO+ SMART CONTROL CENTER ====================
(function initProPlus(){
  const body=document.body;
  const THEME_KEY="rosearsham_admin_dark_v1";
  const FOCUS_KEY="rosearsham_admin_focus_v1";
  const draftKey=typeof PRODUCT_DRAFT_KEY!=="undefined"?PRODUCT_DRAFT_KEY:"rosearsham_product_draft_v1";
  function applyPrefs(){
    body.classList.toggle("dark-admin",localStorage.getItem(THEME_KEY)==="1");
    body.classList.toggle("focus-mode",localStorage.getItem(FOCUS_KEY)==="1");
  }
  applyPrefs();
  document.getElementById("themeToggleBtn")?.addEventListener("click",()=>{localStorage.setItem(THEME_KEY,body.classList.contains("dark-admin")?"0":"1");applyPrefs();toast(body.classList.contains("dark-admin")?"حالت شب فعال شد":"حالت روز فعال شد");addActivity("حالت نمایش پنل تغییر کرد","theme")});
  document.getElementById("focusToggleBtn")?.addEventListener("click",()=>{localStorage.setItem(FOCUS_KEY,body.classList.contains("focus-mode")?"0":"1");applyPrefs();});
  document.getElementById("focusDashboardBtn")?.addEventListener("click",()=>document.getElementById("focusToggleBtn")?.click());
  document.getElementById("darkDashboardBtn")?.addEventListener("click",()=>document.getElementById("themeToggleBtn")?.click());
  document.getElementById("clearDraftsBtn")?.addEventListener("click",()=>{localStorage.removeItem(draftKey);toast("پیش‌نویس‌های محلی پاک شدند.");});
  document.getElementById("exportDashboardBtn")?.addEventListener("click",async()=>{
    try{
      const [d,p,g,m,c]=await Promise.all([api("/api/admin/dashboard"),api("/api/admin/products"),api("/api/admin/gallery"),api("/api/admin/site-media"),api("/api/admin/categories")]);
      const payload={exported_at:new Date().toISOString(),dashboard:d,products:p.products||[],gallery:g.gallery||[],site_media:m.media||[],categories:c.categories||[]};
      const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`rose-arsham-admin-report-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href); toast("گزارش مدیریتی آماده شد."); addActivity("گزارش مدیریتی خروجی گرفته شد","edit");
    }catch(e){toast(e.message)}
  });

  // Global search across the main content collections, with debounce and keyboard shortcut.
  const input=document.getElementById("globalSearch"); if(!input)return;
  const resultBox=document.createElement("div"); resultBox.className="global-search-results"; resultBox.id="globalSearchResults"; document.body.appendChild(resultBox);
  let timer=null, cache=null;
  async function buildCache(){
    if(cache)return cache;
    const [p,g,m,c]=await Promise.all([api("/api/admin/products"),api("/api/admin/gallery"),api("/api/admin/site-media"),api("/api/admin/categories")]);
    cache={products:p.products||[],gallery:g.gallery||[],media:m.media||[],categories:c.categories||[]}; return cache;
  }
  function openPanel(panel){document.querySelector(`button[data-panel="${panel}"]`)?.click()}
  async function search(q){
    q=q.trim().toLowerCase(); if(!q){resultBox.classList.remove("show");return}
    try{
      const d=await buildCache(); const rows=[];
      d.products.filter(x=>(x.name||"").toLowerCase().includes(q)||(x.description||"").toLowerCase().includes(q)).slice(0,6).forEach(x=>rows.push({type:"محصول",title:x.name,sub:"مدیریت محصولات",panel:"products"}));
      d.gallery.filter(x=>(x.caption||"").toLowerCase().includes(q)||(x.category||"").toLowerCase().includes(q)).slice(0,5).forEach(x=>rows.push({type:"گالری",title:x.caption||"تصویر گالری",sub:x.category||"",panel:"gallery"}));
      d.media.filter(x=>(x.title||"").toLowerCase().includes(q)||(x.slot||"").toLowerCase().includes(q)).slice(0,5).forEach(x=>rows.push({type:"رسانه",title:x.title||x.slot||"تصویر سایت",sub:"تصاویر سایت",panel:"site-media"}));
      d.categories.filter(x=>(x.label||"").toLowerCase().includes(q)||(x.slug||"").toLowerCase().includes(q)).slice(0,4).forEach(x=>rows.push({type:"دسته‌بندی",title:x.label,sub:x.slug,panel:"products"}));
      resultBox.innerHTML=rows.length?rows.map((r,i)=>`<button class="global-result" data-panel="${r.panel}"><span><b>${escapeHtml(r.title)}</b><small>${escapeHtml(r.sub)}</small></span><span class="result-type">${escapeHtml(r.type)}</span></button>`).join(""):"<div class='empty-state'>نتیجه‌ای پیدا نشد.</div>";
      resultBox.classList.add("show"); resultBox.querySelectorAll("[data-panel]").forEach(b=>b.addEventListener("click",()=>{openPanel(b.dataset.panel);resultBox.classList.remove("show");input.blur()}));
    }catch(e){toast(e.message)}
  }
  input.addEventListener("input",()=>{clearTimeout(timer);timer=setTimeout(()=>search(input.value),220)});
  document.addEventListener("click",e=>{if(!resultBox.contains(e.target)&&e.target!==input)resultBox.classList.remove("show")});
  document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="/" ){e.preventDefault();input.focus();input.select()} if(e.key==="Escape")resultBox.classList.remove("show")});

  // Restore a saved product draft when starting a new product, but never overwrite an existing product.
  const originalOpen=window.openProductModal;
  if(typeof originalOpen==="function"){
    window.openProductModal=function(product=null){
      originalOpen(product);
      if(!product){try{const d=JSON.parse(localStorage.getItem(draftKey)||"null"); if(d && (d.name||d.description||d.images?.length)){ if(confirm("یک پیش‌نویس ذخیره‌شده از محصول پیدا شد. بازیابی شود؟")){document.getElementById("productName").value=d.name||"";document.getElementById("productCategory").value=d.category||document.getElementById("productCategory").value;document.getElementById("productDesc").value=d.description||"";document.getElementById("productSort").value=d.sort_order||0;document.getElementById("productActive").checked=d.active!==false; if(Array.isArray(d.images)){currentProductImages=d.images;renderImageList("productImagePreview",currentProductImages)} if(Array.isArray(d.features)){currentProductFeatures=d.features;renderProductFeatures()}}}}catch{}};
    };
  }
})();
