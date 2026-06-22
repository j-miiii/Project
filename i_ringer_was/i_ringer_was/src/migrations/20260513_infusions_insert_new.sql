-- ============================================================
-- 1. code 컬럼 UNIQUE 제약 제거 + nullable 변경
-- ============================================================
ALTER TABLE `infusions` DROP INDEX `UQ_infusions_code`;
ALTER TABLE `infusions` MODIFY COLUMN `code` VARCHAR(20) NULL COMMENT '영문 약어 (NS, DW, HD 등)';

-- ============================================================
-- 2. 새로운 수액 데이터 INSERT (22개)
-- ============================================================
INSERT INTO `infusions` (`name`, `code`, `default_volume`, `default_gtt`, `default_cchr`, `is_active`, `display_order`, `usage_count`) VALUES
  ('5% Dextrose Water',   '5D',   NULL, NULL, NULL, 1,  1, 0),
  ('10% Dextrose Water',  '10D',  NULL, NULL, NULL, 1,  2, 0),
  ('50% Dextrose Water',  '50D',  NULL, NULL, NULL, 1,  3, 0),
  ('Normal Saline',       'NS',   NULL, NULL, NULL, 1,  4, 0),
  ('0.45% Normal Saline', 'HNS',  NULL, NULL, NULL, 1,  5, 0),
  ('Hartmann Solution',   'HS',   NULL, NULL, NULL, 1,  6, 0),
  ('Hartmann Dextrose',   'HD',   NULL, NULL, NULL, 1,  7, 0),
  ('5% Dextrose Saline',  '5DS',  NULL, NULL, NULL, 1,  8, 0),
  ('10% Nak',             '10NK', NULL, NULL, NULL, 1,  9, 0),
  ('5% Nak',              '5NK',  NULL, NULL, NULL, 1, 10, 0),
  ('SD 1:4',              '14SD', NULL, NULL, NULL, 1, 11, 0),
  ('NS K40',              'NSK4', NULL, NULL, NULL, 1, 12, 0),
  ('Mannitol',            'MNTL', NULL, NULL, NULL, 1, 13, 0),
  ('Plasma sol A',        'PLZA', NULL, NULL, NULL, 1, 14, 0),
  ('Distilled Water',     'DIW',  NULL, NULL, NULL, 1, 15, 0),
  ('Klenzo',              'CLZO', NULL, NULL, NULL, 1, 16, 0),
  ('Omaroswon',           'OMA',  NULL, NULL, NULL, 1, 17, 0),
  ('WINuf Peri',          'WNFP', NULL, NULL, NULL, 1, 18, 0),
  ('PeriOlimel',          'PRM',  NULL, NULL, NULL, 1, 19, 0),
  ('WINuf Central',       'WNF',  NULL, NULL, NULL, 1, 20, 0),
  ('WINuf A Plus',        'WAP',  NULL, NULL, NULL, 1, 21, 0),
  ('Ntense EF',           'NEF',  NULL, NULL, NULL, 1, 22, 0);
