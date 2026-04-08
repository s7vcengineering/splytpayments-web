"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import type { UserProfile } from "@/lib/types";
import { formatDate } from "@/lib/types";

export default function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwnProfile, setIsOwnProfile] = useState(false);

  useEffect(() => {
    params.then((p) => setProfileId(p.id));
  }, [params]);

  useEffect(() => {
    if (!profileId) return;
    const supabase = createBrowserSupabase();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user?.id === profileId) {
        setIsOwnProfile(true);
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", profileId)
        .single();
      if (data) setProfile(data as UserProfile);
      setLoading(false);
    });
  }, [profileId]);

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-2xl animate-pulse">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 rounded-full bg-gray-200" />
          <div className="space-y-2">
            <div className="h-6 bg-gray-200 rounded w-40" />
            <div className="h-4 bg-gray-200 rounded w-24" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6 lg:p-8 max-w-2xl text-center py-20">
        <h2 className="text-lg font-semibold text-gray-900">
          User not found
        </h2>
        <button
          onClick={() => router.back()}
          className="text-sm text-ocean-500 hover:underline mt-2"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      <button
        onClick={() => router.back()}
        className="text-sm text-gray-500 hover:text-gray-700 mb-6 flex items-center gap-1"
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
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back
      </button>

      {/* Profile header */}
      <div className="flex items-start gap-5 mb-8">
        <div className="w-20 h-20 rounded-full bg-ocean-100 flex items-center justify-center text-ocean-600 font-bold text-2xl shrink-0">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            profile.display_name?.[0]?.toUpperCase() || "?"
          )}
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {profile.display_name || "SPLYT User"}
          </h1>
          {profile.username && (
            <p className="text-sm text-gray-500">@{profile.username}</p>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {profile.home_city && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                {profile.home_city}
              </span>
            )}
            <span className="text-xs text-gray-400">
              Joined {formatDate(profile.created_at)}
            </span>
          </div>
          <div className="flex gap-2 mt-3">
            {profile.is_premium && (
              <span className="text-xs font-medium bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full">
                Premium
              </span>
            )}
            {profile.badges?.map((badge) => (
              <span
                key={badge}
                className="text-xs font-medium bg-ocean-50 text-ocean-700 px-2.5 py-1 rounded-full"
              >
                {badge}
              </span>
            ))}
            {profile.host_tier && (
              <span className="text-xs font-medium bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full capitalize">
                {profile.host_tier} host
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bio */}
      {profile.bio && (
        <div className="mb-6 pb-6 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">About</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            {profile.bio}
          </p>
        </div>
      )}

      {/* Interests */}
      {profile.interests?.length > 0 && (
        <div className="mb-6 pb-6 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">
            Interests
          </h2>
          <div className="flex flex-wrap gap-2">
            {profile.interests.map((interest) => (
              <span
                key={interest}
                className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full"
              >
                {interest}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Social links */}
      {(profile.instagram_url || profile.tiktok_url || profile.x_url) && (
        <div className="mb-6 pb-6 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Social</h2>
          <div className="flex gap-3">
            {profile.instagram_url && (
              <a
                href={profile.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-ocean-500 hover:underline"
              >
                Instagram
              </a>
            )}
            {profile.tiktok_url && (
              <a
                href={profile.tiktok_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-ocean-500 hover:underline"
              >
                TikTok
              </a>
            )}
            {profile.x_url && (
              <a
                href={profile.x_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-ocean-500 hover:underline"
              >
                X
              </a>
            )}
          </div>
        </div>
      )}

      {/* Edit own profile link */}
      {isOwnProfile && (
        <a
          href="/app/profile"
          className="inline-block text-sm font-medium text-ocean-500 hover:underline"
        >
          Edit your profile
        </a>
      )}
    </div>
  );
}
