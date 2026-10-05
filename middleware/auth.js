const jwt = require('jsonwebtoken');

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

// بررسی نقش
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'شما دسترسی به این بخش را ندارید.' });
    }
    next();
  };
};

// فقط ادمین
const adminOnly = authorize('admin');

// ادمین یا کارمند کارخانه
const staffOrAdmin = authorize('admin', 'staff');

// فقط مشتری (پنل خودشون)
const customerOnly = authorize('customer');

module.exports = { authenticate, authorize, adminOnly, staffOrAdmin, customerOnly };
