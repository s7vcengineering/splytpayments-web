"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import type { UserProfile } from "@/lib/types";

export default function BusinessSettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    display_name: "",
    bio: "",
    phone: "",
    home_city: "",
    payout_method: "",
    instagram_url: "",
    tiktok_url: "",
    x_url: "",
  });

  useEffect(() => {
    const supabase = createBrowserSupabase();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) {
        const p = data as UserProfile;
        setProfile(p);
        setForm({
          display_name: p.display_name || "",
          bio: p.bio || "",
          phone: p.phone || "",
          home_city: p.home_city || "",
          payout_method: p.payout_method || "",
          instagram_url: p.instagram_url || "",
          tiktok_url: p.tiktok_url || "",
          x_url: p.x_url || "",
        });
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
      .update({
        display_name: form.display_name || null,
        bio: form.bio || null,
        phone: form.phone || null,
        home_city: form.home_city || null,
        payout_method: form.payout_method || null,
        instagram_url: form.instagram_url || null,
        tiktok_url: form.tiktok_url || null,
        x_url: form.x_url || null,
      })
      .eq("id", profile.id)
      .select("*")
      .single();
    if (data) setProfile(data as UserProfile);
    setSaving(false);
  }

  if (loading) return (
    <div className="p-6 lg:p-8 max-w-3xl animate-pulse space-y-4">
      {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-14 bg-gray-200 rounded-xl" />)}
    </div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Business Settings</h1>
          <p className="text-gray-500">Manage your business profile and payout preferences.</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-ocean-500 text-white text-sm font-semibold rounded-xl hover:bg-ocean-600 transition-colors disabled:opacity-50">
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Business Profile */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Business Profile</h3>
        <Field label="Business / Display Name" value={form.display_name} onChange={(v) => setForm({ ...form, display_name: v })} />
        <Field label="Bio / Description" value={form.bio} onChange={(v) => setForm({ ...form, bio: v })} multiline />
        <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="+1 (555) 123-4567" />
        <Field label="City / Location" value={form.home_city} onChange={(v) => setForm({ ...form, home_city: v })} placeholder="Miami, FL" />
      </section>

      {/* Payouts */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Payouts</h3>
        {profile?.stripe_connect_onboarded ? (
          <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            <div>
              <p className="text-sm font-semibold text-green-900">Stripe Connect Active</p>
              <p className="text-xs text-green-700">Payouts are set up and working.</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <div>
              <p className="text-sm font-semibold text-amber-900">Stripe Connect Not Set Up</p>
              <p className="text-xs text-amber-700">Connect your Stripe account to receive payouts.</p>
            </div>
          </div>
        )}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Preferred Payout Method</label>
          <select value={form.payout_method} onChange={(e) => setForm({ ...form, payout_method: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-900 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500">
            <option value="">Select...</option>
            <option value="stripe_connect">Stripe Connect</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="paypal">PayPal</option>
          </select>
        </div>
      </section>

      {/* Social Links */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Social Links</h3>
        <Field label="Instagram" value={form.instagram_url} onChange={(v) => setForm({ ...form, instagram_url: v })} placeholder="https://instagram.com/yourbusiness" />
        <Field label="TikTok" value={form.tiktok_url} onChange={(v) => setForm({ ...form, tiktok_url: v })} placeholder="https://tiktok.com/@yourbusiness" />
        <Field label="X / Twitter" value={form.x_url} onChange={(v) => setForm({ ...form, x_url: v })} placeholder="https://x.com/yourbusiness" />
      </section>

      {/* Account info */}
      <div className="mt-6 text-xs text-gray-400 space-y-1">
        <p>Role: <span className="capitalize">{profile?.role}</span></p>
        <p>Host Tier: <span className="capitalize">{profile?.host_tier || "New"}</span></p>
        {profile?.listing_quality_score != null && <p>Listing Quality Score: {profile.listing_quality_score}</p>}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, multiline }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean }) {
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
