require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET;
const SPORT_TYPES = new Set(['futsal', 'mini_soccer', 'soccer']);

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token || !JWT_SECRET) return next(fail(401, 'Silakan masuk terlebih dahulu.'));
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    next(fail(401, 'Sesi tidak valid atau sudah berakhir.'));
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return next(fail(403, 'Akses khusus admin.'));
  next();
}

function signToken(user) {
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw fail(500, 'JWT_SECRET harus diatur dengan nilai acak minimal 32 karakter.');
  }
  return jwt.sign(
    { id: user.user_id, role: user.role, fullName: user.full_name },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

function safeUser(user) {
  return {
    userId: user.user_id,
    fullName: user.full_name,
    email: user.email,
    role: user.role
  };
}

function fieldInput(body) {
  const name = String(body.field_name || '').trim();
  const address = String(body.address || '').trim();
  const sportType = String(body.sport_type || 'futsal');
  const longitude = Number(body.longitude);
  const latitude = Number(body.latitude);
  const price = Number(body.price_per_hour);
  if (!name || !address || !SPORT_TYPES.has(sportType)) {
    throw fail(400, 'Nama, alamat, dan jenis olahraga yang valid wajib diisi.');
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
      !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw fail(400, 'Koordinat longitude/latitude tidak valid.');
  }
  if (!Number.isFinite(price) || price < 0) throw fail(400, 'Harga per jam tidak valid.');
  const photoUrl = body.photo_url ? String(body.photo_url).trim() : null;
  if (photoUrl && !/^https?:\/\//i.test(photoUrl)) {
    throw fail(400, 'URL foto harus diawali http:// atau https://.');
  }
  if (name.length > 150 || address.length > 65535 ||
      (body.phone_number && String(body.phone_number).length > 20) ||
      (photoUrl && photoUrl.length > 1000)) {
    throw fail(400, 'Salah satu informasi lapangan melebihi batas panjang yang diizinkan.');
  }
  if (body.is_published !== undefined &&
      ![true, false, 1, 0, '1', '0'].includes(body.is_published)) {
    throw fail(400, 'Status publikasi tidak valid.');
  }
  return {
    name,
    address,
    description: String(body.description || '').trim() || null,
    photoUrl,
    sportType,
    phone: String(body.phone_number || '').trim() || null,
    price,
    longitude,
    latitude,
    published: body.is_published === false || body.is_published === 0 || body.is_published === '0' ? 0 : 1
  };
}

function getFacilityIds(body) {
  if (body.facility_ids === undefined) return [];
  if (!Array.isArray(body.facility_ids)) throw fail(400, 'Daftar fasilitas tidak valid.');
  const ids = [...new Set(body.facility_ids.map(Number))];
  if (ids.some((id) => !Number.isInteger(id) || id < 1)) throw fail(400, 'Fasilitas tidak valid.');
  return ids;
}

function sqlDateTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw fail(400, 'Waktu harus berformat YYYY-MM-DDTHH:mm.');
  }
  const [year, month, day, hour, minute] = value.match(/\d+/g).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day || date.getUTCHours() !== hour || date.getUTCMinutes() !== minute) {
    throw fail(400, 'Waktu booking tidak valid.');
  }
  return value.replace('T', ' ') + ':00';
}

async function publicFieldQuery(whereSql, params) {
  const [rows] = await db.execute(
    `SELECT f.field_id, f.field_name, f.sport_type, f.address, f.description,
            f.photo_url, f.phone_number, f.price_per_hour, f.opening_time,
            f.closing_time, ST_Longitude(f.location) AS longitude, ST_Latitude(f.location) AS latitude,
            (SELECT GROUP_CONCAT(CONCAT(fa.facility_id, ':', fa.facility_name)
              ORDER BY fa.facility_name SEPARATOR '|')
             FROM field_facilities ff JOIN facilities fa ON fa.facility_id = ff.facility_id
             WHERE ff.field_id = f.field_id) AS facility_data
       FROM futsal_fields f
      ${whereSql}
      ORDER BY f.field_name`,
    params
  );
  return rows.map((row) => ({
    ...row,
    facilities: row.facility_data
      ? row.facility_data.split('|').map((item) => {
          const [id, name] = item.split(':');
          return { facility_id: Number(id), facility_name: name };
        })
      : []
  }));
}

