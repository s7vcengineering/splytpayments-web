"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase";
import type { Experience, UserProfile, Pledge } from "@/lib/types";
import { formatCurrency, formatDateTime } from "@/lib/types";

interface Member {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  amount: number;
  status: string;
}

export default function ExperienceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [experienceId, setExperienceId] = useState<string | null>(null);
  const [experience, setExperience] = useState<Experience | null>(null);
  const [host, setHost] = useState<Partial<UserProfile> | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [myPledge, setMyPledge] = useState<Pledge | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    params.then((p) => setExperienceId(p.id));
  }, [params]);

  const loadData = useCallback(async () => {
    if (!experienceId) return;
    const supabase = createBrowserSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const [expRes, pledgesRes] = await Promise.all([
      supabase.from("experiences").select("*").eq("id", experienceId).single(),
      supabase
        .from("pledges")
        .select("*, user:profiles!user_id(id, display_name, avatar_url)")
        .eq("experience_id", experienceId)
        .in("status", ["reserved", "active", "fulfilled"]),
    ]);

    if (expRes.data) {
      const exp = expRes.data as Experience;
      setExperience(exp);

      const { data: hostData } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, host_tier, home_city, bio")
        .eq("id", exp.host_id)
        .single();
      if (hostData) setHost(hostData);
    }

    if (pledgesRes.data) {
      const pledges = pledgesRes.data as any[];
      setMembers(
        pledges.map((p) => ({
          id: p.user?.id || p.user_id,
          display_name: p.user?.display_name || "Member",
          avatar_url: p.user?.avatar_url || null,
          amount: p.amount,
          status: p.status,
        })),
      );
      const mine = pledges.find((p) => p.user_id === user.id);
      if (mine) setMyPledge(mine);
    }

    // Check if saved/wishlisted
    const { data: wishlistData } = await supabase
      .from("wishlist_items")
      .select("id")
      .eq("user_id", user.id)
      .eq("experience_id", experienceId)
      .maybeSingle();
    setSaved(!!wishlistData);

    setLoading(false);
  }, [experienceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleJoin() {
    if (!experienceId) return;
    setJoining(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/experiences/${experienceId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === "Insufficient wallet balance") {
          setMessage({
            type: "error",
            text: `Need ${formatCurrency(data.required)} — your balance is ${formatCurrency(data.balance)}. Add funds first.`,
          });
        } else {
          setMessage({ type: "error", text: data.error });
        }
      } else {
        setMessage({ type: "success", text: "You joined this split!" });
        loadData();
      }
    } catch {
      setMessage({ type: "error", text: "Something went wrong" });
    } finally {
      setJoining(false);
    }
  }

  async function handleLeave() {
    if (!experienceId || !confirm("Are you sure you want to leave this split? Refund depends on the cancellation policy.")) return;
    setLeaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/experiences/${experienceId}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error });
      } else {
        const refundText = data.refundAmount === data.pledgeAmount
          ? `Full refund of ${formatCurrency(data.refundAmount)} returned to wallet.`
          : data.refundAmount > 0
            ? `${formatCurrency(data.refundAmount)} of ${formatCurrency(data.pledgeAmount)} refunded (${data.policy} policy).`
            : `No refund — ${data.policy} cancellation policy applies.`;
        setMessage({ type: "success", text: `You left the split. ${refundText}` });
        loadData();
      }
    } catch {
      setMessage({ type: "error", text: "Something went wrong" });
    } finally {
      setLeaving(false);
    }
  }

  async function handleToggleSave() {
    if (!experienceId || !userId) return;
    const supabase = createBrowserSupabase();

    if (saved) {
      await supabase
        .from("wishlist_items")
        .delete()
        .eq("user_id", userId)
        .eq("experience_id", experienceId);
      setSaved(false);
    } else {
      await supabase.from("wishlist_items").insert({
        user_id: userId,
        experience_id: experienceId,
        experience_title: experience?.title || null,
        experience_image_url: experience?.photo_urls?.[0] || null,
        experience_price: experience?.total_cost || null,
      });
      setSaved(true);
    }
  }

  async function handleShare() {
    const url = `${window.location.origin}/app/experience/${experienceId}`;
    const text = experience ? `Check out "${experience.title}" on SPLYT — ${formatCurrency(Math.ceil(experience.total_cost / experience.max_participants))}/person` : "Check out this experience on SPLYT";
    if (navigator.share) {
      try {
        await navigator.share({ title: experience?.title || "SPLYT Experience", text, url });
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      setMessage({ type: "success", text: "Link copied to clipboard!" });
      setTimeout(() => setMessage(null), 3000);
    }
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl animate-pulse">
        <div className="h-64 bg-gray-200 rounded-2xl mb-6" />
        <div className="h-8 bg-gray-200 rounded w-2/3 mb-4" />
        <div className="h-4 bg-gray-200 rounded w-1/3" />
      </div>
    );
  }

  if (!experience) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl text-center py-20">
        <h2 className="text-lg font-semibold text-gray-900">
          Experience not found
        </h2>
        <Link
          href="/app"
          className="text-sm text-ocean-500 hover:underline mt-2 inline-block"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  const perPerson = Math.ceil(
    experience.total_cost / experience.max_participants,
  );
  const spotsLeft =
    experience.max_participants - experience.current_participants;
  const canJoin =
    !myPledge &&
    userId !== experience.host_id &&
    (experience.status === "open" || experience.status === "filling") &&
    spotsLeft > 0;

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
            title="Share"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </button>
          <button
            onClick={handleToggleSave}
            className={`p-2 rounded-full hover:bg-gray-100 transition-colors ${saved ? "text-red-500" : "text-gray-500 hover:text-gray-700"}`}
            title={saved ? "Remove from saved" : "Save"}
          >
            <svg className="w-5 h-5" fill={saved ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Photos */}
      {experience.photo_urls?.length > 0 && (
        <div className="rounded-2xl overflow-hidden mb-6">
          {experience.photo_urls.length >= 3 ? (
            <div className="grid grid-cols-3 gap-2 h-72">
              <div className="col-span-2">
                <img
                  src={experience.photo_urls[0]}
                  alt=""
                  className="w-full h-full object-cover rounded-l-2xl"
                />
              </div>
              <div className="flex flex-col gap-2">
                <img
                  src={experience.photo_urls[1]}
                  alt=""
                  className="w-full flex-1 object-cover rounded-tr-2xl"
                />
                <img
                  src={experience.photo_urls[2]}
                  alt=""
                  className="w-full flex-1 object-cover rounded-br-2xl"
                />
              </div>
            </div>
          ) : (
            <img
              src={experience.photo_urls[0]}
              alt=""
              className="w-full h-72 object-cover rounded-2xl"
            />
          )}
        </div>
      )}

      {/* Message */}
      {message && (
        <div
          className={`mb-4 rounded-xl p-4 text-sm font-medium ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message.text}
          {message.type === "error" &&
            message.text.includes("Add funds") && (
              <Link
                href="/app/wallet"
                className="ml-2 underline font-semibold"
              >
                Go to Wallet
              </Link>
            )}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left: Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-ocean-600 bg-ocean-50 px-3 py-1 rounded-full capitalize">
              {experience.type.replace(/_/g, " ")}
            </span>
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                experience.status === "open" || experience.status === "filling"
                  ? "bg-green-50 text-green-600"
                  : experience.status === "full"
                    ? "bg-purple-50 text-purple-600"
                    : "bg-gray-100 text-gray-500"
              }`}
            >
              {experience.status}
            </span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            {experience.title}
          </h1>
          <p className="text-gray-600 mb-6">{experience.location}</p>

          {/* Key stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-6 mb-6 border-b border-gray-200">
            <div>
              <p className="text-xs text-gray-500">Total Cost</p>
              <p className="text-sm font-bold text-gray-900">
                {formatCurrency(experience.total_cost)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Per Person</p>
              <p className="text-sm font-bold text-ocean-600">
                {formatCurrency(perPerson)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Group</p>
              <p className="text-sm font-bold text-gray-900">
                {experience.current_participants}/{experience.max_participants}
              </p>
            </div>
            {experience.duration_hours && (
              <div>
                <p className="text-xs text-gray-500">Duration</p>
                <p className="text-sm font-bold text-gray-900">
                  {experience.duration_hours}h
                </p>
              </div>
            )}
          </div>

          {/* Date */}
          {experience.date_time && (
            <div className="pb-6 mb-6 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900 mb-1">
                Date & Time
              </h2>
              <p className="text-sm text-gray-600">
                {formatDateTime(experience.date_time)}
              </p>
            </div>
          )}

          {/* Description */}
          {experience.description && (
            <div className="pb-6 mb-6 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">
                About
              </h2>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                {experience.description}
              </p>
            </div>
          )}

          {/* Amenities */}
          {experience.amenities?.length > 0 && (
            <div className="pb-6 mb-6 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">
                What&apos;s included
              </h2>
              <div className="flex flex-wrap gap-2">
                {experience.amenities.map((a, i) => (
                  <span
                    key={i}
                    className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Host */}
          {host && (
            <div className="pb-6 mb-6 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">
                Your Host
              </h2>
              <Link
                href={`/app/profile/${host.id}`}
                className="flex items-center gap-3 hover:bg-gray-50 -mx-2 px-2 py-2 rounded-xl transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-ocean-100 flex items-center justify-center text-ocean-600 font-bold text-lg">
                  {host.avatar_url ? (
                    <img
                      src={host.avatar_url}
                      alt=""
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    host.display_name?.[0]?.toUpperCase() || "H"
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {host.display_name || "Host"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {[host.host_tier, host.home_city].filter(Boolean).join(" · ") || "SPLYT Host"}
                  </p>
                </div>
              </Link>
            </div>
          )}

          {/* Group members */}
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              Group ({members.length}/{experience.max_participants})
            </h2>
            {members.length === 0 ? (
              <p className="text-sm text-gray-500">
                No one has joined yet. Be the first!
              </p>
            ) : (
              <div className="space-y-2">
                {members.map((m) => (
                  <Link
                    key={m.id}
                    href={`/app/profile/${m.id}`}
                    className="flex items-center gap-3 p-2 -mx-2 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-500">
                      {m.avatar_url ? (
                        <img
                          src={m.avatar_url}
                          alt=""
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        m.display_name?.[0]?.toUpperCase() || "?"
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {m.display_name || "Member"}
                        {m.id === userId && (
                          <span className="text-ocean-500 ml-1">(you)</span>
                        )}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatCurrency(m.amount)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Action card */}
        <div className="lg:w-80 shrink-0">
          <div className="sticky top-24 bg-white rounded-2xl border border-gray-200 shadow-md p-6">
            <div className="mb-4">
              <span className="text-2xl font-bold text-gray-900">
                {formatCurrency(perPerson)}
              </span>
              <span className="text-gray-500 text-sm"> /person</span>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 mb-4 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-gray-600">Total cost</span>
                <span className="font-medium">
                  {formatCurrency(experience.total_cost)}
                </span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-gray-600">Split between</span>
                <span className="font-medium">
                  {experience.max_participants} people
                </span>
              </div>
              <div className="flex justify-between text-ocean-600 font-semibold pt-1 border-t border-gray-200 mt-1">
                <span>Your share</span>
                <span>{formatCurrency(perPerson)}</span>
              </div>
            </div>

            {spotsLeft > 0 && (
              <p className="text-xs text-green-600 font-medium mb-3">
                {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left
              </p>
            )}

            {myPledge ? (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                  <p className="text-sm font-semibold text-green-800">
                    You&apos;re in!
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Pledged {formatCurrency(myPledge.amount)}
                  </p>
                </div>
                <button
                  onClick={handleLeave}
                  disabled={leaving}
                  className="w-full py-2.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  {leaving ? "Leaving..." : "Leave Split"}
                </button>
              </div>
            ) : canJoin ? (
              <button
                onClick={handleJoin}
                disabled={joining}
                className="w-full py-3 bg-ocean-500 text-white font-semibold rounded-xl hover:bg-ocean-600 transition-colors disabled:opacity-50"
              >
                {joining ? "Joining..." : `Join for ${formatCurrency(perPerson)}`}
              </button>
            ) : userId === experience.host_id ? (
              <div className="space-y-3">
                <div className="bg-ocean-50 border border-ocean-200 rounded-xl p-4 text-center">
                  <p className="text-sm font-semibold text-ocean-800">
                    You&apos;re hosting this
                  </p>
                </div>
                <Link
                  href={`/app/business/listings/${experienceId}/edit`}
                  className="block w-full text-center py-3 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors text-sm"
                >
                  Edit Experience
                </Link>
              </div>
            ) : (
              <div className="bg-gray-100 rounded-xl p-4 text-center">
                <p className="text-sm text-gray-500">
                  This experience is no longer accepting members.
                </p>
              </div>
            )}

            <div className="flex gap-2 mt-3">
              <Link
                href="/app/messages"
                className="flex-1 text-center py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors text-sm"
              >
                Message Group
              </Link>
              <Link
                href={`/app/experience/${experienceId}/reviews`}
                className="flex-1 text-center py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors text-sm"
              >
                Reviews
              </Link>
            </div>

            <div className="mt-4 text-xs text-gray-400 space-y-1">
              <p>
                Booking: {experience.booking_mode === "instant" ? "Instant" : "Request"}
              </p>
              <p>Cancellation: {experience.cancellation_policy}</p>
              {experience.security_deposit && (
                <p>
                  Security deposit: {formatCurrency(experience.security_deposit)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
