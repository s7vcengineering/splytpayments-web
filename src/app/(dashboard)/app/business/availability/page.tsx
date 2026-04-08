"use client";

import { useEffect, useState, useCallback } from "react";
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

type BulkAction = "available" | "blocked_manual" | "blocked_maintenance";

export default function AvailabilityPage() {
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [selectedExp, setSelectedExp] = useState<string | null>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [editingSlot, setEditingSlot] = useState<AvailabilitySlot | null>(null);
  const [noteText, setNoteText] = useState("");
  const [timeStart, setTimeStart] = useState("");
  const [timeEnd, setTimeEnd] = useState("");

  // Stats
  const availableCount = slots.filter((s) => s.status === "available").length;
  const bookedCount = slots.filter((s) => s.status === "booked").length;
  const blockedCount = slots.filter((s) => s.status.startsWith("blocked")).length;

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

  const loadSlots = useCallback(async () => {
    if (!selectedExp) return;
    setSlotsLoading(true);
    const supabase = createBrowserSupabase();
    const startOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).toISOString().split("T")[0];
    const endOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).toISOString().split("T")[0];

    const { data } = await supabase
      .from("listing_availability")
      .select("*")
      .eq("listing_id", selectedExp)
      .gte("date", startOfMonth)
      .lte("date", endOfMonth)
      .order("date");
    if (data) setSlots(data as AvailabilitySlot[]);
    setSlotsLoading(false);
  }, [selectedExp, viewDate]);

  useEffect(() => {
    loadSlots();
    setSelectedDates(new Set());
  }, [loadSlots]);

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
  const monthName = viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const today = new Date().toISOString().split("T")[0];

  const slotsByDate = new Map<string, AvailabilitySlot>();
  slots.forEach((s) => slotsByDate.set(s.date, s));

  function getStatusStyle(status: string) {
    switch (status) {
      case "available": return { bg: "bg-green-50", border: "border-green-300", dot: "bg-green-500", text: "text-green-700", label: "Open" };
      case "booked": return { bg: "bg-ocean-50", border: "border-ocean-300", dot: "bg-ocean-500", text: "text-ocean-700", label: "Booked" };
      case "blocked_manual": return { bg: "bg-red-50", border: "border-red-300", dot: "bg-red-500", text: "text-red-700", label: "Blocked" };
      case "blocked_maintenance": return { bg: "bg-amber-50", border: "border-amber-300", dot: "bg-amber-500", text: "text-amber-700", label: "Maint." };
      default: return { bg: "bg-gray-50", border: "border-gray-200", dot: "bg-gray-300", text: "text-gray-500", label: "" };
    }
  }

  function toggleDateSelection(dateStr: string) {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else next.add(dateStr);
      return next;
    });
  }

  async function handleBulkAction(action: BulkAction) {
    if (selectedDates.size === 0 || !selectedExp) return;
    const supabase = createBrowserSupabase();
    const dates = Array.from(selectedDates);

    for (const dateStr of dates) {
      const existing = slotsByDate.get(dateStr);
      if (existing) {
        await supabase.from("listing_availability").update({ status: action }).eq("id", existing.id);
      } else {
        await supabase.from("listing_availability").insert({ listing_id: selectedExp, date: dateStr, status: action }).select();
      }
    }
    setSelectedDates(new Set());
    loadSlots();
  }

  async function handleQuickSet(pattern: "weekends" | "weekdays" | "all") {
    if (!selectedExp) return;
    const dates: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), d);
      const dateStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (dateStr < today) continue;
      const dayOfWeek = date.getDay();
      if (pattern === "weekends" && (dayOfWeek === 0 || dayOfWeek === 6)) dates.push(dateStr);
      else if (pattern === "weekdays" && dayOfWeek >= 1 && dayOfWeek <= 5) dates.push(dateStr);
      else if (pattern === "all") dates.push(dateStr);
    }
    setSelectedDates(new Set(dates));
  }

  function handleDayClick(dateStr: string) {
    const slot = slotsByDate.get(dateStr);
    if (slot) {
      setEditingSlot(slot);
      setNoteText(slot.notes || "");
      setTimeStart(slot.start_time || "");
      setTimeEnd(slot.end_time || "");
    } else {
      toggleDateSelection(dateStr);
    }
  }

  async function handleSaveSlotDetails() {
    if (!editingSlot) return;
    const supabase = createBrowserSupabase();
    await supabase.from("listing_availability").update({
      notes: noteText || null,
      start_time: timeStart || null,
      end_time: timeEnd || null,
    }).eq("id", editingSlot.id);
    setEditingSlot(null);
    loadSlots();
  }

  async function handleToggleStatus(dateStr: string) {
    const supabase = createBrowserSupabase();
    const existing = slotsByDate.get(dateStr);
    if (existing) {
      const cycle: Record<string, string> = { available: "blocked_manual", blocked_manual: "blocked_maintenance", blocked_maintenance: "available", booked: "booked" };
      const next = cycle[existing.status] || "available";
      if (next === existing.status) return;
      await supabase.from("listing_availability").update({ status: next }).eq("id", existing.id);
    } else {
      await supabase.from("listing_availability").insert({ listing_id: selectedExp, date: dateStr, status: "available" });
    }
    loadSlots();
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Availability Calendar</h1>
          <p className="text-gray-500">Manage dates, block times, and track bookings.</p>
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded-xl w-64" />
          <div className="h-[500px] bg-gray-200 rounded-2xl" />
        </div>
      ) : experiences.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">No listings yet</h2>
          <p className="text-sm text-gray-500">Create an experience to manage its availability.</p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Calendar */}
          <div className="flex-1 min-w-0">
            {/* Listing selector + stats */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
              <select
                value={selectedExp || ""}
                onChange={(e) => setSelectedExp(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500 bg-white flex-1"
              >
                {experiences.map((exp) => (
                  <option key={exp.id} value={exp.id}>{exp.title} — {exp.location}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <span className="px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-semibold">{availableCount} open</span>
                <span className="px-3 py-1.5 rounded-lg bg-ocean-50 text-ocean-700 text-xs font-semibold">{bookedCount} booked</span>
                <span className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-semibold">{blockedCount} blocked</span>
              </div>
            </div>

            {/* Calendar */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              {/* Month nav */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1))} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <div className="text-center">
                  <h3 className="text-base font-bold text-gray-900">{monthName}</h3>
                  <button onClick={() => setViewDate(new Date())} className="text-xs text-ocean-500 hover:underline mt-0.5">Today</button>
                </div>
                <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1))} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 text-center border-b border-gray-100 bg-gray-50">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">{d}</div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7">
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`e-${i}`} className="aspect-square border-b border-r border-gray-50" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dateStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const slot = slotsByDate.get(dateStr);
                  const isToday = dateStr === today;
                  const isPast = dateStr < today;
                  const isSelected = selectedDates.has(dateStr);
                  const style = slot ? getStatusStyle(slot.status) : { bg: "", border: "border-gray-50", dot: "", text: "", label: "" };

                  return (
                    <button
                      key={day}
                      onClick={(e) => {
                        if (e.shiftKey || selectedDates.size > 0) {
                          toggleDateSelection(dateStr);
                        } else {
                          handleDayClick(dateStr);
                        }
                      }}
                      onDoubleClick={() => handleToggleStatus(dateStr)}
                      disabled={slotsLoading || isPast}
                      className={`aspect-square border-b border-r p-1.5 text-left transition-all relative group ${
                        isPast ? "opacity-40 cursor-not-allowed bg-gray-50/50" :
                        isSelected ? "ring-2 ring-inset ring-ocean-500 bg-ocean-50" :
                        slot ? `${style.bg} hover:brightness-95` : "hover:bg-gray-50"
                      } ${isToday ? "ring-2 ring-inset ring-ocean-500" : `border-${style.border}`}`}
                    >
                      <span className={`text-xs font-semibold ${isToday ? "text-ocean-600" : isPast ? "text-gray-400" : "text-gray-700"}`}>{day}</span>
                      {slot && !isPast && (
                        <div className="mt-0.5">
                          <div className="flex items-center gap-1">
                            <div className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                            <span className={`text-[10px] font-medium ${style.text} leading-none`}>{style.label}</span>
                          </div>
                          {slot.notes && (
                            <p className="text-[9px] text-gray-400 truncate mt-0.5 leading-tight">{slot.notes}</p>
                          )}
                          {slot.start_time && (
                            <p className="text-[9px] text-gray-400 mt-0.5">{slot.start_time}–{slot.end_time || "?"}</p>
                          )}
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute top-1 right-1">
                          <svg className="w-3.5 h-3.5 text-ocean-500" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Legend + Quick set */}
            <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
              <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-green-500" /> Available</div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-ocean-500" /> Booked</div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500" /> Blocked</div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Maintenance</div>
              </div>
              <p className="text-xs text-gray-400">Click to select · Double-click to cycle status · Shift+click for multi-select</p>
            </div>
          </div>

          {/* Right: Actions panel */}
          <div className="lg:w-72 shrink-0 space-y-4">
            {/* Quick select */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Select</h3>
              <div className="space-y-2">
                <button onClick={() => handleQuickSet("weekends")} className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-gray-50 text-gray-700 transition-colors">Select all weekends</button>
                <button onClick={() => handleQuickSet("weekdays")} className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-gray-50 text-gray-700 transition-colors">Select all weekdays</button>
                <button onClick={() => handleQuickSet("all")} className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-gray-50 text-gray-700 transition-colors">Select entire month</button>
                {selectedDates.size > 0 && (
                  <button onClick={() => setSelectedDates(new Set())} className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-gray-50 text-red-500 transition-colors">Clear selection</button>
                )}
              </div>
            </div>

            {/* Bulk actions */}
            {selectedDates.size > 0 && (
              <div className="bg-ocean-50 rounded-2xl border border-ocean-200 p-4">
                <p className="text-sm font-semibold text-ocean-900 mb-1">{selectedDates.size} date{selectedDates.size !== 1 ? "s" : ""} selected</p>
                <p className="text-xs text-ocean-600 mb-3">Apply status to all selected dates:</p>
                <div className="space-y-2">
                  <button onClick={() => handleBulkAction("available")} className="w-full py-2 text-sm font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">Mark Available</button>
                  <button onClick={() => handleBulkAction("blocked_manual")} className="w-full py-2 text-sm font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">Block Dates</button>
                  <button onClick={() => handleBulkAction("blocked_maintenance")} className="w-full py-2 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors">Maintenance</button>
                </div>
              </div>
            )}

            {/* Slot detail editor */}
            {editingSlot && (
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {new Date(editingSlot.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </h3>
                  <button onClick={() => setEditingSlot(null)} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="space-y-3">
                  <div className={`px-3 py-2 rounded-lg text-sm font-medium ${getStatusStyle(editingSlot.status).bg} ${getStatusStyle(editingSlot.status).text}`}>
                    Status: {getStatusStyle(editingSlot.status).label}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Time window</label>
                    <div className="flex gap-2">
                      <input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)}
                        className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-900 focus:ring-1 focus:ring-ocean-500" />
                      <span className="text-gray-400 self-center text-xs">to</span>
                      <input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)}
                        className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-900 focus:ring-1 focus:ring-ocean-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Notes</label>
                    <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={2} placeholder="Private booking note..."
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-900 resize-none focus:ring-1 focus:ring-ocean-500" />
                  </div>
                  <button onClick={handleSaveSlotDetails} className="w-full py-2 text-sm font-medium bg-ocean-500 text-white rounded-lg hover:bg-ocean-600 transition-colors">
                    Save Details
                  </button>
                </div>
              </div>
            )}

            {/* Tips */}
            {!editingSlot && selectedDates.size === 0 && (
              <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Tips</h3>
                <ul className="text-xs text-gray-500 space-y-1.5">
                  <li>Click a date with status to edit details</li>
                  <li>Double-click to cycle through statuses</li>
                  <li>Use Quick Select for bulk operations</li>
                  <li>Shift+click to add to multi-select</li>
                  <li>Add time windows and notes per date</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
