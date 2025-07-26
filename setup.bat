@echo off
echo ========================================
echo JL Operations - Firebase Setup
echo ========================================
echo.

echo Checking if .env file exists...
if exist .env (
    echo .env file already exists!
    echo.
    echo Please make sure your Firebase configuration is correct in the .env file.
    echo You can find the template in env.template
    echo.
) else (
    echo Creating .env file from template...
    copy env.template .env
    echo.
    echo .env file created! Please edit it with your Firebase configuration.
    echo.
    echo Follow the instructions in FIREBASE_SETUP.md to get your Firebase config.
    echo.
)

echo Starting development server...
echo.
echo The app will open at http://localhost:3000
echo You can test Firebase connection at http://localhost:3000/test
echo.
npm start 