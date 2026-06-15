@echo off
:: 한글 깨짐 방지 (UTF-8 설정)
chcp 65001 > nul

:: ========================================================
:: [추가] 마우스 클릭으로 인한 멈춤 방지 (빠른 편집 모드 비활성화)
:: ========================================================
reg add "HKCU\Console" /v QuickEdit /t REG_DWORD /d 0 /f > nul

:: ========================================================
:: 1. 현재 날짜와 시간을 yyyy-mm-dd_hh-mm-ss 형식으로 추출
:: ========================================================
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I

set YEAR=%datetime:~0,4%
set MONTH=%datetime:~4,2%
set DAY=%datetime:~6,2%
set HOUR=%datetime:~8,2%
set MIN=%datetime:~10,2%
set SEC=%datetime:~12,2%

:: 최종 파일명 변수 설정
set FILENAME=로그_%YEAR%-%MONTH%-%DAY%_%HOUR%-%MIN%-%SEC%.txt

:: ========================================================
:: 2. 경로 설정 및 INI 파일 읽기 (기존과 동일)
set FOLDER=%~dp0
if not "%FOLDER:~-1%"=="\" set FOLDER=%FOLDER%\

if exist esp-port.ini (
    for /f "tokens=1,2 delims==" %%a in (esp-port.ini) do (
        if "%%a"=="COM_PORT" set COM_PORT=%%b
    )
) else (
    echo [오류] esp-port.ini 파일을 찾을 수 없습니다!
 
    pause
    exit /b
)

echo 설정된 경로: %FOLDER%
echo 설정된 포트: %COM_PORT%
echo 생성될 파일명: %FILENAME%
pause

call "C:\Espressif\idf_cmd_init.bat" esp-idf-8db3121c30f24411ef389e0fd446d81c

cd /d %FOLDER%

:: ========================================================
:: [핵심 해결책] 파이썬이 인코딩 에러 없이 UTF-8로 저장하도록 설정
:: ========================================================
set PYTHONUTF8=1

:: 표준 리다이렉션 사용
idf.py -p %COM_PORT% monitor > %FILENAME%

echo 로그 기록이 완료되었습니다.
cmd