"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────
   DATA
   ────────────────────────────────────────────────────────── */

const PIPELINE_STAGES = [
  {
    key: "research",
    label: "Research",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    dot: "bg-blue-400",
  },
  {
    key: "outreach",
    label: "Outreach Sent",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    dot: "bg-purple-400",
  },
  {
    key: "negotiating",
    label: "Negotiating",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20",
    dot: "bg-yellow-400",
  },
  {
    key: "onboarded",
    label: "Onboarded",
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
    dot: "bg-green-400",
  },
] as const;

type PipelineStage = (typeof PIPELINE_STAGES)[number]["key"];

interface Partner {
  id: string;
  name: string;
  category: "exotic-cars" | "yacht-charter" | "concierge";
  tier: 1 | 2 | 3;
  stage: PipelineStage;
  keyPerson: string;
  title: string;
  phone: string;
  email: string;
  instagram: string;
  website: string;
  address: string;
  whyTarget: string;
  pitchAngle: string;
  crossSells: string[];
  notes: string;
}

const PARTNERS: Partner[] = [
  // TIER 1 — Exotic Cars (cross-sell yachts, natural fit)
  {
    id: "mvp-miami",
    name: "MVP Miami",
    category: "exotic-cars",
    tier: 1,
    stage: "research",
    keyPerson: "Matt Cruz",
    title: "Founder & Owner",
    phone: "786-877-4317",
    email: "",
    instagram: "@mattmvpmiami",
    website: "mvpmiami.com",
    address: "2500 NW 39th St, Miami, FL 33142",
    whyTarget:
      "Already cross-sells yachts and homes alongside cars. Understands multi-category luxury. Small enough to move fast on partnerships. Est. 2013, ~$7M revenue.",
    pitchAngle:
      "Our yacht members want your cars too. Every group that does a Saturday yacht day asks about exotic cars for the rest of the weekend.",
    crossSells: ["Yachts", "Homes"],
    notes:
      "Owns entire fleet (not borrowed). White glove service with free limo from airports. Not BBB accredited but strong Yelp reviews.",
  },
  {
    id: "mph-club",
    name: "mph club",
    category: "exotic-cars",
    tier: 1,
    stage: "research",
    keyPerson: "Liram Sustiel",
    title: "Co-Founder",
    phone: "",
    email: "",
    instagram: "@mphclub",
    website: "mphclub.com",
    address: "2001 NW 167th St, Miami Gardens, FL",
    whyTarget:
      "Largest exotic car rental in the US. Already runs a Vehicle Management Program (Airbnb for exotics) and a Broker Affiliate Program at 20% commission. Partnership-minded DNA. Franchising nationally.",
    pitchAngle:
      "Approach through their existing broker affiliate program as entry point, then pitch the deeper SPLYT integration for group bookings.",
    crossSells: ["Jets", "Yacht charters"],
    notes:
      "Co-founded with Stac Yagu and Brett David. Cars appeared in Taylor Swift, Rick Ross, Bad Bunny videos. ~$2M revenue, 10K+ clients. David Sustiel handles partnerships.",
  },
  {
    id: "luxx-miami",
    name: "Luxx Miami",
    category: "exotic-cars",
    tier: 1,
    stage: "research",
    keyPerson: "Clint Halim",
    title: "Founder & Owner",
    phone: "305-605-5899",
    email: "",
    instagram: "@luxx.miami",
    website: "luxxmiami.com",
    address: "1100 Brickell Bay Dr, Miami, FL 33131",
    whyTarget:
      "The biggest multi-category operator in Miami. 200+ cars, 50+ yachts, 100+ villas, private jets. If you land this one, it's instant credibility. 24/7 concierge team.",
    pitchAngle:
      "The group booking tech your concierge team keeps doing manually. When 4-6 people want to split a weekend package, SPLYT handles coordination and pre-collects payment.",
    crossSells: ["Yachts", "Villas", "Jets"],
    notes:
      "Full lifestyle platform. Delivers to hotels, residences, airports, or yachts. Cars $595-$3,995/day. Yachts $4,495-$8,995/4hr charter. Villas $2,095-$13,495/night.",
  },
  {
    id: "blustreet-miami",
    name: "BluStreet Miami",
    category: "exotic-cars",
    tier: 1,
    stage: "research",
    keyPerson: "TBD",
    title: "Owner",
    phone: "",
    email: "",
    instagram: "@blustreetmiami",
    website: "blustreetmiami.com",
    address: "3666 NW 48th Terrace, Miami, FL 33142",
    whyTarget:
      "Already offers yacht + supercar combo packages (morning on Biscayne Bay, afternoon in McLaren). The closest existing analog to SPLYT's multi-asset vision. Also operates in the Hamptons.",
    pitchAngle:
      "You already sell the yacht + car combo. SPLYT adds the group coordination and cost-splitting layer that makes that combo actually convert for groups of strangers.",
    crossSells: ["Yachts"],
    notes:
      "Est. 2017. Combined yacht-car insurance packages. Known for consistency and clean cars. Check sunbiz.org for owner name. Contact form on website.",
  },

  // TIER 2 — Yacht Charter Operators (core asset type)
  {
    id: "water-fantaseas",
    name: "Water Fantaseas",
    category: "yacht-charter",
    tier: 2,
    stage: "research",
    keyPerson: "Arnoldo Ramirez & Paul Manchuk",
    title: "Co-Owners",
    phone: "305-531-1480",
    email: "info@waterfantaseas.com",
    instagram: "@waterfantaseas",
    website: "waterfantaseas.com",
    address: "1521 Alton Rd Ste 802, Miami Beach, FL 33139",
    whyTarget:
      "Established since 1994. Party yacht focus = perfect for group experiences. Runs yacht management program (manages other owners' boats). Deep Miami roots. 24/7 charter consultants.",
    pitchAngle:
      "Pre-paid groups for your open charter dates. We match vetted members into groups, collect everyone's share before the date, and you get a full boat with guaranteed payment.",
    crossSells: [],
    notes:
      "One of the longest-running charter companies in Miami. Originally started in Fort Lauderdale. Strong TripAdvisor presence.",
  },
  {
    id: "miami-vice-charters",
    name: "Miami Vice Charters",
    category: "yacht-charter",
    tier: 2,
    stage: "research",
    keyPerson: "Peter Tapia",
    title: "Founder",
    phone: "",
    email: "",
    instagram: "@vicecharters",
    website: "miamivicecharters.com",
    address: "Miami, FL",
    whyTarget:
      "Founded in 2025 — brand new and hungry for distribution channels. Most likely to say yes fast. ~10K Instagram followers, actively growing.",
    pitchAngle:
      "New company, new platform. You're building your client base, we're building our partner network. Founding partner terms: reduced commission, featured placement.",
    crossSells: [],
    notes:
      "Being new is actually the advantage here — no legacy processes, no existing platform commitments, open to experimenting.",
  },
  {
    id: "miami-yachting-co",
    name: "Miami Yachting Company",
    category: "yacht-charter",
    tier: 2,
    stage: "research",
    keyPerson: "TBD",
    title: "",
    phone: "",
    email: "",
    instagram: "",
    website: "miamiyachtingcompany.com",
    address: "Miami, FL",
    whyTarget:
      "Curated fleet from private owners (not a crowded marketplace). Their positioning of quality over quantity aligns perfectly with SPLYT's members club model.",
    pitchAngle:
      "Your curated fleet meets our curated members. We're not Boatsetter — we're a members club that sends pre-qualified, pre-paid groups to premium operators like you.",
    crossSells: [],
    notes:
      "Key Biscayne, Coconut Grove, Fort Lauderdale operations. Each yacht selected for comfort, style, and guest feedback.",
  },
  {
    id: "sh-prestige",
    name: "SH Prestige Yachts",
    category: "yacht-charter",
    tier: 2,
    stage: "onboarded",
    keyPerson: "Partner Contact",
    title: "Branded Partner",
    phone: "",
    email: "",
    instagram: "",
    website: "",
    address: "Miami, FL",
    whyTarget: "Already onboarded as a branded partner with WhatsApp contact integration in the SPLYT app.",
    pitchAngle: "N/A — already partnered",
    crossSells: [],
    notes:
      "Use as proof of concept and testimonial source for all other partner conversations. 'SH Prestige Yachts is already on the platform' is your credibility line.",
  },

  // TIER 3 — Concierge / Multi-Category (distribution partners)
  {
    id: "billionaire-club",
    name: "Billionaire Club Miami",
    category: "concierge",
    tier: 3,
    stage: "research",
    keyPerson: "TBD",
    title: "",
    phone: "",
    email: "",
    instagram: "",
    website: "billionaireclubmiami.com",
    address: "Miami, FL",
    whyTarget:
      "Already runs a membership model with yacht concierge. Celebrity clientele (DiCaprio, Ben Affleck). Could white-label SPLYT's group booking tech for their members.",
    pitchAngle:
      "Your concierge team handles group coordination manually. SPLYT automates the matching, splitting, and payment collection. White-label opportunity.",
    crossSells: ["Yachts", "Villas", "Events"],
    notes:
      "Also operates in Mykonos, Athens, Monaco. High-profile but owner/founder info not publicly available. Approach through contact form.",
  },
  {
    id: "golden-miami",
    name: "Golden Miami",
    category: "concierge",
    tier: 3,
    stage: "research",
    keyPerson: "TBD",
    title: "",
    phone: "305-755-1234",
    email: "",
    instagram: "",
    website: "golden.miami",
    address: "Miami, FL",
    whyTarget:
      "Full-service luxury concierge: yacht charters, private jets, luxury villas, party buses, VIP events. Covers all of SPLYT's target asset categories.",
    pitchAngle:
      "When your clients want to bring friends or split the cost of a big experience, SPLYT handles the logistics. We're the group coordination layer for your concierge services.",
    crossSells: ["Yachts", "Jets", "Villas", "Party buses", "Events"],
    notes: "Premier South Florida concierge. Could be both a partner and a distribution channel.",
  },
  {
    id: "jatina-group",
    name: "Jatina Group",
    category: "concierge",
    tier: 3,
    stage: "research",
    keyPerson: "TBD",
    title: "",
    phone: "",
    email: "",
    instagram: "",
    website: "jatinagroup.com",
    address: "Miami, FL",
    whyTarget:
      "Villa-focused concierge that arranges private chefs, sunset yacht cruises, and luxury amenities. Good entry point for SPLYT's third asset category (villas).",
    pitchAngle:
      "Your villa guests want yacht cruises. Our yacht members want villas. Let's cross-pollinate — SPLYT brings the group demand, you provide the curated villa experiences.",
    crossSells: ["Villas", "Private chefs", "Yacht cruises"],
    notes: "Guest experience team transforms villa stays into adventures. Strong concierge-first model.",
  },
];

