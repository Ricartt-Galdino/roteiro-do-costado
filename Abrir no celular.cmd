@echo off
title Roteiro do Costado - teste no celular
cd /d "C:\Users\User\Documents\ChatGPT\Costado"
echo.
echo Roteiro do Costado esta disponivel no celular em:
echo http://192.168.1.3:5179
echo.
echo Deixe esta janela aberta durante o teste.
echo Preparando a versao para celular...
call npm run build
if errorlevel 1 (
  echo.
  echo Nao foi possivel preparar o app.
  pause
  exit /b 1
)
echo.
echo Abra agora: http://192.168.1.3:5179
call npm run preview -- --port 5179 --strictPort
pause
