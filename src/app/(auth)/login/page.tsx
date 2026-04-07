"use client";

import { Suspense, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const router = useRouter();
  const next = searchParams.get("next") || "/app";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createBrowserSupabase();

    // Try email login first
    let loginEmail = email;

    // If input doesn't look like an email, resolve username
    if (!email.includes("@")) {
      const { data } = await supabase.rpc("resolve_username", {
        p_username: email,
      });
      if (data) {
        loginEmail = data;
      } else {
        setError("Username not found");
        setLoading(false);
        return;
      }
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push(next);
  }

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left side — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-ocean-500 to-ocean-600 items-center justify-center p-12">
        <div className="max-w-md text-white">
          <div className="flex items-center gap-3 mb-8">
            <img src="/app-icon.png" alt="SPLYT" className="w-12 h-12 rounded-xl" />
            <span className="text-3xl font-extrabold tracking-tight">SPLYT</span>
          </div>
          <h2 className="text-4xl font-bold leading-tight mb-4">
            Premium experiences,<br />split your way.
          </h2>
          <p className="text-lg text-white/80 leading-relaxed">
            Sign in to manage your bookings, splits, listings, and everything
            else — all in one place.
          </p>
          <div className="flex gap-8 mt-12">
            <div>
              <div className="text-3xl font-bold">8,500+</div>
              <div className="text-sm text-white/60 mt-1">Listings</div>
            </div>
            <div>
              <div className="text-3xl font-bold">29</div>
              <div className="text-sm text-white/60 mt-1">Cities</div>
            </div>
            <div>
              <div className="text-3xl font-bold">5</div>
              <div className="text-sm text-white/60 mt-1">Categories</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side — form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <img src="/app-icon.png" alt="SPLYT" className="w-9 h-9 rounded-lg" />
            <span className="text-xl font-extrabold text-ocean-500">SPLYT</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome back</h1>
          <p className="text-gray-500 mb-8">
            Sign in with your email or username.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email or Username
              </label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500 transition-all"
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gray-900 text-white font-semibold rounded-xl hover:bg-black transition-colors disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-ocean-500 font-medium hover:underline">
              Sign up
            </Link>
          </div>

          <div className="mt-3 text-center text-sm text-gray-500">
            Want to list your business?{" "}
            <Link href="/signup?role=partner" className="text-ocean-500 font-medium hover:underline">
              Become a Partner
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t text-center">
            <Link
              href="/"
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              &larr; Back to marketplace
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
