#!/usr/bin/env python3
"""
Scrape Falcon Car Rental (falconcarrental.com) exotic car listings.

How it works:
  1. Fetches the sitemap at /sitemap.xml to discover all vehicle detail URLs
  2. Filters for individual vehicle pages (URLs ending with /slug/numeric-id)
  3. Fetches each vehicle detail page
  4. Extracts vehicle data from the embedded __NEXT_DATA__ JSON (Next.js SSR)
  5. Upserts into Supabase table: exotic_cars

URL pattern for vehicle detail pages:
  /ca/los-angeles/{brand}/{category}/{slug}/{id}
  /fl/miami/{brand}/{category}/{slug}/{id}

Usage:
  export SUPABASE_URL="https://your-project.supabase.co"
  export SUPABASE_SERVICE_KEY="your-service-role-key"

  # Scrape all vehicles (LA only by default)
  python3 scripts/scrape-falconrental.py

  # Scrape all locations (LA + Miami)
  python3 scripts/scrape-falconrental.py --location all

  # Scrape only LA
  python3 scripts/scrape-falconrental.py --location la

  # Scrape only Miami
  python3 scripts/scrape-falconrental.py --location miami

  # Dry run (scrape but don't write to database)
  python3 scripts/scrape-falconrental.py --dry-run

  # Limit to first N vehicles
  python3 scripts/scrape-falconrental.py --limit 5
"""

import argparse
import datetime
import json
import logging
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import urllib.error
import html.parser

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

LOG_FORMAT = "%(asctime)s [%(levelname)s] %(message)s"
LOG_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

log = logging.getLogger("falcon-scraper")
log.setLevel(logging.DEBUG)

_console = logging.StreamHandler(sys.stderr)
_console.setLevel(logging.INFO)
_console.setFormatter(logging.Formatter(LOG_FORMAT, datefmt=LOG_DATE_FORMAT))
log.addHandler(_console)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_URL = "https://www.falconcarrental.com"
SITEMAP_URL = f"{BASE_URL}/sitemap.xml"
SOURCE_PROVIDER = "falconrental"
PHONE = "+1-310-887-7005"
ADDRESS = "499 N Canon Drive, Beverly Hills, CA 90210"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# Rate limiting
REQUEST_DELAY = 1.5  # seconds between requests

# Vehicle URL patterns (individual vehicle pages end with /slug/numeric-id)
# LA:    /ca/los-angeles/{brand}/{category}/{slug}/{id}
# Miami: /fl/miami/{brand}/{category}/{slug}/{id}
VEHICLE_URL_RE = re.compile(
    r"^https://www\.falconcarrental\.com/"
    r"(?:ca/los-angeles|fl/miami)/"
    r"[a-z-]+/"          # brand slug
    r"[a-z0-9-]+/"       # category slug
    r"[a-z0-9-]+/"       # vehicle slug
    r"(\d+)$"            # numeric vehicle id
)

# Location info mapping
LOCATION_MAP = {
    "ca/los-angeles": {"city": "Los Angeles", "region": "CA"},
    "fl/miami": {"city": "Miami", "region": "FL"},
}

# Brand name normalizations (slug -> display name)
BRAND_NAMES = {
    "rolls-royce": "Rolls-Royce",
    "bentley": "Bentley",
    "aston-martin": "Aston Martin",
    "lamborghini": "Lamborghini",
    "ferrari": "Ferrari",
    "mclaren": "McLaren",
    "porsche": "Porsche",
    "mercedes": "Mercedes-Benz",
    "bmw": "BMW",
    "range-rover": "Range Rover",
    "cadillac": "Cadillac",
    "corvette": "Chevrolet",
    "tesla": "Tesla",
    "audi": "Audi",
    "rivian": "Rivian",
    "hummer": "GMC",
}

# Category slug -> body style
CATEGORY_BODY_STYLES = {
    "supercar": "Coupe",
    "convertible": "Convertible",
    "suv": "SUV",
    "chauffeur": "Sedan",
    "ev": "Electric",
    "coupe-sports": "Coupe",
    "sedan-4-door": "Sedan",
    "ultra-luxury": "Luxury",
}


# ---------------------------------------------------------------------------
# HTML Parser helpers
# ---------------------------------------------------------------------------

