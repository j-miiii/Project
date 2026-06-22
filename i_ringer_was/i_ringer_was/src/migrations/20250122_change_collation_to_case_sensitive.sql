-- Migration: Change collation to case-sensitive (utf8mb4_bin)
-- Date: 2025-01-22
-- Description: 대소문자 구분이 필요한 컬럼들의 collation을 utf8mb4_unicode_ci에서 utf8mb4_bin으로 변경
-- Reason: sn(시리얼번호) 검색 시 iRinger-NcZ0와 iRinger-Ncz0가 구분되지 않는 문제 해결

-- 1. infusion_raw_logs.sn (디바이스 시리얼 번호)
ALTER TABLE infusion_raw_logs
MODIFY sn VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL
COMMENT 'iRinger 디바이스 시리얼 번호';

-- 2. devices.serial_number (디바이스 시리얼 번호)
ALTER TABLE devices
MODIFY serial_number VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;

-- 3. access_tokens.access_token (액세스 토큰)
ALTER TABLE access_tokens
MODIFY access_token TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;

-- 4. access_tokens.refresh_token (리프레시 토큰)
ALTER TABLE access_tokens
MODIFY refresh_token TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;

-- 5. users.password (비밀번호)
ALTER TABLE users
MODIFY password VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
