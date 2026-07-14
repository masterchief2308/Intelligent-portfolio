#!/usr/bin/env python3
"""
Simulate Cloud Run startup checks locally.

What this proves:
  - Time until GET /health returns 200 (process accepts traffic)
  - Optional deep /ready status (embeddings loaded — lazy, does not gate Cloud Run)

What this does NOT prove:
  - Zero 429 forever — SlowAPI and Gemini quotas can still return 429 by design.

Usage:
  python scripts/test_cloud_run_startup.py --url http://localhost:8080
  python scripts/test_cloud_run_startup.py --url http://localhost:8080 --burst-personalize 6
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request


# Mirrors cloudbuild.yaml startup probe (/health — cheap, no embedding load)
PROBE_INITIAL_DELAY_S = 0
PROBE_PERIOD_S = 5
PROBE_TIMEOUT_S = 2
PROBE_FAILURE_THRESHOLD = 12
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
    """Poll /health like Cloud Run startup probe (embeddings load lazily on first RAG)."""
    health_url = f"{base_url.rstrip('/')}/health"
    ready_url = f"{base_url.rstrip('/')}/ready"

    print(f"Cloud Run probe simulation: initialDelay={PROBE_INITIAL_DELAY_S}s, "
          f"period={PROBE_PERIOD_S}s, failureThreshold={PROBE_FAILURE_THRESHOLD}")
    print(f"Max startup window: {MAX_STARTUP_S}s")
    print(f"Polling: {health_url}\n")

    if PROBE_INITIAL_DELAY_S:
        time.sleep(PROBE_INITIAL_DELAY_S)
    started = time.perf_counter()
    attempts = 0
    history: list[dict] = []

    while attempts < PROBE_FAILURE_THRESHOLD:
        attempts += 1
        t = time.perf_counter() - started
        try:
            status, body, _ = http_get(health_url, timeout=PROBE_TIMEOUT_S)
        except Exception as e:
            status, body = 0, str(e)
        history.append({"attempt": attempts, "elapsed_s": round(t, 2), "status": status})
        print(f"  [{attempts:02d}] +{t:6.1f}s  health={status} body={body[:80]!r}")

        if status == 200:
            try:
                payload = json.loads(body)
            except json.JSONDecodeError:
                payload = {"raw": body[:200]}
            try:
                r_status, r_body, _ = http_get(ready_url, timeout=PROBE_TIMEOUT_S)
                print(f"  deep /ready => {r_status} {r_body[:120]}")
            except Exception as e:
                r_status, r_body = 0, str(e)
            return {
                "ready": True,
                "elapsed_s": round(time.perf_counter() - started, 2),
                "attempts": attempts,
                "payload": payload,
                "history": history,
                "ready_probe": {"status": r_status, "body": r_body},
            }

        if attempts < PROBE_FAILURE_THRESHOLD:
            time.sleep(PROBE_PERIOD_S)

    h_status = 0
    try:
        h_status, _, _ = http_get(health_url, timeout=PROBE_TIMEOUT_S)
    except Exception:
        pass
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
        help="After health OK, send N personalize requests to demo SlowAPI 429",
    )
    args = parser.parse_args()

    print("=" * 60)
    print("Startup probe is /health (cheap). Embeddings load on first RAG call.")
    print("=" * 60 + "\n")

    result = wait_for_ready(args.url)

    print("\n--- Summary ---")
    if result["ready"]:
        print(f"HEALTH OK in {result['elapsed_s']}s after {result['attempts']} probe(s)")
        print(f"Payload: {result['payload']}")
        print("Cloud Run routes traffic after /health — embeddings stay lazy.")
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
