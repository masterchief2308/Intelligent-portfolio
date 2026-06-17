import requests

BASE_URL = "https://intelligent-portfolio-backend-702455616797.asia-south1.run.app"
PASSPHRASE = "admin_dev_2026"

def clean_db():
    print("Authenticating...")
    r = requests.post(f"{BASE_URL}/api/admin/auth", json={"passphrase": PASSPHRASE})
    if not r.ok:
        print("Auth failed:", r.text)
        return
    token = r.json()["token"]
    print("Clearing DB...")
    r = requests.post(f"{BASE_URL}/api/admin/db/clear", headers={"Authorization": f"Bearer {token}"})
    print("Result:", r.text)

if __name__ == "__main__":
    clean_db()
