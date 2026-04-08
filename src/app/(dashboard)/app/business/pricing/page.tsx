"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/types";

interface PricingRule {
  id: string;
  experience_id: string;
  experience_title: string;
  rule_type: "date_override" | "seasonal" | "early_bird" | "last_minute" | "weekend" | "group_discount";
  name: string;
  modifier_type: "fixed" | "percentage";
  modifier_value: number;
  start_date: string | null;
  end_date: string | null;
  min_days_before: number | null;
  max_days_before: number | null;
  min_guests: number | null;
  is_active: boolean;
  created_at: string;
}

interface Experience {
  id: string;
  title: string;
  total_cost: number;
}

const RULE_TYPES = [
  { value: "date_override", label: "Date Override", desc: "Set a specific price for certain dates" },
  { value: "seasonal", label: "Seasonal", desc: "Higher or lower rates for a season" },
  { value: "early_bird", label: "Early Bird", desc: "Discount for booking ahead of time" },
  { value: "last_minute", label: "Last Minute", desc: "Discount for last-minute bookings" },
  { value: "weekend", label: "Weekend", desc: "Different pricing for Fri–Sun" },
  { value: "group_discount", label: "Group Discount", desc: "Discount when group reaches a size" },
] as const;

export default function PricingPage() {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    experience_id: "",
    rule_type: "early_bird" as PricingRule["rule_type"],
    name: "",
    modifier_type: "percentage" as "fixed" | "percentage",
    modifier_value: "",
    start_date: "",
    end_date: "",
    min_days_before: "",
    max_days_before: "",
    min_guests: "",
  });

  useEffect(() => { load(); }, []);

  async function load() {
    const supabase = createBrowserSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: rulesData }, { data: expData }] = await Promise.all([
      supabase
        .from("pricing_rules")
        .select("*")
        .eq("host_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("experiences")
        .select("id, title, total_cost")
        .eq("host_id", user.id)
        .in("status", ["open", "filling", "draft"]),
    ]);

    if (rulesData) setRules(rulesData as PricingRule[]);
    if (expData) setExperiences(expData as Experience[]);
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createBrowserSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const exp = experiences.find((x) => x.id === form.experience_id);

    await supabase.from("pricing_rules").insert({
      host_id: user.id,
      experience_id: form.experience_id || null,
      experience_title: exp?.title || "All Listings",
      rule_type: form.rule_type,
      name: form.name.trim(),
      modifier_type: form.modifier_type,
      modifier_value: Number(form.modifier_value),
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      min_days_before: form.min_days_before ? Number(form.min_days_before) : null,
      max_days_before: form.max_days_before ? Number(form.max_days_before) : null,
      min_guests: form.min_guests ? Number(form.min_guests) : null,
      is_active: true,
    });

    setShowForm(false);
    setForm({ experience_id: "", rule_type: "early_bird", name: "", modifier_type: "percentage", modifier_value: "", start_date: "", end_date: "", min_days_before: "", max_days_before: "", min_guests: "" });
    setSaving(false);
    load();
  }

  async function toggleRule(id: string, active: boolean) {
    const supabase = createBrowserSupabase();
    await supabase.from("pricing_rules").update({ is_active: !active }).eq("id", id);
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, is_active: !active } : r)));
  }

  async function deleteRule(id: string) {
    const supabase = createBrowserSupabase();
    await supabase.from("pricing_rules").delete().eq("id", id);
    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  const needsDates = ["date_override", "seasonal"].includes(form.rule_type);
  const needsDaysBefore = ["early_bird", "last_minute"].includes(form.rule_type);
  const needsGuests = form.rule_type === "group_discount";

  function formatModifier(rule: PricingRule) {
    const sign = rule.modifier_value < 0 ? "" : "+";
    if (rule.modifier_type === "percentage") return `${sign}${rule.modifier_value}%`;
    return `${sign}${formatCurrency(rule.modifier_value)}`;
  }

  const ruleTypeColors: Record<string, { bg: string; text: string }> = {
    date_override: { bg: "bg-blue-50", text: "text-blue-600" },
    seasonal: { bg: "bg-amber-50", text: "text-amber-600" },
    early_bird: { bg: "bg-green-50", text: "text-green-600" },
    last_minute: { bg: "bg-purple-50", text: "text-purple-600" },
    weekend: { bg: "bg-orange-50", text: "text-orange-600" },
    group_discount: { bg: "bg-cyan-50", text: "text-cyan-600" },
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Pricing Rules</h1>
          <p className="text-gray-500">{rules.length} rules · {rules.filter((r) => r.is_active).length} active</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-ocean-500 text-white text-sm font-semibold rounded-xl hover:bg-ocean-600 transition-colors">
          + New Rule
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Rule Type</label>
              <select value={form.rule_type} onChange={(e) => setForm({ ...form, rule_type: e.target.value as PricingRule["rule_type"] })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white">
                {RULE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">{RULE_TYPES.find((t) => t.value === form.rule_type)?.desc}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Applies To</label>
              <select value={form.experience_id} onChange={(e) => setForm({ ...form, experience_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white">
                <option value="">All Listings</option>
                {experiences.map((exp) => <option key={exp.id} value={exp.id}>{exp.title}</option>)}
              </select>
            </div>
          </div>

          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Rule name (e.g. Summer Premium, Early Bird 10%)"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Modifier Type</label>
              <select value={form.modifier_type} onChange={(e) => setForm({ ...form, modifier_type: e.target.value as "fixed" | "percentage" })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white">
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount ($)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Value</label>
              <input type="number" value={form.modifier_value} onChange={(e) => setForm({ ...form, modifier_value: e.target.value })} required
                placeholder={form.modifier_type === "percentage" ? "e.g. -10 for 10% off" : "e.g. -50 for $50 off"}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900" />
            </div>
          </div>

          {needsDates && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900" />
              </div>
            </div>
          )}

          {needsDaysBefore && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Min Days Before Event</label>
                <input type="number" value={form.min_days_before} onChange={(e) => setForm({ ...form, min_days_before: e.target.value })} min={0}
                  placeholder={form.rule_type === "early_bird" ? "e.g. 14" : "e.g. 0"}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Max Days Before Event</label>
                <input type="number" value={form.max_days_before} onChange={(e) => setForm({ ...form, max_days_before: e.target.value })} min={0}
                  placeholder={form.rule_type === "early_bird" ? "e.g. 60" : "e.g. 3"}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900" />
              </div>
            </div>
          )}

          {needsGuests && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Minimum Guests for Discount</label>
              <input type="number" value={form.min_guests} onChange={(e) => setForm({ ...form, min_guests: e.target.value })} min={2}
                placeholder="e.g. 8"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900" />
            </div>
          )}

          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-5 py-2 bg-ocean-500 text-white text-sm font-semibold rounded-xl hover:bg-ocean-600 disabled:opacity-50">
              {saving ? "Saving..." : "Create Rule"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-200 rounded-2xl animate-pulse" />)}</div>
      ) : rules.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">No pricing rules</h2>
          <p className="text-sm text-gray-500 mb-4">Create rules to automatically adjust pricing based on dates, booking timing, or group size.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto text-left">
            {RULE_TYPES.slice(0, 3).map((t) => (
              <div key={t.value} className="p-3 bg-gray-50 rounded-xl">
                <p className="text-xs font-semibold text-gray-900">{t.label}</p>
                <p className="text-[11px] text-gray-500">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const tc = ruleTypeColors[rule.rule_type] || ruleTypeColors.date_override;
            return (
              <div key={rule.id} className={`bg-white rounded-xl border p-4 ${rule.is_active ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg ${tc.bg} flex items-center justify-center shrink-0`}>
                    <span className={`text-[10px] font-bold ${tc.text} uppercase leading-tight text-center`}>
                      {rule.rule_type === "date_override" ? "DATE" : rule.rule_type === "early_bird" ? "EARLY" : rule.rule_type === "last_minute" ? "LAST" : rule.rule_type.slice(0, 4).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-gray-900">{rule.name}</h3>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${rule.modifier_value < 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
                        {formatModifier(rule)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className={`px-2 py-0.5 rounded-full ${tc.bg} ${tc.text}`}>
                        {RULE_TYPES.find((t) => t.value === rule.rule_type)?.label}
                      </span>
                      <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {rule.experience_title || "All Listings"}
                      </span>
                      {rule.start_date && rule.end_date && (
                        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {rule.start_date} → {rule.end_date}
                        </span>
                      )}
                      {rule.min_days_before != null && (
                        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {rule.min_days_before}–{rule.max_days_before || "∞"} days before
                        </span>
                      )}
                      {rule.min_guests != null && (
                        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {rule.min_guests}+ guests
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleRule(rule.id, rule.is_active)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${rule.is_active ? "bg-green-50 text-green-600 hover:bg-green-100" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                      {rule.is_active ? "Active" : "Paused"}
                    </button>
                    <button onClick={() => deleteRule(rule.id)}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
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