async function ownedField(fieldId, adminId, executor = db, lock = false) {
  const [rows] = await executor.execute(
    `SELECT field_id, price_per_hour, opening_time, closing_time
       FROM futsal_fields WHERE field_id = ? AND created_by = ?${lock ? ' FOR UPDATE' : ''}`,
    [fieldId, adminId]
  );
  if (!rows.length) throw fail(404, 'Lapangan tidak ditemukan atau bukan milik akun Anda.');
  return rows[0];
}

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const fullName = String(req.body.full_name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (fullName.length < 2 || fullName.length > 100 ||
      email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    throw fail(400, 'Nama/email valid dan password 8-72 byte wajib diisi.');
  }
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const [result] = await db.execute(
      'INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, ?)',
      [fullName, email, passwordHash, 'user']
    );
    const user = { user_id: result.insertId, full_name: fullName, email, role: 'user' };
    res.status(201).json({ user: safeUser(user), token: signToken(user) });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw fail(409, 'Email sudah terdaftar.');
    throw error;
  }
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const [rows] = await db.execute(
    'SELECT user_id, full_name, email, password, role FROM users WHERE email = ?',
    [email]
  );
  if (!rows.length || !(await bcrypt.compare(String(req.body.password || ''), rows[0].password))) {
    throw fail(401, 'Email atau password salah.');
  }
  res.json({ user: safeUser(rows[0]), token: signToken(rows[0]) });
}));

app.get('/api/auth/me', requireAuth, asyncRoute(async (req, res) => {
  const [rows] = await db.execute(
    'SELECT user_id, full_name, email, role FROM users WHERE user_id = ?',
    [req.user.id]
  );
  if (!rows.length) throw fail(401, 'Akun tidak ditemukan.');
  res.json({ user: safeUser(rows[0]) });
}));

app.get('/api/facilities', asyncRoute(async (req, res) => {
  const [rows] = await db.execute(
    'SELECT facility_id, facility_name FROM facilities ORDER BY facility_name'
  );
  res.json({ facilities: rows });
}));

app.get('/api/fields', asyncRoute(async (req, res) => {
  const conditions = ['f.is_published = 1'];
  const params = [];
  if (req.query.sport && SPORT_TYPES.has(String(req.query.sport))) {
    conditions.push('f.sport_type = ?');
    params.push(req.query.sport);
  }
  if (req.query.q) {
    conditions.push('(f.field_name LIKE ? OR f.address LIKE ?)');
    params.push(`%${req.query.q}%`, `%${req.query.q}%`);
  }
  if (req.query.facility_id && /^\d+$/.test(String(req.query.facility_id))) {
    conditions.push('EXISTS (SELECT 1 FROM field_facilities x WHERE x.field_id = f.field_id AND x.facility_id = ?)');
    params.push(Number(req.query.facility_id));
  }
  const fields = await publicFieldQuery(`WHERE ${conditions.join(' AND ')}`, params);
  res.json({ fields });
}));

app.get('/api/fields/:fieldId', asyncRoute(async (req, res) => {
  const fields = await publicFieldQuery(
    'WHERE f.is_published = 1 AND f.field_id = ?',
    [req.params.fieldId]
  );
  if (!fields.length) throw fail(404, 'Lapangan tidak ditemukan.');
  res.json({ field: fields[0] });
}));

app.get('/api/fields/:fieldId/schedules', asyncRoute(async (req, res) => {
  const [fields] = await db.execute(
    'SELECT field_id FROM futsal_fields WHERE field_id = ? AND is_published = 1',
    [req.params.fieldId]
  );
  if (!fields.length) throw fail(404, 'Lapangan tidak ditemukan.');
  const [schedules] = await db.execute(
    'SELECT day_of_week, opening_time, closing_time, slot_minutes FROM field_schedules WHERE field_id = ? ORDER BY day_of_week',
    [req.params.fieldId]
  );
  res.json({ schedules });
}));

