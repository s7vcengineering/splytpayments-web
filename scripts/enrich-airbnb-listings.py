#!/usr/bin/env python3
"""
Enrich Airbnb Stays & Experiences with detail page data.

Visits each listing's Airbnb page and extracts:
  - All photos (not just the 6 from search)
  - Host name, superhost status, profile picture
  - Full description
  - All amenities
  - Room/property details

Usage:
  python3 scripts/enrich-airbnb-listings.py --table airbnb_stays
  python3 scripts/enrich-airbnb-listings.py --table airbnb_experiences
  python3 scripts/enrich-airbnb-listings.py --table airbnb_stays --limit 50
  python3 scripts/enrich-airbnb-listings.py --table airbnb_stays --dry-run
"""

import argparse
import json
import logging
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import urllib.error
import datetime

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

LOG_FORMAT = "%(asctime)s [%(levelname)s] %(message)s"
LOG_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

log = logging.getLogger("airbnb-enricher")
log.setLevel(logging.DEBUG)

_console = logging.StreamHandler(sys.stderr)
_console.setLevel(logging.INFO)
_console.setFormatter(logging.Formatter(LOG_FORMAT, datefmt=LOG_DATE_FORMAT))
log.addHandler(_console)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "identity",
}

REQUEST_DELAY = 2.0  # seconds between requests


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------

def fetch_page(url):
    """Fetch a URL and return the response body as text."""
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        log.warning("HTTP %d fetching %s", e.code, url)
        return None
    except Exception as e:
        log.warning("Error fetching %s: %s", url, e)
        return None


# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------

def supabase_get_listings(supabase_url, supabase_key, table, limit):
    """Get listings that need enrichment."""
    url = (
        f"{supabase_url}/rest/v1/{table}"
        f"?select=id,source_listing_id,source_url,host_name,photo_urls"
        f"&is_active=eq.true"
        f"&order=last_scraped_at.asc.nullsfirst"
        f"&limit={limit}"
    )
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        log.error("Failed to fetch listings: %s", e)
        return []


def supabase_update(supabase_url, supabase_key, table, record_id, data):
    """Update a record in the table."""
    url = f"{supabase_url}/rest/v1/{table}?id=eq.{record_id}"
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    body = json.dumps(data, default=str).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=headers, method="PATCH")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8", errors="replace")
        log.error("Update error %d: %s", e.code, error_body)
        return e.code
    except Exception as e:
        log.error("Update exception: %s", e)
        return 0


# ---------------------------------------------------------------------------
# Detail page parser
# ---------------------------------------------------------------------------

