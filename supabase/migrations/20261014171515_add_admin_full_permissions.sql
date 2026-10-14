-- Admin can delete incidents
DROP POLICY IF EXISTS "incidents_delete_admin" ON incidents;
CREATE POLICY "incidents_delete_admin" ON incidents FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admin can delete incident events
DROP POLICY IF EXISTS "events_delete_admin" ON incident_events;
CREATE POLICY "events_delete_admin" ON incident_events FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Admin can delete report-incident links
DROP POLICY IF EXISTS "links_delete_admin" ON report_incident_links;
CREATE POLICY "links_delete_admin" ON report_incident_links FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Staff can update report_incident_links (for assignment changes)
DROP POLICY IF EXISTS "links_update_staff" ON report_incident_links;
CREATE POLICY "links_update_staff" ON report_incident_links FOR UPDATE
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

-- Staff can update incident events
DROP POLICY IF EXISTS "events_update_staff" ON incident_events;
CREATE POLICY "events_update_staff" ON incident_events FOR UPDATE
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

-- Staff can insert/update evidence, categories, departments, knowledge
DROP POLICY IF EXISTS "evidence_update_staff" ON evidence;
CREATE POLICY "evidence_update_staff" ON evidence FOR UPDATE
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

-- Admin can delete categories, departments, knowledge, evidence
DROP POLICY IF EXISTS "categories_delete_admin" ON categories;
CREATE POLICY "categories_delete_admin" ON categories FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "departments_delete_admin" ON departments;
CREATE POLICY "departments_delete_admin" ON departments FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "knowledge_delete_admin" ON knowledge_documents;
CREATE POLICY "knowledge_delete_admin" ON knowledge_documents FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

-- Staff can insert knowledge documents
DROP POLICY IF EXISTS "knowledge_insert_staff" ON knowledge_documents;
CREATE POLICY "knowledge_insert_staff" ON knowledge_documents FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

-- Staff can update knowledge documents
DROP POLICY IF EXISTS "knowledge_update_staff" ON knowledge_documents;
CREATE POLICY "knowledge_update_staff" ON knowledge_documents FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

-- Staff can insert departments
DROP POLICY IF EXISTS "departments_insert_staff" ON departments;
CREATE POLICY "departments_insert_staff" ON departments FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

-- Staff can insert categories
DROP POLICY IF EXISTS "categories_insert_staff" ON categories;
CREATE POLICY "categories_insert_staff" ON categories FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );
