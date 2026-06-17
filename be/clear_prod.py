import urllib.request
import json

BASE_URL = "https://intelligent-portfolio-voyp.onrender.com"
PASSWORD = "admin_dev_2026"

def clear_db():
    print("Getting token...")
    data = json.dumps({"passphrase": PASSWORD}).encode("utf-8")
    req = urllib.request.Request(f"{BASE_URL}/api/admin/auth", data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    
    try:
        with urllib.request.urlopen(req) as response:
            res = json.loads(response.read().decode())
            token = res.get("token")
            print("Token received.")
    except Exception as e:
        print(f"Failed to get token: {e}")
        return

    print("Clearing database...")
    req = urllib.request.Request(f"{BASE_URL}/api/admin/db/clear", method="POST")
    req.add_header("Authorization", f"Bearer {token}")
    
    try:
        with urllib.request.urlopen(req) as response:
            res = json.loads(response.read().decode())
            print("Success:", res)
    except Exception as e:
        print(f"Failed to clear db: {e}")

if __name__ == "__main__":
    clear_db()
