"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import type { Invoice } from "@/lib/types";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/types";

export default function RevenuePage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pledgeTotal, setPledgeTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;

      // Get host's experience IDs first
      const { data: exps } = await supabase
        .from("experiences")
        .select("id")
        .eq("host_id", user.id);
      const expIds = exps?.map((e: any) => e.id) || [];

      if (expIds.length === 0) { setLoading(false); return; }

      const [invoicesRes, pledgesRes] = await Promise.all([
        supabase
          .from("invoices")
          .select("*, experience:experiences(id,title,photo_urls,date_time,location)")
          .in("experience_id", expIds)
          .order("created_at", { ascending: false }),
        supabase
          .from("pledges")
          .select("amount")
          .in("experience_id", expIds)
          .in("status", ["active", "fulfilled"]),
      ]);

      if (invoicesRes.data) setInvoices(invoicesRes.data as Invoice[]);
      const total = pledgesRes.data?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;
      setPledgeTotal(total);
      setLoading(false);
    });
  }, []);

  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total_amount, 0);
  const disbursed = invoices.filter((i) => i.status === "disbursed").reduce((sum, inv) => sum + inv.total_amount, 0);
  const pending = invoices.filter((i) => i.status === "pending").reduce((sum, inv) => sum + inv.total_amount, 0);

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Revenue</h1>
      <p className="text-gray-500 mb-6">Track your earnings, invoices, and payout history.</p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Total Pledged</p>
          <p className="text-2xl font-bold text-gray-900">{loading ? "..." : formatCurrency(pledgeTotal)}</p>
        </div>
        <div className="bg-ocean-50 border border-ocean-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Total Invoiced</p>
          <p className="text-2xl font-bold text-gray-900">{loading ? "..." : formatCurrency(totalInvoiced)}</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Disbursed</p>
          <p className="text-2xl font-bold text-gray-900">{loading ? "..." : formatCurrency(disbursed)}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Pending</p>
          <p className="text-2xl font-bold text-gray-900">{loading ? "..." : formatCurrency(pending)}</p>
        </div>
      </div>

      {/* Invoices table */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoices</h2>
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse h-16" />)}
        </div>
      ) : invoices.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">No invoices yet.</p>
          <p className="text-xs text-gray-400 mt-1">Revenue from your experiences will appear here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Experience</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Per Person</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Members</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {invoices.map((inv) => {
                  const statusColors: Record<string, string> = { pending: "bg-amber-50 text-amber-600", approved: "bg-green-50 text-green-600", disbursed: "bg-blue-50 text-blue-600", cancelled: "bg-gray-100 text-gray-500" };
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">
                        {inv.experience?.title || "—"}
                      </td>
                      <td className="px-4 py-3 font-semibold">{formatCurrency(inv.total_amount)}</td>
                      <td className="px-4 py-3 text-gray-600">{formatCurrency(inv.per_person)}</td>
                      <td className="px-4 py-3 text-gray-600">{inv.member_count}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[inv.status] || "bg-gray-100 text-gray-500"}`}>{inv.status}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(inv.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
