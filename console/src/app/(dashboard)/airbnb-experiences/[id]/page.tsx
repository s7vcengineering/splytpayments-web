import { createServiceClient } from "@/lib/supabase";
import { formatCurrency, cn, formatCity } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

async function getExperience(id: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("airbnb_experiences")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data;
}

export default async function ExperienceDetailPage({ params }: Props) {
  const { id } = await params;
  const exp = await getExperience(id);

  if (!exp) notFound();

  const photos = (exp.photo_urls as string[]) || [];

  return (
    <div>
      {/* Back link */}
      <Link
        href="/airbnb-experiences"
        className="inline-flex items-center gap-1.5 text-sm text-ocean-400 hover:text-white transition-colors mb-6"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
        </svg>
        Back to experiences
      </Link>

      {/* Photo gallery */}
      {photos.length > 0 && (
        <div className="mb-6">
          <div className="grid grid-cols-4 grid-rows-2 gap-2 rounded-xl overflow-hidden h-[400px] relative">
            <div className="col-span-2 row-span-2 bg-ocean-800">
              <img
                src={photos[0]}
                alt={exp.title}
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
            {photos.length > 5 && (
              <div className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-black/70 text-white text-xs font-medium backdrop-blur-sm">
                {photos.length} photos
              </div>
            )}
          </div>
          {photos.length > 5 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-ocean-400 mb-2">
                All Photos ({photos.length})
              </h4>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                {photos.slice(5).map((url: string, i: number) => (
                  <div
                    key={i}
                    className="aspect-square rounded-lg overflow-hidden bg-ocean-800"
                  >
                    <img
                      src={url}
                      alt=""
                      className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">{exp.title}</h2>
          <p className="text-ocean-400 mt-1">
            {exp.city ? formatCity(exp.city) : "Unknown location"}
            {exp.category && (
              <span> &middot; {exp.category}</span>
            )}
          </p>
        </div>
        {exp.rating && (
          <div className="flex items-center gap-1.5 bg-ocean-800 rounded-lg px-3 py-2">
            <svg
              className="w-4 h-4 text-yellow-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="text-white font-bold">
              {Number(exp.rating).toFixed(1)}
            </span>
            {exp.review_count > 0 && (
              <span className="text-ocean-400 text-sm">
                ({exp.review_count} reviews)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2 mb-6">
        {exp.category && <Badge label={exp.category} />}
        {exp.duration_minutes && (
          <Badge label={`${exp.duration_minutes} minutes`} />
        )}
        {exp.price_type && exp.price_type !== "person" && (
          <Badge label={`Per ${exp.price_type}`} />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pricing card */}
        <div className="bg-ocean-900 rounded-xl border border-ocean-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Pricing</h3>
          {exp.price_amount ? (
            <p className="text-3xl font-bold text-white mb-1">
              {formatCurrency(exp.price_amount)}
              <span className="text-sm text-ocean-400 font-normal">
                /{exp.price_type || "person"}
              </span>
            </p>
          ) : (
            <p className="text-ocean-400">No price available</p>
          )}

          {exp.price_amount && (
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between text-ocean-300">
                <span>2 people</span>
                <span className="text-white font-medium">
                  {formatCurrency(exp.price_amount * 2)}
                </span>
              </div>
              <div className="flex justify-between text-ocean-300">
                <span>4 people</span>
                <span className="text-white font-medium">
                  {formatCurrency(exp.price_amount * 4)}
                </span>
              </div>
              <div className="flex justify-between text-ocean-300">
                <span>6 people</span>
                <span className="text-white font-medium">
                  {formatCurrency(exp.price_amount * 6)}
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

          {exp.host_name ? (
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-400 text-lg font-bold">
                {(exp.host_name as string)[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-white font-semibold">{exp.host_name}</p>
                <p className="text-ocean-500 text-xs">Experience host</p>
              </div>
            </div>
          ) : (
            <p className="text-ocean-400 text-sm mb-4">
              Host info not yet available — enrichment in progress.
            </p>
          )}

          <div className="space-y-3">
            {exp.source_url && (
              <a
                href={exp.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-pink-500 hover:bg-pink-600 text-white text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
                </svg>
                View on Airbnb
              </a>
            )}
            <p className="text-[10px] text-ocean-500 text-center">
              Book this experience directly on Airbnb, or contact the host for
              group rates.
            </p>
          </div>
        </div>

        {/* Experience details card */}
        <div className="bg-ocean-900 rounded-xl border border-ocean-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Experience Details
          </h3>
          <div className="space-y-3">
            {exp.category && (
              <DetailRow label="Category" value={exp.category} />
            )}
            {exp.duration_minutes != null && (
              <DetailRow
                label="Duration"
                value={
                  exp.duration_minutes >= 60
                    ? `${Math.floor(exp.duration_minutes / 60)}h ${exp.duration_minutes % 60 ? `${exp.duration_minutes % 60}m` : ""}`
                    : `${exp.duration_minutes} min`
                }
              />
            )}
            {exp.city && (
              <DetailRow label="City" value={formatCity(exp.city)} />
            )}
            {exp.latitude && exp.longitude && (
              <DetailRow
                label="Coordinates"
                value={`${Number(exp.latitude).toFixed(4)}, ${Number(exp.longitude).toFixed(4)}`}
              />
            )}
          </div>
        </div>

        {/* Description */}
        {exp.description && (
          <div className="bg-ocean-900 rounded-xl border border-ocean-700 p-6 lg:col-span-3">
            <h3 className="text-lg font-semibold text-white mb-4">
              Description
            </h3>
            <p className="text-ocean-300 text-sm leading-relaxed whitespace-pre-line">
              {exp.description}
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
                {exp.source_provider ?? "airbnb"}
              </p>
            </div>
            <div>
              <p className="text-ocean-500 text-xs uppercase tracking-wider mb-1">
                Listing ID
              </p>
              <p className="text-ocean-300 font-mono text-xs">
                {exp.source_listing_id}
              </p>
            </div>
            <div>
              <p className="text-ocean-500 text-xs uppercase tracking-wider mb-1">
                Last Scraped
              </p>
              <p className="text-ocean-300">
                {exp.last_scraped_at
                  ? new Date(exp.last_scraped_at).toLocaleString()
                  : "Never"}
              </p>
            </div>
            <div>
              <p className="text-ocean-500 text-xs uppercase tracking-wider mb-1">
                Photos
              </p>
              <p className="text-ocean-300">{photos.length}</p>
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
