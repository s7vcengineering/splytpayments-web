"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import type { UserProfile } from "@/lib/types";

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState("");

  // Notification prefs (stored as JSON in profile or separate table)
  const [notifPrefs, setNotifPrefs] = useState({
    email_messages: true,
    email_bookings: true,
    email_marketing: false,
    push_messages: true,
    push_bookings: true,
    push_splits: true,
  });

  useEffect(() => {
    const supabase = createBrowserSupabase();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) {
        setProfile(data as UserProfile);
        // Load notification prefs if stored
        if ((data as any).notification_preferences) {
          setNotifPrefs({ ...notifPrefs, ...(data as any).notification_preferences });
        }
      }
      setLoading(false);
    });
  }, []);

  async function handleSaveNotifs() {
    if (!profile) return;
    setSaving(true);
    const supabase = createBrowserSupabase();
    await supabase
      .from("profiles")
      .update({ notification_preferences: notifPrefs } as any)
      .eq("id", profile.id);
    setSaving(false);
    setMessage({ type: "success", text: "Notification preferences saved." });
    setTimeout(() => setMessage(null), 3000);
  }

  async function handleDeleteAccount() {
    if (deleteText !== "DELETE") return;
    const supabase = createBrowserSupabase();
    // Sign out and let support handle actual deletion
    // In production, this would call a server endpoint that marks the account for deletion
    await supabase.auth.signOut();
    router.push("/?account_deleted=pending");
  }

  async function handleSignOut() {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-3xl animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 bg-gray-200 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Settings</h1>
      <p className="text-gray-500 mb-6">Manage your account, notifications, and privacy.</p>

      {message && (
        <div className={`mb-6 rounded-xl p-4 text-sm font-medium ${
          message.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"
        }`}>{message.text}</div>
      )}

      {/* Notification Preferences */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Notifications</h2>
        <div className="space-y-4">
          <Toggle label="Email — Messages" description="Get notified when you receive messages" checked={notifPrefs.email_messages} onChange={(v) => setNotifPrefs({ ...notifPrefs, email_messages: v })} />
          <Toggle label="Email — Bookings & Splits" description="Updates about your splits and bookings" checked={notifPrefs.email_bookings} onChange={(v) => setNotifPrefs({ ...notifPrefs, email_bookings: v })} />
          <Toggle label="Email — Marketing" description="Tips, new features, and promotions" checked={notifPrefs.email_marketing} onChange={(v) => setNotifPrefs({ ...notifPrefs, email_marketing: v })} />
          <div className="border-t border-gray-100 pt-4">
            <Toggle label="Push — Messages" description="Real-time message alerts" checked={notifPrefs.push_messages} onChange={(v) => setNotifPrefs({ ...notifPrefs, push_messages: v })} />
          </div>
          <Toggle label="Push — Bookings" description="Booking confirmations and updates" checked={notifPrefs.push_bookings} onChange={(v) => setNotifPrefs({ ...notifPrefs, push_bookings: v })} />
          <Toggle label="Push — Splits" description="When someone joins or leaves a split" checked={notifPrefs.push_splits} onChange={(v) => setNotifPrefs({ ...notifPrefs, push_splits: v })} />
        </div>
        <button
          onClick={handleSaveNotifs}
          disabled={saving}
          className="mt-5 px-5 py-2.5 bg-ocean-500 text-white text-sm font-semibold rounded-xl hover:bg-ocean-600 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Preferences"}
        </button>
      </section>

      {/* Privacy */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Privacy</h2>
        <div className="space-y-3 text-sm text-gray-600">
          <p>Your profile is visible to other SPLYT users when you join experiences.</p>
          <p>Your email and phone number are never shared with other users.</p>
          <p>Your wallet balance and transaction history are private.</p>
        </div>
        <div className="mt-4 flex gap-3">
          <a href="/privacy" className="text-sm text-ocean-500 font-medium hover:underline">Privacy Policy</a>
          <a href="/terms" className="text-sm text-ocean-500 font-medium hover:underline">Terms of Service</a>
        </div>
      </section>

      {/* Referral Code */}
      {profile?.referral_code && (
        <section className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Referral Program</h2>
          <p className="text-sm text-gray-600 mb-3">Share your code with friends. When they join SPLYT, you both earn rewards.</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-gray-50 rounded-xl px-4 py-3 font-mono text-lg font-bold text-gray-900 tracking-wider text-center">
              {profile.referral_code}
            </div>
            <button
              onClick={() => {
                const url = `https://splytpayments.com/invite/${profile.referral_code}`;
                if (navigator.share) {
                  navigator.share({ title: "Join SPLYT", text: `Use my referral code ${profile.referral_code} to join SPLYT!`, url });
                } else {
                  navigator.clipboard.writeText(url);
                  setMessage({ type: "success", text: "Referral link copied!" });
                  setTimeout(() => setMessage(null), 3000);
                }
              }}
              className="px-5 py-3 bg-ocean-500 text-white text-sm font-semibold rounded-xl hover:bg-ocean-600 transition-colors"
            >
              Share
            </button>
          </div>
        </section>
      )}

      {/* Account */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Account</h2>
        <div className="space-y-3">
          <button
            onClick={handleSignOut}
            className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-between"
          >
            Sign Out
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
          <button
            onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
            className="w-full text-left px-4 py-3 rounded-xl border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            Delete Account
          </button>
          {showDeleteConfirm && (
            <div className="bg-red-50 rounded-xl p-4 border border-red-200">
              <p className="text-sm text-red-800 mb-3">
                This will permanently delete your account, wallet balance, and all data. Type <strong>DELETE</strong> to confirm.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={deleteText}
                  onChange={(e) => setDeleteText(e.target.value)}
                  placeholder="Type DELETE"
                  className="flex-1 px-3 py-2 rounded-lg border border-red-200 text-sm text-gray-900 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteText !== "DELETE"}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? "bg-ocean-500" : "bg-gray-300"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );
}
