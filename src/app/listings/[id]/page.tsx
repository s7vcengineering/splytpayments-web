import { createServiceClient } from "@/lib/supabase";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/types";
import AvailabilityCalendar from "./availability-calendar";

function getTable(
  source: string,
  type: string,
): string | null {
  if (type === "yacht" && source === "boatsetter") return "boats";
  if (type === "yacht" && source === "mvpmiami") return "mvp_yachts";
  if (type === "car") return "exotic_cars";
  if (type === "stay" && source === "mvpmiami") return "mansions";
  if (type === "stay" && source === "airbnb") return "airbnb_stays";
  if (type === "experience" && source === "airbnb") return "airbnb_experiences";
  return null;
}

interface NormalizedListing {
  title: string;
  location: string;
  type: string;
  source: string;
  price: number | null;
  priceUnit: string;
  capacity: number;
  splitPrice: number | null;
  rating: number | null;
  reviewCount: number | null;
  photos: string[];
  features: string[];
  description: string;
  hostName: string | null;
  details: Record<string, string>;
}

function normalize(row: any, type: string, source: string): NormalizedListing {
  if (type === "yacht" && source === "boatsetter") {
    const cap = row.capacity || 8;
    return {
      title: row.name || "Yacht Charter",
      location: [row.city, row.region].filter(Boolean).join(", "),
      type, source,
      price: row.hourly_rate,
      priceUnit: "/hr",
      capacity: cap,
      splitPrice: row.hourly_rate ? Math.round(row.hourly_rate / cap) : null,
      rating: row.rating ? parseFloat(row.rating) : null,
      reviewCount: row.review_count ? parseInt(row.review_count) : null,
      photos: (row.photo_urls || []).slice(0, 10),
      features: [...(row.amenities || []), ...(row.features || [])].filter(Boolean),
      description: row.description || "",
      hostName: row.captain_name || null,
      details: {
        ...(row.length_feet ? { Length: `${row.length_feet} ft` } : {}),
        ...(row.year ? { Year: String(row.year) } : {}),
        ...(row.make ? { Make: row.make } : {}),
        Capacity: `${cap} guests`,
        ...(row.boat_type ? { Type: row.boat_type } : {}),
      },
    };
  }
  if (type === "yacht" && source === "mvpmiami") {
    const cap = row.cruising_capacity || 12;
    return {
      title: row.name || "Yacht Charter",
      location: [row.city, row.region].filter(Boolean).join(", "),
      type, source,
      price: null,
      priceUnit: "",
      capacity: cap,
      splitPrice: null,
      rating: null,
      reviewCount: null,
      photos: (row.photo_urls || []).slice(0, 10),
      features: [row.builder, row.length_feet ? `${row.length_feet}ft` : null].filter(Boolean),
      description: row.description || "",
      hostName: null,
      details: {
        ...(row.length_feet ? { Length: `${row.length_feet} ft` } : {}),
        ...(row.builder ? { Builder: row.builder } : {}),
        Capacity: `${cap} guests`,
      },
    };
  }
  if (type === "car") {
    const cap = 4;
    return {
      title: row.title || [row.year, row.make, row.model].filter(Boolean).join(" "),
      location: [row.city, row.region].filter(Boolean).join(", "),
      type, source,
      price: row.daily_rate,
      priceUnit: "/day",
      capacity: cap,
      splitPrice: row.daily_rate ? Math.round(row.daily_rate / cap) : null,
      rating: null,
      reviewCount: null,
      photos: (row.photo_urls || []).slice(0, 10),
      features: [row.horsepower ? `${row.horsepower} HP` : null, row.zero_to_sixty ? `0-60: ${row.zero_to_sixty}s` : null, row.top_speed ? `${row.top_speed} mph` : null, row.transmission, row.engine].filter(Boolean),
      description: row.description || "",
      hostName: null,
      details: {
        ...(row.year ? { Year: String(row.year) } : {}),
        ...(row.make ? { Make: row.make } : {}),
        ...(row.model ? { Model: row.model } : {}),
        ...(row.horsepower ? { Horsepower: `${row.horsepower} HP` } : {}),
        ...(row.transmission ? { Transmission: row.transmission } : {}),
        ...(row.engine ? { Engine: row.engine } : {}),
      },
    };
  }
  if (type === "stay" && source === "mvpmiami") {
    const cap = row.capacity || 8;
    return {
      title: row.name || "Luxury Stay",
      location: [row.city, row.region].filter(Boolean).join(", "),
      type, source,
      price: row.nightly_rate,
      priceUnit: "/night",
      capacity: cap,
      splitPrice: row.nightly_rate ? Math.round(row.nightly_rate / cap) : null,
      rating: null,
      reviewCount: null,
      photos: (row.photo_urls || []).slice(0, 10),
      features: [...(row.amenities || [])].filter(Boolean),
      description: row.description || "",
      hostName: null,
      details: {
        ...(row.bedrooms ? { Bedrooms: String(row.bedrooms) } : {}),
        ...(row.bathrooms ? { Bathrooms: String(row.bathrooms) } : {}),
        Capacity: `${cap} guests`,
      },
    };
  }
  if (type === "stay" && source === "airbnb") {
    const cap = row.max_guests || 4;
    return {
      title: row.title || "Luxury Stay",
      location: [row.city, row.region].filter(Boolean).join(", "),
      type, source,
      price: row.nightly_rate,
      priceUnit: "/night",
      capacity: cap,
      splitPrice: row.nightly_rate ? Math.round(row.nightly_rate / cap) : null,
      rating: row.rating ? parseFloat(row.rating) : null,
      reviewCount: row.review_count ? parseInt(row.review_count) : null,
      photos: (row.photo_urls || []).slice(0, 10),
      features: [row.property_type, row.is_superhost ? "Superhost" : null, ...(row.amenities || [])].filter(Boolean),
      description: row.description || "",
      hostName: row.host_name || null,
      details: {
        ...(row.property_type ? { Type: row.property_type } : {}),
        ...(row.bedrooms ? { Bedrooms: String(row.bedrooms) } : {}),
        ...(row.bathrooms ? { Bathrooms: String(row.bathrooms) } : {}),
        Guests: `${cap} max`,
        ...(row.is_superhost ? { Host: "Superhost" } : {}),
      },
    };
  }
  // airbnb_experiences
  const cap = row.max_guests || 10;
  return {
    title: row.title || "Experience",
    location: [row.city, row.region].filter(Boolean).join(", "),
    type, source,
    price: row.price_amount,
    priceUnit: "/person",
    capacity: cap,
    splitPrice: row.price_amount ? Math.round(row.price_amount) : null,
    rating: row.rating ? parseFloat(row.rating) : null,
    reviewCount: row.review_count ? parseInt(row.review_count) : null,
    photos: (row.photo_urls || []).slice(0, 10),
    features: [row.category, row.duration_minutes ? `${Math.round(row.duration_minutes / 60)}h` : null].filter(Boolean),
    description: row.description || "",
    hostName: row.host_name || null,
    details: {
      ...(row.category ? { Category: row.category } : {}),
      ...(row.duration_minutes ? { Duration: `${Math.round(row.duration_minutes / 60)} hours` } : {}),
      Guests: `Up to ${cap}`,
    },
  };
}

