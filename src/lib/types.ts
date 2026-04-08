export type UserRole = "user" | "captain" | "boat_owner" | "operator" | "fleet_owner" | "host" | "brand" | "admin" | "super_admin";

export interface UserProfile {
  id: string;
  email: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  interests: string[];
  budget_min: number | null;
  budget_max: number | null;
  wallet_balance: number;
  role: UserRole;
  secondary_roles: string[];
  home_city: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  x_url: string | null;
  phone: string | null;
  date_of_birth: string | null;
  onboarding_complete: boolean;
  is_premium: boolean;
  premium_until: string | null;
  referral_code: string | null;
  badges: string[];
  stripe_customer_id: string | null;
  stripe_connect_account_id: string | null;
  stripe_connect_onboarded: boolean;
  host_tier: string | null;
  host_response_rate: number | null;
  payout_method: string | null;
  listing_quality_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface Experience {
  id: string;
  host_id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  total_cost: number;
  max_participants: number;
  current_participants: number;
  date_time: string;
  duration_hours: number;
  location: string;
  photo_urls: string[];
  boat_id: string | null;
  boat_name: string | null;
  boat_type: string | null;
  source_provider: string | null;
  amenities: string[];
  vibe: string | null;
  category: string | null;
  booking_mode: string;
  cancellation_policy: string;
  security_deposit: number | null;
  currency: string;
  tipping_enabled: boolean;
  is_private: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  host?: Pick<UserProfile, "id" | "display_name" | "avatar_url" | "host_tier">;
}

export interface Pledge {
  id: string;
  experience_id: string;
  user_id: string;
  amount: number;
  status: "reserved" | "active" | "fulfilled" | "withdrawn";
  created_at: string;
  updated_at: string;
  // Joined
  experience?: Experience;
  user?: Pick<UserProfile, "id" | "display_name" | "avatar_url">;
}

export interface ChatThread {
  id: string;
  experience_id: string | null;
  experience_title: string;
  is_direct_message: boolean;
  member_ids: string[];
  dm_partner_id: string | null;
  dm_partner_avatar_url: string | null;
  last_message_id: string | null;
  amount_pledged: number | null;
  created_at: string;
  updated_at: string;
  // Joined
  last_message?: ChatMessage;
  experience?: Pick<Experience, "id" | "photo_urls" | "date_time" | "location" | "type" | "total_cost">;
}

export interface ChatMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_name: string | null;
  sender_avatar_url: string | null;
  content: string;
  image_url: string | null;
  is_pinned: boolean;
  read_by: string[];
  created_at: string;
}

export interface WishlistItem {
  id: string;
  user_id: string;
  experience_id: string;
  experience_title: string | null;
  experience_image_url: string | null;
  experience_price: number | null;
  host_name: string | null;
  collection_name: string | null;
  created_at: string;
  // Joined
  experience?: Experience;
}

export interface PaymentTransaction {
  id: string;
  user_id: string;
  recipient_id: string | null;
  experience_id: string | null;
  amount: number;
  type: string;
  status: string;
  description: string | null;
  created_at: string;
}

export interface JoinRequest {
  id: string;
  experience_id: string;
  user_id: string;
  host_id: string;
  amount: number;
  status: "pending" | "accepted" | "deferred";
  thread_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  user?: Pick<UserProfile, "id" | "display_name" | "avatar_url" | "bio" | "instagram_url" | "is_premium" | "home_city">;
  experience?: Experience;
}

export interface Invoice {
  id: string;
  experience_id: string;
  thread_id: string;
  total_amount: number;
  per_person: number;
  member_count: number;
  status: "pending" | "approved" | "cancelled" | "disbursed";
  created_at: string;
  updated_at: string;
  experience?: Experience;
}

export interface SecurityDeposit {
  id: string;
  experience_id: string;
  user_id: string;
  amount: number;
  status: "held" | "released" | "claimed" | "partial_claim";
  stripe_payment_intent_id: string | null;
  held_at: string;
  released_at: string | null;
}

export function hasBusinessRole(profile: UserProfile): boolean {
  const businessRoles = ["captain", "boat_owner", "operator", "fleet_owner", "host", "brand"];
  return (
    businessRoles.includes(profile.role) ||
    profile.secondary_roles?.some((r) => businessRoles.includes(r)) ||
    profile.role === "admin" ||
    profile.role === "super_admin"
  );
}

export function isAdmin(profile: UserProfile): boolean {
  return profile.role === "admin" || profile.role === "super_admin";
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return formatDate(dateStr);
}

/** Navigation items for personal view */
export const personalNav = [
  { href: "/app", label: "Home", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" },
  { href: "/app/explore", label: "Explore", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
  { href: "/app/splits", label: "My Splits", icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" },
  { href: "/app/messages", label: "Messages", icon: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" },
  { href: "/app/notifications", label: "Notifications", icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" },
  { href: "/app/saved", label: "Saved", icon: "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" },
  { href: "/app/wallet", label: "Wallet", icon: "M21 12V7H5a2 2 0 010-4h14v4M3 5v14a2 2 0 002 2h16v-5M18 14a1 1 0 100 2 1 1 0 000-2z" },
  { href: "/app/profile", label: "Profile", icon: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z" },
  { href: "/app/settings", label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
  { href: "/app/help", label: "Help", icon: "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
];

/** Navigation items for business/partner view */
export const businessNav = [
  { href: "/app/business", label: "Dashboard", icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" },
  { href: "/app/business/listings", label: "My Listings", icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
  { href: "/app/business/availability", label: "Availability", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { href: "/app/business/bookings", label: "Bookings", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  { href: "/app/business/revenue", label: "Revenue", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { href: "/app/business/messages", label: "Messages", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
  { href: "/app/business/settings", label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
];
