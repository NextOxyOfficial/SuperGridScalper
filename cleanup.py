#!/usr/bin/env python3
"""
Clean up Python cache files (.pyc, __pycache__, etc.)
and remove them from git tracking
"""

import os
import shutil
import subprocess
from pathlib import Path

def remove_pyc_files(root_dir='.'):
    """Remove all .pyc files"""
    count = 0
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            if file.endswith('.pyc') or file.endswith('.pyo') or file.endswith('.pyd'):
                file_path = os.path.join(root, file)
                try:
                    os.remove(file_path)
                    count += 1
                except Exception as e:
                    print(f"Error removing {file_path}: {e}")
    return count

def remove_pycache_dirs(root_dir='.'):
    """Remove all __pycache__ directories"""
    count = 0
    for root, dirs, files in os.walk(root_dir, topdown=False):
        for dir_name in dirs:
            if dir_name == '__pycache__':
                dir_path = os.path.join(root, dir_name)
                try:
                    shutil.rmtree(dir_path)
                    count += 1
                except Exception as e:
                    print(f"Error removing {dir_path}: {e}")
    return count

def git_cleanup():
    """Remove cached files from git and re-add"""
    try:
        # Remove all files from git cache
        subprocess.run(['git', 'rm', '-r', '--cached', '.'], 
                      capture_output=True, check=False)
        
        # Re-add all files (respecting .gitignore)
        subprocess.run(['git', 'add', '.'], check=True)
        
        return True
    except subprocess.CalledProcessError as e:
        print(f"Git error: {e}")
        return False
    except FileNotFoundError:
        print("Git not found. Skipping git cleanup.")
        return False

def main():
    print("🧹 Cleaning up Python cache files...")
    print()
    
    # Remove .pyc files
    pyc_count = remove_pyc_files()
    print(f"✅ Removed {pyc_count} .pyc/.pyo/.pyd files")
    
    # Remove __pycache__ directories
    cache_count = remove_pycache_dirs()
    print(f"✅ Removed {cache_count} __pycache__ directories")
    
    # Git cleanup
    print()
    print("🔧 Cleaning git cache...")
    if git_cleanup():
        print("✅ Git cache cleaned")
    else:
        print("⚠️  Git cleanup skipped or failed")
    
    print()
    print("🎉 Cleanup complete!")
    print()
    print("Next steps:")
    print('1. git commit -m "Remove Python cache files"')
    print("2. git push")

if __name__ == '__main__':
    main()
