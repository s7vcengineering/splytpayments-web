#!/usr/bin/env python3
"""
Scrape Echelon Exotics of Tampa (echelonexoticsoftampa.com) exotic car rental listings.

How it works:
  1. Fetches the homepage to discover all vehicle page URLs from navigation
  2. Fetches each vehicle detail page (e.g. /lamborghini, /ferrari-1, /rolls-royce-1)
  3. Parses vehicle cards from the GoDaddy Website Builder HTML (data-ux="ContentCard")
  4. Also parses the homepage "Featured Vehicles" section for additional listings
  5. Upserts into Supabase table: exotic_cars

Usage:
  export SUPABASE_URL="https://your-project.supabase.co"
  export SUPABASE_SERVICE_KEY="your-service-role-key"

  # Scrape everything
  python3 scripts/scrape-echelonexotics.py

  # Dry run (scrape but don't write to database)
  python3 scripts/scrape-echelonexotics.py --dry-run

  # Limit number of pages to scrape
  python3 scripts/scrape-echelonexotics.py --limit 3
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

log = logging.getLogger("echelon-scraper")
log.setLevel(logging.DEBUG)

_console = logging.StreamHandler(sys.stderr)
_console.setLevel(logging.INFO)
_console.setFormatter(logging.Formatter(LOG_FORMAT, datefmt=LOG_DATE_FORMAT))
log.addHandler(_console)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_URL = "https://echelonexoticsoftampa.com"
SOURCE_PROVIDER = "echelonexotics"
PHONE = "813.727.8423"
ADDRESS = "Tampa, Florida 33610"
EMAIL = "Sales@EchelonExoticsofTampa.com"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# Rate limiting
REQUEST_DELAY = 1.5  # seconds between requests

# Known vehicle page slugs from the site navigation
# These are the detail pages under "Our Vehicles" dropdown
KNOWN_VEHICLE_PAGES = [
    "lamborghini",
    "ferrari-1",
    "rolls-royce-1",
    "mclaren-1",
    "escalade-1",
    "corvette-1",
]

# The fleet overview page
FLEET_PAGE = "the-fleet"

# Known makes to help parse titles
KNOWN_MAKES = [
    "Lamborghini", "Ferrari", "McLaren", "Rolls Royce", "Rolls-Royce",
    "Cadillac", "Chevrolet", "Corvette", "Bentley", "Porsche",
    "Mercedes-Benz", "Mercedes Benz", "BMW", "Audi", "Range Rover",
    "Land Rover", "Aston Martin", "Bugatti", "Maserati", "Tesla",
]

# Images to skip (logos, icons, etc.)
SKIP_IMAGE_PATTERNS = [
    "logo", "favicon", "icon", "echelon-exotics-of-tampa",
    "social", "badge", "banner", "placeholder",
]


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


def clean_text(text):
    """Clean up extracted text: normalize whitespace, strip."""
    if not text:
        return text
    text = re.sub(r'\s+', ' ', text).strip()
    return text


# ---------------------------------------------------------------------------
# Discovery: find vehicle pages from navigation
# ---------------------------------------------------------------------------

def discover_vehicle_pages(html_content):
    """Parse the homepage/navigation to discover vehicle page URLs.

    GoDaddy Website Builder sites use data-ux="NavLink" and
    data-ux="NavMenuLink" for navigation items. Vehicle pages are
    under the "Our Vehicles" dropdown menu.
    """
    pages = set()

    # Pattern 1: Look for navigation links with known vehicle slugs
    # These appear as href="/lamborghini", href="/ferrari-1", etc.
    nav_links = re.findall(
        r'href=["\'](?:https?://echelonexoticsoftampa\.com)?/([a-z0-9][\w-]*(?:-\d+)?)["\']',
        html_content, re.IGNORECASE
    )
    for slug in nav_links:
        slug = slug.strip("/")
        # Skip non-vehicle pages
        if slug in ("", "the-fleet", "our-services", "contact-us",
                     "privacy-policy", "terms-of-service"):
            continue
        # Skip if it looks like a file or asset
        if "." in slug or slug.startswith("_"):
            continue
        pages.add(slug)

    # Pattern 2: Explicit known pages from the nav menu
    for slug in KNOWN_VEHICLE_PAGES:
        pages.add(slug)

    # Also add the fleet overview page
    pages.add(FLEET_PAGE)

    log.info("Discovered %d vehicle pages: %s", len(pages), sorted(pages))
    return sorted(pages)


# ---------------------------------------------------------------------------
# Parse vehicle cards from GoDaddy Website Builder HTML
# ---------------------------------------------------------------------------

def extract_content_cards(html_content):
    """Extract vehicle data from GoDaddy ContentCard components.

    GoDaddy Website Builder uses data-ux="ContentCard" for card components.
    Each card has:
      - data-ux="ContentCardHeading" — vehicle name/title
      - data-ux="ContentCardText" — price or description text
      - data-ux="ContentCardImageThumbnail" — vehicle image
      - data-ux="ContentCardWrapperImage" — linked image wrapper
      - data-ux="ContentCardButton" — "Reserve Now" button
    """
    cards = []

    # Find all ContentCard blocks
    # GoDaddy renders these as <div data-ux="ContentCard" ...>...</div>
    card_pattern = re.compile(
        r'<div[^>]*data-ux="ContentCard"[^>]*>(.*?)</div>\s*'
        r'(?=<div[^>]*data-ux="ContentCard"|</div>\s*</div>\s*</div>)',
        re.DOTALL | re.IGNORECASE
    )

    # Alternative: split by ContentCard markers
    # GoDaddy wraps cards in nested divs, so we use a simpler approach
    # Split HTML at each ContentCard boundary
    parts = re.split(r'(?=<div[^>]*data-ux="ContentCard")', html_content)

    for part in parts:
        if 'data-ux="ContentCard"' not in part[:200]:
            continue

        card_data = {}

        # Extract heading (vehicle name)
        heading_match = re.search(
            r'data-ux="ContentCardHeading"[^>]*>(.*?)</(?:h[1-6]|div|span|p)',
            part, re.DOTALL | re.IGNORECASE
        )
        if heading_match:
            card_data["heading"] = clean_text(extract_text(heading_match.group(1)))

        # Extract text (usually price like "Starting at $1195")
        text_match = re.search(
            r'data-ux="ContentCardText"[^>]*>(.*?)</(?:p|div|span)',
            part, re.DOTALL | re.IGNORECASE
        )
        if text_match:
            card_data["text"] = clean_text(extract_text(text_match.group(1)))

        # Extract image URL from data-srclazy (GoDaddy lazy loading)
        img_lazy_match = re.search(
            r'data-srclazy="([^"]+)"', part
        )
        if img_lazy_match:
            card_data["image_url"] = img_lazy_match.group(1).split("/:/")[0]

        # Fallback: regular src attribute
        if "image_url" not in card_data:
            img_src_match = re.search(
                r'data-ux="ContentCardImageThumbnail"[^>]*src="([^"]+)"',
                part, re.IGNORECASE
            )
            if img_src_match:
                url = img_src_match.group(1).split("/:/")[0]
                if "wsimg.com" in url or "echelonexotics" in url:
                    card_data["image_url"] = url

        # Extract image alt text
        img_alt_match = re.search(
            r'data-ux="ContentCardImageThumbnail"[^>]*alt="([^"]*)"',
            part, re.IGNORECASE
        )
        if not img_alt_match:
            img_alt_match = re.search(
                r'alt="([^"]*)"[^>]*data-ux="ContentCardImageThumbnail"',
                part, re.IGNORECASE
            )
        if img_alt_match:
            card_data["image_alt"] = img_alt_match.group(1)

        # Extract link (to vehicle detail or section)
        link_match = re.search(
            r'data-ux="ContentCardWrapperImage"[^>]*>.*?href="([^"]*)"',
            part, re.DOTALL | re.IGNORECASE
        )
        if link_match:
            card_data["link"] = link_match.group(1)

        # Only include cards that look like vehicles (have heading + price or image)
        if card_data.get("heading") and (
            card_data.get("text") or card_data.get("image_url")
        ):
            cards.append(card_data)

    return cards


def extract_section_images(html_content, section_id=None):
    """Extract all vehicle images from a page section.

    GoDaddy stores images in img1.wsimg.com with data-srclazy attributes.
    """
    image_urls = []

    # Pattern 1: data-srclazy (GoDaddy lazy-loaded images)
    lazy_matches = re.findall(
        r'data-srclazy="(https?://img\d*\.wsimg\.com/[^"]+)"',
        html_content, re.IGNORECASE
    )
    for url in lazy_matches:
        # Get the base URL without crop/resize parameters
        clean_url = url.split("/:/")[0]
        if clean_url not in image_urls and not _is_skip_image(clean_url):
            image_urls.append(clean_url)

    # Pattern 2: Regular src with wsimg.com
    src_matches = re.findall(
        r'src="(https?://img\d*\.wsimg\.com/[^"]+)"',
        html_content, re.IGNORECASE
    )
    for url in src_matches:
        clean_url = url.split("/:/")[0]
        if clean_url not in image_urls and not _is_skip_image(clean_url):
            image_urls.append(clean_url)

    # Pattern 3: Background images in style attributes
    bg_matches = re.findall(
        r'background-image:\s*url\(["\']?(https?://img\d*\.wsimg\.com/[^"\')\s]+)',
        html_content, re.IGNORECASE
    )
    for url in bg_matches:
        clean_url = url.split("/:/")[0]
        if clean_url not in image_urls and not _is_skip_image(clean_url):
            image_urls.append(clean_url)

    return image_urls


def _is_skip_image(url):
    """Check if an image URL should be skipped (logos, icons, etc.)."""
    url_lower = url.lower()
    for pattern in SKIP_IMAGE_PATTERNS:
        if pattern in url_lower:
            return True
    # Skip very small images (thumbnails in URL path)
    if re.search(r'/rs=w:(\d+)', url_lower):
        width = int(re.search(r'/rs=w:(\d+)', url_lower).group(1))
        if width < 100:
            return True
    return False


# ---------------------------------------------------------------------------
# Parse vehicle data from a page
# ---------------------------------------------------------------------------

def parse_vehicle_page(url, page_slug, html_content):
    """Parse a vehicle page and extract all vehicle listings.

    Each vehicle page (e.g. /lamborghini) may contain multiple vehicles
    displayed as ContentCard components or as sections with images.
    """
    vehicles = []

    # Step 1: Extract ContentCard-based vehicle entries
    cards = extract_content_cards(html_content)

    for card in cards:
        heading = card.get("heading", "")

        # Skip service cards (not vehicles)
        service_keywords = [
            "chauffeur", "airport", "photoshoot", "video", "drive pass",
            "bliss", "customized", "car tour", "drive your dream",
            "why choose", "subscribe", "contact",
        ]
        if any(kw in heading.lower() for kw in service_keywords):
            continue

        # Skip if no heading or heading is too generic
        if not heading or len(heading) < 3:
            continue

        vehicle = _build_vehicle_record(card, page_slug, url)
        if vehicle:
            vehicles.append(vehicle)

    # Step 2: If no ContentCards found, try to parse the page as a
    # single-vehicle page by looking at headings, images, and text
    if not vehicles:
        vehicle = _parse_single_vehicle_page(url, page_slug, html_content)
        if vehicle:
            vehicles.append(vehicle)

    # Step 3: Extract additional images from the page and distribute
    # them to vehicles that are missing images
    all_page_images = extract_section_images(html_content)
    for v in vehicles:
        if not v.get("photo_urls") and all_page_images:
            v["photo_urls"] = all_page_images[:20]

    return vehicles


def _build_vehicle_record(card, page_slug, page_url):
    """Build a vehicle record dict from a ContentCard."""
    heading = card.get("heading", "")
    text = card.get("text", "")

    # Generate a stable listing ID from the heading
    listing_id = re.sub(r'[^a-z0-9]+', '-', heading.lower()).strip('-')
    if not listing_id:
        return None

    now = datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%dT%H:%M:%SZ")

    data = {
        "source_provider": SOURCE_PROVIDER,
        "source_url": page_url,
        "source_listing_id": listing_id,
        "title": heading,
        "city": "Tampa",
        "region": "FL",
        "contact_phone": PHONE,
        "contact_address": ADDRESS,
        "is_active": True,
        "scrape_status": "scraped",
        "last_scraped_at": now,
    }

    # Parse price from text (e.g. "Starting at $1195")
    price_match = re.search(r'\$\s*([\d,]+)', text)
    if price_match:
        price_str = price_match.group(1).replace(",", "")
        if price_str.isdigit():
            data["daily_rate"] = int(price_str)

    # Parse make and model from heading
    _parse_make_model(data, heading)

    # Extract image
    photo_urls = []
    if card.get("image_url"):
        photo_urls.append(card["image_url"])
    data["photo_urls"] = photo_urls

    # Use image alt as supplementary description
    if card.get("image_alt"):
        alt = card["image_alt"]
        if len(alt) > 10 and alt.lower() != heading.lower():
            data["description"] = alt

    return data


def _parse_single_vehicle_page(url, page_slug, html_content):
    """Try to parse a page as a single-vehicle listing.

    Some pages may not use ContentCards but instead present a single vehicle
    with a hero section, gallery, and specs.
    """
    now = datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%dT%H:%M:%SZ")

    # Extract the page title
    title = None
    title_match = re.search(r'<title>(.*?)(?:\s*[-|].*)?</title>', html_content, re.DOTALL)
    if title_match:
        title = clean_text(extract_text(title_match.group(1)))

    # Try h1/h2 headings
    if not title or title.lower() in ("home", "the fleet"):
        heading_match = re.search(
            r'<h[12][^>]*data-ux="(?:SectionHeading|HeadingMajor|Heading)"[^>]*>(.*?)</h[12]>',
            html_content, re.DOTALL | re.IGNORECASE
        )
        if heading_match:
            title = clean_text(extract_text(heading_match.group(1)))

    if not title or len(title) < 3:
        # Use slug as fallback
        title = page_slug.replace("-1", "").replace("-", " ").title()

    listing_id = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
    if not listing_id:
        listing_id = page_slug

    data = {
        "source_provider": SOURCE_PROVIDER,
        "source_url": url,
        "source_listing_id": listing_id,
        "title": title,
        "city": "Tampa",
        "region": "FL",
        "contact_phone": PHONE,
        "contact_address": ADDRESS,
        "is_active": True,
        "scrape_status": "scraped",
        "last_scraped_at": now,
    }

    # Parse make/model
    _parse_make_model(data, title)

    # Extract price
    price_match = re.search(
        r'(?:Starting at|from|price|rate)[:\s]*\$\s*([\d,]+)',
        html_content, re.IGNORECASE
    )
    if not price_match:
        price_match = re.search(r'\$\s*([\d,]+)\s*(?:/day|per day|daily)?', html_content)
    if price_match:
        price_str = price_match.group(1).replace(",", "")
        if price_str.isdigit() and 50 < int(price_str) < 50000:
            data["daily_rate"] = int(price_str)

    # Extract description
    desc_patterns = [
        r'data-ux="ContentText"[^>]*>(.*?)</(?:p|div|span)',
        r'<div[^>]*class="[^"]*description[^"]*"[^>]*>(.*?)</div>',
        r'<p[^>]*data-ux="Text"[^>]*>(.*?)</p>',
    ]
    for pat in desc_patterns:
        desc_match = re.search(pat, html_content, re.DOTALL | re.IGNORECASE)
        if desc_match:
            text = clean_text(extract_text(desc_match.group(1)))
            if text and len(text) > 30:
                data["description"] = text[:2000]
                break

    # Extract images
    data["photo_urls"] = extract_section_images(html_content)[:50]

    # Extract performance specs from text
    _parse_specs_from_text(data, html_content)

    return data if data.get("title") else None


def _parse_make_model(data, title):
    """Parse make and model from a vehicle title string."""
    if not title:
        return

    # Check for year at the start (e.g. "2024 Lamborghini Huracan")
    year_match = re.match(r'^(20\d{2})\s+(.+)', title)
    if year_match:
        data["year"] = int(year_match.group(1))
        title = year_match.group(2).strip()

    # Match known makes
    for make in KNOWN_MAKES:
        if make.lower() in title.lower():
            data["make"] = make.replace("-", " ")
            # Model is everything after the make name
            idx = title.lower().index(make.lower())
            after = title[idx + len(make):].strip()
            if after:
                data["model"] = after
            break

    # Special handling for "Corvette" (could be Chevrolet Corvette)
    if data.get("make") == "Corvette":
        data["make"] = "Chevrolet"
        data["model"] = "Corvette" + (" " + data.get("model", "")).rstrip()

    # Special handling for "Escalade" (Cadillac Escalade)
    if "escalade" in title.lower() and "make" not in data:
        data["make"] = "Cadillac"
        model_part = title.lower().replace("cadillac", "").strip()
        data["model"] = model_part.title()

    # Extract body style hints from title
    body_hints = {
        "spyder": "Convertible",
        "spider": "Convertible",
        "roadster": "Convertible",
        "convertible": "Convertible",
        "coupe": "Coupe",
        "coupé": "Coupe",
        "sedan": "Sedan",
        "suv": "SUV",
        "gtb": "Coupe",
        "gts": "Coupe",
    }
    for hint, style in body_hints.items():
        if hint in title.lower():
            data["body_style"] = style
            break


def _parse_specs_from_text(data, html_content):
    """Try to extract vehicle specifications from page text."""
    text = html_content

    # Horsepower
    hp_match = re.search(r'(\d{3,4})\s*(?:hp|horsepower|bhp)', text, re.IGNORECASE)
    if hp_match:
        data["horsepower"] = int(hp_match.group(1))

    # 0-60 mph
    accel_match = re.search(
        r'0[-\u2013]60\s*(?:mph)?\s*(?:in)?\s*([\d.]+)\s*(?:seconds|sec|s)',
        text, re.IGNORECASE
    )
    if accel_match:
        data["zero_to_sixty"] = float(accel_match.group(1))

    # Top speed
    speed_match = re.search(
        r'(?:top speed|max speed)[:\s]*(\d{3})\s*mph', text, re.IGNORECASE
    )
    if speed_match:
        data["top_speed"] = int(speed_match.group(1))

    # Engine
    engine_match = re.search(
        r'(\d+\.?\d*)\s*(?:L|liter|litre)\s*(?:V\d+|flat|inline|twin[- ]turbo)?[^<]{0,30}',
        text, re.IGNORECASE
    )
    if engine_match:
        data["engine"] = clean_text(engine_match.group(0))[:100]

    # Transmission
    trans_match = re.search(
        r'(\d+[-\s]speed\s+(?:automatic|manual|dual[- ]clutch|sequential|PDK|DCT)[^<]{0,20})',
        text, re.IGNORECASE
    )
    if trans_match:
        data["transmission"] = clean_text(trans_match.group(1))[:100]

    # Drivetrain
    for dt_pattern, dt_value in [
        (r'\bAWD\b', 'AWD'),
        (r'\b4WD\b', '4WD'),
        (r'\bRWD\b', 'RWD'),
        (r'\bFWD\b', 'FWD'),
        (r'all[- ]wheel[- ]drive', 'AWD'),
        (r'rear[- ]wheel[- ]drive', 'RWD'),
        (r'four[- ]wheel[- ]drive', '4WD'),
    ]:
        if re.search(dt_pattern, text, re.IGNORECASE):
            data["drivetrain"] = dt_value
            break

    # Exterior color from image alt or description
    color_match = re.search(
        r'\b(black|white|red|blue|yellow|green|orange|silver|gray|grey|purple|'
        r'gold|bronze|matte|satin|midnight|pearl|carbon)\b',
        data.get("description", "") + " " + data.get("title", ""),
        re.IGNORECASE
    )
    if color_match:
        data["exterior_color"] = color_match.group(1).title()


# ---------------------------------------------------------------------------
# Deduplication
# ---------------------------------------------------------------------------

def deduplicate_vehicles(vehicles):
    """Remove duplicate vehicles based on source_listing_id."""
    seen = {}
    unique = []
    for v in vehicles:
        lid = v.get("source_listing_id", "")
        if lid and lid not in seen:
            seen[lid] = True
            unique.append(v)
        elif lid in seen:
            # Merge: keep the one with more data
            for existing in unique:
                if existing.get("source_listing_id") == lid:
                    # Update missing fields from the duplicate
                    for key, val in v.items():
                        if key not in existing or not existing[key]:
                            existing[key] = val
                    # Merge photo URLs
                    existing_photos = existing.get("photo_urls", [])
                    new_photos = v.get("photo_urls", [])
                    for p in new_photos:
                        if p not in existing_photos:
                            existing_photos.append(p)
                    existing["photo_urls"] = existing_photos[:50]
                    break
    return unique


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
        f"{emoji} *Echelon Exotics Scrape Complete*\n"
        f"*Cars scraped:* {summary.get('cars_scraped', 0)}\n"
        f"*Pages fetched:* {summary.get('pages_fetched', 0)}\n"
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
    parser = argparse.ArgumentParser(description="Scrape Echelon Exotics of Tampa listings")
    parser.add_argument("--dry-run", action="store_true", help="Scrape but don't write to database")
    parser.add_argument("--limit", type=int, default=0, help="Max vehicle pages to scrape (0=all)")
    args = parser.parse_args()

    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")

    if not args.dry_run and (not supabase_url or not supabase_key):
        log.error("SUPABASE_URL and SUPABASE_SERVICE_KEY required (or use --dry-run)")
        sys.exit(1)

    start_time = time.time()
    summary = {"cars_scraped": 0, "pages_fetched": 0, "errors": 0}

    # Step 1: Fetch homepage to discover vehicle pages
    log.info("Fetching homepage: %s", BASE_URL)
    homepage_html = fetch_page(BASE_URL)
    if not homepage_html:
        log.error("Failed to fetch homepage. Falling back to known vehicle pages.")
        vehicle_pages = KNOWN_VEHICLE_PAGES[:]
    else:
        summary["pages_fetched"] += 1
        vehicle_pages = discover_vehicle_pages(homepage_html)

    if args.limit > 0:
        vehicle_pages = vehicle_pages[:args.limit]

    # Step 2: Collect all vehicles from all pages
    all_vehicles = []

    # Parse homepage featured vehicles first (if we have the HTML)
    if homepage_html:
        log.info("Parsing homepage featured vehicles...")
        homepage_vehicles = parse_vehicle_page(
            BASE_URL, "home", homepage_html
        )
        log.info("  Found %d vehicles on homepage", len(homepage_vehicles))
        all_vehicles.extend(homepage_vehicles)

    # Step 3: Fetch and parse each vehicle page
    for i, slug in enumerate(vehicle_pages):
        url = f"{BASE_URL}/{slug}"
        log.info("[%d/%d] Fetching: %s", i + 1, len(vehicle_pages), url)

        time.sleep(REQUEST_DELAY)

        html_content = fetch_page(url)
        if not html_content:
            summary["errors"] += 1
            continue

        summary["pages_fetched"] += 1

        try:
            page_vehicles = parse_vehicle_page(url, slug, html_content)
        except Exception as e:
            log.error("Parse error for %s: %s", url, e)
            summary["errors"] += 1
            continue

        log.info("  Found %d vehicles on page", len(page_vehicles))
        for v in page_vehicles:
            log.info(
                "    %s | %d images | $%s/day",
                v.get("title", "?"),
                len(v.get("photo_urls", [])),
                v.get("daily_rate", "?"),
            )
        all_vehicles.extend(page_vehicles)

    # Step 4: Deduplicate
    all_vehicles = deduplicate_vehicles(all_vehicles)
    log.info("Total unique vehicles after dedup: %d", len(all_vehicles))

    # Step 5: Upsert to Supabase
    for vehicle in all_vehicles:
        if not args.dry_run:
            status = supabase_upsert(supabase_url, supabase_key, "exotic_cars", vehicle)
            if status in (200, 201):
                log.info("  Upserted: %s", vehicle.get("title", "?"))
            else:
                log.error("  Upsert failed for %s: HTTP %d", vehicle.get("title", "?"), status)
                summary["errors"] += 1
        else:
            log.info("  [DRY RUN] Would upsert: %s", vehicle.get("title", "?"))
            for k in ("title", "make", "model", "year", "daily_rate",
                       "body_style", "exterior_color", "photo_urls"):
                if k in vehicle:
                    val = vehicle[k]
                    if k == "photo_urls":
                        val = f"{len(val)} images"
                    log.info("    %s: %s", k, val)

        summary["cars_scraped"] += 1

    elapsed = round(time.time() - start_time)
    summary["duration"] = elapsed

    log.info("=" * 60)
    log.info("SCRAPE COMPLETE")
    log.info("  Cars: %d", summary["cars_scraped"])
    log.info("  Pages fetched: %d", summary["pages_fetched"])
    log.info("  Errors: %d", summary["errors"])
    log.info("  Duration: %ds", elapsed)
    log.info("=" * 60)

    send_slack_notification(summary)


if __name__ == "__main__":
    main()
