import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: experienceId } = await params;

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

  const admin = createServiceClient();

  // Verify ownership
  const { data: experience } = await admin
    .from("experiences")
    .select("host_id")
    .eq("id", experienceId)
    .single();

  if (!experience) {
    return NextResponse.json(
      { error: "Experience not found" },
      { status: 404 },
    );
  }

  if (experience.host_id !== user.id) {
    return NextResponse.json(
      { error: "You can only edit your own experiences" },
      { status: 403 },
    );
  }

  const body = await request.json();

  // Only allow updating specific fields
  const allowedFields: Record<string, any> = {};
  const editable = [
    "title",
    "description",
    "type",
    "total_cost",
    "max_participants",
    "date_time",
    "duration_hours",
    "location",
    "photo_urls",
    "amenities",
    "vibe",
    "category",
    "booking_mode",
    "cancellation_policy",
    "security_deposit",
    "is_private",
    "status",
  ];

  for (const field of editable) {
    if (body[field] !== undefined) {
      allowedFields[field] = body[field];
    }
  }

  if (Object.keys(allowedFields).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 },
    );
  }

  const { data: updated, error } = await admin
    .from("experiences")
    .update(allowedFields)
    .eq("id", experienceId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ experience: updated });
}
