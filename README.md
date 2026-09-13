# سایت رز آرشام — راهنمای استقرار روی کلودفلر (رایگان، بدون نیاز به کارت بانکی)

## ساختار پروژه

```
rose-arsham/
├── index.html, products.html, product-detail.html, gallery.html, about.html, contact.html
├── style.css, script.js          ← سایت اصلی (استاتیک)
├── src/worker.js                 ← بک‌اند Cloudflare Worker + API
├── src/lib/auth.js               ← احراز هویت و سشن ادمین
├── admin/                         ← پنل مدیریت
│   ├── index.html
│   └── app.js
├── schema.sql                    ← ساختار دیتابیس D1
├── scripts/create-admin.js       ← ساخت اولین کاربر ادمین
└── wrangler.toml
```

توجه: تصاویر آپلودی مستقیم داخل جدول `media` در D1 ذخیره می‌شوند و پروژه به R2 وابسته نیست.

## راه‌اندازی کاملاً دستی از طریق سایت کلودفلر (بدون نیاز به نصب هیچ برنامه‌ای)

۱. وارد dash.cloudflare.com شوید (یا یک حساب رایگان بسازید).
۲. از داشبورد Cloudflare، بخش D1 را باز کنید و دیتابیس `rose-arsham-db1` را بسازید (یا اگر از قبل ساخته شده، همان دیتابیس متصل به Worker را استفاده کنید).
۳. وارد همان دیتابیس شوید، تب Console را باز کنید و کل محتوای `schema.sql` را اجرا کنید.
۴. پروژه را به‌عنوان Cloudflare Worker با فایل `wrangler.toml` مستقر کنید و پوشه‌ی پروژه را به Worker متصل کنید.
۵. در تنظیمات Worker، D1 با نام binding برابر `DB` باید به `rose-arsham-db1` متصل باشد.
۶. یک Secret با نام `SESSION_SECRET` و یک مقدار تصادفی و طولانی تنظیم کنید.
۷. Worker را دوباره Deploy کنید تا binding و secret اعمال شوند.
۸. برای ساخت اولین کاربر ادمین، SQL لازم را در Console همان D1 اجرا کنید.

## آدرس‌ها
- سایت اصلی: `/`
- پنل مدیریت: `/admin/`

## وقتی دامنه را خریدید
از داشبورد Cloudflare Pages → Custom domains → دامنه را اضافه کنید. کلودفلر خودش DNS و SSL را تنظیم می‌کند.

## نکته امنیتی (پیشنهادی)
پنل ادمین با نام‌کاربری/رمز عبور محافظت می‌شود. برای یک لایه‌ی امنیتی اضافه و رایگان، می‌توانید از Cloudflare Access (بخش Zero Trust، رایگان تا ۵۰ کاربر) استفاده کنید تا مسیر `/admin/*` حتی قبل از رسیدن به سایت هم محافظت شود.

## یادآوری
- محتوای فعلی محصولات، گالری و متن‌ها به‌صورت نمونه (placeholder) است. بعد از دیپلوی، از طریق پنل ادمین (`/admin/`) عکس‌ها و متن‌های واقعی رز آرشام را جایگزین کنید.
- چون عکس‌ها داخل دیتابیس ذخیره می‌شوند، بهتر است پیش از آپلود، حجم هر عکس را زیر ۱ مگابایت نگه دارید (با یک ابزار فشرده‌سازی آنلاین ساده).

## راه‌اندازی با خط فرمان (اختیاری، برای کاربران حرفه‌ای‌تر)
اگر بعداً خواستید از طریق Wrangler CLI کار کنید:
```
npm install -g wrangler
wrangler login
wrangler d1 create rose-arsham-db
wrangler d1 execute rose-arsham-db1 --file=./schema.sql --remote
wrangler secret put SESSION_SECRET
node scripts/create-admin.js YOUR_USERNAME YOUR_PASSWORD
wrangler deploy
```