class TagTextExtractor(html.parser.HTMLParser):
    """Extract text content from HTML."""
    def __init__(self):
        super().__init__()
        self._text = []
        self._skip = False

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self._skip = True

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self._skip = False

    def handle_data(self, data):
        if not self._skip:
            self._text.append(data)

    def get_text(self):
        return ' '.join(self._text)


def extract_text(html_str):
    """Strip HTML tags and return plain text."""
    parser = TagTextExtractor()
    parser.feed(html_str)
    return parser.get_text().strip()


def fetch_page(url):
    """Fetch a URL and return the content."""
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
# Sitemap discovery
# ---------------------------------------------------------------------------

def discover_vehicle_urls(location_filter="la"):
    """
    Fetch sitemap.xml and extract individual vehicle detail page URLs.

    Args:
        location_filter: "la", "miami", or "all"

    Returns:
        List of vehicle detail page URLs.
    """
    log.info("Fetching sitemap: %s", SITEMAP_URL)
    content = fetch_page(SITEMAP_URL)

    if not content:
        log.error("Failed to fetch sitemap")
        return []

    # Extract all <loc> URLs
    all_urls = re.findall(r"<loc>(.*?)</loc>", content)
    log.info("Sitemap contains %d total URLs", len(all_urls))

    # Filter for vehicle detail pages
    vehicle_urls = []
    for url in all_urls:
        if VEHICLE_URL_RE.match(url):
            # Apply location filter
            if location_filter == "la" and "/ca/los-angeles/" not in url:
                continue
            if location_filter == "miami" and "/fl/miami/" not in url:
                continue
            vehicle_urls.append(url)

    log.info(
        "Discovered %d vehicle URLs (filter=%s)",
        len(vehicle_urls), location_filter
    )
    return vehicle_urls


# ---------------------------------------------------------------------------
# __NEXT_DATA__ extraction
# ---------------------------------------------------------------------------

def extract_next_data(html_content):
    """
    Extract the __NEXT_DATA__ JSON from a Next.js page.

    Returns the parsed JSON dict, or None on failure.
    """
    match = re.search(
        r'<script\s+id="__NEXT_DATA__"\s+type="application/json">(.*?)</script>',
        html_content, re.DOTALL
    )
    if not match:
        return None

    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError as e:
        log.warning("Failed to parse __NEXT_DATA__ JSON: %s", e)
        return None


# ---------------------------------------------------------------------------
# Vehicle detail parser
# ---------------------------------------------------------------------------

def parse_year_from_name(name):
    """
    Try to extract a year from the vehicle name.
    Examples: "296 GTB 2024" -> 2024, "Cullinan Series II Black Badge" -> None
    """
    # Look for 4-digit year (2018-2030 range)
    match = re.search(r'\b(20[12]\d)\b', name)
    if match:
        return int(match.group(1))
    return None


def parse_model_from_name(name, brand_title):
    """
    Derive the model name from the vehicle name and brand.
    The 'name' field from Falcon is usually just the model + variant, not including brand.
    Strip year suffix if present.
    """
    model = name.strip()

    # Remove trailing year if present (e.g., "296 GTB 2024" -> "296 GTB")
    model = re.sub(r'\s+20[12]\d$', '', model)

    # Remove trailing numeric suffixes from slug dedup (e.g., "Cullinan 1" -> "Cullinan")
    model = re.sub(r'\s+\d+$', '', model)

    return model.strip() if model.strip() else None


def parse_horsepower(engine_str):
    """
    Extract horsepower from engine string like "563 hp" or "819 hp".
    """
    if not engine_str:
        return None
    match = re.search(r'(\d+)\s*hp', engine_str, re.IGNORECASE)
    if match:
        return int(match.group(1))
    return None


def parse_zero_to_sixty(six_str):
    """
    Parse 0-60 time from string like "5.0 sec" or "2.4 sec".
    """
    if not six_str:
        return None
    match = re.search(r'([\d.]+)\s*sec', six_str, re.IGNORECASE)
    if match:
        return float(match.group(1))
    return None


