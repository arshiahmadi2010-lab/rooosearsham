import {
  hashPassword,
  verifyPassword,
  randomSaltHex,
  createSessionToken,
  verifySessionToken,
  getCookie,
  sessionCookieHeader,
  clearSessionCookieHeader,
  jsonResponse,
} from "./lib/auth.js";

// ---------- small helpers ----------
function slugify(name) {
  return name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^\w\u0600-\u06FF-]/g, "");
}

function bufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function requireSession(request, env) {
  const token = getCookie(request, "session");
  const session = token ? await verifySessionToken(token, env.SESSION_SECRET) : null;
  return session && session.role === "admin" ? session : null;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// ==================== PUBLIC ROUTES ====================

async function getProducts(request, env) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category");
  let query = "SELECT * FROM products WHERE active = 1";
  const binds = [];
  if (category && category !== "all") {
    query += " AND category = ?";
    binds.push(category);
  }
  query += " ORDER BY sort_order ASC, id DESC";
  const { results } = await env.DB.prepare(query).bind(...binds).all();
  const products = results.map((p) => ({
    ...p,
    features: p.features_json ? JSON.parse(p.features_json) : [],
    images: p.images_json ? JSON.parse(p.images_json) : [],
  }));
  return jsonResponse({ products });
}

async function getProductById(request, env, id) {
  const product = await env.DB.prepare(
    "SELECT * FROM products WHERE (id = ? OR slug = ?) AND active = 1"
  ).bind(id, id).first();
  if (!product) return jsonResponse({ error: "محصول یافت نشد." }, 404);
  return jsonResponse({
    product: {
      ...product,
      features: product.features_json ? JSON.parse(product.features_json) : [],
      images: product.images_json ? JSON.parse(product.images_json) : [],
    },
  });
}

async function getGallery(request, env) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category");
  let query = "SELECT * FROM gallery_images";
  const binds = [];
  if (category && category !== "all") {
    query += " WHERE category = ?";
    binds.push(category);
  }
  query += " ORDER BY sort_order ASC, id DESC";
  const { results } = await env.DB.prepare(query).bind(...binds).all();
  return jsonResponse({ images: results });
}

async function getSettings(request, env) {
  const { results } = await env.DB.prepare("SELECT key, value FROM settings").all();
  const settings = {};
  for (const row of results) settings[row.key] = row.value;
  return jsonResponse({ settings });
}

async function getCategories(env) {
  const { results } = await env.DB.prepare("SELECT * FROM categories ORDER BY sort_order ASC, id ASC").all();
  return jsonResponse({ categories: results });
}

async function postLogin(request, env) {
  const body = await readJson(request);
  const { username, password } = body || {};
  if (!username || !password) return jsonResponse({ error: "نام کاربری و رمز عبور الزامی است." }, 400);

  const user = await env.DB.prepare("SELECT * FROM admin_users WHERE username = ?").bind(username).first();
  if (!user) return jsonResponse({ error: "نام کاربری یا رمز عبور اشتباه است." }, 401);

  const ok = await verifyPassword(password, user.salt, user.password_hash);
  if (!ok) return jsonResponse({ error: "نام کاربری یا رمز عبور اشتباه است." }, 401);

  const token = await createSessionToken({ role: "admin", uid: user.id, username: user.username }, env.SESSION_SECRET);
  return jsonResponse({ ok: true, username: user.username }, 200, { "Set-Cookie": sessionCookieHeader(token) });
}

async function postLogout() {
  return jsonResponse({ ok: true }, 200, { "Set-Cookie": clearSessionCookieHeader() });
}

// ---------- coming-soon gate ----------
const GATED_PATHS = new Set(["/", "/index.html", "/products.html", "/product-detail.html", "/gallery.html", "/about.html", "/contact.html"]);

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function getGateSettings(env) {
  const { results } = await env.DB.prepare("SELECT key, value FROM settings WHERE key IN ('comingsoon_enabled','comingsoon_text','comingsoon_password')").all();
  const s = {};
  for (const r of results) s[r.key] = r.value;
  return s;
}