const EMAIL_TEMPLATES = [
  {
    id: "yacht",
    label: "Yacht Charter Operator",
    subject: "Pre-paid groups for your open charter dates",
    body: `Hi [Name],

I'm Sam, founder of SPLYT — a members club for professionals in Miami who want to do things like yacht days but don't have a full crew to book with.

We solve a simple problem: someone wants to be on a yacht Saturday but they only have 2 friends, not 8. SPLYT matches them with other vetted members, everyone pays their share through the app before the experience, and you get a full boat with guaranteed payment — no chasing deposits, no no-shows.

We're not trying to replace your existing bookings. We're filling the gaps — your midweek slots, your shoulder season, the charters that go out at 60% capacity. That's revenue you're leaving on the table right now.

SH Prestige Yachts is already partnered with us. We're bringing on a small group of founding partners in Miami this month — preferred rates, featured placement, and a say in how the platform works for providers.

Worth a 15-minute call this week?

Sam
Founder, SPLYT`,
  },
  {
    id: "car",
    label: "Exotic Car Rental",
    subject: "Our yacht members want your cars too",
    body: `Hi [Name],

I'm Sam, founder of SPLYT — a members club where professionals in Miami split luxury experiences together. Right now our members are doing yacht charters as groups, and every single one of them asks about exotic cars for the rest of the weekend.

I noticed [Company] already does [yachts/combo packages/multi-category]. You already know the customer overlap is real. What we add is the tech layer — when a group of 4 wants to split a yacht Saturday and a [Lamborghini/car] Sunday, SPLYT handles the coordination, splits the cost, and pre-collects payment from everyone. No WhatsApp threads, no chasing people for their share.

We're onboarding 5 car rental partners as founding members of the platform. That means preferred rates and featured placement while we're building. After that, standard terms apply.

Open to a quick call?

Sam
Founder, SPLYT`,
  },
  {
    id: "concierge",
    label: "Concierge / Multi-Category",
    subject: "The group booking tech your clients keep asking for",
    body: `Hi [Name],

I'm Sam, founder of SPLYT. We built an app that handles something you're probably doing manually right now — coordinating groups of people who want to split luxury experiences (yachts, exotic cars, villas) and collecting everyone's payment before the date.

Your concierge team is probably fielding group requests over WhatsApp and phone, chasing 4-6 people for payment confirmations, and dealing with last-minute dropouts. SPLYT automates all of that. Everyone pays their share through the app upfront. The experience provider gets guaranteed revenue. Your team gets time back.

We're partnering with a select group of Miami luxury operators right now. Would love to show you what we've built — 15 minutes, that's it.

Sam
Founder, SPLYT`,
  },
];

