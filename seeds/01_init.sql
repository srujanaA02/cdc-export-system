-- Idempotent: safe to run multiple times
CREATE TABLE IF NOT EXISTS users (
  id         BIGSERIAL PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  email      VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN      NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_users_updated_at ON users(updated_at);

CREATE TABLE IF NOT EXISTS watermarks (
  id               SERIAL PRIMARY KEY,
  consumer_id      VARCHAR(255) NOT NULL UNIQUE,
  last_exported_at TIMESTAMPTZ  NOT NULL,
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Seed 100,000 users only if table is empty
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM users) = 0 THEN
    INSERT INTO users (name, email, created_at, updated_at, is_deleted)
    SELECT
      'User ' || g                             AS name,
      'user' || g || '@example.com'            AS email,
      NOW() - (random() * INTERVAL '30 days')  AS created_at,
      NOW() - (random() * INTERVAL '7 days')   AS updated_at,
      (random() < 0.02)                         AS is_deleted  -- ~2% deleted
    FROM generate_series(1, 100000) AS g;
  END IF;
END $$;