function gateCookieHeader(token) {
  return `gate=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${60 * 60 * 24 * 30}`;
}

async function isUnlocked(request, env) {
  const token = getCookie(request, "gate");
  const payload = token ? await verifySessionToken(token, env.SESSION_SECRET) : null;
  return !!(payload && payload.gate === true);
}

function comingSoonHtml(text) {
  const message = escapeHtml(text || "به‌زودی برمی‌گردیم");
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>به‌زودی | رز آرشام</title>
<style>
:root{color-scheme:dark;--bg:#071827;--bg2:#0d2b42;--ink:#eef9ff;--muted:#a9c7d8;--accent:#65c7f1;--accent2:#238fc2;--line:rgba(190,231,250,.16)}
*{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:Tahoma,"Segoe UI",sans-serif;background:var(--bg);color:var(--ink)}
body{min-height:100vh;display:grid;place-items:center;overflow:hidden;position:relative;padding:28px}
body:before,body:after{content:"";position:absolute;border-radius:50%;filter:blur(4px);pointer-events:none}
body:before{width:520px;height:520px;right:-190px;top:-210px;background:radial-gradient(circle,rgba(35,143,194,.32),transparent 68%)}
body:after{width:440px;height:440px;left:-180px;bottom:-190px;background:radial-gradient(circle,rgba(101,199,241,.18),transparent 68%)}
.shell{width:min(100%,920px);position:relative;z-index:1;display:grid;grid-template-columns:1.05fr .95fr;gap:28px;align-items:center}
.brand{display:flex;align-items:center;gap:12px;margin-bottom:34px}.brand-mark{width:46px;height:46px;border:1px solid rgba(101,199,241,.55);border-radius:15px;display:grid;place-items:center;background:linear-gradient(145deg,rgba(101,199,241,.2),rgba(35,143,194,.08));box-shadow:0 0 35px rgba(35,143,194,.16)}
.brand-mark:before{content:"";width:17px;height:17px;border:2px solid var(--accent);border-radius:50%;box-shadow:8px 0 0 -5px var(--accent)}.brand-name{font-size:19px;font-weight:700;letter-spacing:-.5px}.brand-sub{font-size:11px;color:var(--muted);margin-top:4px}
.eyebrow{display:inline-flex;align-items:center;gap:8px;color:var(--accent);font-size:12px;font-weight:700;letter-spacing:1px;margin-bottom:18px}.eyebrow i{width:7px;height:7px;border-radius:50%;background:var(--accent);box-shadow:0 0 14px var(--accent)}
h1{font-size:clamp(38px,6vw,72px);line-height:1.08;letter-spacing:-2.5px;margin:0 0 20px;font-weight:800}h1 span{color:var(--accent)}.message{font-size:17px;line-height:2;color:var(--muted);max-width:510px;margin:0}
.card{background:linear-gradient(145deg,rgba(20,57,80,.82),rgba(7,24,39,.9));border:1px solid var(--line);border-radius:28px;padding:34px;box-shadow:0 25px 80px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.04);backdrop-filter:blur(14px)}.card-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:26px}.card-title{font-size:15px;font-weight:700}.lock{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:rgba(101,199,241,.12);color:var(--accent);font-size:18px}
.field{position:relative}.field input{width:100%;height:56px;border:1px solid rgba(169,199,216,.25);border-radius:15px;background:rgba(0,0,0,.16);color:var(--ink);font-size:16px;padding:0 17px 0 50px;outline:none;transition:.2s}.field input::placeholder{color:#7897aa}.field input:focus{border-color:var(--accent);box-shadow:0 0 0 4px rgba(101,199,241,.1)}.field button{position:absolute;left:9px;top:9px;width:38px;height:38px;border:0;border-radius:10px;background:transparent;color:#7897aa;cursor:pointer;font-size:18px}.field button:hover{color:var(--accent)}
.submit{width:100%;height:54px;margin-top:13px;border:0;border-radius:15px;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#062033;font-size:15px;font-weight:800;cursor:pointer;box-shadow:0 12px 28px rgba(35,143,194,.2);transition:transform .2s,filter .2s}.submit:hover{filter:brightness(1.08);transform:translateY(-1px)}.submit:disabled{opacity:.65;cursor:wait;transform:none}.error{min-height:22px;color:#ffb5b5;font-size:12px;margin-top:12px;text-align:center}.hint{font-size:11px;color:#7897aa;text-align:center;margin:17px 0 0;line-height:1.8}
.footer{position:fixed;bottom:18px;right:0;left:0;text-align:center;color:#547589;font-size:11px;z-index:1}
@media(max-width:720px){body{padding:22px;overflow:auto}.shell{grid-template-columns:1fr;gap:26px}.brand{margin-bottom:28px}h1{font-size:46px;letter-spacing:-1.5px}.message{font-size:15px}.card{padding:25px;border-radius:22px}.footer{position:static;margin-top:22px}.shell-wrap{width:100%;max-width:520px}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}
</style>
</head>
<body>
<div class="shell-wrap"><main class="shell">
<section>
  <div class="brand"><div class="brand-mark" aria-hidden="true"></div><div><div class="brand-name">رز آرشام</div><div class="brand-sub">محصولات سلولزی با کیفیت و لطافت</div></div></div>
  <div class="eyebrow"><i></i> به‌زودی در دسترس است</div>
  <h1>${message.replace(/\n/g, '<br>')}</h1>
  <p class="message">ما در حال آماده‌سازی تجربه‌ای تازه برای شما هستیم. به‌زودی با محصولاتی باکیفیت‌تر و حضوری متفاوت برمی‌گردیم.</p>
</section>
<section class="card" aria-label="ورود به سایت اصلی">
  <div class="card-top"><div class="card-title">دسترسی اختصاصی</div><div class="lock" aria-hidden="true">⌁</div></div>
  <form id="gf" novalidate>
    <div class="field"><input id="gp" type="password" placeholder="رمز دسترسی" autocomplete="off" aria-label="رمز دسترسی"><button id="toggle" type="button" aria-label="نمایش رمز">◉</button></div>
    <div class="error" id="ge" role="status" aria-live="polite"></div>
    <button class="submit" id="submit" type="submit">ورود به سایت اصلی</button>
  </form>
  <p class="hint">اگر رمز دسترسی را دارید، آن را وارد کنید.</p>
</section>
</main><div class="footer">© رز آرشام</div></div>
<script>
const form=document.getElementById('gf'), input=document.getElementById('gp'), error=document.getElementById('ge'), submit=document.getElementById('submit'), toggle=document.getElementById('toggle');
toggle.addEventListener('click',()=>{const visible=input.type==='text';input.type=visible?'password':'text';toggle.textContent=visible?'◉':'◌';toggle.setAttribute('aria-label',visible?'نمایش رمز':'پنهان کردن رمز');input.focus()});
form.addEventListener('submit',async e=>{e.preventDefault();error.textContent='';if(!input.value.trim()){error.textContent='رمز دسترسی را وارد کنید.';input.focus();return}submit.disabled=true;submit.textContent='در حال بررسی...';try{const r=await fetch('/api/unlock',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:input.value})});if(r.ok){location.href='/';return}error.textContent='رمز دسترسی اشتباه است.';input.select()}catch(_){error.textContent='ارتباط با سرور برقرار نشد. دوباره تلاش کنید.'}finally{submit.disabled=false;submit.textContent='ورود به سایت اصلی'}});
</script>
</body></html>`;
}
async function postUnlock(request, env) {
  const body = await readJson(request);
  const s = await getGateSettings(env);
  if (!body || typeof body.password !== "string" || !s.comingsoon_password || body.password !== s.comingsoon_password) {
    return jsonResponse({ error: "رمز اشتباه است." }, 401);
  }
  const token = await createSessionToken({ gate: true }, env.SESSION_SECRET, 60 * 60 * 24 * 30);
  return jsonResponse({ ok: true }, 200, { "Set-Cookie": gateCookieHeader(token) });
}

async function getSiteMedia(request, env) {
  const rows = await env.DB.prepare("SELECT * FROM site_media WHERE active = 1 ORDER BY id ASC").all();
  return jsonResponse({ media: rows.results || [] });
}

async function adminListSiteMedia(env) {
  const rows = await env.DB.prepare("SELECT * FROM site_media ORDER BY id ASC").all();
  return jsonResponse({ media: rows.results || [] });
}

async function adminUpsertSiteMedia(request, env) {
  const body = await readJson(request);
  const { slot_key, title = "", image_url, width = "auto", height = "auto", object_fit = "cover", object_position = "center", active = 1 } = body || {};
  if (!slot_key || !image_url) return jsonResponse({ error: "شناسه و تصویر الزامی است." }, 400);
  if (!/^[a-zA-Z0-9._-]{2,80}$/.test(slot_key)) return jsonResponse({ error: "شناسه تصویر نامعتبر است." }, 400);
  const cleanDim = (v) => {
    const x = String(v ?? "auto").trim();
    return x === "auto" || /^(?:\d+(?:\.\d+)?)(?:px|%|vw|vh|rem|em)?$/.test(x) ? x : "auto";
  };
  const fit = ["cover", "contain", "fill", "none", "scale-down"].includes(object_fit) ? object_fit : "cover";
  const pos = String(object_position || "center").slice(0, 40);
  await env.DB.prepare(`INSERT INTO site_media (slot_key,title,image_url,width,height,object_fit,object_position,active,updated_at)
    VALUES (?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(slot_key) DO UPDATE SET title=excluded.title,image_url=excluded.image_url,width=excluded.width,height=excluded.height,object_fit=excluded.object_fit,object_position=excluded.object_position,active=excluded.active,updated_at=datetime('now')`)
    .bind(slot_key, String(title).slice(0,160), image_url, cleanDim(width), cleanDim(height), fit, pos, active ? 1 : 0).run();
  return jsonResponse({ ok: true });
}

async function adminDeleteSiteMedia(env, id) {
  const row = await env.DB.prepare("SELECT image_url FROM site_media WHERE id = ?").bind(id).first();
  if (!row) return jsonResponse({ error: "تصویر پیدا نشد." }, 404);
  const url = String(row.image_url || "");
  const m = url.match(/^\/api\/media\/(\d+)$/);
  await env.DB.prepare("DELETE FROM site_media WHERE id = ?").bind(id).run();
  if (m) await env.DB.prepare("DELETE FROM media WHERE id = ?").bind(m[1]).run();
  return jsonResponse({ ok: true });
}

async function getMedia(request, env, id) {
  const row = await env.DB.prepare("SELECT mime_type, data_base64 FROM media WHERE id = ?").bind(id).first();
  if (!row) return new Response("Not found", { status: 404 });
  const bytes = base64ToBytes(row.data_base64);
  return new Response(bytes, {
    headers: { "Content-Type": row.mime_type, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}

// ==================== ADMIN (protected) ROUTES ====================

async function adminMe(session) {
  return jsonResponse({ username: session.username });
}

async function adminListProducts(env) {
  const { results } = await env.DB.prepare("SELECT * FROM products ORDER BY sort_order ASC, id DESC").all();
  const products = results.map((p) => ({
    ...p,
    features: p.features_json ? JSON.parse(p.features_json) : [],
    images: p.images_json ? JSON.parse(p.images_json) : [],
  }));
  return jsonResponse({ products });
}

async function adminCreateProduct(request, env) {
  const body = await readJson(request);
  const { name, category, description, features = [], images = [], sort_order = 0 } = body || {};
  if (!name || !category) return jsonResponse({ error: "نام و دسته‌بندی محصول الزامی است." }, 400);
  const slug = slugify(name);
  const result = await env.DB.prepare(
    `INSERT INTO products (name, slug, category, description, features_json, images_json, sort_order, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
  ).bind(name, slug, category, description || "", JSON.stringify(features), JSON.stringify(images), sort_order).run();
  return jsonResponse({ ok: true, id: result.meta.last_row_id, slug }, 201);
}

