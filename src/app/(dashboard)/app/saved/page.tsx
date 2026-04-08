"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase";
import type { WishlistItem } from "@/lib/types";
import { formatCurrency } from "@/lib/types";

export default function SavedPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("wishlist_items")
        .select("*, experience:experiences(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (data) setItems(data as WishlistItem[]);
      setLoading(false);
    });
  }, []);

  async function handleRemove(itemId: string) {
    const supabase = createBrowserSupabase();
    await supabase.from("wishlist_items").delete().eq("id", itemId);
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Saved</h1>
      <p className="text-gray-500 mb-6">Experiences you&apos;ve saved for later.</p>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 animate-pulse">
              <div className="aspect-[4/3] bg-gray-200 rounded-t-2xl" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-200">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Nothing saved yet</h2>
          <p className="text-sm text-gray-500 mb-4">Browse the marketplace and save experiences you love.</p>
          <a href="/" className="text-sm font-medium text-ocean-500 hover:underline">Explore Marketplace</a>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => {
            const exp = item.experience;
            const imgUrl = exp?.photo_urls?.[0] || item.experience_image_url;
            return (
              <div key={item.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group relative cursor-pointer" onClick={() => { if (item.experience_id) window.location.href = `/app/experience/${item.experience_id}`; }}>
                <div className="aspect-[4/3] bg-gray-100 relative">
                  {imgUrl && <img src={imgUrl} alt="" className="w-full h-full object-cover" />}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemove(item.id); }}
                    className="absolute top-3 right-3 w-8 h-8 bg-white/90 backdrop-blur rounded-full flex items-center justify-center text-red-500 hover:bg-white shadow-sm transition-all opacity-0 group-hover:opacity-100"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                    </svg>
                  </button>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 text-sm truncate">
                    {exp?.title || item.experience_title || "Experience"}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">{exp?.location || ""}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-sm font-bold text-gray-900">
                      {formatCurrency(exp?.total_cost || item.experience_price || 0)}
                    </span>
                    {exp?.max_participants && (
                      <span className="text-xs text-ocean-600 bg-ocean-50 px-2 py-0.5 rounded-full font-medium">
                        {formatCurrency(Math.ceil((exp.total_cost || 0) / exp.max_participants))}/person
                      </span>
                    )}
                  </div>
                  {item.host_name && (
                    <p className="text-xs text-gray-400 mt-2">Hosted by {item.host_name}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
