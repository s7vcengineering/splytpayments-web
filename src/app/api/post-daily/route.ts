export const runtime = "edge";

/**
 * POST|GET /api/post-daily
 *
 * Picks the best boat listing to post, generates an Instagram card via
 * /api/card/experience, and publishes it through the s7vc-social-marketing
 * service.
 *
 * Protected by CRON_SECRET — pass as:
 *   - Header: Authorization: Bearer <CRON_SECRET> (Vercel cron default)
 *   - Or query param: ?secret=<CRON_SECRET>
 *
 * The route selects a listing that hasn't been posted recently by checking
 * the `social_posts_log` table in Supabase.
 */

interface Listing {
  id: string;
  source_type: "boat" | "car" | "experience" | "stay";
  name: string;
  title?: string;
  type?: string;
  city?: string;
  hourly_rate?: number;
  daily_rate?: number;
  price_per_person?: number;
  price_per_night?: number;
  capacity?: number;
  max_guests?: number;
  rating?: number;
  length_ft?: number;
  captain_name?: string;
  host_name?: string;
  features?: string[];
  amenities?: string[];
  make?: string;
  model?: string;
  description?: string;
  is_active?: boolean;
  boatsetter_listing_id?: string;
  body_style?: string;
  category?: string;
  photo_urls?: string[];
}

function supabaseFetch(
  supabaseUrl: string,
  supabaseKey: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
}

