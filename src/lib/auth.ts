import { useEffect, useState } from 'react';
import { supabase, setSessionOnly } from './supabase';
import type { Session } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'owner' | 'staff';
}

export async function login(email: string, password: string, keepSignedIn = true): Promise<{ ok: boolean; error?: string }> {
  // Configure persistence BEFORE signing in so the session is written to the right storage.
  setSessionOnly(!keepSignedIn);
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function logout() {
  await supabase.auth.signOut();
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data as Profile;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null | undefined>(undefined); // undefined = loading
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) { setProfile(null); return; }
    getProfile(session.user.id).then(setProfile);
  }, [session?.user?.id]);

  return {
    session,
    profile,
    isLoading: session === undefined,
    isAuthenticated: !!session,
    isOwner: profile?.role === 'owner',
  };
}
