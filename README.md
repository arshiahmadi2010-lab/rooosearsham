# سایت رز آرشام — راهنمای استقرار روی کلودفلر (رایگان، بدون نیاز به کارت بانکی)

## ساختار پروژه

```
rose-arsham/
├── index.html, products.html, product-detail.html, gallery.html, about.html, contact.html
├── style.css, script.js          ← سایت اصلی (استاتیک)
├── admin/                        ← پنل مدیریت (index.html, app.js)
├── functions/                    ← بک‌اند (Cloudflare Pages Functions)
│   ├── api/products.js, api/gallery.js, api/settings.js, api/contact.js
│   ├── api/media/[id].js         ← نمایش عکس‌های آپلودشده
│   ├── api/login.js, api/logout.js
│   └── api/admin/…               ← مسیرهای محافظت‌شده (نیاز به ورود)
├── schema.sql                    ← ساختار دیتابیس D1
├── scripts/create-admin.js       ← ساخت اولین کاربر ادمین
└── wrangler.toml
```

توجه: عکس‌ها به‌جای R2 (که حتی در نسخه‌ی رایگان هم شماره کارت می‌خواهد) مستقیم داخل دیتابیس D1 ذخیره می‌شوند — دیتابیس D1 کاملاً رایگان است و هیچ کارتی نمی‌خواهد.

## راه‌اندازی کاملاً دستی از طریق سایت کلودفلر (بدون نیاز به نصب هیچ برنامه‌ای)

۱. وارد dash.cloudflare.com شوید (یا یک حساب رایگان بسازید).
۲. از منوی Workers & Pages، بخش D1 را باز کنید و یک دیتابیس به نام `rose-arsham-db` بسازید.
۳. وارد همان دیتابیس شوید، تب Console را باز کنید و کل محتوای فایل `schema.sql` را در آنجا پیست و اجرا (Execute) کنید.
۴. از منوی Workers & Pages، روی Create application → Pages → Upload assets کلیک کنید. اسم پروژه را `rose-arsham` بگذارید و کل پوشه‌ی پروژه را در صفحه رها کنید (Drag & Drop) تا آپلود شود.
۵. بعد از آپلود، وارد Settings همین پروژه شوید، بخش Functions را پیدا کنید و در قسمت D1 database bindings، دیتابیس `rose-arsham-db` را با نام متغیر `DB` وصل کنید.
۶. در همان صفحه، یک Secret به نام `SESSION_SECRET` با یک رشته‌ی طولانی و تصادفی دلخواه بسازید.
۷. چون این تنظیمات بعد از آپلود اول انجام شد، یک بار دیگر همان پوشه را آپلود کنید (یا در تب Deployments روی Retry deployment بزنید).
۸. برای ساخت اولین کاربر ادمین، متن SQL آماده (که دستیار برایتان می‌سازد) را در همان کادر Console دیتابیس پیست و اجرا کنید.

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
wrangler d1 execute rose-arsham-db --file=./schema.sql --remote
wrangler pages secret put SESSION_SECRET
node scripts/create-admin.js YOUR_USERNAME YOUR_PASSWORD
wrangler pages deploy . --project-name=rose-arsham
```
