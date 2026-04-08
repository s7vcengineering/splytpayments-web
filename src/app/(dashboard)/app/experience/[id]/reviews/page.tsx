"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase";
import { timeAgo } from "@/lib/types";

interface Review {
  id: string;
  experience_id: string;
  user_id: string;
  rating: number;
  quality_rating: number | null;
  communication_rating: number | null;
  value_rating: number | null;
  safety_rating: number | null;
  content: string;
  created_at: string;
  user?: { display_name: string | null; avatar_url: string | null };
}

export default function ReviewsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [experienceId, setExperienceId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [form, setForm] = useState({
    rating: 5,
    quality_rating: 5,
    communication_rating: 5,
    value_rating: 5,
    safety_rating: 5,
    content: "",
  });

  useEffect(() => {
    params.then((p) => setExperienceId(p.id));
  }, [params]);

  useEffect(() => {
    if (!experienceId) return;
    const supabase = createBrowserSupabase();

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) setUserId(user.id);

      const { data } = await supabase
        .from("reviews")
        .select("*, user:profiles!user_id(display_name, avatar_url)")
        .eq("experience_id", experienceId)
        .order("created_at", { ascending: false });

      if (data) setReviews(data as Review[]);
      setLoading(false);
    });
  }, [experienceId]);

  const hasReviewed = reviews.some((r) => r.user_id === userId);
  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!experienceId || !userId || form.content.length < 20) return;
    setSubmitting(true);
    setMessage(null);

    const supabase = createBrowserSupabase();
    const { data, error } = await supabase.from("reviews").insert({
      experience_id: experienceId,
      user_id: userId,
      rating: form.rating,
      quality_rating: form.quality_rating,
      communication_rating: form.communication_rating,
      value_rating: form.value_rating,
      safety_rating: form.safety_rating,
      content: form.content.trim(),
    }).select("*, user:profiles!user_id(display_name, avatar_url)").single();

    if (error) {
      setMessage({ type: "error", text: error.message.includes("duplicate") ? "You already reviewed this experience." : error.message });
    } else if (data) {
      setReviews((prev) => [data as Review, ...prev]);
      setShowForm(false);
      setMessage({ type: "success", text: "Review submitted!" });
    }
    setSubmitting(false);
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to experience
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Reviews</h1>
          <p className="text-gray-500">
            {reviews.length} review{reviews.length !== 1 ? "s" : ""}
            {avgRating && <span> · <span className="text-gray-900 font-semibold">{avgRating}</span> average</span>}
          </p>
        </div>
        {userId && !hasReviewed && !showForm && (
          <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-ocean-500 text-white text-sm font-semibold rounded-xl hover:bg-ocean-600 transition-colors">
            Write a Review
          </button>
        )}
      </div>

      {message && (
        <div className={`mb-6 rounded-xl p-4 text-sm font-medium ${
          message.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"
        }`}>{message.text}</div>
      )}

      {/* Write review form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Your Review</h3>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <RatingInput label="Overall" value={form.rating} onChange={(v) => setForm({ ...form, rating: v })} />
            <RatingInput label="Quality" value={form.quality_rating} onChange={(v) => setForm({ ...form, quality_rating: v })} />
            <RatingInput label="Communication" value={form.communication_rating} onChange={(v) => setForm({ ...form, communication_rating: v })} />
            <RatingInput label="Value" value={form.value_rating} onChange={(v) => setForm({ ...form, value_rating: v })} />
            <RatingInput label="Safety" value={form.safety_rating} onChange={(v) => setForm({ ...form, safety_rating: v })} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your experience ({form.content.length}/500)
            </label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value.slice(0, 500) })}
              placeholder="Share your experience (min 20 characters)..."
              rows={4}
              required
              minLength={20}
              maxLength={500}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500 resize-none"
            />
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={submitting || form.content.length < 20} className="px-5 py-2.5 bg-ocean-500 text-white text-sm font-semibold rounded-xl hover:bg-ocean-600 transition-colors disabled:opacity-50">
              {submitting ? "Submitting..." : "Submit Review"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Reviews list */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse">
              <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-full bg-gray-200" /><div className="h-4 bg-gray-200 rounded w-24" /></div>
              <div className="h-3 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-200">
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">No reviews yet</h2>
          <p className="text-sm text-gray-500">Be the first to share your experience.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-3">
                <Link href={`/app/profile/${review.user_id}`} className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-500 hover:ring-2 hover:ring-ocean-500/30 transition-all">
                  {review.user?.avatar_url
                    ? <img src={review.user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                    : review.user?.display_name?.[0]?.toUpperCase() || "?"}
                </Link>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{review.user?.display_name || "SPLYT User"}</p>
                  <p className="text-xs text-gray-500">{timeAgo(review.created_at)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  <span className="text-sm font-bold text-gray-900">{review.rating}</span>
                </div>
              </div>

              <p className="text-sm text-gray-700 leading-relaxed">{review.content}</p>

              {(review.quality_rating || review.communication_rating || review.value_rating || review.safety_rating) && (
                <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-100">
                  {review.quality_rating && <MiniRating label="Quality" value={review.quality_rating} />}
                  {review.communication_rating && <MiniRating label="Comms" value={review.communication_rating} />}
                  {review.value_rating && <MiniRating label="Value" value={review.value_rating} />}
                  {review.safety_rating && <MiniRating label="Safety" value={review.safety_rating} />}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RatingInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="text-center">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <div className="flex justify-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button key={star} type="button" onClick={() => onChange(star)}>
            <svg className={`w-5 h-5 ${star <= value ? "text-amber-400" : "text-gray-200"}`} viewBox="0 0 24 24" fill="currentColor">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}

function MiniRating({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-1 text-xs text-gray-500">
      <span>{label}:</span>
      <svg className="w-3 h-3 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
      <span className="font-medium text-gray-700">{value}</span>
    </div>
  );
}
