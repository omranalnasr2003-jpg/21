-- Run this in your Supabase SQL Editor
-- Go to: supabase.com → Dein Projekt → SQL Editor → New Query → Paste → Run

CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  host_name text,
  player_names text[] DEFAULT '{}',
  max_players integer DEFAULT 2,
  game_state jsonb,
  status text DEFAULT 'waiting',
  created_at timestamptz DEFAULT now()
);

-- Enable Realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;

-- Allow public read/write (no auth needed)
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON rooms FOR ALL USING (true) WITH CHECK (true);

-- Auto-delete old rooms after 2 hours
CREATE OR REPLACE FUNCTION delete_old_rooms() RETURNS void AS $$
  DELETE FROM rooms WHERE created_at < now() - interval '2 hours';
$$ LANGUAGE sql;
