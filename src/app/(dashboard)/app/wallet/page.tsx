"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import type { UserProfile, PaymentTransaction } from "@/lib/types";
import { formatCurrency, formatDateTime } from "@/lib/types";

const PRESET_AMOUNTS = [25, 50, 100, 250, 500];

function WalletContent() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [fundAmount, setFundAmount] = useState(50);
  const [customAmount, setCustomAmount] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();

  const loadData = useCallback(async () => {
    const supabase = createBrowserSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
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
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Stripe redirect — verify payment and credit wallet
  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId) return;

    setProcessing(true);
    fetch("/api/stripe/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.credited || data.already_credited) {
          setMessage({
            type: "success",
            text: `${formatCurrency(data.amount)} added to your wallet!`,
          });
          loadData();
        } else {
          setMessage({
            type: "error",
            text: data.error || "Failed to verify payment",
          });
        }
      })
      .catch(() =>
        setMessage({ type: "error", text: "Failed to verify payment" }),
      )
      .finally(() => {
        setProcessing(false);
        router.replace("/app/wallet");
      });
  }, [searchParams, router, loadData]);

  async function handleAddFunds() {
    const amount = useCustom ? Number(customAmount) : fundAmount;
    if (!amount || amount < 5 || amount > 10000) {
      setMessage({
        type: "error",
        text: "Amount must be between $5 and $10,000",
      });
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setMessage({
          type: "error",
          text: data.error || "Failed to create checkout",
        });
        setProcessing(false);
      }
    } catch {
      setMessage({ type: "error", text: "Something went wrong" });
      setProcessing(false);
    }
  }

  async function handleWithdraw() {
    const amount = Number(withdrawAmount);
    if (!amount || amount <= 0) {
      setMessage({ type: "error", text: "Enter a valid amount" });
      return;
    }
    if (amount > (profile?.wallet_balance || 0)) {
      setMessage({ type: "error", text: "Insufficient balance" });
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch("/api/stripe/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({
          type: "success",
          text: `${formatCurrency(amount)} withdrawal requested`,
        });
        setShowWithdraw(false);
        setWithdrawAmount("");
        loadData();
      } else {
        setMessage({ type: "error", text: data.error || "Withdrawal failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Something went wrong" });
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Wallet</h1>
      <p className="text-gray-500 mb-6">
        Your balance and transaction history.
      </p>

      {/* Toast message */}
      {message && (
        <div
          className={`mb-4 rounded-xl p-4 text-sm font-medium flex items-center justify-between ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <span>{message.text}</span>
          <button
            onClick={() => setMessage(null)}
            className="ml-3 text-current opacity-50 hover:opacity-100"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Verifying payment overlay */}
      {processing && searchParams.get("session_id") && (
        <div className="mb-4 rounded-xl bg-ocean-50 border border-ocean-200 p-4 text-sm text-ocean-800 font-medium flex items-center gap-3">
          <svg
            className="w-5 h-5 animate-spin text-ocean-500"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Verifying your payment...
        </div>
      )}

      {/* Balance card */}
      <div className="bg-gradient-to-br from-ocean-500 to-ocean-600 rounded-2xl p-6 text-white mb-8">
        <p className="text-sm text-white/70 mb-1">Available Balance</p>
        <p className="text-4xl font-bold mb-4">
          {loading ? "..." : formatCurrency(profile?.wallet_balance || 0)}
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setShowAddFunds(true);
              setShowWithdraw(false);
              setMessage(null);
            }}
            className="px-4 py-2 bg-white text-ocean-600 text-sm font-semibold rounded-xl hover:bg-white/90 transition-colors"
          >
            Add Funds
          </button>
          <button
            onClick={() => {
              setShowWithdraw(true);
              setShowAddFunds(false);
              setMessage(null);
            }}
            className="px-4 py-2 bg-white/20 text-white text-sm font-semibold rounded-xl hover:bg-white/30 transition-colors"
          >
            Withdraw
          </button>
        </div>
      </div>

      {/* Add Funds modal */}
      {showAddFunds && (
        <div className="mb-8 bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Add Funds</h2>
            <button
              onClick={() => setShowAddFunds(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <p className="text-sm text-gray-500 mb-4">
            Select an amount to add to your SPLYT wallet via Stripe.
          </p>

          {/* Preset amounts */}
          <div className="grid grid-cols-5 gap-2 mb-3">
            {PRESET_AMOUNTS.map((amt) => (
              <button
                key={amt}
                onClick={() => {
                  setFundAmount(amt);
                  setUseCustom(false);
                }}
                className={`py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  !useCustom && fundAmount === amt
                    ? "bg-ocean-500 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                ${amt}
              </button>
            ))}
          </div>

          {/* Custom amount */}
          <div className="mb-4">
            <div
              className={`flex items-center border rounded-xl px-3 py-2.5 transition-colors ${
                useCustom
                  ? "border-ocean-500 ring-1 ring-ocean-500"
                  : "border-gray-200"
              }`}
            >
              <span className="text-gray-400 text-sm mr-1">$</span>
              <input
                type="number"
                placeholder="Custom amount"
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                  setUseCustom(true);
                }}
                onFocus={() => setUseCustom(true)}
                min={5}
                max={10000}
                className="flex-1 text-sm outline-none bg-transparent"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Min $5, max $10,000</p>
          </div>

          <button
            onClick={handleAddFunds}
            disabled={processing}
            className="w-full py-3 bg-ocean-500 text-white text-sm font-semibold rounded-xl hover:bg-ocean-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing
              ? "Redirecting to Stripe..."
              : `Add ${formatCurrency(useCustom ? Number(customAmount) || 0 : fundAmount)}`}
          </button>
        </div>
      )}

      {/* Withdraw modal */}
      {showWithdraw && (
        <div className="mb-8 bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Withdraw</h2>
            <button
              onClick={() => setShowWithdraw(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <p className="text-sm text-gray-500 mb-4">
            Request a withdrawal from your wallet. Withdrawals are typically
            processed within 3-5 business days.
          </p>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount
            </label>
            <div className="flex items-center border border-gray-200 rounded-xl px-3 py-2.5 focus-within:border-ocean-500 focus-within:ring-1 focus-within:ring-ocean-500 transition-colors">
              <span className="text-gray-400 text-sm mr-1">$</span>
              <input
                type="number"
                placeholder="0"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                min={1}
                max={profile?.wallet_balance || 0}
                className="flex-1 text-sm outline-none bg-transparent"
              />
            </div>
            <div className="flex justify-between mt-1">
              <p className="text-xs text-gray-400">Min $1</p>
              <button
                onClick={() =>
                  setWithdrawAmount(
                    String(profile?.wallet_balance || 0),
                  )
                }
                className="text-xs text-ocean-500 hover:text-ocean-600 font-medium"
              >
                Withdraw all
              </button>
            </div>
          </div>

          <button
            onClick={handleWithdraw}
            disabled={processing || !withdrawAmount}
            className="w-full py-3 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing
              ? "Processing..."
              : `Withdraw ${formatCurrency(Number(withdrawAmount) || 0)}`}
          </button>
        </div>
      )}

      {/* Stripe Connect status (for partners) */}
      {profile &&
        [
          "captain",
          "host",
          "boat_owner",
          "operator",
          "fleet_owner",
          "brand",
        ].includes(profile.role) && (
          <div
            className={`rounded-2xl border p-4 mb-6 ${
              profile.stripe_connect_onboarded
                ? "bg-green-50 border-green-200"
                : "bg-amber-50 border-amber-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  profile.stripe_connect_onboarded
                    ? "bg-green-100"
                    : "bg-amber-100"
                }`}
              >
                <svg
                  className={`w-5 h-5 ${profile.stripe_connect_onboarded ? "text-green-600" : "text-amber-600"}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  {profile.stripe_connect_onboarded ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  )}
                </svg>
              </div>
              <div>
                <p
                  className={`text-sm font-semibold ${profile.stripe_connect_onboarded ? "text-green-900" : "text-amber-900"}`}
                >
                  {profile.stripe_connect_onboarded
                    ? "Stripe Connect Active"
                    : "Set Up Payouts"}
                </p>
                <p
                  className={`text-xs ${profile.stripe_connect_onboarded ? "text-green-700" : "text-amber-700"}`}
                >
                  {profile.stripe_connect_onboarded
                    ? "You can receive payouts for your experiences."
                    : "Connect your Stripe account to receive payouts from bookings."}
                </p>
              </div>
              {!profile.stripe_connect_onboarded && (
                <button
                  onClick={async () => {
                    setProcessing(true);
                    try {
                      const res = await fetch("/api/stripe/connect", { method: "POST" });
                      const data = await res.json();
                      if (data.url) window.location.href = data.url;
                      else setMessage({ type: "error", text: data.error || "Failed to start setup" });
                    } catch { setMessage({ type: "error", text: "Something went wrong" }); }
                    finally { setProcessing(false); }
                  }}
                  disabled={processing}
                  className="ml-auto px-4 py-2 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 shrink-0"
                >
                  {processing ? "Loading..." : "Set Up"}
                </button>
              )}
            </div>
          </div>
        )}

      {/* Transactions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Transaction History
        </h2>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse flex items-center gap-3"
              >
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
            <p className="text-xs text-gray-400 mt-1">
              Deposits and payments will appear here.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
            {transactions.map((tx) => {
              const isIncoming = tx.recipient_id === profile?.id;
              return (
                <div key={tx.id} className="flex items-center gap-3 p-4">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${isIncoming ? "bg-green-50" : "bg-gray-100"}`}
                  >
                    <svg
                      className={`w-5 h-5 ${isIncoming ? "text-green-500" : "text-gray-400"}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      {isIncoming ? (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 14l-7 7m0 0l-7-7m7 7V3"
                        />
                      ) : (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 10l7-7m0 0l7 7m-7-7v18"
                        />
                      )}
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {tx.type === "deposit"
                        ? "Wallet Top-Up"
                        : tx.type === "withdrawal"
                          ? "Withdrawal"
                          : (tx.description ||
                            tx.type.charAt(0).toUpperCase() + tx.type.slice(1))}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDateTime(tx.created_at)}
                      {tx.status === "pending" && (
                        <span className="ml-2 text-amber-600 font-medium">
                          Pending
                        </span>
                      )}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-semibold ${isIncoming ? "text-green-600" : "text-gray-900"}`}
                  >
                    {isIncoming ? "+" : "-"}
                    {formatCurrency(tx.amount)}
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

export default function WalletPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 lg:p-8 max-w-3xl">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Wallet</h1>
          <p className="text-gray-500 mb-6">Loading...</p>
        </div>
      }
    >
      <WalletContent />
    </Suspense>
  );
}
