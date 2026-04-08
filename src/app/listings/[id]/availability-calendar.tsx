"use client";

import { useEffect, useState } from "react";

interface Slot {
  date: string;
  status: string;
}

export default function AvailabilityCalendar({ listingId }: { listingId: string }) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [viewDate, setViewDate] = useState(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const startOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).toISOString().split("T")[0];
    const endOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).toISOString().split("T")[0];

    setLoading(true);
    fetch(
      `/api/availability?listing_id=${listingId}&start=${startOfMonth}&end=${endOfMonth}`,
    )
      .then((r) => r.json())
      .then((data) => {
        setSlots(data.slots || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [listingId, viewDate]);

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
  const monthName = viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const today = new Date().toISOString().split("T")[0];

  const slotsByDate = new Map<string, string>();
  slots.forEach((s) => slotsByDate.set(s.date, s.status));

  return (
    <div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Month nav */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <button
            onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1))}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-gray-900">{monthName}</span>
          <button
            onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1))}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 text-center border-b border-gray-100">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <div key={d} className="py-1.5 text-[11px] font-medium text-gray-500">{d}</div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`e-${i}`} className="aspect-square" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const status = slotsByDate.get(dateStr);
            const isPast = dateStr < today;
            const isToday = dateStr === today;

            let bgClass = "";
            if (isPast) {
              bgClass = "text-gray-300";
            } else if (status === "available") {
              bgClass = "bg-green-50 text-green-700 font-semibold";
            } else if (status === "booked") {
              bgClass = "bg-gray-100 text-gray-400 line-through";
            } else if (status === "blocked_manual" || status === "blocked_maintenance") {
              bgClass = "bg-gray-100 text-gray-400";
            } else {
              bgClass = "text-gray-500";
            }

            return (
              <div
                key={day}
                className={`aspect-square flex items-center justify-center text-xs ${bgClass} ${isToday ? "ring-1 ring-inset ring-ocean-500 rounded-full" : ""}`}
              >
                {day}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-2 text-[11px] text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm bg-green-50 border border-green-200" />
          Available
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm bg-gray-100 border border-gray-200" />
          Booked
        </div>
      </div>

      {loading && (
        <p className="text-xs text-gray-400 mt-2">Loading availability...</p>
      )}
    </div>
  );
}
