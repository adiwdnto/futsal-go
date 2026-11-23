require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../src/db');

async function main() {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD ||
      ADMIN_NAME.trim().length > 100 || ADMIN_EMAIL.trim().length > 100 ||
      ADMIN_PASSWORD.length < 12 || Buffer.byteLength(ADMIN_PASSWORD, 'utf8') > 72) {
    throw new Error('Set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD (12-72 bytes; name/email max 100 characters).');
  }

  const email = ADMIN_EMAIL.trim().toLowerCase();
  const [existing] = await db.execute('SELECT user_id, role FROM users WHERE email = ?', [email]);
  let adminId;

  if (existing.length) {
    if (existing[0].role !== 'admin') {
      throw new Error('ADMIN_EMAIL already belongs to a non-admin account; refusing to promote it.');
    }
    adminId = existing[0].user_id;
  } else {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    const [result] = await db.execute(
      'INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, ?)',
      [ADMIN_NAME.trim(), email, passwordHash, 'admin']
    );
    adminId = result.insertId;
  }

  const [assigned] = await db.execute(
    'UPDATE futsal_fields SET created_by = ? WHERE created_by IS NULL',
    [adminId]
  );
  console.log(`Admin ready (user_id ${adminId}); assigned ${assigned.affectedRows} unowned field(s).`);
}

main()
  .catch((error) => {
    console.error('Admin bootstrap failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => db.end());