export async function GET(req: Request): Promise<Response> {
  // ── Auth guard ──
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return Response.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
  }

  const url = new URL(req.url);
  const authHeader = req.headers.get("authorization");
  const querySecret = url.searchParams.get("secret");
  const providedSecret = authHeader?.replace("Bearer ", "") || querySecret || "";

  if (providedSecret !== cronSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Env validation ──
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const socialMarketingUrl = process.env.SOCIAL_MARKETING_URL;
  const socialMarketingApiKey = process.env.SOCIAL_MARKETING_API_KEY;
  const appUrl = process.env.APP_URL || process.env.VERCEL_URL;

  if (!supabaseUrl || !supabaseKey) {
    return Response.json(
      { error: "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set" },
      { status: 500 }
    );
  }

  if (!socialMarketingUrl || !socialMarketingApiKey) {
    return Response.json(
      { error: "SOCIAL_MARKETING_URL and SOCIAL_MARKETING_API_KEY must be set" },
      { status: 500 }
    );
  }

  if (!appUrl) {
    return Response.json(
      { error: "APP_URL or VERCEL_URL must be set" },
      { status: 500 }
    );
  }

  const baseUrl = appUrl.startsWith("http") ? appUrl : `https://${appUrl}`;

  try {
    // ── 1. Get IDs of listings already posted to Instagram ──
    const postedResp = await supabaseFetch(
      supabaseUrl,
      supabaseKey,
      "social_posts_log?select=boat_id,listing_type&platform=eq.instagram&status=eq.published"
    );
    const postedRows: { boat_id: string; listing_type?: string }[] = await postedResp.json();
    const postedIds = Array.isArray(postedRows)
      ? postedRows.map((r) => r.boat_id).filter(Boolean)
      : [];

    // ── 2. Rotate through experience types ──
    // Use day-of-year to cycle: boats, cars, experiences, stays
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
    );
    const sourceTypes = ["boat", "car", "experience", "boat"] as const;
    const todayType = sourceTypes[dayOfYear % sourceTypes.length];

    let listing: Listing | null = null;

    // Try today's type first, fall back to others if empty
    const typesToTry = [todayType, ...sourceTypes.filter(t => t !== todayType)];

    for (const tryType of typesToTry) {
      if (listing) break;

      let table: string;
      let ratingCol = "rating";
      if (tryType === "car") table = "exotic_cars";
      else if (tryType === "experience") table = "airbnb_experiences";
      else if (tryType === "stay") table = "airbnb_stays";
      else table = "boats";

      let query = `${table}?select=*&order=${ratingCol}.desc.nullslast,created_at.desc&limit=1`;

      if (table === "boats") query = `${table}?select=*&is_active=eq.true&order=${ratingCol}.desc.nullslast,created_at.desc&limit=1`;

      if (postedIds.length > 0) {
        query += `&id=not.in.(${postedIds.join(",")})`;
      }

      const resp = await supabaseFetch(supabaseUrl, supabaseKey, query);
      const rows = await resp.json();

      if (Array.isArray(rows) && rows.length > 0) {
        listing = { ...rows[0], source_type: tryType };
      }
    }

    if (!listing) {
      return Response.json(
        { message: "No unposted listings available across any category" },
        { status: 200 }
      );
    }

    // ── 3. Extract display values based on type ──
    const displayTitle = listing.title || listing.name || "Premium Experience";
    const displayCity = listing.city || "Miami";
    const displayRating = listing.rating ? Number(listing.rating) : 0;

    let priceStr = "";
    let splitPriceStr = "";
    let categoryLine = "";
    let hashtags = "#SPLYT #SplitTheCost #LuxuryForLess";
    let tagline = "Premium experiences, split your way.";

    if (listing.source_type === "car") {
      const dailyRate = listing.daily_rate ? Math.round(Number(listing.daily_rate)) : 0;
      priceStr = dailyRate > 0 ? `From $${dailyRate}/day` : "";
      splitPriceStr = dailyRate > 0 ? `$${Math.round(dailyRate / 4)}/person when you split with 4` : "";
      categoryLine = `${listing.body_style || "Exotic Car"} | ${listing.city || "Miami"}`;
      hashtags = "#SPLYT #ExoticCars #LuxuryCars #SplitTheCost #LuxuryForLess #SuperCars #CarRental";
      tagline = "Drive what you've always wanted.";
    } else if (listing.source_type === "experience") {
      const ppp = listing.price_per_person ? Math.round(Number(listing.price_per_person)) : 0;
      priceStr = ppp > 0 ? `From $${ppp}/person` : "";
      splitPriceStr = "";
      categoryLine = `${listing.category || "Experience"} | ${listing.city || "Miami"}`;
      hashtags = "#SPLYT #Experiences #ThingsToDo #SplitTheCost #LuxuryForLess #LocalExperiences";
      tagline = "Discover experiences worth sharing.";
    } else if (listing.source_type === "stay") {
      const ppn = listing.price_per_night ? Math.round(Number(listing.price_per_night)) : 0;
      priceStr = ppn > 0 ? `From $${ppn}/night` : "";
      splitPriceStr = ppn > 0 ? `$${Math.round(ppn / 8)}/person per night split 8 ways` : "";
      categoryLine = `Luxury Stay | ${listing.city || "Miami"}`;
      hashtags = "#SPLYT #LuxuryStays #VacationRental #SplitTheCost #LuxuryForLess #TravelDeals";
      tagline = "Luxury stays, split your way.";
    } else {
      const hourlyRate = listing.hourly_rate ? Math.round(Number(listing.hourly_rate)) : 0;
      priceStr = hourlyRate > 0 ? `From $${hourlyRate}/hr` : "";
      splitPriceStr = hourlyRate > 0 ? `$${Math.round((hourlyRate * 4) / 8)}/person when you split with 8` : "";
      categoryLine = `${listing.type || "Yacht"} | ${listing.length_ft || 42}ft | ${displayCity}`;
      hashtags = "#SPLYT #YachtLife #BoatRental #YachtCharter #SplitTheCost #LuxuryForLess #BoatDay";
      tagline = "Life's too short to yacht alone.";
    }

    // ── 4. Build the card image URL ──
    const cardUrl = `${baseUrl}/api/card/experience?id=${listing.id}&type=${listing.source_type}&format=feed`;

    // ── 5. Build the Instagram caption ──
    const captionParts = [
      displayTitle,
      "",
      categoryLine,
      displayRating ? `Rating: ${"*".repeat(Math.floor(displayRating))} ${displayRating}` : "",
      "",
      priceStr,
      splitPriceStr,
      "",
      tagline,
      "Split the cost with your crew on SPLYT.",
      "",
      "Download SPLYT - link in bio",
      "",
      hashtags,
    ];

    const caption = captionParts.filter((line) => line !== undefined).join("\n");

    // ── 6. Publish via s7vc-social-marketing ──
    const publishUrl = `${socialMarketingUrl}/functions/v1/publish`;

    const publishRes = await fetch(publishUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${socialMarketingApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        platform: "instagram",
        image_url: cardUrl,
        caption,
        post_type: "image",
        metadata: {
          boat_id: listing.id,
          listing_type: listing.source_type,
          listing_name: displayTitle,
          city: displayCity,
          source: "post-daily-cron",
        },
      }),
    });

    const publishData = await publishRes.json().catch(() => null);

    if (!publishRes.ok) {
      await supabaseFetch(supabaseUrl, supabaseKey, "social_posts_log", {
        method: "POST",
        body: JSON.stringify({
          boat_id: listing.id,
          listing_type: listing.source_type,
          platform: "instagram",
          status: "failed",
          error_message:
            publishData?.error || `Publish returned ${publishRes.status}`,
          card_url: cardUrl,
          caption,
          created_at: new Date().toISOString(),
        }),
      });

      return Response.json(
        {
          error: "Failed to publish to Instagram",
          details: publishData?.error || publishRes.statusText,
          listing_id: listing.id,
          listing_type: listing.source_type,
        },
        { status: 502 }
      );
    }

    // ── 7. Record the successful post ──
    await supabaseFetch(supabaseUrl, supabaseKey, "social_posts_log", {
      method: "POST",
      body: JSON.stringify({
        boat_id: listing.id,
        listing_type: listing.source_type,
        platform: "instagram",
        status: "published",
        external_post_id: publishData?.post_id || publishData?.id || null,
        card_url: cardUrl,
        caption,
        response_data: publishData,
        created_at: new Date().toISOString(),
      }),
    });

    return Response.json({
      success: true,
      listing_id: listing.id,
      listing_type: listing.source_type,
      listing_name: displayTitle,
      city: displayCity,
      card_url: cardUrl,
      publish_response: publishData,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
