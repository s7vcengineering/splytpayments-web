"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase";
import type { Experience } from "@/lib/types";
import { formatCurrency } from "@/lib/types";

const TYPES = ["all", "yacht_charter", "exotic_car", "luxury_stay", "experience", "networking"] as const;
const VIBES = ["all", "chill", "party", "networking", "adventure", "luxury", "family"] as const;

export default function ExplorePage() {
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [vibeFilter, setVibeFilter] = useState<string>("all");

  useEffect(() => {
    const supabase = createBrowserSupabase();
    supabase
      .from("experiences")
      .select("*, host:profiles!host_id(id, display_name, avatar_url, host_tier)")
      .in("status", ["open", "filling"])
      .eq("is_private", false)
      .order("created_at", { ascending: false })
      .limit(60)
      .then(({ data }) => {
        if (data) setExperiences(data as Experience[]);
        setLoading(false);
      });
  }, []);

  const filtered = experiences.filter((exp) => {
    if (typeFilter !== "all" && exp.type !== typeFilter) return false;
    if (vibeFilter !== "all" && exp.vibe !== vibeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        exp.title.toLowerCase().includes(q) ||
        exp.location?.toLowerCase().includes(q) ||
        exp.description?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Explore</h1>
      <p className="text-gray-500 mb-6">Discover experiences and join a split.</p>

      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search by name, location, or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500 transition-all bg-white"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                typeFilter === t
                  ? "bg-gray-900 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"
              }`}
            >
              {t === "all" ? "All Types" : t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {VIBES.map((v) => (
            <button
              key={v}
              onClick={() => setVibeFilter(v)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                vibeFilter === v
                  ? "bg-ocean-500 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"
              }`}
            >
              {v === "all" ? "All Vibes" : v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 animate-pulse">
              <div className="aspect-[4/3] bg-gray-200 rounded-t-2xl" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
                <div className="h-3 bg-gray-200 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-200">
          <div className="w-16 h-16 bg-ocean-50 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-ocean-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">No experiences found</h2>
          <p className="text-sm text-gray-500 mb-4">Try adjusting your filters or search term.</p>
          <button onClick={() => { setSearch(""); setTypeFilter("all"); setVibeFilter("all"); }} className="text-sm font-medium text-ocean-500 hover:underline">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((exp) => {
            const perPerson = Math.ceil(exp.total_cost / exp.max_participants);
            const spotsLeft = exp.max_participants - exp.current_participants;
            return (
              <Link
                key={exp.id}
                href={`/app/experience/${exp.id}`}
                className="block bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group"
              >
                <div className="aspect-[4/3] bg-gray-100 relative">
                  {exp.photo_urls?.[0] ? (
                    <img src={exp.photo_urls[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  {spotsLeft <= 3 && spotsLeft > 0 && (
                    <span className="absolute top-3 left-3 bg-red-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                      {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left
                    </span>
                  )}
                  {exp.vibe && (
                    <span className="absolute bottom-3 left-3 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full capitalize backdrop-blur-sm">
                      {exp.vibe}
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-gray-900 text-sm truncate">{exp.title}</h3>
                    <span className="text-xs text-ocean-600 bg-ocean-50 px-2 py-0.5 rounded-full font-medium capitalize shrink-0">
                      {exp.type.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{exp.location}</p>
                  <div className="flex items-center justify-between mt-3">
                    <div>
                      <span className="text-sm font-bold text-gray-900">{formatCurrency(perPerson)}</span>
                      <span className="text-xs text-gray-500"> /person</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {exp.current_participants}/{exp.max_participants} joined
                    </span>
                  </div>
                  {exp.host && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500">
                        {exp.host.avatar_url ? (
                          <img src={exp.host.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          exp.host.display_name?.[0]?.toUpperCase() || "H"
                        )}
                      </div>
                      <span className="text-xs text-gray-400">{exp.host.display_name || "Host"}</span>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
