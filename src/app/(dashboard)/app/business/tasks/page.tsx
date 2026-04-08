"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import { formatDate } from "@/lib/types";

interface HostTask {
  id: string;
  boat_id: string | null;
  experience_id: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

const CATEGORIES = ["all", "cleaning", "maintenance", "prep", "other"] as const;
const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
const STATUSES = ["pending", "in_progress", "completed"] as const;

export default function TasksPage() {
  const [tasks, setTasks] = useState<HostTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "in_progress" | "completed">("all");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category: "prep", priority: "medium", due_date: "" });

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    const supabase = createBrowserSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("host_tasks")
      .select("*")
      .eq("host_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setTasks(data as HostTask[]);
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createBrowserSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("host_tasks").insert({
      host_id: user.id,
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category,
      priority: form.priority,
      status: "pending",
      due_date: form.due_date || null,
    });

    setShowForm(false);
    setForm({ title: "", description: "", category: "prep", priority: "medium", due_date: "" });
    setSaving(false);
    loadTasks();
  }

  async function updateStatus(taskId: string, newStatus: string) {
    const supabase = createBrowserSupabase();
    const updates: any = { status: newStatus };
    if (newStatus === "completed") updates.completed_at = new Date().toISOString();
    await supabase.from("host_tasks").update(updates).eq("id", taskId);
    loadTasks();
  }

  async function deleteTask(taskId: string) {
    const supabase = createBrowserSupabase();
    await supabase.from("host_tasks").delete().eq("id", taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  const filtered = filter === "all" ? tasks : tasks.filter((t) => t.status === filter);
  const counts = {
    all: tasks.length,
    pending: tasks.filter((t) => t.status === "pending").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
  };

  const priorityColor: Record<string, string> = { low: "bg-gray-400", medium: "bg-blue-400", high: "bg-orange-500", urgent: "bg-red-500" };
  const categoryIcon: Record<string, string> = { cleaning: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z", maintenance: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0", prep: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4", other: "M12 6v6m0 0v6m0-6h6m-6 0H6" };

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Tasks</h1>
          <p className="text-gray-500">Track prep, cleaning, maintenance, and more.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-ocean-500 text-white text-sm font-semibold rounded-xl hover:bg-ocean-600 transition-colors">
          + New Task
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 space-y-4">
          <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="Task title..."
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500" />
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description (optional)" rows={2}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500 resize-none" />
          <div className="grid grid-cols-3 gap-3">
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white">
              {CATEGORIES.filter((c) => c !== "all").map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white">
              {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
            <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-5 py-2 bg-ocean-500 text-white text-sm font-semibold rounded-xl hover:bg-ocean-600 transition-colors disabled:opacity-50">
              {saving ? "Creating..." : "Create Task"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {(["all", "pending", "in_progress", "completed"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter === f ? "bg-gray-900 text-white" : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"}`}>
            {f === "in_progress" ? "Active" : f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-200 rounded-2xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">No tasks</h2>
          <p className="text-sm text-gray-500">Create a task to start tracking work.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((task) => {
            const isOverdue = task.due_date && task.status !== "completed" && task.due_date < new Date().toISOString().split("T")[0];
            return (
              <div key={task.id} className={`bg-white rounded-xl border p-4 ${isOverdue ? "border-red-200" : "border-gray-200"}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-2 ${priorityColor[task.priority] || "bg-gray-400"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={`text-sm font-semibold ${task.status === "completed" ? "text-gray-400 line-through" : "text-gray-900"}`}>{task.title}</h3>
                      {isOverdue && <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">OVERDUE</span>}
                    </div>
                    {task.description && <p className="text-xs text-gray-500 mb-2">{task.description}</p>}
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{task.category}</span>
                      <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{task.priority}</span>
                      {task.due_date && <span className={`px-2 py-0.5 rounded-full ${isOverdue ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-600"}`}>Due {formatDate(task.due_date)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {task.status !== "completed" && (
                      <button onClick={() => updateStatus(task.id, task.status === "pending" ? "in_progress" : "completed")}
                        className="p-1.5 hover:bg-green-50 rounded-lg text-green-600 transition-colors" title={task.status === "pending" ? "Start" : "Complete"}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d={task.status === "pending" ? "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" : "M5 13l4 4L19 7"} />
                        </svg>
                      </button>
                    )}
                    <button onClick={() => deleteTask(task.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors">
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
