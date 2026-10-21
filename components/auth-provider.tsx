"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, type Profile } from "@/lib/supabase-client";
type AuthState = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};
const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [session, setSession] = useState<Session | null>(null),
    [profile, setProfile] = useState<Profile | null>(null),
    [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const refreshProfile = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setProfile(null);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    setProfile(data as Profile | null);
  }, []);
  useEffect(() => {
    let active = true;
    const sync = async (next: Session | null) => {
      const current = ++generation.current;
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();
        if (!active || current !== generation.current) return;
        if (error || !user) {
          setUser(null);
          setSession(null);
          setProfile(null);
          return;
        }
        setUser(user);
        setSession(next);
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        if (active && current === generation.current)
          setProfile(data as Profile | null);
      } catch {
        if (active && current === generation.current) {
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (active && current === generation.current) setLoading(false);
      }
    };
    // Defer queries outside the Auth callback to avoid the auth client's session lock.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setTimeout(() => {
        if (active) void sync(next);
      }, 0);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    ++generation.current;
    setUser(null);
    setSession(null);
    setProfile(null);
  };
  return (
    <AuthContext.Provider
      value={{ user, session, profile, loading, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
