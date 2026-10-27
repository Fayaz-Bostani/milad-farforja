const multer = require('multer');
const db = require('../db');

// ============================================================
// یادداشت‌ها (ادمین، مالک، کارگر)
//  - هر کاربر یادداشت‌های خودش را می‌سازد، ویرایش و حذف می‌کند
//  - می‌شود یادداشت را برای ادمین/مالک/کارگرهای دیگر فرستاد (فقط خواندنی برای گیرنده)
//  - فایل‌ها داخل خود دیتابیس نگه داشته می‌شوند (با هر دیپلوی روی «رندر» پاک نمی‌شوند)
// ============================================================

const MAX_FILE = 5 * 1024 * 1024;         // ۵ مگابایت برای هر فایل
const MAX_FILES_PER_NOTE = 20;
const BLOCKED_EXT = ['exe', 'bat', 'cmd', 'com', 'msi', 'sh', 'js', 'vbs', 'ps1', 'scr', 'jar', 'php', 'dll', 'apk'];
const DEFAULT_RE = /^یادداشت شماره (\d+)$/;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE, files: 10 } });
const uploadFiles = (req, res, next) => {
  upload.array('files', 10)(req, res, err => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'حجم هر فایل حداکثر ۵ مگابایت است.' : 'خطا در بارگذاری فایل.';
      return res.status(400).json({ message: msg });
    }
    next();
  });
};

// multer اسم فایل فارسی را خراب می‌خواند؛ اینجا درستش می‌کنیم
const fixName = s => {
  try { const t = Buffer.from(String(s || ''), 'latin1').toString('utf8'); return t.includes('\uFFFD') ? String(s) : t; }
  catch (e) { return String(s || ''); }
};
const extOf = name => { const m = /\.([A-Za-z0-9]{1,8})$/.exec(name || ''); return m ? m[1].toLowerCase() : ''; };
const downloadName = (display, original) => {
  const ext = extOf(original);
  if (!ext) return display;
  return display.toLowerCase().endsWith('.' + ext) ? display : `${display}.${ext}`;
};

const nextDefaultTitle = async userId => {
  const [rows] = await db.query("SELECT title FROM notes WHERE user_id = ? AND title LIKE 'یادداشت شماره %'", [userId]);
  let max = 0;
  rows.forEach(r => { const m = DEFAULT_RE.exec(r.title); if (m) max = Math.max(max, parseInt(m[1], 10)); });
  return `یادداشت شماره ${max + 1}`;
};

// آیا این کاربر حق دیدن این یادداشت را دارد؟ (صاحب یا گیرنده)
const access = async (noteId, userId) => {
  const [n] = await db.query('SELECT * FROM notes WHERE id = ?', [noteId]);
  if (!n.length) return null;
  if (n[0].user_id === userId) return { note: n[0], mine: true };
  const [s] = await db.query('SELECT id FROM note_shares WHERE note_id = ? AND user_id = ?', [noteId, userId]);
  return s.length ? { note: n[0], mine: false } : null;
};

// فقط کاربرانی که واقعاً می‌توانند گیرنده باشند
const validRecipients = async (ids, selfId) => {
  const clean = [...new Set((ids || []).map(Number).filter(n => Number.isInteger(n) && n !== selfId))];
  if (!clean.length) return [];
  const [rows] = await db.query(
    `SELECT id FROM users WHERE id IN (${clean.map(() => '?').join(',')})
       AND role IN ('admin','owner','staff') AND is_approved = 1 AND is_active = 1`, clean);
  return rows.map(r => r.id);
};

const syncShares = async (noteId, ids) => {
  const [cur] = await db.query('SELECT user_id FROM note_shares WHERE note_id = ?', [noteId]);
  const have = cur.map(r => r.user_id);
  const toAdd = ids.filter(i => !have.includes(i));
  const toRemove = have.filter(i => !ids.includes(i));
  if (toRemove.length) await db.query(`DELETE FROM note_shares WHERE note_id = ? AND user_id IN (${toRemove.map(() => '?').join(',')})`, [noteId, ...toRemove]);
  for (const uid of toAdd) await db.query('INSERT INTO note_shares (note_id, user_id) VALUES (?, ?)', [noteId, uid]);
};

