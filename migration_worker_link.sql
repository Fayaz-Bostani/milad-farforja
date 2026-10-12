-- اجرا کن روی دیتابیس milad_farforja (Aiven و لوکال اگر جداست)
-- اگر خطای Duplicate column دید، یعنی قبلاً اضافه شده و مشکلی نیست
ALTER TABLE workers ADD COLUMN user_id INT NULL;
