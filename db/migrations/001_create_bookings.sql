-- Run against the company-provided PostgreSQL starter database.
-- Requires the starter users and rooms tables.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    room_id INTEGER NOT NULL REFERENCES rooms(id),
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'confirmed',
    total_price NUMERIC(12,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_dates CHECK (check_out > check_in),
    CONSTRAINT valid_status CHECK (status IN ('confirmed', 'cancelled')),
    CONSTRAINT valid_price CHECK (total_price >= 0),
    CONSTRAINT prevent_overlapping_bookings
      EXCLUDE USING gist (
        room_id WITH =,
        daterange(check_in, check_out, '[)') WITH &&
      ) WHERE (status = 'confirmed')
);

CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
