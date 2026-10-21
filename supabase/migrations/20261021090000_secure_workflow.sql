-- Additive hardening. Apply to staging first; historical migrations remain unchanged.
BEGIN;
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
CREATE OR REPLACE FUNCTION public.civic_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT role FROM public.profiles WHERE id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.civic_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.civic_role() TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.civic_incident_access(target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM public.profiles p JOIN public.incidents i ON i.id=target
 WHERE p.id=auth.uid() AND (p.role IN ('admin','manager','verifier') OR
 (p.role='operator' AND (i.assigned_to=p.id OR i.assigned_department_id=p.department_id))))
$$;
REVOKE ALL ON FUNCTION public.civic_incident_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.civic_incident_access(uuid) TO authenticated;

-- Permissive policies combine with OR. Remove ALL legacy policies on these owned tables.
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT schemaname,tablename,policyname FROM pg_policies WHERE schemaname='public'
 AND tablename=ANY(ARRAY['profiles','reports','incidents','report_incident_links','ai_analyses',
 'incident_events','evidence','categories','departments','knowledge_documents','notifications'])
 LOOP EXECUTE format('DROP POLICY %I ON %I.%I',p.policyname,p.schemaname,p.tablename); END LOOP;
END $$;
REVOKE ALL ON public.profiles, public.reports, public.incidents, public.report_incident_links,
 public.ai_analyses, public.incident_events, public.evidence, public.notifications FROM anon, authenticated;
GRANT SELECT ON public.profiles, public.reports, public.incidents, public.report_incident_links,
 public.ai_analyses, public.incident_events, public.evidence, public.notifications TO authenticated;
GRANT UPDATE(full_name,phone,preferred_language,notification_prefs,updated_at) ON public.profiles TO authenticated;
GRANT UPDATE(is_read) ON public.notifications TO authenticated;
CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated USING (id=auth.uid() OR public.civic_role()='admin');
CREATE POLICY profiles_edit ON public.profiles FOR UPDATE TO authenticated USING (id=auth.uid()) WITH CHECK (id=auth.uid());
CREATE POLICY reports_read ON public.reports FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.civic_role() IN ('verifier','manager','admin'));
CREATE POLICY incidents_read ON public.incidents FOR SELECT TO authenticated USING (public.civic_incident_access(id));
CREATE POLICY links_read ON public.report_incident_links FOR SELECT TO authenticated USING (
 public.civic_incident_access(incident_id) OR EXISTS(SELECT 1 FROM public.reports r WHERE r.id=report_id AND r.user_id=auth.uid()));
CREATE POLICY analyses_read ON public.ai_analyses FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.reports r WHERE r.id=report_id));
CREATE POLICY events_read ON public.incident_events FOR SELECT TO authenticated USING(public.civic_incident_access(incident_id));
CREATE POLICY evidence_read ON public.evidence FOR SELECT TO authenticated USING(public.civic_incident_access(incident_id));
CREATE POLICY notifications_read ON public.notifications FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY notifications_edit ON public.notifications FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());

REVOKE ALL ON public.categories, public.departments, public.knowledge_documents FROM anon,authenticated;
GRANT SELECT ON public.categories, public.departments, public.knowledge_documents TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.categories, public.departments, public.knowledge_documents TO authenticated;
CREATE POLICY categories_read ON public.categories FOR SELECT USING(true);
CREATE POLICY departments_read ON public.departments FOR SELECT USING(true);
CREATE POLICY knowledge_read ON public.knowledge_documents FOR SELECT USING(is_published OR public.civic_role() IN ('manager','admin'));
CREATE POLICY categories_admin ON public.categories FOR ALL TO authenticated USING(public.civic_role()='admin') WITH CHECK(public.civic_role()='admin');
CREATE POLICY departments_admin ON public.departments FOR ALL TO authenticated USING(public.civic_role()='admin') WITH CHECK(public.civic_role()='admin');
CREATE POLICY knowledge_admin ON public.knowledge_documents FOR ALL TO authenticated USING(public.civic_role() IN ('admin','manager')) WITH CHECK(public.civic_role() IN ('admin','manager'));

-- Private bucket, strict image types, no anonymous upload or download.
UPDATE storage.buckets SET public=false, file_size_limit=5242880,
 allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp'] WHERE id='evidence';
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'evidence_%'
 LOOP EXECUTE format('DROP POLICY %I ON storage.objects',p.policyname); END LOOP;
