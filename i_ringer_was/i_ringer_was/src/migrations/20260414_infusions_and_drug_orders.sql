-- ============================================================
-- 1. infusions 마스터 테이블 생성
-- ============================================================
CREATE TABLE IF NOT EXISTS `infusions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(20) NOT NULL COMMENT '영문 약어 (NS, DW, HD 등)',
  `name` VARCHAR(100) NOT NULL COMMENT '수액명',
  `default_volume` INT NULL COMMENT '기본 용량 (ml)',
  `default_gtt` INT NULL COMMENT '기본 유속 (gtt/min)',
  `description` VARCHAR(500) NULL COMMENT '설명',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '활성 여부',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_infusions_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. 초기 수액 데이터 INSERT (8종)
-- ============================================================
INSERT INTO `infusions` (`code`, `name`, `default_volume`, `default_gtt`) VALUES
  ('NS',  '생리식염수',     500,  60),
  ('DW',  '5% 포도당',     500,  60),
  ('HD',  '하트만용액',     500,  80),
  ('LR',  '링거액',       1000,  60),
  ('KCL', 'KCL 수액',      500,  40),
  ('ABX', '항생제',        100,  60),
  ('TPN', '영양수액',     1000,  80),
  ('AA',  '아미노산수액',   500,  60);

-- ============================================================
-- 3. drug_orders 테이블 간소화 (DROP 후 재생성)
--    주의: 기존 데이터 0건 전제
-- ============================================================
DROP TABLE IF EXISTS `drug_orders`;

CREATE TABLE `drug_orders` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `patient_id` INT NULL,
  `infusion_id` INT NULL COMMENT '수액 종류 ID (infusions FK)',
  `order_code` VARCHAR(50) NULL COMMENT '처방 코드',
  `volume` INT NULL COMMENT '처방 용량 (ml)',
  `gtt` INT NULL COMMENT '처방 유속 (gtt/min)',
  `order_date` VARCHAR(10) NULL COMMENT '처방 일자 (YYYYMMDD)',
  `status` ENUM('active','completed','canceled') NOT NULL DEFAULT 'active' COMMENT '처방 상태',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `FK_drug_orders_patient` (`patient_id`),
  KEY `FK_drug_orders_infusion` (`infusion_id`),
  CONSTRAINT `FK_drug_orders_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_drug_orders_infusion` FOREIGN KEY (`infusion_id`) REFERENCES `infusions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. patient_bed_assignments에 infusion_id 컬럼 추가
-- ============================================================
ALTER TABLE `patient_bed_assignments`
  ADD COLUMN `infusion_id` INT NULL COMMENT '수액 ID' AFTER `drug_order_id`;
