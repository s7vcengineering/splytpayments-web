import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase";

export async function POST(
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

  // Find the user's active pledge
  const { data: pledge } = await admin
    .from("pledges")
    .select("*")
    .eq("experience_id", experienceId)
    .eq("user_id", user.id)
    .in("status", ["reserved", "active"])
    .single();

  if (!pledge) {
    return NextResponse.json(
      { error: "No active pledge found" },
      { status: 404 },
    );
  }

  // Get the experience for cancellation policy check
  const { data: experience } = await admin
    .from("experiences")
    .select("cancellation_policy, date_time, current_participants, status")
    .eq("id", experienceId)
    .single();

  if (!experience) {
    return NextResponse.json(
      { error: "Experience not found" },
      { status: 404 },
    );
  }

  // Calculate refund based on cancellation policy
  let refundAmount = pledge.amount;
  const now = new Date();
  const eventDate = experience.date_time ? new Date(experience.date_time) : null;
  const hoursUntilEvent = eventDate
    ? (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60)
    : Infinity;

  if (experience.cancellation_policy === "strict") {
    if (hoursUntilEvent < 48) {
      refundAmount = 0; // No refund within 48 hours
    } else if (hoursUntilEvent < 168) {
      refundAmount = Math.round(pledge.amount * 0.5); // 50% refund within 7 days
    }
  } else if (experience.cancellation_policy === "moderate") {
    if (hoursUntilEvent < 24) {
      refundAmount = 0;
    } else if (hoursUntilEvent < 72) {
      refundAmount = Math.round(pledge.amount * 0.5);
    }
  }
  // flexible = full refund always

  // Withdraw the pledge
  await admin
    .from("pledges")
    .update({ status: "withdrawn" })
    .eq("id", pledge.id);

  // Refund to wallet
  if (refundAmount > 0) {
    await admin.rpc("increment_wallet", {
      user_id: user.id,
      amount: refundAmount,
    }).then(async (res) => {
      // If RPC doesn't exist, do manual update
      if (res.error) {
        const { data: profile } = await admin
          .from("profiles")
          .select("wallet_balance")
          .eq("id", user.id)
          .single();
        if (profile) {
          await admin
            .from("profiles")
            .update({ wallet_balance: (profile.wallet_balance || 0) + refundAmount })
            .eq("id", user.id);
        }
      }
    });

    // Record refund transaction
    await admin.from("payment_transactions").insert({
      user_id: user.id,
      experience_id: experienceId,
      amount: refundAmount,
      type: "refund",
      status: "completed",
      description: `Refund for leaving split (${experience.cancellation_policy} policy)`,
    });
  }

  // Decrement participant count
  const newCount = Math.max(0, (experience.current_participants || 1) - 1);
  await admin
    .from("experiences")
    .update({
      current_participants: newCount,
      status: newCount === 0 ? "open" : "filling",
    })
    .eq("id", experienceId);

  return NextResponse.json({
    refundAmount,
    pledgeAmount: pledge.amount,
    policy: experience.cancellation_policy,
  });
}