const typeLabels: Record<string, string> = {
  yacht: "Yacht",
  car: "Exotic Car",
  stay: "Stay",
  experience: "Experience",
};

export const dynamic = "force-dynamic";

export default async function ListingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ source?: string; type?: string }>;
}) {
  const { id } = await params;
  const { source = "", type = "" } = await searchParams;

  const table = getTable(source, type);
  if (!table) notFound();

  const supabase = createServiceClient();
  const { data } = await supabase.from(table).select("*").eq("id", id).single();
  if (!data) notFound();

  const listing = normalize(data, type, source);

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-ocean-500 font-bold text-xl"
          >
            <svg className="w-7 h-7" viewBox="0 0 40 40" fill="currentColor">
              <circle cx="20" cy="20" r="20" />
              <text
                x="20"
                y="26"
                textAnchor="middle"
                fill="white"
                fontSize="18"
                fontWeight="bold"
                fontFamily="system-ui"
              >
                S
              </text>
            </svg>
            SPLYT
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Sign in
            </Link>
            <Link
              href="https://apps.apple.com/app/splyt/id6740092740"
              className="px-4 py-2 bg-ocean-500 text-white text-sm font-semibold rounded-xl hover:bg-ocean-600 transition-colors"
            >
              Get the App
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Photo gallery */}
        <div className="rounded-2xl overflow-hidden mb-8">
          {listing.photos.length >= 5 ? (
            <div className="grid grid-cols-4 grid-rows-2 gap-2 h-[28rem]">
              <div className="col-span-2 row-span-2">
                <img
                  src={listing.photos[0]}
                  alt={listing.title}
                  className="w-full h-full object-cover"
                />
              </div>
              {listing.photos.slice(1, 5).map((url, i) => (
                <div key={i}>
                  <img
                    src={url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          ) : listing.photos.length > 0 ? (
            <div className="aspect-[21/9] max-h-[28rem]">
              <img
                src={listing.photos[0]}
                alt={listing.title}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="aspect-[21/9] max-h-[28rem] bg-gray-100 flex items-center justify-center">
              <span className="text-gray-400">No photos</span>
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-12">
          {/* Left: Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-semibold text-ocean-600 bg-ocean-50 px-3 py-1 rounded-full">
                {typeLabels[listing.type] || listing.type}
              </span>
              {listing.rating && (
                <span className="flex items-center gap-1 text-sm font-medium text-gray-900">
                  <svg
                    className="w-4 h-4 text-ocean-500"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  {listing.rating.toFixed(1)}
                  {listing.reviewCount && (
                    <span className="text-gray-500">
                      ({listing.reviewCount})
                    </span>
                  )}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              {listing.title}
            </h1>
            <p className="text-gray-600 mb-6">{listing.location}</p>

            {listing.hostName && (
              <div className="flex items-center gap-3 pb-6 mb-6 border-b border-gray-200">
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-lg font-bold text-gray-500">
                  {listing.hostName[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Hosted by {listing.hostName}
                  </p>
                  <p className="text-xs text-gray-500">SPLYT verified host</p>
                </div>
              </div>
            )}

            {/* Key stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-6 mb-6 border-b border-gray-200">
              {Object.entries(listing.details).map(([label, val]) => (
                <div key={label}>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-sm font-semibold text-gray-900">{val}</p>
                </div>
              ))}
            </div>

            {/* Description */}
            {listing.description && (
              <div className="pb-6 mb-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">
                  About this {typeLabels[listing.type]?.toLowerCase() || "experience"}
                </h2>
                <p className="text-gray-600 leading-relaxed whitespace-pre-line">
                  {listing.description}
                </p>
              </div>
            )}

            {/* Features / Amenities */}
            {listing.features.length > 0 && (
              <div className="pb-6 mb-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">
                  What&apos;s included
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {listing.features.map((feat, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-sm text-gray-700"
                    >
                      <svg
                        className="w-4 h-4 text-ocean-500 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      {feat}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Availability */}
            <div className="pb-6 mb-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Availability
              </h2>
              <AvailabilityCalendar listingId={id} />
            </div>

            {/* More photos */}
            {listing.photos.length > 5 && (
              <div className="pb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">
                  More photos
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {listing.photos.slice(5).map((url, i) => (
                    <div
                      key={i}
                      className="aspect-[4/3] rounded-xl overflow-hidden"
                    >
                      <img
                        src={url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Price card (sticky) */}
          <div className="lg:w-96 shrink-0">
            <div className="sticky top-24 bg-white rounded-2xl border border-gray-200 shadow-lg p-6">
              {listing.price ? (
                <div className="mb-4">
                  <span className="text-2xl font-bold text-gray-900">
                    {formatCurrency(listing.price)}
                  </span>
                  <span className="text-gray-500 text-sm">
                    {listing.priceUnit}
                  </span>
                </div>
              ) : (
                <p className="text-lg font-semibold text-gray-900 mb-4">
                  Contact for pricing
                </p>
              )}

              {listing.splitPrice && listing.capacity > 1 && (
                <div className="bg-ocean-50 rounded-xl p-4 mb-4">
                  <p className="text-sm text-ocean-800 font-medium">
                    Split with {listing.capacity} people
                  </p>
                  <p className="text-xl font-bold text-ocean-600">
                    {formatCurrency(listing.splitPrice)}
                    <span className="text-sm font-normal text-ocean-500">
                      /person
                    </span>
                  </p>
                </div>
              )}

              <Link
                href={`/app/business/listings/new?title=${encodeURIComponent(listing.title)}&location=${encodeURIComponent(listing.location)}&type=${encodeURIComponent(listing.type === "yacht" ? "yacht_charter" : listing.type === "car" ? "exotic_car" : listing.type === "stay" ? "luxury_stay" : "experience")}&total_cost=${listing.price || ""}&capacity=${listing.capacity}&photos=${encodeURIComponent(listing.photos.slice(0, 5).join("\n"))}`}
                className="block w-full text-center py-3 bg-ocean-500 text-white font-semibold rounded-xl hover:bg-ocean-600 transition-colors mb-3"
              >
                Start a Split
              </Link>

              <Link
                href="https://apps.apple.com/app/splyt/id6740092740"
                className="block w-full text-center py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
              >
                Open in App
              </Link>

              <p className="text-xs text-gray-400 text-center mt-4">
                Create an account to split this{" "}
                {typeLabels[listing.type]?.toLowerCase() || "experience"} with
                your crew.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <span>&copy; 2026 SPLYT. All rights reserved.</span>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-gray-900">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-gray-900">
              Terms
            </Link>
            <Link href="/help" className="hover:text-gray-900">
              Help
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
