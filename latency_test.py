import time
import requests
import uuid
import json

BASE_URL = "https://intelligent-portfolio-backend-702455616797.asia-south1.run.app"

def measure_request(method, endpoint, json_payload=None, params=None):
    url = f"{BASE_URL}{endpoint}"
    print(f"\nTesting {method} {endpoint} ...")
    start = time.time()
    if method == "POST":
        res = requests.post(url, json=json_payload)
    else:
        res = requests.get(url, params=params)
    
    elapsed = time.time() - start
    
    if res.status_code == 200:
        print(f"SUCCESS (200 OK) - Time taken: {elapsed:.2f} seconds")
    else:
        print(f"FAILED ({res.status_code}) - Time taken: {elapsed:.2f} seconds")
        try:
            print("Error details:", res.json())
        except:
            print("Error details:", res.text)
            
    return elapsed

def main():
    # Generate a random email so we force a cache MISS and test the LLM latency
    random_email = f"latency_test_{uuid.uuid4().hex[:6]}@kodiva.ai"
    print(f"Testing with unique email (forcing Cache MISS): {random_email}")
    
    # 1. Personalize (runs the 5-agent LangGraph pipeline)
    payload = {
        "email": random_email,
        "role": "engineer",
        "company": "TestCorp"
    }
    measure_request("POST", "/api/personalize", json_payload=payload)
    
    # 2. Portfolio (Generates personalized experience/education)
    measure_request("GET", "/api/portfolio", params={"email": random_email})
    
    # 3. Project Detail (Generates personalized case study)
    measure_request("GET", "/api/project/iocl-tender-evaluation", params={"email": random_email})
    
    # 4. Architecture (Generates personalized React Flow graph)
    measure_request("GET", "/api/architecture/iocl-tender-evaluation", params={"email": random_email})
    
    print("\n---------------------------------------------------")
    print(f"Testing with SAME email (forcing Cache HIT): {random_email}")
    
    # Test cache hits
    measure_request("GET", "/api/portfolio", params={"email": random_email})
    measure_request("GET", "/api/project/iocl-tender-evaluation", params={"email": random_email})
    measure_request("GET", "/api/architecture/iocl-tender-evaluation", params={"email": random_email})

if __name__ == "__main__":
    main()
