@echo off
:: 한글 깨짐 방지 (UTF-8 설정)
chcp 65001 > nul

:: ========================================================
:: 1. 현재 배치 파일이 있는 폴더를 경로로 설정
:: (%~dp0 은 현재 이 파일이 실행되는 드라이브와 경로를 의미합니다)
set FOLDER=%~dp0

:: 경로 맨 뒤에 역슬래시(\)가 있는지 확인하고 없으면 붙이기
if not "%FOLDER:~-1%"=="\" set FOLDER=%FOLDER%\

:: ========================================================
:: 2. esp-port.ini 파일에서 COM_PORT 값 읽어오기
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
pause

call "C:\Espressif\idf_cmd_init.bat" esp-idf-8db3121c30f24411ef389e0fd446d81c

cd /d %FOLDER%

echo.
echo ========================================================
echo  erase-flash 과정 시작 전입니다
echo  엔드디바이스의 전원 버튼을 미리 누른 상태로 엔터(Enter)를 치면 굽기가 시작됩니다.
echo ========================================================
pause

idf.py -p %COM_PORT% erase-flash

echo.
echo ========================================================
echo  flash 과정 시작 직전입니다
echo  엔드디바이스의 전원 버튼을 미리 누른 상태로 엔터(Enter)를 치면 굽기가 시작됩니다.
echo  플래시가 끝난 후 자동으로 모니터 모드로 진입합니다.
echo ========================================================
pause

idf.py -p %COM_PORT% flash monitor

echo 모니터 끝났습니다. 아무키나 눌러주시면 종료됩니다
cmd