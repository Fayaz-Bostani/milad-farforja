const express  = require('express');
const router   = express.Router();
const { authenticate, adminOnly, staffOrAdmin, customerOnly } = require('../middleware/auth');

const authC        = require('../controllers/authController');
const usersC       = require('../controllers/usersController');
const workersC     = require('../controllers/workersController');
const customersC   = require('../controllers/customersController');
const productsC    = require('../controllers/productsController');
const ordersC      = require('../controllers/ordersController');
const invoicesC    = require('../controllers/invoicesController');
const financeC     = require('../controllers/financeController');
const inventoryC   = require('../controllers/inventoryController');
const myAccountC   = require('../controllers/myAccountController');
const heroC        = require('../controllers/heroController');
const siteC        = require('../controllers/siteController');

// ============================================================
// احراز هویت
// ============================================================
router.post('/auth/login',    authC.login);
router.post('/auth/register', authC.register);
router.get ('/auth/me',       authenticate, authC.getMe);

// ============================================================
// مدیریت کاربران (فقط ادمین)
// ============================================================
router.get   ('/users',              authenticate, adminOnly, usersC.getAllUsers);
router.patch ('/users/:id/approve',  authenticate, adminOnly, usersC.approveUser);
router.patch ('/users/:id',          authenticate, adminOnly, usersC.updateUser);
router.delete('/users/:id',          authenticate, adminOnly, usersC.deleteUser);
router.patch ('/users/:id/link-customer', authenticate, adminOnly, usersC.linkCustomer);

// ============================================================
// پنل مشتری (حساب من — سفارش از روی کاتالوگ، فاکتورها، حساب و کتاب)
// ============================================================
router.get ('/me/account',        authenticate, customerOnly, myAccountC.getMyAccount);
router.get ('/me/catalog',        authenticate, customerOnly, myAccountC.getCatalogForOrder);
router.post('/me/orders',         authenticate, customerOnly, myAccountC.createMyOrder);

// ============================================================
// گالری صفحه اصلی (مستقل از محصولات) + تنظیمات عمومی سایت (لوگو)
// ============================================================
router.get   ('/hero',        heroC.getAll);
router.post  ('/hero',        authenticate, adminOnly, heroC.upload.single('image'), heroC.add);
router.delete('/hero/:id',    authenticate, adminOnly, heroC.remove);

router.get ('/site/settings', siteC.getPublicSettings);
router.post('/site/logo',     authenticate, adminOnly, siteC.upload.single('logo'), siteC.uploadLogo);

// ============================================================
// کارگران (ادمین + کارمند)
// ============================================================
router.get ('/workers',                    authenticate, staffOrAdmin, workersC.getAll);
router.get ('/workers/:id',                authenticate, staffOrAdmin, workersC.getOne);
router.post('/workers',                    authenticate, adminOnly,    workersC.create);
router.put ('/workers/:id',                authenticate, adminOnly,    workersC.update);
router.post('/workers/attendance',         authenticate, staffOrAdmin, workersC.logAttendance);
router.get ('/workers/:id/attendance',     authenticate, staffOrAdmin, workersC.getAttendance);
router.post('/workers/advances',           authenticate, adminOnly,    workersC.addAdvance);
router.post('/workers/payments',           authenticate, adminOnly,    workersC.addPayment);
router.get   ('/workers/:id/report',       authenticate, adminOnly,    workersC.getReport);
router.get   ('/workers/:id/usage',        authenticate, adminOnly,    workersC.getUsage);
router.delete('/workers/:id',              authenticate, adminOnly,    workersC.remove);

// ============================================================
// مشتریان
// ============================================================
router.get ('/customers',              authenticate, staffOrAdmin, customersC.getAll);
router.get ('/customers/:id',          authenticate, staffOrAdmin, customersC.getOne);
router.post('/customers',              authenticate, staffOrAdmin, customersC.create);
router.put ('/customers/:id',          authenticate, staffOrAdmin, customersC.update);
router.post  ('/customers/payments',   authenticate, adminOnly,    customersC.addPayment);
router.get   ('/customers/:id/usage',  authenticate, adminOnly,    customersC.getUsage);
router.delete('/customers/:id',        authenticate, adminOnly,    customersC.remove);

