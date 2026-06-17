import time
import requests
import uuid

BASE_URL = "https://intelligent-portfolio-backend-702455616797.asia-south1.run.app"
# BASE_URL = "http://localhost:8000"

def main():
    email = f"test_{uuid.uuid4().hex[:4]}@kodiva.ai"
    print(f"Testing Personalize API with {email} (No timeout)...")
    
    start = time.time()
    try:
        res = requests.post(
            f"{BASE_URL}/api/personalize",
            json={"email": email, "role": "engineer", "company": "TestCorp"},
            timeout=None # Infinite timeout
        )
        elapsed = time.time() - start
        
        print(f"Finished in {elapsed:.2f} seconds!")
        print(f"Status Code: {res.status_code}")
        if res.status_code != 200:
            print("Response:", res.text)
        else:
            print("Success! Website config returned.")
    except Exception as e:
        print(f"Exception after {time.time() - start:.2f} seconds:", e)

if __name__ == "__main__":
    main()
