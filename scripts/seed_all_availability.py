#!/usr/bin/env python3
"""
Seed the listing_availability table with availability data for ALL active
listings across all 6 marketplace tables.

Generates availability rows for April 7 - May 31, 2026 (55 days) per listing,
skipping any listing that already has rows in listing_availability.

Status distribution per listing (~deterministic via hash seeding):
  - ~85% available
  - ~8% booked
  - ~5% blocked_manual (with realistic notes)
  - ~2% blocked_maintenance (with realistic notes)

Usage:
  export SUPABASE_URL="https://msiljtrmujznyuocytzq.supabase.co"
  export SUPABASE_SERVICE_KEY="<service role key>"

  python3 scripts/seed_all_availability.py
  python3 scripts/seed_all_availability.py --dry-run
"""

import datetime
import hashlib
import json
import logging
import os
import sys
import urllib.request
import urllib.error

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

LOG_FORMAT = "%(asctime)s [%(levelname)s] %(message)s"
LOG_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

log = logging.getLogger("seed-all-availability")
log.setLevel(logging.DEBUG)

_console = logging.StreamHandler(sys.stderr)
_console.setLevel(logging.INFO)
_console.setFormatter(logging.Formatter(LOG_FORMAT, datefmt=LOG_DATE_FORMAT))
log.addHandler(_console)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DATE_START = datetime.date(2026, 4, 7)
DATE_END = datetime.date(2026, 5, 31)
BATCH_SIZE = 200

TABLES = [
    ("boats", {"is_active": "eq.true"}),
    ("partner_yachts", {"is_active": "eq.true"}),
    ("exotic_cars", {"is_active": "eq.true"}),
    ("mansions", {"is_active": "eq.true"}),
    ("airbnb_stays", {"is_active": "eq.true"}),
    ("airbnb_experiences", {"is_active": "eq.true"}),
]

# Realistic notes for blocked_manual status
BLOCKED_MANUAL_NOTES = [
    "Owner private event",
    "VIP private charter - pre-arranged",
    "Corporate retreat reserved",
    "Owner family vacation",
    "Exclusive photo shoot booking",
    "Private party - owner guest list",
    "Celebrity booking - NDA required",
    "Charity gala event",
    "Owner business meeting",
    "Film production shoot",
    "Wedding anniversary celebration",
    "Investor demo day",
    "Fashion show prep",
    "Brand partnership activation",
    "Influencer content day",
]

# Realistic notes for blocked_maintenance status
BLOCKED_MAINTENANCE_NOTES = [
    "Scheduled engine service & oil change",
    "Hull cleaning & bottom paint",
    "Annual safety inspection",
    "Interior deep clean & detailing",
    "Electronics system upgrade",
    "HVAC maintenance & filter replacement",
    "Upholstery repair & conditioning",
    "Navigation equipment calibration",
    "Full mechanical inspection",
    "Exterior wash & wax detail",
    "Brake system service",
    "Tire rotation & alignment check",
    "Paint touch-up & clear coat",
    "Plumbing & water system flush",
    "Generator service & load test",
]


# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------

def supabase_request(base_url, key, path, method="GET", body=None, params=None):
    """Make an authenticated request to Supabase REST API."""
    url = f"{base_url}/rest/v1/{path}"
    if params:
        qs = "&".join(f"{k}={v}" for k, v in params.items())
        url = f"{url}?{qs}"

    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            resp_body = resp.read().decode("utf-8")
            if resp_body:
                return json.loads(resp_body)
            return None
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8") if e.fp else ""
        log.error("HTTP %d on %s %s: %s", e.code, method, url, error_body)
        raise


def fetch_all_ids_from_table(base_url, key, table, filters):
    """Fetch all listing IDs from a table, handling pagination (1000 row limit)."""
    all_ids = []
    offset = 0
    page_size = 1000

    while True:
        params = {
            "select": "id",
            "limit": str(page_size),
            "offset": str(offset),
        }
        params.update(filters)

        try:
            rows = supabase_request(base_url, key, table, params=params)
        except urllib.error.HTTPError as e:
            log.warning("Skipping table %s -- query failed (HTTP %d)", table, e.code)
            return all_ids

        if not rows:
            break

        all_ids.extend(r["id"] for r in rows)

        if len(rows) < page_size:
            break
        offset += page_size

    return all_ids


