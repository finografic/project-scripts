@echo off
setlocal ENABLEDELAYEDEXPANSION
echo ========================================
echo {{APP_NAME}} - Windows Setup
echo ========================================
echo.

REM 1) Ensure Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Attempting to install Node.js LTS via winget...
    winget --version >nul 2>&1
    if %errorlevel% EQU 0 (
        winget install OpenJS.NodeJS.LTS -e --silent --accept-source-agreements --accept-package-agreements
        if %errorlevel% NEQ 0 (
            echo ⚠️  winget install failed. Checking for Chocolatey...
            choco -v >nul 2>&1
            if %errorlevel% EQU 0 (
                choco install nodejs-lts -y
            ) else (
                echo ⚠️  Chocolatey not found. Opening Node.js download page...
                start https://nodejs.org/
                echo Please install Node.js LTS manually, then press any key to continue.
                pause >nul
            )
        )
    ) else (
        echo ⚠️  winget not available. Checking for Chocolatey...
        choco -v >nul 2>&1
        if %errorlevel% EQU 0 (
            choco install nodejs-lts -y
        ) else (
            echo ⚠️  Chocolatey not found. Opening Node.js download page...
            start https://nodejs.org/
            echo Please install Node.js LTS manually, then press any key to continue.
            pause >nul
        )
    )
)

REM Refresh PATH for current session (common install location)
set PATH=%PATH%;C:\\Program Files\\nodejs

node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js still not detected. Please close this window, install Node.js, then run setup.bat again.
    pause
    exit /b 1
)

echo ✅ Node.js found:
node --version

echo ✅ npm found:
npm --version

echo.
echo 📦 Installing dependencies (production)...

REM Try multiple npm install strategies to handle peer dependency conflicts
echo 🔧 Attempting with --legacy-peer-deps...
npm install --production --legacy-peer-deps
if %errorlevel% EQU 0 (
    echo ✅ Dependencies installed successfully with --legacy-peer-deps
    goto :start_app
)

echo ⚠️  Legacy peer deps failed, trying with force flag...
npm install --production --force
if %errorlevel% EQU 0 (
    echo ✅ Dependencies installed successfully with --force
    goto :start_app
)

echo ⚠️  Force install failed, trying with both flags...
npm install --production --force --legacy-peer-deps
if %errorlevel% EQU 0 (
    echo ✅ Dependencies installed successfully with --force --legacy-peer-deps
    goto :start_app
)

echo ❌ All npm install strategies failed. Please check the error messages above.
echo 💡 You may need to manually resolve peer dependency conflicts.
echo 💡 Try running: npm install --production --force --legacy-peer-deps
pause
exit /b 1

:start_app
echo.
echo 🚀 Starting application (server + client)...
start "server" cmd /c start-server.bat
start "client" cmd /c start-client.bat

echo.
echo 🎉 Setup completed. Two windows should be running (server and client).
pause
