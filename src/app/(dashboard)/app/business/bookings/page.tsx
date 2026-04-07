"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import type { JoinRequest } from "@/lib/types";
import { formatCurrency, formatDateTime, timeAgo } from "@/lib/types";

export default function BookingsPage() {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "accepted" | "deferred">("all");

  useEffect(() => {
    const supabase = createBrowserSupabase();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("join_requests")
        .select("*, user:profiles!user_id(id,display_name,avatar_url,bio,instagram_url,is_premium,home_city), experience:experiences(id,title,location,photo_urls,date_time,total_cost,max_participants,current_participants)")
        .eq("host_id", user.id)
        .order("created_at", { ascending: false });
      if (data) setRequests(data as JoinRequest[]);
      setLoading(false);
    });
  }, []);

  async function handleAccept(requestId: string) {
    const supabase = createBrowserSupabase();
    await supabase.from("join_requests").update({ status: "accepted" }).eq("id", requestId);
    setRequests((prev) => prev.map((r) => r.id === requestId ? { ...r, status: "accepted" } : r));
  }

  async function handleDefer(requestId: string) {
    const supabase = createBrowserSupabase();
    await supabase.from("join_requests").update({ status: "deferred" }).eq("id", requestId);
    setRequests((prev) => prev.map((r) => r.id === requestId ? { ...r, status: "deferred" } : r));
  }

  const filtered = filter === "all" ? requests : requests.filter((r) => r.status === filter);

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Bookings</h1>
      <p className="text-gray-500 mb-6">Review incoming requests and manage your bookings.</p>

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {(["all", "pending", "accepted", "deferred"] as const).map((f) => {
          const count = f === "all" ? requests.length : requests.filter((r) => r.status === f).length;
          return (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter === f ? "bg-gray-900 text-white" : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)} ({count})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse h-32" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">No bookings yet</h2>
          <p className="text-sm text-gray-500">When people request to join your experiences, they&apos;ll appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((req) => {
            const user = req.user;
            const exp = req.experience;
            const statusColors: Record<string, string> = { pending: "bg-amber-50 text-amber-600", accepted: "bg-green-50 text-green-600", deferred: "bg-gray-100 text-gray-500" };

            return (
              <div key={req.id} className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-start gap-4">
                  {/* User avatar */}
                  <div className="w-12 h-12 rounded-full bg-ocean-100 flex items-center justify-center text-ocean-600 font-bold shrink-0">
                    {user?.avatar_url
                      ? <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                      : user?.display_name?.[0]?.toUpperCase() || "?"}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{user?.display_name || "User"}</p>
                      {user?.is_premium && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Premium</span>}
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[req.status]}`}>{req.status}</span>
                    </div>
                    {user?.home_city && <p className="text-xs text-gray-500 mt-0.5">{user.home_city}</p>}
                    {user?.bio && <p className="text-sm text-gray-600 mt-1 line-clamp-2">{user.bio}</p>}

                    <div className="mt-3 p-3 bg-gray-50 rounded-xl">
                      <p className="text-sm font-medium text-gray-900">{exp?.title || "Experience"}</p>
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                        <span>{exp?.location}</span>
                        {exp?.date_time && <span>{formatDateTime(exp.date_time)}</span>}
                        <span>Pledge: <b className="text-ocean-600">{formatCurrency(req.amount)}</b></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-xs text-gray-400">{timeAgo(req.created_at)}</span>
                      {req.status === "pending" && (
                        <>
                          <button onClick={() => handleAccept(req.id)} className="ml-auto px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors">Accept</button>
                          <button onClick={() => handleDefer(req.id)} className="px-3 py-1.5 bg-white text-gray-600 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">Defer</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