app.get('/api/fields/:fieldId/availability', asyncRoute(async (req, res) => {
  const date = String(req.query.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw fail(400, 'Tanggal harus berformat YYYY-MM-DD.');
  sqlDateTime(`${date}T12:00`);
  const [fields] = await db.execute(
    'SELECT field_id FROM futsal_fields WHERE field_id = ? AND is_published = 1',
    [req.params.fieldId]
  );
  if (!fields.length) throw fail(404, 'Lapangan tidak ditemukan.');
  const day = new Date(`${date}T12:00:00+07:00`).getDay();
  const [scheduleRows] = await db.execute(
    'SELECT opening_time, closing_time, slot_minutes FROM field_schedules WHERE field_id = ? AND day_of_week = ?',
    [req.params.fieldId, day]
  );
  if (!scheduleRows.length) return res.json({ slots: [] });
  const schedule = scheduleRows[0];
  const [busy] = await db.execute(
    `SELECT starts_at, ends_at FROM bookings
      WHERE field_id = ? AND status = 'confirmed' AND DATE(starts_at) = ?`,
    [req.params.fieldId, date]
  );
  const [blackouts] = await db.execute(
    `SELECT starts_at, ends_at FROM field_blackouts
      WHERE field_id = ? AND DATE(starts_at) <= ? AND DATE(ends_at) >= ?`,
    [req.params.fieldId, date, date]
  );
  const startMinute = timeToMinutes(schedule.opening_time);
  const closeMinute = timeToMinutes(schedule.closing_time);
  const slots = [];
  for (let minute = startMinute; minute + schedule.slot_minutes <= closeMinute; minute += schedule.slot_minutes) {
    const start = `${date} ${minutesToTime(minute)}:00`;
    const end = `${date} ${minutesToTime(minute + schedule.slot_minutes)}:00`;
    const expired = new Date(`${start.replace(' ', 'T')}+07:00`) <= new Date();
    const collision = [...busy, ...blackouts].some(
      (row) => row.starts_at < end && row.ends_at > start
    );
    if (!collision && !expired) slots.push({ start: minutesToTime(minute), end: minutesToTime(minute + schedule.slot_minutes) });
  }
  res.json({ slots, slotMinutes: schedule.slot_minutes });
}));

function timeToMinutes(value) {
  const parts = String(value).split(':').map(Number);
  return parts[0] * 60 + parts[1];
}

function minutesToTime(value) {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

app.get('/api/account/bookings', requireAuth, asyncRoute(async (req, res) => {
  const [rows] = await db.execute(
    `SELECT b.booking_id, b.starts_at, b.ends_at, b.price_total, b.status,
            f.field_id, f.field_name, f.address, f.sport_type
       FROM bookings b JOIN futsal_fields f ON f.field_id = b.field_id
      WHERE b.user_id = ? ORDER BY b.starts_at DESC`,
    [req.user.id]
  );
  res.json({ bookings: rows });
}));

app.post('/api/bookings', requireAuth, asyncRoute(async (req, res) => {
  if (req.user.role !== 'user') throw fail(403, 'Booking hanya dapat dilakukan oleh akun pengguna.');
  const fieldId = Number(req.body.field_id);
  if (!Number.isInteger(fieldId) || fieldId < 1) throw fail(400, 'ID lapangan tidak valid.');
  const startsAt = sqlDateTime(req.body.starts_at);
  const endsAt = sqlDateTime(req.body.ends_at);
  if (startsAt >= endsAt) throw fail(400, 'Waktu selesai harus setelah waktu mulai.');
  if (new Date(`${startsAt.replace(' ', 'T')}+07:00`) <= new Date()) {
    throw fail(400, 'Waktu mulai booking harus berada di masa depan.');
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [fields] = await connection.execute(
      `SELECT field_id, price_per_hour FROM futsal_fields
        WHERE field_id = ? AND is_published = 1 FOR UPDATE`,
      [fieldId]
    );
    if (!fields.length) throw fail(404, 'Lapangan tidak ditemukan.');

    const startDate = startsAt.slice(0, 10);
    const endDate = endsAt.slice(0, 10);
    if (startDate !== endDate) throw fail(400, 'Booking harus berada pada satu tanggal.');
    const [scheduleRows] = await connection.execute(
      'SELECT opening_time, closing_time, slot_minutes FROM field_schedules WHERE field_id = ? AND day_of_week = ?',
      [fieldId, new Date(`${startDate}T12:00:00+07:00`).getDay()]
    );
    if (!scheduleRows.length) throw fail(409, 'Lapangan tidak tersedia pada hari tersebut.');
    const schedule = scheduleRows[0];
    const startMinute = timeToMinutes(startsAt.slice(11, 16));
    const endMinute = timeToMinutes(endsAt.slice(11, 16));
    const opening = timeToMinutes(schedule.opening_time);
    const closing = timeToMinutes(schedule.closing_time);
    if (startMinute < opening || endMinute > closing ||
        (startMinute - opening) % schedule.slot_minutes !== 0 ||
        (endMinute - startMinute) % schedule.slot_minutes !== 0) {
      throw fail(400, `Waktu booking harus mengikuti slot ${schedule.slot_minutes} menit yang tersedia.`);
    }
    const [conflicts] = await connection.execute(
      `SELECT booking_id FROM bookings
        WHERE field_id = ? AND status = 'confirmed'
          AND starts_at < ? AND ends_at > ? LIMIT 1`,
      [fieldId, endsAt, startsAt]
    );
    const [closures] = await connection.execute(
      'SELECT blackout_id FROM field_blackouts WHERE field_id = ? AND starts_at < ? AND ends_at > ? LIMIT 1',
      [fieldId, endsAt, startsAt]
    );
    if (conflicts.length || closures.length) throw fail(409, 'Slot baru saja dipesan atau tidak tersedia.');

    const durationHours = (endMinute - startMinute) / 60;
    const total = Number(fields[0].price_per_hour) * durationHours;
    const [result] = await connection.execute(
      `INSERT INTO bookings (field_id, user_id, starts_at, ends_at, price_total, status)
       VALUES (?, ?, ?, ?, ?, 'confirmed')`,
      [fieldId, req.user.id, startsAt, endsAt, total]
    );
    await connection.commit();
    res.status(201).json({
      booking: { booking_id: result.insertId, field_id: fieldId, starts_at: startsAt, ends_at: endsAt, price_total: total, status: 'confirmed' }
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

app.get('/api/admin/profile', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const [rows] = await db.execute(
    'SELECT user_id, full_name, email FROM users WHERE user_id = ? AND role = ?',
    [req.user.id, 'admin']
  );
  if (!rows.length) throw fail(404, 'Akun admin tidak ditemukan.');
  res.json({ profile: safeUser({ ...rows[0], role: 'admin' }) });
}));

app.put('/api/admin/profile', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const name = String(req.body.full_name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const currentPassword = String(req.body.current_password || '');
  const newPassword = String(req.body.new_password || '');
  if (name.length < 2 || name.length > 100 || email.length > 100 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !currentPassword) {
    throw fail(400, 'Nama, email valid, dan password saat ini wajib diisi.');
  }
  const [rows] = await db.execute(
    'SELECT password FROM users WHERE user_id = ? AND role = ?',
    [req.user.id, 'admin']
  );
  if (!rows.length || !(await bcrypt.compare(currentPassword, rows[0].password))) {
    throw fail(401, 'Password saat ini tidak sesuai.');
  }
  if (newPassword && (newPassword.length < 8 || Buffer.byteLength(newPassword, 'utf8') > 72)) {
    throw fail(400, 'Password baru harus 8-72 byte.');
  }
  const hash = newPassword ? await bcrypt.hash(newPassword, 12) : rows[0].password;
  try {
    await db.execute(
      'UPDATE users SET full_name = ?, email = ?, password = ? WHERE user_id = ? AND role = ?',
      [name, email, hash, req.user.id, 'admin']
    );
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw fail(409, 'Email sudah digunakan akun lain.');
    throw error;
  }
  const user = { user_id: req.user.id, full_name: name, email, role: 'admin' };
  res.json({ profile: safeUser(user), token: signToken(user) });
}));

app.get('/api/admin/fields', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const fields = await publicFieldQuery('WHERE f.created_by = ?', [req.user.id]);
  res.json({ fields });
}));

app.post('/api/admin/fields', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const input = fieldInput(req.body);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `INSERT INTO futsal_fields
        (created_by, field_name, sport_type, address, description, photo_url,
         phone_number, price_per_hour, opening_time, closing_time, location, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL,
               ST_GeomFromText(?, 4326, 'axis-order=long-lat'), ?)`,
      [req.user.id, input.name, input.sportType, input.address, input.description,
        input.photoUrl, input.phone, input.price,
        `POINT(${input.longitude} ${input.latitude})`, input.published]
    );
    const facilityIds = getFacilityIds(req.body);
    for (const facilityId of facilityIds) {
      await connection.execute(
        'INSERT INTO field_facilities (field_id, facility_id) VALUES (?, ?)',
        [result.insertId, facilityId]
      );
    }
    await connection.commit();
    res.status(201).json({ field_id: result.insertId });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_NO_REFERENCED_ROW_2') throw fail(400, 'Fasilitas tidak ditemukan.');
    throw error;
  } finally {
    connection.release();
  }
}));

