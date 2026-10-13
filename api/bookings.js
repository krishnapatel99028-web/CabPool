import { sql } from './_db.js';
import { CAPACITY, WINDOW_MIN, describePool, validateBooking } from '../shared/pricing.js';

async function findOpenPool(destination, arrival) {
  const a = new Date(arrival);
  const from = new Date(a.getTime() - WINDOW_MIN * 60000).toISOString();
  const to = new Date(a.getTime() + WINDOW_MIN * 60000).toISOString();
  const rows = await sql`
    SELECT p.id, COUNT(b.id)::int AS taken
    FROM pools p LEFT JOIN bookings b ON b.pool_id = p.id
    WHERE p.destination = ${destination}
      AND p.arrival_time BETWEEN ${from} AND ${to}
    GROUP BY p.id
    HAVING COUNT(b.id) < ${CAPACITY}
    ORDER BY taken DESC, p.arrival_time
    LIMIT 1`;
  return rows[0] ?? null;
}

export default async function handler(req, res) {
  try {
    // POST /api/bookings -> join an existing pool or start a new one
    if (req.method === 'POST') {
      const body = req.body || {};
      const errors = validateBooking(body);
      if (errors.length) return res.status(400).json({ error: errors.join('. ') });

      const arrival = new Date(body.arrival).toISOString();
      let pool = await findOpenPool(body.destination, arrival);
      let poolId = pool?.id;

      if (!poolId) {
        const created = await sql`
          INSERT INTO pools (destination, arrival_time)
          VALUES (${body.destination}, ${arrival})
          RETURNING id`;
        poolId = created[0].id;
      }

      const inserted = await sql`
        INSERT INTO bookings (pool_id, name, phone, flight_no)
        VALUES (${poolId}, ${body.name.trim()}, ${body.phone.replace(/\s|-/g, '')}, ${body.flightNo.trim().toUpperCase()})
        RETURNING id, created_at`;

      const [{ taken, arrival_time }] = await sql`
        SELECT COUNT(b.id)::int AS taken, p.arrival_time
        FROM pools p JOIN bookings b ON b.pool_id = p.id
        WHERE p.id = ${poolId}
        GROUP BY p.id`;

      return res.status(201).json({
        booking: { id: inserted[0].id, name: body.name.trim(), flightNo: body.flightNo.trim().toUpperCase() },
        pool: describePool({ id: poolId, destination: body.destination, arrival: arrival_time, taken }),
      });
    }

    // GET /api/bookings?phone=98xxxxxx -> a passenger's own bookings
    if (req.method === 'GET') {
      const phone = (req.query.phone || '').replace(/\s|-/g, '');
      if (!phone) return res.status(400).json({ error: 'phone is required' });

      const rows = await sql`
        SELECT b.id, b.name, b.flight_no, p.id AS pool_id, p.destination, p.arrival_time,
               (SELECT COUNT(*)::int FROM bookings x WHERE x.pool_id = p.id) AS taken
        FROM bookings b JOIN pools p ON p.id = b.pool_id
        WHERE b.phone = ${phone}
        ORDER BY b.created_at DESC
        LIMIT 20`;

      return res.status(200).json({
        bookings: rows.map((r) => ({
          id: r.id,
          name: r.name,
          flightNo: r.flight_no,
          pool: describePool({ id: r.pool_id, destination: r.destination, arrival: r.arrival_time, taken: r.taken }),
        })),
      });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}
