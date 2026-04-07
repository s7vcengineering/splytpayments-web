"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import type { Experience } from "@/lib/types";

interface AvailabilitySlot {
  id: string;
  listing_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
  notes: string | null;
}

export default function AvailabilityPage() {
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [selectedExp, setSelectedExp] = useState<string | null>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Current month view
  const [viewDate, setViewDate] = useState(new Date());

  useEffect(() => {
    const supabase = createBrowserSupabase();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("experiences")
        .select("id,title,location,type,photo_urls")
        .eq("host_id", user.id)
        .order("created_at", { ascending: false });
      if (data && data.length > 0) {
        setExperiences(data as Experience[]);
        setSelectedExp(data[0].id);
      }
      setLoading(false);
    });
  }, []);

  // Load availability when experience selected
  useEffect(() => {
    if (!selectedExp) return;
    setSlotsLoading(true);
    const supabase = createBrowserSupabase();
    const startOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).toISOString().split("T")[0];
    const endOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).toISOString().split("T")[0];

    supabase
      .from("listing_availability")
      .select("*")
      .eq("listing_id", selectedExp)
      .gte("date", startOfMonth)
      .lte("date", endOfMonth)
      .order("date")
      .then(({ data }) => {
        if (data) setSlots(data as AvailabilitySlot[]);
        setSlotsLoading(false);
      });
  }, [selectedExp, viewDate]);

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
  const monthName = viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const slotsByDate = new Map<string, AvailabilitySlot>();
  slots.forEach((s) => slotsByDate.set(s.date, s));

  function getStatusColor(status: string) {
    switch (status) {
      case "available": return "bg-green-100 text-green-800 border-green-200";
      case "booked": return "bg-ocean-100 text-ocean-800 border-ocean-200";
      case "blocked_manual": return "bg-red-100 text-red-800 border-red-200";
      case "blocked_maintenance": return "bg-amber-100 text-amber-800 border-amber-200";
      default: return "bg-gray-50 text-gray-600 border-gray-200";
    }
  }

  async function toggleAvailability(dateStr: string) {
    const supabase = createBrowserSupabase();
    const existing = slotsByDate.get(dateStr);
    if (existing) {
      const nextStatus = existing.status === "available" ? "blocked_manual" : "available";
      await supabase.from("listing_availability").update({ status: nextStatus }).eq("id", existing.id);
      setSlots((prev) => prev.map((s) => s.id === existing.id ? { ...s, status: nextStatus } : s));
    } else {
      const { data } = await supabase.from("listing_availability").insert({
        listing_id: selectedExp,
        date: dateStr,
        status: "available",
      }).select().single();
      if (data) setSlots((prev) => [...prev, data as AvailabilitySlot]);
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Availability</h1>
      <p className="text-gray-500 mb-6">Manage your calendar — click a day to toggle availability.</p>

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded-xl w-64" />
          <div className="h-96 bg-gray-200 rounded-2xl" />
        </div>
      ) : experiences.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">No listings yet</h2>
          <p className="text-sm text-gray-500">Create an experience to manage its availability.</p>
        </div>
      ) : (
        <>
          {/* Listing selector */}
          <select
            value={selectedExp || ""}
            onChange={(e) => setSelectedExp(e.target.value)}
            className="mb-6 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500"
          >
            {experiences.map((exp) => (
              <option key={exp.id} value={exp.id}>{exp.title} — {exp.location}</option>
            ))}
          </select>

          {/* Calendar */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {/* Month nav */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1))} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <h3 className="text-sm font-semibold text-gray-900">{monthName}</h3>
              <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1))} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 text-center border-b border-gray-100">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="py-2 text-xs font-medium text-gray-500">{d}</div>
              ))}
            </div>

            {/* Days */}
            <div className="grid grid-cols-7">
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square border-b border-r border-gray-50" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const slot = slotsByDate.get(dateStr);
                const today = new Date().toISOString().split("T")[0] === dateStr;

                return (
                  <button
                    key={day}
                    onClick={() => toggleAvailability(dateStr)}
                    disabled={slotsLoading}
                    className={`aspect-square border-b border-r border-gray-50 p-1 text-left hover:bg-gray-50 transition-colors relative ${today ? "ring-2 ring-inset ring-ocean-500" : ""}`}
                  >
                    <span className="text-xs font-medium text-gray-700">{day}</span>
                    {slot && (
                      <div className={`mt-0.5 px-1 py-0.5 rounded text-[10px] font-medium leading-tight ${getStatusColor(slot.status)}`}>
                        {slot.status === "available" ? "Open" : slot.status === "booked" ? "Booked" : "Blocked"}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-4 text-xs text-gray-600">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-100 border border-green-200" /> Available</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-ocean-100 border border-ocean-200" /> Booked</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-100 border border-red-200" /> Blocked</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-amber-100 border border-amber-200" /> Maintenance</div>
          </div>
        </>
      )}
    </div>
  );
}