END $$;
CREATE POLICY evidence_upload ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='evidence' AND (storage.foldername(name))[1]=auth.uid()::text
 AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp'));
CREATE POLICY evidence_download ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='evidence' AND (((storage.foldername(name))[1]=auth.uid()::text OR owner=auth.uid()) OR public.civic_role() IN ('verifier','manager','admin')
 OR EXISTS(SELECT 1 FROM public.evidence e WHERE e.file_url=name AND public.civic_incident_access(e.incident_id))));
CREATE POLICY evidence_remove ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='evidence' AND (storage.foldername(name))[1]=auth.uid()::text AND NOT EXISTS(SELECT 1 FROM public.reports r WHERE r.photo_url=name)
 AND NOT EXISTS(SELECT 1 FROM public.evidence e WHERE e.file_url=name));

ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS tracking_secret_hash text;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS submission_key uuid;
CREATE UNIQUE INDEX IF NOT EXISTS reports_submission_unique ON public.reports(submission_key) WHERE submission_key IS NOT NULL;
CREATE TABLE IF NOT EXISTS private.submission_limits (bucket text PRIMARY KEY, started_at timestamptz NOT NULL, hits int NOT NULL);
CREATE OR REPLACE FUNCTION private.consume_limit(k text, maximum int, seconds int) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE n int; BEGIN
 INSERT INTO private.submission_limits AS l VALUES(k,now(),1)
 ON CONFLICT(bucket) DO UPDATE SET hits=CASE WHEN l.started_at < now()-make_interval(secs=>seconds) THEN 1 ELSE l.hits+1 END,
 started_at=CASE WHEN l.started_at < now()-make_interval(secs=>seconds) THEN now() ELSE l.started_at END RETURNING hits INTO n;
 IF n>maximum THEN RAISE EXCEPTION 'Rate limit reached. Try again later.' USING ERRCODE='P0001'; END IF;
END $$;
REVOKE ALL ON FUNCTION private.consume_limit(text,int,int) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.submit_civic_report(payload jsonb, analysis jsonb, request_key uuid, anonymous_bucket text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.reports; owner_id uuid:=auth.uid(); secret text; category public.categories; score int; BEGIN
 analysis:=private.rule_analysis(payload);
 IF request_key IS NULL THEN RAISE EXCEPTION 'Idempotency key required'; END IF;
 IF owner_id IS NULL AND (auth.role()<>'service_role' OR anonymous_bucket IS NULL) THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT * INTO r FROM public.reports WHERE submission_key=request_key;
 IF FOUND THEN
  IF r.user_id IS DISTINCT FROM owner_id OR owner_id IS NULL THEN RAISE EXCEPTION 'Submission already saved; use your tracking details'; END IF;
  RETURN jsonb_build_object('tracking_id',r.tracking_id,'report_id',r.id);
 END IF;
 PERFORM private.consume_limit(coalesce(owner_id::text,anonymous_bucket),5,3600);
 SELECT * INTO category FROM public.categories WHERE name=payload->>'category';
 IF NOT FOUND OR length(trim(payload->>'title')) NOT BETWEEN 5 AND 150 OR length(trim(payload->>'description')) NOT BETWEEN 20 AND 2000
 OR length(trim(payload->>'locationText')) NOT BETWEEN 3 AND 300 THEN RAISE EXCEPTION 'Invalid report fields'; END IF;
 IF (payload->>'latitude') IS NOT NULL AND ((payload->>'latitude')::float8 NOT BETWEEN -90 AND 90 OR (payload->>'longitude')::float8 NOT BETWEEN -180 AND 180)
 OR ((payload->>'latitude') IS NULL) <> ((payload->>'longitude') IS NULL) THEN RAISE EXCEPTION 'Invalid coordinates'; END IF;
 IF payload->>'photoPath' IS NOT NULL AND (owner_id IS NULL OR split_part(payload->>'photoPath','/',1)<>owner_id::text
 OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='evidence' AND name=payload->>'photoPath')) THEN RAISE EXCEPTION 'Invalid evidence'; END IF;
 secret:=encode(extensions.gen_random_bytes(32),'hex');
 score:=greatest(0,least(100,coalesce((analysis->>'priority_score')::int,0)));
 INSERT INTO public.reports(tracking_id,user_id,category_id,category_name,title,description,location_text,latitude,longitude,photo_url,
 priority_score,priority_label,ai_processed,tracking_secret_hash,submission_key)
 VALUES('CP-'||upper(encode(extensions.gen_random_bytes(12),'hex')),owner_id,category.id,category.name,trim(payload->>'title'),trim(payload->>'description'),
 trim(payload->>'locationText'),(payload->>'latitude')::float8,(payload->>'longitude')::float8,payload->>'photoPath',score,
 CASE WHEN score>=80 THEN 'critical' WHEN score>=60 THEN 'high' WHEN score>=40 THEN 'medium' ELSE 'low' END,true,
 encode(extensions.digest(secret,'sha256'),'hex'),request_key) RETURNING * INTO r;
 INSERT INTO public.ai_analyses(report_id,analysis_type,suggested_category,confidence,priority_factors,priority_score,priority_label,explanation,model_version)
 VALUES(r.id,'full',analysis->>'suggested_category',NULL,analysis->'priority_factors',score,r.priority_label,analysis->>'explanation',coalesce(analysis->>'model_version','rule-based-v2'));
 IF owner_id IS NOT NULL THEN INSERT INTO public.notifications(user_id,type,title,body) VALUES(owner_id,'report_received','Report received',r.tracking_id); END IF;
 RETURN jsonb_build_object('tracking_id',r.tracking_id,'tracking_secret',secret,'report_id',r.id);
