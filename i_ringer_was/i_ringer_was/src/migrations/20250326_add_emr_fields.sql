-- Migration: EMR 연동을 위한 DB 스키마 확장
-- Date: 2025-03-26
-- Description: IUH_FINENURSE API 연동에 필요한 필드 및 테이블 추가

-- =============================================
-- 1. wards 테이블 - 병동코드 추가
-- =============================================
ALTER TABLE wards
ADD COLUMN code VARCHAR(20) NULL COMMENT 'EMR 병동코드';

-- =============================================
-- 2. rooms 테이블 - 병실코드/유형 추가
-- =============================================
ALTER TABLE rooms
ADD COLUMN code VARCHAR(20) NULL COMMENT 'EMR 병실코드',
ADD COLUMN type VARCHAR(50) NULL COMMENT '병실유형 (예: 4인용병실)';

-- =============================================
-- 3. patients 테이블 - 환자 상세정보 추가
-- =============================================
ALTER TABLE patients
ADD COLUMN sex VARCHAR(1) NULL COMMENT '성별 (M/F)',
ADD COLUMN age INT NULL COMMENT '나이',
ADD COLUMN dob VARCHAR(10) NULL COMMENT '생년월일 (YYMMDD)',
ADD COLUMN dept VARCHAR(20) NULL COMMENT '진료과 코드',
ADD COLUMN doc VARCHAR(50) NULL COMMENT '진료의',
ADD COLUMN resident VARCHAR(50) NULL COMMENT '주치의',
ADD COLUMN pa_nurse VARCHAR(50) NULL COMMENT '담당간호사',
ADD COLUMN adm VARCHAR(50) NULL COMMENT '환자 visit별 고유번호';

-- =============================================
-- 4. users 테이블 - EMR 사용자 정보 추가
-- =============================================
ALTER TABLE users
ADD COLUMN emr_user_key VARCHAR(50) NULL COMMENT 'EMR 로그인 시 user 고유키',
ADD COLUMN emr_group_code VARCHAR(50) NULL COMMENT 'EMR 권한코드',
ADD COLUMN emr_group_desc VARCHAR(100) NULL COMMENT 'EMR 권한설명',
ADD COLUMN dept_code VARCHAR(20) NULL COMMENT '근무 부서코드';

-- =============================================
-- 5. patient_vitals 테이블 신규 생성
-- =============================================
CREATE TABLE patient_vitals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NULL,
  adm VARCHAR(50) NULL COMMENT 'visit 고유번호',
  date VARCHAR(10) NULL COMMENT '기록일자 (YYYYMMDD)',
  time VARCHAR(10) NULL COMMENT '기록시간 (HHmm)',
  nurse_key VARCHAR(50) NULL COMMENT '입력자 EMR key',
  height DECIMAL(5,1) NULL COMMENT '신장 (cm)',
  weight DECIMAL(5,1) NULL COMMENT '체중 (kg)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_patient_vitals_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 6. drug_orders 테이블 신규 생성
-- =============================================
CREATE TABLE drug_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NULL,
  order_code VARCHAR(50) NULL COMMENT '처방코드 (ORDCD)',
  order_name VARCHAR(200) NULL COMMENT '처방명 (ORDNM)',
  order_date VARCHAR(10) NULL COMMENT '처방일자 (ORDDTE)',
  bundle_no VARCHAR(50) NULL COMMENT '처방묶음번호',
  bundle_yn VARCHAR(1) NULL COMMENT '묶음약여부 (Y/N)',
  drug_count INT NULL COMMENT '총투여횟수',
  acted_count INT NULL COMMENT '투여한 횟수',
  act_count INT NULL COMMENT 'Acting 가능 횟수',
  dc_yn VARCHAR(1) NULL COMMENT '처방취소여부 (Y/N)',
  qty VARCHAR(50) NULL COMMENT '용량 (예: 1TB)',
  method_name VARCHAR(100) NULL COMMENT '용법',
  prescription_class_name TEXT NULL COMMENT '처방분류명',
  is_fluid VARCHAR(1) NULL COMMENT '수액여부 (Y/공백)',
  act_info TEXT NULL COMMENT 'Acting 수행정보',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_drug_orders_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 7. patient_bed_assignments 테이블 - drug_order FK 추가
-- =============================================
ALTER TABLE patient_bed_assignments
ADD COLUMN drug_order_id INT NULL;

ALTER TABLE patient_bed_assignments
ADD CONSTRAINT fk_pba_drug_order FOREIGN KEY (drug_order_id) REFERENCES drug_orders(id) ON DELETE SET NULL;