def fetch_existing_listing_ids(base_url, key):
    """Fetch distinct listing_ids that already have ANY rows in listing_availability.

    We check ALL rows (not just source=seed) because the unique constraint
    uq_listing_date is on (listing_id, date) regardless of source.
    """
    existing = set()
    offset = 0
    page_size = 1000

    while True:
        params = {
            "select": "listing_id",
            "limit": str(page_size),
            "offset": str(offset),
        }

        try:
            rows = supabase_request(base_url, key, "listing_availability", params=params)
        except urllib.error.HTTPError as e:
            log.warning("Could not query listing_availability (HTTP %d) -- will insert all", e.code)
            return existing

        if not rows:
            break

        for r in rows:
            existing.add(r["listing_id"])

        if len(rows) < page_size:
            break
        offset += page_size

    return existing


# ---------------------------------------------------------------------------
# Deterministic status generation
# ---------------------------------------------------------------------------

def _hash_seed(listing_id, date_str):
    """Create a deterministic integer from listing_id + date for reproducibility."""
    h = hashlib.md5(f"{listing_id}:{date_str}".encode()).hexdigest()
    return int(h, 16)


def determine_status_and_notes(listing_id, date):
    """Deterministically assign a status and notes for a listing+date pair.

    Distribution: ~85% available, ~8% booked, ~5% blocked_manual, ~2% blocked_maintenance
    """
    seed = _hash_seed(listing_id, date.isoformat())
    bucket = seed % 100  # 0-99

    if bucket < 85:
        return "available", None
    elif bucket < 93:  # 85-92 = 8%
        return "booked", None
    elif bucket < 98:  # 93-97 = 5%
        note_idx = seed % len(BLOCKED_MANUAL_NOTES)
        return "blocked_manual", BLOCKED_MANUAL_NOTES[note_idx]
    else:  # 98-99 = 2%
        note_idx = seed % len(BLOCKED_MAINTENANCE_NOTES)
        return "blocked_maintenance", BLOCKED_MAINTENANCE_NOTES[note_idx]


def generate_rows(listing_id):
    """Generate availability rows for a single listing across the date range.

    CRITICAL: Every row has the exact same set of keys to satisfy PostgREST
    batch insert requirement. Fields not applicable are set to None (JSON null).
    """
    rows = []
    current = DATE_START
    while current <= DATE_END:
        status, notes = determine_status_and_notes(listing_id, current)
        row = {
            "listing_id": listing_id,
            "date": current.isoformat(),
            "start_time": None,
            "end_time": None,
            "status": status,
            "experience_id": None,
            "notes": notes,
            "recurrence_rule": None,
            "source": "seed",
            "source_connection_id": None,
        }
        rows.append(row)
        current += datetime.timedelta(days=1)
    return rows


