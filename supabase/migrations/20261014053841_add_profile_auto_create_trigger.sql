/*
# Auto-create profile on user signup

## Problem
When a user signs up via Supabase Auth, no row is created in the `profiles` table automatically.
The frontend expects `profiles` to have a row for each user (with role, full_name, etc.).
Without it, `fetchProfile()` returns null, the dashboard's `isStaff` check fails, and staff users
are kicked back to the home page.

## Changes
1. Create a `handle_new_user()` SECURITY DEFINER function that inserts a profile row
   using the new user's ID, full_name from user_metadata, and defaults for everything else.
2. Create a trigger on `auth.users` that fires AFTER INSERT to call `handle_new_user()`.
3. Backfill: insert profile rows for any existing auth.users that don't have one yet.
4. Grant the function execution to the `authenticated` and `anon` roles (trigger runs as owner).

## Security
- Function is SECURITY DEFINER so it can write to `profiles` even though the inserting
  user hasn't established a session yet (the trigger fires during the auth insert).
- The function only inserts — it never updates or deletes.
- The trigger is the only caller; no direct RPC access is needed from the API.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Backfill: create profiles for any existing auth.users missing one
INSERT INTO public.profiles (id, full_name)
  SELECT au.id, COALESCE(au.raw_user_meta_data->>'full_name', au.email)
  FROM auth.users au
  WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = au.id)
  ON CONFLICT (id) DO NOTHING;

-- Allow the trigger function to run (authenticated role needs execute for the trigger context)
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon, authenticated;