const MARKET_STATS = [
  { label: "Miami Annual Visitors", value: "28.2M", sub: "$22B in direct spending (2024)" },
  { label: "Yacht Charter Growth", value: "+20%", sub: "Year-over-year in South Florida" },
  { label: "Experiential Luxury CAGR", value: "8%", sub: "Fastest-growing luxury segment" },
  { label: "Boatsetter Commission", value: "20-35%", sub: "Your rate: 10-15%" },
  { label: "Gen Z/Millennial Luxury Share", value: "70%", sub: "Of all luxury spending by 2025" },
  { label: "Avg Yacht Day Rate (Miami)", value: "$2,200", sub: "Range: $500 to $20,000" },
];

const OBJECTIONS: Record<string, { objection: string; response: string }[]> = {
  yacht: [
    {
      objection: "I already have enough clients",
      response:
        "We're not replacing your existing clients. We're filling the gaps — Wednesday charters, shoulder season, partial boats. This is incremental revenue you're not getting today.",
    },
    {
      objection: "I don't want strangers on my boat",
      response:
        "Every member is vetted. They're the same kind of people your current clients are — ambitious professionals who want premium experiences. They're just finding you through us instead of Instagram.",
    },
    {
      objection: "Another platform taking a cut?",
      response:
        "Our commission is lower than Boatsetter's, and we pre-collect payment from all participants before the experience. Zero no-shows, zero payment headaches.",
    },
    {
      objection: "How many users do you have?",
      response:
        "We're in our launch phase in Miami with a curated initial membership. That's your advantage — early partners get featured positioning and help shape the platform. Once we scale, that positioning is gone.",
    },
  ],
  car: [
    {
      objection: "We prefer direct relationships",
      response:
        "So do we. SPLYT isn't replacing your direct bookings — it's a new channel. Think of us like a premium concierge that sends you vetted groups. You keep the relationship after.",
    },
    {
      objection: "Our margins are too thin",
      response:
        "Consider the acquisition cost you're already paying on Instagram ads. We deliver pre-qualified, payment-ready groups. And early partners get preferred rates.",
    },
    {
      objection: "We already cross-sell yachts ourselves",
      response:
        "Perfect — you understand the model. SPLYT adds the group coordination and cost-splitting that's impossible over WhatsApp when 4-6 people are trying to split a $5,000 weekend.",
    },
  ],
};

