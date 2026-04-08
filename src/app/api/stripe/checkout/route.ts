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

  // Authenticate user via Supabase cookies
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

  const { amount } = await request.json();
  if (!amount || amount < 5 || amount > 10000) {
    return NextResponse.json(
      { error: "Amount must be between $5 and $10,000" },
      { status: 400 },
    );
  }

  const admin = createServiceClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id, email, display_name")
    .eq("id", user.id)
    .single();

  let customerId = profile?.stripe_customer_id;

  // Create Stripe customer if needed
  if (!customerId) {
    const customerRes = await fetch(`${STRIPE_API}/customers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        email: profile?.email || user.email || "",
        name: profile?.display_name || "",
        "metadata[user_id]": user.id,
      }).toString(),
    });
    const customer = await customerRes.json();
    if (customer.error) {
      return NextResponse.json(
        { error: customer.error.message },
        { status: 500 },
      );
    }
    customerId = customer.id;
    await admin
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  // Create Checkout Session
  const origin = request.nextUrl.origin;
  const sessionRes = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      mode: "payment",
      customer: customerId!,
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(
        Math.round(amount * 100),
      ),
      "line_items[0][price_data][product_data][name]": "SPLYT Wallet Top-Up",
      "line_items[0][quantity]": "1",
      success_url: `${origin}/app/wallet?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/app/wallet`,
      "metadata[user_id]": user.id,
      "metadata[type]": "wallet_topup",
      "metadata[amount]": String(amount),
    }).toString(),
  });

  const session = await sessionRes.json();
  if (session.error) {
    return NextResponse.json(
      { error: session.error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: session.url });
}
