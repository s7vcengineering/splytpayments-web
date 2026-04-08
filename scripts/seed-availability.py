#!/usr/bin/env python3
"""
Seed listing_availability for all active listings across all tables.
Creates 90 days of "available" slots starting from today.

Usage:
    python3 scripts/seed-availability.py

Env vars:
    SUPABASE_URL
    SUPABASE_SERVICE_KEY
"""

import json
import os
import sys
import urllib.request
from datetime import date, timedelta

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    sys.exit(1)

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

DAYS_AHEAD = 90
TODAY = date.today()


def supabase_get(table: str, select: str = "id", filters: str = "") -> list:
    """Fetch rows from a Supabase table."""
    url = f"{SUPABASE_URL}/rest/v1/{table}?select={select}"
    if filters:
        url += f"&{filters}"
    req = urllib.request.Request(url, headers=HEADERS, method="GET")
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f"  Warning: could not query {table}: {e}")
        return []


def supabase_post(table: str, rows: list) -> int:
    """Upsert rows into a Supabase table, skipping duplicates. Returns count."""
    if not rows:
        return 0
    url = f"{SUPABASE_URL}/rest/v1/{table}?on_conflict=listing_id,date"
    headers = {**HEADERS, "Prefer": "resolution=ignore-duplicates,return=minimal"}
    # Batch in chunks of 500
    total = 0
    for i in range(0, len(rows), 500):
        chunk = rows[i : i + 500]
        body = json.dumps(chunk).encode()
        req = urllib.request.Request(url, data=body, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req) as resp:
                total += len(chunk)
        except urllib.error.HTTPError as e:
            err_body = e.read().decode()
            print(f"  Error inserting batch {i}-{i+len(chunk)}: {e.code} {err_body[:300]}")
        except Exception as e:
            print(f"  Error inserting batch: {e}")
    return total


def get_existing_listing_ids() -> set:
    """Get all listing_ids that already have availability rows."""
    rows = supabase_get("listing_availability", select="listing_id", filters="")
    # Deduplicate
    return set(r["listing_id"] for r in rows if r.get("listing_id"))


def generate_availability_rows(listing_id: str) -> list:
    """Generate 90 days of available slots for a listing."""
    rows = []
    for day_offset in range(DAYS_AHEAD):
        d = TODAY + timedelta(days=day_offset)
        rows.append({
            "listing_id": listing_id,
            "date": d.isoformat(),
            "status": "available",
        })
    return rows


def main():
    print(f"Seeding availability for {DAYS_AHEAD} days starting {TODAY}")
    print()

    # Tables to seed from — each has an `id` column and some active filter
    tables = [
        ("boats", "is_active=eq.true"),
        ("exotic_cars", "is_active=eq.true"),
        ("mansions", "is_active=eq.true"),
        ("mvp_yachts", "is_active=eq.true"),
        ("experiences", "status=in.(open,filling)"),
    ]

    # Gather all listing IDs
    all_ids: list[tuple[str, str]] = []  # (id, table)
    for table, filter_str in tables:
        rows = supabase_get(table, select="id", filters=filter_str)
        count = len(rows)
        print(f"  {table}: {count} active listing(s)")
        for r in rows:
            all_ids.append((r["id"], table))

    print(f"\nTotal active listings: {len(all_ids)}")

    # Generate rows for all (upsert will skip existing)
    all_rows = []
    for lid, tbl in all_ids:
        all_rows.extend(generate_availability_rows(lid))

    print(f"\nInserting {len(all_rows)} availability rows...")
    inserted = supabase_post("listing_availability", all_rows)
    print(f"Done! Processed {inserted} rows across {len(all_ids)} listings.")


if __name__ == "__main__":
    main()
