/*
# Fix staff permissions, profile updates, and anon read access

## Changes
1. Add `updated_at` to profiles UPDATE grant
2. Add 'staff' role to ALL staff RLS policies
3. Allow anon to read incident_events, report_incident_links, incidents (track page)
*/

-- 1. Fix profile UPDATE: add updated_at to allowed columns
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (full_name, phone, preferred_language, notification_prefs, updated_at) ON profiles TO authenticated;

-- 2. Reports: add 'staff' to staff policies
DROP POLICY IF EXISTS "reports_select_staff" ON reports;
CREATE POLICY "reports_select_staff" ON reports FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('verifier', 'operator', 'manager', 'admin', 'staff')
    )
  );

DROP POLICY IF EXISTS "reports_update_staff" ON reports;
CREATE POLICY "reports_update_staff" ON reports FOR UPDATE
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('verifier', 'operator', 'manager', 'admin', 'staff')
    )
  ) WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('verifier', 'operator', 'manager', 'admin', 'staff')
    )
  );

-- 3. Incidents: add 'staff' to all incident policies
DROP POLICY IF EXISTS "incidents_insert_staff" ON incidents;
CREATE POLICY "incidents_insert_staff" ON incidents FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('verifier', 'operator', 'manager', 'admin', 'staff')
    )
  );

DROP POLICY IF EXISTS "incidents_update_staff" ON incidents;
CREATE POLICY "incidents_update_staff" ON incidents FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('verifier', 'operator', 'manager', 'admin', 'staff')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('verifier', 'operator', 'manager', 'admin', 'staff')
    )
  );

-- 4. Incident events: add 'staff' to insert and update
DROP POLICY IF EXISTS "events_insert_staff" ON incident_events;
CREATE POLICY "events_insert_staff" ON incident_events FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('verifier', 'operator', 'manager', 'admin', 'staff')
    )
  );

DROP POLICY IF EXISTS "events_update_staff" ON incident_events;
CREATE POLICY "events_update_staff" ON incident_events FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('verifier', 'operator', 'manager', 'admin', 'staff')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('verifier', 'operator', 'manager', 'admin', 'staff')
    )
  );

-- 5. Report-incident links: add 'staff' to insert and update
DROP POLICY IF EXISTS "links_insert_staff" ON report_incident_links;
CREATE POLICY "links_insert_staff" ON report_incident_links FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('verifier', 'operator', 'manager', 'admin', 'staff')
    )
  );

DROP POLICY IF EXISTS "links_update_staff" ON report_incident_links;
CREATE POLICY "links_update_staff" ON report_incident_links FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('verifier', 'operator', 'manager', 'admin', 'staff')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('verifier', 'operator', 'manager', 'admin', 'staff')
    )
  );

-- 6. Evidence: add 'staff' to update
DROP POLICY IF EXISTS "evidence_update_staff" ON evidence;
CREATE POLICY "evidence_update_staff" ON evidence FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('verifier', 'operator', 'manager', 'admin', 'staff')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('verifier', 'operator', 'manager', 'admin', 'staff')
    )
  );

-- 7. Allow anon to read incident_events (track page without login)
DROP POLICY IF EXISTS "anon_select_incident_events" ON incident_events;
CREATE POLICY "anon_select_incident_events" ON incident_events FOR SELECT
  TO anon, authenticated USING (true);

-- 8. Allow anon to read report_incident_links (track page without login)
DROP POLICY IF EXISTS "anon_select_report_links" ON report_incident_links;
CREATE POLICY "anon_select_report_links" ON report_incident_links FOR SELECT
  TO anon, authenticated USING (true);

-- 9. Allow anon to read incidents (track page without login)
DROP POLICY IF EXISTS "anon_select_incidents" ON incidents;
CREATE POLICY "anon_select_incidents" ON incidents FOR SELECT
  TO anon, authenticated USING (true);