def extract_deferred_state(html_content):
    """Extract JSON from the data-deferred-state-0 script tag."""
    pattern = r'<script[^>]*id="data-deferred-state-0"[^>]*>(.*?)</script>'
    match = re.search(pattern, html_content, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError:
        return None


def parse_stay_detail(deferred_state):
    """Parse a stays detail page for enrichment data."""
    if not deferred_state:
        return None

    niobe = deferred_state.get("niobeClientData", [])
    if not niobe or not isinstance(niobe[0], list) or len(niobe[0]) < 2:
        return None

    entry = niobe[0][1]
    data_obj = entry.get("data", {})
    pres = data_obj.get("presentation", {})

    # Stays use stayProductDetailPage
    page = pres.get("stayProductDetailPage", {})
    if not page:
        return None

    sections_container = page.get("sections", {})
    s_list = sections_container.get("sections", [])

    sections = {}
    for s in s_list:
        sid = s.get("sectionId", "")
        if sid:
            sections[sid] = s.get("section", {}) or {}

    result = {}

    # --- Photos (all of them) ---
    photo_section = sections.get("PHOTO_TOUR_SCROLLABLE_MODAL", {})
    media_items = photo_section.get("mediaItems", [])
    if media_items:
        photo_urls = []
        for item in media_items:
            url = item.get("baseUrl", "")
            if url and url not in photo_urls:
                photo_urls.append(url)
        if photo_urls:
            result["photo_urls"] = photo_urls

    # --- Host info ---
    meet_host = sections.get("MEET_YOUR_HOST", {})
    card_data = meet_host.get("cardData", {}) or {}
    host_name = card_data.get("name", "")
    if host_name:
        result["host_name"] = host_name
    is_superhost = card_data.get("isSuperhost")
    if is_superhost is not None:
        result["is_superhost"] = bool(is_superhost)

    # --- Description ---
    desc_section = sections.get("DESCRIPTION_DEFAULT", {})
    html_desc = desc_section.get("htmlDescription", {}) or {}
    desc_text = html_desc.get("htmlText", "")
    if desc_text:
        # Strip HTML tags for clean text
        clean = re.sub(r'<br\s*/?>', '\n', desc_text)
        clean = re.sub(r'<[^>]+>', '', clean)
        clean = clean.strip()
        if clean:
            result["description"] = clean

    # --- Amenities ---
    amen_section = sections.get("AMENITIES_DEFAULT", {})
    groups = amen_section.get("groups", []) or amen_section.get("seeAllAmenitiesGroups", []) or []
    all_amenities = []
    for group in groups:
        for amen in group.get("amenities", []):
            title = amen.get("title", "")
            if title and title not in all_amenities:
                # Skip unavailable amenities
                if not amen.get("available", True) == False:
                    all_amenities.append(title)
    if all_amenities:
        result["amenities"] = all_amenities

    # --- Room details from OVERVIEW ---
    overview = sections.get("OVERVIEW_DEFAULT_V2", {})
    detail_items = overview.get("detailItems", [])
    for item in detail_items:
        title = (item.get("title") or "").lower()
        if "guest" in title:
            m = re.search(r'(\d+)', title)
            if m:
                result["max_guests"] = int(m.group(1))
        elif "bedroom" in title:
            m = re.search(r'(\d+)', title)
            if m:
                result["bedrooms"] = int(m.group(1))
        elif "bed" in title and "bedroom" not in title:
            m = re.search(r'(\d+)', title)
            if m:
                result["beds"] = int(m.group(1))
        elif "bath" in title:
            m = re.search(r'([\d.]+)', title)
            if m:
                result["bathrooms"] = float(m.group(1))

    # --- Location from LOCATION_DEFAULT ---
    loc_section = sections.get("LOCATION_DEFAULT", {})
    subtitle = loc_section.get("subtitle", "")
    if subtitle:
        result["neighborhood"] = subtitle

    result["last_scraped_at"] = datetime.datetime.now(datetime.UTC).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    result["scrape_status"] = "enriched"

    return result


def parse_experience_from_html(html_content):
    """Parse an experience detail page directly from HTML.

    Experience pages don't use data-deferred-state; data is server-rendered.
    We extract photos, host name, and description from the HTML itself.
    """
    if not html_content:
        return None

    result = {}

    # --- Photos: extract all muscache image URLs, filter out platform assets ---
    SKIP_ASSET = "airbnb-platform-assets"
    all_urls = re.findall(
        r'https://a0\.muscache\.com/im/pictures/[^\s"\'?]+',
        html_content,
    )
    # Dedupe preserving order, skip platform assets (favicons, icons, etc.)
    seen = set()
    photo_urls = []
    for url in all_urls:
        if url not in seen and SKIP_ASSET not in url:
            seen.add(url)
            photo_urls.append(url)
    if photo_urls:
        result["photo_urls"] = photo_urls

    # --- Host name from "Hosted by X" ---
    host_match = re.search(
        r'Hosted by\s+([^"<]+?)(?:\.|")', html_content
    )
    if host_match:
        name = host_match.group(1).strip()
        # Clean up trailing punctuation
        name = name.rstrip(".,;:")
        if name:
            result["host_name"] = name

    # --- Description from og:description meta tag ---
    og_match = re.search(
        r'<meta[^>]*property="og:description"[^>]*content="([^"]+)"',
        html_content,
    )
    if og_match:
        desc = og_match.group(1).strip()
        if desc:
            result["description"] = desc

    result["last_scraped_at"] = datetime.datetime.now(datetime.UTC).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )

    return result if result else None


