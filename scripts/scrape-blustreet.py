#!/usr/bin/env python3
"""
Scrape BluStreet Exotic Car Rentals (blustreetexoticcarrentals.com) listings.

How it works:
  1. Fetches the fleet page to discover all vehicle listing URLs
  2. Also checks body-type category pages for any missed listings
  3. Fetches each vehicle detail page
  4. Parses structured data from the HTML (specs, price, images, description)
  5. Upserts into Supabase table: exotic_cars (source_provider="blustreet")

Usage:
  export SUPABASE_URL="https://your-project.supabase.co"
  export SUPABASE_SERVICE_KEY="your-service-role-key"

  # Scrape everything
  python3 scripts/scrape-blustreet.py

  # Dry run (scrape but don't write to database)
  python3 scripts/scrape-blustreet.py --dry-run

  # Limit number of listings
  python3 scripts/scrape-blustreet.py --limit 5

  # Scrape specific URLs
  python3 scripts/scrape-blustreet.py --urls https://www.blustreetexoticcarrentals.com/exotic-rentals/rent-ferrari-roma/
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

log = logging.getLogger("blustreet-scraper")
log.setLevel(logging.DEBUG)

_console = logging.StreamHandler(sys.stderr)
_console.setLevel(logging.INFO)
_console.setFormatter(logging.Formatter(LOG_FORMAT, datefmt=LOG_DATE_FORMAT))
log.addHandler(_console)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_URL = "https://www.blustreetexoticcarrentals.com"
FLEET_URL = f"{BASE_URL}/fleet/"
SOURCE_PROVIDER = "blustreet"
PHONE = "1-646-480-1680"
ADDRESS = "1065 Long Island Ave, Deer Park, NY 11729"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# Body-type category pages to check for additional listings
CATEGORY_PAGES = [
    f"{BASE_URL}/body-type/sports-cars/",
    f"{BASE_URL}/body-type/convertibles/",
    f"{BASE_URL}/body-type/luxury-sedans/",
    f"{BASE_URL}/body-type/luxury-suvs/",
]

# Rate limiting
REQUEST_DELAY = 1.5  # seconds between requests

# Known makes for parsing from URL slugs and titles
KNOWN_MAKES = [
    "Lamborghini", "Ferrari", "McLaren", "Maserati", "Rolls Royce", "Rolls-Royce",
    "Bentley", "Porsche", "Mercedes-Benz", "Mercedes Benz", "Mercedes Maybach",
    "Mercedes-AMG", "BMW", "Audi", "Cadillac", "Chevrolet", "Chevy",
    "Corvette", "Dodge", "Aston Martin", "Bugatti", "Tesla", "Range Rover",
    "Land Rover", "Jaguar", "GMC", "Lincoln", "Lexus", "Infiniti",
    "Alfa Romeo", "Genesis",
]

# Map slug prefixes to canonical make names
SLUG_MAKE_MAP = {
    "lamborghini": "Lamborghini",
    "ferrari": "Ferrari",
    "mclaren": "McLaren",
    "maserati": "Maserati",
    "rolls-royce": "Rolls Royce",
    "bentley": "Bentley",
    "porsche": "Porsche",
    "mercedes-benz": "Mercedes-Benz",
    "mercedes-maybach": "Mercedes-Benz",
    "bmw": "BMW",
    "audi": "Audi",
    "cadillac": "Cadillac",
    "chevrolet": "Chevrolet",
    "chevy": "Chevrolet",
    "corvette": "Chevrolet",
    "dodge": "Dodge",
    "aston-martin": "Aston Martin",
    "bugatti": "Bugatti",
    "tesla": "Tesla",
    "range-rover": "Range Rover",
    "land-rover": "Land Rover",
    "jaguar": "Jaguar",
    "gmc": "GMC",
    "lincoln": "Lincoln",
    "lexus": "Lexus",
    "infiniti": "Infiniti",
    "alfa-romeo": "Alfa Romeo",
    "genesis": "Genesis",
}

# Map slug prefixes to model prefix (when make != model start)
SLUG_MODEL_PREFIX = {
    "corvette": "Corvette",
    "mercedes-maybach": "Maybach",
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
# Listing discovery
# ---------------------------------------------------------------------------

def discover_listing_urls(html_content):
    """Extract all /exotic-rentals/ URLs from a page."""
    matches = re.findall(
        r'href=["\'](' + re.escape(BASE_URL) + r'/exotic-rentals/[^"\'#]+)["\']',
        html_content
    )
    # Also match relative URLs
    rel_matches = re.findall(
        r'href=["\'](/exotic-rentals/[^"\'#]+)["\']',
        html_content
    )
    all_urls = []
    for u in matches:
        all_urls.append(u.rstrip("/") + "/")
    for u in rel_matches:
        all_urls.append(BASE_URL + u.rstrip("/") + "/")

    # Deduplicate preserving order
    seen = set()
    unique = []
    for u in all_urls:
        if u not in seen:
            seen.add(u)
            unique.append(u)
    return unique


def discover_all_listings():
    """Discover all vehicle listing URLs from fleet and category pages."""
    all_urls = set()

    # Fetch the main fleet page
    log.info("Fetching fleet page: %s", FLEET_URL)
    content = fetch_page(FLEET_URL)
    if content:
        urls = discover_listing_urls(content)
        log.info("Found %d listings on fleet page", len(urls))
        all_urls.update(urls)
    else:
        log.warning("Failed to fetch fleet page")

    time.sleep(REQUEST_DELAY)

    # Fetch category pages for any missed listings
    for cat_url in CATEGORY_PAGES:
        log.info("Fetching category page: %s", cat_url)
        content = fetch_page(cat_url)
        if content:
            urls = discover_listing_urls(content)
            new_count = len([u for u in urls if u not in all_urls])
            if new_count:
                log.info("Found %d new listings on %s", new_count, cat_url)
            all_urls.update(urls)
        time.sleep(REQUEST_DELAY)

    result = sorted(all_urls)
    log.info("Total unique listings discovered: %d", len(result))
    return result


# ---------------------------------------------------------------------------
# Slug parser — extract make/model from URL slug
# ---------------------------------------------------------------------------

def parse_slug(slug):
    """Parse the URL slug to extract make and model.

    Slugs look like: rent-ferrari-roma, rent-lamborghini-urus-bronze,
    rent-mercedes-benz-amg-g63-blue, rent-corvette-c8-e-ray-convertible-white
    """
    # Remove the "rent-" prefix
    name = slug
    if name.startswith("rent-"):
        name = name[5:]

    make = None
    model = None

    # Try matching against known make slug prefixes (longest first)
    sorted_prefixes = sorted(SLUG_MAKE_MAP.keys(), key=len, reverse=True)
    for prefix in sorted_prefixes:
        if name.startswith(prefix + "-") or name == prefix:
            make = SLUG_MAKE_MAP[prefix]
            remainder = name[len(prefix):].lstrip("-")
            # Some slugs need a model prefix (e.g., "corvette" -> make=Chevrolet, model starts with "Corvette")
            model_prefix = SLUG_MODEL_PREFIX.get(prefix, "")
            if remainder:
                model_parts = remainder.replace("-", " ").title()
                if model_prefix:
                    model = f"{model_prefix} {model_parts}"
                else:
                    model = model_parts
            elif model_prefix:
                model = model_prefix
            break

    if not make:
        # Fallback: assume first word is make
        parts = name.split("-")
        if parts:
            make = parts[0].title()
            if len(parts) > 1:
                model = " ".join(parts[1:]).title()

    return make, model


# ---------------------------------------------------------------------------
# Car detail page parser
# ---------------------------------------------------------------------------

def parse_car_listing(url, html_content):
    """Parse an exotic car listing page and return structured data."""
    now = datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%dT%H:%M:%SZ")

    data = {
        "source_provider": SOURCE_PROVIDER,
        "source_url": url,
        "source_listing_id": url.rstrip("/").split("/")[-1],
        "city": "New York",
        "region": "NY",
        "contact_phone": PHONE,
        "contact_address": ADDRESS,
        "is_active": True,
        "scrape_status": "scraped",
        "last_scraped_at": now,
    }

    slug = url.rstrip("/").split("/")[-1]

    # --- Title from <title> tag ---
    # Formats seen:
    #   "Rent a Ferrari Roma in New York | BluStreet"
    #   "Lamborghini Huracan Evo Coupe | BluStreet NY"
    #   "Rolls Royce Ghost - BluStreet Exotic Car Rentals"
    #   "Download GMC Yukon Grill Wallpaper - BluStreet Exotic Car Rentals"
    title_tag_match = re.search(r"<title>(.*?)</title>", html_content, re.DOTALL)
    if title_tag_match:
        raw_title = extract_text(title_tag_match.group(1)).strip()
        # Try pattern: "Rent a {Car Name} in New York | BluStreet"
        car_name_match = re.match(r"Rent\s+(?:a|an)\s+(.+?)\s+in\s+New\s+York", raw_title, re.IGNORECASE)
        if car_name_match:
            data["title"] = car_name_match.group(1).strip()
        else:
            # Strip suffixes: " | BluStreet...", " - BluStreet..."
            cleaned = re.sub(r"\s*[\|\-]\s*BluStreet.*$", "", raw_title, flags=re.IGNORECASE).strip()
            # Also strip "Rent a/an " prefix and "Download " prefix
            cleaned = re.sub(r"^(?:Rent\s+(?:a|an)\s+|Download\s+)", "", cleaned, flags=re.IGNORECASE).strip()
            if cleaned:
                data["title"] = cleaned

    # --- Make from <h2> tag (brand heading on detail page) ---
    # Some pages have a standalone <h2>Ferrari</h2> or <h2>BMW</h2> as brand heading.
    # We check ALL h2 tags and match against known makes.
    known_makes_lower = {m.lower().replace("-", " "): m for m in KNOWN_MAKES}
    h2_matches = re.findall(r"<h2[^>]*>\s*(.*?)\s*</h2>", html_content, re.DOTALL)
    for h2_raw in h2_matches:
        h2_text = extract_text(h2_raw).strip()
        h2_normalized = h2_text.lower().replace("-", " ")
        if h2_normalized in known_makes_lower:
            data["make"] = h2_text
            break

    # --- Make from brand logo alt text ---
    # Pattern: <img alt="Ferrari" src="...ferrari.webp">
    if "make" not in data:
        brand_img_match = re.search(
            r'<img[^>]*alt="([^"]+)"[^>]*src="[^"]*wp-content/uploads/[^"]*\.webp"',
            html_content
        )
        if brand_img_match:
            alt_text = brand_img_match.group(1).strip()
            if alt_text.lower().replace("-", " ") in known_makes_lower:
                data["make"] = alt_text

    # --- Make from <title> tag ---
    # Format: "Rent a Ferrari Roma in New York | BluStreet"
    if "make" not in data and "title" in data:
        for make_lower, make_canonical in sorted(known_makes_lower.items(), key=lambda x: len(x[0]), reverse=True):
            if make_lower in data["title"].lower().replace("-", " "):
                data["make"] = make_canonical
                break

    # --- H1 contains model info ---
    # Format: "Roma Rental" or "Huracan Evo Coupe Rental" or "1954 Cadillac Series 62 Coupe Rental"
    h1_match = re.search(r"<h1[^>]*>(.*?)</h1>", html_content, re.DOTALL)
    if h1_match:
        h1_text = extract_text(h1_match.group(1)).strip()
        # Strip " Rental" suffix to get model name
        model_from_h1 = re.sub(r"\s+Rental\s*$", "", h1_text, flags=re.IGNORECASE).strip()
        if model_from_h1:
            # Extract year if present at start (e.g., "1954 Cadillac Series 62 Coupe")
            year_match = re.match(r"^(\d{4})\s+", model_from_h1)
            if year_match:
                data["year"] = int(year_match.group(1))
                model_from_h1 = model_from_h1[len(year_match.group(0)):].strip()

            # Strip make name from start of model if redundant
            if "make" in data:
                make_lower = data["make"].lower().replace("-", " ")
                model_lower = model_from_h1.lower().replace("-", " ")
                if model_lower.startswith(make_lower):
                    model_from_h1 = model_from_h1[len(data["make"]):].strip()

            if model_from_h1:
                data["model"] = model_from_h1

    # --- Fallback: parse make/model from slug ---
    slug_make, slug_model = parse_slug(slug)
    if "make" not in data and slug_make:
        data["make"] = slug_make
    if "model" not in data and slug_model:
        data["model"] = slug_model

    # --- Build title if not extracted ---
    if "title" not in data:
        parts = []
        if "make" in data:
            parts.append(data["make"])
        if "model" in data:
            parts.append(data["model"])
        data["title"] = " ".join(parts) if parts else slug.replace("-", " ").title()

    # --- Ensure title includes make ---
    # If title was extracted from <title> tag and already has make, great.
    # Otherwise, prepend make to model-only title.
    if "title" in data and "make" in data:
        title_lower = data["title"].lower().replace("-", " ")
        make_lower = data["make"].lower().replace("-", " ")
        if make_lower not in title_lower:
            data["title"] = f"{data['make']} {data['title']}"

    # --- Spec items: <div class="spec-item"> pairs ---
    # Pattern: <div class="spec-value">VALUE</div><div class="spec-label">LABEL</div>
    # Note: some pages may swap label/value order
    spec_pairs = re.findall(
        r'<div[^>]*class="[^"]*spec-value[^"]*"[^>]*>\s*(.*?)\s*</div>\s*'
        r'<div[^>]*class="[^"]*spec-label[^"]*"[^>]*>\s*(.*?)\s*</div>',
        html_content, re.DOTALL | re.IGNORECASE
    )
    # Also check reversed order (label first, then value)
    spec_pairs_rev = re.findall(
        r'<div[^>]*class="[^"]*spec-label[^"]*"[^>]*>\s*(.*?)\s*</div>\s*'
        r'<div[^>]*class="[^"]*spec-value[^"]*"[^>]*>\s*(.*?)\s*</div>',
        html_content, re.DOTALL | re.IGNORECASE
    )

    specs = {}
    for value, label in spec_pairs:
        v = extract_text(value).strip()
        l = extract_text(label).strip()
        specs[l.lower()] = v
    for label, value in spec_pairs_rev:
        l = extract_text(label).strip()
        v = extract_text(value).strip()
        if l.lower() not in specs:
            specs[l.lower()] = v

    # Map spec labels to data fields
    if "horsepower" in specs:
        hp_str = re.sub(r"[^\d]", "", specs["horsepower"])
        if hp_str:
            data["horsepower"] = int(hp_str)

    if "engine" in specs:
        data["engine"] = specs["engine"]

    if "body type" in specs:
        data["body_style"] = specs["body type"]

    if "doors" in specs:
        data["trim"] = specs["doors"]  # e.g., "2-Door", "4-Door"

    if "transmission" in specs:
        data["transmission"] = specs["transmission"]

    if "drivetrain" in specs:
        data["drivetrain"] = specs["drivetrain"]

    # --- Price ---
    # Primary: look for hero-car-price-value class (most reliable)
    # Pattern: <div class="hero-car-price-value">$1,900</div>
    hero_price_match = re.search(
        r'class="[^"]*hero-car-price-value[^"]*"[^>]*>\s*\$\s*([\d,]+)',
        html_content, re.IGNORECASE
    )
    if hero_price_match:
        price_str = hero_price_match.group(1).replace(",", "")
        if price_str.isdigit():
            data["daily_rate"] = int(price_str)

    # Fallback: look for price-value or price-amount class
    if "daily_rate" not in data:
        price_class_match = re.search(
            r'class="[^"]*price-(?:value|amount)[^"]*"[^>]*>\s*\$\s*([\d,]+)',
            html_content, re.IGNORECASE
        )
        if price_class_match:
            price_str = price_class_match.group(1).replace(",", "")
            if price_str.isdigit():
                data["daily_rate"] = int(price_str)

    # Fallback: generic "$X,XXX / day" but only before similar vehicles section
    if "daily_rate" not in data:
        # Search only in the first portion of the page (before "Similar Vehicles")
        cutoff = html_content.find("Similar Vehicles")
        search_content = html_content[:cutoff] if cutoff > 0 else html_content[:len(html_content) // 2]
        price_match = re.search(
            r'\$\s*([\d,]+)\s*/?\s*day',
            search_content, re.IGNORECASE
        )
        if price_match:
            price_str = price_match.group(1).replace(",", "")
            if price_str.isdigit():
                data["daily_rate"] = int(price_str)

    # --- Horsepower from description text (fallback) ---
    if "horsepower" not in data:
        hp_match = re.search(r'(\d{3,4})\s*(?:hp|horsepower|bhp)', html_content, re.IGNORECASE)
        if hp_match:
            data["horsepower"] = int(hp_match.group(1))

    # --- 0-60 ---
    accel_match = re.search(
        r'0[-\u2013]60\s*(?:mph)?\s*(?:in)?\s*([\d.]+)\s*(?:seconds?|sec|s\b)',
        html_content, re.IGNORECASE
    )
    if accel_match:
        data["zero_to_sixty"] = float(accel_match.group(1))

    # --- Top speed ---
    speed_match = re.search(
        r'(?:top speed|max speed)[:\s]*([\d]{3})\s*mph',
        html_content, re.IGNORECASE
    )
    if speed_match:
        data["top_speed"] = int(speed_match.group(1))

    # --- Exterior color from title or slug ---
    # Many BluStreet listings include color in the name, e.g. "Urus Bronze", "G63 Blue"
    color_keywords = [
        "black", "white", "red", "blue", "green", "gray", "grey", "silver",
        "bronze", "gold", "yellow", "orange", "purple", "brown", "beige",
        "two tone", "two-tone", "frozen", "ruby", "matte",
    ]
    title_lower = data.get("title", "").lower()
    for color in color_keywords:
        if color in title_lower:
            data["exterior_color"] = color.title()
            break

    # --- Description ---
    # Look for about-vehicle section or entry-content
    desc_patterns = [
        r'<section[^>]*class="[^"]*about-vehicle[^"]*"[^>]*>(.*?)</section>',
        r'<div[^>]*class="[^"]*about-vehicle[^"]*"[^>]*>(.*?)</div>',
        r'<div[^>]*class="[^"]*vehicle-description[^"]*"[^>]*>(.*?)</div>',
        r'<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>(.*?)</div>',
    ]
    for pat in desc_patterns:
        desc_match = re.search(pat, html_content, re.DOTALL | re.IGNORECASE)
        if desc_match:
            text = extract_text(desc_match.group(1))
            if len(text) > 50:
                data["description"] = text[:2000]
                break

    # Fallback: look for multiple <p> tags after the specs
    if "description" not in data:
        # Grab all paragraph text from the page body
        paragraphs = re.findall(r'<p[^>]*>(.*?)</p>', html_content, re.DOTALL)
        desc_parts = []
        for p in paragraphs:
            text = extract_text(p).strip()
            # Filter out short or navigation-like text
            if len(text) > 80 and "cookie" not in text.lower() and "privacy" not in text.lower():
                desc_parts.append(text)
        if desc_parts:
            data["description"] = " ".join(desc_parts[:5])[:2000]

    # --- Images ---
    image_urls = []
    SKIP_IMAGES = {"logo.svg", "logo.png", "favicon", "site-logo", "/themes/"}

    # Pattern 1: wp-content/uploads images (primary)
    img_matches = re.findall(
        r'(?:src|data-src|data-lazy-src)=["\']'
        r'((?:https?://)?[^"\']*wp-content/uploads/[^"\']*\.(?:jpg|jpeg|png|webp))'
        r'["\']',
        html_content, re.IGNORECASE
    )
    for img_url in img_matches:
        full_url = img_url if img_url.startswith("http") else BASE_URL + img_url

        # Skip logos, thumbnails, and brand icons
        if any(skip in full_url.lower() for skip in SKIP_IMAGES):
            continue

        # Skip tiny thumbnails (150x150) — prefer full/medium sizes
        if "150x150" in full_url:
            continue

        # Deduplicate
        if full_url not in image_urls:
            image_urls.append(full_url)

    # If we only found 640x400 sized images, also try getting the original (strip size suffix)
    originals = []
    for img in image_urls:
        # Convert "filename-640x400.webp" -> "filename.webp"
        original = re.sub(r'-\d+x\d+\.', '.', img)
        if original != img and original not in image_urls and original not in originals:
            originals.append(original)

    # Prepend originals (better quality)
    if originals:
        image_urls = originals + image_urls

    data["photo_urls"] = image_urls[:50]  # Cap at 50 images

    # --- JSON-LD structured data (supplementary) ---
    ld_matches = re.findall(
        r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',
        html_content, re.DOTALL
    )
    for ld_raw in ld_matches:
        try:
            ld = json.loads(ld_raw)
            # Handle @graph array
            items = ld.get("@graph", [ld]) if isinstance(ld, dict) else [ld]
            for item in items:
                if not isinstance(item, dict):
                    continue
                # Extract any useful vehicle data
                if "telephone" in item and "contact_phone" not in data:
                    data["contact_phone"] = item["telephone"]
                if "address" in item and isinstance(item["address"], dict):
                    addr = item["address"]
                    full_addr = ", ".join(filter(None, [
                        addr.get("streetAddress", ""),
                        addr.get("addressLocality", ""),
                        addr.get("addressRegion", ""),
                        addr.get("postalCode", ""),
                    ]))
                    if full_addr:
                        data["contact_address"] = full_addr
        except (json.JSONDecodeError, AttributeError):
            continue

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
        f"{emoji} *BluStreet Scrape Complete*\n"
        f"*Cars scraped:* {summary.get('cars_scraped', 0)}\n"
        f"*Cars upserted:* {summary.get('cars_upserted', 0)}\n"
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
    parser = argparse.ArgumentParser(description="Scrape BluStreet Exotic Car Rentals listings")
    parser.add_argument("--dry-run", action="store_true", help="Scrape but don't write to database")
    parser.add_argument("--urls", nargs="+", help="Scrape specific URLs instead of discovering")
    parser.add_argument("--limit", type=int, default=0, help="Max listings to scrape (0=all)")
    args = parser.parse_args()

    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")

    if not args.dry_run and (not supabase_url or not supabase_key):
        log.error("SUPABASE_URL and SUPABASE_SERVICE_KEY required (or use --dry-run)")
        sys.exit(1)

    start_time = time.time()
    summary = {"cars_scraped": 0, "cars_upserted": 0, "errors": 0}

    # Discover or use provided URLs
    if args.urls:
        listing_urls = args.urls
        log.info("Using %d provided URLs", len(listing_urls))
    else:
        listing_urls = discover_all_listings()

    if args.limit > 0:
        listing_urls = listing_urls[:args.limit]

    log.info("Scraping %d BluStreet listings...", len(listing_urls))

    for i, url in enumerate(listing_urls):
        log.info("[%d/%d] %s", i + 1, len(listing_urls), url)

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

        summary["cars_scraped"] += 1

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
            for k in ("title", "make", "model", "body_style", "daily_rate",
                       "horsepower", "engine", "exterior_color", "photo_urls"):
                if k in data:
                    val = data[k]
                    if k == "photo_urls":
                        val = f"{len(val)} images"
                    log.info("    %s: %s", k, val)

        # Rate limit
        if i < len(listing_urls) - 1:
            time.sleep(REQUEST_DELAY)

    elapsed = round(time.time() - start_time)
    summary["duration"] = elapsed

    log.info("=" * 60)
    log.info("SCRAPE COMPLETE")
    log.info("  Cars scraped: %d", summary["cars_scraped"])
    log.info("  Cars upserted: %d", summary["cars_upserted"])
    log.info("  Errors: %d", summary["errors"])
    log.info("  Duration: %ds", elapsed)
    log.info("=" * 60)

    send_slack_notification(summary)

    # Exit with error code if there were failures
    if summary["errors"] > 0 and summary["cars_scraped"] == 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
