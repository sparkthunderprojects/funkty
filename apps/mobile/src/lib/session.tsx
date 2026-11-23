import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Tables } from '@funkty/db';
import { supabase } from './supabase';

type Profile = Tables<'profiles'>;

type SessionState = {
  /** True until the stored session has been read from the device. */
  loading: boolean;
  session: Session | null;
  /** Null when signed out, or when the account has no profile yet. */
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<SessionState | null>(null);

/** Sign-up details are kept in user metadata so the profile can be created after email verification. */
type PendingProfile = { username?: string; birth_date?: string; country?: string };

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadProfile = useCallback(async (current: Session | null) => {
    if (!current) {
      setProfile(null);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', current.user.id)
      .maybeSingle();
    if (data) {
      setProfile(data);
      return;
    }
    // First sign-in after verification: create the profile from the sign-up details.
    // The database re-checks the age and username rules, so metadata is never trusted.
    const pending = current.user.user_metadata as PendingProfile;
    if (pending.username && pending.birth_date && pending.country) {
      const created = await supabase.rpc('create_profile', {
        p_username: pending.username,
        p_birth_date: pending.birth_date,
        p_country: pending.country,
      });
      if (!created.error) setProfile(created.data);
    }
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session);
      if (active) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      // Defer so the auth callback is never blocked by our own queries.
      setTimeout(() => void loadProfile(next), 0);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo<SessionState>(
    () => ({
      loading,
      session,
      profile,
      refreshProfile: () => loadProfile(session),
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [loading, session, profile, loadProfile],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionState {
  const value = useContext(Ctx);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
