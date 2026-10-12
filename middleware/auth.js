const jwt = require('jsonwebtoken');

// نقش‌ها: owner (مالک) > admin (ادمین) > staff (کارگر) > customer (مشتری)

// بررسی توکن
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'توکن یافت نشد. لطفاً وارد شوید.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'توکن نامعتبر یا منقضی شده است.' });
  }
};

// بررسی نقش — مالک همیشه رد می‌شود
const authorize = (...roles) => {
  return (req, res, next) => {
    if (req.user.role === 'owner' || roles.includes(req.user.role)) return next();
    return res.status(403).json({ message: 'شما دسترسی به این بخش را ندارید.' });
  };
};

// فقط مالک
const ownerOnly = (req, res, next) => {
  if (req.user.role === 'owner') return next();
  return res.status(403).json({ message: 'این بخش فقط برای مالک است.' });
};

// مالک یا ادمین (مدیریت کامل کارخانه)
const adminOnly = authorize('admin');

// مالک، ادمین یا کارگر (فقط برای بخش‌های فقط‌خواندنی مثل موجودی محصول آماده)
const workerOrAbove = authorize('admin', 'staff');

// فقط مشتری (پنل خودشون)
const customerOnly = (req, res, next) => {
  if (req.user.role === 'customer') return next();
  return res.status(403).json({ message: 'شما دسترسی به این بخش را ندارید.' });
};

// فقط کارگر (پنل خودش)
const workerOnly = (req, res, next) => {
  if (req.user.role === 'staff') return next();
  return res.status(403).json({ message: 'شما دسترسی به این بخش را ندارید.' });
};

module.exports = { authenticate, authorize, ownerOnly, adminOnly, workerOrAbove, customerOnly, workerOnly };