// ============================================================
// محصولات
// ============================================================
// عمومی (برای QR Code - بدون لاگین)
router.get('/products/public', productsC.getPublic);
router.get('/products/categories', productsC.getCategories);
router.get('/products',     authenticate, productsC.getAll);
router.get('/products/:id', authenticate, productsC.getOne);
router.post('/products',    authenticate, adminOnly, productsC.upload.single('image'), productsC.create);
router.put   ('/products/:id',authenticate, adminOnly, productsC.upload.single('image'), productsC.update);
router.delete('/products/:id',authenticate, adminOnly, productsC.remove);

// ============================================================
// سفارشات
// ============================================================
router.get ('/orders',          authenticate, staffOrAdmin, ordersC.getAll);
router.get ('/orders/:id',      authenticate, staffOrAdmin, ordersC.getOne);
router.post('/orders',          authenticate, staffOrAdmin,
  ordersC.upload.fields([{ name: 'sample_image', maxCount: 1 }, { name: 'design_file', maxCount: 1 }]),
  ordersC.create
);
router.patch('/orders/:id/status', authenticate, staffOrAdmin, ordersC.updateStatus);
router.get   ('/orders/:id/usage', authenticate, staffOrAdmin, ordersC.getUsage);
router.delete('/orders/:id',       authenticate, staffOrAdmin, ordersC.remove);

// ============================================================
// فاکتور فروش
// ============================================================
router.get ('/invoices',     authenticate, staffOrAdmin, invoicesC.getAll);
router.get ('/invoices/:id', authenticate, staffOrAdmin, invoicesC.getOne);
router.post  ('/invoices',     authenticate, adminOnly, invoicesC.create);
router.put   ('/invoices/:id', authenticate, adminOnly, invoicesC.update);
router.delete('/invoices/:id', authenticate, adminOnly, invoicesC.remove);

// ============================================================
// مالی - درآمدها
// ============================================================
router.get   ('/finance/income',          authenticate, adminOnly, financeC.getIncomes);
router.post  ('/finance/income',          authenticate, adminOnly, financeC.addIncome);
router.delete('/finance/income/:id',      authenticate, adminOnly, financeC.deleteIncome);

// مصارف کارخانه
router.get   ('/finance/factory-expenses',      authenticate, adminOnly, financeC.getFactoryExpenses);
router.post  ('/finance/factory-expenses',      authenticate, adminOnly, financeC.addFactoryExpense);
router.delete('/finance/factory-expenses/:id',  authenticate, adminOnly, financeC.deleteFactoryExpense);

// مصارف خانه
router.get   ('/finance/home-expenses',      authenticate, adminOnly, financeC.getHomeExpenses);
router.post  ('/finance/home-expenses',      authenticate, adminOnly, financeC.addHomeExpense);
router.delete('/finance/home-expenses/:id',  authenticate, adminOnly, financeC.deleteHomeExpense);

// داشبورد مالی کلی
router.get('/finance/dashboard', authenticate, adminOnly, financeC.getDashboard);

// ============================================================
// انبار
// ============================================================
router.get ('/inventory/raw',        authenticate, staffOrAdmin, inventoryC.getRawMaterials);
router.post('/inventory/raw',        authenticate, adminOnly,    inventoryC.addRawMaterial);
router.put ('/inventory/raw/:id',    authenticate, adminOnly,    inventoryC.updateRawMaterial);
router.post  ('/inventory/raw/log',  authenticate, adminOnly,    inventoryC.logRawMaterial);
router.get   ('/inventory/raw/:id/usage', authenticate, adminOnly, inventoryC.getUsageRawMaterial);
router.delete('/inventory/raw/:id',  authenticate, adminOnly,    inventoryC.removeRawMaterial);
router.get ('/inventory/low-stock',  authenticate, adminOnly,    inventoryC.getLowStock);
router.get ('/inventory/products',   authenticate, staffOrAdmin, inventoryC.getProductInventory);
router.put ('/inventory/products',   authenticate, adminOnly,    inventoryC.updateProductInventory);

module.exports = router;
