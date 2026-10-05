const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'milad_farforja',
  charset:  'utf8mb4',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
});

// تست اتصال
pool.getConnection()
  .then(conn => {
    console.log('✅ اتصال به دیتابیس برقرار شد');
    conn.release();
  })
  .catch(err => {
    console.error('❌ خطا در اتصال به دیتابیس:', err.message);
  });

module.exports = pool;
