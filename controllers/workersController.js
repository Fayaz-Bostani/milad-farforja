const db = require('../db');

// لیست کارگران
const getAll = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM workers ORDER BY full_name');
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

// اطلاعات یک کارگر
const getOne = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM workers WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'کارگر یافت نشد.' });
    res.json(rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

// افزودن کارگر
const create = async (req, res) => {
  try {
    const { worker_code, full_name, phone, address, start_date, status, work_type, hourly_rate, daily_rate } = req.body;
    const [result] = await db.query(
      'INSERT INTO workers (worker_code, full_name, phone, address, start_date, status, work_type, hourly_rate, daily_rate) VALUES (?,?,?,?,?,?,?,?,?)',
      [worker_code, full_name, phone, address, start_date, status || 'active', work_type, hourly_rate || 0, daily_rate || 0]
    );
    res.status(201).json({ id: result.insertId, message: 'کارگر اضافه شد.' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

// ویرایش کارگر
const update = async (req, res) => {
  try {
    const { full_name, phone, address, status, work_type, hourly_rate, daily_rate } = req.body;
    await db.query(
      'UPDATE workers SET full_name=?, phone=?, address=?, status=?, work_type=?, hourly_rate=?, daily_rate=? WHERE id=?',
      [full_name, phone, address, status, work_type, hourly_rate, daily_rate, req.params.id]
    );
    res.json({ message: 'کارگر بروزرسانی شد.' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

// ثبت حضور و غیاب
const logAttendance = async (req, res) => {
  try {
    const { worker_id, date, status, hours_worked, note } = req.body;
    await db.query(
      'INSERT INTO worker_attendance (worker_id, date, status, hours_worked, note) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE status=?, hours_worked=?, note=?',
      [worker_id, date, status, hours_worked || 0, note, status, hours_worked || 0, note]
    );
    res.json({ message: 'حضور و غیاب ثبت شد.' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

// گرفتن حضور و غیاب کارگر
const getAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { from, to } = req.query;
    let query = 'SELECT * FROM worker_attendance WHERE worker_id = ?';
    const params = [id];
    if (from) { query += ' AND date >= ?'; params.push(from); }
    if (to)   { query += ' AND date <= ?'; params.push(to); }
    query += ' ORDER BY date DESC';
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

// ثبت مساعده
const addAdvance = async (req, res) => {
  try {
    const { worker_id, amount, date, note } = req.body;
    await db.query(
      'INSERT INTO worker_advances (worker_id, amount, date, note) VALUES (?,?,?,?)',
      [worker_id, amount, date, note]
    );
    res.status(201).json({ message: 'مساعده ثبت شد.' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

// ثبت پرداخت حقوق
const addPayment = async (req, res) => {
  try {
    const { worker_id, period_start, period_end, total_hours, total_salary, advance_paid, lunch_cost, debt, net_payable, note } = req.body;
    await db.query(
      'INSERT INTO worker_payments (worker_id, period_start, period_end, total_hours, total_salary, advance_paid, lunch_cost, debt, net_payable, note) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [worker_id, period_start, period_end, total_hours || 0, total_salary || 0, advance_paid || 0, lunch_cost || 0, debt || 0, net_payable || 0, note]
    );
    res.status(201).json({ message: 'حقوق ثبت شد.' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

// گزارش کارگر
const getReport = async (req, res) => {
  try {
    const { id } = req.params;
    const from = req.query.from || '2000-01-01';
    const to   = req.query.to   || '2100-01-01';

    const [worker] = await db.query('SELECT * FROM workers WHERE id = ?', [id]);
    if (!worker.length) return res.status(404).json({ message: 'کارگر یافت نشد.' });

    const [attendanceSummary] = await db.query(
      'SELECT COUNT(*) as total_days, SUM(CASE WHEN status="present" THEN 1 ELSE 0 END) as present_days, SUM(CASE WHEN status="absent" THEN 1 ELSE 0 END) as absent_days, SUM(hours_worked) as total_hours FROM worker_attendance WHERE worker_id=? AND date BETWEEN ? AND ?',
      [id, from, to]
    );
    const [attendanceList] = await db.query(
      'SELECT * FROM worker_attendance WHERE worker_id=? AND date BETWEEN ? AND ? ORDER BY date DESC',
      [id, from, to]
    );
    const [advancesList] = await db.query(
      'SELECT * FROM worker_advances WHERE worker_id=? AND date BETWEEN ? AND ? ORDER BY date DESC',
      [id, from, to]
    );
    const [paymentsList] = await db.query(
      'SELECT * FROM worker_payments WHERE worker_id=? AND period_start >= ? AND period_end <= ? ORDER BY period_start DESC',
      [id, from, to]
    );
    const total_advances = advancesList.reduce((s, a) => s + Number(a.amount), 0);

    res.json({
      worker: worker[0],
      attendance_summary: attendanceSummary[0],
      attendance_list: attendanceList,
      advances_list: advancesList,
      payments_list: paymentsList,
      total_advances,
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

// حذف کارگر
// بررسی اینکه آیا این کارگر سابقه (حضور/فعالیت/حقوق/مساعده) داره یا نه
const getUsage = async (req, res) => {
  try {
    const id = req.params.id;
    const [[att]] = await db.query('SELECT COUNT(*) c FROM worker_attendance WHERE worker_id=?', [id]);
    const [[act]] = await db.query('SELECT COUNT(*) c FROM worker_activities WHERE worker_id=?', [id]);
    const [[pay]] = await db.query('SELECT COUNT(*) c FROM worker_payments WHERE worker_id=?', [id]);
    const [[adv]] = await db.query('SELECT COUNT(*) c FROM worker_advances WHERE worker_id=?', [id]);
    const counts = { حضور: att.c, فعالیت: act.c, حقوق: pay.c, مساعده: adv.c };
    const total = att.c + act.c + pay.c + adv.c;
    res.json({ hasHistory: total > 0, counts });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

// حذف کارگر — همراه با تمام سوابق مرتبطش (بعد از تأیید کاربر توی فرانت‌اند)
const remove = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const id = req.params.id;
    await conn.beginTransaction();
    await conn.query('DELETE FROM worker_attendance WHERE worker_id=?', [id]);
    await conn.query('DELETE FROM worker_activities WHERE worker_id=?', [id]);
    await conn.query('DELETE FROM worker_payments WHERE worker_id=?', [id]);
    await conn.query('DELETE FROM worker_advances WHERE worker_id=?', [id]);
    const [result] = await conn.query('DELETE FROM workers WHERE id=?', [id]);
    await conn.commit();
    if (!result.affectedRows) return res.status(404).json({ message: 'کارگر یافت نشد.' });
    res.json({ message: 'کارگر حذف شد.' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'خطای سرور.' });
  } finally { conn.release(); }
};

module.exports = { getAll, getOne, create, update, logAttendance, getAttendance, addAdvance, addPayment, getReport, remove, getUsage };
