"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase";
import type { UserProfile } from "@/lib/types";
import { formatCurrency } from "@/lib/types";

export default function BusinessDashboardPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState({ listings: 0, pendingRequests: 0, activePledges: 0, totalEarned: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;

      const [profileRes, listingsRes, requestsRes, pledgesRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("experiences").select("id", { count: "exact", head: true }).eq("host_id", user.id),
        supabase.from("join_requests").select("id", { count: "exact", head: true }).eq("host_id", user.id).eq("status", "pending"),
        supabase.from("pledges").select("amount").in("status", ["reserved", "active"])
          .in("experience_id", (await supabase.from("experiences").select("id").eq("host_id", user.id)).data?.map((e: any) => e.id) || []),
      ]);

      if (profileRes.data) setProfile(profileRes.data as UserProfile);
      const totalPledged = pledgesRes.data?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;
      setStats({
        listings: listingsRes.count || 0,
        pendingRequests: requestsRes.count || 0,
        activePledges: pledgesRes.data?.length || 0,
        totalEarned: totalPledged,
      });
      setLoading(false);
    });
  }, []);

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Business Dashboard</h1>
      <p className="text-gray-500 mb-8">
        {profile?.display_name ? `Welcome back, ${profile.display_name}` : "Your business overview at a glance."}
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Active Listings" value={loading ? "..." : String(stats.listings)} color="ocean" />
        <StatCard label="Pending Requests" value={loading ? "..." : String(stats.pendingRequests)} color="amber" />
        <StatCard label="Active Pledges" value={loading ? "..." : String(stats.activePledges)} color="green" />
        <StatCard label="Total Pledged" value={loading ? "..." : formatCurrency(stats.totalEarned)} color="purple" />
      </div>

      {/* Host tier */}
      {profile && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 mb-1">Host Tier</p>
              <p className="text-lg font-bold text-gray-900 capitalize">{profile.host_tier || "New"}</p>
            </div>
            {profile.host_response_rate != null && (
              <div className="text-right">
                <p className="text-xs text-gray-500 mb-1">Response Rate</p>
                <p className="text-lg font-bold text-gray-900">{Math.round(profile.host_response_rate)}%</p>
              </div>
            )}
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-1">Stripe Payouts</p>
              <p className={`text-sm font-semibold ${profile.stripe_connect_onboarded ? "text-green-600" : "text-amber-600"}`}>
                {profile.stripe_connect_onboarded ? "Connected" : "Not set up"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <ActionCard title="My Listings" desc="View and manage your experiences" href="/app/business/listings" icon="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2" />
        <ActionCard title="Availability" desc="Set your calendar and blackout dates" href="/app/business/availability" icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        <ActionCard title="Bookings" desc="Review incoming requests" href="/app/business/bookings" icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" />
        <ActionCard title="Revenue" desc="Track earnings and payouts" href="/app/business/revenue" icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2" />
        <ActionCard title="Messages" desc="Respond to customer inquiries" href="/app/business/messages" icon="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        <ActionCard title="Settings" desc="Business profile and payout details" href="/app/business/settings" icon="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35" />
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    ocean: "bg-ocean-50 border-ocean-200",
    amber: "bg-amber-50 border-amber-200",
    green: "bg-green-50 border-green-200",
    purple: "bg-purple-50 border-purple-200",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color] || "bg-white border-gray-200"}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function ActionCard({ title, desc, href, icon }: { title: string; desc: string; href: string; icon: string }) {
  return (
    <Link href={href} className="block bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md hover:border-gray-300 transition-all">
      <svg className="w-6 h-6 text-ocean-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d={icon} />
      </svg>
      <h3 className="text-sm font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-xs text-gray-500">{desc}</p>
    </Link>
  );
}
