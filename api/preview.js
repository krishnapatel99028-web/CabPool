import { sql } from './_db.js';
import { CAPACITY, WINDOW_MIN, soloFare, farePerRider } from '../shared/pricing.js';

// GET /api/preview?destination=Thane&arrival=2026-10-14T13:00:00.000Z
// Tells the passenger how many riders are already waiting and what they'd pay.
export default async function handler(req, res) {
  try {
    const { destination, arrival } = req.query;
    const solo = soloFare(destination);
    const a = new Date(arrival);
    if (solo == null || Number.isNaN(a.getTime())) {
      return res.status(400).json({ error: 'destination and arrival are required' });
    }
    const from = new Date(a.getTime() - WINDOW_MIN * 60000).toISOString();
    const to = new Date(a.getTime() + WINDOW_MIN * 60000).toISOString();

    const rows = await sql`
      SELECT COUNT(b.id)::int AS taken
      FROM pools p LEFT JOIN bookings b ON b.pool_id = p.id
      WHERE p.destination = ${destination}
        AND p.arrival_time BETWEEN ${from} AND ${to}
      GROUP BY p.id
      HAVING COUNT(b.id) < ${CAPACITY}
      ORDER BY taken DESC
      LIMIT 1`;

    const taken = rows[0]?.taken ?? 0;
    return res.status(200).json({
      taken,
      seatsLeft: CAPACITY - taken,
      solo,
      joinPrice: farePerRider(solo, taken + 1),
      hasPool: rows.length > 0,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}
