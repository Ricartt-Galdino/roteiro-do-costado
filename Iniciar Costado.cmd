@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Instale o Node.js LTS para abrir este app.
 pause
 exit /b 1
)
if not exist node_modules call npm install
if not exist dist call npm run build
echo.
echo Abra http://localhost:5178 no navegador.
echo Mantenha esta janela aberta enquanto usa o app.
call npm run preview -- --port 5178 --strictPort
pause