def _find_key_recursive(obj, target_key, max_depth=10):
    """Recursively search for a key in nested structures."""
    if max_depth <= 0:
        return None
    if isinstance(obj, dict):
        if target_key in obj:
            val = obj[target_key]
            if val:
                return val
        for v in obj.values():
            result = _find_key_recursive(v, target_key, max_depth - 1)
            if result:
                return result
    elif isinstance(obj, list):
        for item in obj:
            result = _find_key_recursive(item, target_key, max_depth - 1)
            if result:
                return result
    return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Enrich Airbnb listings with detail page data")
    parser.add_argument("--table", required=True, choices=["airbnb_stays", "airbnb_experiences"])
    parser.add_argument("--limit", type=int, default=9999, help="Max listings to process")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--delay", type=float, default=REQUEST_DELAY)
    args = parser.parse_args()

    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")

    if not args.dry_run and (not supabase_url or not supabase_key):
        log.error("SUPABASE_URL and SUPABASE_SERVICE_KEY required (or use --dry-run)")
        sys.exit(1)

    start_time = time.time()

    # Get listings
    log.info("Fetching %s listings (limit %d)...", args.table, args.limit)
    listings = supabase_get_listings(supabase_url, supabase_key, args.table, args.limit)
    log.info("Found %d listings to enrich", len(listings))

    stats = {"processed": 0, "enriched": 0, "skipped": 0, "errors": 0}
    is_stays = args.table == "airbnb_stays"

    for i, listing in enumerate(listings):
        record_id = listing["id"]
        listing_id = listing["source_listing_id"]
        source_url = listing.get("source_url") or f"https://www.airbnb.com/rooms/{listing_id}"
        current_photos = listing.get("photo_urls", []) or []

        log.info(
            "[%d/%d] %s (current: %d photos, host: %s)",
            i + 1, len(listings), listing_id,
            len(current_photos),
            listing.get("host_name") or "none",
        )

        # Fetch listing page
        html = fetch_page(source_url)
        if not html:
            log.warning("  Failed to fetch, skipping")
            stats["errors"] += 1
            time.sleep(args.delay)
            continue

        # Parse
        if is_stays:
            deferred = extract_deferred_state(html)
            if not deferred:
                log.warning("  No deferred state, skipping")
                stats["skipped"] += 1
                time.sleep(args.delay)
                continue
            enriched = parse_stay_detail(deferred)
        else:
            # Experience pages are server-rendered HTML, no deferred state
            enriched = parse_experience_from_html(html)

        if not enriched:
            log.warning("  Could not parse detail page")
            stats["skipped"] += 1
            time.sleep(args.delay)
            continue

        new_photos = len(enriched.get("photo_urls", []))
        host = enriched.get("host_name", "")
        amenity_count = len(enriched.get("amenities", []))
        desc_len = len(enriched.get("description", ""))

        log.info(
            "  -> %d photos, host=%s, %d amenities, desc=%d chars",
            new_photos, host or "none", amenity_count, desc_len,
        )

        if not args.dry_run:
            status = supabase_update(supabase_url, supabase_key, args.table, record_id, enriched)
            if status in (200, 204):
                stats["enriched"] += 1
            else:
                log.error("  Update failed: HTTP %d", status)
                stats["errors"] += 1
        else:
            stats["enriched"] += 1

        stats["processed"] += 1
        time.sleep(args.delay)

    elapsed = round(time.time() - start_time)
    log.info("=" * 60)
    log.info("ENRICHMENT COMPLETE")
    log.info("  Table: %s", args.table)
    log.info("  Processed: %d", stats["processed"])
    log.info("  Enriched: %d", stats["enriched"])
    log.info("  Skipped: %d", stats["skipped"])
    log.info("  Errors: %d", stats["errors"])
    log.info("  Duration: %ds", elapsed)
    log.info("=" * 60)


if __name__ == "__main__":
    main()
