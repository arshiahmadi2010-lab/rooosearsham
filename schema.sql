-- Rose Arsham — D1 schema
-- Apply with: wrangler d1 execute rose-arsham-db --file=./schema.sql

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,          -- facial | toilet | towel | napkin
  description TEXT,
  features_json TEXT DEFAULT '[]', -- JSON array of short feature strings
  images_json TEXT DEFAULT '[]',   -- JSON array of R2 image URLs
  sort_order INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gallery_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_url TEXT NOT NULL,
  category TEXT DEFAULT '',        -- کارخانه | محصول | بسته‌بندی | رویداد
  caption TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mime_type TEXT NOT NULL,
  data_base64 TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);


CREATE TABLE IF NOT EXISTS site_media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slot_key TEXT UNIQUE NOT NULL,
  title TEXT DEFAULT '',
  image_url TEXT NOT NULL,
  width TEXT DEFAULT 'auto',
  height TEXT DEFAULT 'auto',
  object_fit TEXT DEFAULT 'cover',
  object_position TEXT DEFAULT 'center',
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT DEFAULT '',
  message TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Starter site texts — edit these values from the admin panel later.
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('hero_title', 'لطافتی که حس می‌شود.'),
  ('hero_subtitle', 'رز آرشام، از دل الیاف طبیعی، محصولات کاغذی‌ای می‌سازد که کیفیتشان را نه با حرف، که با لمس می‌شناسید.'),
  ('about_text', 'رز آرشام با این باور شکل گرفت که محصولات بهداشتی روزمره نباید سازش بین کیفیت و ملایمت باشند.'),
  ('contact_phone', '۰۲۱-۰۰۰۰۰۰۰'),
  ('contact_email', 'info@rosearsham.example'),
  ('contact_address', 'پس از نهایی‌شدن، از پنل ادمین ثبت می‌شود');

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO categories (slug, label, sort_order) VALUES
  ('facial', 'دستمال کاغذی صورت', 1),
  ('toilet', 'دستمال توالت', 2),
  ('towel', 'حوله کاغذی', 3),
  ('napkin', 'دستمال سفره', 4);
