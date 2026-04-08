"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/types";

interface Analytics {
  gross_revenue: number;
  net_revenue: number;
  refunds_total: number;
  average_booking_value: number;
  total_bookings: number;
  confirmed_bookings: number;
  cancelled_bookings: number;
  total_guests: number;
  repeat_guests: number;
  average_party_size: number;
  repeat_guest_rate: number;
  reviews_received: number;
  average_rating: number;
  listing_views: number;
  search_impressions: number;
  conversion_rate: number;
}

interface DailyImpression {
  date: string;
  views: number;
  impressions: number;
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [impressions, setImpressions] = useState<DailyImpression[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"weekly" | "monthly" | "all_time">("monthly");

  useEffect(() => {
    const supabase = createBrowserSupabase();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;

      // Fetch analytics
      const { data: analyticsData } = await supabase
        .from("host_analytics")
        .select("*")
        .eq("host_id", user.id)
        .eq("period", period)
        .order("period_start", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (analyticsData) setAnalytics(analyticsData as Analytics);

      // Fetch daily impressions (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
      const { data: impData } = await supabase
        .from("listing_impressions")
        .select("created_at")
        .eq("host_id", user.id)
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: true });

      if (impData) {
        // Group by date
        const byDate = new Map<string, { views: number; impressions: number }>();
        impData.forEach((row: any) => {
          const date = row.created_at.split("T")[0];
          const entry = byDate.get(date) || { views: 0, impressions: 0 };
          entry.impressions++;
          if ((row as any).impression_type === "detail") entry.views++;
          byDate.set(date, entry);
        });
        setImpressions(Array.from(byDate.entries()).map(([date, data]) => ({ date, ...data })));
      }

      setLoading(false);
    });
  }, [period]);

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-6xl animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <div key={i} className="h-24 bg-gray-200 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const a = analytics || {} as Analytics;

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Analytics</h1>
          <p className="text-gray-500">Performance overview for your listings.</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {(["weekly", "monthly", "all_time"] as const).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${period === p ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {p === "all_time" ? "All Time" : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Revenue */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Revenue</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Gross Revenue" value={formatCurrency(a.gross_revenue || 0)} />
          <StatCard label="Net Revenue" value={formatCurrency(a.net_revenue || 0)} accent />
          <StatCard label="Refunds" value={formatCurrency(a.refunds_total || 0)} />
          <StatCard label="Avg Booking" value={formatCurrency(a.average_booking_value || 0)} />
        </div>
      </section>

      {/* Bookings */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Bookings</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Bookings" value={String(a.total_bookings || 0)} />
          <StatCard label="Confirmed" value={String(a.confirmed_bookings || 0)} accent />
          <StatCard label="Cancelled" value={String(a.cancelled_bookings || 0)} />
          <StatCard label="Conversion" value={`${((a.conversion_rate || 0) * 100).toFixed(1)}%`} />
        </div>
      </section>

      {/* Guests */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Guests</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Guests" value={String(a.total_guests || 0)} />
          <StatCard label="Repeat Guests" value={String(a.repeat_guests || 0)} />
          <StatCard label="Avg Party Size" value={String(a.average_party_size || 0)} />
          <StatCard label="Repeat Rate" value={`${((a.repeat_guest_rate || 0) * 100).toFixed(0)}%`} />
        </div>
      </section>

      {/* Engagement */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Engagement</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Listing Views" value={String(a.listing_views || 0)} />
          <StatCard label="Search Impressions" value={String(a.search_impressions || 0)} />
          <StatCard label="Reviews" value={String(a.reviews_received || 0)} />
          <StatCard label="Avg Rating" value={a.average_rating ? `${a.average_rating.toFixed(1)} / 5` : "—"} accent />
        </div>
      </section>

      {/* Impression chart */}
      {impressions.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Daily Views (Last 30 Days)</h2>
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-end gap-[2px] h-32">
              {impressions.map((imp) => {
                const max = Math.max(...impressions.map((i) => i.impressions), 1);
                const height = Math.max((imp.impressions / max) * 100, 4);
                return (
                  <div key={imp.date} className="flex-1 flex flex-col items-center justify-end group relative">
                    <div className="w-full bg-ocean-400 rounded-t-sm transition-all hover:bg-ocean-500" style={{ height: `${height}%` }} />
                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-900 text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap">
                      {imp.date.slice(5)}: {imp.impressions} views
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? "bg-ocean-50 border-ocean-200" : "bg-white border-gray-200"}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${accent ? "text-ocean-700" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}