def parse_vehicle_detail(url, html_content):
    """
    Parse a Falcon Car Rental vehicle detail page.

    The page is a Next.js SSR page with vehicle data embedded in __NEXT_DATA__.
    Path: props.pageProps.vehicalDetailData.vehicle
    """
    next_data = extract_next_data(html_content)
    if not next_data:
        log.warning("No __NEXT_DATA__ found for %s", url)
        return None

    # Navigate to vehicle data (note: "vehical" is their typo, not ours)
    try:
        vehicle = next_data["props"]["pageProps"]["vehicalDetailData"]["vehicle"]
    except (KeyError, TypeError):
        log.warning("No vehicalDetailData.vehicle in __NEXT_DATA__ for %s", url)
        return None

    # Determine location from URL
    location_key = None
    for key in LOCATION_MAP:
        if f"/{key}/" in url:
            location_key = key
            break

    location_info = LOCATION_MAP.get(location_key, {"city": "Los Angeles", "region": "CA"})

    # Extract brand info
    brand_detail = vehicle.get("brand_detail") or {}
    brand_slug = brand_detail.get("slug", "")
    brand_title = brand_detail.get("title", "")

    # Extract category info
    category_detail = vehicle.get("category_detail") or {}
    category_slug = category_detail.get("slug", "")
    category_title = category_detail.get("title", "")

    # Core vehicle fields
    name = vehicle.get("name", "")
    name_with_brand = vehicle.get("name_with_brand", "")
    slug_id = vehicle.get("slug_id")

    # Parse year from name (e.g., "296 GTB 2024")
    year = parse_year_from_name(name)

    # Parse make from brand
    make = BRAND_NAMES.get(brand_slug, brand_title)

    # Parse model from name
    model = parse_model_from_name(name, brand_title)

    # Build title: "Year Make Model" or "Make Model"
    if year:
        title = f"{year} {make} {model}" if model else f"{year} {make} {name}"
    else:
        title = name_with_brand or f"{make} {name}"

    # Parse specs
    horsepower = parse_horsepower(vehicle.get("engine"))
    zero_to_sixty = parse_zero_to_sixty(vehicle.get("six"))

    # Extract daily rate (discounted price, or real price as fallback)
    daily_rate = vehicle.get("day") or vehicle.get("real_price")
    if daily_rate and isinstance(daily_rate, (int, float)):
        daily_rate = int(daily_rate)
    else:
        daily_rate = None

    # Body style from category
    body_style = CATEGORY_BODY_STYLES.get(category_slug, category_title)

    # Extract description from 'description' field, then fall back to 'features'
    description = None
    desc_html = vehicle.get("description") or vehicle.get("features")
    if desc_html and isinstance(desc_html, str) and len(desc_html) > 10:
        description = extract_text(desc_html)[:2000]

    # Extract photo URLs from all_images array
    photo_urls = []
    all_images = vehicle.get("all_images") or []
    for img_entry in all_images:
        image_obj = img_entry.get("image")
        if not image_obj:
            continue
        # Prefer 'main' size, fall back to 'small'
        img_url = image_obj.get("main") or image_obj.get("small") or image_obj.get("thumb")
        if img_url and img_url not in photo_urls:
            photo_urls.append(img_url)

    # Build the data record
    data = {
        "source_provider": SOURCE_PROVIDER,
        "source_listing_id": str(slug_id),
        "source_url": url,
        "title": title,
        "make": make,
        "body_style": body_style,
        "daily_rate": daily_rate,
        "photo_urls": photo_urls[:50],
        "city": location_info["city"],
        "region": location_info["region"],
        "contact_phone": PHONE,
        "contact_address": ADDRESS,
        "is_active": bool(vehicle.get("availability", 1)),
        "scrape_status": "scraped",
        "last_scraped_at": datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }

    # Optional fields - only set if we have data
    if year:
        data["year"] = year
    if model:
        data["model"] = model
    if horsepower:
        data["horsepower"] = horsepower
    if zero_to_sixty:
        data["zero_to_sixty"] = zero_to_sixty
    if description:
        data["description"] = description

    # Engine field: store the raw engine string (e.g., "563 hp")
    engine_str = vehicle.get("engine")
    if engine_str:
        data["engine"] = engine_str

    return data


# ---------------------------------------------------------------------------
# Supabase upsert
# ---------------------------------------------------------------------------

def supabase_upsert(supabase_url, supabase_key, table, data, conflict_key="source_provider,source_listing_id"):
    url = f"{supabase_url}/rest/v1/{table}?on_conflict={conflict_key}"
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    data.pop("id", None)
    body = json.dumps(data, default=str).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8", errors="replace")
        log.error("Supabase upsert error %d for %s: %s", e.code, table, error_body)
        return e.code
    except Exception as e:
        log.error("Supabase upsert exception for %s: %s", table, e)
        return 0