END $$;
REVOKE ALL ON FUNCTION public.submit_civic_report(jsonb,jsonb,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_civic_report(jsonb,jsonb,uuid,text) TO authenticated,service_role;

-- Capability lookup returns an explicit citizen-safe projection; never internal notes or evidence.
CREATE OR REPLACE FUNCTION public.track_civic_report(reference text, access_secret text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.reports; i public.incidents; timeline jsonb; BEGIN
 SELECT * INTO r FROM public.reports WHERE tracking_id=upper(reference) AND
 (user_id=auth.uid() OR (length(access_secret)=64 AND tracking_secret_hash=encode(extensions.digest(access_secret,'sha256'),'hex')));
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT inc.* INTO i FROM public.incidents inc JOIN public.report_incident_links l ON l.incident_id=inc.id WHERE l.report_id=r.id AND l.decision='confirmed' ORDER BY l.created_at DESC LIMIT 1;
 SELECT coalesce(jsonb_agg(jsonb_build_object('action',e.action,'old_status',e.old_status,'new_status',e.new_status,'created_at',e.created_at) ORDER BY e.created_at),'[]') INTO timeline
 FROM (SELECT * FROM public.incident_events WHERE incident_id=i.id ORDER BY created_at DESC LIMIT 100) e;
 RETURN jsonb_build_object('tracking_id',r.tracking_id,'title',r.title,'category_name',r.category_name,'status',r.status,'created_at',r.created_at,
 'incident_status',i.status,'resolved_at',i.resolved_at,'department',(SELECT name FROM public.departments WHERE id=i.assigned_department_id),'events',timeline);
END $$;
REVOKE ALL ON FUNCTION public.track_civic_report(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_civic_report(text,text) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.review_civic_report(report_id uuid, decision text, existing_incident uuid DEFAULT NULL, reason text DEFAULT '') RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.reports; target uuid; BEGIN
 IF public.civic_role() IS NULL OR public.civic_role() NOT IN ('verifier','manager','admin') THEN RAISE EXCEPTION 'Reviewer role required'; END IF;
 SELECT * INTO r FROM public.reports WHERE id=report_id FOR UPDATE;
 IF NOT FOUND OR r.status<>'submitted' THEN RAISE EXCEPTION 'Report is no longer pending'; END IF;
 IF decision IS NULL OR decision NOT IN ('verified','rejected','linked') OR (decision='rejected' AND length(trim(reason))<5) THEN RAISE EXCEPTION 'Invalid review decision or missing reason'; END IF;
 IF decision='rejected' THEN
  UPDATE public.reports SET status='rejected',updated_at=now() WHERE id=r.id;
 ELSE
  IF existing_incident IS NOT NULL THEN
   SELECT id INTO target FROM public.incidents WHERE id=existing_incident AND category_name=r.category_name AND status NOT IN ('resolved','rejected') FOR UPDATE;
   IF target IS NULL THEN RAISE EXCEPTION 'Matching open incident required'; END IF;
   UPDATE public.incidents SET report_count=report_count+1,updated_at=now() WHERE id=target;
  ELSE
   IF decision='linked' THEN RAISE EXCEPTION 'Select an existing incident'; END IF;
   INSERT INTO public.incidents(title,description,category_name,category_id,location_text,latitude,longitude,status,priority_score,priority_label,sla_deadline)
   VALUES(r.title,r.description,r.category_name,r.category_id,r.location_text,r.latitude,r.longitude,'verified',r.priority_score,r.priority_label,
   now()+make_interval(hours=>coalesce((SELECT default_sla_hours FROM public.categories WHERE id=r.category_id),72))) RETURNING id INTO target;
  END IF;
  INSERT INTO public.report_incident_links(report_id,incident_id,reviewed_by,decision) VALUES(r.id,target,auth.uid(),'confirmed');
  UPDATE public.reports SET status='linked',updated_at=now() WHERE id=r.id;
  INSERT INTO public.incident_events(incident_id,actor_id,action,new_status,notes,metadata)
  VALUES(target,auth.uid(),'report_verified',(SELECT status FROM public.incidents WHERE id=target),reason,jsonb_build_object('report_id',r.id,'linked',existing_incident IS NOT NULL));
 END IF;
 INSERT INTO private.review_audit(report_id,actor_id,decision,reason) VALUES(r.id,auth.uid(),decision,reason);
 IF r.user_id IS NOT NULL THEN INSERT INTO public.notifications(user_id,type,title,incident_id) VALUES(r.user_id,'review','Report '||decision,target); END IF;
 RETURN target;
END $$;
CREATE TABLE IF NOT EXISTS private.review_audit(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), report_id uuid,actor_id uuid,decision text,reason text,created_at timestamptz DEFAULT now());
REVOKE ALL ON FUNCTION public.review_civic_report(uuid,text,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_civic_report(uuid,text,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_civic_incident(target uuid, next_status text DEFAULT NULL, department uuid DEFAULT NULL, note text DEFAULT '', priority int DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE i public.incidents; r text:=public.civic_role(); allowed text[]; BEGIN
 IF r IS NULL OR NOT public.civic_incident_access(target) THEN RAISE EXCEPTION 'Access denied'; END IF;
 SELECT * INTO i FROM public.incidents WHERE id=target FOR UPDATE;
 IF r='verifier' THEN RAISE EXCEPTION 'Operational role required'; END IF;
 IF department IS NOT NULL AND r NOT IN ('manager','admin') THEN RAISE EXCEPTION 'Manager role required'; END IF;
 IF priority IS NOT NULL AND (r NOT IN ('manager','admin') OR priority NOT BETWEEN 0 AND 100 OR length(trim(note))<5) THEN RAISE EXCEPTION 'Priority override requires manager and reason'; END IF;
 IF next_status IS NOT NULL AND next_status<>i.status THEN
  allowed:=CASE i.status WHEN 'open' THEN ARRAY['verified','rejected'] WHEN 'verified' THEN ARRAY['assigned','in_progress','resolved','rejected']
  WHEN 'assigned' THEN ARRAY['in_progress','verified','resolved'] WHEN 'in_progress' THEN ARRAY['resolved','reopened']
  WHEN 'resolved' THEN ARRAY['reopened'] WHEN 'rejected' THEN ARRAY['open'] WHEN 'reopened' THEN ARRAY['assigned','in_progress','resolved'] ELSE ARRAY[]::text[] END;
  IF NOT next_status=ANY(allowed) THEN RAISE EXCEPTION 'Invalid status transition'; END IF;
  IF r='operator' AND next_status NOT IN ('in_progress','resolved') THEN RAISE EXCEPTION 'Manager role required'; END IF;
  IF next_status IN ('resolved','reopened','rejected') AND length(trim(note))<5 THEN RAISE EXCEPTION 'A meaningful reason is required'; END IF;
 END IF;
 IF next_status IS NULL AND department IS NULL AND priority IS NULL AND length(coalesce(trim(note),''))<5 THEN RAISE EXCEPTION 'A meaningful progress note is required'; END IF;
 IF length(note)>2000 THEN RAISE EXCEPTION 'Note too long'; END IF;
 UPDATE public.incidents SET status=coalesce(next_status,status),assigned_department_id=coalesce(department,assigned_department_id),
 department_id=coalesce(department,department_id),priority_score=coalesce(priority,priority_score),
 priority_label=CASE WHEN priority IS NULL THEN priority_label WHEN priority>=80 THEN 'critical' WHEN priority>=60 THEN 'high' WHEN priority>=40 THEN 'medium' ELSE 'low' END,
 resolved_at=CASE WHEN next_status='resolved' AND i.status<>'resolved' THEN now() WHEN next_status='reopened' AND i.status<>'reopened' THEN NULL ELSE resolved_at END,updated_at=now() WHERE id=target;
 INSERT INTO public.incident_events(incident_id,actor_id,action,old_status,new_status,notes,metadata)
 VALUES(target,auth.uid(),'operational_update',i.status,coalesce(next_status,i.status),note,jsonb_build_object('department',department,'priority_override',priority));
 INSERT INTO public.notifications(user_id,type,title,incident_id)
 SELECT DISTINCT rp.user_id,'incident_update','Incident '||coalesce(next_status,i.status),target FROM public.reports rp JOIN public.report_incident_links l ON l.report_id=rp.id WHERE l.incident_id=target AND rp.user_id IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.update_civic_incident(uuid,text,uuid,text,int) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_civic_incident(uuid,text,uuid,text,int) TO authenticated;

CREATE TABLE IF NOT EXISTS private.role_audit(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid,target_id uuid,old_role text,new_role text,created_at timestamptz DEFAULT now());
CREATE OR REPLACE FUNCTION public.set_civic_role(target uuid, new_role text, department uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old text; BEGIN
 IF public.civic_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Administrator required'; END IF;
 IF target=auth.uid() OR new_role NOT IN ('citizen','verifier','operator','manager','admin') THEN RAISE EXCEPTION 'Invalid role change'; END IF;
 SELECT role INTO old FROM public.profiles WHERE id=target FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
 UPDATE public.profiles SET role=new_role,department_id=department,updated_at=now() WHERE id=target;
 INSERT INTO private.role_audit(actor_id,target_id,old_role,new_role) VALUES(auth.uid(),target,old,new_role);
END $$;
REVOKE ALL ON FUNCTION public.set_civic_role(uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_civic_role(uuid,text,uuid) TO authenticated;

-- Explicit redaction: category-derived title, no free text, reporter identity, or precise location.
CREATE OR REPLACE VIEW public.public_incidents WITH (security_barrier=true) AS
SELECT id,category_name||' issue' AS title,category_name,status,priority_label,priority_score,
 round(latitude::numeric,2)::float8 AS latitude,round(longitude::numeric,2)::float8 AS longitude,
 created_at,resolved_at FROM public.incidents WHERE status NOT IN ('open','rejected');
REVOKE ALL ON public.public_incidents FROM PUBLIC;
GRANT SELECT ON public.public_incidents TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.civic_public_stats() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('reports',(SELECT count(*) FROM public.reports),'verified',(SELECT count(*) FROM public.incidents WHERE status IN ('verified','open')),
 'inProgress',(SELECT count(*) FROM public.incidents WHERE status IN ('assigned','in_progress')),'resolved',(SELECT count(*) FROM public.incidents WHERE status='resolved'))
$$;
REVOKE ALL ON FUNCTION public.civic_public_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.civic_public_stats() TO anon,authenticated;

-- Realtime is still subject to RLS; private tracking uses a bounded projection polling API.
DO $$ DECLARE t text; BEGIN
 IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
  FOREACH t IN ARRAY ARRAY['reports','incidents','notifications'] LOOP
   IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t);
   END IF;
  END LOOP;
 END IF;
END $$;
-- Counts run with the caller's RLS scope rather than counts from a loaded page.
CREATE OR REPLACE FUNCTION public.civic_staff_stats() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('pending',(SELECT count(*) FROM public.reports WHERE status='submitted'),
 'open',(SELECT count(*) FROM public.incidents WHERE status='open'),'verified',(SELECT count(*) FROM public.incidents WHERE status='verified'),
 'inProgress',(SELECT count(*) FROM public.incidents WHERE status IN ('assigned','in_progress')),'resolved',(SELECT count(*) FROM public.incidents WHERE status='resolved'),
 'overdue',(SELECT count(*) FROM public.incidents WHERE sla_deadline<now() AND status NOT IN ('resolved','rejected')))
$$;
REVOKE ALL ON FUNCTION public.civic_staff_stats() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.civic_staff_stats() TO authenticated;
CREATE OR REPLACE FUNCTION public.civic_ai_permit() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
PERFORM private.consume_limit('ai:'||auth.uid()::text,10,3600); END $$;
REVOKE ALL ON FUNCTION public.civic_ai_permit() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.civic_ai_permit() TO authenticated;
CREATE OR REPLACE FUNCTION private.rule_analysis(payload jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE text_value text:=lower((payload->>'title')||' '||(payload->>'description')||' '||(payload->>'locationText')); u int; impact int; v int; score int; BEGIN
 SELECT least(100,30+20*count(*)) INTO u FROM unnest(ARRAY['urgent','emergency','danger','immediate','critical','serious','severe','safety','hazard','risk']) k WHERE strpos(text_value,k)>0;
 SELECT least(100,30+20*count(*)) INTO impact FROM unnest(ARRAY['many','everyone','whole','entire','all','community','neighborhood','street','families','children']) k WHERE strpos(text_value,k)>0;
 SELECT least(100,25*count(*)) INTO v FROM unnest(ARRAY['school','hospital','elderly','children','disability','disabled','clinic','pregnant','low income','slum']) k WHERE strpos(text_value,k)>0;
 score:=round(.4*u+.3*impact+.1*v);
 RETURN jsonb_build_object('suggested_category',payload->>'category','priority_factors',jsonb_build_object('urgency',u,'impact',impact,'recurrence',0,'vulnerability',v),
 'priority_score',score,'explanation','Rule-based text signals, not model inference. Urgency and impact include an assumed baseline of 30. Recurrence is unknown (zero contribution). Vulnerability is an unverified text signal. Review before acting.','model_version','rule-based-v2');
END $$;
REVOKE ALL ON FUNCTION private.rule_analysis(jsonb) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.civic_public_analytics() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('stats',public.civic_public_stats(),
 'categories',(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT category_name AS name,count(*) AS count FROM public.incidents WHERE status NOT IN ('open','rejected') GROUP BY category_name) x),
 'statuses',(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT status AS name,count(*) AS count FROM public.incidents WHERE status NOT IN ('open','rejected') GROUP BY status) x),
 'trends',(SELECT coalesce(jsonb_agg(x ORDER BY day),'[]') FROM (SELECT d::date AS day,(SELECT count(*) FROM public.reports WHERE created_at>=d AND created_at<d+interval '1 day') AS reports,
 (SELECT count(*) FROM public.incidents WHERE created_at>=d AND created_at<d+interval '1 day' AND status NOT IN ('open','rejected')) AS incidents FROM generate_series(date_trunc('day',now())-interval '13 days',date_trunc('day',now()),interval '1 day') d) x),
 'average_resolution_hours',(SELECT round(avg(extract(epoch FROM (resolved_at-created_at))/3600)::numeric,1) FROM public.incidents WHERE status='resolved' AND resolved_at>=created_at),
 'hotspots',(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT round(latitude::numeric,2) AS latitude,round(longitude::numeric,2) AS longitude,count(*) AS count FROM public.incidents
 WHERE status NOT IN ('open','rejected') AND created_at>now()-interval '90 days' AND latitude IS NOT NULL GROUP BY 1,2 HAVING count(*)>=3 ORDER BY count(*) DESC LIMIT 10) x))
$$;
REVOKE ALL ON FUNCTION public.civic_public_analytics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.civic_public_analytics() TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.attach_civic_evidence(target uuid,path text,description text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF public.civic_role() NOT IN ('operator','manager','admin') OR NOT public.civic_incident_access(target) THEN RAISE EXCEPTION 'Operational role required'; END IF;
 IF split_part(path,'/',1)<>auth.uid()::text OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='evidence' AND name=path) OR description IS NULL OR length(description) NOT BETWEEN 5 AND 1000 THEN RAISE EXCEPTION 'Invalid evidence'; END IF;
 INSERT INTO public.evidence(incident_id,uploaded_by,file_url,description) VALUES(target,auth.uid(),path,description);
 INSERT INTO public.incident_events(incident_id,actor_id,action,notes) VALUES(target,auth.uid(),'resolution_evidence_added',description);
END $$;
REVOKE ALL ON FUNCTION public.attach_civic_evidence(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.attach_civic_evidence(uuid,text,text) TO authenticated;

-- Reference data only; never fabricated incidents or departments.
INSERT INTO public.categories(name,slug,icon,color,description) VALUES
('Water Supply','water-supply','Droplets','#0ea5e9','Water interruptions and leaks'),
('Garbage Overflow','garbage-overflow','Trash2','#16a34a','Waste and collection issues'),
('Damaged Road','damaged-road','Construction','#f59e0b','Potholes and damaged roads'),
('Drainage Problem','drainage-problem','Waves','#06b6d4','Blocked drains and flooding'),
('Streetlight Failure','streetlight-failure','Lightbulb','#8b5cf6','Lighting failures'),
('Public Transport','public-transport','Bus','#ec4899','Transport service issues') ON CONFLICT(name) DO NOTHING;
NOTIFY pgrst, 'reload schema';
COMMIT;
