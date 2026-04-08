import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  // Authenticate user
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check user has a business role
  const admin = createServiceClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, secondary_roles")
    .eq("id", user.id)
    .single();

  const businessRoles = [
    "captain",
    "host",
    "boat_owner",
    "operator",
    "fleet_owner",
    "brand",
    "admin",
    "super_admin",
  ];
  const hasRole =
    businessRoles.includes(profile?.role) ||
    profile?.secondary_roles?.some((r: string) => businessRoles.includes(r));

  if (!hasRole) {
    return NextResponse.json(
      { error: "Only partners can create experiences" },
      { status: 403 },
    );
  }

  const body = await request.json();

  // Validate required fields
  if (!body.title?.trim()) {
    return NextResponse.json(
      { error: "Title is required" },
      { status: 400 },
    );
  }
  if (!body.total_cost || body.total_cost < 1) {
    return NextResponse.json(
      { error: "Total cost must be at least $1" },
      { status: 400 },
    );
  }
  if (!body.max_participants || body.max_participants < 2) {
    return NextResponse.json(
      { error: "Must allow at least 2 participants" },
      { status: 400 },
    );
  }
  if (!body.location?.trim()) {
    return NextResponse.json(
      { error: "Location is required" },
      { status: 400 },
    );
  }

  const { data: experience, error } = await admin
    .from("experiences")
    .insert({
      host_id: user.id,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      type: body.type || "experience",
      status: "open",
      total_cost: body.total_cost,
      max_participants: body.max_participants,
      current_participants: 0,
      date_time: body.date_time || null,
      duration_hours: body.duration_hours || null,
      location: body.location.trim(),
      photo_urls: body.photo_urls || [],
      amenities: body.amenities || [],
      vibe: body.vibe || null,
      category: body.category || null,
      booking_mode: body.booking_mode || "request",
      cancellation_policy: body.cancellation_policy || "flexible",
      security_deposit: body.security_deposit || null,
      currency: "USD",
      tipping_enabled: false,
      is_private: body.is_private || false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ experience });
}
