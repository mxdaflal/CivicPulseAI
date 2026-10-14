/*
# Revoke direct RPC access to handle_new_user()

## Problem
The `handle_new_user()` SECURITY DEFINER function was granted EXECUTE to both `anon` and `authenticated`.
This means anyone — including unauthenticated users — could call it via `/rest/v1/rpc/handle_new_user`
and execute a SECURITY DEFINER function that writes to the profiles table.

## Fix
Revoke EXECUTE from `anon`, `authenticated`, and `PUBLIC` so the function can only be invoked
by the database trigger (which runs as the function owner). The trigger on `auth.users` still
works because triggers execute with the function owner's privileges regardless of role grants.
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
