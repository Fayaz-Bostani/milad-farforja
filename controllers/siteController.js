const db = require('../db');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// آپلود موقت در حافظه (چون قراره با sharp پردازش بشه، نه مستقیم ذخیره)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

// اطلاعات عمومی سایت (چیزهایی که صفحه اصلی/کاتالوگ بدون لاگین نیاز داره)
const getPublicSettings = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('logo_path','logo_updated_at')"
    );
    const map = Object.fromEntries(rows.map(r => [r.setting_key, r.setting_value]));
    res.json({ logo_path: map.logo_path || null, logo_updated_at: map.logo_updated_at || null });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

// آپلود/تغییر لوگو — با sharp تبدیل به یه مربع تمیز می‌شه (بدون کراپ زیاد؛ کل عکس نگه داشته می‌شه)
const uploadLogo = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'هیچ عکسی ارسال نشد.' });

    const outPath = path.join(__dirname, '..', 'uploads', 'site', 'logo.png');
    await sharp(req.file.buffer)
      .resize(512, 512, {
        fit: 'contain',            // کل عکس نگه داشته می‌شه، کراپ نمی‌شه
        background: { r: 15, g: 23, b: 42, alpha: 1 }, // پس‌زمینه هم‌رنگ تم تیره سایت
      })
      .png()
      .toFile(outPath);

    const logoPath = '/uploads/site/logo.png';
    const now = String(Date.now());

    await db.query(
      `INSERT INTO settings (setting_key, setting_value) VALUES ('logo_path', ?)
       ON DUPLICATE KEY UPDATE setting_value = ?`,
      [logoPath, logoPath]
    );
    await db.query(
      `INSERT INTO settings (setting_key, setting_value) VALUES ('logo_updated_at', ?)
       ON DUPLICATE KEY UPDATE setting_value = ?`,
      [now, now]
    );

    res.json({ logo_path: logoPath, logo_updated_at: now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطای سرور در پردازش عکس.' });
  }
};

module.exports = { getPublicSettings, uploadLogo, upload };
