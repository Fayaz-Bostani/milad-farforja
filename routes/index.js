const express  = require('express');
const router   = express.Router();
const { authenticate, adminOnly, workerOrAbove, ownerOnly, customerOnly, workerOnly } = require('../middleware/auth');
const myWorkerC = require('../controllers/myWorkerController');
const ledgerC   = require('../controllers/workerLedgerController');
const notifC    = require('../controllers/notificationsController');

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
router.patch ('/users/:id/link-worker',   authenticate, adminOnly, usersC.linkWorker);
router.get   ('/me/worker',               authenticate, workerOnly, myWorkerC.getMyPanel);
router.get   ('/me/worker/ledger',        authenticate, workerOnly, ledgerC.getMyLedger);

// ============================================================
// پنل مشتری (حساب من — سفارش از روی کاتالوگ، فاکتورها، حساب و کتاب)
// ============================================================
router.get ('/me/account',        authenticate, customerOnly, myAccountC.getMyAccount);
router.get ('/me/catalog',        authenticate, customerOnly, myAccountC.getCatalogForOrder);
router.post('/me/orders',         authenticate, customerOnly, myAccountC.createMyOrder);
router.get ('/me/invoices/:id',   authenticate, customerOnly, myAccountC.getMyInvoice);

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
router.get ('/workers',                    authenticate, adminOnly,    workersC.getAll);
router.get ('/workers/:id',                authenticate, adminOnly,    workersC.getOne);
router.post('/workers',                    authenticate, adminOnly,    workersC.create);
router.put ('/workers/:id',                authenticate, adminOnly,    workersC.update);
router.post('/workers/day-entry',          authenticate, adminOnly,    ledgerC.saveDay);
router.get ('/workers/:id/day',            authenticate, adminOnly,    ledgerC.getDay);
router.delete('/workers/:id/day',          authenticate, adminOnly,    ledgerC.deleteDay);
router.get ('/workers/:id/ledger',         authenticate, adminOnly,    ledgerC.getLedger);
router.delete('/workers/:id/payments/:paymentId', authenticate, adminOnly, ledgerC.deletePayment);
router.post('/workers/attendance',         authenticate, adminOnly,    workersC.logAttendance);
router.get ('/workers/:id/attendance',     authenticate, adminOnly,    workersC.getAttendance);
router.post('/workers/advances',           authenticate, adminOnly,    workersC.addAdvance);
router.post('/workers/payments',           authenticate, adminOnly,    workersC.addPayment);
router.get   ('/workers/:id/report',       authenticate, adminOnly,    workersC.getReport);
router.get   ('/workers/:id/usage',        authenticate, adminOnly,    workersC.getUsage);
router.delete('/workers/:id',              authenticate, adminOnly,    workersC.remove);

// ============================================================
// مشتریان
// ============================================================
router.get ('/customers',              authenticate, adminOnly,    customersC.getAll);
router.get ('/customers/:id',          authenticate, adminOnly,    customersC.getOne);
router.post('/customers',              authenticate, adminOnly,    customersC.create);
router.put ('/customers/:id',          authenticate, adminOnly,    customersC.update);
router.post  ('/customers/payments',   authenticate, adminOnly,    customersC.addPayment);
router.get   ('/customers/:id/usage',  authenticate, adminOnly,    customersC.getUsage);
router.delete('/customers/:id',        authenticate, adminOnly,    customersC.remove);

// ============================================================
// محصولات
// ============================================================
// عمومی (برای QR Code - بدون لاگین)
router.get('/products/public', productsC.getPublic);
router.get  ('/notifications',           authenticate, adminOnly, notifC.getAll);
router.patch('/notifications/read-all',  authenticate, adminOnly, notifC.markAllRead);
router.patch('/notifications/:id/read',  authenticate, adminOnly, notifC.markRead);
router.get('/products/categories', productsC.getCategories);
router.get('/products',     authenticate, adminOnly, productsC.getAll);
router.get('/products/:id', authenticate, adminOnly, productsC.getOne);
router.post('/products',    authenticate, adminOnly, productsC.upload.single('image'), productsC.create);
router.put   ('/products/:id',authenticate, adminOnly, productsC.upload.single('image'), productsC.update);
router.delete('/products/:id',authenticate, adminOnly, productsC.remove);

// ============================================================
// سفارشات
// ============================================================
router.get ('/orders',          authenticate, adminOnly,    ordersC.getAll);
router.get ('/orders/:id',      authenticate, adminOnly,    ordersC.getOne);
router.post('/orders',          authenticate, adminOnly,   
  ordersC.upload.fields([{ name: 'sample_image', maxCount: 1 }, { name: 'design_file', maxCount: 1 }]),
  ordersC.create
);
router.patch('/orders/:id/status', authenticate, adminOnly,    ordersC.updateStatus);
router.get   ('/orders/:id/usage', authenticate, adminOnly,    ordersC.getUsage);
router.delete('/orders/:id',       authenticate, adminOnly,    ordersC.remove);

// ============================================================
// فاکتور فروش
// ============================================================
router.get ('/invoices',     authenticate, adminOnly,    invoicesC.getAll);
router.get ('/invoices/:id', authenticate, adminOnly,    invoicesC.getOne);
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
router.get ('/inventory/raw',        authenticate, adminOnly,    inventoryC.getRawMaterials);
router.post('/inventory/raw',        authenticate, adminOnly,    inventoryC.addRawMaterial);
router.put ('/inventory/raw/:id',    authenticate, adminOnly,    inventoryC.updateRawMaterial);
router.post  ('/inventory/raw/log',  authenticate, adminOnly,    inventoryC.logRawMaterial);
router.get   ('/inventory/raw/:id/usage', authenticate, adminOnly, inventoryC.getUsageRawMaterial);
router.delete('/inventory/raw/:id',  authenticate, adminOnly,    inventoryC.removeRawMaterial);
router.get ('/inventory/low-stock',  authenticate, adminOnly,    inventoryC.getLowStock);
router.get ('/inventory/products',   authenticate, workerOrAbove, inventoryC.getProductInventory);
router.put ('/inventory/products',   authenticate, adminOnly,    inventoryC.updateProductInventory);

module.exports = router;
