"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import type { UserProfile } from "@/lib/types";
import { formatDate } from "@/lib/types";

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ display_name: "", username: "", bio: "", home_city: "", phone: "", instagram_url: "", tiktok_url: "", x_url: "" });

  useEffect(() => {
    const supabase = createBrowserSupabase();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) {
        const p = data as UserProfile;
        setProfile(p);
        setForm({ display_name: p.display_name || "", username: p.username || "", bio: p.bio || "", home_city: p.home_city || "", phone: p.phone || "", instagram_url: p.instagram_url || "", tiktok_url: p.tiktok_url || "", x_url: p.x_url || "" });
      }
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    const supabase = createBrowserSupabase();
    const { data } = await supabase
      .from("profiles")
      .update({ display_name: form.display_name || null, username: form.username || null, bio: form.bio || null, home_city: form.home_city || null, phone: form.phone || null, instagram_url: form.instagram_url || null, tiktok_url: form.tiktok_url || null, x_url: form.x_url || null })
      .eq("id", profile.id)
      .select("*")
      .single();
    if (data) setProfile(data as UserProfile);
    setSaving(false);
    setEditing(false);
  }

  if (loading) return (
    <div className="p-6 lg:p-8 max-w-3xl animate-pulse space-y-6">
      <div className="flex items-center gap-4"><div className="w-20 h-20 rounded-full bg-gray-200" /><div className="space-y-2"><div className="h-5 bg-gray-200 rounded w-40" /><div className="h-4 bg-gray-200 rounded w-24" /></div></div>
      {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-200 rounded-xl" />)}
    </div>
  );

  if (!profile) return null;

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Profile</h1>
          <p className="text-gray-500">Manage your SPLYT profile and preferences.</p>
        </div>
        {!editing ? (
          <button onClick={() => setEditing(true)} className="px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-black transition-colors">Edit Profile</button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="px-4 py-2 bg-white text-gray-700 text-sm font-semibold rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-ocean-500 text-white text-sm font-semibold rounded-xl hover:bg-ocean-600 transition-colors disabled:opacity-50">{saving ? "Saving..." : "Save Changes"}</button>
          </div>
        )}
      </div>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-ocean-100 flex items-center justify-center text-ocean-600 text-2xl font-bold shrink-0">
            {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" /> : (profile.display_name || profile.email)?.[0]?.toUpperCase() || "?"}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{profile.display_name || "No name set"}</h2>
            <p className="text-sm text-gray-500">{profile.email}</p>
            {profile.username && <p className="text-sm text-ocean-500 font-medium">@{profile.username}</p>}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium capitalize">{profile.role}</span>
              {profile.is_premium && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Premium</span>}
              {profile.badges?.map((badge) => <span key={badge} className="text-xs bg-ocean-50 text-ocean-600 px-2 py-0.5 rounded-full font-medium">{badge}</span>)}
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Basic Info</h3>
        <Field label="Display Name" value={form.display_name} editing={editing} onChange={(v) => setForm({ ...form, display_name: v })} />
        <Field label="Username" value={form.username} editing={editing} onChange={(v) => setForm({ ...form, username: v })} placeholder="your_username" />
        <Field label="Bio" value={form.bio} editing={editing} onChange={(v) => setForm({ ...form, bio: v })} multiline />
        <Field label="City" value={form.home_city} editing={editing} onChange={(v) => setForm({ ...form, home_city: v })} placeholder="Miami, FL" />
        <Field label="Phone" value={form.phone} editing={editing} onChange={(v) => setForm({ ...form, phone: v })} placeholder="+1 (555) 123-4567" />

        <div className="pt-4 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Social Links</h3>
          <div className="space-y-4">
            <Field label="Instagram" value={form.instagram_url} editing={editing} onChange={(v) => setForm({ ...form, instagram_url: v })} placeholder="https://instagram.com/you" />
            <Field label="TikTok" value={form.tiktok_url} editing={editing} onChange={(v) => setForm({ ...form, tiktok_url: v })} placeholder="https://tiktok.com/@you" />
            <Field label="X / Twitter" value={form.x_url} editing={editing} onChange={(v) => setForm({ ...form, x_url: v })} placeholder="https://x.com/you" />
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Account Info</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <p>Email: <span className="text-gray-900 font-medium">{profile.email}</span></p>
            <p>Referral Code: <span className="text-gray-900 font-medium">{profile.referral_code || "—"}</span></p>
            <p>Member since: <span className="text-gray-900 font-medium">{formatDate(profile.created_at)}</span></p>
            {profile.interests?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {profile.interests.map((i) => <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{i}</span>)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, editing, onChange, placeholder, multiline }: { label: string; value: string; editing: boolean; onChange: (v: string) => void; placeholder?: string; multiline?: boolean }) {
  if (!editing) return <div><p className="text-xs text-gray-400 mb-0.5">{label}</p><p className="text-sm text-gray-900">{value || <span className="text-gray-400">Not set</span>}</p></div>;
  const cls = "w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500 transition-all";
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      {multiline
        ? <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className={cls + " resize-none"} />
        : <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cls} />}
    </div>
  );
}
