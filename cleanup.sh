#!/bin/bash

# Remove all .pyc files and __pycache__ directories
echo "🧹 Cleaning up Python cache files..."

# Remove .pyc files
find . -type f -name "*.pyc" -delete
echo "✅ Removed .pyc files"

# Remove __pycache__ directories
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null
echo "✅ Removed __pycache__ directories"

# Remove .pyo files
find . -type f -name "*.pyo" -delete
echo "✅ Removed .pyo files"

# Remove .pyd files
find . -type f -name "*.pyd" -delete
echo "✅ Removed .pyd files"

# Git cleanup
echo "🔧 Removing cached files from git..."
git rm -r --cached . 2>/dev/null
git add .
echo "✅ Git cache cleaned"

echo "🎉 Cleanup complete!"
echo ""
echo "Next steps:"
echo "1. git commit -m 'Remove Python cache files'"
echo "2. git push"
