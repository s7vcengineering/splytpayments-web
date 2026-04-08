import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase";

const STRIPE_API = "https://api.stripe.com/v1";

export async function POST(request: NextRequest) {
  const apiKey =
    process.env.STRIPE_SECRET_KEY_PROD || process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 500 },
    );
  }

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

  const { session_id } = await request.json();
  if (!session_id) {
    return NextResponse.json(
      { error: "Missing session_id" },
      { status: 400 },
    );
  }

  // Fetch session from Stripe
  const sessionRes = await fetch(
    `${STRIPE_API}/checkout/sessions/${encodeURIComponent(session_id)}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  const session = await sessionRes.json();

  if (session.error) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  if (session.payment_status !== "paid") {
    return NextResponse.json(
      { error: "Payment not completed" },
      { status: 400 },
    );
  }

  if (session.metadata?.user_id !== user.id) {
    return NextResponse.json(
      { error: "Session does not belong to you" },
      { status: 403 },
    );
  }

  const amount = Number(session.metadata.amount);
  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const admin = createServiceClient();

  // Idempotency: check if already credited
  const { data: existing } = await admin
    .from("payment_transactions")
    .select("id")
    .eq("description", `wallet_topup:${session_id}`)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ already_credited: true, amount });
  }

  // Credit wallet balance and record transaction
  const { data: profile } = await admin
    .from("profiles")
    .select("wallet_balance")
    .eq("id", user.id)
    .single();

  const newBalance = (profile?.wallet_balance || 0) + amount;

  await Promise.all([
    admin
      .from("profiles")
      .update({ wallet_balance: newBalance })
      .eq("id", user.id),
    admin.from("payment_transactions").insert({
      user_id: user.id,
      recipient_id: user.id,
      amount,
      type: "deposit",
      status: "completed",
      description: `wallet_topup:${session_id}`,
    }),
  ]);

  return NextResponse.json({ credited: true, amount, new_balance: newBalance });
}
