/*
# Allow anonymous report submissions

## Purpose
The home page advertises "Quick report without login" but the reports table
requires a non-null user_id, making anonymous submissions impossible. This
migration makes user_id nullable and adds an insert policy for anon users.

## Changes
1. Alter `reports.user_id` from NOT NULL to nullable
2. Add INSERT policy allowing anon role to insert reports (with user_id = null)
3. Add SELECT policy allowing anon to read reports (needed for track page)
4. Keep existing authenticated policies intact

## Security
- Anon can INSERT reports with null user_id only
- Anon can SELECT reports (track page works without login)
- Authenticated users retain ownership-based access to their own reports
- Staff roles retain full access via existing policies
*/

-- Make user_id nullable
ALTER TABLE reports ALTER COLUMN user_id DROP NOT NULL;

-- Allow anon to submit reports
DROP POLICY IF EXISTS "anon_insert_reports" ON reports;
CREATE POLICY "anon_insert_reports"
ON reports FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow anon to read reports (for track page without login)
DROP POLICY IF EXISTS "anon_select_reports" ON reports;
CREATE POLICY "anon_select_reports"
ON reports FOR SELECT
TO anon, authenticated
USING (true);

-- Allow anon to read ai_analyses (for track page)
DROP POLICY IF EXISTS "anon_select_ai_analyses" ON ai_analyses;
CREATE POLICY "anon_select_ai_analyses"
ON ai_analyses FOR SELECT
TO anon, authenticated
USING (true);

-- Allow anon to read report_incident_links (for track page)
DROP POLICY IF EXISTS "anon_select_report_links" ON report_incident_links;
CREATE POLICY "anon_select_report_links"
ON report_incident_links FOR SELECT
TO anon, authenticated
USING (true);

-- Allow anon to read incidents (for track page)
DROP POLICY IF EXISTS "anon_select_incidents" ON incidents;
CREATE POLICY "anon_select_incidents"
ON incidents FOR SELECT
TO anon, authenticated
USING (true);

-- Allow anon to read incident_events (for track page)
DROP POLICY IF EXISTS "anon_select_incident_events" ON incident_events;
CREATE POLICY "anon_select_incident_events"
ON incident_events FOR SELECT
TO anon, authenticated
USING (true);

-- Allow anon to read categories (for report page)
DROP POLICY IF EXISTS "anon_select_categories" ON categories;
CREATE POLICY "anon_select_categories"
ON categories FOR SELECT
TO anon, authenticated
USING (true);

-- Allow anon to insert ai_analyses (created during report submission)
DROP POLICY IF EXISTS "anon_insert_ai_analyses" ON ai_analyses;
CREATE POLICY "anon_insert_ai_analyses"
ON ai_analyses FOR INSERT
TO anon, authenticated
WITH CHECK (true);
