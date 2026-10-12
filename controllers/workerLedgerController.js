const db = require('../db');

// ───────────────────────────────────────────────
// حساب دفتری کارگر: هر روز کار → مبلغ طلب، هر پرداخت → کسر از طلب
// مبلغ‌ها همیشه در سرور حساب می‌شوند (از مقدار فرستاده‌شده از مرورگر استفاده نمی‌شود)
// ───────────────────────────────────────────────

const DAY_PARTS = ['full', 'half', 'hours', 'absent'];
const num = v => (v === '' || v == null || isNaN(Number(v)) ? 0 : Number(v));
const round2 = n => Math.round(n * 100) / 100;

// محاسبه‌ی مزد روزمزد
//  full  = یک روز کامل  | half = نیم‌روز | hours = ساعتی | absent = غایب
// اگر نرخ روزانه تعریف شده باشد، روز کامل = نرخ روزانه؛ وگرنه نرخ ساعتی × ساعت‌های یک روز
// ساعتی: اگر نرخ ساعتی تعریف شده باشد ساعت × نرخ ساعتی؛ وگرنه به نسبت نرخ روزانه
const calcWage = (worker, dayPart, hours) => {
  if (!dayPart || dayPart === 'absent' || worker.work_type === 'contract') return { wage: 0, hours: 0 };
  const dayH   = num(worker.day_hours) || 8;
  const daily  = num(worker.daily_rate);
  const hourly = num(worker.hourly_rate);
  const fullDay = daily > 0 ? daily : hourly * dayH;

  if (dayPart === 'full') return { wage: round2(fullDay), hours: dayH };
  if (dayPart === 'half') return { wage: round2(fullDay / 2), hours: dayH / 2 };
  // hours
  const h = num(hours);
  const wage = hourly > 0 ? h * hourly : (daily > 0 ? daily * h / dayH : 0);
  return { wage: round2(wage), hours: h };
};

const getWorker = async (id) => {
  const [rows] = await db.query(
    'SELECT id, worker_code, full_name, work_type, daily_rate, hourly_rate, day_hours FROM workers WHERE id = ?', [id]
  );
  return rows[0] || null;
};

const ymd = col => `DATE_FORMAT(${col}, '%Y-%m-%d')`;

// ── خواندن اطلاعات یک روز (برای ویرایش) ──
const getDay = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: 'تاریخ لازم است.' });
    const [att] = await db.query(
      `SELECT ${ymd('date')} AS date, status, day_part, hours_worked, wage_amount, note FROM worker_attendance WHERE worker_id = ? AND date = ?`,
      [req.params.id, date]);
    const [jobs] = await db.query(
      `SELECT id, job_type, job_label, quantity, unit, unit_label, unit_price, amount, note FROM worker_contract_jobs WHERE worker_id = ? AND work_date = ? ORDER BY id`,
      [req.params.id, date]);
    res.json({ attendance: att[0] || null, jobs });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

// ── ثبت/ویرایش کار یک روز (حضور + کارهای کانتورات + شرح کار) ──
const saveDay = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { worker_id, date, day_part, hours, note, jobs } = req.body;
    if (!worker_id || !date) return res.status(400).json({ message: 'کارگر و تاریخ لازم است.' });
    if (day_part && !DAY_PARTS.includes(day_part)) return res.status(400).json({ message: 'نوع روز نامعتبر است.' });

    const worker = await getWorker(worker_id);
    if (!worker) return res.status(404).json({ message: 'کارگر یافت نشد.' });

    const cleanJobs = [];
    for (const j of (Array.isArray(jobs) ? jobs : [])) {
      const quantity = num(j.quantity), unit_price = num(j.unit_price);
      if (!j.job_type) continue;
      if (quantity <= 0) return res.status(400).json({ message: 'مقدار هر کار کانتورات باید بیشتر از صفر باشد.' });
      if (unit_price < 0) return res.status(400).json({ message: 'قیمت واحد نامعتبر است.' });
      cleanJobs.push({
        job_type: String(j.job_type).slice(0, 50),
        job_label: j.job_label ? String(j.job_label).slice(0, 100) : null,
        quantity, unit: String(j.unit || 'kg').slice(0, 20),
        unit_label: j.unit_label ? String(j.unit_label).slice(0, 50) : null,
        unit_price, amount: round2(quantity * unit_price),
        note: j.note ? String(j.note).slice(0, 255) : null,
      });
    }

    await conn.beginTransaction();

    // حضور / مزد روزانه
    const [existing] = await conn.query('SELECT id FROM worker_attendance WHERE worker_id = ? AND date = ?', [worker_id, date]);
    if (day_part) {
      const { wage, hours: h } = calcWage(worker, day_part, hours);
      const status = day_part === 'absent' ? 'absent' : 'present';
      if (existing.length) {
        await conn.query(
          'UPDATE worker_attendance SET status=?, day_part=?, hours_worked=?, wage_amount=?, note=? WHERE id=?',
          [status, day_part, h, wage, note || null, existing[0].id]);
      } else {
        await conn.query(
          'INSERT INTO worker_attendance (worker_id, date, status, day_part, hours_worked, wage_amount, note) VALUES (?,?,?,?,?,?,?)',
          [worker_id, date, status, day_part, h, wage, note || null]);
      }
    } else if (existing.length) {
      // فقط کانتورات: شرح کار را روی ردیف همان روز نگه می‌داریم
      await conn.query('UPDATE worker_attendance SET note=? WHERE id=?', [note || null, existing[0].id]);
    } else if (note && cleanJobs.length === 0) {
      await conn.query(
        "INSERT INTO worker_attendance (worker_id, date, status, day_part, hours_worked, wage_amount, note) VALUES (?,?,'present',NULL,0,0,?)",
        [worker_id, date, note]);
    }

    // کارهای کانتورات: جایگزین کل لیست آن روز
    await conn.query('DELETE FROM worker_contract_jobs WHERE worker_id = ? AND work_date = ?', [worker_id, date]);
    for (const j of cleanJobs) {
      await conn.query(
        'INSERT INTO worker_contract_jobs (worker_id, work_date, job_type, job_label, quantity, unit, unit_label, unit_price, amount, note) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [worker_id, date, j.job_type, j.job_label, j.quantity, j.unit, j.unit_label, j.unit_price, j.amount, j.note]);
    }

    await conn.commit();
    res.json({ message: 'کار روز ثبت شد.' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'خطای سرور.' });
  } finally { conn.release(); }
};

