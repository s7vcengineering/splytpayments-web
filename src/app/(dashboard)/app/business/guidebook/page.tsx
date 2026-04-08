"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";

interface GuidebookSection {
  id: string;
  experience_id: string | null;
  experience_title: string | null;
  section_type: string;
  title: string;
  content: string;
  sort_order: number;
  is_visible: boolean;
  created_at: string;
}

interface Experience {
  id: string;
  title: string;
}

const SECTION_TYPES = [
  { value: "welcome", label: "Welcome Message", icon: "M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" },
  { value: "directions", label: "Getting There", icon: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" },
  { value: "what_to_bring", label: "What to Bring", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  { value: "rules", label: "House Rules", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" },
  { value: "parking", label: "Parking Info", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
  { value: "safety", label: "Safety Info", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
  { value: "wifi", label: "WiFi / Access", icon: "M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" },
  { value: "faq", label: "FAQ", icon: "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { value: "custom", label: "Custom Section", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" },
] as const;

export default function GuidebookPage() {
  const [sections, setSections] = useState<GuidebookSection[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    experience_id: "",
    section_type: "welcome",
    title: "",
    content: "",
  });

  useEffect(() => { load(); }, []);

  async function load() {
    const supabase = createBrowserSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: secData }, { data: expData }] = await Promise.all([
      supabase
        .from("guidebook_sections")
        .select("*")
        .eq("host_id", user.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("experiences")
        .select("id, title")
        .eq("host_id", user.id)
        .in("status", ["open", "filling", "draft"]),
    ]);

    if (secData) setSections(secData as GuidebookSection[]);
    if (expData) setExperiences(expData as Experience[]);
    setLoading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createBrowserSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const exp = experiences.find((x) => x.id === form.experience_id);
    const payload = {
      host_id: user.id,
      experience_id: form.experience_id || null,
      experience_title: exp?.title || null,
      section_type: form.section_type,
      title: form.title.trim(),
      content: form.content.trim(),
      sort_order: editingId ? undefined : sections.length,
      is_visible: true,
    };

    if (editingId) {
      await supabase.from("guidebook_sections").update(payload).eq("id", editingId);
    } else {
      await supabase.from("guidebook_sections").insert(payload);
    }

    setShowForm(false);
    setEditingId(null);
    setForm({ experience_id: "", section_type: "welcome", title: "", content: "" });
    setSaving(false);
    load();
  }

  function startEdit(section: GuidebookSection) {
    setForm({
      experience_id: section.experience_id || "",
      section_type: section.section_type,
      title: section.title,
      content: section.content,
    });
    setEditingId(section.id);
    setShowForm(true);
  }

  async function toggleVisibility(id: string, visible: boolean) {
    const supabase = createBrowserSupabase();
    await supabase.from("guidebook_sections").update({ is_visible: !visible }).eq("id", id);
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, is_visible: !visible } : s)));
  }

  async function deleteSection(id: string) {
    const supabase = createBrowserSupabase();
    await supabase.from("guidebook_sections").delete().eq("id", id);
    setSections((prev) => prev.filter((s) => s.id !== id));
  }

  async function reorder(id: string, direction: "up" | "down") {
    const idx = sections.findIndex((s) => s.id === id);
    if ((direction === "up" && idx === 0) || (direction === "down" && idx === sections.length - 1)) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const supabase = createBrowserSupabase();
    await Promise.all([
      supabase.from("guidebook_sections").update({ sort_order: swapIdx }).eq("id", sections[idx].id),
      supabase.from("guidebook_sections").update({ sort_order: idx }).eq("id", sections[swapIdx].id),
    ]);
    load();
  }

  const grouped = new Map<string, GuidebookSection[]>();
  sections.forEach((s) => {
    const key = s.experience_id || "global";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(s);
  });

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Guidebook</h1>
          <p className="text-gray-500">Info guests see before and after booking.</p>
        </div>
        <button onClick={() => { setEditingId(null); setForm({ experience_id: "", section_type: "welcome", title: "", content: "" }); setShowForm(!showForm); }}
          className="px-4 py-2 bg-ocean-500 text-white text-sm font-semibold rounded-xl hover:bg-ocean-600 transition-colors">
          + Add Section
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Section Type</label>
              <select value={form.section_type} onChange={(e) => setForm({ ...form, section_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white">
                {SECTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">For Experience</label>
              <select value={form.experience_id} onChange={(e) => setForm({ ...form, experience_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white">
                <option value="">All Experiences (Global)</option>
                {experiences.map((exp) => <option key={exp.id} value={exp.id}>{exp.title}</option>)}
              </select>
            </div>
          </div>

          <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required
            placeholder="Section title (e.g. How to find the dock)"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500" />

          <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} required
            placeholder="Content... (Markdown supported)" rows={6}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500 resize-none font-mono text-[13px]" />

          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-5 py-2 bg-ocean-500 text-white text-sm font-semibold rounded-xl hover:bg-ocean-600 disabled:opacity-50">
              {saving ? "Saving..." : editingId ? "Update Section" : "Add Section"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }}
              className="px-5 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200">Cancel</button>
          </div>
        </form>
      )}

      {/* Quick-add templates */}
      {!showForm && sections.length === 0 && !loading && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Quick Start Templates</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SECTION_TYPES.filter((t) => t.value !== "custom").map((t) => (
              <button key={t.value} onClick={() => { setForm({ experience_id: "", section_type: t.value, title: t.label, content: "" }); setShowForm(true); }}
                className="flex items-center gap-2 p-3 rounded-xl border border-gray-200 hover:border-ocean-300 hover:bg-ocean-50/50 transition-colors text-left">
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
                </svg>
                <span className="text-xs font-medium text-gray-700">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-24 bg-gray-200 rounded-2xl animate-pulse" />)}</div>
      ) : sections.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">No guidebook sections</h2>
          <p className="text-sm text-gray-500">Add sections to help guests prepare for their experience.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sections.map((sec, idx) => {
            const typeInfo = SECTION_TYPES.find((t) => t.value === sec.section_type);
            return (
              <div key={sec.id} className={`bg-white rounded-xl border p-4 ${sec.is_visible ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={typeInfo?.icon || SECTION_TYPES[8].icon} />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-gray-900">{sec.title}</h3>
                      <span className="text-[10px] font-medium bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                        {typeInfo?.label || sec.section_type}
                      </span>
                      {sec.experience_title && (
                        <span className="text-[10px] font-medium bg-ocean-50 text-ocean-600 px-1.5 py-0.5 rounded">
                          {sec.experience_title}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2">{sec.content}</p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => reorder(sec.id, "up")} disabled={idx === 0}
                      className="p-1 hover:bg-gray-100 rounded text-gray-400 disabled:opacity-30">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button onClick={() => reorder(sec.id, "down")} disabled={idx === sections.length - 1}
                      className="p-1 hover:bg-gray-100 rounded text-gray-400 disabled:opacity-30">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <button onClick={() => startEdit(sec)} className="p-1 hover:bg-blue-50 rounded text-gray-400 hover:text-blue-500">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => toggleVisibility(sec.id, sec.is_visible)}
                      className={`p-1 rounded ${sec.is_visible ? "hover:bg-gray-100 text-gray-400" : "hover:bg-green-50 text-gray-300"}`}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={sec.is_visible ? "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" : "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"} />
                      </svg>
                    </button>
                    <button onClick={() => deleteSection(sec.id)} className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500">
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
