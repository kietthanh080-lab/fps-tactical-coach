-- Schema tham khảo cho MySQL / TiDB Cloud (fps_tactical_coach)

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  riot_puuid VARCHAR(128) UNIQUE NULL,
  riot_game_name VARCHAR(100) NULL,
  riot_tag_line VARCHAR(20) NULL,
  riot_access_token TEXT NULL,
  riot_refresh_token TEXT NULL,
  steam_id VARCHAR(50) UNIQUE NULL,
  steam_persona_name VARCHAR(100) NULL,
  steam_avatar TEXT NULL,
  pubg_account_id VARCHAR(100) NULL,
  pubg_player_name VARCHAR(100) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS matches (
  match_id VARCHAR(128) PRIMARY KEY,
  user_id INT NOT NULL,
  game_type ENUM('VALORANT', 'PUBG') NOT NULL,
  map_name VARCHAR(100) NOT NULL,
  game_mode VARCHAR(100) NOT NULL,
  match_result VARCHAR(50) NOT NULL,
  score_summary VARCHAR(100) NULL,
  local_video_filename VARCHAR(255) NULL,
  cloud_video_url TEXT NULL,
  duration_sec INT DEFAULT 0,
  played_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_matches_user_game_played (user_id, game_type, played_at),
  CONSTRAINT fk_matches_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS match_rounds (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  match_id VARCHAR(128) NOT NULL,
  round_number INT NOT NULL,
  start_timestamp_ms BIGINT DEFAULT 0,
  end_timestamp_ms BIGINT DEFAULT 0,
  round_result VARCHAR(30) NOT NULL,
  economy_type VARCHAR(30) NOT NULL,
  tactical_style VARCHAR(50) NOT NULL,
  kills INT DEFAULT 0,
  deaths INT DEFAULT 0,
  assists INT DEFAULT 0,
  damage_dealt INT DEFAULT 0,
  strengths_json LONGTEXT NULL,
  mistakes_json LONGTEXT NULL,
  timeline_events_json LONGTEXT NULL,
  weapon_stats_json LONGTEXT NULL,
  INDEX idx_rounds_match (match_id, round_number),
  CONSTRAINT fk_rounds_match FOREIGN KEY (match_id) REFERENCES matches(match_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS match_reports (
  match_id VARCHAR(128) PRIMARY KEY,
  overall_score DECIMAL(4,1) NOT NULL,
  strengths_summary LONGTEXT NULL,
  weaknesses_summary LONGTEXT NULL,
  recommended_drills LONGTEXT NULL,
  coach_commentary LONGTEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reports_match FOREIGN KEY (match_id) REFERENCES matches(match_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  session_id VARCHAR(64) PRIMARY KEY,
  token TEXT NULL,
  error_message TEXT NULL,
  expires_at DATETIME NOT NULL
);
