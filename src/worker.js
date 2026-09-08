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
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>به‌زودی</title><link rel="stylesheet" href="/style.css"><style>body{display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#faf7f2}.gate-box{max-width:420px;width:90%;text-align:center;padding:2rem;background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.08)}.gate-box input{width:100%;padding:.7rem;margin:1rem 0;border:1px solid #ddd;border-radius:8px;font-size:1rem;box-sizing:border-box}.gate-box button{width:100%;padding:.7rem;border:none;border-radius:8px;background:#b76e79;color:#fff;font-size:1rem;cursor:pointer}.gate-err{color:#c0392b;min-height:1.2em;font-size:.9rem}</style></head><body>
<div class="gate-box">
<h2>${escapeHtml(text || "به زودی برمی‌گردیم")}</h2>
<form id="gf"><input type="password" id="gp" placeholder="رمز عبور" autofocus><div class="gate-err" id="ge"></div><button type="submit">ورود</button></form>
</div>
<script>
document.getElementById('gf').addEventListener('submit', async (e)=>{e.preventDefault();
const r=await fetch('/api/unlock',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:document.getElementById('gp').value})});
if(r.ok){location.reload();}else{document.getElementById('ge').textContent='رمز اشتباه است.';}
});
</script>
</body></html>`;
}

async function postUnlock(request, env) {
  const body = await readJson(request);
  const s = await getGateSettings(env);
  if (!body || !body.password || body.password !== (s.comingsoon_password || "")) {
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

      // ---------- custom visual-editor pages ----------
const PAGE_KEYS = { "/": "index", "/index.html": "index", "/about.html": "about", "/gallery.html": "gallery", "/contact.html": "contact", "/products.html": "products" };

async function getCustomPage(env, key) {
  const { results } = await env.DB.prepare("SELECT key, value FROM settings WHERE key IN (?, ?)").bind("page_html_" + key, "page_css_" + key).all();
  const s = {};
  for (const r of results) s[r.key] = r.value;
  return { html: s["page_html_" + key] || "", css: s["page_css_" + key] || "" };
}

function customPageResponse(html, css) {
  return new Response(`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><style>${css}</style></head><body>${html}</body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

      // ---- custom visual-editor page override ----
      const pageKey = PAGE_KEYS[pathname];
      if (pageKey) {
        const cp = await getCustomPage(env, pageKey);
        if (cp.html) return customPageResponse(cp.html, cp.css);
      }

      // ---- anything else: let static assets handle it ----
      return env.ASSETS.fetch(request);
}
