"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TYPES = [
  { value: "yacht_charter", label: "Yacht Charter" },
  { value: "exotic_car", label: "Exotic Car" },
  { value: "luxury_stay", label: "Luxury Stay" },
  { value: "experience", label: "Experience" },
  { value: "networking_event", label: "Networking Event" },
];

const VIBES = [
  { value: "chill", label: "Chill" },
  { value: "party", label: "Party" },
  { value: "networking", label: "Networking" },
  { value: "adventure", label: "Adventure" },
  { value: "luxury", label: "Luxury" },
  { value: "family", label: "Family" },
];

export default function NewExperiencePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "experience",
    total_cost: "",
    max_participants: "",
    date_time: "",
    duration_hours: "",
    location: "",
    photo_urls: "",
    amenities: "",
    vibe: "",
    category: "",
    booking_mode: "request",
    cancellation_policy: "flexible",
    security_deposit: "",
    is_private: false,
  });

  function update(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      title: form.title,
      description: form.description || null,
      type: form.type,
      total_cost: Number(form.total_cost),
      max_participants: Number(form.max_participants),
      date_time: form.date_time || null,
      duration_hours: form.duration_hours ? Number(form.duration_hours) : null,
      location: form.location,
      photo_urls: form.photo_urls
        ? form.photo_urls
            .split("\n")
            .map((u) => u.trim())
            .filter(Boolean)
        : [],
      amenities: form.amenities
        ? form.amenities
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean)
        : [],
      vibe: form.vibe || null,
      category: form.category || null,
      booking_mode: form.booking_mode,
      cancellation_policy: form.cancellation_policy,
      security_deposit: form.security_deposit
        ? Number(form.security_deposit)
        : null,
      is_private: form.is_private,
    };

    try {
      const res = await fetch("/api/experiences/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create experience");
        setSaving(false);
        return;
      }

      router.push("/app/business/listings");
    } catch {
      setError("Something went wrong");
      setSaving(false);
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-gray-700 mb-2 flex items-center gap-1"
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
          Back to listings
        </button>
        <h1 className="text-2xl font-bold text-gray-900">New Experience</h1>
        <p className="text-gray-500 text-sm mt-1">
          Create a new experience for people to discover and split.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="e.g. Sunset Yacht Cruise in Miami"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 outline-none"
          />
        </div>

        {/* Type + Vibe row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={form.type}
              onChange={(e) => update("type", e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 outline-none bg-white"
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vibe
            </label>
            <select
              value={form.vibe}
              onChange={(e) => update("vibe", e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 outline-none bg-white"
            >
              <option value="">Select a vibe...</option>
              {VIBES.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="Describe the experience — what people can expect, the itinerary, what's included..."
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 outline-none resize-none"
          />
        </div>

        {/* Cost + Participants + Duration */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total Cost ($) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              required
              min={1}
              value={form.total_cost}
              onChange={(e) => update("total_cost", e.target.value)}
              placeholder="2000"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max People <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              required
              min={2}
              value={form.max_participants}
              onChange={(e) => update("max_participants", e.target.value)}
              placeholder="8"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duration (hrs)
            </label>
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={form.duration_hours}
              onChange={(e) => update("duration_hours", e.target.value)}
              placeholder="4"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 outline-none"
            />
          </div>
        </div>

        {/* Per-person preview */}
        {form.total_cost && form.max_participants && (
          <div className="bg-ocean-50 rounded-xl p-4">
            <p className="text-sm text-ocean-800">
              Price per person:{" "}
              <span className="font-bold">
                $
                {Math.ceil(
                  Number(form.total_cost) / Number(form.max_participants),
                ).toLocaleString()}
              </span>{" "}
              ({form.max_participants} people splitting $
              {Number(form.total_cost).toLocaleString()})
            </p>
          </div>
        )}

        {/* Location + Date */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.location}
              onChange={(e) => update("location", e.target.value)}
              placeholder="Miami, FL"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date & Time
            </label>
            <input
              type="datetime-local"
              value={form.date_time}
              onChange={(e) => update("date_time", e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 outline-none"
            />
          </div>
        </div>

        {/* Photo URLs */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Photo URLs
          </label>
          <textarea
            rows={3}
            value={form.photo_urls}
            onChange={(e) => update("photo_urls", e.target.value)}
            placeholder={"https://example.com/photo1.jpg\nhttps://example.com/photo2.jpg"}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 outline-none resize-none font-mono"
          />
          <p className="text-xs text-gray-400 mt-1">
            One URL per line
          </p>
        </div>

        {/* Amenities */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Amenities / Features
          </label>
          <input
            type="text"
            value={form.amenities}
            onChange={(e) => update("amenities", e.target.value)}
            placeholder="DJ, Open bar, Snorkeling, Jet ski"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 outline-none"
          />
          <p className="text-xs text-gray-400 mt-1">
            Comma-separated
          </p>
        </div>

        {/* Booking + Cancellation + Deposit row */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Booking Mode
            </label>
            <select
              value={form.booking_mode}
              onChange={(e) => update("booking_mode", e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 outline-none bg-white"
            >
              <option value="request">Request</option>
              <option value="instant">Instant</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cancellation
            </label>
            <select
              value={form.cancellation_policy}
              onChange={(e) => update("cancellation_policy", e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 outline-none bg-white"
            >
              <option value="flexible">Flexible</option>
              <option value="moderate">Moderate</option>
              <option value="strict">Strict</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Security Deposit ($)
            </label>
            <input
              type="number"
              min={0}
              value={form.security_deposit}
              onChange={(e) => update("security_deposit", e.target.value)}
              placeholder="0"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 outline-none"
            />
          </div>
        </div>

        {/* Private toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_private}
            onChange={(e) => update("is_private", e.target.checked)}
            className="w-5 h-5 rounded border-gray-300 text-ocean-500 focus:ring-ocean-500"
          />
          <div>
            <span className="text-sm font-medium text-gray-700">
              Private experience
            </span>
            <p className="text-xs text-gray-400">
              Only people with a direct link can find this
            </p>
          </div>
        </label>

        {/* Submit */}
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-3 bg-ocean-500 text-white text-sm font-semibold rounded-xl hover:bg-ocean-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Creating..." : "Create Experience"}
          </button>
        </div>
      </form>
    </div>
  );
}
