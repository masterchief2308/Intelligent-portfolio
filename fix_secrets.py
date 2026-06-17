import subprocess

PROJECT = "gen-lang-client-0511428447"

secrets = {
    "GEMINI_API_KEY": "YOUR_GEMINI_API_KEY_HERE",
    "QDRANT_API_KEY": "YOUR_QDRANT_API_KEY_HERE",
    "ADMIN_PASSPHRASE": "admin_dev_2026",
    "JWT_SECRET": "dev-secret-change-in-prod"
}

for name, value in secrets.items():
    print(f"Updating secret {name}...")
    p = subprocess.run(
        ["gcloud.cmd", "secrets", "versions", "add", name, "--data-file=-", f"--project={PROJECT}"],
        input=value.encode("utf-8")
    )
    if p.returncode != 0:
        print(f"Failed to update {name}")

print("Done fixing secrets.")
