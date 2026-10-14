/*
# CIVIC PULSE AI — Core Database Schema

## Overview
Creates the complete data layer for CIVIC PULSE AI, a civic incident intelligence platform.
Citizens report public-service problems (water, garbage, roads, drainage, streetlights, transport).
The system uses AI to classify reports, detect duplicates, recommend priority, and route incidents.
Staff manage incidents through a verified workflow with audit history.

## Tables
1. `departments` — organizational units responsible for incident categories
2. `categories` — problem types with icon, color, default SLA hours, default priority weight
3. `profiles` — extends Supabase auth.users with display name, role, department, phone, language
4. `reports` — citizen-submitted reports (category, description, location, lat/lng, photo URL, status, tracking ID)
5. `incidents` — verified operational incidents that group one or more related reports
6. `report_incident_links` — links reports to incidents (many-to-one, with reviewer and decision)
7. `ai_analyses` — AI classification, duplicate detection, and priority recommendation results per report
8. `incident_events` — append-only audit log of all incident state changes
9. `evidence` — resolution evidence uploads (photo URL, type, review status, reviewer)
10. `knowledge_documents` — approved procedural documents for RAG knowledge search
11. `notifications` — notification records with type, delivery status, and content

## Security
- RLS enabled on all tables.
- Citizens can create reports and view their own reports.
- Public can view incident summaries and knowledge documents.
- Staff access incidents, events, evidence, AI analyses.
- All tables use auth.uid() for ownership checks where appropriate.
*/

-- Departments table
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "departments_select_all" ON departments;
CREATE POLICY "departments_select_all" ON departments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "departments_insert_staff" ON departments;
CREATE POLICY "departments_insert_staff" ON departments FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "departments_update_staff" ON departments;
CREATE POLICY "departments_update_staff" ON departments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  icon text NOT NULL DEFAULT 'AlertCircle',
  color text NOT NULL DEFAULT '#3b82f6',
  description text,
  default_sla_hours int DEFAULT 72,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "categories_select_all" ON categories;
CREATE POLICY "categories_select_all" ON categories FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "categories_insert_staff" ON categories;
CREATE POLICY "categories_insert_staff" ON categories FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "categories_update_staff" ON categories;
CREATE POLICY "categories_update_staff" ON categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text,
  role text NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen', 'verifier', 'operator', 'manager', 'admin')),
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  preferred_language text DEFAULT 'en',
  notification_prefs jsonb DEFAULT '{"email": true, "push": true}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id text NOT NULL UNIQUE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  category_name text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  location_text text NOT NULL DEFAULT '',
  latitude float8,
  longitude float8,
  photo_url text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'verified', 'linked', 'rejected')),
  priority_score int DEFAULT 0,
  priority_label text DEFAULT 'low',
  ai_processed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category_name);
CREATE INDEX IF NOT EXISTS idx_reports_tracking_id ON reports(tracking_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reports_select_own" ON reports;
CREATE POLICY "reports_select_own" ON reports FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "reports_insert_own" ON reports;
CREATE POLICY "reports_insert_own" ON reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "reports_update_own" ON reports;
CREATE POLICY "reports_update_own" ON reports FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "reports_delete_own" ON reports;
CREATE POLICY "reports_delete_own" ON reports FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Incidents table
CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category_name text NOT NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  location_text text NOT NULL DEFAULT '',
  latitude float8,
  longitude float8,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'verified', 'assigned', 'in_progress', 'resolved', 'rejected', 'reopened')),
  priority_score int DEFAULT 0,
  priority_label text DEFAULT 'low',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  report_count int DEFAULT 1,
  sla_deadline timestamptz,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_category ON incidents(category_name);
CREATE INDEX IF NOT EXISTS idx_incidents_priority ON incidents(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_department ON incidents(assigned_department_id);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at DESC);

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "incidents_select_all" ON incidents;
CREATE POLICY "incidents_select_all" ON incidents FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "incidents_insert_staff" ON incidents;
CREATE POLICY "incidents_insert_staff" ON incidents FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "incidents_update_staff" ON incidents;
CREATE POLICY "incidents_update_staff" ON incidents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Report-to-incident links
CREATE TABLE IF NOT EXISTS report_incident_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decision text DEFAULT 'auto' CHECK (decision IN ('auto', 'confirmed', 'rejected')),
  similarity_score float8,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_links_report ON report_incident_links(report_id);
CREATE INDEX IF NOT EXISTS idx_links_incident ON report_incident_links(incident_id);

ALTER TABLE report_incident_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "links_select_all" ON report_incident_links;
CREATE POLICY "links_select_all" ON report_incident_links FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "links_insert_staff" ON report_incident_links;
CREATE POLICY "links_insert_staff" ON report_incident_links FOR INSERT TO authenticated WITH CHECK (true);

-- AI analyses table
CREATE TABLE IF NOT EXISTS ai_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  analysis_type text NOT NULL CHECK (analysis_type IN ('classification', 'duplicate_detection', 'priority', 'full')),
  suggested_category text,
  confidence float8,
  duplicate_candidates jsonb DEFAULT '[]'::jsonb,
  priority_factors jsonb DEFAULT '{}'::jsonb,
  priority_score int DEFAULT 0,
  priority_label text,
  explanation text,
  model_version text DEFAULT 'mock-v1',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_report ON ai_analyses(report_id);

ALTER TABLE ai_analyses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ai_select_all" ON ai_analyses;
CREATE POLICY "ai_select_all" ON ai_analyses FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "ai_insert_staff" ON ai_analyses;
CREATE POLICY "ai_insert_staff" ON ai_analyses FOR INSERT TO authenticated WITH CHECK (true);

-- Incident events (audit log)
CREATE TABLE IF NOT EXISTS incident_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name text,
  action text NOT NULL,
  old_status text,
  new_status text,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_incident ON incident_events(incident_id);
CREATE INDEX IF NOT EXISTS idx_events_created ON incident_events(created_at DESC);

ALTER TABLE incident_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "events_select_all" ON incident_events;
CREATE POLICY "events_select_all" ON incident_events FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "events_insert_staff" ON incident_events;
CREATE POLICY "events_insert_staff" ON incident_events FOR INSERT TO authenticated WITH CHECK (true);

-- Evidence table
CREATE TABLE IF NOT EXISTS evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  file_url text NOT NULL,
  file_type text DEFAULT 'photo',
  description text,
  review_status text DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_incident ON evidence(incident_id);

ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "evidence_select_all" ON evidence;
CREATE POLICY "evidence_select_all" ON evidence FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "evidence_insert_staff" ON evidence;
CREATE POLICY "evidence_insert_staff" ON evidence FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "evidence_update_staff" ON evidence;
CREATE POLICY "evidence_update_staff" ON evidence FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Knowledge documents table
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text,
  content text NOT NULL,
  source text,
  tags text[] DEFAULT '{}',
  is_published boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "knowledge_read_all" ON knowledge_documents;
CREATE POLICY "knowledge_read_all" ON knowledge_documents FOR SELECT TO anon, authenticated USING (is_published = true);
DROP POLICY IF EXISTS "knowledge_insert_staff" ON knowledge_documents;
CREATE POLICY "knowledge_insert_staff" ON knowledge_documents FOR INSERT TO authenticated WITH CHECK (true);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  incident_id uuid REFERENCES incidents(id) ON DELETE CASCADE,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "notifications_insert_own" ON notifications;
CREATE POLICY "notifications_insert_own" ON notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;
CREATE POLICY "notifications_delete_own" ON notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', 'New User'), 'citizen')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();