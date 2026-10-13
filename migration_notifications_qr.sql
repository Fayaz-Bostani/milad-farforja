-- اجرا: node run-migrations.js   (یا داخل Workbench روی دیتابیس milad_farforja)
-- اگر خطای Duplicate / already exists دید، یعنی قبلاً انجام شده و مشکلی نیست

-- ۱) اعلان‌ها (مثلاً «سفارش تازه»)
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(30) NOT NULL,
  message VARCHAR(255) NOT NULL,
  order_id INT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notif_read (is_read, created_at)
);
