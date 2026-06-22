CREATE TABLE ward_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ward_id INT NOT NULL,
  fast_enabled TINYINT NOT NULL DEFAULT 1,
  fast_threshold INT NOT NULL DEFAULT 50,
  slow_enabled TINYINT NOT NULL DEFAULT 1,
  slow_threshold INT NOT NULL DEFAULT 50,
  complete_enabled TINYINT NOT NULL DEFAULT 1,
  complete_threshold INT NOT NULL DEFAULT 95,
  stop_enabled TINYINT NOT NULL DEFAULT 1,
  default_gatt INT NOT NULL DEFAULT 60,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uk_ward_id (ward_id)
);

-- 기존 병동별 ward_settings 초기 데이터 생성
INSERT INTO ward_settings (ward_id)
SELECT id FROM wards;
