"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import type { Experience } from "@/lib/types";
import { formatCurrency, formatDateTime } from "@/lib/types";

export default function ListingsPage() {
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | "filling" | "full" | "completed">("all");

  useEffect(() => {
    const supabase = createBrowserSupabase();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("experiences")
        .select("*")
        .eq("host_id", user.id)
        .order("created_at", { ascending: false });
      if (data) setExperiences(data as Experience[]);
      setLoading(false);
    });
  }, []);

  const filtered = filter === "all" ? experiences : experiences.filter((e) => e.status === filter);

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">My Listings</h1>
          <p className="text-gray-500">{experiences.length} total experience{experiences.length !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/app/business/listings/new" className="px-4 py-2 bg-ocean-500 text-white text-sm font-semibold rounded-xl hover:bg-ocean-600 transition-colors">
          + New Experience
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {(["all", "open", "filling", "full", "completed"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter === f ? "bg-gray-900 text-white" : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 animate-pulse flex gap-4">
              <div className="w-32 h-24 rounded-xl bg-gray-200" />
              <div className="flex-1 space-y-2"><div className="h-4 bg-gray-200 rounded w-2/3" /><div className="h-3 bg-gray-200 rounded w-1/3" /></div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">No listings yet</h2>
          <p className="text-sm text-gray-500">Create your first experience to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((exp) => {
            const statusColors: Record<string, string> = { open: "bg-green-50 text-green-600", filling: "bg-ocean-50 text-ocean-600", full: "bg-purple-50 text-purple-600", completed: "bg-gray-100 text-gray-500", cancelled: "bg-red-50 text-red-500" };
            return (
              <Link key={exp.id} href={`/app/business/listings/${exp.id}/edit`} className="block bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row">
                  {exp.photo_urls?.[0] && (
                    <div className="sm:w-48 aspect-video sm:aspect-square bg-gray-100 shrink-0">
                      <img src={exp.photo_urls[0]} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-4 flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{exp.title}</h3>
                        <p className="text-sm text-gray-500 mt-0.5">{exp.location}</p>
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${statusColors[exp.status] || "bg-gray-100 text-gray-500"}`}>
                        {exp.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-sm text-gray-600">
                      <span>{formatCurrency(exp.total_cost)} total</span>
                      <span>{exp.current_participants}/{exp.max_participants} joined</span>
                      {exp.duration_hours && <span>{exp.duration_hours}h</span>}
                      <span className="capitalize">{exp.type.replace(/_/g, " ")}</span>
                    </div>
                    {exp.date_time && <p className="text-xs text-gray-400 mt-2">{formatDateTime(exp.date_time)}</p>}
                    <div className="flex gap-2 mt-3">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{exp.booking_mode}</span>
                      {exp.vibe && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{exp.vibe.replace(/_/g, " ")}</span>}
                      <span className="text-xs text-ocean-600 ml-auto">Edit &rarr;</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
