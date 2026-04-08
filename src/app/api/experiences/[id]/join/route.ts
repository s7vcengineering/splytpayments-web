import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: experienceId } = await params;

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

  const admin = createServiceClient();

  // Fetch experience
  const { data: experience } = await admin
    .from("experiences")
    .select("*")
    .eq("id", experienceId)
    .single();

  if (!experience) {
    return NextResponse.json(
      { error: "Experience not found" },
      { status: 404 },
    );
  }

  if (experience.host_id === user.id) {
    return NextResponse.json(
      { error: "Cannot join your own experience" },
      { status: 400 },
    );
  }

  if (
    experience.status !== "open" &&
    experience.status !== "filling"
  ) {
    return NextResponse.json(
      { error: "Experience is not accepting new members" },
      { status: 400 },
    );
  }

  if (experience.current_participants >= experience.max_participants) {
    return NextResponse.json(
      { error: "Experience is full" },
      { status: 400 },
    );
  }

  // Check if user already has an active pledge
  const { data: existingPledge } = await admin
    .from("pledges")
    .select("id")
    .eq("experience_id", experienceId)
    .eq("user_id", user.id)
    .in("status", ["reserved", "active"])
    .maybeSingle();

  if (existingPledge) {
    return NextResponse.json(
      { error: "You already have a pledge for this experience" },
      { status: 400 },
    );
  }

  const perPerson = Math.ceil(
    experience.total_cost / experience.max_participants,
  );

  // Check wallet balance
  const { data: profile } = await admin
    .from("profiles")
    .select("wallet_balance")
    .eq("id", user.id)
    .single();

  if (!profile || profile.wallet_balance < perPerson) {
    return NextResponse.json(
      {
        error: "Insufficient wallet balance",
        required: perPerson,
        balance: profile?.wallet_balance || 0,
      },
      { status: 400 },
    );
  }

  // Deduct from wallet, create pledge, update participant count
  const newBalance = profile.wallet_balance - perPerson;
  const newParticipants = experience.current_participants + 1;
  const newStatus =
    newParticipants >= experience.max_participants ? "full" : "filling";

  const [pledgeRes] = await Promise.all([
    admin
      .from("pledges")
      .insert({
        experience_id: experienceId,
        user_id: user.id,
        amount: perPerson,
        status: "active",
      })
      .select()
      .single(),
    admin
      .from("profiles")
      .update({ wallet_balance: newBalance })
      .eq("id", user.id),
    admin
      .from("experiences")
      .update({
        current_participants: newParticipants,
        status: newStatus,
      })
      .eq("id", experienceId),
    admin.from("payment_transactions").insert({
      user_id: user.id,
      experience_id: experienceId,
      amount: perPerson,
      type: "pledge",
      status: "completed",
      description: `Pledge for: ${experience.title}`,
    }),
  ]);

  if (pledgeRes.error) {
    return NextResponse.json(
      { error: pledgeRes.error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    pledge: pledgeRes.data,
    new_balance: newBalance,
  });
}
