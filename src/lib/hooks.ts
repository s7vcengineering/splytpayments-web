"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserSupabase } from "./supabase";
import type { UserProfile } from "./types";

const supabase = createBrowserSupabase();

/** Current authenticated user profile */
export function useProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    if (data) setProfile(data as UserProfile);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  return { profile, loading, refresh, setProfile };
}

/** Generic Supabase query hook */
export function useQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  deps: any[] = [],
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await queryFn();
    if (error) setError(error.message);
    else setData(data);
    setLoading(false);
  }, deps);

  useEffect(() => { refresh(); }, [refresh]);
  return { data, loading, error, refresh, setData };
}

export { supabase };
