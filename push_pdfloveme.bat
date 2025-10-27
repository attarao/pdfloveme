@echo off
echo ========================================
echo  🚀 Pushing PDFLoveMe Website to GitHub
echo ========================================
echo.

:: Step 1: Go to project folder
cd /d "%~dp0"

:: Step 2: Initialize git if not done
if not exist ".git" (
    echo Initializing new Git repository...
    git init
)

:: Step 3: Configure user info
git config user.name "Attar"
git config user.email "attarao0302@gmail.com"

:: Step 4: Add all files
git add --all

:: Step 5: Commit changes
git commit -m "Auto commit from push script"

:: Step 6: Create main branch
git branch -M main

:: Step 7: Add remote if missing
git remote remove origin 2>nul
git remote add origin https://github.com/attarao/pdfloveme.git

:: Step 8: Push to GitHub
echo Pushing to GitHub...
git push -u origin main

echo.
echo ✅ Done! Check your repo: https://github.com/attarao/pdfloveme
pause
