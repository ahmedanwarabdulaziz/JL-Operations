Write-Host "========================================" -ForegroundColor Green
Write-Host "JL Operations - Firebase Setup" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "Checking if .env file exists..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host ".env file already exists!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Please make sure your Firebase configuration is correct in the .env file." -ForegroundColor Cyan
    Write-Host "You can find the template in env.template" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host "Creating .env file from template..." -ForegroundColor Yellow
    Copy-Item "env.template" ".env"
    Write-Host ""
    Write-Host ".env file created! Please edit it with your Firebase configuration." -ForegroundColor Green
    Write-Host ""
    Write-Host "Follow the instructions in FIREBASE_SETUP.md to get your Firebase config." -ForegroundColor Cyan
    Write-Host ""
}

Write-Host "Starting development server..." -ForegroundColor Yellow
Write-Host ""
Write-Host "The app will open at http://localhost:3000" -ForegroundColor Cyan
Write-Host "You can test Firebase connection at http://localhost:3000/test" -ForegroundColor Cyan
Write-Host ""
npm start 