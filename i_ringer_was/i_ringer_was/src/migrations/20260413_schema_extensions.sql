-- =============================================================
-- iRinger 스키마 확장 마이그레이션
-- 2026-04-13
-- =============================================================

-- ---------------------------------------------------------
-- 1. patient_bed_assignments: alert_type enum 변경 (end → almost_done) + 컬럼 추가
-- ---------------------------------------------------------

-- Step 1: enum 확장 (end 유지 + almost_done 추가)
ALTER TABLE patient_bed_assignments
  MODIFY COLUMN alert_type ENUM('stop','done','fast','slow','end','almost_done','disconnected') NULL;

-- Step 2: 데이터 마이그레이션
UPDATE patient_bed_assignments SET alert_type = 'almost_done' WHERE alert_type = 'end';

-- Step 3: end 제거
ALTER TABLE patient_bed_assignments
  MODIFY COLUMN alert_type ENUM('stop','done','fast','slow','almost_done','disconnected') NULL COMMENT '알림 타입';

-- Step 4: 새 컬럼 추가
ALTER TABLE patient_bed_assignments
  ADD COLUMN status ENUM('pending','infusing','paused','completed','canceled') DEFAULT 'pending' COMMENT '투여 상태',
  ADD COLUMN is_active BOOLEAN DEFAULT true COMMENT '활성 여부',
  ADD COLUMN started_at DATETIME NULL COMMENT '투여 시작 시간',
  ADD COLUMN stopped_at DATETIME NULL COMMENT '투여 중지 시간',
  ADD COLUMN alert_category ENUM('critical','caution','system_error') NULL COMMENT '알림 카테고리';


-- ---------------------------------------------------------
-- 2. users: 3개 컬럼 추가
-- ---------------------------------------------------------

ALTER TABLE users
  ADD COLUMN employee_number VARCHAR(50) NULL UNIQUE COMMENT '사번 (최초 설정 후 변경 불가)',
  ADD COLUMN profile_image VARCHAR(500) DEFAULT '/images/default_profile.png' COMMENT '프로필 이미지';


-- ---------------------------------------------------------
-- 3. notifications: type enum 변경 (end → almost_done) + alert_category 추가
-- ---------------------------------------------------------

-- Step 1: enum 확장 (end 유지 + almost_done, done, disconnected 추가)
ALTER TABLE notifications
  MODIFY COLUMN type ENUM('slow','fast','end','stop','almost_done','done','disconnected') NULL;

-- Step 2: 데이터 마이그레이션
UPDATE notifications SET type = 'almost_done' WHERE type = 'end';

-- Step 3: end 제거
ALTER TABLE notifications
  MODIFY COLUMN type ENUM('slow','fast','almost_done','stop','done','disconnected') NULL;

-- Step 4: alert_category 추가
ALTER TABLE notifications
  ADD COLUMN alert_category ENUM('critical','caution','system_error') NULL COMMENT '알림 카테고리';


-- ---------------------------------------------------------
-- 4. 새 테이블: nurse_room_assignments (간호사 병실 배정)
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS nurse_room_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL COMMENT '간호사 user_id',
  room_id INT NOT NULL COMMENT '병실 ID',
  is_active BOOLEAN DEFAULT true COMMENT '활성 여부',
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '배정 시간',
  released_at DATETIME NULL COMMENT '해제 시간',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
) COMMENT='간호사 병실 배정';


-- ---------------------------------------------------------
-- 5. 새 테이블: terms (약관)
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS terms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL COMMENT '약관 제목',
  content TEXT NOT NULL COMMENT '약관 내용',
  version VARCHAR(20) NOT NULL COMMENT '약관 버전',
  type ENUM('privacy','service','marketing','location') NOT NULL COMMENT '약관 유형',
  is_required BOOLEAN DEFAULT true COMMENT '필수 동의 여부',
  is_active BOOLEAN DEFAULT true COMMENT '활성 여부',
  effective_at DATETIME NULL COMMENT '시행일',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) COMMENT='약관 관리';


-- ---------------------------------------------------------
-- 6. 새 테이블: user_term_agreements (사용자 약관 동의)
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_term_agreements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL COMMENT '사용자 ID',
  term_id INT NOT NULL COMMENT '약관 ID',
  agreed_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '동의 시간',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE CASCADE
) COMMENT='사용자 약관 동의';


-- ---------------------------------------------------------
-- 7. 새 테이블: infusion_event_logs (수액 투여 이벤트 로그)
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS infusion_event_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_bed_assignment_id INT NOT NULL COMMENT '환자 침대 배정 ID',
  event_type ENUM('start','pause','resume','complete','cancel','alert','modify') NOT NULL COMMENT '이벤트 유형',
  before_value JSON NULL COMMENT '변경 전 값',
  after_value JSON NULL COMMENT '변경 후 값',
  performed_by INT NULL COMMENT '수행자 (간호사 user_id)',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_bed_assignment_id) REFERENCES patient_bed_assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL
) COMMENT='수액 투여 이벤트 로그';


-- ---------------------------------------------------------
-- 8. user_settings: 알림 카테고리별 설정 + 수액량 표시 모드 추가
-- ---------------------------------------------------------

ALTER TABLE user_settings
  ADD COLUMN critical_alert_enabled TINYINT NOT NULL DEFAULT 1 COMMENT '위급 알림 활성화',
  ADD COLUMN critical_sound_enabled TINYINT NOT NULL DEFAULT 1 COMMENT '위급 소리 활성화',
  ADD COLUMN caution_alert_enabled TINYINT NOT NULL DEFAULT 1 COMMENT '주의 알림 활성화',
  ADD COLUMN caution_sound_enabled TINYINT NOT NULL DEFAULT 1 COMMENT '주의 소리 활성화',
  ADD COLUMN system_error_alert_enabled TINYINT NOT NULL DEFAULT 1 COMMENT '시스템오류 알림 활성화',
  ADD COLUMN system_error_sound_enabled TINYINT NOT NULL DEFAULT 1 COMMENT '시스템오류 소리 활성화',
  ADD COLUMN volume_display_mode VARCHAR(20) NOT NULL DEFAULT 'percentage' COMMENT '수액량 표시 모드 (percentage/ml)';