/* ──────────────────────────────────────────────────────────
   COMPONENTS
   ────────────────────────────────────────────────────────── */

function CategoryIcon({ category }: { category: Partner["category"] }) {
  const paths: Record<string, string> = {
    "exotic-cars":
      "M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z",
    "yacht-charter":
      "M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.48.26-.6.5s-.14.52-.05.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z",
    concierge:
      "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L10 14v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z",
  };
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d={paths[category]} />
    </svg>
  );
}

function CategoryBadge({ category }: { category: Partner["category"] }) {
  const config: Record<string, { label: string; color: string }> = {
    "exotic-cars": { label: "Exotic Cars", color: "bg-orange-500/20 text-orange-400" },
    "yacht-charter": { label: "Yacht Charter", color: "bg-cyan-500/20 text-cyan-400" },
    concierge: { label: "Concierge", color: "bg-violet-500/20 text-violet-400" },
  };
  const c = config[category];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium", c.color)}>
      <CategoryIcon category={category} />
      {c.label}
    </span>
  );
}

function TierBadge({ tier }: { tier: number }) {
  const config: Record<number, { label: string; color: string }> = {
    1: { label: "Tier 1 — Priority", color: "bg-amber-500/20 text-amber-400 border border-amber-500/30" },
    2: { label: "Tier 2 — Core", color: "bg-blue-500/20 text-blue-400 border border-blue-500/30" },
    3: { label: "Tier 3 — Strategic", color: "bg-slate-500/20 text-slate-400 border border-slate-500/30" },
  };
  const c = config[tier];
  return <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", c.color)}>{c.label}</span>;
}

function StageBadge({ stage }: { stage: PipelineStage }) {
  const config = PIPELINE_STAGES.find((s) => s.key === stage)!;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", config.bg, config.color, config.border, "border")}>
      <span className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
      {config.label}
    </span>
  );
}