// ── حذف کامل یک روز ──
const deleteDay = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: 'تاریخ لازم است.' });
    await db.query('DELETE FROM worker_attendance WHERE worker_id = ? AND date = ?', [req.params.id, date]);
    await db.query('DELETE FROM worker_contract_jobs WHERE worker_id = ? AND work_date = ?', [req.params.id, date]);
    res.json({ message: 'ثبت آن روز حذف شد.' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

// ── حذف یک پرداخت/مساعده ──
const deletePayment = async (req, res) => {
  try {
    await db.query('DELETE FROM worker_advances WHERE id = ? AND worker_id = ?', [req.params.paymentId, req.params.id]);
    res.json({ message: 'حذف شد.' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

// ── ساخت دفتر حساب برای یک بازه ──
const buildLedger = async (workerId, from, to) => {
  const worker = await getWorker(workerId);
  if (!worker) return null;

  const sum = async (sql, params) => Number((await db.query(sql, params))[0][0].s);
  const earnedBefore =
    await sum('SELECT COALESCE(SUM(wage_amount),0) s FROM worker_attendance WHERE worker_id=? AND date < ?', [workerId, from]) +
    await sum('SELECT COALESCE(SUM(amount),0) s FROM worker_contract_jobs WHERE worker_id=? AND work_date < ?', [workerId, from]);
  const givenBefore =
    await sum('SELECT COALESCE(SUM(amount),0) s FROM worker_advances WHERE worker_id=? AND date < ?', [workerId, from]);

  const [att] = await db.query(
    `SELECT ${ymd('date')} AS date, status, day_part, hours_worked, wage_amount, note FROM worker_attendance WHERE worker_id=? AND date BETWEEN ? AND ? ORDER BY date`,
    [workerId, from, to]);
  const [jobs] = await db.query(
    `SELECT ${ymd('work_date')} AS date, job_type, job_label, quantity, unit, unit_label, unit_price, amount FROM worker_contract_jobs WHERE worker_id=? AND work_date BETWEEN ? AND ? ORDER BY work_date, id`,
    [workerId, from, to]);
  const [payments] = await db.query(
    `SELECT id, amount, ${ymd('date')} AS date, note, kind FROM worker_advances WHERE worker_id=? AND date BETWEEN ? AND ? ORDER BY date, id`,
    [workerId, from, to]);

  const byDate = {};
  const day = d => (byDate[d] ||= { date: d, day_part: null, status: null, hours_worked: 0, wage_amount: 0, note: null, jobs: [], contract_amount: 0 });
  att.forEach(a => Object.assign(day(a.date), {
    day_part: a.day_part, status: a.status, hours_worked: Number(a.hours_worked || 0),
    wage_amount: Number(a.wage_amount || 0), note: a.note,
  }));
  jobs.forEach(j => { const d = day(j.date); d.jobs.push(j); d.contract_amount += Number(j.amount); });
  const days = Object.values(byDate)
    .map(d => ({ ...d, total: round2(d.wage_amount + d.contract_amount) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const earned = round2(days.reduce((s, d) => s + d.total, 0));
  const given  = round2(payments.reduce((s, p) => s + Number(p.amount), 0));
  return {
    worker, from, to,
    opening_balance: round2(earnedBefore - givenBefore),
    days, payments,
    totals: { earned, given, closing_balance: round2(earnedBefore - givenBefore + earned - given) },
  };
};

const validRange = (req) => {
  const { from, to } = req.query;
  return from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) ? { from, to } : null;
};

// ── دفتر حساب یک کارگر (مدیر) ──
const getLedger = async (req, res) => {
  try {
    const r = validRange(req);
    if (!r) return res.status(400).json({ message: 'بازه‌ی تاریخ نامعتبر است.' });
    const data = await buildLedger(req.params.id, r.from, r.to);
    if (!data) return res.status(404).json({ message: 'کارگر یافت نشد.' });
    res.json(data);
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

// ── دفتر حساب خودِ کارگر (فقط پرونده‌ی متصل به همین حساب) ──
const getMyLedger = async (req, res) => {
  try {
    const r = validRange(req);
    if (!r) return res.status(400).json({ message: 'بازه‌ی تاریخ نامعتبر است.' });
    const [rows] = await db.query('SELECT id FROM workers WHERE user_id = ?', [req.user.id]);
    if (!rows.length) {
      return res.status(404).json({
        message: 'حساب شما هنوز به پرونده‌ی کارگری وصل نشده. لطفاً به مدیر کارخانه بگویید این کار را انجام دهد.'
      });
    }
    res.json(await buildLedger(rows[0].id, r.from, r.to));
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

module.exports = { getDay, saveDay, deleteDay, deletePayment, getLedger, getMyLedger };
