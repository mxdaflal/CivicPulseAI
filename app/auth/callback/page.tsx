'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Activity } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Wait briefly for the profile trigger to complete, then redirect
        await new Promise((r) => setTimeout(r, 500));
        router.replace(redirect);
      } else {
        router.replace('/login');
      }
    })();
  }, [router, redirect]);

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy text-white">
        <Activity className="h-6 w-6" />
      </div>
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-muted-foreground">Completing sign in...</p>
    </div>
  );
}
