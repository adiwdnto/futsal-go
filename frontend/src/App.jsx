import { useEffect, useMemo, useState } from 'react';
import { api, formatRupiah, sportLabel } from './api.js';
import MapView from './MapView.jsx';

const sports = [
  { value: '', label: 'Semua olahraga' },
  { value: 'futsal', label: 'Futsal' },
  { value: 'mini_soccer', label: 'Mini-soccer' },
  { value: 'soccer', label: 'Sepakbola' }
];
const weekdays = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const localDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

function FieldPhoto({ field, className = '' }) {
  return (
    <div className={`field-image relative overflow-hidden ${className}`}>
      {field.photo_url ? (
        <img src={field.photo_url} alt={field.field_name} onError={(event) => { event.currentTarget.style.display = 'none'; }} />
      ) : null}
      <div className="field-image-fallback" aria-hidden="true">⚽</div>
      <span className="absolute left-3 top-3 rounded-full bg-lime px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-navy">
        {sportLabel[field.sport_type] || 'Lapangan'}
      </span>
    </div>
  );
}

function AuthDialog({ onClose, onSuccess }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ full_name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await api(`/auth/${mode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        body: JSON.stringify(form)
      });
      onSuccess(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-navy/70 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.2em] text-blue-700">{mode === 'login' ? 'Selamat datang' : 'Mulai bermain'}</p>
            <h2 className="display-font mt-1 text-4xl font-black uppercase text-navy">{mode === 'login' ? 'Masuk akun' : 'Buat akun'}</h2>
          </div>
          <button type="button" className="rounded-full bg-mist px-3 py-1 text-xl" onClick={onClose} aria-label="Tutup">×</button>
        </div>
        {mode === 'register' && (
          <label className="mb-4 block text-sm font-bold">Nama lengkap
            <input className="input-control mt-1" required minLength="2" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </label>
        )}
        <label className="mb-4 block text-sm font-bold">Email
          <input className="input-control mt-1" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="mb-4 block text-sm font-bold">Password
          <input className="input-control mt-1" type="password" required minLength={mode === 'register' ? 8 : undefined} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        {error && <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
        <button disabled={busy} className="w-full rounded-xl bg-navy px-4 py-3 font-extrabold text-white disabled:opacity-50">
          {busy ? 'Memproses...' : mode === 'login' ? 'Masuk' : 'Daftar sebagai pengguna'}
        </button>
        <p className="mt-5 text-center text-sm text-slate-600">
          {mode === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'}{' '}
          <button type="button" className="font-extrabold text-blue-800 underline" onClick={() => { setError(''); setMode(mode === 'login' ? 'register' : 'login'); }}>
            {mode === 'login' ? 'Daftar' : 'Masuk'}
          </button>
        </p>
        <p className="mt-3 text-center text-xs text-slate-400">Akun admin dibuat oleh pengelola sistem.</p>
      </form>
    </div>
  );
}

function FieldCard({ field, onSelect, onBook }) {
  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <button className="block h-40 w-full text-left" onClick={() => onSelect(field)} aria-label={`Lihat ${field.field_name}`}>
        <FieldPhoto field={field} className="h-full w-full" />
      </button>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <button className="text-left" onClick={() => onSelect(field)}>
            <h3 className="display-font text-2xl font-bold uppercase leading-tight text-navy">{field.field_name}</h3>
          </button>
          <span className="shrink-0 rounded-lg bg-lime/50 px-2 py-1 text-xs font-black text-navy">PANGKALPINANG</span>
        </div>
        <p className="mt-2 line-clamp-2 min-h-10 text-sm text-slate-600">{field.address}</p>
        <div className="mt-4 flex items-end justify-between gap-3">
          <p className="font-extrabold text-navy">{formatRupiah(field.price_per_hour)}<span className="text-xs font-medium text-slate-500"> / jam</span></p>
          <button onClick={() => onBook(field)} className="rounded-xl bg-navy px-4 py-2 text-sm font-extrabold text-white hover:bg-field">Pilih slot</button>
        </div>
      </div>
    </article>
  );
}

function BookingDialog({ field, token, onClose, onLogin, onBooked }) {
  const [date, setDate] = useState(localDate());
  const [slots, setSlots] = useState([]);
  const [slotMinutes, setSlotMinutes] = useState(60);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSelected(null);
    setError('');
    api(`/fields/${field.field_id}/availability?date=${date}`)
      .then((data) => { setSlots(data.slots); setSlotMinutes(data.slotMinutes || 60); })
      .catch((requestError) => { setSlots([]); setError(requestError.message); });
  }, [date, field.field_id]);

  async function book() {
    if (!token) { onLogin(); return; }
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const start = `${date}T${selected.start}`;
      const end = `${date}T${selected.end}`;
      const data = await api('/bookings', {
        token,
        method: 'POST',
        body: JSON.stringify({ field_id: field.field_id, starts_at: start, ends_at: end })
      });
      onBooked(data.booking);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  const endTime = (time) => {
    const [hour, minute] = time.split(':').map(Number);
    const total = hour * 60 + minute + slotMinutes;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center overflow-y-auto bg-navy/70 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.18em] text-blue-700">Booking instan · tanpa pembayaran online</p>
            <h2 className="display-font mt-1 text-3xl font-black uppercase text-navy">{field.field_name}</h2>
            <p className="mt-1 text-sm text-slate-600">{formatRupiah(field.price_per_hour)} / jam</p>
          </div>
          <button className="rounded-full bg-mist px-3 py-1 text-xl" onClick={onClose} aria-label="Tutup">×</button>
        </div>
        <label className="mt-5 block text-sm font-bold">Tanggal
          <input className="input-control mt-1" type="date" min={localDate()} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <p className="mb-3 mt-5 text-sm font-extrabold">Pilih waktu tersedia ({slotMinutes} menit per slot)</p>
        {slots.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {slots.map((slot) => (
              <button key={slot.start} onClick={() => setSelected(slot)} className={`rounded-xl border px-3 py-3 text-sm font-bold ${selected?.start === slot.start ? 'border-navy bg-navy text-white' : 'border-slate-200 bg-white text-navy hover:border-blue-500'}`}>
                {slot.start} – {slot.end}
              </button>
            ))}
          </div>
        ) : <p className="rounded-xl bg-mist p-4 text-sm text-slate-600">{error || 'Tidak ada slot tersedia pada tanggal ini.'}</p>}
        {error && slots.length > 0 && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
        <div className="mt-6 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">Konfirmasi langsung. Pembayaran dilakukan di lokasi.</p>
          <button disabled={!selected || busy} onClick={book} className="rounded-xl bg-lime px-5 py-3 font-extrabold text-navy disabled:opacity-50">
            {busy ? 'Memesan...' : token ? 'Booking sekarang' : 'Masuk untuk booking'}
          </button>
        </div>
      </section>
    </div>
  );
}

function UserBookings({ token, onBack }) {
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    api('/account/bookings', { token }).then((data) => setBookings(data.bookings)).catch((e) => setError(e.message));
  }, [token]);
  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <button onClick={onBack} className="mb-5 text-sm font-bold text-blue-800">← Kembali ke lapangan</button>
      <p className="text-xs font-extrabold uppercase tracking-[.2em] text-blue-700">Akun saya</p>
      <h1 className="display-font mb-6 text-5xl font-black uppercase text-navy">Booking saya</h1>
      {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
      {!bookings.length && !error && <p className="rounded-2xl bg-white p-6 text-slate-600">Belum ada booking.</p>}
      <div className="grid gap-3">
        {bookings.map((booking) => (
          <article key={booking.booking_id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-sm">
            <div>
              <h2 className="display-font text-2xl font-bold uppercase text-navy">{booking.field_name}</h2>
              <p className="text-sm text-slate-600">{booking.starts_at} — {booking.ends_at}</p>
              <p className="mt-1 text-sm text-slate-500">{booking.address}</p>
            </div>
            <div className="text-right">
              <p className="font-extrabold">{formatRupiah(booking.price_total)}</p>
              <span className={`text-xs font-extrabold uppercase ${booking.status === 'confirmed' ? 'text-emerald-700' : 'text-slate-400'}`}>{booking.status === 'confirmed' ? 'Terkonfirmasi' : 'Dibatalkan'}</span>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}

function AdminDashboard({ token, user, onExit, onUserUpdate }) {
  const [section, setSection] = useState('fields');
  const [fields, setFields] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [scheduleField, setScheduleField] = useState(null);
  const [profile, setProfile] = useState({ full_name: user.fullName, email: user.email, current_password: '', new_password: '' });

  async function reload() {
    const [fieldData, facilityData, bookingData] = await Promise.all([
      api('/admin/fields', { token }),
      api('/facilities'),
      api('/admin/bookings', { token })
    ]);
    setFields(fieldData.fields);
    setFacilities(facilityData.facilities);
    setBookings(bookingData.bookings);
  }

  useEffect(() => {
    reload().catch((e) => setError(e.message));
  }, [token]);

  async function saveField(formData) {
    setError('');
    setNotice('');
    try {
      const path = editing ? `/admin/fields/${editing.field_id}` : '/admin/fields';
      await api(path, { token, method: editing ? 'PUT' : 'POST', body: JSON.stringify(formData) });
      setEditing(null);
      setNotice(editing ? 'Lapangan diperbarui.' : 'Lapangan berhasil ditambahkan.');
      await reload();
    } catch (e) { setError(e.message); }
  }

  async function removeField(field) {
    if (!window.confirm(`Hapus ${field.field_name}? Lapangan yang sudah memiliki riwayat booking harus disembunyikan, bukan dihapus.`)) return;
    try {
      await api(`/admin/fields/${field.field_id}`, { token, method: 'DELETE' });
      setNotice('Lapangan dihapus.');
      await reload();
    } catch (e) { setError(e.message); }
  }

  async function cancelBooking(booking) {
    if (!window.confirm(`Batalkan booking #${booking.booking_id}?`)) return;
    try {
      await api(`/admin/bookings/${booking.booking_id}/cancel`, { token, method: 'PATCH' });
      await reload();
      setNotice('Booking dibatalkan.');
    } catch (e) { setError(e.message); }
  }

  async function saveProfile(event) {
    event.preventDefault();
    setError('');
    try {
      const data = await api('/admin/profile', {
        token,
        method: 'PUT',
        body: JSON.stringify(profile)
      });
      onUserUpdate(data.profile, data.token);
      setProfile({ ...profile, current_password: '', new_password: '' });
      setNotice('Pengaturan akun tersimpan.');
    } catch (e) { setError(e.message); }
  }

  const nav = [
    ['fields', 'Tempat saya'],
    ['bookings', 'Booking masuk'],
    ['settings', 'Pengaturan akun']
  ];

  return (
    <div className="min-h-screen bg-mist">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-navy px-5 py-4 text-white">
        <div>
          <p className="display-font text-2xl font-black uppercase">Futsal Go <span className="text-lime">/ Admin</span></p>
          <p className="text-xs text-blue-100">Masuk sebagai {user.fullName}</p>
        </div>
        <button onClick={onExit} className="rounded-xl border border-white/30 px-4 py-2 text-sm font-bold">Tampilan publik</button>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-7 lg:grid-cols-[230px_1fr]">
        <nav className="flex gap-2 overflow-x-auto lg:block lg:space-y-2">
          {nav.map(([key, label]) => (
            <button key={key} onClick={() => { setSection(key); setError(''); }} className={`admin-nav shrink-0 rounded-xl px-4 py-3 text-left text-sm font-extrabold ${section === key ? 'active' : 'text-slate-600 hover:bg-white'}`}>
              {label}
            </button>
          ))}
          <div className="hidden rounded-2xl bg-navy p-4 text-white lg:block">
            <p className="text-xs font-bold uppercase tracking-widest text-lime">Khusus akun Anda</p>
            <p className="mt-2 text-sm leading-6 text-blue-100">Daftar lapangan, jadwal, dan booking hanya menampilkan data yang Anda miliki.</p>
          </div>
        </nav>
        <section>
          {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
          {notice && <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{notice}</p>}
          {section === 'fields' && (
            <>
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div><p className="text-xs font-extrabold uppercase tracking-[.2em] text-blue-700">Dashboard</p><h1 className="display-font text-4xl font-black uppercase text-navy">Tempat sewa saya</h1></div>
                <button onClick={() => setEditing({})} className="rounded-xl bg-navy px-5 py-3 font-extrabold text-white">+ Tambah lapangan</button>
              </div>
              {editing && <FieldForm key={editing.field_id || 'new'} initial={editing.field_id ? editing : null} facilities={facilities} onCancel={() => setEditing(null)} onSave={saveField} />}
              {!fields.length && !editing ? <p className="rounded-2xl bg-white p-6 text-slate-600">Belum ada lapangan. Tambahkan tempat sewa pertama Anda.</p> : (
                <div className="grid gap-3">
                  {fields.map((field) => (
                    <article key={field.field_id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-4">
                        <FieldPhoto field={field} className="h-20 w-24 rounded-xl" />
                        <div>
                          <h2 className="display-font text-2xl font-bold uppercase text-navy">{field.field_name}</h2>
                          <p className="text-sm text-slate-500">{sportLabel[field.sport_type]} · {formatRupiah(field.price_per_hour)}/jam</p>
                          <p className="text-xs font-bold text-blue-700">{field.is_published ? 'Tayang publik' : 'Disembunyikan'}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => setScheduleField(field)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold">Atur jadwal</button>
                        <button onClick={() => setEditing(field)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold">Edit</button>
                        <button onClick={() => removeField(field)} className="rounded-lg border border-red-100 px-3 py-2 text-sm font-bold text-red-700">Hapus</button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
              {scheduleField && <ScheduleDialog field={scheduleField} token={token} onClose={() => setScheduleField(null)} onSaved={(message) => { setScheduleField(null); setNotice(message); }} />}
            </>
          )}
          {section === 'bookings' && (
            <>
              <p className="text-xs font-extrabold uppercase tracking-[.2em] text-blue-700">Reservasi lapangan Anda</p>
              <h1 className="display-font mb-5 text-4xl font-black uppercase text-navy">Booking masuk</h1>
              {!bookings.length ? <p className="rounded-2xl bg-white p-6 text-slate-600">Belum ada booking.</p> : (
                <div className="space-y-3">
                  {bookings.map((booking) => (
                    <article key={booking.booking_id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-sm">
                      <div>
                        <h2 className="display-font text-2xl font-bold uppercase text-navy">{booking.field_name}</h2>
                        <p className="text-sm font-bold">{booking.customer_name} · {booking.customer_email}</p>
                        <p className="text-sm text-slate-600">{booking.starts_at} — {booking.ends_at}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right"><p className="font-extrabold">{formatRupiah(booking.price_total)}</p><p className="text-xs font-bold uppercase text-slate-500">{booking.status}</p></div>
                        {booking.status === 'confirmed' && <button onClick={() => cancelBooking(booking)} className="rounded-xl border border-red-200 px-3 py-2 text-sm font-bold text-red-700">Batalkan</button>}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
          {section === 'settings' && (
            <div className="max-w-2xl">
              <p className="text-xs font-extrabold uppercase tracking-[.2em] text-blue-700">Akun admin</p>
              <h1 className="display-font mb-5 text-4xl font-black uppercase text-navy">Pengaturan akun</h1>
              <form onSubmit={saveProfile} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
                <label className="block text-sm font-bold">Nama lengkap<input className="input-control mt-1" required minLength="2" value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} /></label>
                <label className="block text-sm font-bold">Email<input className="input-control mt-1" type="email" required value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></label>
                <label className="block text-sm font-bold">Password saat ini<input className="input-control mt-1" type="password" required value={profile.current_password} onChange={(e) => setProfile({ ...profile, current_password: e.target.value })} /></label>
                <label className="block text-sm font-bold">Password baru <span className="font-normal text-slate-500">(opsional)</span><input className="input-control mt-1" type="password" minLength="8" value={profile.new_password} onChange={(e) => setProfile({ ...profile, new_password: e.target.value })} /></label>
                <button className="rounded-xl bg-navy px-5 py-3 font-extrabold text-white">Simpan pengaturan</button>
              </form>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function FieldForm({ initial, facilities, onCancel, onSave }) {
  const [form, setForm] = useState(() => ({
    field_name: initial?.field_name || '',
    sport_type: initial?.sport_type || 'futsal',
    address: initial?.address || '',
    description: initial?.description || '',
    photo_url: initial?.photo_url || '',
    phone_number: initial?.phone_number || '',
    price_per_hour: initial?.price_per_hour || '',
    longitude: initial?.longitude ?? 106.11,
    latitude: initial?.latitude ?? -2.13,
    is_published: initial?.is_published !== 0,
    facility_ids: initial?.facilities?.map((facility) => facility.facility_id) || []
  }));
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    await onSave({ ...form, price_per_hour: Number(form.price_per_hour), longitude: Number(form.longitude), latitude: Number(form.latitude) });
    setBusy(false);
  }

  function toggleFacility(id) {
    const selected = form.facility_ids.includes(id);
    setForm({ ...form, facility_ids: selected ? form.facility_ids.filter((value) => value !== id) : [...form.facility_ids, id] });
  }

  return (
    <form onSubmit={submit} className="mb-5 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
      <h2 className="display-font mb-4 text-3xl font-bold uppercase text-navy">{initial ? 'Edit lapangan' : 'Tambah lapangan'}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-bold">Nama tempat<input className="input-control mt-1" required value={form.field_name} onChange={(e) => setForm({ ...form, field_name: e.target.value })} /></label>
        <label className="text-sm font-bold">Jenis olahraga<select className="input-control mt-1" value={form.sport_type} onChange={(e) => setForm({ ...form, sport_type: e.target.value })}>{sports.slice(1).map((sport) => <option key={sport.value} value={sport.value}>{sport.label}</option>)}</select></label>
        <label className="text-sm font-bold sm:col-span-2">Alamat<textarea className="input-control mt-1" rows="2" required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
        <label className="text-sm font-bold sm:col-span-2">Deskripsi<textarea className="input-control mt-1" rows="2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        <label className="text-sm font-bold">Telepon<input className="input-control mt-1" value={form.phone_number || ''} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} /></label>
        <label className="text-sm font-bold">Harga per jam (Rp)<input className="input-control mt-1" type="number" min="0" required value={form.price_per_hour} onChange={(e) => setForm({ ...form, price_per_hour: e.target.value })} /></label>
        <label className="text-sm font-bold sm:col-span-2">URL foto<input className="input-control mt-1" type="url" placeholder="https://..." value={form.photo_url || ''} onChange={(e) => setForm({ ...form, photo_url: e.target.value })} /></label>
        <label className="text-sm font-bold">Longitude<input className="input-control mt-1" type="number" step="any" required value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} /></label>
        <label className="text-sm font-bold">Latitude<input className="input-control mt-1" type="number" step="any" required value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} /></label>
      </div>
      <div className="mt-4">
        <p className="mb-2 text-sm font-bold">Fasilitas tersedia</p>
        <div className="flex flex-wrap gap-2">
          {facilities.map((facility) => <button type="button" key={facility.facility_id} onClick={() => toggleFacility(facility.facility_id)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${form.facility_ids.includes(facility.facility_id) ? 'border-navy bg-navy text-white' : 'border-slate-200 text-slate-600'}`}>{facility.facility_name}</button>)}
          {!facilities.length && <span className="text-sm text-slate-500">Belum ada fasilitas pada database.</span>}
        </div>
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} /> Tampilkan ke publik</label>
      <div className="mt-5 flex gap-2">
        <button disabled={busy} className="rounded-xl bg-navy px-5 py-3 font-extrabold text-white disabled:opacity-50">{busy ? 'Menyimpan...' : 'Simpan lapangan'}</button>
        <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-5 py-3 font-bold">Batal</button>
      </div>
    </form>
  );
}

function ScheduleDialog({ field, token, onClose, onSaved }) {
  const [schedules, setSchedules] = useState([]);
  const [blackouts, setBlackouts] = useState([]);
  const [closure, setClosure] = useState({ starts_at: '', ends_at: '', reason: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/admin/fields/${field.field_id}/schedules`, { token })
      .then((data) => { setSchedules(data.schedules); setBlackouts(data.blackouts); })
      .catch((e) => setError(e.message));
  }, [field.field_id, token]);

  function updateDay(day, change) {
    setSchedules((current) => {
      const found = current.find((item) => item.day_of_week === day);
      if (!found) return [...current, { day_of_week: day, opening_time: '08:00', closing_time: '22:00', slot_minutes: 60, ...change }].sort((a, b) => a.day_of_week - b.day_of_week);
      if (change === null) return current.filter((item) => item.day_of_week !== day);
      return current.map((item) => item.day_of_week === day ? { ...item, ...change } : item);
    });
  }

  async function saveSchedules() {
    setError('');
    try {
      await api(`/admin/fields/${field.field_id}/schedules`, { token, method: 'PUT', body: JSON.stringify({ schedules }) });
      onSaved('Jadwal ketersediaan tersimpan.');
    } catch (e) { setError(e.message); }
  }

  async function addBlackout(event) {
    event.preventDefault();
    setError('');
    try {
      const data = await api(`/admin/fields/${field.field_id}/blackouts`, {
        token,
        method: 'POST',
        body: JSON.stringify(closure)
      });
      setBlackouts((current) => [...current, { blackout_id: data.blackout_id, ...closure }]);
      setClosure({ starts_at: '', ends_at: '', reason: '' });
    } catch (e) { setError(e.message); }
  }

  async function removeBlackout(blackout) {
    try {
      await api(`/admin/fields/${field.field_id}/blackouts/${blackout.blackout_id}`, { token, method: 'DELETE' });
      setBlackouts((current) => current.filter((item) => item.blackout_id !== blackout.blackout_id));
    } catch (e) { setError(e.message); }
  }

  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center overflow-y-auto bg-navy/70 p-4">
      <section className="my-auto w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-blue-700">Ketersediaan milik Anda</p><h2 className="display-font text-3xl font-black uppercase text-navy">{field.field_name}</h2></div>
          <button onClick={onClose} className="rounded-full bg-mist px-3 py-1 text-xl" aria-label="Tutup">×</button>
        </div>
        {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="mt-5 space-y-2">
          {weekdays.map((day, index) => {
            const schedule = schedules.find((item) => item.day_of_week === index);
            return (
              <div key={day} className="grid items-center gap-2 rounded-xl bg-mist p-3 sm:grid-cols-[100px_1fr_1fr_100px_75px]">
                <span className="text-sm font-bold">{day}</span>
                <label className="text-xs font-semibold text-slate-600">Buka<input className="input-control mt-1" type="time" disabled={!schedule} value={schedule?.opening_time || ''} onChange={(e) => updateDay(index, { opening_time: e.target.value })} /></label>
                <label className="text-xs font-semibold text-slate-600">Tutup<input className="input-control mt-1" type="time" disabled={!schedule} value={schedule?.closing_time || ''} onChange={(e) => updateDay(index, { closing_time: e.target.value })} /></label>
                <label className="text-xs font-semibold text-slate-600">Slot (menit)<input className="input-control mt-1" type="number" min="15" max="240" step="15" disabled={!schedule} value={schedule?.slot_minutes || 60} onChange={(e) => updateDay(index, { slot_minutes: Number(e.target.value) })} /></label>
                <label className="flex items-center gap-1 text-xs font-bold"><input type="checkbox" checked={Boolean(schedule)} onChange={(e) => updateDay(index, e.target.checked ? {} : null)} /> Buka</label>
              </div>
            );
          })}
        </div>
        <button onClick={saveSchedules} className="mt-4 rounded-xl bg-navy px-5 py-3 font-extrabold text-white">Simpan jam operasional</button>
        <form onSubmit={addBlackout} className="mt-7 border-t border-slate-200 pt-5">
          <h3 className="display-font text-2xl font-bold uppercase text-navy">Tutup sementara</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <label className="text-xs font-bold">Mulai<input className="input-control mt-1" type="datetime-local" required value={closure.starts_at} onChange={(e) => setClosure({ ...closure, starts_at: e.target.value })} /></label>
            <label className="text-xs font-bold">Selesai<input className="input-control mt-1" type="datetime-local" required value={closure.ends_at} onChange={(e) => setClosure({ ...closure, ends_at: e.target.value })} /></label>
            <label className="text-xs font-bold">Alasan<input className="input-control mt-1" value={closure.reason} onChange={(e) => setClosure({ ...closure, reason: e.target.value })} /></label>
          </div>
          <button className="mt-3 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold">Tambah penutupan</button>
        </form>
        {blackouts.length > 0 && <div className="mt-4 space-y-2">{blackouts.map((item) => <div key={item.blackout_id} className="flex justify-between gap-3 rounded-xl bg-amber-50 p-3 text-sm"><span>{item.starts_at} — {item.ends_at} {item.reason ? `· ${item.reason}` : ''}</span><button onClick={() => removeBlackout(item)} className="font-bold text-red-700">Hapus</button></div>)}</div>}
      </section>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('futsal-go-session')) || null; } catch { return null; }
  });
  const [authOpen, setAuthOpen] = useState(false);
  const [fields, setFields] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [sport, setSport] = useState('');
  const [facility, setFacility] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [selectedSchedules, setSelectedSchedules] = useState([]);
  const [bookingField, setBookingField] = useState(null);
  const [view, setView] = useState('discover');
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const params = useMemo(() => {
    const value = new URLSearchParams();
    if (sport) value.set('sport', sport);
    if (facility) value.set('facility_id', facility);
    if (query.trim()) value.set('q', query.trim());
    return value.toString();
  }, [sport, facility, query]);

  useEffect(() => {
    api(`/fields${params ? `?${params}` : ''}`)
      .then((data) => { setFields(data.fields); setError(''); })
      .catch((e) => setError(e.message));
  }, [params]);

  useEffect(() => {
    api('/facilities').then((data) => setFacilities(data.facilities)).catch(() => setFacilities([]));
  }, []);

  useEffect(() => {
    if (!selected) {
      setSelectedSchedules([]);
      return;
    }
    api(`/fields/${selected.field_id}/schedules`)
      .then((data) => setSelectedSchedules(data.schedules))
      .catch(() => setSelectedSchedules([]));
  }, [selected]);

  useEffect(() => {
    if (!session?.token) return;
    api('/auth/me', { token: session.token }).catch(() => {
      localStorage.removeItem('futsal-go-session');
      setSession(null);
    });
  }, []);

  function acceptSession(data) {
    const next = { token: data.token, user: data.user };
    localStorage.setItem('futsal-go-session', JSON.stringify(next));
    setSession(next);
    setAuthOpen(false);
    setView(data.user.role === 'admin' ? 'admin' : view);
  }

  function logout() {
    localStorage.removeItem('futsal-go-session');
    setSession(null);
    setView('discover');
  }

  function updateAdmin(user, token) {
    const next = { token, user };
    localStorage.setItem('futsal-go-session', JSON.stringify(next));
    setSession(next);
  }

  if (view === 'admin' && session?.user?.role === 'admin') {
    return <AdminDashboard token={session.token} user={session.user} onExit={() => setView('discover')} onUserUpdate={updateAdmin} />;
  }

  return (
    <div className="min-h-screen bg-mist">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-navy text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <button onClick={() => setView('discover')} className="flex items-center gap-3 text-left">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-lime text-2xl text-navy">⚽</span>
            <span><span className="display-font block text-2xl font-black uppercase leading-none">Futsal Go</span><span className="text-[10px] font-bold uppercase tracking-[.18em] text-blue-200">Pangkalpinang</span></span>
          </button>
          <nav className="flex items-center gap-2">
            {session?.user?.role === 'admin' && <button onClick={() => setView('admin')} className="hidden rounded-lg px-3 py-2 text-sm font-bold text-lime sm:block">Dashboard admin</button>}
            {session?.user?.role === 'user' && <button onClick={() => setView('bookings')} className="hidden rounded-lg px-3 py-2 text-sm font-bold text-blue-100 sm:block">Booking saya</button>}
            {session ? (
              <button onClick={logout} className="rounded-xl border border-white/25 px-4 py-2 text-sm font-bold">Keluar</button>
            ) : <button onClick={() => setAuthOpen(true)} className="rounded-xl bg-lime px-4 py-2 text-sm font-extrabold text-navy">Masuk</button>}
          </nav>
        </div>
      </header>

      {view === 'bookings' && session?.user?.role === 'user' ? (
        <UserBookings token={session.token} onBack={() => setView('discover')} />
      ) : (
        <>
          <section className="relative overflow-hidden bg-navy">
            <div className="absolute -right-20 -top-32 h-96 w-96 rounded-full border-[45px] border-white/[.04]" />
            <div className="relative mx-auto grid max-w-7xl gap-8 px-5 py-12 md:grid-cols-[1.2fr_.8fr] md:items-center md:py-16">
              <div className="max-w-2xl">
                <p className="mb-3 inline-flex rounded-full border border-lime/40 px-3 py-1 text-xs font-extrabold uppercase tracking-[.2em] text-lime">Mainnya dimulai dari sini</p>
                <h1 className="display-font text-6xl font-black uppercase leading-[.9] text-white sm:text-7xl">Cari lapangan.<br /><span className="text-lime">Gas main!</span></h1>
                <p className="mt-5 max-w-lg text-base leading-7 text-blue-100">Temukan lapangan futsal, mini-soccer, dan sepakbola di Pangkalpinang. Cek lokasi, fasilitas, harga, lalu booking slot pilihanmu.</p>
                <div className="mt-7 flex flex-wrap gap-3 text-sm font-bold text-white">
                  <span className="rounded-lg bg-white/10 px-3 py-2">01 / Temukan</span><span className="rounded-lg bg-white/10 px-3 py-2">02 / Pilih waktu</span><span className="rounded-lg bg-white/10 px-3 py-2">03 / Main!</span>
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[.07] p-5 backdrop-blur">
                <p className="text-xs font-extrabold uppercase tracking-[.2em] text-lime">Mulai pencarian</p>
                <label className="mt-4 block text-sm font-bold text-white">Nama tempat atau area
                  <input className="input-control mt-1" placeholder="Contoh: Air Itam..." value={query} onChange={(e) => setQuery(e.target.value)} />
                </label>
                <label className="mt-3 block text-sm font-bold text-white">Jenis olahraga
                  <select className="input-control mt-1" value={sport} onChange={(e) => setSport(e.target.value)}>{sports.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
                </label>
                <label className="mt-3 block text-sm font-bold text-white">Fasilitas
                  <select className="input-control mt-1" value={facility} onChange={(e) => setFacility(e.target.value)}><option value="">Semua fasilitas</option>{facilities.map((item) => <option key={item.facility_id} value={item.facility_id}>{item.facility_name}</option>)}</select>
                </label>
              </div>
            </div>
            <div className="h-1 bg-gradient-to-r from-lime via-blue-400 to-lime" />
          </section>
          <main className="mx-auto max-w-7xl px-5 py-9">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div><p className="text-xs font-extrabold uppercase tracking-[.2em] text-blue-700">Direktori lapangan</p><h2 className="display-font text-4xl font-black uppercase text-navy">Pilih arena kamu</h2></div>
              <p className="text-sm font-semibold text-slate-500">{fields.length} tempat ditemukan</p>
            </div>
            <div className="mb-5 flex flex-wrap gap-2">
              {sports.map((item) => <button key={item.value} onClick={() => setSport(item.value)} className={`sport-chip rounded-full px-4 py-2 text-sm font-bold ${sport === item.value ? 'active' : ''}`}>{item.label}</button>)}
            </div>
            {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            {fields.length > 0 && (
              <section className="mb-8 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
                <div className="grid gap-4 sm:grid-cols-2">
                  {fields.map((field) => <FieldCard key={field.field_id} field={field} onSelect={setSelected} onBook={setBookingField} />)}
                </div>
                <div className="overflow-hidden rounded-3xl bg-white p-2 shadow-sm lg:sticky lg:top-24 lg:self-start">
                  <MapView fields={fields} selected={selected} onSelect={setSelected} />
                  <p className="px-3 py-2 text-xs text-slate-500">Peta © OpenStreetMap · pilih pin untuk melihat lokasi.</p>
                </div>
              </section>
            )}
            {!fields.length && !error && <div className="rounded-3xl bg-white p-10 text-center"><div className="text-5xl">⚽</div><h3 className="display-font mt-3 text-3xl font-bold uppercase text-navy">Lapangan belum ditemukan</h3><p className="mt-1 text-slate-500">Coba kata kunci atau jenis olahraga yang lain.</p></div>}
            {selected && (
              <div className="fixed inset-x-3 bottom-3 z-20 mx-auto max-h-[45vh] max-w-3xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:inset-x-5 sm:p-5">
                <div className="flex items-start gap-4">
                  <FieldPhoto field={selected} className="hidden h-24 w-32 shrink-0 rounded-xl sm:block" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div><h3 className="display-font text-2xl font-bold uppercase text-navy">{selected.field_name}</h3><p className="text-sm text-slate-600">{selected.address}</p></div>
                      <button onClick={() => setSelected(null)} aria-label="Tutup detail lapangan" className="text-xl text-slate-400">×</button>
                    </div>
                    {selected.description && <p className="mt-2 text-sm text-slate-600">{selected.description}</p>}
                    <p className="mt-2 text-sm font-extrabold">{formatRupiah(selected.price_per_hour)} / jam</p>
                    {selectedSchedules.length > 0 && <p className="mt-1 text-xs text-slate-600">Jam: {selectedSchedules.map((item) => `${weekdays[item.day_of_week]} ${String(item.opening_time).slice(0, 5)}–${String(item.closing_time).slice(0, 5)}`).join(' · ')}</p>}
                    {selected.facilities?.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{selected.facilities.map((item) => <span key={item.facility_id} className="rounded-full bg-mist px-2 py-1 text-[11px] font-bold text-slate-600">{item.facility_name}</span>)}</div>}
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {selected.phone_number && <a className="text-sm font-extrabold text-emerald-700 underline" href={`https://wa.me/${String(selected.phone_number).replace(/\D/g, '').replace(/^0/, '62')}`} target="_blank" rel="noreferrer">WhatsApp / Hubungi</a>}
                      <a className="text-sm font-bold text-blue-800 underline" href={`https://www.openstreetmap.org/?mlat=${selected.latitude}&mlon=${selected.longitude}#map=17/${selected.latitude}/${selected.longitude}`} target="_blank" rel="noreferrer">Buka petunjuk peta</a>
                      <button onClick={() => setBookingField(selected)} className="rounded-xl bg-navy px-4 py-2 text-sm font-extrabold text-white">Booking slot</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>
        </>
      )}
      <footer className="mt-8 bg-navy px-5 py-7 text-center text-sm text-blue-100">
        <p className="display-font text-2xl font-bold uppercase text-white">Futsal Go <span className="text-lime">Pangkalpinang</span></p>
        <p className="mt-1">Cari tempatnya, amankan slotnya, main bareng.</p>
      </footer>
      {authOpen && <AuthDialog onClose={() => setAuthOpen(false)} onSuccess={acceptSession} />}
      {bookingField && <BookingDialog field={bookingField} token={session?.token} onClose={() => setBookingField(null)} onLogin={() => { setBookingField(null); setAuthOpen(true); }} onBooked={() => { setBookingField(null); setToast('Booking berhasil dikonfirmasi! Lihat detailnya di Booking saya.'); setTimeout(() => setToast(''), 5000); setView('bookings'); }} />}
      {toast && <div role="status" className="fixed bottom-5 left-1/2 z-[1100] -translate-x-1/2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-xl">{toast}</div>}
    </div>
  );
}