app.put('/api/admin/fields/:fieldId', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const input = fieldInput(req.body);
  const fieldId = Number(req.params.fieldId);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await ownedField(fieldId, req.user.id, connection, true);
    await connection.execute(
      `UPDATE futsal_fields SET field_name = ?, sport_type = ?, address = ?,
        description = ?, photo_url = ?, phone_number = ?, price_per_hour = ?,
        location = ST_GeomFromText(?, 4326, 'axis-order=long-lat'),
        is_published = ? WHERE field_id = ? AND created_by = ?`,
      [input.name, input.sportType, input.address, input.description, input.photoUrl,
        input.phone, input.price, `POINT(${input.longitude} ${input.latitude})`,
        input.published, fieldId, req.user.id]
    );
    const facilityIds = getFacilityIds(req.body);
    await connection.execute('DELETE FROM field_facilities WHERE field_id = ?', [fieldId]);
    for (const facilityId of facilityIds) {
      await connection.execute(
        'INSERT INTO field_facilities (field_id, facility_id) VALUES (?, ?)',
        [fieldId, facilityId]
      );
    }
    await connection.commit();
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_NO_REFERENCED_ROW_2') throw fail(400, 'Fasilitas tidak ditemukan.');
    throw error;
  } finally {
    connection.release();
  }
}));

