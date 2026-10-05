const pool = require('./DB');
const bcrypt = require('bcryptjs');

async function fixUserPassword() {
  try {
    const newPassword = 'milad8311';
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    const userEmail = 'fayazbostani72@gmail.com';

    // ۱. گرفتن لیست ستون‌های جدول
    const [columns] = await pool.query('SHOW COLUMNS FROM users');
    
    let columnName = '';
    for (let i = 0; i < columns.length; i++) {
      let field = columns[i].Field.toLowerCase();
      if (field.includes('pass') || field.includes('pwd')) {
        columnName = columns[i].Field;
        break;
      }
    }

    if (!columnName) {
      console.log('Password column not found! Available columns:');
      for (let i = 0; i < columns.length; i++) {
        console.log('- ' + columns[i].Field);
      }
      return;
    }

    console.log('Found password column: ' + columnName);

    // ۲. آپدیت کردن رمز با نام ستون واقعی
    const [result] = await pool.query(
      'UPDATE users SET ' + columnName + ' = ? WHERE email = ?',
      [hashedPassword, userEmail]
    );

    if (result.affectedRows > 0) {
      console.log('SUCCESS: Password reset to: ' + newPassword);
    } else {
      console.log('Email not found! Registered emails in database:');
      const [users] = await pool.query('SELECT email FROM users');
      for (let i = 0; i < users.length; i++) {
        console.log('- ' + users[i].email);
      }
    }
  } catch (error) {
    console.error('Error occurred:', error.message);
  } finally {
    process.exit();
  }
}

fixUserPassword();