@echo off
echo ========================================
echo   🚀 Auto Push Script - PDFLoveMe
echo ========================================
echo.

:: Go to project directory
cd /d "%~dp0"

:: Initialize git if missing
if not exist ".git" (
    echo Initializing new Git repository...
    git init
)

:: Set user info
git config user.name "Attar"
git config user.email "attarao0302@gmail.com"

:: Add all files
echo Adding all files...
git add --all

:: Commit changes
git commit -m "Auto sync commit from local machine" >nul 2>&1

:: Ensure we're on 'main' branch
git branch -M main

:: Add remote origin (replace if exists)
git remote remove origin 2>nul
git remote add origin https://github.com/attarao/pdfloveme.git

:: Pull before pushing (avoid fetch first error)
echo Syncing with remote (pulling latest changes)...
git fetch origin main >nul 2>&1
git pull --rebase origin main

:: Push changes
echo Uploading files to GitHub...
git push -u origin main

echo.
echo ✅ Upload complete! Check your repo:
echo 🔗 https://github.com/attarao/pdfloveme
echo.
pause
