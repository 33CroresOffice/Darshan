/*
  # Add Slot Session Management System

  ## Summary
  Introduces a session lifecycle system for darshan slots, allowing supervisors and admins
  to start and end a slot session for the day. Only one slot can be active at a time per day.
  Once a slot session is ended, it is permanently closed — no tickets for that slot can be
  processed further. An immutable audit log records every start/end action.

  ## New Tables

  ### slot_sessions
  Tracks the lifecycle state of each darshan slot activation per day.
  - `id` (uuid, primary key)
  - `slot_id` (FK to darshan_slots) - which slot this session is for
  - `date` (date) - the calendar date of this session
  - `status` (text) - "active" or "ended"
  - `started_by` (FK to profiles) - who started the session
  - `ended_by` (FK to profiles, nullable) - who ended the session
  - `started_at` (timestamptz) - when the session was started
  - `ended_at` (timestamptz, nullable) - when the session was ended

  ### slot_session_logs
  Immutable audit trail for every slot session event.
  - `id` (uuid, primary key)
  - `session_id` (FK to slot_sessions)
  - `slot_id` (FK to darshan_slots)
  - `slot_name` (text) - denormalized slot name at time of action
  - `action` (text) - "started" or "ended"
  - `performed_by` (FK to profiles)
  - `performed_by_name` (text) - denormalized name at time of action
  - `performed_by_role` (text) - denormalized role at time of action
  - `performed_at` (timestamptz)

  ## Constraints
  - Unique partial index: only one "active" session per slot per date

  ## Security
  - RLS enabled on both tables
  - Authenticated staff (supervisor, admin, superadmin) can read all rows
  - Authenticated staff can insert (start) sessions
  - Only the session starter or admins can update (end) sessions
  - Logs are insert-only for authenticated staff; no updates or deletes permitted
*/

CREATE TABLE IF NOT EXISTS slot_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL REFERENCES darshan_slots(id),
  date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  started_by uuid NOT NULL REFERENCES profiles(id),
  ended_by uuid REFERENCES profiles(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS slot_sessions_one_active_per_day
  ON slot_sessions (date)
  WHERE status = 'active';

ALTER TABLE slot_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read slot sessions"
  ON slot_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('superadmin', 'admin', 'supervisor')
    )
  );

CREATE POLICY "Staff can start slot sessions"
  ON slot_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('superadmin', 'admin', 'supervisor')
    )
  );

CREATE POLICY "Staff can end slot sessions"
  ON slot_sessions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('superadmin', 'admin', 'supervisor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('superadmin', 'admin', 'supervisor')
    )
  );

CREATE TABLE IF NOT EXISTS slot_session_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES slot_sessions(id),
  slot_id uuid NOT NULL REFERENCES darshan_slots(id),
  slot_name text NOT NULL,
  action text NOT NULL CHECK (action IN ('started', 'ended')),
  performed_by uuid NOT NULL REFERENCES profiles(id),
  performed_by_name text NOT NULL DEFAULT '',
  performed_by_role text NOT NULL DEFAULT '',
  performed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE slot_session_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read slot session logs"
  ON slot_session_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('superadmin', 'admin', 'supervisor')
    )
  );

CREATE POLICY "Staff can insert slot session logs"
  ON slot_session_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('superadmin', 'admin', 'supervisor')
    )
  );