async function adminUpdateProduct(request, env, id) {
  const body = await readJson(request);
  const { name, category, description, features = [], images = [], sort_order = 0, active = 1 } = body || {};
  if (!name || !category) return jsonResponse({ error: "نام و دسته‌بندی محصول الزامی است." }, 400);
  await env.DB.prepare(
    `UPDATE products SET name=?, category=?, description=?, features_json=?, images_json=?, sort_order=?, active=? WHERE id=?`
  ).bind(name, category, description || "", JSON.stringify(features), JSON.stringify(images), sort_order, active ? 1 : 0, id).run();
  return jsonResponse({ ok: true });
}

async function adminDeleteProduct(env, id) {
  await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
  return jsonResponse({ ok: true });
}

async function adminAddGalleryImage(request, env) {
  const body = await readJson(request);
  const { image_url, category = "", caption = "", sort_order = 0 } = body || {};
  if (!image_url) return jsonResponse({ error: "آدرس تصویر الزامی است." }, 400);
  const result = await env.DB.prepare(
    "INSERT INTO gallery_images (image_url, category, caption, sort_order) VALUES (?, ?, ?, ?)"
  ).bind(image_url, category, caption, sort_order).run();
  return jsonResponse({ ok: true, id: result.meta.last_row_id }, 201);
}

