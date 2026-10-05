# Backend - کارخانه میلاد فرفورژه

## نصب و راه‌اندازی

### ۱. نصب پکیج‌ها
```bash
cd backend
npm install
```

### ۲. تنظیم .env
```bash
cp .env.example .env
```
فایل `.env` را باز کن و اطلاعات دیتابیس‌ات را وارد کن:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=رمز_دیتابیس_خودت
DB_NAME=milad_farforja
JWT_SECRET=یه_رشته_تصادفی_طولانی
```

### ۳. ساخت دیتابیس
در MySQL Workbench یا phpMyAdmin، فایل `database/schema.sql` را اجرا کن.

### ۴. اجرای سرور
```bash
# حالت توسعه (با nodemon)
npm run dev

# حالت عادی
npm start
```

سرور روی `http://localhost:5000` اجرا می‌شود.

---

## ساختار API

| متد | مسیر | توضیح |
|-----|------|-------|
| POST | /api/auth/login | ورود |
| POST | /api/auth/register | ثبت‌نام |
| GET  | /api/auth/me | اطلاعات کاربر فعلی |
| GET  | /api/workers | لیست کارگران |
| GET  | /api/customers | لیست مشتریان |
| GET  | /api/products | لیست محصولات |
| GET  | /api/products/public | کاتالوگ عمومی (برای QR) |
| GET  | /api/orders | لیست سفارشات |
| GET  | /api/invoices | لیست فاکتورها |
| GET  | /api/finance/dashboard | داشبورد مالی |
| ... | ... | ... |

## سطح دسترسی

- **admin** → همه چیز
- **staff** → کارگران، مشتریان، سفارشات، محصولات، انبار
- **customer** → فقط محصولات و انبار