app.delete('/api/admin/fields/:fieldId', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  await ownedField(req.params.fieldId, req.user.id);
  const [bookings] = await db.execute(
    'SELECT COUNT(*) AS total FROM bookings WHERE field_id = ?',
    [req.params.fieldId]
  );
  if (bookings[0].total > 0) {
    throw fail(409, 'Lapangan memiliki riwayat booking. Sembunyikan dari publik agar riwayat tetap tersimpan.');
  }
  await db.execute('DELETE FROM futsal_fields WHERE field_id = ? AND created_by = ?', [req.params.fieldId, req.user.id]);
  res.json({ success: true });
}));

app.get('/api/admin/fields/:fieldId/schedules', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  await ownedField(req.params.fieldId, req.user.id);
  const [schedules] = await db.execute(
    'SELECT day_of_week, opening_time, closing_time, slot_minutes FROM field_schedules WHERE field_id = ? ORDER BY day_of_week',
    [req.params.fieldId]
  );
  const [blackouts] = await db.execute(
    'SELECT blackout_id, starts_at, ends_at, reason FROM field_blackouts WHERE field_id = ? ORDER BY starts_at DESC',
    [req.params.fieldId]
  );
  res.json({ schedules, blackouts });
}));

app.put('/api/admin/fields/:fieldId/schedules', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const fieldId = Number(req.params.fieldId);
  const schedules = req.body.schedules;
  if (!Array.isArray(schedules) || schedules.length > 7) throw fail(400, 'Jadwal harus berupa daftar maksimal 7 hari.');
  const days = new Set();
  for (const schedule of schedules) {
    const day = Number(schedule.day_of_week);
    const slot = Number(schedule.slot_minutes || 60);
    if (!Number.isInteger(day) || day < 0 || day > 6 || days.has(day) ||
        !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(schedule.opening_time || '') ||
        !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(schedule.closing_time || '') ||
        schedule.opening_time >= schedule.closing_time ||
        !Number.isInteger(slot) || slot < 15 || slot > 240) {
      throw fail(400, 'Jadwal tidak valid atau hari terduplikasi.');
    }
    days.add(day);
  }
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await ownedField(fieldId, req.user.id, connection, true);
    const [existingBookings] = await connection.execute(
      `SELECT starts_at, ends_at FROM bookings
        WHERE field_id = ? AND status = 'confirmed' AND starts_at >= NOW()`,
      [fieldId]
    );
    for (const booking of existingBookings) {
      const bookingDay = new Date(`${booking.starts_at.slice(0, 10)}T12:00:00+07:00`).getDay();
      const nextSchedule = schedules.find((item) => Number(item.day_of_week) === bookingDay);
      if (!nextSchedule) throw fail(409, 'Jadwal tidak dapat diubah karena ada booking aktif pada hari yang akan ditutup.');
      const startMinute = timeToMinutes(booking.starts_at.slice(11, 16));
      const endMinute = timeToMinutes(booking.ends_at.slice(11, 16));
      const opening = timeToMinutes(nextSchedule.opening_time);
      const closing = timeToMinutes(nextSchedule.closing_time);
      const slot = Number(nextSchedule.slot_minutes || 60);
      if (startMinute < opening || endMinute > closing ||
          (startMinute - opening) % slot !== 0 ||
          (endMinute - startMinute) % slot !== 0) {
        throw fail(409, 'Jadwal tidak dapat diubah karena ada booking aktif di luar slot baru.');
      }
    }
    await connection.execute('DELETE FROM field_schedules WHERE field_id = ?', [fieldId]);
    for (const schedule of schedules) {
      await connection.execute(
        'INSERT INTO field_schedules (field_id, day_of_week, opening_time, closing_time, slot_minutes) VALUES (?, ?, ?, ?, ?)',
        [fieldId, schedule.day_of_week, schedule.opening_time, schedule.closing_time, Number(schedule.slot_minutes || 60)]
      );
    }
    await connection.commit();
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

app.post('/api/admin/fields/:fieldId/blackouts', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const fieldId = Number(req.params.fieldId);
  const startsAt = sqlDateTime(req.body.starts_at);
  const endsAt = sqlDateTime(req.body.ends_at);
  if (startsAt >= endsAt) throw fail(400, 'Waktu selesai harus setelah waktu mulai.');
  await ownedField(fieldId, req.user.id);
  const [conflicts] = await db.execute(
    `SELECT booking_id FROM bookings
      WHERE field_id = ? AND status = 'confirmed' AND starts_at < ? AND ends_at > ? LIMIT 1`,
    [fieldId, endsAt, startsAt]
  );
  if (conflicts.length) throw fail(409, 'Penutupan sementara bertabrakan dengan booking yang sudah dikonfirmasi.');
  const [result] = await db.execute(
    'INSERT INTO field_blackouts (field_id, starts_at, ends_at, reason) VALUES (?, ?, ?, ?)',
    [fieldId, startsAt, endsAt, String(req.body.reason || '').trim() || null]
  );
  res.status(201).json({ blackout_id: result.insertId });
}));

