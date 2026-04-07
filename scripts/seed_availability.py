#!/usr/bin/env python3
"""
Seed the listing_availability table with sample availability data
for LEM (Luxury Experience Miami) and MVP Miami partner listings.

Generates availability rows for April 7 - May 31, 2026 with a mix of:
  - available (most dates)
  - booked (scattered weekends)
  - blocked_manual (owner events)
  - blocked_maintenance (service windows)

Usage:
  export SUPABASE_URL="https://msiljtrmujznyuocytzq.supabase.co"
  export SUPABASE_SERVICE_KEY="<service role key>"

  python3 scripts/seed_availability.py
  python3 scripts/seed_availability.py --dry-run
"""

import datetime
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

log = logging.getLogger("seed-availability")
log.setLevel(logging.DEBUG)

_console = logging.StreamHandler(sys.stderr)
_console.setLevel(logging.INFO)
_console.setFormatter(logging.Formatter(LOG_FORMAT, datefmt=LOG_DATE_FORMAT))
log.addHandler(_console)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

LEM_PROFILE_ID = "3e4ff73e-7101-4573-a32b-e3d449651fc8"
MVP_PROFILE_ID = "f7b33343-ea15-48a0-acdf-68634cff911e"

DATE_START = datetime.date(2026, 4, 7)
DATE_END = datetime.date(2026, 5, 31)

BATCH_SIZE = 100

# Dates that should be "booked"
BOOKED_DATES = {
    datetime.date(2026, 4, 12),
    datetime.date(2026, 4, 13),
    datetime.date(2026, 4, 19),
    datetime.date(2026, 4, 20),
    datetime.date(2026, 5, 3),
    datetime.date(2026, 5, 4),
    datetime.date(2026, 5, 16),
    datetime.date(2026, 5, 17),
}

# Dates blocked manually (owner events) -- with notes
BLOCKED_MANUAL_DATES = {
    datetime.date(2026, 4, 25): "Owner family reunion",
    datetime.date(2026, 4, 26): "Owner family reunion",
    datetime.date(2026, 5, 9): "Car show display - Miami Auto Week",
    datetime.date(2026, 5, 10): "Car show display - Miami Auto Week",
    datetime.date(2026, 5, 23): "Memorial Day Weekend - private charter",
    datetime.date(2026, 5, 24): "Memorial Day Weekend - private charter",
    datetime.date(2026, 5, 25): "Memorial Day Weekend - private charter",
}

# Dates blocked for maintenance -- with notes
BLOCKED_MAINTENANCE_DATES = {
    datetime.date(2026, 4, 15): "Engine service & oil change",
    datetime.date(2026, 4, 28): "Hull cleaning & bottom paint",
    datetime.date(2026, 5, 6): "Annual Coast Guard inspection",
    datetime.date(2026, 5, 20): "Detailing & interior deep clean",
}


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


def fetch_listing_ids(base_url, key, table, filters, id_column="id"):
    """Fetch listing IDs from a table with arbitrary filters.

    Args:
        filters: dict of PostgREST filter params, e.g. {"owner_id": "eq.xxx", "is_active": "eq.true"}
    """
    params = {"select": id_column}
    params.update(filters)
    try:
        rows = supabase_request(base_url, key, table, params=params)
        if rows:
            return [r[id_column] for r in rows]
        return []
    except urllib.error.HTTPError as e:
        log.warning("Skipping table %s -- query failed (HTTP %d)", table, e.code)
        return []


def determine_status_and_notes(date):
    """Return (status, notes) for a given date. Notes is always a string or None."""
    if date in BOOKED_DATES:
        return "booked", None
    if date in BLOCKED_MANUAL_DATES:
        return "blocked_manual", BLOCKED_MANUAL_DATES[date]
    if date in BLOCKED_MAINTENANCE_DATES:
        return "blocked_maintenance", BLOCKED_MAINTENANCE_DATES[date]
    return "available", None


def generate_rows(listing_id):
    """Generate availability rows for a single listing across the date range.

    CRITICAL: Every row has the exact same set of keys to satisfy PostgREST
    batch insert requirement. Fields not applicable are set to None (JSON null).
    """
    rows = []
    current = DATE_START
    while current <= DATE_END:
        status, notes = determine_status_and_notes(current)
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


