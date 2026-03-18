import { createServiceClient } from "@/lib/supabase";
import { formatCurrency, cn } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

async function getStay(id: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("airbnb_stays")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data;
}

export default async function StayDetailPage({ params }: Props) {
  const { id } = await params;
  const stay = await getStay(id);

  if (!stay) notFound();

  const photos = (stay.photo_urls as string[]) || [];
  const badges = (stay.badges as string[]) || [];
  const amenities = (stay.amenities as string[]) || [];

  return (
    <div>
      {/* Back link */}
      <Link
        href="/airbnb-stays"
        className="inline-flex items-center gap-1.5 text-sm text-ocean-400 hover:text-white transition-colors mb-6"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
        </svg>
        Back to stays
      </Link>

      {/* Photo gallery */}
      {photos.length > 0 && (
        <div className="mb-6">
          <div className="grid grid-cols-4 grid-rows-2 gap-2 rounded-xl overflow-hidden h-[400px]">
            <div className="col-span-2 row-span-2 bg-ocean-800">
              <img
                src={photos[0]}
                alt={stay.title}
                className="w-full h-full object-cover"
              />
            </div>
            {photos.slice(1, 5).map((url: string, i: number) => (
              <div key={i} className="bg-ocean-800">
                <img
                  src={url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
          {photos.length > 5 && (
            <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
              {photos.slice(5).map((url: string, i: number) => (
                <div
                  key={i}
                  className="w-28 h-20 shrink-0 rounded-lg overflow-hidden bg-ocean-800"
                >
                  <img
                    src={url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">{stay.title}</h2>
          <p className="text-ocean-400 mt-1">
            {stay.city || "Unknown location"}
            {stay.neighborhood && (
              <span> &middot; {stay.neighborhood}</span>
            )}
            {stay.region && <span>, {stay.region}</span>}
          </p>
        </div>
        {stay.rating && (
          <div className="flex items-center gap-1.5 bg-ocean-800 rounded-lg px-3 py-2">
            <svg
              className="w-4 h-4 text-yellow-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="text-white font-bold">
              {Number(stay.rating).toFixed(1)}
            </span>
            {stay.review_count > 0 && (
              <span className="text-ocean-400 text-sm">
                ({stay.review_count} reviews)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2 mb-6">
        {stay.property_type && (
          <Badge label={stay.property_type} />
        )}
        {(stay.is_superhost as boolean) && (
          <span className="px-3 py-1.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-medium">
            Superhost
          </span>
        )}
        {badges.map((b: string, i: number) => (
          <Badge key={i} label={b} />
        ))}
        {stay.bedrooms != null && (
          <Badge label={`${stay.bedrooms} bedrooms`} />
        )}
        {stay.beds != null && (
          <Badge label={`${stay.beds} beds`} />
        )}
        {stay.bathrooms != null && (
          <Badge label={`${stay.bathrooms} bathrooms`} />
        )}
        {stay.max_guests != null && (
          <Badge label={`${stay.max_guests} guests`} />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pricing card */}
        <div className="bg-ocean-900 rounded-xl border border-ocean-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Pricing</h3>
          {stay.nightly_rate ? (
            <p className="text-3xl font-bold text-white mb-1">
              {formatCurrency(stay.nightly_rate)}
              <span className="text-sm text-ocean-400 font-normal">/night</span>
            </p>
          ) : (
            <p className="text-ocean-400">No price available</p>
          )}

          {stay.nightly_rate && (
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between text-ocean-300">
                <span>3 nights</span>
                <span className="text-white font-medium">
                  {formatCurrency(stay.nightly_rate * 3)}
                </span>
              </div>
              <div className="flex justify-between text-ocean-300">
                <span>5 nights</span>
                <span className="text-white font-medium">
                  {formatCurrency(stay.nightly_rate * 5)}
                </span>
              </div>
              <div className="flex justify-between text-ocean-300">
                <span>7 nights</span>
                <span className="text-white font-medium">
                  {formatCurrency(stay.nightly_rate * 7)}
                </span>
              </div>
              <p className="text-[10px] text-ocean-500 mt-2">
                Estimates only. Final price may vary on Airbnb.
              </p>
            </div>
          )}
        </div>

        {/* Host & Contact card */}
        <div className="bg-ocean-900 rounded-xl border border-ocean-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Host & Contact
          </h3>

          {stay.host_name ? (
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400 text-lg font-bold">
                {(stay.host_name as string)[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-white font-semibold">{stay.host_name}</p>
                {(stay.is_superhost as boolean) && (
                  <p className="text-yellow-400 text-xs">Superhost</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-ocean-400 text-sm mb-4">
              Host info not available from search — view on Airbnb for details.
            </p>
          )}

          <div className="space-y-3">
            {stay.source_url && (
              <a
                href={stay.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
                </svg>
                View on Airbnb
              </a>
            )}
            <p className="text-[10px] text-ocean-500 text-center">
              Contact host directly through Airbnb, or reach out off-platform
              for group booking rates.
            </p>
          </div>
        </div>

        {/* Property details card */}
        <div className="bg-ocean-900 rounded-xl border border-ocean-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Property Details
          </h3>
          <div className="space-y-3">
            {stay.property_type && (
              <DetailRow label="Type" value={stay.property_type} />
            )}
            {stay.bedrooms != null && (
              <DetailRow label="Bedrooms" value={stay.bedrooms} />
            )}
            {stay.beds != null && (
              <DetailRow label="Beds" value={stay.beds} />
            )}
            {stay.bathrooms != null && (
              <DetailRow label="Bathrooms" value={stay.bathrooms} />
            )}
            {stay.max_guests != null && (
              <DetailRow label="Max Guests" value={stay.max_guests} />
            )}
            {stay.city && (
              <DetailRow label="City" value={stay.city} />
            )}
            {stay.neighborhood && (
              <DetailRow label="Neighborhood" value={stay.neighborhood} />
            )}
            {stay.latitude && stay.longitude && (
              <DetailRow
                label="Coordinates"
                value={`${Number(stay.latitude).toFixed(4)}, ${Number(stay.longitude).toFixed(4)}`}
              />
            )}
          </div>
        </div>

        {/* Amenities */}
        {amenities.length > 0 && (
          <div className="bg-ocean-900 rounded-xl border border-ocean-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              Amenities
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {amenities.map((a: string, i: number) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-ocean-300 text-sm"
                >
                  <span className="text-green-400">&#10003;</span>
                  {a}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {stay.description && (
          <div className="bg-ocean-900 rounded-xl border border-ocean-700 p-6 lg:col-span-3">
            <h3 className="text-lg font-semibold text-white mb-4">
              Description
            </h3>
            <p className="text-ocean-300 text-sm leading-relaxed whitespace-pre-line">
              {stay.description}
            </p>
          </div>
        )}

        {/* Scrape metadata */}
        <div className="bg-ocean-900 rounded-xl border border-ocean-700 p-6 lg:col-span-3">
          <h3 className="text-lg font-semibold text-white mb-4">
            Listing Info
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-ocean-500 text-xs uppercase tracking-wider mb-1">
                Source
              </p>
              <p className="text-ocean-300 capitalize">
                {stay.source_provider ?? "airbnb"}
              </p>
            </div>
            <div>
              <p className="text-ocean-500 text-xs uppercase tracking-wider mb-1">
                Listing ID
              </p>
              <p className="text-ocean-300 font-mono text-xs">
                {stay.source_listing_id}
              </p>
            </div>
            <div>
              <p className="text-ocean-500 text-xs uppercase tracking-wider mb-1">
                Last Scraped
              </p>
              <p className="text-ocean-300">
                {stay.last_scraped_at
                  ? new Date(stay.last_scraped_at).toLocaleString()
                  : "Never"}
              </p>
            </div>
            <div>
              <p className="text-ocean-500 text-xs uppercase tracking-wider mb-1">
                Active
              </p>
              <span
                className={cn(
                  "px-2 py-1 rounded text-xs font-medium",
                  stay.is_active
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400",
                )}
              >
                {stay.is_active ? "Yes" : "No"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="px-3 py-1.5 rounded-full bg-ocean-800 text-ocean-300 text-xs font-medium capitalize">
      {label}
    </span>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ocean-500 text-sm">{label}</span>
      <span className="text-white text-sm font-medium">{value}</span>
    </div>
  );
}
