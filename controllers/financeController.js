const db = require('../db');

// ---- درآمدها ----

const getIncomes = async (req, res) => {
  try {
    const { from, to, type } = req.query;
    let query = `SELECT ir.*, c.name as customer_name, i.bill_number
                 FROM income_records ir
                 LEFT JOIN customers c ON ir.customer_id = c.id
                 LEFT JOIN invoices i ON ir.invoice_id = i.id
                 WHERE 1=1`;
    const params = [];
    if (from)  { query += ' AND ir.date >= ?'; params.push(from); }
    if (to)    { query += ' AND ir.date <= ?'; params.push(to); }
    if (type)  { query += ' AND ir.type = ?';  params.push(type); }
    query += ' ORDER BY ir.date DESC';
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

const addIncome = async (req, res) => {
  try {
    const { type, invoice_id, customer_id, amount, date, description } = req.body;
    const [result] = await db.query(
      'INSERT INTO income_records (type, invoice_id, customer_id, amount, date, description) VALUES (?,?,?,?,?,?)',
      [type, invoice_id || null, customer_id || null, amount, date, description]
    );
    res.status(201).json({ id: result.insertId, message: 'درآمد ثبت شد.' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

const deleteIncome = async (req, res) => {
  try {
    await db.query('DELETE FROM income_records WHERE id = ?', [req.params.id]);
    res.json({ message: 'درآمد حذف شد.' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

// ---- مصارف کارخانه ----

const getFactoryExpenses = async (req, res) => {
  try {
    const { from, to, type } = req.query;
    let query = 'SELECT * FROM factory_expenses WHERE 1=1';
    const params = [];
    if (from) { query += ' AND date >= ?'; params.push(from); }
    if (to)   { query += ' AND date <= ?'; params.push(to); }
    if (type) { query += ' AND type = ?';  params.push(type); }
    query += ' ORDER BY date DESC';
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

const addFactoryExpense = async (req, res) => {
  try {
    const { type, amount, date, description } = req.body;
    const [result] = await db.query(
      'INSERT INTO factory_expenses (type, amount, date, description) VALUES (?,?,?,?)',
      [type, amount, date, description]
    );
    res.status(201).json({ id: result.insertId, message: 'مصرف کارخانه ثبت شد.' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

const deleteFactoryExpense = async (req, res) => {
  try {
    await db.query('DELETE FROM factory_expenses WHERE id = ?', [req.params.id]);
    res.json({ message: 'مصرف حذف شد.' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

// ---- مصارف خانه ----

const getHomeExpenses = async (req, res) => {
  try {
    const { from, to, type } = req.query;
    let query = 'SELECT * FROM home_expenses WHERE 1=1';
    const params = [];
    if (from) { query += ' AND date >= ?'; params.push(from); }
    if (to)   { query += ' AND date <= ?'; params.push(to); }
    if (type) { query += ' AND type = ?';  params.push(type); }
    query += ' ORDER BY date DESC';
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

const addHomeExpense = async (req, res) => {
  try {
    const { type, amount, date, description } = req.body;
    const [result] = await db.query(
      'INSERT INTO home_expenses (type, amount, date, description) VALUES (?,?,?,?)',
      [type, amount, date, description]
    );
    res.status(201).json({ id: result.insertId, message: 'مصرف خانه ثبت شد.' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

const deleteHomeExpense = async (req, res) => {
  try {
    await db.query('DELETE FROM home_expenses WHERE id = ?', [req.params.id]);
    res.json({ message: 'مصرف حذف شد.' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

// ---- داشبورد مالی کلی ----

const getDashboard = async (req, res) => {
  try {
    const { month, year } = req.query;
    const from = `${year}-${month}-01`;
    const to   = `${year}-${month}-31`;

    const [[income]]   = await db.query('SELECT COALESCE(SUM(amount),0) as total FROM income_records WHERE date BETWEEN ? AND ?', [from, to]);
    const [[factExp]]  = await db.query('SELECT COALESCE(SUM(amount),0) as total FROM factory_expenses WHERE date BETWEEN ? AND ?', [from, to]);
    const [[homeExp]]  = await db.query('SELECT COALESCE(SUM(amount),0) as total FROM home_expenses WHERE date BETWEEN ? AND ?', [from, to]);

    // درآمد به تفکیک نوع
    const [incomeByType] = await db.query(
      'SELECT type, COALESCE(SUM(amount),0) as total FROM income_records WHERE date BETWEEN ? AND ? GROUP BY type',
      [from, to]
    );
    // مصارف کارخانه به تفکیک نوع
    const [factByType] = await db.query(
      'SELECT type, COALESCE(SUM(amount),0) as total FROM factory_expenses WHERE date BETWEEN ? AND ? GROUP BY type',
      [from, to]
    );
    // مصارف خانه به تفکیک نوع
    const [homeByType] = await db.query(
      'SELECT type, COALESCE(SUM(amount),0) as total FROM home_expenses WHERE date BETWEEN ? AND ? GROUP BY type',
      [from, to]
    );

    const totalIncome  = income.total;
    const totalExpense = factExp.total + homeExp.total;

    res.json({
      month, year,
      total_income:           totalIncome,
      total_factory_expenses: factExp.total,
      total_home_expenses:    homeExp.total,
      total_expenses:         totalExpense,
      net_profit:             totalIncome - totalExpense,
      income_by_type:         incomeByType,
      factory_by_type:        factByType,
      home_by_type:           homeByType,
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

module.exports = {
  getIncomes, addIncome, deleteIncome,
  getFactoryExpenses, addFactoryExpense, deleteFactoryExpense,
  getHomeExpenses, addHomeExpense, deleteHomeExpense,
  getDashboard,
};
