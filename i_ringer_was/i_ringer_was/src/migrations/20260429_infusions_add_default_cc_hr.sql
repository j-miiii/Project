-- infusions 테이블에 default_cc_hr 컬럼 추가
ALTER TABLE `infusions`
  ADD COLUMN `default_cc_hr` INT NULL COMMENT '기본 유속 (cc/hr)' AFTER `default_gtt`;

-- 깔끔한 cc/hr 기본값 설정
UPDATE `infusions` SET `default_cc_hr` = 200 WHERE `code` = 'NS';
UPDATE `infusions` SET `default_cc_hr` = 200 WHERE `code` = 'DW';
UPDATE `infusions` SET `default_cc_hr` = 240 WHERE `code` = 'HD';
UPDATE `infusions` SET `default_cc_hr` = 200 WHERE `code` = 'LR';
UPDATE `infusions` SET `default_cc_hr` = 120 WHERE `code` = 'KCL';
UPDATE `infusions` SET `default_cc_hr` = 200 WHERE `code` = 'ABX';
UPDATE `infusions` SET `default_cc_hr` = 240 WHERE `code` = 'TPN';
UPDATE `infusions` SET `default_cc_hr` = 200 WHERE `code` = 'AA';