async function adminUpdateGalleryImage(request, env, id) {
  const body = await readJson(request);
  const { category = "", caption = "", sort_order = 0 } = body || {};
  await env.DB.prepare("UPDATE gallery_images SET category=?, caption=?, sort_order=? WHERE id=?")
    .bind(category, caption, Number(sort_order) || 0, id).run();
  return jsonResponse({ ok: true });
}

async function adminDeleteGalleryImage(env, id) {
  await env.DB.prepare("DELETE FROM gallery_images WHERE id = ?").bind(id).run();
  return jsonResponse({ ok: true });
}

async function adminUpload(request, env) {
  const ALLOWED_TYPES = [
    "image/jpeg", "image/png", "image/webp", "image/avif",
    "image/gif", "image/bmp", "image/tiff",
    "image/x-icon", "image/vnd.microsoft.icon",
    "image/heic", "image/heif",
  ];
  const MAX_BYTES = 1.5 * 1024 * 1024;

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse({ error: "درخواست آپلود نامعتبر است." }, 400);
  }
  const file = formData.get("file");
  if (!file || typeof file === "string") return jsonResponse({ error: "فایلی ارسال نشده است." }, 400);
  if (!file.type || !file.type.startsWith("image/")) {
    return jsonResponse({ error: "فایل انتخابی یک تصویر نیست." }, 400);
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return jsonResponse({ error: `فرمت «${file.type}» پشتیبانی نمی‌شود. فرمت‌های مجاز: JPG، PNG، WebP، AVIF، GIF، BMP، TIFF، ICO، HEIC/HEIF.` }, 400);
  }
  if (file.size > MAX_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    return jsonResponse({ error: `حجم تصویر (${sizeMb} مگابایت) بیشتر از حد مجاز (۱.۵ مگابایت) است.` }, 400);
  }

  const buffer = await file.arrayBuffer();
  const base64 = bufferToBase64(buffer);
  const result = await env.DB.prepare("INSERT INTO media (mime_type, data_base64) VALUES (?, ?)").bind(file.type, base64).run();
  const id = result.meta.last_row_id;
  return jsonResponse({ ok: true, url: `/api/media/${id}`, id }, 201);
}