const fileRow = f => ({
  id: f.id, display_name: f.display_name, original_name: f.original_name,
  size: f.size, mime_type: f.mime_type, download_name: downloadName(f.display_name, f.original_name),
});

// ---------- لیست‌ها
const listMine = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT n.id, n.title, n.created_at, n.updated_at, LEFT(n.body, 160) AS preview,
              (SELECT COUNT(*) FROM note_files f WHERE f.note_id = n.id) AS file_count,
              (SELECT COUNT(*) FROM note_shares s WHERE s.note_id = n.id) AS share_count
         FROM notes n WHERE n.user_id = ? ORDER BY n.updated_at DESC, n.id DESC`, [req.user.id]);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

const listReceived = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT n.id, n.title, n.updated_at, LEFT(n.body, 160) AS preview, u.name AS from_name, s.is_read, s.shared_at,
              (SELECT COUNT(*) FROM note_files f WHERE f.note_id = n.id) AS file_count
         FROM note_shares s JOIN notes n ON n.id = s.note_id JOIN users u ON u.id = n.user_id
        WHERE s.user_id = ? ORDER BY s.shared_at DESC, s.id DESC`, [req.user.id]);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

const unreadCount = async (req, res) => {
  try {
    const [[r]] = await db.query('SELECT COUNT(*) AS c FROM note_shares WHERE user_id = ? AND is_read = 0', [req.user.id]);
    res.json({ count: r.c });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

// فقط اسم و شناسه (بدون ایمیل و نقش)
const getRecipients = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, name FROM users WHERE role IN ('admin','owner','staff') AND is_approved = 1 AND is_active = 1 AND id <> ? ORDER BY name`,
      [req.user.id]);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

// ---------- یک یادداشت
const getOne = async (req, res) => {
  try {
    const a = await access(req.params.id, req.user.id);
    if (!a) return res.status(404).json({ message: 'یادداشت پیدا نشد.' });
    const [files] = await db.query(
      'SELECT id, display_name, original_name, mime_type, size FROM note_files WHERE note_id = ? ORDER BY id', [a.note.id]);
    const out = {
      note: { id: a.note.id, title: a.note.title, body: a.note.body || '', created_at: a.note.created_at, updated_at: a.note.updated_at, mine: a.mine },
      files: files.map(fileRow),
    };
    if (a.mine) {
      const [sh] = await db.query('SELECT u.id, u.name FROM note_shares s JOIN users u ON u.id = s.user_id WHERE s.note_id = ? ORDER BY u.name', [a.note.id]);
      out.shared_with = sh;
    } else {
      const [[o]] = await db.query('SELECT name FROM users WHERE id = ?', [a.note.user_id]);
      out.note.owner_name = o ? o.name : '';
      await db.query('UPDATE note_shares SET is_read = 1 WHERE note_id = ? AND user_id = ?', [a.note.id, req.user.id]);
    }
    res.json(out);
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

const create = async (req, res) => {
  try {
    const { title, body, share_with } = req.body;
    const t = (title || '').trim() || await nextDefaultTitle(req.user.id);
    const [r] = await db.query('INSERT INTO notes (user_id, title, body) VALUES (?, ?, ?)', [req.user.id, t.slice(0, 200), body || null]);
    await syncShares(r.insertId, await validRecipients(share_with, req.user.id));
    res.status(201).json({ id: r.insertId, title: t });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

const update = async (req, res) => {
  try {
    const a = await access(req.params.id, req.user.id);
    if (!a || !a.mine) return res.status(404).json({ message: 'یادداشت پیدا نشد.' });
    const { title, body, share_with } = req.body;
    let t = (title || '').trim();
    if (!t) t = DEFAULT_RE.test(a.note.title) ? a.note.title : await nextDefaultTitle(req.user.id);
    await db.query('UPDATE notes SET title = ?, body = ? WHERE id = ?', [t.slice(0, 200), body || null, a.note.id]);
    if (Array.isArray(share_with)) await syncShares(a.note.id, await validRecipients(share_with, req.user.id));
    res.json({ message: 'یادداشت ذخیره شد.', title: t });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

const remove = async (req, res) => {
  try {
    const a = await access(req.params.id, req.user.id);
    if (!a || !a.mine) return res.status(404).json({ message: 'یادداشت پیدا نشد.' });
    await db.query('DELETE FROM note_files WHERE note_id = ?', [a.note.id]);
    await db.query('DELETE FROM note_shares WHERE note_id = ?', [a.note.id]);
    await db.query('DELETE FROM notes WHERE id = ?', [a.note.id]);
    res.json({ message: 'یادداشت حذف شد.' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

// گیرنده یادداشت را از دریافتی‌های خودش پاک می‌کند (اصل یادداشت می‌ماند)
const leaveReceived = async (req, res) => {
  try {
    await db.query('DELETE FROM note_shares WHERE note_id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'از دریافتی‌ها حذف شد.' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

// ---------- فایل‌ها
const addFiles = async (req, res) => {
  try {
    const a = await access(req.params.id, req.user.id);
    if (!a || !a.mine) return res.status(404).json({ message: 'یادداشت پیدا نشد.' });
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ message: 'فایلی انتخاب نشده است.' });

    const [[cnt]] = await db.query('SELECT COUNT(*) AS c FROM note_files WHERE note_id = ?', [a.note.id]);
    if (cnt.c + files.length > MAX_FILES_PER_NOTE) return res.status(400).json({ message: `هر یادداشت حداکثر ${MAX_FILES_PER_NOTE} فایل می‌تواند داشته باشد.` });

    for (const f of files) {
      if (BLOCKED_EXT.includes(extOf(fixName(f.originalname)))) return res.status(400).json({ message: 'این نوع فایل مجاز نیست.' });
    }
    const [existing] = await db.query('SELECT display_name FROM note_files WHERE note_id = ?', [a.note.id]);
    const used = new Set(existing.map(e => e.display_name));

    const added = [];
    for (const f of files) {
      // اسم پیش‌فرض فایل = موضوع یادداشت (اگر تکراری بود، با شماره)
      let name = a.note.title, n = 1;
      while (used.has(name)) { n += 1; name = `${a.note.title} (${n})`; }
      used.add(name);
      const original = fixName(f.originalname);
      const [r] = await db.query(
        'INSERT INTO note_files (note_id, display_name, original_name, mime_type, size, file_data) VALUES (?,?,?,?,?,?)',
        [a.note.id, name.slice(0, 200), original.slice(0, 255), f.mimetype || null, f.size, f.buffer]);
      added.push({ id: r.insertId, display_name: name, original_name: original, size: f.size, mime_type: f.mimetype, download_name: downloadName(name, original) });
    }
    await db.query('UPDATE notes SET updated_at = NOW() WHERE id = ?', [a.note.id]);
    res.status(201).json({ files: added });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

const getFileWithAccess = async (fileId, userId, needOwner) => {
  const [f] = await db.query('SELECT * FROM note_files WHERE id = ?', [fileId]);
  if (!f.length) return null;
  const a = await access(f[0].note_id, userId);
  if (!a || (needOwner && !a.mine)) return null;
  return f[0];
};

const renameFile = async (req, res) => {
  try {
    const f = await getFileWithAccess(req.params.fileId, req.user.id, true);
    if (!f) return res.status(404).json({ message: 'فایل پیدا نشد.' });
    const name = (req.body.display_name || '').trim();
    if (!name) return res.status(400).json({ message: 'اسم فایل را بنویسید.' });
    await db.query('UPDATE note_files SET display_name = ? WHERE id = ?', [name.slice(0, 200), f.id]);
    res.json({ message: 'اسم فایل عوض شد.' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

const removeFile = async (req, res) => {
  try {
    const f = await getFileWithAccess(req.params.fileId, req.user.id, true);
    if (!f) return res.status(404).json({ message: 'فایل پیدا نشد.' });
    await db.query('DELETE FROM note_files WHERE id = ?', [f.id]);
    await db.query('UPDATE notes SET updated_at = NOW() WHERE id = ?', [f.note_id]);
    res.json({ message: 'فایل حذف شد.' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

const downloadFile = async (req, res) => {
  try {
    const f = await getFileWithAccess(req.params.fileId, req.user.id, false);
    if (!f) return res.status(404).json({ message: 'فایل پیدا نشد.' });
    const name = downloadName(f.display_name, f.original_name);
    res.setHeader('Content-Type', f.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(f.file_data);
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

module.exports = {
  uploadFiles, listMine, listReceived, unreadCount, getRecipients, getOne, create, update, remove,
  leaveReceived, addFiles, renameFile, removeFile, downloadFile,
};
