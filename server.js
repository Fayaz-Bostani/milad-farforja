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
const pool = require('./DB');
const bcrypt = require('bcryptjs');

app.listen(PORT, async () => {
  console.log(✅ سرور روی پورت ${PORT} اجرا شد);
  
  try {
    // ساخت خودکار جدول در سرور آنلاین رندر
    await pool.query("CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, role VARCHAR(50) NOT NULL DEFAULT 'user', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    
    // تزریق مستقیم و اتوماتیک حساب ادمین اصلی
    const email = 'fayazbostani72@gmail.com';
    const password = 'milad8311';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await pool.query(
      'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE password_hash = ?',
      [email, hashedPassword, 'admin', hashedPassword]
    );
    console.log('🚀 [Auto-Setup] حساب ادمین اصلی با موفقیت روی اینترنت تایید و لایو شد!');
  } catch (err) {
    console.error('❌ خطا در ست‌آپ خودکار دیتابیس:', err.message);
  }
});