async function adminGetSettings(env) {
  return getSettings(null, env);
}

async function adminUpdateSettings(request, env) {
  const body = await readJson(request);
  const entries = Object.entries(body || {});
  if (entries.length === 0) return jsonResponse({ error: "هیچ مقداری ارسال نشده است." }, 400);
  const stmt = env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );
  // Keep large text saves safely below D1 batch-size limits.
  for (let i = 0; i < entries.length; i += 50) {
    const chunk = entries.slice(i, i + 50);
    await env.DB.batch(chunk.map(([key, value]) => stmt.bind(key, String(value))));
  }
  return jsonResponse({ ok: true });
}

async function adminChangePassword(request, env, session) {
  const body = await readJson(request);
  const { currentPassword, newPassword } = body || {};
  if (!currentPassword || !newPassword) return jsonResponse({ error: "رمز فعلی و رمز جدید الزامی است." }, 400);
  if (String(newPassword).length < 6) return jsonResponse({ error: "رمز جدید باید حداقل ۶ کاراکتر باشد." }, 400);
  const user = await env.DB.prepare("SELECT * FROM admin_users WHERE id = ?").bind(session.uid).first();
  if (!user) return jsonResponse({ error: "کاربر یافت نشد." }, 404);
  const ok = await verifyPassword(currentPassword, user.salt, user.password_hash);
  if (!ok) return jsonResponse({ error: "رمز فعلی اشتباه است." }, 401);
  const newSalt = randomSaltHex();
  const newHash = await hashPassword(newPassword, newSalt);
  await env.DB.prepare("UPDATE admin_users SET password_hash = ?, salt = ? WHERE id = ?").bind(newHash, newSalt, user.id).run();
  return jsonResponse({ ok: true });
}

