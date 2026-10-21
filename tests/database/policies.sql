\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.assert(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF; RAISE NOTICE 'PASS: %',label; END $$;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
('10000000-0000-4000-8000-000000000001','citizen1@example.invalid','{"role":"admin","full_name":"Test citizen"}'),
('10000000-0000-4000-8000-000000000002','citizen2@example.invalid','{}'),
('10000000-0000-4000-8000-000000000003','verifier@example.invalid','{}'),
('10000000-0000-4000-8000-000000000004','manager@example.invalid','{}'),
('10000000-0000-4000-8000-000000000005','operator@example.invalid','{}');
UPDATE public.profiles SET role='verifier' WHERE id='10000000-0000-4000-8000-000000000003';
UPDATE public.profiles SET role='manager' WHERE id='10000000-0000-4000-8000-000000000004';
UPDATE public.profiles SET role='operator' WHERE id='10000000-0000-4000-8000-000000000005';
SELECT pg_temp.assert((SELECT role='citizen' FROM profiles WHERE id='10000000-0000-4000-8000-000000000001'),'signup metadata cannot select admin role');
INSERT INTO storage.objects(bucket_id,name,owner) VALUES('evidence','10000000-0000-4000-8000-000000000001/private.jpg','10000000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true),set_config('request.jwt.claim.role','authenticated',true);
DO $$ DECLARE result jsonb; BEGIN
 result:=public.submit_civic_report('{"category":"Drainage Problem","title":"Drain blocked near school","description":"Urgent blocked drain floods the whole street near the school","locationText":"Test public library","latitude":10.8,"longitude":78.7}', '{"priority_score":100,"model_version":"fake"}', '20000000-0000-4000-8000-000000000001');
 PERFORM set_config('test.reference',result->>'tracking_id',true);PERFORM set_config('test.secret',result->>'tracking_secret',true);PERFORM set_config('test.report',result->>'report_id',true);
END $$;
SELECT pg_temp.assert((SELECT count(*)=1 FROM reports),'owner can read saved report');
SELECT pg_temp.assert((SELECT model_version='rule-based-v2' FROM ai_analyses),'client cannot forge model provenance or priority analysis');
SELECT pg_temp.assert((SELECT confidence IS NULL FROM ai_analyses),'heuristic has no fabricated probability');
DO $$ BEGIN
 BEGIN UPDATE profiles SET role='admin' WHERE id=auth.uid(); RAISE EXCEPTION 'FAIL: role escalation accepted'; EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: citizen role escalation denied'; END;
 BEGIN INSERT INTO profiles(id,full_name,role) VALUES(auth.uid(),'Attacker','admin'); RAISE EXCEPTION 'FAIL: role insert accepted'; EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: citizen profile insertion denied'; END;
 BEGIN UPDATE reports SET status='verified'; RAISE EXCEPTION 'FAIL: citizen changed report status'; EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: citizen report mutation denied'; END;
 BEGIN PERFORM review_civic_report(current_setting('test.report')::uuid,'verified'); RAISE EXCEPTION 'FAIL: citizen verified report'; EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; RAISE NOTICE 'PASS: citizen verification denied'; END;
END $$;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
SELECT pg_temp.assert((SELECT count(*)=0 FROM reports),'another citizen cannot enumerate reports');
SELECT pg_temp.assert((SELECT count(*)=0 FROM ai_analyses),'another citizen cannot enumerate analyses');
SELECT pg_temp.assert(track_civic_report(current_setting('test.reference'),'') IS NULL,'a reference alone does not unlock another report');
SELECT pg_temp.assert(track_civic_report(current_setting('test.reference'),current_setting('test.secret')) IS NOT NULL,'correct tracking capability returns a redacted summary');
SELECT pg_temp.assert(NOT (track_civic_report(current_setting('test.reference'),current_setting('test.secret')) ?| ARRAY['description','latitude','longitude','user_id','photo_url']),'tracking projection omits sensitive fields');
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
DO $$ DECLARE target uuid;BEGIN target:=review_civic_report(current_setting('test.report')::uuid,'verified');PERFORM set_config('test.incident',target::text,true);END $$;
SELECT pg_temp.assert((SELECT count(*)=1 FROM incidents),'verifier creates exactly one incident');
SELECT pg_temp.assert((SELECT count(*)=1 FROM incident_events),'verification records audit event atomically');
DO $$ BEGIN
 BEGIN DELETE FROM incident_events;RAISE EXCEPTION 'FAIL: audit deletion accepted';EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: audit deletion denied';END;
 BEGIN PERFORM review_civic_report(current_setting('test.report')::uuid,'verified');RAISE EXCEPTION 'FAIL: double verification accepted';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE;END IF;RAISE NOTICE 'PASS: double verification prevented';END;
END $$;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',true);
SELECT pg_temp.assert((SELECT count(*)=0 FROM incidents),'unassigned operator cannot read incident');
DO $$ BEGIN
 BEGIN PERFORM update_civic_incident(current_setting('test.incident')::uuid,'resolved',NULL,'Pretend repair');RAISE EXCEPTION 'FAIL: unassigned operator updated incident';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE;END IF;RAISE NOTICE 'PASS: unassigned operator update denied';END;
END $$;
RESET ROLE;
INSERT INTO departments(id,name) VALUES('30000000-0000-4000-8000-000000000001','Demo Drainage Team');
UPDATE profiles SET department_id='30000000-0000-4000-8000-000000000001' WHERE id='10000000-0000-4000-8000-000000000005';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',true);
SELECT update_civic_incident(current_setting('test.incident')::uuid,'assigned','30000000-0000-4000-8000-000000000001','Assigned to demo team');
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',true);
SELECT update_civic_incident(current_setting('test.incident')::uuid,'in_progress',NULL,'Demo team began investigation');
DO $$ BEGIN
 BEGIN PERFORM update_civic_incident(current_setting('test.incident')::uuid,'resolved',NULL,'');RAISE EXCEPTION 'FAIL: resolution without reason accepted';EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE;END IF;RAISE NOTICE 'PASS: resolution requires reason';END;
END $$;
SELECT update_civic_incident(current_setting('test.incident')::uuid,'resolved',NULL,'Demo resolution recorded with explanation');
SELECT pg_temp.assert((SELECT count(*)=4 FROM incident_events),'complete workflow retains four audit events');
SELECT pg_temp.assert((SELECT resolved_at IS NOT NULL FROM incidents),'resolution timestamp persisted');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claim.role','anon',true);
DO $$ BEGIN
 BEGIN PERFORM * FROM reports;RAISE EXCEPTION 'FAIL: anonymous report enumeration accepted';EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: anonymous report enumeration denied';END;
 BEGIN PERFORM * FROM ai_analyses;RAISE EXCEPTION 'FAIL: anonymous analysis enumeration accepted';EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: anonymous analysis enumeration denied';END;
 BEGIN PERFORM * FROM incident_events;RAISE EXCEPTION 'FAIL: anonymous audit enumeration accepted';EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: anonymous audit enumeration denied';END;
END $$;
SELECT pg_temp.assert((SELECT count(*)=0 FROM storage.objects),'anonymous private evidence access denied');
SELECT pg_temp.assert((SELECT count(*)=1 FROM public_incidents),'redacted public transparency remains available');
SELECT pg_temp.assert((civic_public_stats()->>'resolved')::int=1,'public statistics reflect stored resolution');
SELECT pg_temp.assert(track_civic_report(current_setting('test.reference'),'') IS NULL,'anonymous reference-only tracking denied');
SELECT pg_temp.assert(track_civic_report(current_setting('test.reference'),current_setting('test.secret'))->>'incident_status'='resolved','capability tracking sees persisted resolution');
SELECT pg_temp.assert(jsonb_array_length(track_civic_report(current_setting('test.reference'),current_setting('test.secret'))->'events')=4,'citizen timeline contains real workflow events');
ROLLBACK;
