"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase";
import type { UserProfile, Pledge, ChatThread, Experience } from "@/lib/types";
import { formatCurrency, formatDateTime, timeAgo } from "@/lib/types";

export default function AppHome() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeSplits, setActiveSplits] = useState<(Pledge & { experience: Experience })[]>([]);
  const [recentThreads, setRecentThreads] = useState<ChatThread[]>([]);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;

      // Fetch profile, active pledges, threads, and counts in parallel
      const [profileRes, pledgesRes, threadsRes, savedRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase
          .from("pledges")
          .select("*, experience:experiences(*)")
          .eq("user_id", user.id)
          .in("status", ["reserved", "active"])
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("chat_threads")
          .select("*")
          .contains("member_ids", [user.id])
          .order("updated_at", { ascending: false })
          .limit(5),
        supabase
          .from("wishlist_items")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);

      if (profileRes.data) setProfile(profileRes.data as UserProfile);
      if (pledgesRes.data) {
        setActiveSplits(pledgesRes.data as any);
        setUpcomingCount(pledgesRes.data.length);
      }
      if (threadsRes.data) setRecentThreads(threadsRes.data as ChatThread[]);
      if (savedRes.count != null) setSavedCount(savedRes.count);
    });
  }, []);

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        {profile ? `Hey, ${profile.display_name || "there"}` : "Welcome"}
      </h1>
      <p className="text-gray-500 mb-8">Here&apos;s what&apos;s happening with your SPLYT account.</p>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Wallet Balance" value={formatCurrency(profile?.wallet_balance || 0)} />
        <StatCard label="Active Splits" value={String(upcomingCount)} />
        <StatCard label="Saved" value={String(savedCount)} />
        <StatCard label="Messages" value={String(recentThreads.length)} />
      </div>

      {/* Active splits */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Active Splits</h2>
          <Link href="/app/splits" className="text-sm text-ocean-500 font-medium hover:underline">View all</Link>
        </div>
        {activeSplits.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500 text-sm">No active splits yet. Browse the marketplace to find an experience.</p>
            <Link href="/" className="inline-block mt-3 text-sm font-medium text-ocean-500 hover:underline">Explore Marketplace</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeSplits.map((pledge) => (
              <div key={pledge.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                {pledge.experience?.photo_urls?.[0] && (
                  <div className="aspect-[16/9] bg-gray-100">
                    <img src={pledge.experience.photo_urls[0]} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 text-sm truncate">{pledge.experience?.title || "Experience"}</h3>
                  <p className="text-xs text-gray-500 mt-1">{pledge.experience?.location}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs font-medium text-ocean-600 bg-ocean-50 px-2 py-0.5 rounded-full">
                      {formatCurrency(pledge.amount)} pledged
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      pledge.status === "active" ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
                    }`}>
                      {pledge.status}
                    </span>
                  </div>
                  {pledge.experience?.date_time && (
                    <p className="text-xs text-gray-400 mt-2">{formatDateTime(pledge.experience.date_time)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent messages */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Messages</h2>
          <Link href="/app/messages" className="text-sm text-ocean-500 font-medium hover:underline">View all</Link>
        </div>
        {recentThreads.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500 text-sm">No messages yet. Join a split to start chatting.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
            {recentThreads.map((thread) => (
              <Link key={thread.id} href="/app/messages" className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-ocean-100 flex items-center justify-center text-ocean-600 font-bold text-sm shrink-0">
                  {thread.experience_title?.[0]?.toUpperCase() || "#"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{thread.experience_title || "Direct Message"}</p>
                  <p className="text-xs text-gray-500 truncate">{thread.member_ids?.length || 0} members</p>
                </div>
                <span className="text-xs text-gray-400 shrink-0">{timeAgo(thread.updated_at)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <QuickCard title="Browse Marketplace" description="Discover yachts, cars, stays & experiences" href="/" icon="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" accent />
        <QuickCard title="Profile" description="Edit your profile and preferences" href="/app/profile" icon="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <QuickCard title="Wallet" description="Check your balance and payment history" href="/app/wallet" icon="M21 12V7H5a2 2 0 010-4h14v4M3 5v14a2 2 0 002 2h16v-5" />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function QuickCard({ title, description, href, icon, accent }: {
  title: string; description: string; href: string; icon: string; accent?: boolean;
}) {
  return (
    <a href={href} className={`block p-5 rounded-2xl border transition-all hover:shadow-md ${
      accent ? "bg-ocean-50 border-ocean-200 hover:border-ocean-300" : "bg-white border-gray-200 hover:border-gray-300"
    }`}>
      <svg className={`w-6 h-6 mb-3 ${accent ? "text-ocean-500" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d={icon} />
      </svg>
      <h3 className="text-sm font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
    </a>
  );
}
