-- A pool = one shared cab going to one destination around one landing time.
CREATE TABLE IF NOT EXISTS pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination text NOT NULL,
  arrival_time timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- A booking = one passenger's seat in a pool.
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  flight_no text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pools_dest_time ON pools (destination, arrival_time);
CREATE INDEX IF NOT EXISTS idx_bookings_pool ON bookings (pool_id);
CREATE INDEX IF NOT EXISTS idx_bookings_phone ON bookings (phone);
