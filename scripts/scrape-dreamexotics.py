#!/usr/bin/env python3
"""
Scrape Dream Exotics (dreamexoticrentalcars.com) exotic car rental listings.

How it works:
  1. Fetches the car sitemap at /car-sitemap.xml to discover all listing URLs
  2. Fetches each car detail page
  3. Parses structured data (title, specs, price, images) from the HTML
  4. Upserts into Supabase table: exotic_cars

Usage:
  export SUPABASE_URL="https://your-project.supabase.co"
  export SUPABASE_SERVICE_KEY="your-service-role-key"

  # Scrape everything
  python3 scripts/scrape-dreamexotics.py

  # Dry run (scrape but don't write to database)
  python3 scripts/scrape-dreamexotics.py --dry-run

  # Limit to N listings
  python3 scripts/scrape-dreamexotics.py --limit 5

  # Scrape specific URLs
  python3 scripts/scrape-dreamexotics.py --urls https://dreamexoticrentalcars.com/cars/ferrari-sf90-stradale/
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

log = logging.getLogger("dreamexotics-scraper")
log.setLevel(logging.DEBUG)

_console = logging.StreamHandler(sys.stderr)
_console.setLevel(logging.INFO)
_console.setFormatter(logging.Formatter(LOG_FORMAT, datefmt=LOG_DATE_FORMAT))
log.addHandler(_console)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_URL = "https://dreamexoticrentalcars.com"
CAR_SITEMAP_URL = f"{BASE_URL}/car-sitemap.xml"
FLEET_PAGE_URL = f"{BASE_URL}/exotic-car-rentals-las-vegas/"
SOURCE_PROVIDER = "dreamexotics"
PHONE = "(888) 362-7791"
ADDRESS = "4301 S Valley View Blvd., Suite 16, Las Vegas, Nevada 89103"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# Rate limiting
REQUEST_DELAY = 1.5  # seconds between requests


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
# Known makes for parsing
# ---------------------------------------------------------------------------

KNOWN_MAKES = [
    "Rolls-Royce", "Rolls Royce", "Lamborghini", "Ferrari", "Bentley",
    "Mercedes-Benz", "Mercedes Benz", "Porsche", "BMW", "Audi",
    "McLaren", "Maserati", "Aston Martin", "Bugatti", "Cadillac",
    "Chevrolet", "Chevy", "Hummer", "Range Rover", "Land Rover",
    "Tesla", "Jaguar",
]

# Map common slug prefixes / brand aliases to canonical make names
MAKE_ALIASES = {
    "chevy": "Chevrolet",
    "rolls-royce": "Rolls-Royce",
    "rolls royce": "Rolls-Royce",
    "mercedes-benz": "Mercedes-Benz",
    "mercedes benz": "Mercedes-Benz",
    "aston-martin": "Aston Martin",
    "aston martin": "Aston Martin",
}


def normalise_make(make_str):
    """Return the canonical make name."""
    lower = make_str.lower().strip()
    if lower in MAKE_ALIASES:
        return MAKE_ALIASES[lower]
    return make_str.strip()


# ---------------------------------------------------------------------------
# Listing discovery
# ---------------------------------------------------------------------------

def discover_listings_from_sitemap():
    """Fetch car-sitemap.xml to discover all car listing URLs."""
    log.info("Fetching car sitemap: %s", CAR_SITEMAP_URL)
    content = fetch_page(CAR_SITEMAP_URL)

    urls = []
    if content:
        locs = re.findall(r"<loc>(.*?)</loc>", content)
        for url in locs:
            if "/cars/" in url:
                urls.append(url.rstrip("/") + "/")

    if not urls:
        # Fallback: discover from fleet page
        log.info("Sitemap empty, falling back to fleet page: %s", FLEET_PAGE_URL)
        urls = discover_listings_from_fleet_page()

    # Deduplicate
    seen = set()
    unique = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            unique.append(u)
    urls = unique

    log.info("Discovered %d car listing URLs", len(urls))
    return urls


def discover_listings_from_fleet_page():
    """Fallback: scrape the fleet page for /cars/ links."""
    content = fetch_page(FLEET_PAGE_URL)
    if not content:
        return []

    matches = re.findall(
        rf'href=["\']({re.escape(BASE_URL)}/cars/[^"\'#]+)["\']',
        content,
    )
    seen = set()
    urls = []
    for u in matches:
        clean = u.rstrip("/") + "/"
        if clean not in seen:
            seen.add(clean)
            urls.append(clean)
    return urls


# ---------------------------------------------------------------------------
# Car detail parser
# ---------------------------------------------------------------------------

def parse_car_listing(url, html_content):
    """Parse a car detail page and return structured data."""
    data = {
        "source_provider": SOURCE_PROVIDER,
        "source_url": url,
        "source_listing_id": url.rstrip("/").split("/")[-1],
        "city": "Las Vegas",
        "region": "NV",
        "contact_phone": PHONE,
        "contact_address": ADDRESS,
        "is_active": True,
        "scrape_status": "scraped",
        "last_scraped_at": datetime.datetime.now(datetime.UTC).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        ),
    }

    slug = url.rstrip("/").split("/")[-1]

    # ------------------------------------------------------------------
    # Title  (try <h1> first, then <title>)
    # ------------------------------------------------------------------
    title_match = re.search(r"<h1[^>]*>(.*?)</h1>", html_content, re.DOTALL)
    if not title_match:
        title_match = re.search(
            r"<title>(.*?)(?:\s*[-|].*)?</title>", html_content, re.DOTALL
        )
    if title_match:
        title = extract_text(title_match.group(1)).strip()
        # Clean up common suffixes from <title>
        for suffix in [" | Dream Exotics", " - Dream Exotics",
                       " Rental", " Exotic Rental Car"]:
            if title.endswith(suffix):
                title = title[: -len(suffix)].strip()
        data["title"] = title
    else:
        data["title"] = slug.replace("-", " ").title()

    # ------------------------------------------------------------------
    # Year  (from title text like "2024 Ferrari SF90 Stradale")
    # ------------------------------------------------------------------
    title_text = data.get("title", "")
    year_match = re.match(r"(\d{4})\s+", title_text)
    if year_match:
        data["year"] = int(year_match.group(1))

    # Also search description for year mentions
    if "year" not in data:
        year_in_body = re.search(
            r"\b(20[12]\d)\s+" + re.escape(title_text.split()[0] if title_text.split() else ""),
            html_content,
        )
        if year_in_body:
            data["year"] = int(year_in_body.group(1))

    # ------------------------------------------------------------------
    # Make / Model  (derive from title)
    # ------------------------------------------------------------------
    _parse_make_model(data, title_text, slug)

    # ------------------------------------------------------------------
    # Specs from <li><strong>Label:</strong> Value</li> pattern
    # ------------------------------------------------------------------
    spec_patterns = {
        "engine": r"Engine",
        "horsepower_raw": r"Horsepower|HP",
        "zero_to_sixty_raw": r"0[-\u2013]60\s*(?:Time)?",
        "top_speed_raw": r"Top\s*Speed",
        "torque_raw": r"Torque",
        "transmission": r"Transmission",
        "drivetrain": r"Drivetrain|Drive(?:train)?",
        "body_style": r"Body\s*(?:Style|Type)",
        "exterior_color": r"Exterior\s*Colo(?:u)?r",
        "interior_color": r"Interior\s*Colo(?:u)?r",
        "mileage_raw": r"Mileage",
        "seating_raw": r"Seating|Seats?|Capacity",
    }

    for key, label_pat in spec_patterns.items():
        # Pattern: <strong>Label:</strong> Value  (inside <li> or standalone)
        pat = re.compile(
            rf"<strong>\s*(?:{label_pat})\s*:?\s*</strong>\s*(.*?)(?:</li>|</p>|<br|<strong>)",
            re.DOTALL | re.IGNORECASE,
        )
        m = pat.search(html_content)
        if m:
            val = extract_text(m.group(1)).strip()
            if val and val.lower() not in ("n/a", "call", ""):
                data[key] = val

    # Also try <span>/<td> detail row patterns (some pages use tables)
    for field, key in [
        ("Make", "make"), ("Model", "model"), ("Trim", "trim"),
        ("Body Style", "body_style"), ("Exterior Color", "exterior_color"),
        ("Interior Color", "interior_color"), ("Transmission", "transmission"),
        ("Engine", "engine"), ("Mileage", "mileage_raw"),
        ("Stock #", "stock_number"), ("Drivetrain", "drivetrain"),
        ("VIN #", "vin"), ("VIN", "vin"),
    ]:
        if key in data:
            continue
        pat = re.compile(
            rf'<(?:span|td|div|dt)[^>]*>\s*{re.escape(field)}\s*:?\s*</(?:span|td|div|dt)>\s*'
            rf'<(?:span|td|div|dd)[^>]*>\s*(.*?)\s*</(?:span|td|div|dd)>',
            re.DOTALL | re.IGNORECASE,
        )
        m = pat.search(html_content)
        if m:
            val = extract_text(m.group(1)).strip()
            if val and val.lower() not in ("n/a", "call", ""):
                data[key] = val

    # ------------------------------------------------------------------
    # Parse numeric spec fields
    # ------------------------------------------------------------------

    # Horsepower
    if "horsepower_raw" in data:
        hp_num = re.search(r"([\d,]+)", data.pop("horsepower_raw"))
        if hp_num:
            data["horsepower"] = int(hp_num.group(1).replace(",", ""))
    if "horsepower" not in data:
        hp_match = re.search(r"(\d{3,4})\s*(?:hp|horsepower|bhp)", html_content, re.IGNORECASE)
        if hp_match:
            data["horsepower"] = int(hp_match.group(1))

    # 0-60
    if "zero_to_sixty_raw" in data:
        zt_num = re.search(r"([\d.]+)", data.pop("zero_to_sixty_raw"))
        if zt_num:
            data["zero_to_sixty"] = float(zt_num.group(1))
    if "zero_to_sixty" not in data:
        accel_match = re.search(
            r"0[-\u2013]60\s*(?:mph)?\s*(?:in)?\s*:?\s*([\d.]+)\s*(?:seconds?|sec|s)",
            html_content, re.IGNORECASE,
        )
        if accel_match:
            data["zero_to_sixty"] = float(accel_match.group(1))

    # Top speed
    if "top_speed_raw" in data:
        ts_num = re.search(r"(\d{2,3})", data.pop("top_speed_raw"))
        if ts_num:
            data["top_speed"] = int(ts_num.group(1))
    if "top_speed" not in data:
        speed_match = re.search(
            r"(?:top\s*speed|max\s*speed)\s*:?\s*(\d{2,3})\s*mph",
            html_content, re.IGNORECASE,
        )
        if speed_match:
            data["top_speed"] = int(speed_match.group(1))

    # Mileage
    if "mileage_raw" in data:
        mi_num = re.sub(r"[^\d]", "", data.pop("mileage_raw"))
        if mi_num:
            data["mileage"] = int(mi_num)

    # Seating (store as body_style note if no body_style)
    data.pop("seating_raw", None)
    data.pop("torque_raw", None)

    # ------------------------------------------------------------------
    # Price  (from table or text)
    # Dream Exotics uses: <td>24 Hrs</td><td>$XXXX $YYYY</td>
    # The last dollar amount in the 24-hr cell is the actual daily rate
    # ------------------------------------------------------------------
    _parse_price(data, html_content)

    # ------------------------------------------------------------------
    # Body style  (infer from title/slug if not explicitly stated)
    # ------------------------------------------------------------------
    if "body_style" not in data:
        data["body_style"] = _infer_body_style(data.get("title", ""), slug)

    # ------------------------------------------------------------------
    # Exterior color  (infer from slug/title parenthetical)
    # ------------------------------------------------------------------
    if "exterior_color" not in data:
        color = _infer_color(data.get("title", ""), slug)
        if color:
            data["exterior_color"] = color

    # ------------------------------------------------------------------
    # Description
    # ------------------------------------------------------------------
    _parse_description(data, html_content)

    # ------------------------------------------------------------------
    # Images
    # ------------------------------------------------------------------
    data["photo_urls"] = _parse_images(html_content)

    return data


def _parse_make_model(data, title_text, slug):
    """Derive make and model from the title or slug."""
    if not title_text:
        title_text = slug.replace("-", " ").title()

    # Strip leading year
    clean = re.sub(r"^\d{4}\s+", "", title_text).strip()

    for make in KNOWN_MAKES:
        if make.lower() in clean.lower():
            idx = clean.lower().index(make.lower())
            data["make"] = normalise_make(make)
            after = clean[idx + len(make):].strip()
            if after:
                # Remove colour parenthetical from model: "Urus (Black)" -> "Urus"
                model = re.sub(r"\s*\([^)]*\)\s*$", "", after).strip()
                if model:
                    data["model"] = model
            break

    # Fallback: try from slug  e.g. "ferrari-sf90-stradale"
    if "make" not in data:
        slug_clean = slug.replace("-", " ").title()
        for make in KNOWN_MAKES:
            if make.lower() in slug_clean.lower():
                data["make"] = normalise_make(make)
                idx = slug_clean.lower().index(make.lower())
                after = slug_clean[idx + len(make):].strip()
                # Remove common slug suffixes
                for suffix in ["Rental", "Exotic Rental", "Car Rental",
                               "Exotic Rental Car", "Renal Car"]:
                    if after.endswith(suffix):
                        after = after[: -len(suffix)].strip()
                if after:
                    model = re.sub(r"\s*\b(?:Black|White|Blue|Red|Yellow|Green|Orange|Silver|Purple)\b\s*$", "", after, flags=re.IGNORECASE).strip()
                    if model:
                        data["model"] = model
                break


def _parse_price(data, html_content):
    """Extract daily rental price from the page.

    Dream Exotics uses Bootstrap-style pricing cards:
      <div class="col-xs-3">24 Hrs</div>
      <div class="col-xs-4">
        <span class="price"><strike>3999</strike> <span class="red">$1988</span></span>
      </div>
    The discounted price (inside <span class="red">) is the actual daily rate.
    When there's no discount, the price span just contains the number directly.
    """
    # Pattern 1: Bootstrap col layout used by Dream Exotics
    # Match "24 Hrs" in a col div, then grab the price from the sibling col div
    col_pat = re.compile(
        r"24\s*Hrs?\s*\n?\s*</div>\s*<div[^>]*class=\"col-xs-\d+\"[^>]*>\s*(.*?)\s*</div>",
        re.DOTALL | re.IGNORECASE,
    )
    m = col_pat.search(html_content)
    if m:
        price_cell = m.group(1)
        # Prefer the discounted price inside <span class="red">
        red_match = re.search(r'class="red"[^>]*>\s*\$?\s*([\d,]+)', price_cell)
        if red_match:
            price_str = red_match.group(1).replace(",", "")
            if price_str.isdigit() and int(price_str) > 0:
                data["daily_rate"] = int(price_str)
                return
        # No discount marker — grab the last number in the cell
        amounts = re.findall(r"\$?\s*([\d,]+)", extract_text(price_cell))
        if amounts:
            price_str = amounts[-1].replace(",", "")
            if price_str.isdigit() and int(price_str) > 0:
                data["daily_rate"] = int(price_str)
                return

    # Pattern 2: table row with 24-hour pricing (fallback)
    td_pat = re.compile(
        r"24\s*(?:Hrs?|Hours?)\s*</td>\s*<td[^>]*>\s*(.*?)\s*</td>",
        re.DOTALL | re.IGNORECASE,
    )
    m = td_pat.search(html_content)
    if m:
        cell = m.group(1)
        amounts = re.findall(r"\$?\s*([\d,]+)", cell)
        if amounts:
            price_str = amounts[-1].replace(",", "")
            if price_str.isdigit() and int(price_str) > 0:
                data["daily_rate"] = int(price_str)
                return

    # Pattern 3: "24 Hours : $XXX" text pattern
    price_pat = re.search(
        r"24\s*(?:Hrs?|Hours?)\s*:?\s*\$?\s*([\d,]+)",
        html_content, re.IGNORECASE,
    )
    if price_pat:
        price_str = price_pat.group(1).replace(",", "")
        if price_str.isdigit() and int(price_str) > 0:
            data["daily_rate"] = int(price_str)
            return

    # Pattern 4: generic price on page
    generic = re.search(r"\$([\d,]+)\s*/\s*(?:day|24)", html_content, re.IGNORECASE)
    if generic:
        price_str = generic.group(1).replace(",", "")
        if price_str.isdigit() and int(price_str) > 0:
            data["daily_rate"] = int(price_str)


def _infer_body_style(title, slug):
    """Infer body style from title or slug keywords."""
    combined = (title + " " + slug).lower()
    if any(kw in combined for kw in ("spyder", "spider", "convertible", "dawn",
                                      "california", "gtc", "continental gtc")):
        return "Convertible"
    if any(kw in combined for kw in ("coupe", "gtb", "sto", "stradale",
                                      "superfast", "812", "revuelto", "r8",
                                      "huracan evo coupe", "gt coupe",
                                      "corvette", "wraith")):
        return "Coupe"
    if any(kw in combined for kw in ("urus", "cullinan", "bentayga", "escalade",
                                      "g63", "g-wagon", "gwagon", "levante",
                                      "suv", "hummer")):
        return "SUV"
    if any(kw in combined for kw in ("sedan", "s class", "s-class", "ghost")):
        return "Sedan"
    return None


def _infer_color(title, slug):
    """Infer exterior colour from parenthetical in title or trailing slug word."""
    # Parenthetical: "Urus (Black)"
    m = re.search(r"\((\w+)\)\s*$", title)
    if m:
        return m.group(1).title()

    # Trailing colour in slug: "lamborghini-urus-black"
    colours = [
        "black", "white", "blue", "red", "yellow", "green",
        "orange", "silver", "purple", "grey", "gray",
    ]
    last_word = slug.rstrip("/").split("-")[-1].lower()
    if last_word in colours:
        return last_word.title()

    return None


def _parse_description(data, html_content):
    """Extract description text from the page."""
    # Try multiple patterns for description containers
    desc_patterns = [
        r'<div[^>]*class="[^"]*(?:entry-content|description|vehicle-description|wpb_wrapper)[^"]*"[^>]*>(.*?)</div>',
        r'<div[^>]*class="[^"]*wp-block-group[^"]*"[^>]*>(.*?)</div>',
    ]
    for pat in desc_patterns:
        m = re.search(pat, html_content, re.DOTALL | re.IGNORECASE)
        if m:
            text = extract_text(m.group(1))
            if len(text) > 50:
                data["description"] = text[:2000]
                return

    # Fallback: find the longest <p> block that looks like a description
    paragraphs = re.findall(r"<p[^>]*>(.*?)</p>", html_content, re.DOTALL)
    best = ""
    for p in paragraphs:
        text = extract_text(p)
        # Skip very short or navigation-like text
        if len(text) > len(best) and len(text) > 80:
            # Skip if it looks like nav / footer text
            if not any(skip in text.lower() for skip in (
                "privacy policy", "terms of service", "cookie",
                "copyright", "all rights reserved",
            )):
                best = text
    if best:
        data["description"] = best[:2000]


def _parse_images(html_content):
    """Extract car photo URLs from the page."""
    image_urls = []

    # Skip known site assets
    SKIP_PATTERNS = [
        "logo", "favicon", "icon", "banner", "badge",
        "payment", "social", "footer", "header",
        "google", "facebook", "instagram", "twitter",
        "placeholder", "gravatar", "avatar", "spinner",
    ]

    # Pattern: wp-content/uploads images
    wp_matches = re.findall(
        r'(?:src|data-src|data-lazy-src|href)=["\']'
        r'(https?://[^"\']*wp-content/uploads/[^"\']*\.(?:jpg|jpeg|png|webp))'
        r'["\']',
        html_content, re.IGNORECASE,
    )

    for img_url in wp_matches:
        # Skip thumbnails and site assets
        if any(skip in img_url.lower() for skip in SKIP_PATTERNS):
            continue
        # Prefer larger images; skip tiny thumbnails
        if re.search(r"-\d{2,3}x\d{2,3}\.", img_url):
            # Very small thumbnails like 150x150, skip
            size_match = re.search(r"-(\d+)x(\d+)\.", img_url)
            if size_match:
                w, h = int(size_match.group(1)), int(size_match.group(2))
                if w < 300 or h < 200:
                    continue
        if img_url not in image_urls:
            image_urls.append(img_url)

    # Deduplicate: if we have both sized and unsized variants, prefer unsized
    # e.g. "image.jpg" vs "image-750x500.jpg" -- keep both, they may differ
    return image_urls[:50]  # Cap at 50 images


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
        f"{emoji} *Dream Exotics Scrape Complete*\n"
        f"*Cars:* {summary.get('cars_scraped', 0)} scraped\n"
        f"*Errors:* {summary.get('errors', 0)}\n"
        f"*Duration:* {summary.get('duration', '?')}s"
    )

    body = json.dumps({"text": text}).encode("utf-8")
    req = urllib.request.Request(
        webhook, data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        urllib.request.urlopen(req, timeout=10)
    except Exception as e:
        log.warning("Slack notification failed: %s", e)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Scrape Dream Exotics (dreamexoticrentalcars.com) car rental listings"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Scrape but don't write to database",
    )
    parser.add_argument(
        "--urls", nargs="+",
        help="Scrape specific URLs instead of discovering from sitemap",
    )
    parser.add_argument(
        "--limit", type=int, default=0,
        help="Max listings to scrape (0 = all)",
    )
    args = parser.parse_args()

    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")

    if not args.dry_run and (not supabase_url or not supabase_key):
        log.error("SUPABASE_URL and SUPABASE_SERVICE_KEY required (or use --dry-run)")
        sys.exit(1)

    start_time = time.time()
    summary = {"cars_scraped": 0, "errors": 0}

    # Discover or use provided URLs
    if args.urls:
        urls = [u.rstrip("/") + "/" for u in args.urls]
    else:
        urls = discover_listings_from_sitemap()

    if args.limit > 0:
        urls = urls[: args.limit]

    log.info("Scraping %d car listings...", len(urls))

    for i, url in enumerate(urls):
        log.info("[%d/%d] %s", i + 1, len(urls), url)

        html_content = fetch_page(url)
        if not html_content:
            summary["errors"] += 1
            continue

        try:
            data = parse_car_listing(url, html_content)
        except Exception as e:
            log.error("Parse error for %s: %s", url, e)
            summary["errors"] += 1
            continue

        log.info(
            "  Parsed: %s | %s %s | $%s/day | %d images",
            data.get("title", "?"),
            data.get("make", "?"),
            data.get("model", "?"),
            data.get("daily_rate", "?"),
            len(data.get("photo_urls", [])),
        )

        if not args.dry_run:
            status = supabase_upsert(supabase_url, supabase_key, "exotic_cars", data)
            if status in (200, 201):
                log.info("  Upserted to exotic_cars")
            else:
                log.error("  Upsert failed: HTTP %d", status)
                summary["errors"] += 1
        else:
            log.info("  [DRY RUN] Would upsert to exotic_cars:")
            for k in ("title", "make", "model", "year", "daily_rate",
                       "body_style", "exterior_color", "horsepower",
                       "zero_to_sixty", "top_speed", "engine",
                       "transmission", "drivetrain", "photo_urls"):
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
    log.info("  Cars: %d", summary["cars_scraped"])
    log.info("  Errors: %d", summary["errors"])
    log.info("  Duration: %ds", elapsed)
    log.info("=" * 60)

    send_slack_notification(summary)

    if summary["errors"] > 0 and summary["cars_scraped"] == 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
