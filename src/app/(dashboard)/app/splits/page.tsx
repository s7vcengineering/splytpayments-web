"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import type { Pledge, Experience } from "@/lib/types";
import { formatCurrency, formatDateTime } from "@/lib/types";

type PledgeWithExperience = Pledge & { experience: Experience };

export default function SplitsPage() {
  const [pledges, setPledges] = useState<PledgeWithExperience[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "fulfilled" | "withdrawn">("all");

  useEffect(() => {
    const supabase = createBrowserSupabase();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("pledges")
        .select("*, experience:experiences(*, host:profiles!host_id(id,display_name,avatar_url))")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (data) setPledges(data as PledgeWithExperience[]);
      setLoading(false);
    });
  }, []);

  const filtered = filter === "all" ? pledges : pledges.filter((p) => p.status === filter);
  const counts = {
    all: pledges.length,
    active: pledges.filter((p) => p.status === "active" || p.status === "reserved").length,
    fulfilled: pledges.filter((p) => p.status === "fulfilled").length,
    withdrawn: pledges.filter((p) => p.status === "withdrawn").length,
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">My Splits</h1>
      <p className="text-gray-500 mb-6">Experiences you&apos;ve joined, your deposits, and group members.</p>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {(["all", "active", "fulfilled", "withdrawn"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === f
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 animate-pulse">
              <div className="flex gap-4">
                <div className="w-24 h-24 rounded-xl bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                  <div className="h-3 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-200">
          <div className="w-16 h-16 bg-ocean-50 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-ocean-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">No splits yet</h2>
          <p className="text-sm text-gray-500 mb-4">Join an experience to see it here.</p>
          <a href="/" className="text-sm font-medium text-ocean-500 hover:underline">Browse Marketplace</a>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((pledge) => {
            const exp = pledge.experience;
            const statusColor = {
              reserved: "bg-amber-50 text-amber-600",
              active: "bg-green-50 text-green-600",
              fulfilled: "bg-blue-50 text-blue-600",
              withdrawn: "bg-gray-100 text-gray-500",
            }[pledge.status];

            return (
              <div key={pledge.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row">
                  {exp?.photo_urls?.[0] && (
                    <div className="sm:w-48 aspect-video sm:aspect-square bg-gray-100 shrink-0">
                      <img src={exp.photo_urls[0]} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-4 flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{exp?.title || "Experience"}</h3>
                        <p className="text-sm text-gray-500 mt-0.5">{exp?.location}</p>
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${statusColor}`}>
                        {pledge.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-6 gap-y-2 mt-3 text-sm text-gray-600">
                      {exp?.date_time && (
                        <div className="flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {formatDateTime(exp.date_time)}
                        </div>
                      )}
                      {exp?.duration_hours && (
                        <div className="flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {exp.duration_hours}h
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                        </svg>
                        {exp?.current_participants || 0}/{exp?.max_participants || "?"} joined
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
                      <div>
                        <p className="text-xs text-gray-400">Your pledge</p>
                        <p className="text-sm font-semibold text-ocean-600">{formatCurrency(pledge.amount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Total cost</p>
                        <p className="text-sm font-semibold text-gray-900">{formatCurrency(exp?.total_cost || 0)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Per person</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {exp?.max_participants ? formatCurrency(Math.ceil((exp.total_cost || 0) / exp.max_participants)) : "—"}
                        </p>
                      </div>
                    </div>

                    {(exp as any)?.host && (
                      <div className="flex items-center gap-2 mt-3">
                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                          {(exp as any).host.display_name?.[0]?.toUpperCase() || "H"}
                        </div>
                        <span className="text-xs text-gray-500">Hosted by {(exp as any).host.display_name || "Host"}</span>
                      </div>
                    )}
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
