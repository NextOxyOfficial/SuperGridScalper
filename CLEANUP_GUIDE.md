# Python Cache Cleanup Guide

## Problem
`.pyc` files and `__pycache__` directories are being tracked by git, causing merge conflicts when pulling on the server.

## Solution
These files are now properly ignored via `.gitignore`, but existing tracked files need to be removed.

## How to Clean Up

### Option 1: Using Python Script (Recommended - Cross-platform)
```bash
python cleanup.py
```

### Option 2: Using Bash Script (Linux/Mac)
```bash
chmod +x cleanup.sh
./cleanup.sh
```

### Option 3: Using Batch File (Windows)
```cmd
cleanup.bat
```

### Option 4: Manual Commands

#### On Windows (PowerShell):
```powershell
# Remove .pyc files
Get-ChildItem -Recurse -Filter *.pyc | Remove-Item -Force

# Remove __pycache__ directories
Get-ChildItem -Recurse -Directory -Filter __pycache__ | Remove-Item -Recurse -Force

# Git cleanup
git rm -r --cached .
git add .
git commit -m "Remove Python cache files"
git push
```

#### On Linux/Mac:
```bash
# Remove .pyc files
find . -type f -name "*.pyc" -delete

# Remove __pycache__ directories
find . -type d -name "__pycache__" -exec rm -rf {} +

# Git cleanup
git rm -r --cached .
git add .
git commit -m "Remove Python cache files"
git push
```

## What Gets Cleaned

- ✅ `*.pyc` files (Python bytecode)
- ✅ `*.pyo` files (Optimized bytecode)
- ✅ `*.pyd` files (Python DLL)
- ✅ `__pycache__/` directories
- ✅ Git cache (re-adds files respecting .gitignore)

## After Cleanup

1. **Commit the changes:**
   ```bash
   git commit -m "Remove Python cache files and update .gitignore"
   ```

2. **Push to remote:**
   ```bash
   git push
   ```

3. **On server, pull the changes:**
   ```bash
   git pull
   ```

## Prevention

The updated `.gitignore` file now includes:
```
*.pyc
*.pyo
*.pyd
__pycache__/
**/__pycache__/
**/*.pyc
```

This ensures these files won't be tracked in the future.

## Troubleshooting

### If you still see merge conflicts:

1. **Stash local changes:**
   ```bash
   git stash
   ```

2. **Pull from remote:**
   ```bash
   git pull
   ```

3. **Apply stashed changes:**
   ```bash
   git stash pop
   ```

### If files are still being tracked:

1. **Force remove from git:**
   ```bash
   git rm -r --cached backend/**/__pycache__
   git rm -r --cached backend/**/*.pyc
   git commit -m "Force remove Python cache files"
   git push
   ```

2. **Clean local cache:**
   ```bash
   git gc --aggressive --prune=now
   ```

## Best Practices

1. **Always run cleanup before committing** if you've been developing locally
2. **Never commit** `.pyc` files or `__pycache__` directories
3. **Use virtual environments** to keep dependencies isolated
4. **Run cleanup script** periodically to keep repo clean

## Automated Cleanup (Optional)

Add to your git hooks (`.git/hooks/pre-commit`):
```bash
#!/bin/bash
# Remove Python cache files before commit
find . -type f -name "*.pyc" -delete
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null
```

Make it executable:
```bash
chmod +x .git/hooks/pre-commit
```
