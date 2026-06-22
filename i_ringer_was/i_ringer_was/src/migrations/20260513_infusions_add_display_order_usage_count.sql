-- ============================================================
-- infusions 테이블에 display_order, usage_count 컬럼 추가
-- ============================================================
ALTER TABLE `infusions`
  ADD COLUMN `display_order` INT NOT NULL DEFAULT 0 COMMENT '표시순서' AFTER `is_active`,
  ADD COLUMN `usage_count` INT NOT NULL DEFAULT 0 COMMENT '사용횟수' AFTER `display_order`;