// ==================== CATEGORIES ====================
async function adminListCategories(env) {
  const { results } = await env.DB.prepare("SELECT * FROM categories ORDER BY sort_order ASC, id ASC").all();
  return jsonResponse({ categories: results });
}

async function adminCreateCategory(request, env) {
  const body = await readJson(request);
  const { label, slug: rawSlug } = body || {};
  if (!label || !String(label).trim()) return jsonResponse({ error: "نام دسته‌بندی الزامی است." }, 400);
  const slug = slugify(rawSlug && String(rawSlug).trim() ? rawSlug : label);
  if (!slug) return jsonResponse({ error: "اسلاگ نامعتبر است." }, 400);
  const existing = await env.DB.prepare("SELECT id FROM categories WHERE slug = ?").bind(slug).first();
  if (existing) return jsonResponse({ error: "دسته‌بندی‌ای با این اسلاگ قبلاً وجود دارد." }, 400);
  const { results: maxRows } = await env.DB.prepare("SELECT COALESCE(MAX(sort_order), 0) AS m FROM categories").all();
  const nextOrder = (maxRows?.[0]?.m || 0) + 1;
  const result = await env.DB.prepare("INSERT INTO categories (slug, label, sort_order) VALUES (?, ?, ?)")
    .bind(slug, String(label).trim(), nextOrder).run();
  return jsonResponse({ ok: true, id: result.meta.last_row_id, slug }, 201);
}

async function adminUpdateCategory(request, env, id) {
  const body = await readJson(request);
  const { label, sort_order } = body || {};
  if (!label || !String(label).trim()) return jsonResponse({ error: "نام دسته‌بندی الزامی است." }, 400);
  await env.DB.prepare("UPDATE categories SET label = ?, sort_order = COALESCE(?, sort_order) WHERE id = ?")
    .bind(String(label).trim(), sort_order ?? null, id).run();
  return jsonResponse({ ok: true });
}

async function adminDeleteCategory(env, id) {
  const cat = await env.DB.prepare("SELECT slug FROM categories WHERE id = ?").bind(id).first();
  if (!cat) return jsonResponse({ error: "دسته‌بندی یافت نشد." }, 404);
  const used = await env.DB.prepare("SELECT COUNT(*) AS c FROM products WHERE category = ?").bind(cat.slug).first();
  if (used && used.c > 0) {
    return jsonResponse({ error: `این دسته‌بندی برای ${used.c} محصول استفاده شده و قابل حذف نیست. ابتدا دسته‌بندی آن محصولات را تغییر دهید.` }, 400);
  }
  await env.DB.prepare("DELETE FROM categories WHERE id = ?").bind(id).run();
  return jsonResponse({ ok: true });
}

// ==================== ROUTER ====================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    try {
      return await route(request, env, pathname, method);
    } catch (err) {
      console.error(err);
      return jsonResponse({ error: "خطای غیرمنتظره‌ای رخ داد.", detail: String(err && err.message || err) }, 500);
    }
  },
};

