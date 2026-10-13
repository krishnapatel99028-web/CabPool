import { useEffect, useState } from 'react';
import { DESTINATIONS, CAPACITY, FACTORS, farePerRider } from '../shared/pricing.js';
import { previewPool, createBooking, myBookings, getMode } from './lib/api.js';

const rupee = (n) => `₹${n.toLocaleString('en-IN')}`;
const fmtTime = (iso) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// default landing time: next full hour + 2h, as a datetime-local value
function defaultArrival() {
  const d = new Date(Date.now() + 2 * 3600 * 1000);
  d.setMinutes(0, 0, 0);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function Seats({ taken }) {
  return (
    <div className="seats" aria-label={`${taken} of ${CAPACITY} seats taken`}>
      {Array.from({ length: CAPACITY }, (_, i) => (
        <span key={i} className={i < taken ? 'seat taken' : 'seat'} />
      ))}
    </div>
  );
}

function PoolCard({ pool, title }) {
  return (
    <div className="pool">
      <div className="pool-head">
        <strong>{title ?? `Airport → ${pool.destination}`}</strong>
        <span className="muted">{fmtTime(pool.arrival)}</span>
      </div>
      <Seats taken={pool.taken} />
      <div className="pool-row">
        <span>
          {pool.taken} of {CAPACITY} riders joined
          {pool.full ? ' · cab full' : ` · ${pool.seatsLeft} seat${pool.seatsLeft > 1 ? 's' : ''} left`}
        </span>
        <span className="price">{rupee(pool.perRider)} each</span>
      </div>
      <p className="muted small">
        Solo fare {rupee(pool.solo)}. Your share drops as more riders join, down to {rupee(farePerRider(pool.solo, CAPACITY))}.
      </p>
    </div>
  );
}

function BookTab({ onBooked }) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    flightNo: '',
    arrival: defaultArrival(),
    destination: 'Thane',
  });
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    if (!form.arrival || !form.destination) return;
    const t = setTimeout(async () => {
      try {
        const iso = new Date(form.arrival).toISOString();
        setPreview(await previewPool({ destination: form.destination, arrival: iso }));
        onBooked?.();
      } catch {
        setPreview(null);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [form.arrival, form.destination]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      setResult(await createBooking(form));
      onBooked?.();
      localStorage.setItem('cabpool_phone', form.phone);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function simulateCoPassenger() {
    try {
      const r = await createBooking({
        name: ['Asha', 'Rohan', 'Meera', 'Kabir'][Math.floor(Math.random() * 4)],
        phone: '9' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0'),
        flightNo: form.flightNo || 'AI101',
        arrival: form.arrival,
        destination: form.destination,
      });
      setResult((prev) => ({ ...prev, pool: r.pool }));
    } catch (err) {
      setError(err.message);
    }
  }

  if (result) {
    return (
      <section className="card success">
        <div className="tick">✓</div>
        <h2>You're booked, {result.booking.name.split(' ')[0]}!</h2>
        <p className="muted">
          Flight {result.booking.flightNo}. Your driver will meet you at the arrivals pickup point after you land.
        </p>
        <PoolCard pool={result.pool} />
        {!result.pool.full && (
          <button className="ghost" onClick={simulateCoPassenger}>
            Demo: simulate another passenger joining
          </button>
        )}
        <button onClick={() => setResult(null)}>Book another ride</button>
      </section>
    );
  }

  const solo = DESTINATIONS.find((d) => d.name === form.destination)?.solo;

  return (
    <form className="card" onSubmit={submit}>
      <h2>Book before you land</h2>
      <div className="grid">
        <label>
          Full name
          <input value={form.name} onChange={set('name')} placeholder="Krishna Patel" required />
        </label>
        <label>
          Phone
          <input value={form.phone} onChange={set('phone')} placeholder="9876543210" inputMode="tel" required />
        </label>
        <label>
          Flight number
          <input value={form.flightNo} onChange={set('flightNo')} placeholder="6E 204" required />
        </label>
        <label>
          Landing time
          <input type="datetime-local" value={form.arrival} onChange={set('arrival')} required />
        </label>
        <label className="wide">
          Going to
          <select value={form.destination} onChange={set('destination')}>
            {DESTINATIONS.map((d) => (
              <option key={d.name}>{d.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="compare">
        <div>
          <span className="muted small">Private cab</span>
          <div className="big strike">{solo ? rupee(solo) : '-'}</div>
        </div>
        <div className="arrow">→</div>
        <div>
          <span className="muted small">
            {preview?.hasPool ? `Join ${preview.taken} rider${preview.taken > 1 ? 's' : ''}` : 'Shared cab (you start the pool)'}
          </span>
          <div className="big accent">{preview ? rupee(preview.joinPrice) : '-'}</div>
        </div>
      </div>
      <p className="muted small">
        Riders to the same area landing within 30 minutes share one cab (max {CAPACITY}). Price per rider with
        2 / 3 / {CAPACITY} riders: {[2, 3, 4].map((n) => rupee(farePerRider(solo ?? 0, n))).join(' / ')}.
      </p>

      {error && <p className="error">{error}</p>}
      <button disabled={busy}>{busy ? 'Booking…' : 'Book shared cab'}</button>
    </form>
  );
}

function MineTab() {
  const [phone, setPhone] = useState(localStorage.getItem('cabpool_phone') || '');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  async function lookup(e) {
    e?.preventDefault();
    setError('');
    try {
      setRows(await myBookings(phone));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    if (phone) lookup();
  }, []);

  return (
    <section className="card">
      <h2>My bookings</h2>
      <form className="inline" onSubmit={lookup}>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone used while booking" inputMode="tel" />
        <button>Find</button>
      </form>
      {error && <p className="error">{error}</p>}
      {rows?.length === 0 && <p className="muted">No bookings found for this number.</p>}
      {rows?.map((b) => (
        <PoolCard key={b.id} pool={b.pool} title={`${b.flightNo} → ${b.pool.destination}`} />
      ))}
    </section>
  );
}

export default function App() {
  const [tab, setTab] = useState('book');
  const [, force] = useState(0);

  return (
    <>
      <header>
        <div className="brand">🚖 CabPool</div>
        <nav>
          <button className={tab === 'book' ? 'tab active' : 'tab'} onClick={() => setTab('book')}>Book</button>
          <button className={tab === 'mine' ? 'tab active' : 'tab'} onClick={() => setTab('mine')}>My bookings</button>
        </nav>
      </header>

      <main>
        <section className="hero">
          <h1>Land. Hop in. Split the fare.</h1>
          <p>
            Book your airport cab before the plane touches down and share it with passengers heading your way.
            Thane for ₹1000 solo, or about ₹300 when four of you share.
          </p>
        </section>

        {tab === 'book' ? <BookTab onBooked={() => force((n) => n + 1)} /> : <MineTab />}

        <footer>
          {getMode() === 'server' && <span className="badge ok">Live · Neon database</span>}
          {getMode() === 'local' && <span className="badge">Demo mode · saved in this browser only</span>}
          <p className="muted small">Student demo project. Payments are not processed.</p>
        </footer>
      </main>
    </>
  );
}
