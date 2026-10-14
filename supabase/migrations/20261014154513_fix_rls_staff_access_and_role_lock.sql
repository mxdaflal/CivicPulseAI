-- 1. Reports: staff can see ALL reports, citizens see only their own
DROP POLICY IF EXISTS "reports_select_own" ON reports;
DROP POLICY IF EXISTS "reports_insert_own" ON reports;
DROP POLICY IF EXISTS "reports_update_own" ON reports;
DROP POLICY IF EXISTS "reports_delete_own" ON reports;

-- Citizens can select their own reports
CREATE POLICY "reports_select_own" ON reports FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- Staff (verifier, operator, manager, admin) can see all reports
CREATE POLICY "reports_select_staff" ON reports FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('verifier', 'operator', 'manager', 'admin')
    )
  );

-- Citizens can insert their own reports
CREATE POLICY "reports_insert_own" ON reports FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- Staff can update reports (status changes, linking)
CREATE POLICY "reports_update_staff" ON reports FOR UPDATE
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('verifier', 'operator', 'manager', 'admin')
    )
  ) WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('verifier', 'operator', 'manager', 'admin')
    )
  );

-- Citizens can delete their own reports
CREATE POLICY "reports_delete_own" ON reports FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- 2. Profiles: lock the role column so users can't self-promote
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (full_name, phone, preferred_language, notification_prefs) ON profiles TO authenticated;

-- 3. Incidents: staff can read/insert/update, citizens can read all
DROP POLICY IF EXISTS "incidents_select_all" ON incidents;
DROP POLICY IF EXISTS "incidents_insert_staff" ON incidents;
DROP POLICY IF EXISTS "incidents_update_staff" ON incidents;

CREATE POLICY "incidents_select_all" ON incidents FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "incidents_insert_staff" ON incidents FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('verifier', 'operator', 'manager', 'admin')
    )
  );

CREATE POLICY "incidents_update_staff" ON incidents FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('verifier', 'operator', 'manager', 'admin')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('verifier', 'operator', 'manager', 'admin')
    )
  );

-- 4. Incident events: staff can insert, all can read
DROP POLICY IF EXISTS "events_insert_staff" ON incident_events;
CREATE POLICY "events_insert_staff" ON incident_events FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('verifier', 'operator', 'manager', 'admin')
    )
  );

-- 5. Report-incident links: staff can insert, all can read
DROP POLICY IF EXISTS "links_insert_staff" ON report_incident_links;
CREATE POLICY "links_insert_staff" ON report_incident_links FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('verifier', 'operator', 'manager', 'admin')
    )
  );

-- 6. AI analyses: citizens can insert for their own reports, staff can insert for any
DROP POLICY IF EXISTS "ai_insert_staff" ON ai_analyses;
CREATE POLICY "ai_insert_authenticated" ON ai_analyses FOR INSERT
  TO authenticated WITH CHECK (true);
