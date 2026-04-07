"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import type { UserProfile, PaymentTransaction } from "@/lib/types";
import { formatCurrency, formatDateTime } from "@/lib/types";

export default function WalletPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;

      const [profileRes, txRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase
          .from("payment_transactions")
          .select("*")
          .or(`user_id.eq.${user.id},recipient_id.eq.${user.id}`)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      if (profileRes.data) setProfile(profileRes.data as UserProfile);
      if (txRes.data) setTransactions(txRes.data as PaymentTransaction[]);
      setLoading(false);
    });
  }, []);

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Wallet</h1>
      <p className="text-gray-500 mb-6">Your balance and transaction history.</p>

      {/* Balance card */}
      <div className="bg-gradient-to-br from-ocean-500 to-ocean-600 rounded-2xl p-6 text-white mb-8">
        <p className="text-sm text-white/70 mb-1">Available Balance</p>
        <p className="text-4xl font-bold mb-4">
          {loading ? "..." : formatCurrency(profile?.wallet_balance || 0)}
        </p>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-white text-ocean-600 text-sm font-semibold rounded-xl hover:bg-white/90 transition-colors">
            Add Funds
          </button>
          <button className="px-4 py-2 bg-white/20 text-white text-sm font-semibold rounded-xl hover:bg-white/30 transition-colors">
            Withdraw
          </button>
        </div>
      </div>

      {/* Stripe Connect status (for partners) */}
      {profile && ["captain", "host", "boat_owner", "operator", "fleet_owner", "brand"].includes(profile.role) && (
        <div className={`rounded-2xl border p-4 mb-6 ${
          profile.stripe_connect_onboarded ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              profile.stripe_connect_onboarded ? "bg-green-100" : "bg-amber-100"
            }`}>
              <svg className={`w-5 h-5 ${profile.stripe_connect_onboarded ? "text-green-600" : "text-amber-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {profile.stripe_connect_onboarded
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}
              </svg>
            </div>
            <div>
              <p className={`text-sm font-semibold ${profile.stripe_connect_onboarded ? "text-green-900" : "text-amber-900"}`}>
                {profile.stripe_connect_onboarded ? "Stripe Connect Active" : "Set Up Payouts"}
              </p>
              <p className={`text-xs ${profile.stripe_connect_onboarded ? "text-green-700" : "text-amber-700"}`}>
                {profile.stripe_connect_onboarded
                  ? "You can receive payouts for your experiences."
                  : "Connect your Stripe account to receive payouts from bookings."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Transactions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Transaction History</h2>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-gray-200 rounded w-1/2" />
                  <div className="h-3 bg-gray-200 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <p className="text-sm text-gray-500">No transactions yet.</p>
            <p className="text-xs text-gray-400 mt-1">Deposits and payments will appear here.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
            {transactions.map((tx) => {
              const isIncoming = tx.recipient_id === profile?.id;
              return (
                <div key={tx.id} className="flex items-center gap-3 p-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isIncoming ? "bg-green-50" : "bg-gray-100"}`}>
                    <svg className={`w-5 h-5 ${isIncoming ? "text-green-500" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      {isIncoming
                        ? <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        : <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />}
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {tx.description || tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                    </p>
                    <p className="text-xs text-gray-500">{formatDateTime(tx.created_at)}</p>
                  </div>
                  <span className={`text-sm font-semibold ${isIncoming ? "text-green-600" : "text-gray-900"}`}>
                    {isIncoming ? "+" : "-"}{formatCurrency(tx.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
