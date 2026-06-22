-- =============================================================
-- users 테이블에 fcm_token 컬럼 추가
-- 2026-04-29
-- =============================================================

ALTER TABLE users
  ADD COLUMN fcm_token VARCHAR(255) NULL COMMENT 'Firebase Cloud Messaging 토큰';
