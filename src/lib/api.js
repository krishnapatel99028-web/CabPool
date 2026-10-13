import { CAPACITY, WINDOW_MIN, soloFare, farePerRider, describePool, validateBooking } from '../../shared/pricing.js';

// The app talks to the Vercel API (backed by Neon). If the API isn't reachable
// (e.g. plain `npm run dev`, or DATABASE_URL not set yet) it transparently falls
// back to browser localStorage so the demo still works end to end.

let mode = 'unknown'; // 'server' | 'local'
export const getMode = () => mode;

async function callServer(path, options) {
  if (mode === 'local') return null;
  try {
    const res = await fetch(path, options);
    const isJson = (res.headers.get('content-type') || '').includes('application/json');
    if (!isJson || res.status >= 500) throw new Error('API unavailable');
    const data = await res.json();
    mode = 'server';
    if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { userFacing: true });
    return data;
  } catch (err) {
    if (err.userFacing) throw err;
    mode = 'local';
    return null;
  }
}

// ---------- local fallback ----------
const KEY = 'cabpool_demo_db';
const load = () => JSON.parse(localStorage.getItem(KEY) || '{"pools":[],"bookings":[]}');
const save = (db) => localStorage.setItem(KEY, JSON.stringify(db));
const takenIn = (db, poolId) => db.bookings.filter((b) => b.poolId === poolId).length;

function findOpenPool(db, destination, arrivalIso) {
  const t = new Date(arrivalIso).getTime();
  return (
    db.pools
      .filter(
        (p) =>
          p.destination === destination &&
          Math.abs(new Date(p.arrival).getTime() - t) <= WINDOW_MIN * 60000 &&
          takenIn(db, p.id) < CAPACITY
      )
      .sort((a, b) => takenIn(db, b.id) - takenIn(db, a.id))[0] ?? null
  );
}

// ---------- public API ----------
export async function previewPool({ destination, arrival }) {
  const q = new URLSearchParams({ destination, arrival });
  const data = await callServer(`/api/preview?${q}`);
  if (data) return data;

  const db = load();
  const pool = findOpenPool(db, destination, arrival);
  const taken = pool ? takenIn(db, pool.id) : 0;
  const solo = soloFare(destination);
  return { taken, seatsLeft: CAPACITY - taken, solo, joinPrice: farePerRider(solo, taken + 1), hasPool: !!pool };
}

export async function createBooking(form) {
  const body = { ...form, arrival: new Date(form.arrival).toISOString() };
  const data = await callServer('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (data) return data;

  const errors = validateBooking(body);
  if (errors.length) throw Object.assign(new Error(errors.join('. ')), { userFacing: true });

  const db = load();
  let pool = findOpenPool(db, body.destination, body.arrival);
  if (!pool) {
    pool = { id: crypto.randomUUID(), destination: body.destination, arrival: body.arrival };
    db.pools.push(pool);
  }
  const booking = {
    id: crypto.randomUUID(),
    poolId: pool.id,
    name: body.name.trim(),
    phone: body.phone.replace(/\s|-/g, ''),
    flightNo: body.flightNo.trim().toUpperCase(),
  };
  db.bookings.push(booking);
  save(db);
  return {
    booking: { id: booking.id, name: booking.name, flightNo: booking.flightNo },
    pool: describePool({ ...pool, taken: takenIn(db, pool.id) }),
  };
}

export async function myBookings(phone) {
  const clean = phone.replace(/\s|-/g, '');
  const data = await callServer(`/api/bookings?phone=${encodeURIComponent(clean)}`);
  if (data) return data.bookings;

  const db = load();
  return db.bookings
    .filter((b) => b.phone === clean)
    .reverse()
    .map((b) => {
      const pool = db.pools.find((p) => p.id === b.poolId);
      return { id: b.id, name: b.name, flightNo: b.flightNo, pool: describePool({ ...pool, taken: takenIn(db, pool.id) }) };
    });
}