def upsert_rows(base_url, key, rows, dry_run=False):
    """Insert rows into listing_availability in batches, ignoring duplicates.

    Uses PostgREST upsert with on_conflict=listing_id,date and
    resolution=ignore-duplicates so already-existing rows are silently skipped.
    """
    total = len(rows)
    inserted = 0

    url = f"{base_url}/rest/v1/listing_availability?on_conflict=listing_id,date"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal,resolution=ignore-duplicates",
    }

    for i in range(0, total, BATCH_SIZE):
        batch = rows[i : i + BATCH_SIZE]
        batch_end = min(i + BATCH_SIZE, total)
        if dry_run:
            log.info("[DRY RUN] Would insert batch %d-%d of %d rows",
                     i + 1, batch_end, total)
        else:
            if (i // BATCH_SIZE) % 50 == 0 or batch_end == total:
                log.info("Inserting batch %d-%d of %d rows...",
                         i + 1, batch_end, total)
            data = json.dumps(batch).encode("utf-8")
            req = urllib.request.Request(url, data=data, headers=headers, method="POST")
            try:
                with urllib.request.urlopen(req) as resp:
                    resp.read()
            except urllib.error.HTTPError as e:
                error_body = e.read().decode("utf-8") if e.fp else ""
                log.error("HTTP %d inserting batch %d-%d: %s",
                          e.code, i + 1, batch_end, error_body)
                raise
        inserted += len(batch)

    return inserted


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Seed listing_availability for ALL active listings")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print what would be inserted without writing")
    args = parser.parse_args()

    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY", "")

    if not supabase_url or not supabase_key:
        log.error("SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables are required")
        sys.exit(1)

    log.info("=== Seed ALL Listing Availability ===")
    log.info("Date range: %s to %s", DATE_START, DATE_END)
    num_days = (DATE_END - DATE_START).days + 1
    log.info("Days per listing: %d", num_days)
    if args.dry_run:
        log.info("DRY RUN mode -- no data will be written")

    # -----------------------------------------------------------------------
    # 1. Fetch listing IDs from all 6 tables
    # -----------------------------------------------------------------------

    all_listing_ids = []
    table_counts = {}

    for table, filters in TABLES:
        log.info("Fetching active listings from %s...", table)
        ids = fetch_all_ids_from_table(supabase_url, supabase_key, table, filters)
        log.info("  Found %d active listings in %s", len(ids), table)
        table_counts[table] = len(ids)
        all_listing_ids.extend(ids)

    log.info("Total active listings across all tables: %d", len(all_listing_ids))

    if not all_listing_ids:
        log.error("No active listings found -- nothing to seed")
        sys.exit(1)

    # -----------------------------------------------------------------------
    # 2. Check which listings already have availability (skip duplicates)
    # -----------------------------------------------------------------------

    log.info("Checking for listings that already have availability rows...")
    existing_ids = fetch_existing_listing_ids(supabase_url, supabase_key)
    log.info("Found %d listings that already have availability data", len(existing_ids))

    new_listing_ids = [lid for lid in all_listing_ids if lid not in existing_ids]
    skipped = len(all_listing_ids) - len(new_listing_ids)
    log.info("Listings to seed: %d (skipping %d already seeded)", len(new_listing_ids), skipped)

    if not new_listing_ids:
        log.info("All listings already have availability -- nothing to do!")
        return

    # -----------------------------------------------------------------------
    # 3. Generate availability rows
    # -----------------------------------------------------------------------

    all_rows = []
    for listing_id in new_listing_ids:
        rows = generate_rows(listing_id)
        all_rows.extend(rows)

    log.info("Generated %d availability rows for %d listings", len(all_rows), len(new_listing_ids))

    # Sanity check: every row must have the exact same set of keys
    expected_keys = sorted(all_rows[0].keys())
    for i, row in enumerate(all_rows):
        if sorted(row.keys()) != expected_keys:
            log.error("Row %d has mismatched keys: %s (expected %s)",
                      i, sorted(row.keys()), expected_keys)
            sys.exit(1)
    log.info("Key consistency check passed (%d keys per row: %s)",
             len(expected_keys), ", ".join(expected_keys))

    # -----------------------------------------------------------------------
    # 4. Insert into Supabase
    # -----------------------------------------------------------------------

    inserted = upsert_rows(supabase_url, supabase_key, all_rows, dry_run=args.dry_run)

    # -----------------------------------------------------------------------
    # 5. Summary
    # -----------------------------------------------------------------------

    log.info("=" * 60)
    log.info("SUMMARY")
    log.info("=" * 60)
    log.info("Tables queried:")
    for table, count in table_counts.items():
        log.info("  %-25s %d active listings", table, count)
    log.info("Total active listings:     %d", len(all_listing_ids))
    log.info("Already seeded (skipped):  %d", skipped)
    log.info("Newly seeded:              %d", len(new_listing_ids))
    log.info("Total rows inserted:       %d", inserted)

    status_counts = {}
    for row in all_rows:
        status_counts[row["status"]] = status_counts.get(row["status"], 0) + 1
    log.info("Status breakdown:")
    for status, count in sorted(status_counts.items()):
        pct = 100.0 * count / len(all_rows)
        log.info("  %-25s %5d  (%.1f%%)", status, count, pct)


if __name__ == "__main__":
    main()
