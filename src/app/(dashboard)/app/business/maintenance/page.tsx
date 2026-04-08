"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import { formatCurrency, formatDate } from "@/lib/types";

interface MaintenanceRecord {
  id: string;
  boat_id: string | null;
  experience_id: string | null;
  title: string;
  description: string | null;
  category: string;
  cost: number | null;
  performed_at: string | null;
  next_due_date: string | null;
  performed_by: string | null;
  notes: string | null;
  photo_urls: string[];
  created_at: string;
}

const CATEGORIES = ["all", "engine", "hull", "electrical", "safety", "cleaning", "other"] as const;

export default function MaintenancePage() {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", category: "cleaning", cost: "",
    performed_at: new Date().toISOString().split("T")[0],
    next_due_date: "", performed_by: "", notes: "",
  });

  useEffect(() => { loadRecords(); }, []);

  async function loadRecords() {
    const supabase = createBrowserSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("maintenance_records")
      .select("*")
      .eq("host_id", user.id)
      .order("performed_at", { ascending: false });
    if (data) setRecords(data as MaintenanceRecord[]);
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createBrowserSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("maintenance_records").insert({
      host_id: user.id,
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category,
      cost: form.cost ? Number(form.cost) : null,
      performed_at: form.performed_at || null,
      next_due_date: form.next_due_date || null,
      performed_by: form.performed_by.trim() || null,
      notes: form.notes.trim() || null,
      photo_urls: [],
    });

    setShowForm(false);
    setForm({ title: "", description: "", category: "cleaning", cost: "", performed_at: new Date().toISOString().split("T")[0], next_due_date: "", performed_by: "", notes: "" });
    setSaving(false);
    loadRecords();
  }

  const filtered = category === "all" ? records : records.filter((r) => r.category === category);
  const totalCost = records.reduce((s, r) => s + (r.cost || 0), 0);
  const today = new Date().toISOString().split("T")[0];

  const categoryColors: Record<string, { bg: string; text: string }> = {
    engine: { bg: "bg-red-50", text: "text-red-600" },
    hull: { bg: "bg-blue-50", text: "text-blue-600" },
    electrical: { bg: "bg-amber-50", text: "text-amber-600" },
    safety: { bg: "bg-green-50", text: "text-green-600" },
    cleaning: { bg: "bg-purple-50", text: "text-purple-600" },
    other: { bg: "bg-gray-50", text: "text-gray-600" },
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Maintenance Log</h1>
          <p className="text-gray-500">{records.length} records · {formatCurrency(totalCost)} total spent</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-ocean-500 text-white text-sm font-semibold rounded-xl hover:bg-ocean-600 transition-colors">
          + Add Record
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 space-y-4">
          <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="What was done?"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500" />
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Details..." rows={2}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500 resize-none" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white">
              {CATEGORIES.filter((c) => c !== "all").map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
            <input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="Cost ($)" min={0}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900" />
            <input type="date" value={form.performed_at} onChange={(e) => setForm({ ...form, performed_at: e.target.value })}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900" />
            <input type="date" value={form.next_due_date} onChange={(e) => setForm({ ...form, next_due_date: e.target.value })} placeholder="Next due"
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="text" value={form.performed_by} onChange={(e) => setForm({ ...form, performed_by: e.target.value })} placeholder="Performed by"
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900" />
            <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes"
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-5 py-2 bg-ocean-500 text-white text-sm font-semibold rounded-xl hover:bg-ocean-600 disabled:opacity-50">
              {saving ? "Saving..." : "Add Record"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200">Cancel</button>
          </div>
        </form>
      )}

      {/* Category filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCategory(c)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${category === c ? "bg-gray-900 text-white" : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"}`}>
            {c === "all" ? "All" : c.charAt(0).toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-24 bg-gray-200 rounded-2xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">No records</h2>
          <p className="text-sm text-gray-500">Add a maintenance record to start tracking.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((rec) => {
            const overdue = rec.next_due_date && rec.next_due_date < today;
            const dueSoon = rec.next_due_date && !overdue && rec.next_due_date <= new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
            const cc = categoryColors[rec.category] || categoryColors.other;
            return (
              <div key={rec.id} className={`bg-white rounded-xl border p-4 ${overdue ? "border-red-200" : "border-gray-200"}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg ${cc.bg} flex items-center justify-center shrink-0`}>
                    <span className={`text-xs font-bold ${cc.text} uppercase`}>{rec.category.slice(0, 3)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900">{rec.title}</h3>
                    {rec.description && <p className="text-xs text-gray-500 mt-0.5">{rec.description}</p>}
                    <div className="flex flex-wrap gap-2 mt-2 text-xs">
                      {rec.performed_at && <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Done {formatDate(rec.performed_at)}</span>}
                      {rec.cost != null && rec.cost > 0 && <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{formatCurrency(rec.cost)}</span>}
                      {rec.performed_by && <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">By {rec.performed_by}</span>}
                      {rec.next_due_date && (
                        <span className={`px-2 py-0.5 rounded-full font-medium ${overdue ? "bg-red-50 text-red-600" : dueSoon ? "bg-amber-50 text-amber-600" : "bg-gray-100 text-gray-600"}`}>
                          {overdue ? "OVERDUE" : dueSoon ? "Due soon" : `Next: ${formatDate(rec.next_due_date)}`}
                        </span>
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
