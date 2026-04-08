"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import { formatCurrency, formatDate } from "@/lib/types";

interface PromoCode {
  id: string;
  code: string;
  experience_id: string | null;
  experience_title: string | null;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  max_uses: number | null;
  current_uses: number;
  min_booking_amount: number | null;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

interface Experience {
  id: string;
  title: string;
}

export default function PromosPage() {
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "",
    experience_id: "",
    discount_type: "percentage" as "percentage" | "fixed",
    discount_value: "",
    max_uses: "",
    min_booking_amount: "",
    valid_from: "",
    valid_until: "",
  });

  useEffect(() => { load(); }, []);

  async function load() {
    const supabase = createBrowserSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: promoData }, { data: expData }] = await Promise.all([
      supabase
        .from("promo_codes")
        .select("*")
        .eq("host_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("experiences")
        .select("id, title")
        .eq("host_id", user.id)
        .in("status", ["open", "filling", "draft"]),
    ]);

    if (promoData) setPromos(promoData as PromoCode[]);
    if (expData) setExperiences(expData as Experience[]);
    setLoading(false);
  }

  function generateCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "SPLYT";
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
    setForm({ ...form, code });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createBrowserSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const exp = experiences.find((x) => x.id === form.experience_id);

    await supabase.from("promo_codes").insert({
      host_id: user.id,
      code: form.code.toUpperCase().trim(),
      experience_id: form.experience_id || null,
      experience_title: exp?.title || null,
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      current_uses: 0,
      min_booking_amount: form.min_booking_amount ? Number(form.min_booking_amount) : null,
      valid_from: form.valid_from || null,
      valid_until: form.valid_until || null,
      is_active: true,
    });

    setShowForm(false);
    setForm({ code: "", experience_id: "", discount_type: "percentage", discount_value: "", max_uses: "", min_booking_amount: "", valid_from: "", valid_until: "" });
    setSaving(false);
    load();
  }

  async function togglePromo(id: string, active: boolean) {
    const supabase = createBrowserSupabase();
    await supabase.from("promo_codes").update({ is_active: !active }).eq("id", id);
    setPromos((prev) => prev.map((p) => (p.id === id ? { ...p, is_active: !active } : p)));
  }

  async function deletePromo(id: string) {
    const supabase = createBrowserSupabase();
    await supabase.from("promo_codes").delete().eq("id", id);
    setPromos((prev) => prev.filter((p) => p.id !== id));
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }

  const today = new Date().toISOString().split("T")[0];
  const active = promos.filter((p) => p.is_active && (!p.valid_until || p.valid_until >= today));
  const expired = promos.filter((p) => !p.is_active || (p.valid_until && p.valid_until < today));

  function formatDiscount(promo: PromoCode) {
    if (promo.discount_type === "percentage") return `${promo.discount_value}% off`;
    return `${formatCurrency(promo.discount_value)} off`;
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Promo Codes</h1>
          <p className="text-gray-500">{active.length} active · {promos.reduce((s, p) => s + p.current_uses, 0)} total redemptions</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-ocean-500 text-white text-sm font-semibold rounded-xl hover:bg-ocean-600 transition-colors">
          + Create Code
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Promo Code</label>
              <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required
                placeholder="e.g. SUMMER20" maxLength={20}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500 font-mono font-bold tracking-wider uppercase" />
            </div>
            <button type="button" onClick={generateCode} className="mt-6 px-4 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors whitespace-nowrap">
              Generate
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Discount Type</label>
              <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value as "percentage" | "fixed" })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white">
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount ($)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Discount Value</label>
              <input type="number" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} required min={1}
                max={form.discount_type === "percentage" ? 100 : undefined}
                placeholder={form.discount_type === "percentage" ? "e.g. 20" : "e.g. 50"}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900" />
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

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Max Uses</label>
              <input type="number" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} min={1}
                placeholder="Unlimited"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Min Booking ($)</label>
              <input type="number" value={form.min_booking_amount} onChange={(e) => setForm({ ...form, min_booking_amount: e.target.value })} min={0}
                placeholder="None"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Valid From</label>
              <input type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Valid Until</label>
              <input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900" />
            </div>
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-5 py-2 bg-ocean-500 text-white text-sm font-semibold rounded-xl hover:bg-ocean-600 disabled:opacity-50">
              {saving ? "Creating..." : "Create Promo"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-200 rounded-2xl animate-pulse" />)}</div>
      ) : promos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">No promo codes</h2>
          <p className="text-sm text-gray-500 mb-4">Create codes to offer discounts and attract more guests.</p>
          <div className="flex justify-center gap-4 text-sm text-gray-500">
            <div className="p-3 bg-gray-50 rounded-xl">
              <p className="font-semibold text-gray-900">Percentage</p>
              <p className="text-xs">e.g. 20% off booking</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl">
              <p className="font-semibold text-gray-900">Fixed</p>
              <p className="text-xs">e.g. $50 off total</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl">
              <p className="font-semibold text-gray-900">Limited</p>
              <p className="text-xs">Set max uses or dates</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Active ({active.length})</h2>
              <div className="space-y-3">
                {active.map((promo) => (
                  <PromoCard key={promo.id} promo={promo} copied={copied} onCopy={copyCode} onToggle={togglePromo} onDelete={deletePromo} formatDiscount={formatDiscount} />
                ))}
              </div>
            </div>
          )}
          {expired.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Inactive / Expired ({expired.length})</h2>
              <div className="space-y-3 opacity-60">
                {expired.map((promo) => (
                  <PromoCard key={promo.id} promo={promo} copied={copied} onCopy={copyCode} onToggle={togglePromo} onDelete={deletePromo} formatDiscount={formatDiscount} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PromoCard({ promo, copied, onCopy, onToggle, onDelete, formatDiscount }: {
  promo: PromoCode;
  copied: string | null;
  onCopy: (code: string) => void;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
  formatDiscount: (p: PromoCode) => string;
}) {
  const usagePercent = promo.max_uses ? Math.min((promo.current_uses / promo.max_uses) * 100, 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start gap-3">
        <div className="w-16 h-10 rounded-lg bg-gradient-to-br from-ocean-400 to-ocean-600 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-white tracking-wide">
            {promo.discount_type === "percentage" ? `${promo.discount_value}%` : `$${promo.discount_value}`}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <button onClick={() => onCopy(promo.code)}
              className="text-sm font-bold font-mono tracking-wider text-gray-900 hover:text-ocean-600 transition-colors">
              {promo.code}
            </button>
            {copied === promo.code && <span className="text-[10px] text-green-600 font-medium">Copied!</span>}
            <span className="text-xs font-medium text-ocean-600 bg-ocean-50 px-2 py-0.5 rounded-full">{formatDiscount(promo)}</span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {promo.experience_title || "All listings"}
            </span>
            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {promo.current_uses}{promo.max_uses ? `/${promo.max_uses}` : ""} used
            </span>
            {promo.min_booking_amount != null && promo.min_booking_amount > 0 && (
              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                Min {formatCurrency(promo.min_booking_amount)}
              </span>
            )}
            {promo.valid_from && (
              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                From {formatDate(promo.valid_from)}
              </span>
            )}
            {promo.valid_until && (
              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                Until {formatDate(promo.valid_until)}
              </span>
            )}
          </div>
          {promo.max_uses && (
            <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
              <div className="bg-ocean-400 h-1.5 rounded-full transition-all" style={{ width: `${usagePercent}%` }} />
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onToggle(promo.id, promo.is_active)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${promo.is_active ? "bg-green-50 text-green-600 hover:bg-green-100" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
            {promo.is_active ? "Active" : "Paused"}
          </button>
          <button onClick={() => onDelete(promo.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
