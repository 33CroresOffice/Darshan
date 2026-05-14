/*
  # Allow authenticated users to read slot sessions

  ## Change
  - Add a SELECT policy on slot_sessions that allows any authenticated user to read records
  - This is needed so sebayat users can check which slots have ended before creating tickets
  - Without this, the getAvailableSlotsForToday() function returns no ended slot IDs for regular users,
    making all slots appear available even after they've been ended by a supervisor

  ## Security
  - Read-only access; no sensitive data is exposed (slot IDs, dates, statuses)
  - Existing staff-only insert/update policies remain unchanged
*/

CREATE POLICY "Authenticated users can read slot sessions"
  ON slot_sessions
  FOR SELECT
  TO authenticated
  USING (true);
