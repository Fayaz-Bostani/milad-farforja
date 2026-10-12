-- ═══ اجرا کن روی دیتابیس milad_farforja (فقط یک بار) ═══
-- اگر خطای Duplicate column یا already exists دید، یعنی آن خط قبلاً اجرا شده؛ ادامه بده.
-- (migration_worker_link.sql را هم اگر هنوز اجرا نکرده‌ای، اجرا کن)

-- ۱) نوع کار کارگر: اضافه شدن «روزمزد + کانتورات»
ALTER TABLE workers MODIFY work_type VARCHAR(20) NOT NULL DEFAULT 'daily';

-- ۲) ساعت‌های یک روز کامل کار (برای محاسبه‌ی نیم‌روز و ساعتی)
ALTER TABLE workers ADD COLUMN day_hours DECIMAL(4,1) NOT NULL DEFAULT 8;

-- ۳) حضور: نوع روز و مبلغ مزد همان روز
ALTER TABLE worker_attendance ADD COLUMN day_part VARCHAR(10) NULL;
ALTER TABLE worker_attendance ADD COLUMN wage_amount DECIMAL(14,2) NOT NULL DEFAULT 0;

-- ۴) پرداخت‌ها: مساعده یا پرداخت حقوق
ALTER TABLE worker_advances ADD COLUMN kind VARCHAR(20) NOT NULL DEFAULT 'advance';

-- ۵) کارهای کانتورات
CREATE TABLE IF NOT EXISTS worker_contract_jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  worker_id INT NOT NULL,
  work_date DATE NOT NULL,
  job_type VARCHAR(50) NOT NULL,
  job_label VARCHAR(100) NULL,
  quantity DECIMAL(12,2) NOT NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'kg',
  unit_label VARCHAR(50) NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  note VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_worker_date (worker_id, work_date)
);
