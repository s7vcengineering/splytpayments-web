"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import type { UserProfile } from "@/lib/types";

export default function AppHome() {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (data) setProfile(data as UserProfile);
    });
  }, []);

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        {profile ? `Hey, ${profile.display_name || "there"}` : "Welcome"}
      </h1>
      <p className="text-gray-500 mb-8">Here&apos;s what&apos;s happening with your SPLYT account.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <QuickCard
          title="My Splits"
          description="View experiences you've joined and deposit status"
          href="/app/splits"
          icon="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"
        />
        <QuickCard
          title="Messages"
          description="Chat with your groups and hosts"
          href="/app/messages"
          icon="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
        />
        <QuickCard
          title="Saved"
          description="Experiences you've saved for later"
          href="/app/saved"
          icon="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
        />
        <QuickCard
          title="Wallet"
          description="Check your balance and payment history"
          href="/app/wallet"
          icon="M21 12V7H5a2 2 0 010-4h14v4M3 5v14a2 2 0 002 2h16v-5M18 14a1 1 0 100 2 1 1 0 000-2z"
        />
        <QuickCard
          title="Profile"
          description="Edit your profile and preferences"
          href="/app/profile"
          icon="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"
        />
        <QuickCard
          title="Browse Marketplace"
          description="Discover yachts, cars, stays & experiences"
          href="/"
          icon="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          accent
        />
      </div>
    </div>
  );
}

function QuickCard({
  title,
  description,
  href,
  icon,
  accent,
}: {
  title: string;
  description: string;
  href: string;
  icon: string;
  accent?: boolean;
}) {
  return (
    <a
      href={href}
      className={`block p-5 rounded-2xl border transition-all hover:shadow-md ${
        accent
          ? "bg-ocean-50 border-ocean-200 hover:border-ocean-300"
          : "bg-white border-gray-200 hover:border-gray-300"
      }`}
    >
      <svg
        className={`w-6 h-6 mb-3 ${accent ? "text-ocean-500" : "text-gray-400"}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={icon} />
      </svg>
      <h3 className="text-sm font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
    </a>
  );
}
