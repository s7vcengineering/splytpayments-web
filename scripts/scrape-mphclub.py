#!/usr/bin/env python3
"""
Scrape mph club (mphclub.com) exotic car rental listings.

How it works:
  1. Fetches the main fleet page at /exotic-car-rental/ to discover all car URLs
  2. Fetches each individual car detail page
  3. Parses structured data from the HTML (title, price, specs, images, description)
  4. Upserts into Supabase table: exotic_cars

Usage:
  export SUPABASE_URL="https://your-project.supabase.co"
  export SUPABASE_SERVICE_KEY="your-service-role-key"

  # Scrape all cars
  python3 scripts/scrape-mphclub.py

  # Dry run (scrape but don't write to database)
  python3 scripts/scrape-mphclub.py --dry-run

  # Limit number of cars
  python3 scripts/scrape-mphclub.py --limit 5

  # Scrape specific URLs
  python3 scripts/scrape-mphclub.py --urls https://mphclub.com/lamborghini-revuelto-rental/
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

log = logging.getLogger("mphclub-scraper")
log.setLevel(logging.DEBUG)

_console = logging.StreamHandler(sys.stderr)
_console.setLevel(logging.INFO)
_console.setFormatter(logging.Formatter(LOG_FORMAT, datefmt=LOG_DATE_FORMAT))
log.addHandler(_console)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_URL = "https://mphclub.com"
FLEET_URL = f"{BASE_URL}/exotic-car-rental/"
SOURCE_PROVIDER = "mphclub"
PHONE = "888-674-4044"
ADDRESS = "2001 NW 167th Street, Miami Gardens, FL 33056"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# Rate limiting
REQUEST_DELAY = 1.5  # seconds between requests

# Known makes for parsing titles
KNOWN_MAKES = [
    "Lamborghini", "Ferrari", "McLaren", "Rolls Royce", "Rolls-Royce",
    "Bentley", "BMW", "Mercedes-Benz", "Mercedes Benz", "Mercedes",
    "Chevrolet", "Porsche", "Aston Martin", "Range Rover", "Land Rover",
    "Cadillac", "Bugatti", "Audi", "Maserati", "Tesla", "Jaguar",
]

# Hourly-rate listings to skip (not daily rentals)
HOURLY_KEYWORDS = ["/hour", "per hour", "sprinter-limo", "sprinter"]


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


def fetch_page(url):
    """Fetch a URL and return the HTML content."""
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


def extract_text(html_str):
    """Strip HTML tags and return plain text."""
    parser = TagTextExtractor()
    parser.feed(html_str)
    return parser.get_text().strip()


# ---------------------------------------------------------------------------
# Fleet discovery
# ---------------------------------------------------------------------------

def discover_listings_from_fleet():
    """Fetch the fleet page and extract all individual car listing URLs.

    Strategy: the fleet page uses Elementor. Each car card is an
    elementor-widget-image containing an <a href> wrapping an <img>.
    We extract those hrefs as car detail page URLs.
    """
    log.info("Fetching fleet page: %s", FLEET_URL)
    content = fetch_page(FLEET_URL)
    if not content:
        log.error("Failed to fetch fleet page")
        return []

    # Find all hrefs inside elementor-widget-image containers.
    # Pattern: 'elementor-widget-image' ... href="https://mphclub.com/SLUG/"
    # Each image widget has a short HTML span, so a non-greedy .*? works.
    widget_pattern = re.compile(
        r'elementor-widget-image[^"]*"[^>]*>.*?'
        r'href="(https://mphclub\.com/([a-z0-9][-a-z0-9]+)/)"',
        re.DOTALL,
    )

    # Non-car slugs that occasionally appear in image widgets
    skip_slugs = {
        "exotic-car-rental", "about", "contacts", "shop", "careers",
        "privacy-policy", "site-map", "car-rally", "vehicles-for-sale",
        "exotic-car-rental-membership", "yacht-charter-miami",
        "luxury-chauffeur-services-miami", "franchise-opportunities",
        "production-props", "reservations",
    }

    seen = set()
    car_urls = []

    for m in widget_pattern.finditer(content):
        full_url = m.group(1)
        slug = m.group(2)

        if slug in skip_slugs:
            continue
        if full_url in seen:
            continue

        seen.add(full_url)
        car_urls.append(full_url)

    log.info("Discovered %d car listing URLs from fleet page", len(car_urls))
    return car_urls


# ---------------------------------------------------------------------------
# Car detail parser
# ---------------------------------------------------------------------------

def parse_car_listing(url, html_content):
    """Parse an individual car detail page and return structured data."""
    data = {
        "source_provider": SOURCE_PROVIDER,
        "source_url": url,
        "source_listing_id": url.rstrip("/").split("/")[-1],
        "city": "Fort Lauderdale",
        "region": "FL",
        "contact_phone": PHONE,
        "contact_address": ADDRESS,
        "is_active": True,
        "scrape_status": "scraped",
        "last_scraped_at": datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }

    slug = url.rstrip("/").split("/")[-1]

    # --- Extract title from H1 ---
    title_match = re.search(r"<h1[^>]*>(.*?)</h1>", html_content, re.DOTALL | re.IGNORECASE)
    if not title_match:
        title_match = re.search(r"<title>(.*?)(?:\s*[-|].*)?</title>", html_content, re.DOTALL)
    if title_match:
        raw_title = extract_text(title_match.group(1)).strip()
        # Clean up: remove "RENTAL" suffix, normalize case
        title = re.sub(r"\s*(rental|for rent|miami).*$", "", raw_title, flags=re.IGNORECASE).strip()
        data["title"] = title.title() if title.isupper() else title
    else:
        # Derive from slug
        data["title"] = slug.replace("-rental", "").replace("-for-rent", "").replace("-miami", "").replace("-", " ").title()

    # --- Extract make and model from title ---
    title_for_parse = data.get("title", "")
    for make in KNOWN_MAKES:
        if make.lower() in title_for_parse.lower():
            data["make"] = make
            idx = title_for_parse.lower().index(make.lower())
            after = title_for_parse[idx + len(make):].strip()
            if after:
                data["model"] = after
            break

    # Special handling: if title starts with a year
    year_title_match = re.match(r"^(\d{4})\s+(.+)", title_for_parse)
    if year_title_match:
        data["year"] = int(year_title_match.group(1))
        remaining = year_title_match.group(2)
        # Re-parse make/model from remaining
        for make in KNOWN_MAKES:
            if make.lower() in remaining.lower():
                data["make"] = make
                idx = remaining.lower().index(make.lower())
                after = remaining[idx + len(make):].strip()
                if after:
                    data["model"] = after
                break

    # --- Extract daily rate ---
    # On mph club detail pages, "Starting At:" is in one Elementor widget and
    # the price "$X,XXX" is in a separate heading widget ~700 chars later.
    # Strategy: find "Starting At" then look for the first dollar amount within
    # the next 1500 characters of HTML.
    starting_match = re.search(r'Starting\s+At\s*:?', html_content, re.IGNORECASE)
    if starting_match:
        after_starting = html_content[starting_match.end():starting_match.end() + 1500]
        price_match = re.search(r'\$([\d,]+)', after_starting)
        if price_match:
            price_str = price_match.group(1).replace(",", "")
            if price_str.isdigit() and int(price_str) >= 100:
                data["daily_rate"] = int(price_str)

    # Fallback: look for $X,XXX/day pattern (fleet page style)
    if "daily_rate" not in data:
        price_day_match = re.search(r'\$\s*([\d,]+)\s*/\s*day', html_content, re.IGNORECASE)
        if price_day_match:
            price_str = price_day_match.group(1).replace(",", "")
            if price_str.isdigit():
                data["daily_rate"] = int(price_str)

    # Fallback: look for elementor heading with just a price
    if "daily_rate" not in data:
        heading_price = re.search(
            r'elementor-heading-title[^>]*>\$([\d,]+)</div>',
            html_content, re.IGNORECASE
        )
        if heading_price:
            price_str = heading_price.group(1).replace(",", "")
            if price_str.isdigit() and int(price_str) >= 100:
                data["daily_rate"] = int(price_str)

    # --- Extract performance specs ---
    # mph club uses Elementor. Spec values appear in two places:
    # 1. Heading widgets: <div class="elementor-heading-title ...">2.2s</div>
    # 2. Text-editor widgets: <p>220 mph</p> or <p>8 speed auto</p>
    # Labels follow in the next widget: <p>(0-60)</p>, <p>(6.5L, V12)</p>

    # Extract all Elementor heading values
    heading_values = re.findall(
        r'elementor-heading-title[^>]*>([^<]+)</div>',
        html_content, re.IGNORECASE
    )
    # Also extract short text-editor <p> content (specs area uses short <p> tags)
    text_editor_values = re.findall(
        r'elementor-widget-text-editor[^>]*>.*?<p>([^<]{2,40})</p>',
        html_content, re.DOTALL | re.IGNORECASE
    )
    # Combine both sources for spec scanning
    all_spec_values = heading_values + text_editor_values

    for val in all_spec_values:
        val = val.strip()

        # 0-60 time: "2.2s" or "3.4s"
        accel_m = re.match(r'^([\d.]+)\s*s$', val, re.IGNORECASE)
        if accel_m and "zero_to_sixty" not in data:
            try:
                v = float(accel_m.group(1))
                if 1.0 <= v <= 15.0:  # reasonable 0-60 range
                    data["zero_to_sixty"] = v
            except ValueError:
                pass
            continue

        # Horsepower: "641hp" or "1001hp"
        hp_m = re.match(r'^(\d{2,4})\s*hp$', val, re.IGNORECASE)
        if hp_m and "horsepower" not in data:
            data["horsepower"] = int(hp_m.group(1))
            # Look for engine info in the next text-editor widget after this heading
            hp_pos = html_content.find(val)
            if hp_pos >= 0:
                after_hp = html_content[hp_pos:hp_pos + 500]
                engine_m = re.search(r'\(([^)]+)\)', after_hp)
                if engine_m and "engine" not in data:
                    engine_text = engine_m.group(1).strip()
                    # Must look like engine specs (has L, V, cylinder info)
                    if re.search(r'\d+\.?\d*\s*L|V\d+|flat|turbo|electric', engine_text, re.IGNORECASE):
                        data["engine"] = engine_text
            continue

        # Top speed: "205 mph" or "220 mph"
        speed_m = re.match(r'^(\d{3})\s*mph$', val, re.IGNORECASE)
        if speed_m and "top_speed" not in data:
            data["top_speed"] = int(speed_m.group(1))
            continue

        # Transmission: "8-speed Automatic" or "7 speed auto"
        trans_m = re.match(r'^(\d+[-\s]speed\s+.+)$', val, re.IGNORECASE)
        if trans_m and "transmission" not in data:
            data["transmission"] = trans_m.group(1).strip()
            continue

        # Seating: "2 seater" or "5 seater"
        seat_m = re.match(r'^(\d+)\s*seater$', val, re.IGNORECASE)
        if seat_m:
            data["seating_capacity"] = int(seat_m.group(1))
            continue

    # Fallback: search the full page text for specs if headings didn't yield them

    # 0-60 from description text: "2.2 seconds to go from 0-60"
    if "zero_to_sixty" not in data:
        accel_match = re.search(
            r'([\d.]+)\s*(?:seconds?|s)\s*(?:to\s+(?:go\s+)?)?(?:from\s+)?0[-\u201360]\s*(?:mph)?',
            html_content, re.IGNORECASE
        )
        if accel_match:
            try:
                v = float(accel_match.group(1))
                if 1.0 <= v <= 15.0:
                    data["zero_to_sixty"] = v
            except ValueError:
                pass

    # Horsepower from text
    if "horsepower" not in data:
        hp_match = re.search(r'(\d{2,4})\s*(?:hp|horsepower|bhp)', html_content, re.IGNORECASE)
        if hp_match:
            data["horsepower"] = int(hp_match.group(1))

    # Top speed from text
    if "top_speed" not in data:
        speed_match = re.search(r'(?:top speed|max speed)[:\s]*(\d{3})\s*mph', html_content, re.IGNORECASE)
        if speed_match:
            data["top_speed"] = int(speed_match.group(1))

    # Transmission from text
    if "transmission" not in data:
        trans_match = re.search(
            r'(\d+[-\s]speed\s+(?:auto(?:matic)?|manual|dual[- ]clutch|PDK|DCT|CVT))',
            html_content, re.IGNORECASE
        )
        if trans_match:
            data["transmission"] = trans_match.group(1).strip()

    # Drivetrain: look for AWD, RWD, 4x4, all-wheel drive, etc.
    drive_match = re.search(
        r'\b(AWD|RWD|FWD|4x4|4WD|all[-\s]wheel\s+drive|rear[-\s]wheel\s+drive|front[-\s]wheel\s+drive)\b',
        html_content, re.IGNORECASE
    )
    if drive_match:
        val = drive_match.group(1).strip()
        norm = val.upper().replace(" ", "-")
        if "ALL" in norm:
            data["drivetrain"] = "AWD"
        elif "REAR" in norm:
            data["drivetrain"] = "RWD"
        elif "FRONT" in norm:
            data["drivetrain"] = "FWD"
        else:
            data["drivetrain"] = val.upper()

    # --- Extract body style from context ---
    title_lower = data.get("title", "").lower()
    if any(w in title_lower for w in ["spider", "spyder", "convertible", "cabriolet", "roadster", "dawn"]):
        data["body_style"] = "Convertible"
    elif any(w in title_lower for w in ["suv", "urus", "cullinan", "bentayga", "cayenne", "range rover", "escalade", "suburban", "g wagon", "g63", "g-wagon", "g 550"]):
        data["body_style"] = "SUV"
    elif any(w in title_lower for w in ["sedan", "s-class", "s class", "phantom", "ghost", "maybach s"]):
        data["body_style"] = "Sedan"
    elif any(w in title_lower for w in ["coupe", "gtb", "gt3", "turbo s", "wraith", "corvette", "i8", "850i", "sl 63"]):
        data["body_style"] = "Coupe"
    elif any(w in title_lower for w in ["limo", "sprinter"]):
        data["body_style"] = "Van"
    else:
        # Default based on make
        make = data.get("make", "").lower()
        if make in ("lamborghini", "ferrari", "mclaren", "porsche", "aston martin", "bugatti"):
            data["body_style"] = "Coupe"

    # --- Extract exterior color from title or image filenames ---
    color_patterns = [
        "black", "white", "red", "blue", "green", "yellow", "orange", "grey",
        "gray", "silver", "sand", "purple", "pink", "gold", "brown", "matte",
    ]
    # Check title for color
    for color in color_patterns:
        if color in title_lower:
            data["exterior_color"] = color.title()
            break

    # If not found in title, check image filenames
    if "exterior_color" not in data:
        img_filenames = re.findall(r'/([^/]+?)(?:-\d+x\d+)?\.(?:jpg|jpeg|png|webp)', html_content, re.IGNORECASE)
        for fname in img_filenames:
            fname_lower = fname.lower()
            if "profile" in fname_lower or "side" in fname_lower:
                for color in color_patterns:
                    if fname_lower.startswith(color) or f"-{color}-" in fname_lower:
                        data["exterior_color"] = color.title()
                        break
                if "exterior_color" in data:
                    break

    # Also check for "on" pattern in filenames like "red-on-black-ferrari"
    # which indicates exterior-on-interior color scheme
    color_on_match = re.search(
        r'(\w+)-on-(\w+)?-?' + r'(?:' + '|'.join(re.escape(m.lower().replace(" ", "-")) for m in KNOWN_MAKES) + r')',
        html_content, re.IGNORECASE
    )
    if color_on_match:
        ext_color = color_on_match.group(1).lower()
        int_color = color_on_match.group(2)
        if ext_color in color_patterns and "exterior_color" not in data:
            data["exterior_color"] = ext_color.title()
        if int_color and int_color.lower() in color_patterns and "interior_color" not in data:
            data["interior_color"] = int_color.title()

    # --- Extract description ---
    # Look for substantial paragraph text in the page body
    # mph club pages have descriptions in various div wrappers
    desc_sections = []
    # Try to find paragraphs with substantial content
    p_matches = re.findall(r'<p[^>]*>(.*?)</p>', html_content, re.DOTALL | re.IGNORECASE)
    for p in p_matches:
        text = extract_text(p).strip()
        # Filter out short snippets, navigation text, boilerplate
        if len(text) > 80 and not text.startswith("Starting At") and "cookie" not in text.lower():
            if "mph club" in text.lower() or any(m.lower() in text.lower() for m in KNOWN_MAKES):
                desc_sections.append(text)

    if desc_sections:
        data["description"] = " ".join(desc_sections[:3])[:2000]

    # --- Extract images ---
    image_urls = []
    SKIP_IMAGES = {"mph-club-logo", "favicon", "site-logo", "cropped-", "gravatar"}

    # Pattern 1: wp-content/uploads images (main image source for mphclub)
    wp_matches = re.findall(
        r'(?:src|data-lazy-src|data-src|srcset)=["\']([^"\']*wp-content/uploads[^"\']*\.(?:jpg|jpeg|png|webp))["\']',
        html_content, re.IGNORECASE
    )
    for img_url in wp_matches:
        full_url = img_url if img_url.startswith("http") else BASE_URL + img_url
        # Skip thumbnails, logos, tiny images
        if any(skip in full_url.lower() for skip in SKIP_IMAGES):
            continue
        if re.search(r'-\d{2,3}x\d{2,3}\.', full_url):
            # Skip small thumbnails like 150x150, 300x200
            continue
        if full_url not in image_urls:
            image_urls.append(full_url)

    # Pattern 2: Other img src patterns
    other_imgs = re.findall(
        r'(?:data-lazy-src|data-src)=["\']([^"\']*mphclub\.com[^"\']*\.(?:jpg|jpeg|png|webp))["\']',
        html_content, re.IGNORECASE
    )
    for img_url in other_imgs:
        full_url = img_url if img_url.startswith("http") else BASE_URL + img_url
        if any(skip in full_url.lower() for skip in SKIP_IMAGES):
            continue
        if re.search(r'-\d{2,3}x\d{2,3}\.', full_url):
            continue
        if full_url not in image_urls:
            image_urls.append(full_url)

    # Prefer the larger images: remove -1024x576 suffix versions if the original exists
    cleaned_urls = []
    for img in image_urls:
        # Normalize: remove dimension suffixes to get the canonical URL
        canonical = re.sub(r'-\d{3,4}x\d{3,4}', '', img)
        if canonical != img and canonical in image_urls:
            continue  # Skip the dimension variant, keep the original
        cleaned_urls.append(img)

    data["photo_urls"] = cleaned_urls[:50]  # Cap at 50 images

    return data


# ---------------------------------------------------------------------------
# Supabase upsert
# ---------------------------------------------------------------------------

def supabase_upsert(supabase_url, supabase_key, table, data, conflict_key="source_provider,source_listing_id"):
    """Upsert a record into Supabase."""
    url = f"{supabase_url}/rest/v1/{table}?on_conflict={conflict_key}"
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    # Don't send id on upsert — let DB keep existing id or generate new one
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
        f"{emoji} *mph club Scrape Complete*\n"
        f"*Cars scraped:* {summary.get('cars_scraped', 0)}\n"
        f"*Cars upserted:* {summary.get('cars_upserted', 0)}\n"
        f"*Skipped (hourly):* {summary.get('skipped_hourly', 0)}\n"
        f"*Errors:* {summary.get('errors', 0)}\n"
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
    parser = argparse.ArgumentParser(description="Scrape mph club exotic car listings")
    parser.add_argument("--dry-run", action="store_true", help="Scrape but don't write to database")
    parser.add_argument("--urls", nargs="+", help="Scrape specific URLs instead of discovering from fleet page")
    parser.add_argument("--limit", type=int, default=0, help="Max listings to scrape (0=all)")
    args = parser.parse_args()

    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")

    if not args.dry_run and (not supabase_url or not supabase_key):
        log.error("SUPABASE_URL and SUPABASE_SERVICE_KEY required (or use --dry-run)")
        sys.exit(1)

    start_time = time.time()
    summary = {"cars_scraped": 0, "cars_upserted": 0, "skipped_hourly": 0, "errors": 0}

    # Discover or use provided URLs
    if args.urls:
        urls = args.urls
        log.info("Scraping %d provided URLs", len(urls))
    else:
        urls = discover_listings_from_fleet()

    if not urls:
        log.error("No car listing URLs found")
        sys.exit(1)

    # Deduplicate
    seen = set()
    unique_urls = []
    for u in urls:
        clean = u.rstrip("/") + "/"
        if clean not in seen:
            seen.add(clean)
            unique_urls.append(clean)
    urls = unique_urls

    # Apply limit
    if args.limit > 0:
        urls = urls[:args.limit]

    log.info("Will scrape %d car listings", len(urls))

    for i, url in enumerate(urls):
        log.info("[%d/%d] %s", i + 1, len(urls), url)

        # Skip hourly-rate listings (e.g., Sprinter limos)
        if any(kw in url.lower() for kw in HOURLY_KEYWORDS):
            log.info("  Skipping hourly-rate listing")
            summary["skipped_hourly"] += 1
            continue

        html_content = fetch_page(url)
        if not html_content:
            summary["errors"] += 1
            continue

        # Skip if the page content indicates hourly pricing
        if re.search(r'\$\s*\d+\s*/\s*hour', html_content, re.IGNORECASE):
            log.info("  Skipping hourly-rate listing (detected in page content)")
            summary["skipped_hourly"] += 1
            continue

        try:
            data = parse_car_listing(url, html_content)
        except Exception as e:
            log.error("Parse error for %s: %s", url, e)
            summary["errors"] += 1
            continue

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
                summary["cars_upserted"] += 1
            else:
                log.error("  Upsert failed: HTTP %d", status)
                summary["errors"] += 1
        else:
            log.info("  [DRY RUN] Would upsert to exotic_cars:")
            for k in ("title", "make", "model", "year", "daily_rate", "horsepower",
                       "top_speed", "zero_to_sixty", "transmission", "body_style",
                       "exterior_color", "engine", "drivetrain", "photo_urls"):
                if k in data:
                    val = data[k]
                    if k == "photo_urls":
                        val = f"{len(val)} images"
                    log.info("    %s: %s", k, val)

        summary["cars_scraped"] += 1

        # Rate limit
        if i < len(urls) - 1:
            time.sleep(REQUEST_DELAY)

    elapsed = round(time.time() - start_time)
    summary["duration"] = elapsed

    log.info("=" * 60)
    log.info("SCRAPE COMPLETE")
    log.info("  Cars scraped: %d", summary["cars_scraped"])
    log.info("  Cars upserted: %d", summary["cars_upserted"])
    log.info("  Skipped (hourly): %d", summary["skipped_hourly"])
    log.info("  Errors: %d", summary["errors"])
    log.info("  Duration: %ds", elapsed)
    log.info("=" * 60)

    send_slack_notification(summary)

    if summary["errors"] > 0 and summary["cars_scraped"] == 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
