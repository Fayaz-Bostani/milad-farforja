const pool = require('./DB');
const bcrypt = require('bcryptjs');

async function setupOnlineDatabase() {
  try {
    console.log('Starting database setup...');

    // 1. ساخت جدول کاربران با مچ کردن ساختار دقیق سرور مای‌اس‌کیوال
    await pool.query("CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, role VARCHAR(50) NOT NULL DEFAULT 'user', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    console.log('Table users created successfully!');

    // 2. تزریق حساب ادمین اصلی
    const email = 'fayazbostani72@gmail.com';
    const password = 'milad8311';
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    await pool.query(
      'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE password_hash = ?',
      [email, hashedPassword, 'admin', hashedPassword]
    );
    
    console.log('Admin account activated successfully!');
    console.log('You can now log in to the website.');

  } catch (error) {
    console.error('Error occurred:', error.message);
  } finally {
    process.exit();
  }
}

setupOnlineDatabase();