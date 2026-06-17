import requests
import time
import sys

FE_URL = "http://localhost:3000"
BE_PORTFOLIO_URL = "http://localhost:8000/api/portfolio"
BE_ANALYTICS_URL = "http://localhost:8000/api/analytics/visit"

def test_endpoint(name, url, method="GET", payload=None):
    try:
        print(f"Testing {name} [{method} {url}]...")
        if method == "GET":
            response = requests.get(url, timeout=10)
        else:
            response = requests.post(url, json=payload, timeout=10)
            
        if response.status_code < 400:
            print(f"[SUCCESS] {name} passed (Status: {response.status_code})")
            if "application/json" in response.headers.get("content-type", ""):
                print(f"   Response: {response.json()}")
            else:
                print(f"   Response: HTML Document ({len(response.text)} bytes)")
            return True
        else:
            print(f"[FAIL] {name} failed (Status: {response.status_code})")
            print(f"   Error: {response.text}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"[ERROR] {name} unreachable: {e}")
        return False

def run_tests():
    print("====================================")
    print("   LOCAL API END-TO-END TEST SUITE  ")
    print("====================================\n")
    
    success = True
    
    # Test Frontend
    success &= test_endpoint("Frontend Web App", FE_URL)
    print("")
    
    # Test Backend Portfolio API
    success &= test_endpoint("Backend Portfolio API", BE_PORTFOLIO_URL)
    print("")
    
    # Test Backend Analytics API
    success &= test_endpoint("Backend Analytics API", BE_ANALYTICS_URL, method="POST", payload={
        "email": "local_tester@test.com",
        "role": "QA",
        "timestamp": "2026-06-17T12:00:00Z"
    })
    
    print("\n====================================")
    if success:
        print("[YAY] ALL TESTS PASSED SUCCESSFULLY! The local environment is perfectly healthy.")
        sys.exit(0)
    else:
        print("[WARN] SOME TESTS FAILED. Please review the errors above.")
        sys.exit(1)

if __name__ == "__main__":
    run_tests()
