"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";

interface QuickReply {
  id: string;
  name: string;
  shortcut: string;
  content: string;
  category: string;
  use_count: number;
  created_at: string;
}

const CATEGORIES = ["all", "greeting", "booking", "directions", "policy", "custom"] as const;

const TEMPLATES: { name: string; shortcut: string; content: string; category: string }[] = [
  { name: "Welcome", shortcut: "/welcome", content: "Hey! Thanks for your interest in this experience. Let me know if you have any questions — I'm happy to help!", category: "greeting" },
  { name: "Booking Confirmed", shortcut: "/confirmed", content: "Your spot is confirmed! Here are the details:\n\n📍 Meeting point: [location]\n🕐 Time: [time]\n📋 What to bring: [items]\n\nSee you there!", category: "booking" },
  { name: "Directions", shortcut: "/directions", content: "Here's how to find us:\n\n📍 Address: [address]\n🅿️ Parking: [parking info]\n📱 Call me if you get lost: [phone]\n\nLook for [landmark].", category: "directions" },
  { name: "Cancellation Policy", shortcut: "/cancel", content: "Our cancellation policy:\n\n• Full refund: 48+ hours before\n• 50% refund: 24-48 hours before\n• No refund: less than 24 hours\n\nWeather cancellations always get a full refund or reschedule.", category: "policy" },
  { name: "Weather Update", shortcut: "/weather", content: "Quick weather update — looks like we might have [conditions]. Don't worry, we'll monitor it and I'll let you know by [time] if we need to reschedule. Safety first!", category: "policy" },
  { name: "Thank You", shortcut: "/thanks", content: "Thanks so much for joining us today! Hope you had an amazing time. If you enjoyed it, a review would mean the world to us ⭐\n\nHope to see you again soon!", category: "greeting" },
];

export default function QuickRepliesPage() {
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", shortcut: "", content: "", category: "custom" });

  useEffect(() => { load(); }, []);

  async function load() {
    const supabase = createBrowserSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("quick_replies")
      .select("*")
      .eq("host_id", user.id)
      .order("use_count", { ascending: false });
    if (data) setReplies(data as QuickReply[]);
    setLoading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createBrowserSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      host_id: user.id,
      name: form.name.trim(),
      shortcut: form.shortcut.trim().startsWith("/") ? form.shortcut.trim() : `/${form.shortcut.trim()}`,
      content: form.content.trim(),
      category: form.category,
    };

    if (editingId) {
      await supabase.from("quick_replies").update(payload).eq("id", editingId);
    } else {
      await supabase.from("quick_replies").insert({ ...payload, use_count: 0 });
    }

    setShowForm(false);
    setEditingId(null);
    setForm({ name: "", shortcut: "", content: "", category: "custom" });
    setSaving(false);
    load();
  }

  function startEdit(reply: QuickReply) {
    setForm({ name: reply.name, shortcut: reply.shortcut, content: reply.content, category: reply.category });
    setEditingId(reply.id);
    setShowForm(true);
  }

  async function useTemplate(t: typeof TEMPLATES[number]) {
    const supabase = createBrowserSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("quick_replies").insert({
      host_id: user.id,
      name: t.name,
      shortcut: t.shortcut,
      content: t.content,
      category: t.category,
      use_count: 0,
    });
    load();
  }

  async function copyContent(id: string, content: string) {
    await navigator.clipboard.writeText(content);
    // Increment use count
    const supabase = createBrowserSupabase();
    await supabase.rpc("increment_quick_reply_use", { reply_id: id }).catch(() => {
      // Fallback if RPC doesn't exist
      supabase.from("quick_replies").update({ use_count: (replies.find((r) => r.id === id)?.use_count || 0) + 1 }).eq("id", id);
    });
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
    setReplies((prev) => prev.map((r) => (r.id === id ? { ...r, use_count: r.use_count + 1 } : r)));
  }

  async function deleteReply(id: string) {
    const supabase = createBrowserSupabase();
    await supabase.from("quick_replies").delete().eq("id", id);
    setReplies((prev) => prev.filter((r) => r.id !== id));
  }

  const filtered = category === "all" ? replies : replies.filter((r) => r.category === category);

  const categoryColors: Record<string, { bg: string; text: string }> = {
    greeting: { bg: "bg-green-50", text: "text-green-600" },
    booking: { bg: "bg-blue-50", text: "text-blue-600" },
    directions: { bg: "bg-amber-50", text: "text-amber-600" },
    policy: { bg: "bg-red-50", text: "text-red-600" },
    custom: { bg: "bg-gray-50", text: "text-gray-600" },
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Quick Replies</h1>
          <p className="text-gray-500">Message templates you can copy and send instantly.</p>
        </div>
        <button onClick={() => { setEditingId(null); setForm({ name: "", shortcut: "", content: "", category: "custom" }); setShowForm(!showForm); }}
          className="px-4 py-2 bg-ocean-500 text-white text-sm font-semibold rounded-xl hover:bg-ocean-600 transition-colors">
          + New Reply
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Name (e.g. Welcome)"
              className="px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500" />
            <input type="text" value={form.shortcut} onChange={(e) => setForm({ ...form, shortcut: e.target.value })} required placeholder="Shortcut (e.g. /welcome)"
              className="px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500 font-mono" />
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white">
              {CATEGORIES.filter((c) => c !== "all").map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
          <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} required
            placeholder="Message content... Use [placeholders] for parts to customize." rows={4}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500 resize-none" />
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-5 py-2 bg-ocean-500 text-white text-sm font-semibold rounded-xl hover:bg-ocean-600 disabled:opacity-50">
              {saving ? "Saving..." : editingId ? "Update" : "Create Reply"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }}
              className="px-5 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200">Cancel</button>
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
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-1 text-center">
            {replies.length === 0 ? "No quick replies yet" : "No replies in this category"}
          </h2>
          {replies.length === 0 && (
            <>
              <p className="text-sm text-gray-500 text-center mb-4">Start from a template or create your own.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TEMPLATES.map((t) => (
                  <button key={t.shortcut} onClick={() => useTemplate(t)}
                    className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 hover:border-ocean-300 hover:bg-ocean-50/50 transition-colors text-left">
                    <div className="shrink-0 mt-0.5">
                      <span className="text-xs font-mono font-bold text-ocean-500 bg-ocean-50 px-1.5 py-0.5 rounded">{t.shortcut}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t.name}</p>
                      <p className="text-xs text-gray-500 line-clamp-2">{t.content}</p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((reply) => {
            const cc = categoryColors[reply.category] || categoryColors.custom;
            return (
              <div key={reply.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg ${cc.bg} flex items-center justify-center shrink-0`}>
                    <span className={`text-xs font-bold ${cc.text} uppercase`}>{reply.category.slice(0, 3)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-gray-900">{reply.name}</h3>
                      <span className="text-xs font-mono font-medium text-ocean-500 bg-ocean-50 px-1.5 py-0.5 rounded">{reply.shortcut}</span>
                      {reply.use_count > 0 && (
                        <span className="text-[10px] text-gray-400">used {reply.use_count}x</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 whitespace-pre-line line-clamp-3">{reply.content}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => copyContent(reply.id, reply.content)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${copied === reply.id ? "bg-green-50 text-green-600" : "bg-ocean-50 text-ocean-600 hover:bg-ocean-100"}`}>
                      {copied === reply.id ? "Copied!" : "Copy"}
                    </button>
                    <button onClick={() => startEdit(reply)} className="p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-500 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => deleteReply(reply.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors">
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
