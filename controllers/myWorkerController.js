const db = require('../db');

// پنل خودِ کارگر: فقط اطلاعات پرونده‌ی متصل به همین حساب
const getMyPanel = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, worker_code, full_name, phone, start_date, status, work_type, hourly_rate, daily_rate FROM workers WHERE user_id = ?',
      [req.user.id]
    );
    if (!rows.length) {
      return res.status(404).json({
        message: 'حساب شما هنوز به پرونده‌ی کارگری وصل نشده. لطفاً به مدیر کارخانه بگویید این کار را انجام دهد.'
      });
    }
    const worker = rows[0];

    const [attendance] = await db.query(
      'SELECT date, status, hours_worked, note FROM worker_attendance WHERE worker_id = ? ORDER BY date DESC LIMIT 60',
      [worker.id]
    );
    const [advances] = await db.query(
      'SELECT amount, date, note FROM worker_advances WHERE worker_id = ? ORDER BY date DESC LIMIT 60',
      [worker.id]
    );
    const [payments] = await db.query(
      'SELECT period_start, period_end, total_hours, total_salary, advance_paid, lunch_cost, debt, net_payable, note FROM worker_payments WHERE worker_id = ? ORDER BY period_start DESC LIMIT 24',
      [worker.id]
    );

    res.json({
      worker,
      attendance,
      advances,
      payments,
      summary: {
        present_days: attendance.filter(a => a.status === 'present').length,
        absent_days:  attendance.filter(a => a.status === 'absent').length,
        total_hours:  attendance.reduce((s, a) => s + Number(a.hours_worked || 0), 0),
        total_advances: advances.reduce((s, a) => s + Number(a.amount || 0), 0),
        total_paid: payments.reduce((s, p) => s + Number(p.net_payable || 0), 0),
      },
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

module.exports = { getMyPanel };
