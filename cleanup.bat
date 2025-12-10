@echo off
echo 🧹 Cleaning up Python cache files...

REM Remove .pyc files
echo Removing .pyc files...
for /r %%i in (*.pyc) do del "%%i"
echo ✅ Removed .pyc files

REM Remove __pycache__ directories
echo Removing __pycache__ directories...
for /d /r %%i in (__pycache__) do rd /s /q "%%i" 2>nul
echo ✅ Removed __pycache__ directories

REM Remove .pyo files
echo Removing .pyo files...
for /r %%i in (*.pyo) do del "%%i"
echo ✅ Removed .pyo files

REM Git cleanup
echo 🔧 Removing cached files from git...
git rm -r --cached . 2>nul
git add .
echo ✅ Git cache cleaned

echo.
echo 🎉 Cleanup complete!
echo.
echo Next steps:
echo 1. git commit -m "Remove Python cache files"
echo 2. git push

pause
