import requests
import sys

BASE_URL = "https://intelligent-portfolio-backend-702455616797.asia-south1.run.app"
PASSPHRASE = "admin_dev_2026"

print("Authenticating...")
auth_response = requests.post(f"{BASE_URL}/api/admin/auth", json={"passphrase": PASSPHRASE})
if auth_response.status_code != 200:
    print(f"Auth failed: {auth_response.text}")
    sys.exit(1)

token = auth_response.json()["token"]
print("Authenticated successfully. Clearing cache...")

clear_response = requests.post(
    f"{BASE_URL}/api/admin/cache/clear",
    headers={"Authorization": f"Bearer {token}"}
)

if clear_response.status_code == 200:
    print(f"Cache cleared successfully: {clear_response.json()}")
else:
    print(f"Failed to clear cache: {clear_response.status_code} - {clear_response.text}")
