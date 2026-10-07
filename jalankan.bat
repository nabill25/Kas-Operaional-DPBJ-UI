@echo off
setlocal
title Kas Operasional DPBJ UI
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [!] Node.js belum terpasang. Unduh versi 22.22 atau lebih baru dari https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Menginstal dependensi untuk pertama kali, mohon tunggu...
  call npm install
  if errorlevel 1 (
    echo [!] Instalasi gagal. Periksa koneksi internet lalu jalankan ulang.
    pause
    exit /b 1
  )
)

echo.
echo  Kas Operasional DPBJ UI
echo  Aplikasi : http://localhost:5210
echo  Masuk dengan email + password akun Supabase Auth (profil dibuat admin).
echo  Butuh file .env berisi DATABASE_URL dan kunci Supabase (lihat .env.example).
echo  Tekan Ctrl+C untuk menghentikan server.
echo.

rem Buka browser beberapa detik setelah server menyala.
start "" /min cmd /c "timeout /t 6 /nobreak >nul & start http://localhost:5210"
call npm run dev
endlocal
