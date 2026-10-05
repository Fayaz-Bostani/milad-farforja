require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const app = express();

// ---- پوشه‌های آپلود ----
['uploads/products', 'uploads/orders', 'uploads/hero', 'uploads/site'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ---- Middleware ----
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ---- فایل‌های استاتیک (عکس‌ها) ----
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ---- روت‌ها ----
app.use('/api', require('./routes/index'));

// ---- روت سلامت ----
app.get('/health', (req, res) => res.json({ status: 'ok', message: 'سرور کارخانه میلاد فرفورژه فعال است.' }));

// ---- مدیریت خطا ----
app.use((req, res) => res.status(404).json({ message: 'مسیر یافت نشد.' }));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'خطای داخلی سرور.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ سرور روی پورت ${PORT} اجرا شد`);
  console.log(`🌐 آدرس: http://localhost:${PORT}`);
});
