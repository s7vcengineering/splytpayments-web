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

  const { amount } = await request.json();
  if (!amount || amount < 1) {
    return NextResponse.json(
      { error: "Amount must be at least $1" },
      { status: 400 },
    );
  }

  const admin = createServiceClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("wallet_balance")
    .eq("id", user.id)
    .single();

  if (!profile || profile.wallet_balance < amount) {
    return NextResponse.json(
      { error: "Insufficient balance" },
      { status: 400 },
    );
  }

  const newBalance = profile.wallet_balance - amount;

  await Promise.all([
    admin
      .from("profiles")
      .update({ wallet_balance: newBalance })
      .eq("id", user.id),
    admin.from("payment_transactions").insert({
      user_id: user.id,
      amount,
      type: "withdrawal",
      status: "pending",
      description: "Withdrawal request",
    }),
  ]);

  return NextResponse.json({ success: true, new_balance: newBalance });
}
