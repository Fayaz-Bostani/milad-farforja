const db  = require('../db');
const QRCode = require('qrcode');

const getAll = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT i.*, c.name as customer_name
       FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id
       ORDER BY i.date DESC`
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

const getOne = async (req, res) => {
  try {
    const [inv] = await db.query(
      `SELECT i.*, c.name as customer_name, c.phone as customer_phone
       FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id
       WHERE i.id = ?`, [req.params.id]
    );
    if (!inv.length) return res.status(404).json({ message: 'فاکتور یافت نشد.' });

    const [items] = await db.query(
      'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY `row_number`', [req.params.id]
    );

    res.json({ invoice: inv[0], items });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

const create = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const {
      bill_number, customer_id, order_id, date,
      factory_name, factory_address, factory_phone,
      notes, items,
      total_quantity, total_weight,          // اگه فرستاده نشن، خودکار از آیتم‌ها حساب می‌شن
      show_total_weight, show_total_quantity, // اختیاری بودن نمایش این دوتا توی چاپ
    } = req.body;

    // محاسبه مجموع‌ها
    const validItems = (items || []).filter(i => i.item_name);
    const autoTotalWeight = validItems.reduce((s, i) => s + (parseFloat(i.weight) || 0), 0);
    const total_amount    = validItems.reduce((s, i) => s + (parseFloat(i.total_price) || 0), 0);

    const finalTotalQuantity = (total_quantity !== undefined && total_quantity !== null && total_quantity !== '')
      ? String(total_quantity) : null;
    const finalTotalWeight = (total_weight !== undefined && total_weight !== null && total_weight !== '')
      ? total_weight : autoTotalWeight;

    // ساخت QR Code (لینک کاتالوگ) + مقادیر پیش‌فرض کارخانه از جدول settings
    const [settings] = await conn.query(
      "SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('catalog_url','factory_phone','factory_name','factory_address')"
    );
    const settingsMap = Object.fromEntries(settings.map(s => [s.setting_key, s.setting_value]));

    // نکته مهم: mysql2 اگه هر پارامتری undefined باشه، کوئری رو throw می‌کنه
    // (نه خود دیتابیس بلکه خود درایور) و همینجا "خطای سرور" رخ می‌داد چون
    // فرانت‌اند این سه فیلد رو اصلاً نمی‌فرستاد. پس همیشه با || null/مقدار پیش‌فرض جایگزین می‌کنیم.
    const finalFactoryName    = factory_name    || settingsMap.factory_name    || 'کارخانه میلاد فرفورژه';
    const finalFactoryAddress = factory_address || settingsMap.factory_address || null;
    const finalFactoryPhone   = factory_phone   || settingsMap.factory_phone   || null;

    const qrData = JSON.stringify({
      factory: finalFactoryName,
      phone:   finalFactoryPhone,
      catalog: settingsMap.catalog_url || '',
    });
    const qrImage = await QRCode.toDataURL(qrData);

    const [result] = await conn.query(
      `INSERT INTO invoices
       (bill_number, customer_id, order_id, date, factory_name, factory_address, factory_phone,
        total_quantity, total_weight, total_amount, notes, qr_data, show_total_weight, show_total_quantity)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [bill_number, customer_id, order_id || null, date,
       finalFactoryName, finalFactoryAddress, finalFactoryPhone,
       finalTotalQuantity, finalTotalWeight, total_amount, notes || null, qrImage,
       show_total_weight === false ? 0 : 1, show_total_quantity === false ? 0 : 1]
    );

    const invoiceId = result.insertId;

    // ثبت 20 سطر (حتی خالی)
    for (let i = 0; i < 20; i++) {
      const item = items?.[i];
      if (item) {
        await conn.query(
          'INSERT INTO invoice_items (invoice_id, `row_number`, item_name, specifications, weight, quantity, unit_price, total_price) VALUES (?,?,?,?,?,?,?,?)',
          [invoiceId, i + 1, item.item_name || null, item.specifications || null,
           item.weight || null, item.quantity || null, item.unit_price || null, item.total_price || null]
        );
      }
    }

    await conn.commit();
    res.status(201).json({ id: invoiceId, message: 'فاکتور ثبت شد.' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'خطای سرور.' });
  } finally {
    conn.release();
  }
};

// ویرایش فاکتور — کل اقلام قبلی پاک و دوباره نوشته می‌شن
const update = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const invoiceId = req.params.id;
    await conn.beginTransaction();

    const {
      bill_number, customer_id, order_id, date, notes, items,
      total_quantity, total_weight, show_total_weight, show_total_quantity,
    } = req.body;

    const validItems = (items || []).filter(i => i.item_name);
    const autoTotalWeight = validItems.reduce((s, i) => s + (parseFloat(i.weight) || 0), 0);
    const total_amount    = validItems.reduce((s, i) => s + (parseFloat(i.total_price) || 0), 0);
    const finalTotalQuantity = (total_quantity !== undefined && total_quantity !== null && total_quantity !== '')
      ? String(total_quantity) : null;
    const finalTotalWeight = (total_weight !== undefined && total_weight !== null && total_weight !== '')
      ? total_weight : autoTotalWeight;

    const [result] = await conn.query(
      `UPDATE invoices SET bill_number=?, customer_id=?, order_id=?, date=?, notes=?,
        total_quantity=?, total_weight=?, total_amount=?, show_total_weight=?, show_total_quantity=?
       WHERE id=?`,
      [bill_number, customer_id, order_id || null, date, notes || null,
       finalTotalQuantity, finalTotalWeight, total_amount,
       show_total_weight === false ? 0 : 1, show_total_quantity === false ? 0 : 1, invoiceId]
    );
    if (!result.affectedRows) { await conn.rollback(); return res.status(404).json({ message: 'فاکتور یافت نشد.' }); }

    await conn.query('DELETE FROM invoice_items WHERE invoice_id = ?', [invoiceId]);
    for (let i = 0; i < 20; i++) {
      const item = items?.[i];
      if (item && item.item_name) {
        await conn.query(
          'INSERT INTO invoice_items (invoice_id, `row_number`, item_name, specifications, weight, quantity, unit_price, total_price) VALUES (?,?,?,?,?,?,?,?)',
          [invoiceId, i + 1, item.item_name || null, item.specifications || null,
           item.weight || null, item.quantity || null, item.unit_price || null, item.total_price || null]
        );
      }
    }

    await conn.commit();
    res.json({ message: 'فاکتور بروزرسانی شد.' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'خطای سرور.' });
  } finally { conn.release(); }
};

// حذف فاکتور
const remove = async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM invoices WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'فاکتور یافت نشد.' });
    res.json({ message: 'فاکتور حذف شد.' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'خطای سرور.' }); }
};

module.exports = { getAll, getOne, create, update, remove };
