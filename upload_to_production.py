#!/usr/bin/env python3
"""
Upload selected project files to the production server.

This helper only copies local files to the VPS. It does not pull Git changes,
run migrations, or restart PM2 by itself.
"""

import os
import subprocess

def upload_files():
    """Upload necessary files to production."""
    
    # Files to upload
    files_to_upload = [
        'backend/core/views.py',
        'backend/core/models.py',
        'backend/core/urls.py',
        'backend/core/admin.py',
        'backend/config/urls.py',
        'frontend/src/app/dashboard/page.tsx',
    ]
    
    server = "ubuntu@markstrades.com"  # Replace with your server
    remote_path = "/var/www/markstrades/"
    
    print("🚀 Uploading files to production...")
    
    for file_path in files_to_upload:
        if os.path.exists(file_path):
            remote_file = f"{remote_path}{file_path}"
            cmd = f"scp {file_path} {server}:{remote_file}"
            
            print(f"📤 Uploading {file_path}...")
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            
            if result.returncode == 0:
                print(f"✅ {file_path} uploaded successfully")
            else:
                print(f"❌ Failed to upload {file_path}: {result.stderr}")
        else:
            print(f"❌ File not found: {file_path}")
    
    print("\n🔄 After upload, run these commands on the production server:")
    print("ssh ubuntu@markstrades.com")
    print("cd /var/www/markstrades")
    print("git pull origin main")
    print("cd backend")
    print("python3 manage.py migrate")
    print("cd ..")
    print("pm2 restart backend --update-env")
    print("pm2 restart frontend --update-env")
    print("curl -i -X POST https://markstrades.com/api/ea-control/ -H \"Content-Type: application/json\" -d '{\"license_key\":\"TEST\",\"email\":\"test@example.com\"}'")
    print("\nIf you run this script on the VPS itself, it will only copy the VPS files back onto the same VPS.")
    print("For full deployment on the VPS, prefer: bash deploy_vps.sh")

if __name__ == "__main__":
    upload_files()
