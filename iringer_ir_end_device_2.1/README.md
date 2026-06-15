# IRINGER IR End Device 2.1

## 개요
IRINGER IR End Device v2.1은 새로운 하드웨어 기판을 기반으로 한 개선된 버전입니다.

## 주요 변경사항 (v2.0 → v2.1)

### 하드웨어 변경
- 새로운 핀맵 적용
- IR 센서 수신부: GPIO10 → GPIO3 (LP GPIO)
- 버저: GPIO11 → GPIO5
- 신규 기능 추가: CAPACITOR_SENSOR (GPIO0), TIMER_ON (GPIO2)

### 소프트웨어 개선
- 전송 주기 최적화: 30초 → 5분
- Light Sleep 조건부 Wake-up (GTT 30% 변화 감지)
- 다운링크 1회만 수신
- LED 제어 최적화
- LCD 백라이트 제어 개선
- UI 개선

## 구현 계획
자세한 구현 계획은 `구현_계획_20251209.md`를 참고하세요.

## 빌드 방법

```bash
cd iringer_ir_end_device_2.1
idf.py build
idf.py flash monitor
```

## 참고 문서
- `구현_계획_20251209.md`: 전체 구현 계획
- `GTT_측정_최소시간_대응방안.md`: GTT 측정 제약사항 및 대응 방안
- `ESP32-C6_LP_Core_사용방법.md`: LP Core 활용 방법
- `LP_Core_1000Hz_비트스트림_분석_가능성_분석.md`: LP Core 비트스트림 분석 가능성