# ---------------------------------------------------------------------------
# Slack notification (optional)
# ---------------------------------------------------------------------------

def send_slack_notification(summary):
    """Send a summary to Slack if SLACK_WEBHOOK_URL is set."""
    webhook = os.environ.get("SLACK_WEBHOOK_URL")
    if not webhook:
        return

    emoji = "\u2705" if summary.get("errors", 0) == 0 else "\u26a0\ufe0f"
    text = (
        f"{emoji} *Falcon Car Rental Scrape Complete*\n"
        f"*Vehicles scraped:* {summary.get('vehicles_scraped', 0)}\n"
        f"*Upserted:* {summary.get('upserted', 0)}\n"
        f"*Errors:* {summary.get('errors', 0)}\n"
        f"*Location:* {summary.get('location', 'all')}\n"
        f"*Duration:* {summary.get('duration', '?')}s"
    )

    body = json.dumps({"text": text}).encode("utf-8")
    req = urllib.request.Request(
        webhook, data=body,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        urllib.request.urlopen(req, timeout=10)
    except Exception as e:
        log.warning("Slack notification failed: %s", e)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Scrape Falcon Car Rental listings")
    parser.add_argument(
        "--location", choices=["la", "miami", "all"], default="la",
        help="Which location(s) to scrape (default: la)"
    )
    parser.add_argument("--dry-run", action="store_true", help="Scrape but don't write to database")
    parser.add_argument("--limit", type=int, default=0, help="Max vehicles to scrape (0=all)")
    args = parser.parse_args()

    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")

    if not args.dry_run and (not supabase_url or not supabase_key):
        log.error("SUPABASE_URL and SUPABASE_SERVICE_KEY required (or use --dry-run)")
        sys.exit(1)

    start_time = time.time()
    summary = {
        "vehicles_scraped": 0,
        "upserted": 0,
        "errors": 0,
        "location": args.location,
    }

    # Discover vehicle URLs from sitemap
    vehicle_urls = discover_vehicle_urls(location_filter=args.location)

    if not vehicle_urls:
        log.error("No vehicle URLs discovered — aborting")
        sys.exit(1)

    if args.limit > 0:
        vehicle_urls = vehicle_urls[:args.limit]

    log.info("Scraping %d vehicle listings...", len(vehicle_urls))

    for i, url in enumerate(vehicle_urls):
        log.info("[%d/%d] %s", i + 1, len(vehicle_urls), url)

        html_content = fetch_page(url)
        if not html_content:
            summary["errors"] += 1
            continue

        try:
            data = parse_vehicle_detail(url, html_content)
        except Exception as e:
            log.error("Parse error for %s: %s", url, e)
            summary["errors"] += 1
            continue

        if not data:
            log.warning("  No data extracted from %s", url)
            summary["errors"] += 1
            continue

        summary["vehicles_scraped"] += 1

        log.info(
            "  Parsed: %s | $%s/day | %d images",
            data.get("title", "?"),
            data.get("daily_rate", "?"),
            len(data.get("photo_urls", [])),
        )

        if not args.dry_run:
            status = supabase_upsert(supabase_url, supabase_key, "exotic_cars", data)
            if status in (200, 201):
                log.info("  Upserted to exotic_cars")
                summary["upserted"] += 1
            else:
                log.error("  Upsert failed: HTTP %d", status)
                summary["errors"] += 1
        else:
            log.info("  [DRY RUN] Would upsert to exotic_cars:")
            for k in ("title", "make", "model", "year", "daily_rate", "body_style",
                       "horsepower", "zero_to_sixty", "city", "photo_urls"):
                if k in data:
                    val = data[k]
                    if k == "photo_urls":
                        val = f"{len(val)} images"
                    log.info("    %s: %s", k, val)

        # Rate limit between requests
        if i < len(vehicle_urls) - 1:
            time.sleep(REQUEST_DELAY)

    elapsed = round(time.time() - start_time)
    summary["duration"] = elapsed

    log.info("=" * 60)
    log.info("SCRAPE COMPLETE")
    log.info("  Vehicles scraped: %d", summary["vehicles_scraped"])
    log.info("  Upserted: %d", summary["upserted"])
    log.info("  Errors: %d", summary["errors"])
    log.info("  Location: %s", summary["location"])
    log.info("  Duration: %ds", elapsed)
    log.info("=" * 60)

    send_slack_notification(summary)


if __name__ == "__main__":
    main()