async function route(request, env, pathname, method) {
      // ---- public ----
      if (pathname === "/api/products" && method === "GET") return getProducts(request, env);
      let m = pathname.match(/^\/api\/products\/([^/]+)$/);
      if (m && method === "GET") return getProductById(request, env, m[1]);

      if (pathname === "/api/gallery" && method === "GET") return getGallery(request, env);
      if (pathname === "/api/settings" && method === "GET") return getSettings(request, env);
      if (pathname === "/api/categories" && method === "GET") return getCategories(env);
      if (pathname === "/api/site-media" && method === "GET") return getSiteMedia(request, env);
      if (pathname === "/api/login" && method === "POST") return postLogin(request, env);
      if (pathname === "/api/logout" && method === "POST") return postLogout();
      if (pathname === "/api/unlock" && method === "POST") return postUnlock(request, env);

      m = pathname.match(/^\/api\/media\/([^/]+)$/);
      if (m && method === "GET") return getMedia(request, env, m[1]);

      // ---- admin (protected) ----
      if (pathname.startsWith("/api/admin/")) {
        const session = await requireSession(request, env);
        if (!session) return jsonResponse({ error: "احراز هویت نشده — لطفاً دوباره وارد شوید." }, 401);

        if (pathname === "/api/admin/me" && method === "GET") return adminMe(session);
        if (pathname === "/api/admin/change-password" && method === "POST") return adminChangePassword(request, env, session);

        if (pathname === "/api/admin/products" && method === "GET") return adminListProducts(env);
        if (pathname === "/api/admin/products" && method === "POST") return adminCreateProduct(request, env);
        m = pathname.match(/^\/api\/admin\/products\/([^/]+)$/);
        if (m && method === "PUT") return adminUpdateProduct(request, env, m[1]);
        if (m && method === "DELETE") return adminDeleteProduct(env, m[1]);

        if (pathname === "/api/admin/gallery" && method === "POST") return adminAddGalleryImage(request, env);
        m = pathname.match(/^\/api\/admin\/gallery\/([^/]+)$/);
        if (m && method === "PUT") return adminUpdateGalleryImage(request, env, m[1]);
        if (m && method === "DELETE") return adminDeleteGalleryImage(env, m[1]);

        if (pathname === "/api/admin/upload" && method === "POST") return adminUpload(request, env);

        if (pathname === "/api/admin/site-media" && method === "GET") return adminListSiteMedia(env);
        if (pathname === "/api/admin/site-media" && method === "POST") return adminUpsertSiteMedia(request, env);
        m = pathname.match(/^\/api\/admin\/site-media\/(\d+)$/);
        if (m && method === "DELETE") return adminDeleteSiteMedia(env, m[1]);

        if (pathname === "/api/admin/settings" && method === "PUT") return adminUpdateSettings(request, env);
        if (pathname === "/api/admin/settings" && method === "GET") return adminGetSettings(env);

        if (pathname === "/api/admin/categories" && method === "GET") return adminListCategories(env);
        if (pathname === "/api/admin/categories" && method === "POST") return adminCreateCategory(request, env);
        m = pathname.match(/^\/api\/admin\/categories\/(\d+)$/);
        if (m && method === "PUT") return adminUpdateCategory(request, env, m[1]);
        if (m && method === "DELETE") return adminDeleteCategory(env, m[1]);

        return jsonResponse({ error: "مسیر یافت نشد." }, 404);
      }

      // ---- coming-soon gate (main site pages only; /admin untouched) ----
      if (GATED_PATHS.has(pathname)) {
        const s = await getGateSettings(env);
        if (s.comingsoon_enabled === "1" && !(await isUnlocked(request, env))) {
          return new Response(comingSoonHtml(s.comingsoon_text), { headers: { "Content-Type": "text/html; charset=utf-8" } });
        }
      }

      // ---- anything else: let static assets handle it ----
      return env.ASSETS.fetch(request);
}
