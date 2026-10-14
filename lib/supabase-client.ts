import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  description: string;
  default_sla_hours: number;
  department_id: string | null;
};

export type Report = {
  id: string;
  tracking_id: string;
  user_id: string;
  category_id: string | null;
  category_name: string;
  title: string;
  description: string;
  location_text: string;
  latitude: number | null;
  longitude: number | null;
  photo_url: string | null;
  status: 'submitted' | 'verified' | 'linked' | 'rejected';
  priority_score: number;
  priority_label: string;
  ai_processed: boolean;
  created_at: string;
  updated_at: string;
};

export type Incident = {
  id: string;
  title: string;
  description: string | null;
  category_name: string;
  category_id: string | null;
  department_id: string | null;
  location_text: string;
  latitude: number | null;
  longitude: number | null;
  status: 'open' | 'verified' | 'assigned' | 'in_progress' | 'resolved' | 'rejected' | 'reopened';
  priority_score: number;
  priority_label: string;
  assigned_to: string | null;
  assigned_department_id: string | null;
  report_count: number;
  sla_deadline: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AIAnalysis = {
  id: string;
  report_id: string;
  analysis_type: string;
  suggested_category: string | null;
  confidence: number | null;
  duplicate_candidates: any[];
  priority_factors: Record<string, number>;
  priority_score: number;
  priority_label: string | null;
  explanation: string | null;
  model_version: string;
  created_at: string;
};

export type IncidentEvent = {
  id: string;
  incident_id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  old_status: string | null;
  new_status: string | null;
  notes: string | null;
  metadata: Record<string, any>;
  created_at: string;
};

export type Department = {
  id: string;
  name: string;
  description: string | null;
};

export type KnowledgeDocument = {
  id: string;
  title: string;
  category: string | null;
  content: string;
  source: string | null;
  tags: string[];
  is_published: boolean;
  created_at: string;
};

export type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  role: 'citizen' | 'verifier' | 'operator' | 'manager' | 'admin' | 'staff';
  department_id: string | null;
  preferred_language: string;
  notification_prefs: { email: boolean; push: boolean };
  created_at: string;
  updated_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  incident_id: string | null;
  is_read: boolean;
  created_at: string;
};
