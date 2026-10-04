@echo off
REM Windows: double-click this file to start SpeakWell on your own computer.
cd /d "%~dp0"
echo SpeakWell: starting on your computer...
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is not installed. Download the LTS version from https://nodejs.org, install it, then double-click this file again.
  pause
  exit /b 1
)
if not exist .env (
  echo.
  echo Optional: add your AI keys. Paste a key and press Enter, or just press Enter to skip.
  echo Keys are saved only in a file called .env in this folder. Delete that file to start over.
  echo.
  set "ANTHROPIC_IN="
  set "OPENAI_IN="
  set /p ANTHROPIC_IN="Anthropic key (coaching note + role-play partner): "
  set /p OPENAI_IN="OpenAI key (transcription; press Enter to use the free browser path): "
  (
    echo ANTHROPIC_API_KEY=%ANTHROPIC_IN%
    echo OPENAI_API_KEY=%OPENAI_IN%
    echo PORT=3000
  ) > .env
  echo Saved.
)
if not exist node_modules (
  echo First run: downloading the app's two building blocks ^(takes about a minute^)...
  call npm install --omit=dev
  if errorlevel 1 (
    echo Install failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)
echo.
echo Opening http://localhost:3000 in your browser. Keep this window open while you use the app.
echo To stop: close this window.
echo.
start "" http://localhost:3000
call npm start
pause
