/*
# Seed reference data: departments, categories, knowledge documents

1. Purpose
   The schema already exists, but all tables are empty. This migration inserts
   the reference (setup) data the app needs before anyone can report or track
   a problem. It does NOT create fake user content — only the building blocks
   that ship with the product.

2. What gets inserted
   - `departments` (6 rows): the municipal units that handle each problem type
     (Water Supply, Sanitation & Waste Management, Roads & Infrastructure,
     Drainage & Sewerage, Street Lighting & Electrical, Public Transport).
   - `categories` (6 rows): the six report categories shown in the app's
     menus and cards, each linked to its department. Icon names and colors
     match the app's built-in category settings so the UI renders correctly:
       * Water Supply          (Droplets,     sky blue)
       * Garbage Overflow      (Trash2,       green)
       * Damaged Road          (Construction, amber)
       * Drainage Problem      (Waves,        cyan)
       * Streetlight Failure   (Lightbulb,    violet)
       * Public Transport      (Bus,          pink)
     Each category gets a sensible default SLA in hours.
   - `knowledge_documents` (6 rows): short, published help articles so the
     public knowledge page has real content on first load.

3. Security
   - No RLS changes. Existing policies already allow public read of these
     tables; no grants are modified.

4. Idempotency
   - Inserts are skipped for rows that already exist (departments and
     categories by name, knowledge articles by title), so re-running is
     safe and existing data is never modified or duplicated.
*/

INSERT INTO departments (name, description)
SELECT v.name, v.description
FROM (VALUES
  ('Water Supply Department', 'Pipelines, water tankers, supply interruptions and water quality'),
  ('Sanitation & Waste Management', 'Garbage collection, overflowing bins, littering and waste disposal'),
  ('Roads & Infrastructure', 'Potholes, damaged roads, footpaths and public works'),
  ('Drainage & Sewerage', 'Blocked drains, waterlogging and sewer overflows'),
  ('Street Lighting & Electrical', 'Streetlights, electrical faults and public lighting'),
  ('Public Transport Authority', 'Buses, stops, timetables and public transit services')
) AS v(name, description)
WHERE NOT EXISTS (SELECT 1 FROM departments d WHERE d.name = v.name);

INSERT INTO categories (name, slug, icon, color, description, default_sla_hours, department_id)
SELECT v.name, v.slug, v.icon, v.color, v.description, v.sla, d.id
FROM (VALUES
  ('Water Supply',        'water-supply',        'Droplets',     '#0ea5e9', 'No water, leaks, low pressure or contaminated supply', 24, 'Water Supply Department'),
  ('Garbage Overflow',    'garbage-overflow',    'Trash2',       '#16a34a', 'Overflowing bins, uncollected garbage and waste piles', 48, 'Sanitation & Waste Management'),
  ('Damaged Road',        'damaged-road',        'Construction', '#f59e0b', 'Potholes, cracks, broken footpaths and road hazards', 72, 'Roads & Infrastructure'),
  ('Drainage Problem',    'drainage-problem',    'Waves',        '#06b6d4', 'Blocked drains, waterlogging and sewer overflow', 48, 'Drainage & Sewerage'),
  ('Streetlight Failure', 'streetlight-failure', 'Lightbulb',    '#8b5cf6', 'Dark streets, flickering or broken streetlights', 24, 'Street Lighting & Electrical'),
  ('Public Transport',    'public-transport',    'Bus',          '#ec4899', 'Bus route issues, broken stops and transit problems', 72, 'Public Transport Authority')
) AS v(name, slug, icon, color, description, sla, dept_name)
JOIN departments d ON d.name = v.dept_name
WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.name = v.name);

INSERT INTO knowledge_documents (title, category, content, source, tags, is_published)
SELECT v.title, v.category, v.content, v.source, v.tags::text[], v.published
FROM (VALUES
  ('How to report a civic issue', 'Getting Started',
   'Open the Report page, choose the category that best matches the problem, describe what you see, and add the location. A photo helps staff verify faster. Once submitted you receive a tracking ID to follow progress.',
   'Civic Pulse AI Help Center', ARRAY['reporting','how-to','guide'], true),
  ('Understanding tracking IDs', 'Tracking',
   'Every accepted report gets a unique tracking ID like CP-2026-000001. Save it or bookmark the confirmation page. Anyone with the tracking ID can follow the status on the Track page without signing in.',
   'Civic Pulse AI Help Center', ARRAY['tracking','id'], true),
  ('What happens after I submit', 'Process',
   'Your report is first screened by the AI assistant, which checks for duplicates and suggests a category and priority. A staff member then verifies it. Verified reports are grouped into incidents and routed to the responsible department.',
   'Civic Pulse AI Help Center', ARRAY['process','ai','workflow'], true),
  ('Report a water supply problem', 'Water Supply',
   'For no water, leaks, or low pressure, report under Water Supply. Note whether neighbors are affected — widespread issues are prioritized. Supply must be restored within 24 hours under the standard service agreement.',
   'Water Supply Department', ARRAY['water','sla'], true),
  ('When will my streetlight be fixed?', 'Streetlight Failure',
   'Streetlight failures are treated as high priority because dark streets are a safety risk. The target repair time is 24 hours from verification. If several lights on one street are out, mention it in the description.',
   'Street Lighting & Electrical', ARRAY['streetlight','safety'], true),
  ('Sign in as a staff member', 'For Staff',
   'Municipal staff sign in through the staff portal. Staff can verify incoming reports, group them into incidents, assign departments, upload resolution evidence, and track SLA deadlines from the staff dashboard.',
   'Civic Pulse AI Help Center', ARRAY['staff','portal','workflow'], true)
) AS v(title, category, content, source, tags, published)
WHERE NOT EXISTS (SELECT 1 FROM knowledge_documents kd WHERE kd.title = v.title);
