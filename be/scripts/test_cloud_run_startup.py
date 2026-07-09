#!/usr/bin/env python3
"""
Simulate Cloud Run startup checks locally.

What this proves:
  - Time until GET /ready returns 200 (embeddings + Qdrant initialized)
  - Whether traffic sent before /ready gets 503 (warming) vs 200

What this does NOT prove:
  - Zero 429 forever — SlowAPI and Gemini quotas can still return 429 by design.

Usage:
  # Against a running server (PORT=8080 like Cloud Run):
  python scripts/test_cloud_run_startup.py --url http://localhost:8080

  # Also hammer a rate-limited route to show app-level 429:
  python scripts/test_cloud_run_startup.py --url http://localhost:8080 --burst-personalize 6

Docker (same memory + port as cloudbuild.yaml):
  docker build -t portfolio-backend-test ./be
  docker run --rm --memory=2g -e PORT=8080 -p 8080:8080 --env-file ./be/.env portfolio-backend-test
  # In another terminal:
  python be/scripts/test_cloud_run_startup.py --url http://localhost:8080
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request


# Mirrors cloudbuild.yaml startup probe
PROBE_INITIAL_DELAY_S = 5
PROBE_PERIOD_S = 5
PROBE_TIMEOUT_S = 5
PROBE_FAILURE_THRESHOLD = 24
MAX_STARTUP_S = PROBE_INITIAL_DELAY_S + PROBE_PERIOD_S * PROBE_FAILURE_THRESHOLD


def http_get(url: str, timeout: float = 5.0) -> tuple[int, str, dict]:
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            headers = {k.lower(): v for k, v in resp.headers.items()}
            return resp.status, body, headers
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        headers = {k.lower(): v for k, v in e.headers.items()}
        return e.code, body, headers


def wait_for_ready(base_url: str) -> dict:
    """Poll /ready like Cloud Run startup probe."""
    ready_url = f"{base_url.rstrip('/')}/ready"
    health_url = f"{base_url.rstrip('/')}/health"

    print(f"Cloud Run probe simulation: initialDelay={PROBE_INITIAL_DELAY_S}s, "
          f"period={PROBE_PERIOD_S}s, failureThreshold={PROBE_FAILURE_THRESHOLD}")
    print(f"Max startup window: {MAX_STARTUP_S}s")
    print(f"Polling: {ready_url}\n")

    time.sleep(PROBE_INITIAL_DELAY_S)
    started = time.perf_counter()
    attempts = 0
    history: list[dict] = []

    while attempts < PROBE_FAILURE_THRESHOLD:
        attempts += 1
        t = time.perf_counter() - started
        try:
            status, body, headers = http_get(ready_url, timeout=PROBE_TIMEOUT_S)
        except Exception as e:
            status, body, headers = 0, str(e), {}
        entry = {"attempt": attempts, "elapsed_s": round(t, 2), "status": status}
        history.append(entry)

        if status == 200:
            print(f"  [{attempts:02d}] +{t:6.1f}s  READY 200")
            try:
                payload = json.loads(body)
            except json.JSONDecodeError:
                payload = {"raw": body[:200]}
            return {
                "ready": True,
                "elapsed_s": round(t, 2),
                "attempts": attempts,
                "payload": payload,
                "history": history,
            }

        label = "WARMING" if status == 503 else ("DOWN" if status == 0 else f"HTTP {status}")
        print(f"  [{attempts:02d}] +{t:6.1f}s  {label} {status or ''}")

        if attempts < PROBE_FAILURE_THRESHOLD:
            time.sleep(PROBE_PERIOD_S)

    # Fallback: is process alive at all?
    try:
        h_status, _, _ = http_get(health_url, timeout=PROBE_TIMEOUT_S)
    except Exception:
        h_status = 0

    return {
        "ready": False,
        "elapsed_s": round(time.perf_counter() - started, 2),
        "attempts": attempts,
        "health_status": h_status,
        "history": history,
    }


def burst_personalize(base_url: str, count: int) -> None:
    """Show that SlowAPI still returns 429 regardless of embedding warmup."""
    url = f"{base_url.rstrip('/')}/api/personalize"
    payload = json.dumps({"email": "test@example.com", "role": "hiring", "company": "TestCo"}).encode()
    print(f"\nBurst test: POST {url} x{count} (limit is 5/minute on this route)")
    statuses: list[int] = []

    for i in range(1, count + 1):
        req = urllib.request.Request(
            url,
            data=payload,
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                statuses.append(resp.status)
                print(f"  request {i}: {resp.status}")
        except urllib.error.HTTPError as e:
            statuses.append(e.code)
            remaining = e.headers.get("X-RateLimit-Remaining", "?")
            print(f"  request {i}: {e.code} (RateLimit-Remaining: {remaining})")

    if 429 in statuses:
        print("  -> App-level 429 observed (SlowAPI). Embedding warmup does not disable this.")
    else:
        print("  -> No 429 in this burst (cache hits or limits not reached).")


def main() -> int:
    parser = argparse.ArgumentParser(description="Test Cloud Run-like startup locally")
    parser.add_argument("--url", default="http://localhost:8080", help="Backend base URL")
    parser.add_argument(
        "--burst-personalize",
        type=int,
        default=0,
        help="After ready, send N personalize requests to demo SlowAPI 429",
    )
    args = parser.parse_args()

    print("=" * 60)
    print("IMPORTANT: Nothing guarantees zero 429 responses.")
    print("This script measures startup readiness (503 -> 200), not quota limits.")
    print("=" * 60 + "\n")

    result = wait_for_ready(args.url)

    print("\n--- Summary ---")
    if result["ready"]:
        print(f"READY in {result['elapsed_s']}s after {result['attempts']} probe(s)")
        print(f"Payload: {result['payload']}")
        print("\nCloud Run would route traffic only after this point.")
        print("That reduces cold-start failures — but does NOT remove:")
        print("  - SlowAPI limits (e.g. /api/personalize 5/min)")
        print("  - Gemini API quota 429s")
    else:
        print(f"NOT READY within {MAX_STARTUP_S}s window")
        print(f"Last health check: {result.get('health_status')}")
        print("Cloud Run would fail this revision's startup probe.")
        return 1

    if args.burst_personalize > 0:
        burst_personalize(args.url, args.burst_personalize)

    return 0


if __name__ == "__main__":
    sys.exit(main())