def insert_rows(base_url, key, rows, dry_run=False):
    """Insert rows into listing_availability in batches of BATCH_SIZE."""
    total = len(rows)
    inserted = 0

    for i in range(0, total, BATCH_SIZE):
        batch = rows[i : i + BATCH_SIZE]
        if dry_run:
            log.info("[DRY RUN] Would insert batch %d-%d of %d rows",
                     i + 1, min(i + BATCH_SIZE, total), total)
        else:
            log.info("Inserting batch %d-%d of %d rows...",
                     i + 1, min(i + BATCH_SIZE, total), total)
            supabase_request(base_url, key, "listing_availability", method="POST", body=batch)
        inserted += len(batch)

    return inserted


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Seed listing_availability table")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print what would be inserted without writing")
    args = parser.parse_args()

    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY", "")

    if not supabase_url or not supabase_key:
        log.error("SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables are required")
        sys.exit(1)

    log.info("=== Seed Listing Availability ===")
    log.info("Date range: %s to %s", DATE_START, DATE_END)
    if args.dry_run:
        log.info("DRY RUN mode -- no data will be written")

    # -----------------------------------------------------------------------
    # 1. Fetch listing IDs
    # -----------------------------------------------------------------------

    all_listing_ids = []

    # LEM yachts from partner_yachts table
    log.info("Fetching LEM yacht listings from partner_yachts...")
    lem_yacht_ids = fetch_listing_ids(
        supabase_url, supabase_key, "partner_yachts",
        {"owner_id": f"eq.{LEM_PROFILE_ID}", "is_active": "eq.true"},
    )
    log.info("  Found %d LEM yachts", len(lem_yacht_ids))
    all_listing_ids.extend(lem_yacht_ids)

    # MVP yachts from partner_yachts table
    log.info("Fetching MVP yacht listings from partner_yachts...")
    mvp_yacht_ids = fetch_listing_ids(
        supabase_url, supabase_key, "partner_yachts",
        {"owner_id": f"eq.{MVP_PROFILE_ID}", "is_active": "eq.true"},
    )
    log.info("  Found %d MVP yachts", len(mvp_yacht_ids))
    all_listing_ids.extend(mvp_yacht_ids)

    # MVP cars from exotic_cars table
    log.info("Fetching MVP car listings from exotic_cars...")
    mvp_car_ids = fetch_listing_ids(
        supabase_url, supabase_key, "exotic_cars",
        {"owner_id": f"eq.{MVP_PROFILE_ID}", "is_active": "eq.true"},
    )
    log.info("  Found %d MVP cars", len(mvp_car_ids))
    all_listing_ids.extend(mvp_car_ids)

    # MVP mansions from mansions table (no owner_id -- filter by source_provider)
    log.info("Fetching MVP mansion listings from mansions...")
    mvp_mansion_ids = fetch_listing_ids(
        supabase_url, supabase_key, "mansions",
        {"source_provider": "eq.mvpmiami", "is_active": "eq.true"},
    )
    log.info("  Found %d MVP mansions", len(mvp_mansion_ids))
    all_listing_ids.extend(mvp_mansion_ids)

    if not all_listing_ids:
        log.error("No listings found -- nothing to seed")
        sys.exit(1)

    log.info("Total listings to seed: %d", len(all_listing_ids))

    # -----------------------------------------------------------------------
    # 2. Generate availability rows
    # -----------------------------------------------------------------------

    all_rows = []
    for listing_id in all_listing_ids:
        rows = generate_rows(listing_id)
        all_rows.extend(rows)

    log.info("Generated %d availability rows", len(all_rows))

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
    # 3. Insert into Supabase
    # -----------------------------------------------------------------------

    inserted = insert_rows(supabase_url, supabase_key, all_rows, dry_run=args.dry_run)
    log.info("Done! Inserted %d rows into listing_availability", inserted)

    # Summary
    status_counts = {}
    for row in all_rows:
        status_counts[row["status"]] = status_counts.get(row["status"], 0) + 1
    log.info("Status breakdown:")
    for status, count in sorted(status_counts.items()):
        log.info("  %s: %d", status, count)


if __name__ == "__main__":
    main()
