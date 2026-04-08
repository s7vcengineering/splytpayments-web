"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase";
import type { Experience } from "@/lib/types";

const TYPES = ["yacht_charter", "exotic_car", "luxury_stay", "experience", "networking"];
const VIBES = ["chill", "party", "networking", "adventure", "luxury", "family"];

export default function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [experienceId, setExperienceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("experience");
  const [vibe, setVibe] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [durationHours, setDurationHours] = useState("");
  const [location, setLocation] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [photoUrls, setPhotoUrls] = useState("");
  const [amenities, setAmenities] = useState("");
  const [bookingMode, setBookingMode] = useState("request");
  const [cancellationPolicy, setCancellationPolicy] = useState("flexible");
  const [securityDeposit, setSecurityDeposit] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [status, setStatus] = useState("open");

  useEffect(() => {
    params.then((p) => setExperienceId(p.id));
  }, [params]);

  useEffect(() => {
    if (!experienceId) return;
    const supabase = createBrowserSupabase();
    supabase
      .from("experiences")
      .select("*")
      .eq("id", experienceId)
      .single()
      .then(({ data }) => {
        if (!data) {
          setLoading(false);
          return;
        }
        const exp = data as Experience;
        setTitle(exp.title);
        setDescription(exp.description || "");
        setType(exp.type);
        setVibe(exp.vibe || "");
        setTotalCost(String(exp.total_cost));
        setMaxParticipants(String(exp.max_participants));
        setDurationHours(exp.duration_hours ? String(exp.duration_hours) : "");
        setLocation(exp.location);
        setDateTime(exp.date_time ? exp.date_time.slice(0, 16) : "");
        setPhotoUrls(exp.photo_urls?.join("\n") || "");
        setAmenities(exp.amenities?.join(", ") || "");
        setBookingMode(exp.booking_mode);
        setCancellationPolicy(exp.cancellation_policy);
        setSecurityDeposit(exp.security_deposit ? String(exp.security_deposit) : "");
        setIsPrivate(exp.is_private);
        setStatus(exp.status);
        setLoading(false);
      });
  }, [experienceId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!experienceId) return;
    setSaving(true);
    setMessage(null);

    const body: Record<string, any> = {
      title: title.trim(),
      description: description.trim() || null,
      type,
      vibe: vibe || null,
      total_cost: Number(totalCost),
      max_participants: Number(maxParticipants),
      duration_hours: durationHours ? Number(durationHours) : null,
      location: location.trim(),
      date_time: dateTime || null,
      photo_urls: photoUrls.split("\n").map((u) => u.trim()).filter(Boolean),
      amenities: amenities.split(",").map((a) => a.trim()).filter(Boolean),
      booking_mode: bookingMode,
      cancellation_policy: cancellationPolicy,
      security_deposit: securityDeposit ? Number(securityDeposit) : null,
      is_private: isPrivate,
      status,
    };

    try {
      const res = await fetch(`/api/experiences/${experienceId}/edit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Failed to save" });
      } else {
        setMessage({ type: "success", text: "Experience updated!" });
      }
    } catch {
      setMessage({ type: "error", text: "Something went wrong" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-3xl animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-8" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-gray-200 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const perPerson = Number(totalCost) && Number(maxParticipants) > 0
    ? Math.ceil(Number(totalCost) / Number(maxParticipants))
    : 0;

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">Edit Experience</h1>
      <p className="text-gray-500 mb-6">Update your listing details.</p>

      {message && (
        <div className={`mb-6 rounded-xl p-4 text-sm font-medium ${
          message.type === "success"
            ? "bg-green-50 text-green-800 border border-green-200"
            : "bg-red-50 text-red-800 border border-red-200"
        }`}>{message.text}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500" />
        </div>

        {/* Type & Vibe */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500 bg-white">
              {TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vibe</label>
            <select value={vibe} onChange={(e) => setVibe(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500 bg-white">
              <option value="">None</option>
              {VIBES.map((v) => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
            </select>
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500 bg-white">
            {["open", "filling", "full", "completed", "cancelled"].map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500" />
        </div>

        {/* Cost & Capacity */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Cost ($)</label>
            <input type="number" value={totalCost} onChange={(e) => setTotalCost(e.target.value)} min={1} required
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Participants</label>
            <input type="number" value={maxParticipants} onChange={(e) => setMaxParticipants(e.target.value)} min={2} required
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500" />
          </div>
        </div>

        {perPerson > 0 && (
          <div className="bg-ocean-50 rounded-xl p-3 text-sm text-ocean-700 font-medium">
            Per person: ${perPerson}
          </div>
        )}

        {/* Duration & Date */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duration (hours)</label>
            <input type="number" value={durationHours} onChange={(e) => setDurationHours(e.target.value)} min={0.5} step={0.5}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time</label>
            <input type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500" />
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} required
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500" />
        </div>

        {/* Photos */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Photo URLs (one per line)</label>
          <textarea value={photoUrls} onChange={(e) => setPhotoUrls(e.target.value)} rows={3} placeholder="https://..."
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500" />
        </div>

        {/* Amenities */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amenities (comma-separated)</label>
          <input type="text" value={amenities} onChange={(e) => setAmenities(e.target.value)} placeholder="DJ, Bar, Jet Ski"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500" />
        </div>

        {/* Booking & Cancellation */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Booking Mode</label>
            <select value={bookingMode} onChange={(e) => setBookingMode(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500 bg-white">
              <option value="request">Request</option>
              <option value="instant">Instant</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cancellation Policy</label>
            <select value={cancellationPolicy} onChange={(e) => setCancellationPolicy(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500 bg-white">
              <option value="flexible">Flexible</option>
              <option value="moderate">Moderate</option>
              <option value="strict">Strict</option>
            </select>
          </div>
        </div>

        {/* Security deposit */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Security Deposit ($)</label>
          <input type="number" value={securityDeposit} onChange={(e) => setSecurityDeposit(e.target.value)} min={0} placeholder="Optional"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500" />
        </div>

        {/* Private toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)}
            className="w-5 h-5 rounded border-gray-300 text-ocean-500 focus:ring-ocean-500" />
          <span className="text-sm text-gray-700">Private experience (invite only)</span>
        </label>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button type="submit" disabled={saving}
            className="flex-1 py-3 bg-ocean-500 text-white font-semibold rounded-xl hover:bg-ocean-600 transition-colors disabled:opacity-50">
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <Link href="/app/business/listings"
            className="px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors text-center">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
