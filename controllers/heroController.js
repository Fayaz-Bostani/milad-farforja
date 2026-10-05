const db = require('../db');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// آپلود توی حافظه (نه مستقیم دیسک) چون قراره با sharp کوچیک/فشرده بشه — همینم مشکل عکس‌های حجیم موبایل رو حل می‌کنه
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }); // تا ۲۰ مگابایت قبل از پردازش قبول می‌شه

// لیست عکس‌های گالری صفحه اصلی (عمومی)
const getAll = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM hero_images ORDER BY sort_order, created_at');
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

// افزودن عکس جدید — با sharp فشرده و کوچیک می‌شه تا سایت کند نشه
const add = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'هیچ عکسی ارسال نشد.' });

    const filename = `${Date.now()}.jpg`;
    const outPath = path.join(__dirname, '..', 'uploads', 'hero', filename);

    await sharp(req.file.buffer)
      .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }) // بزرگتر از ۱۶۰۰px لازم نیست، ولی کوچیکتر رو دست نمی‌زنه
      .jpeg({ quality: 82 })
      .toFile(outPath);

    const image_path = `/uploads/hero/${filename}`;
    const [result] = await db.query('INSERT INTO hero_images (image_path) VALUES (?)', [image_path]);
    res.status(201).json({ id: result.insertId, image_path });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور در پردازش عکس.' }); }
};

// حذف عکس
const remove = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT image_path FROM hero_images WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'عکس یافت نشد.' });

    await db.query('DELETE FROM hero_images WHERE id = ?', [req.params.id]);

    const filePath = path.join(__dirname, '..', rows[0].image_path);
    fs.unlink(filePath, () => {}); // اگه فایل نبود مهم نیست، فقط بی‌صدا رد شو

    res.json({ message: 'عکس حذف شد.' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

module.exports = { getAll, add, remove, upload };
