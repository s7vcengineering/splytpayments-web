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

  const admin = createServiceClient();
  const { data: profile } = await admin
    .from("profiles")
    .select(
      "stripe_connect_account_id, stripe_connect_onboarded, email, display_name, role",
    )
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  let accountId = profile.stripe_connect_account_id;

  // Create Stripe Connect account if needed
  if (!accountId) {
    const accountRes = await fetch(`${STRIPE_API}/accounts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        type: "express",
        email: profile.email || user.email || "",
        "metadata[user_id]": user.id,
        "capabilities[card_payments][requested]": "true",
        "capabilities[transfers][requested]": "true",
        "business_profile[product_description]":
          "Luxury experience hosting on SPLYT",
      }).toString(),
    });
    const account = await accountRes.json();

    if (account.error) {
      return NextResponse.json(
        { error: account.error.message },
        { status: 500 },
      );
    }

    accountId = account.id;
    await admin
      .from("profiles")
      .update({ stripe_connect_account_id: accountId })
      .eq("id", user.id);
  }

  // Generate Account Link for onboarding
  const origin = request.nextUrl.origin;
  const linkRes = await fetch(`${STRIPE_API}/account_links`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      account: accountId!,
      refresh_url: `${origin}/app/wallet`,
      return_url: `${origin}/app/wallet?connect=complete`,
      type: "account_onboarding",
    }).toString(),
  });
  const link = await linkRes.json();

  if (link.error) {
    return NextResponse.json({ error: link.error.message }, { status: 500 });
  }

  return NextResponse.json({ url: link.url });
}

// Check Connect status and update profile
export async function GET(request: NextRequest) {
  const apiKey =
    process.env.STRIPE_SECRET_KEY_PROD || process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 500 },
    );
  }

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
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_connect_account_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_connect_account_id) {
    return NextResponse.json({ onboarded: false });
  }

  // Check account status
  const accountRes = await fetch(
    `${STRIPE_API}/accounts/${profile.stripe_connect_account_id}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  const account = await accountRes.json();

  const onboarded =
    account.charges_enabled && account.payouts_enabled;

  // Update profile if status changed
  await admin
    .from("profiles")
    .update({ stripe_connect_onboarded: onboarded })
    .eq("id", user.id);

  return NextResponse.json({
    onboarded,
    charges_enabled: account.charges_enabled,
    payouts_enabled: account.payouts_enabled,
  });
}
