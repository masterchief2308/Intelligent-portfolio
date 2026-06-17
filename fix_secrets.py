import subprocess

PROJECT = "gen-lang-client-0511428447"

# Define the consolidated payload
ENV_PAYLOAD = """GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
QDRANT_API_KEY=YOUR_QDRANT_API_KEY_HERE
ADMIN_PASSPHRASE=admin_dev_2026
JWT_SECRET=dev-secret-change-in-prod
"""

def fix_secret():
    secret_name = "PORTFOLIO_SECRETS"
    try:
        # Create or verify secret exists
        subprocess.run([
            "gcloud", "secrets", "create", secret_name,
            "--replication-policy=automatic",
            "--project", PROJECT
        ], capture_output=True)
        
        # Add new version safely
        proc = subprocess.run([
            "gcloud", "secrets", "versions", "add", secret_name,
            "--data-file=-",
            "--project", PROJECT
        ], input=ENV_PAYLOAD.encode("utf-8"), capture_output=True, text=False)
        
        if proc.returncode == 0:
            print(f"✅ Successfully pushed consolidated secret: {secret_name}")
        else:
            print(f"❌ Failed to update {secret_name}: {proc.stderr.decode('utf-8', errors='ignore')}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    fix_secret()
