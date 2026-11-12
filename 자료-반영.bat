@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 초기불교경전 - 자료 반영

where node >nul 2>nul
if errorlevel 1 goto nonode

if exist node_modules goto convert
echo.
echo [처음 실행] 필요한 프로그램을 설치합니다. 몇 분 걸립니다...
call npx --yes pnpm@12.16.1 install
if errorlevel 1 goto fail

:convert
echo.
echo [1/2] content 폴더의 자료를 검사하고 변환합니다...
call npx --yes pnpm@12.16.1 build:content
if errorlevel 1 goto badcontent

echo.
echo [2/2] 앱을 다시 만듭니다. 3~10분 걸립니다...
call npx --yes pnpm@12.16.1 build
if errorlevel 1 goto fail

echo.
echo 반영했습니다. 브라우저에서 앱을 엽니다. 다 쓰면 이 검은 창을 닫으세요.
rem 시험할 때는 NO_BROWSER=1 로 브라우저 열기를 건너뛴다
if not defined NO_BROWSER start "" http://localhost:4321
node scripts\serve.mjs
goto end

:badcontent
echo.
echo 자료에 고칠 곳이 있어 반영하지 않았습니다. 앱은 이전 그대로입니다.
echo 위의 "변환 실패" 아래 목록에 어느 경, 어느 문장이 틀렸는지 나와 있습니다.
pause
goto end

:nonode
echo.
echo Node.js 가 설치되어 있지 않습니다.
echo https://nodejs.org 에서 LTS 버전을 설치한 뒤 이 파일을 다시 실행하세요.
pause
goto end

:fail
echo.
echo 문제가 생겨 멈췄습니다. 위의 메시지를 복사해 개발자에게 보내 주세요.
pause

:end
