"""Quick multi-visitor rate-limit test against local Docker backend."""

import json
import urllib.error
import urllib.request

BASE = "http://localhost:8000/api/personalize"
BODY = json.dumps({"email": "visitor@example.com", "role": "hiring", "company": "Acme"}).encode()


def post_personalize(client_ip: str) -> int:
    req = urllib.request.Request(
        BASE,
        data=BODY,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Forwarded-For": client_ip,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        return e.code


def main() -> None:
    print("Simulating 5 different visitors (unique X-Forwarded-For IPs)")
    print("Each visitor sends 1 personalize request\n")

    codes = []
    for i in range(1, 6):
        ip = f"203.0.113.{i}"
        code = post_personalize(ip)
        codes.append(code)
        print(f"  visitor {i} ({ip}): HTTP {code}")

    if 429 in codes:
        print("\nFAIL: 429 with only 1 request per unique IP")
    else:
        print("\nPASS: No 429 across 5 distinct visitor IPs")

    print("\nSame visitor retries 8 times (same IP) — limit is 30/min for pipeline")
    ip = "203.0.113.99"
    retry_codes = []
    for i in range(1, 9):
        code = post_personalize(ip)
        retry_codes.append(code)
        print(f"  attempt {i}: HTTP {code}")

    count_429 = retry_codes.count(429)
    if count_429 == 0:
        print("\nPASS: Same IP under 30/min — no 429 on 8 attempts")
    else:
        print(f"\nNote: {count_429} x 429 on same IP (expected only above 30/min)")


if __name__ == "__main__":
    main()