function PartnerCard({
  partner,
  onStageChange,
}: {
  partner: Partner;
  onStageChange: (id: string, stage: PipelineStage) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyContact = () => {
    const info = [
      partner.keyPerson,
      partner.phone,
      partner.email,
      partner.instagram,
      partner.website,
    ]
      .filter(Boolean)
      .join(" | ");
    navigator.clipboard.writeText(info);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "bg-ocean-900 rounded-xl border border-ocean-700 overflow-hidden transition-all hover:border-ocean-500",
        partner.stage === "onboarded" && "border-green-500/30 bg-green-500/5",
      )}
    >
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <TierBadge tier={partner.tier} />
              <CategoryBadge category={partner.category} />
              <StageBadge stage={partner.stage} />
            </div>
            <h3 className="text-lg font-bold text-white truncate">{partner.name}</h3>
            <p className="text-sm text-ocean-300 mt-0.5">
              {partner.keyPerson}
              {partner.title && <span className="text-ocean-500"> — {partner.title}</span>}
            </p>
          </div>
          <button
            onClick={copyContact}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-ocean-800 text-ocean-300 hover:text-white hover:bg-ocean-700 transition-colors text-xs font-medium"
          >
            {copied ? "Copied!" : "Copy Contact"}
          </button>
        </div>

        {/* Contact details */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-4">
          {partner.phone && (
            <div className="flex items-center gap-2 text-xs">
              <svg className="w-3.5 h-3.5 text-ocean-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
              </svg>
              <a href={`tel:${partner.phone}`} className="text-ocean-200 hover:text-cyan-400 transition-colors">
                {partner.phone}
              </a>
            </div>
          )}
          {partner.email && (
            <div className="flex items-center gap-2 text-xs">
              <svg className="w-3.5 h-3.5 text-ocean-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
              </svg>
              <a href={`mailto:${partner.email}`} className="text-ocean-200 hover:text-cyan-400 transition-colors truncate">
                {partner.email}
              </a>
            </div>
          )}
          {partner.instagram && (
            <div className="flex items-center gap-2 text-xs">
              <svg className="w-3.5 h-3.5 text-ocean-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8 1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
              </svg>
              <span className="text-ocean-200">{partner.instagram}</span>
            </div>
          )}
          {partner.website && (
            <div className="flex items-center gap-2 text-xs">
              <svg className="w-3.5 h-3.5 text-ocean-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95c-.32-1.25-.78-2.45-1.38-3.56 1.84.63 3.37 1.91 4.33 3.56zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2 0 .68.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56-1.84-.63-3.37-1.9-4.33-3.56zm2.95-8H5.08c.96-1.66 2.49-2.93 4.33-3.56C8.81 5.55 8.35 6.75 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2 0-.68.07-1.35.16-2h4.68c.09.65.16 1.32.16 2 0 .68-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95c-.96 1.65-2.49 2.93-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2 0-.68-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z" />
              </svg>
              <a
                href={`https://${partner.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ocean-200 hover:text-cyan-400 transition-colors truncate"
              >
                {partner.website}
              </a>
            </div>
          )}
        </div>

        {partner.address && (
          <p className="text-[10px] text-ocean-500 mt-2">{partner.address}</p>
        )}

        {/* Cross-sells */}
        {partner.crossSells.length > 0 && (
          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
            <span className="text-[10px] text-ocean-500 uppercase tracking-wider font-semibold">Also offers:</span>
            {partner.crossSells.map((cs) => (
              <span key={cs} className="px-1.5 py-0.5 rounded bg-ocean-800 text-[10px] text-ocean-300">
                {cs}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Expandable section */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-2.5 border-t border-ocean-700 flex items-center justify-between text-xs text-ocean-400 hover:text-white hover:bg-ocean-800/50 transition-colors"
      >
        <span className="font-medium">Strategy & Pitch Details</span>
        <svg
          className={cn("w-4 h-4 transition-transform", expanded && "rotate-180")}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
        </svg>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-ocean-800">
          {/* Why target */}
          <div className="mt-4">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-ocean-500 mb-1.5">Why Target</h4>
            <p className="text-sm text-ocean-200 leading-relaxed">{partner.whyTarget}</p>
          </div>

          {/* Pitch angle */}
          <div>
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-ocean-500 mb-1.5">Pitch Angle</h4>
            <p className="text-sm text-cyan-300 leading-relaxed italic">&ldquo;{partner.pitchAngle}&rdquo;</p>
          </div>

          {/* Notes */}
          {partner.notes && (
            <div>
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-ocean-500 mb-1.5">Notes</h4>
              <p className="text-sm text-ocean-300 leading-relaxed">{partner.notes}</p>
            </div>
          )}

          {/* Stage selector */}
          <div>
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-ocean-500 mb-2">Move Stage</h4>
            <div className="flex gap-1.5 flex-wrap">
              {PIPELINE_STAGES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => onStageChange(partner.id, s.key)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border",
                    partner.stage === s.key
                      ? cn(s.bg, s.color, s.border)
                      : "bg-ocean-800 text-ocean-400 border-ocean-700 hover:text-white hover:border-ocean-500",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmailTemplateCard({ template }: { template: (typeof EMAIL_TEMPLATES)[number] }) {
  const [copied, setCopied] = useState<"subject" | "body" | null>(null);

  const copy = (field: "subject" | "body") => {
    navigator.clipboard.writeText(field === "subject" ? template.subject : template.body);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="bg-ocean-900 rounded-xl border border-ocean-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-ocean-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{template.label}</h3>
        <div className="flex gap-2">
          <button
            onClick={() => copy("subject")}
            className="px-2.5 py-1 rounded-lg bg-ocean-800 text-ocean-300 hover:text-white hover:bg-ocean-700 transition-colors text-[10px] font-medium"
          >
            {copied === "subject" ? "Copied!" : "Copy Subject"}
          </button>
          <button
            onClick={() => copy("body")}
            className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors text-[10px] font-medium"
          >
            {copied === "body" ? "Copied!" : "Copy Email"}
          </button>
        </div>
      </div>
      <div className="px-5 py-3 border-b border-ocean-800 bg-ocean-800/30">
        <p className="text-xs text-ocean-400">
          <span className="text-ocean-500 font-medium">Subject:</span>{" "}
          <span className="text-ocean-200">{template.subject}</span>
        </p>
      </div>
      <div className="px-5 py-4">
        <pre className="text-xs text-ocean-300 whitespace-pre-wrap leading-relaxed font-sans">
          {template.body}
        </pre>
      </div>
    </div>
  );
}

function ObjectionCard({ category }: { category: "yacht" | "car" }) {
  const items = OBJECTIONS[category] || [];
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="bg-ocean-900 rounded-xl border border-ocean-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-ocean-800 bg-red-500/5">
            <p className="text-xs font-medium text-red-400">
              <span className="text-red-500/60 mr-1.5">They say:</span>
              &ldquo;{item.objection}&rdquo;
            </p>
          </div>
          <div className="px-4 py-3 bg-green-500/5">
            <p className="text-xs text-green-300 leading-relaxed">
              <span className="text-green-500/60 mr-1.5 font-medium">You say:</span>
              &ldquo;{item.response}&rdquo;
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   PAGE
   ────────────────────────────────────────────────────────── */

type TabKey = "pipeline" | "partners" | "templates" | "objections" | "market";

export default function OutreachPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("pipeline");
  const [partners, setPartners] = useState(PARTNERS);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterTier, setFilterTier] = useState<number>(0);

  const handleStageChange = (id: string, stage: PipelineStage) => {
    setPartners((prev) => prev.map((p) => (p.id === id ? { ...p, stage } : p)));
  };

  const filteredPartners = partners.filter((p) => {
    if (filterCategory !== "all" && p.category !== filterCategory) return false;
    if (filterTier > 0 && p.tier !== filterTier) return false;
    return true;
  });

  const stageCount = (stage: PipelineStage) => partners.filter((p) => p.stage === stage).length;
  const totalPartners = partners.length;
  const onboardedCount = stageCount("onboarded");

  const TABS: { key: TabKey; label: string }[] = [
    { key: "pipeline", label: "Pipeline" },
    { key: "partners", label: "Partner Directory" },
    { key: "templates", label: "Email Templates" },
    { key: "objections", label: "Objection Handling" },
    { key: "market", label: "Market Intel" },
  ];

  return (
    <div className="max-w-[1400px]">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <h2 className="text-2xl font-bold text-white">Customer Outreach</h2>
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-ocean-800 text-ocean-300">
            Partner Acquisition
          </span>
        </div>
        <p className="text-ocean-400 text-sm">
          Miami luxury experience partners — yacht charters, exotic cars, and concierge services.
        </p>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 mb-8">
        <div className="bg-ocean-900 rounded-xl border border-ocean-700 p-4">
          <p className="text-[10px] text-ocean-500 uppercase tracking-wider font-semibold">Total Targets</p>
          <p className="text-2xl font-bold text-white mt-1">{totalPartners}</p>
        </div>
        {PIPELINE_STAGES.map((stage) => (
          <div key={stage.key} className={cn("rounded-xl border p-4", stage.bg, stage.border)}>
            <p className={cn("text-[10px] uppercase tracking-wider font-semibold", stage.color)}>{stage.label}</p>
            <p className={cn("text-2xl font-bold mt-1", stage.color)}>{stageCount(stage.key)}</p>
          </div>
        ))}
        <div className="bg-green-500/10 rounded-xl border border-green-500/20 p-4">
          <p className="text-[10px] text-green-400 uppercase tracking-wider font-semibold">Conversion</p>
          <p className="text-2xl font-bold text-green-400 mt-1">
            {totalPartners > 0 ? Math.round((onboardedCount / totalPartners) * 100) : 0}%
          </p>
        </div>
      </div>

      {/* Pipeline progress bar */}
      <div className="flex gap-0.5 h-2 rounded-full overflow-hidden mb-8 bg-ocean-800">
        {PIPELINE_STAGES.map((stage) => {
          const count = stageCount(stage.key);
          if (count === 0) return null;
          const pct = (count / Math.max(totalPartners, 1)) * 100;
          return (
            <div
              key={stage.key}
              className={cn("h-full transition-all", stage.dot)}
              style={{ width: `${pct}%` }}
              title={`${stage.label}: ${count}`}
            />
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-ocean-900 rounded-xl p-1 border border-ocean-700 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
              activeTab === tab.key ? "bg-ocean-700 text-white" : "text-ocean-400 hover:text-white hover:bg-ocean-800",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── PIPELINE TAB ── */}
      {activeTab === "pipeline" && (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          {PIPELINE_STAGES.map((stage) => {
            const stagePartners = partners.filter((p) => p.stage === stage.key);
            return (
              <div key={stage.key}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={cn("w-2 h-2 rounded-full", stage.dot)} />
                  <h3 className={cn("text-sm font-semibold", stage.color)}>{stage.label}</h3>
                  <span className="text-xs text-ocean-500 ml-auto">{stagePartners.length}</span>
                </div>
                <div className="space-y-3">
                  {stagePartners.length === 0 ? (
                    <div className={cn("rounded-xl border border-dashed p-8 text-center", stage.border)}>
                      <p className="text-ocean-500 text-xs">No partners</p>
                    </div>
                  ) : (
                    stagePartners.map((p) => (
                      <div
                        key={p.id}
                        className={cn("rounded-xl border bg-ocean-900 p-4 hover:bg-ocean-800/50 transition-colors", stage.border)}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <CategoryBadge category={p.category} />
                          <TierBadge tier={p.tier} />
                        </div>
                        <h4 className="text-sm font-semibold text-white">{p.name}</h4>
                        <p className="text-[10px] text-ocean-400 mt-0.5">{p.keyPerson}</p>
                        {p.phone && <p className="text-[10px] text-ocean-500 mt-1">{p.phone}</p>}
                        <div className="flex gap-1.5 mt-3 flex-wrap">
                          {PIPELINE_STAGES.filter((s) => s.key !== stage.key).map((s) => (
                            <button
                              key={s.key}
                              onClick={() => handleStageChange(p.id, s.key)}
                              className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                                "bg-ocean-800 text-ocean-400 hover:text-white",
                              )}
                            >
                              &rarr; {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── PARTNERS TAB ── */}
      {activeTab === "partners" && (
        <>
          {/* Filters */}
          <div className="flex gap-2 mb-6 flex-wrap">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-ocean-800 border border-ocean-700 text-ocean-200 text-xs rounded-lg px-3 py-2 focus:border-cyan-500 focus:ring-cyan-500"
            >
              <option value="all">All Categories</option>
              <option value="exotic-cars">Exotic Cars</option>
              <option value="yacht-charter">Yacht Charter</option>
              <option value="concierge">Concierge</option>
            </select>
            <select
              value={filterTier}
              onChange={(e) => setFilterTier(Number(e.target.value))}
              className="bg-ocean-800 border border-ocean-700 text-ocean-200 text-xs rounded-lg px-3 py-2 focus:border-cyan-500 focus:ring-cyan-500"
            >
              <option value={0}>All Tiers</option>
              <option value={1}>Tier 1 — Priority</option>
              <option value={2}>Tier 2 — Core</option>
              <option value={3}>Tier 3 — Strategic</option>
            </select>
            <span className="text-xs text-ocean-500 self-center ml-2">
              {filteredPartners.length} partner{filteredPartners.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Partner cards */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filteredPartners.map((p) => (
              <PartnerCard key={p.id} partner={p} onStageChange={handleStageChange} />
            ))}
          </div>
        </>
      )}

      {/* ── TEMPLATES TAB ── */}
      {activeTab === "templates" && (
        <div className="space-y-6">
          <div className="bg-ocean-900 rounded-xl border border-ocean-700 p-5">
            <h3 className="text-sm font-semibold text-white mb-2">How to Use These Templates</h3>
            <div className="text-xs text-ocean-300 space-y-1.5 leading-relaxed">
              <p>1. Choose the template matching the partner type (yacht, car, or concierge).</p>
              <p>2. Replace [Name], [Company], and bracketed fields with specifics from the Partner Directory.</p>
              <p>3. Send from your personal email — not a generic business address. Partnership pitches from founders convert 3x better.</p>
              <p>4. Follow up via Instagram DM 2-3 days after emailing if no response. Many of these operators live on Instagram.</p>
              <p>5. Always mention SH Prestige Yachts as existing social proof.</p>
            </div>
          </div>
          {EMAIL_TEMPLATES.map((t) => (
            <EmailTemplateCard key={t.id} template={t} />
          ))}
        </div>
      )}

      {/* ── OBJECTIONS TAB ── */}
      {activeTab === "objections" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.48.26-.6.5s-.14.52-.05.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z" />
              </svg>
              <h3 className="text-base font-semibold text-white">Yacht Charter Objections</h3>
            </div>
            <ObjectionCard category="yacht" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
              </svg>
              <h3 className="text-base font-semibold text-white">Exotic Car Objections</h3>
            </div>
            <ObjectionCard category="car" />
          </div>
        </div>
      )}

      {/* ── MARKET INTEL TAB ── */}
      {activeTab === "market" && (
        <div className="space-y-6">
          {/* Key stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {MARKET_STATS.map((stat) => (
              <div key={stat.label} className="bg-ocean-900 rounded-xl border border-ocean-700 p-4">
                <p className="text-[10px] text-ocean-500 uppercase tracking-wider font-semibold">{stat.label}</p>
                <p className="text-xl font-bold text-cyan-400 mt-1">{stat.value}</p>
                <p className="text-[10px] text-ocean-400 mt-1">{stat.sub}</p>
              </div>
            ))}
          </div>

          {/* Competitive positioning */}
          <div className="bg-ocean-900 rounded-xl border border-ocean-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-ocean-700">
              <h3 className="text-base font-semibold text-white">SPLYT vs. Competitors</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-ocean-800 text-ocean-300">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium text-xs">Feature</th>
                    <th className="px-5 py-3 text-center font-medium text-xs">SPLYT</th>
                    <th className="px-5 py-3 text-center font-medium text-xs">Boatsetter</th>
                    <th className="px-5 py-3 text-center font-medium text-xs">Luxx Miami</th>
                    <th className="px-5 py-3 text-center font-medium text-xs">ASMALLWORLD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ocean-800 text-xs">
                  {[
                    { feature: "Group cost-splitting", splyt: true, boatsetter: false, luxx: false, asw: false },
                    { feature: "Stranger matching", splyt: true, boatsetter: false, luxx: false, asw: false },
                    { feature: "Multi-asset (boats + cars + villas)", splyt: true, boatsetter: false, luxx: true, asw: false },
                    { feature: "Pre-collected group payment", splyt: true, boatsetter: false, luxx: false, asw: false },
                    { feature: "Social networking layer", splyt: true, boatsetter: false, luxx: false, asw: true },
                    { feature: "Members club model", splyt: true, boatsetter: false, luxx: false, asw: true },
                    { feature: "Provider commission", splyt: "10-15%", boatsetter: "20-35%", luxx: "Direct", asw: "N/A" },
                    { feature: "Built-in insurance", splyt: false, boatsetter: true, luxx: false, asw: false },
                    { feature: "Captain network", splyt: false, boatsetter: true, luxx: false, asw: false },
                    { feature: "Scale (listings)", splyt: "Launch", boatsetter: "50K+", luxx: "350+", asw: "Events" },
                  ].map((row) => (
                    <tr key={row.feature} className="hover:bg-ocean-800/50">
                      <td className="px-5 py-2.5 text-ocean-200 font-medium">{row.feature}</td>
                      {(["splyt", "boatsetter", "luxx", "asw"] as const).map((col) => {
                        const val = row[col];
                        return (
                          <td key={col} className="px-5 py-2.5 text-center">
                            {typeof val === "boolean" ? (
                              val ? (
                                <span className="text-green-400 font-bold">&#10003;</span>
                              ) : (
                                <span className="text-ocean-600">&#10005;</span>
                              )
                            ) : (
                              <span className={cn(col === "splyt" ? "text-cyan-400 font-semibold" : "text-ocean-300")}>
                                {val}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Strategic insight */}
          <div className="bg-gradient-to-br from-cyan-500/10 to-purple-500/10 rounded-xl border border-cyan-500/20 p-6">
            <h3 className="text-base font-bold text-white mb-3">The Strategic Equation</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <h4 className="text-cyan-400 font-semibold text-xs uppercase tracking-wider mb-1.5">Right Now</h4>
                <p className="text-ocean-200 leading-relaxed">
                  You need partners more than they need you. You need listed supply to attract members. Operators have existing channels (Instagram, concierge, direct).
                </p>
              </div>
              <div>
                <h4 className="text-purple-400 font-semibold text-xs uppercase tracking-wider mb-1.5">The Flip</h4>
                <p className="text-ocean-200 leading-relaxed">
                  Once SPLYT has a critical mass of engaged, affluent members, the network becomes the asset. Operators will want access to your members like restaurants want to be on Resy.
                </p>
              </div>
              <div>
                <h4 className="text-green-400 font-semibold text-xs uppercase tracking-wider mb-1.5">The Moat</h4>
                <p className="text-ocean-200 leading-relaxed">
                  The yacht operator can find another booking platform. They cannot replicate a curated network of professionals who&apos;ve bonded over shared luxury experiences. The members are the moat.
                </p>
              </div>
            </div>
          </div>

          {/* Commission benchmarks */}
          <div className="bg-ocean-900 rounded-xl border border-ocean-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-ocean-700">
              <h3 className="text-base font-semibold text-white">Commission Benchmarks</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-ocean-800 text-ocean-300">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium text-xs">Platform</th>
                    <th className="px-5 py-3 text-left font-medium text-xs">Provider Fee</th>
                    <th className="px-5 py-3 text-left font-medium text-xs">Customer Fee</th>
                    <th className="px-5 py-3 text-left font-medium text-xs">Total Take</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ocean-800 text-xs">
                  {[
                    { platform: "SPLYT (recommended)", provider: "10-15%", customer: "Membership", total: "10-15% + subs", highlight: true },
                    { platform: "Boatsetter", provider: "10-35%", customer: "6-12%", total: "20-40%" },
                    { platform: "GetMyBoat", provider: "11.5-14.5%", customer: "Service fee", total: "15-20%" },
                    { platform: "Turo", provider: "15-35%", customer: "Service fee", total: "20-35%" },
                    { platform: "Airbnb Experiences", provider: "20%", customer: "Included", total: "20%" },
                    { platform: "Airbnb Stays", provider: "3-5%", customer: "Up to 14.2%", total: "~13.6%" },
                    { platform: "mph club (affiliates)", provider: "20% referral", customer: "—", total: "20%" },
                  ].map((row) => (
                    <tr
                      key={row.platform}
                      className={cn(
                        "hover:bg-ocean-800/50",
                        "highlight" in row && row.highlight && "bg-cyan-500/5",
                      )}
                    >
                      <td className={cn("px-5 py-2.5 font-medium", "highlight" in row && row.highlight ? "text-cyan-400" : "text-ocean-200")}>
                        {row.platform}
                      </td>
                      <td className="px-5 py-2.5 text-ocean-300">{row.provider}</td>
                      <td className="px-5 py-2.5 text-ocean-300">{row.customer}</td>
                      <td className="px-5 py-2.5 text-ocean-300">{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Onboarding sequence */}
          <div className="bg-ocean-900 rounded-xl border border-ocean-700 p-6">
            <h3 className="text-base font-semibold text-white mb-4">Recommended Onboarding Sequence</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  phase: "Phase 1",
                  timeline: "This Week",
                  color: "text-cyan-400",
                  border: "border-cyan-500/20",
                  items: [
                    "Email Matt Cruz at MVP Miami",
                    "Email Clint Halim at Luxx Miami",
                    "Email Water Fantaseas (Arnoldo/Paul)",
                    "Email Peter Tapia at Miami Vice Charters",
                  ],
                },
                {
                  phase: "Phase 2",
                  timeline: "Next Week",
                  color: "text-purple-400",
                  border: "border-purple-500/20",
                  items: [
                    "Approach mph club through broker affiliate program",
                    "DM BluStreet Miami on Instagram",
                    "Contact one concierge company",
                    "Follow up on Phase 1 non-responses via Instagram DM",
                  ],
                },
                {
                  phase: "Phase 3",
                  timeline: "Weeks 3-4",
                  color: "text-green-400",
                  border: "border-green-500/20",
                  items: [
                    "Create combo experience packages with early partners",
                    "Use early partner data as social proof for next wave",
                    "Introduce partner referral program",
                    "Begin approaching villa/home rental operators",
                  ],
                },
              ].map((phase) => (
                <div key={phase.phase} className={cn("rounded-xl border p-4", phase.border)}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className={cn("text-sm font-semibold", phase.color)}>{phase.phase}</h4>
                    <span className="text-[10px] text-ocean-500 font-medium">{phase.timeline}</span>
                  </div>
                  <ul className="space-y-2">
                    {phase.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-ocean-300">
                        <span className={cn("mt-0.5 w-1.5 h-1.5 rounded-full shrink-0", phase.color.replace("text-", "bg-"))} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
