#!/usr/bin/env python3
"""
Upload referral system files to production server
"""

import os
import subprocess

def upload_files():
    """Upload necessary files to production"""
    
    # Files to upload
    files_to_upload = [
        'backend/core/views.py',
        'backend/core/models.py', 
        'backend/core/urls.py',
        'backend/core/admin.py'
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
    
    print("\n🔄 Now run these commands on production server:")
    print("ssh ubuntu@markstrades.com")
    print("cd /var/www/markstrades/backend")
    print("python3 manage.py migrate")
    print("sudo systemctl restart gunicorn")
    print("sudo systemctl restart nginx")

if __name__ == "__main__":
    upload_files()
