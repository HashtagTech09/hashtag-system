
-- Add style column to batch_sessions
ALTER TABLE batch_sessions ADD COLUMN style text;

-- Backfill style from batches
UPDATE batch_sessions bs SET style = b.style FROM batches b WHERE bs.batch_id = b.id;

-- Drop existing drop_ins table and recreate session-based
DROP TABLE IF EXISTS drop_ins;

CREATE TABLE drop_ins (
  id bigint generated always as identity primary key,
  organization_id bigint NOT NULL REFERENCES organizations(id),
  student_id bigint NOT NULL REFERENCES students(id),
  batch_session_id bigint NOT NULL REFERENCES batch_sessions(id),
  amount numeric NOT NULL,
  payment_id bigint REFERENCES payments(id),
  is_adjusted boolean NOT NULL DEFAULT false,
  adjusted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE drop_ins ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Allow read drop_ins" ON drop_ins FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert drop_ins" ON drop_ins FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update drop_ins" ON drop_ins FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete drop_ins" ON drop_ins FOR DELETE TO authenticated USING (true);