app.delete('/api/admin/fields/:fieldId/blackouts/:blackoutId', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  await ownedField(req.params.fieldId, req.user.id);
  const [result] = await db.execute(
    'DELETE FROM field_blackouts WHERE blackout_id = ? AND field_id = ?',
    [req.params.blackoutId, req.params.fieldId]
  );
  if (!result.affectedRows) throw fail(404, 'Jadwal penutupan tidak ditemukan.');
  res.json({ success: true });
}));

app.get('/api/admin/bookings', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const [bookings] = await db.execute(
    `SELECT b.booking_id, b.starts_at, b.ends_at, b.price_total, b.status,
            u.full_name AS customer_name, u.email AS customer_email,
            f.field_id, f.field_name
       FROM bookings b JOIN futsal_fields f ON f.field_id = b.field_id
       JOIN users u ON u.user_id = b.user_id
      WHERE f.created_by = ? ORDER BY b.starts_at DESC`,
    [req.user.id]
  );
  res.json({ bookings });
}));

app.patch('/api/admin/bookings/:bookingId/cancel', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const [result] = await db.execute(
    `UPDATE bookings b JOIN futsal_fields f ON f.field_id = b.field_id
        SET b.status = 'cancelled', b.cancelled_at = NOW()
      WHERE b.booking_id = ? AND f.created_by = ? AND b.status = 'confirmed'`,
    [req.params.bookingId, req.user.id]
  );
  if (!result.affectedRows) throw fail(404, 'Booking aktif tidak ditemukan atau bukan milik lapangan Anda.');
  res.json({ success: true });
}));

app.use((req, res, next) => next(fail(404, 'Endpoint tidak ditemukan.')));
app.use((error, req, res, next) => {
  const status = Number(error.status || 500);
  if (status >= 500) console.error(error);
  res.status(status).json({ error: status >= 500 ? 'Terjadi kesalahan pada server.' : error.message });
});

if (require.main === module) {
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    console.error('Set JWT_SECRET minimal 32 karakter di backend/.env sebelum menjalankan API.');
    process.exit(1);
  }
  app.listen(PORT, () => console.log(`Futsal Go API listening on http://localhost:${PORT}`));
}

module.exports = app;
