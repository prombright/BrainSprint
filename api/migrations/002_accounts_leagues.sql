-- Player tokens, XP, weekly leagues and parent logins.
-- Run once on a database created from schema.sql:
--   C:\xampp\mysql\bin\mysql.exe -uroot brainsprint < api\migrations\002_accounts_leagues.sql

-- A device proves it owns a player with a secret token (only its hash is stored).
ALTER TABLE players
  ADD COLUMN token_hash CHAR(64) NULL AFTER device_id,
  ADD COLUMN xp_total INT UNSIGNED NOT NULL DEFAULT 0 AFTER grade,
  ADD COLUMN tier TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER xp_total, -- 0 Bronze … 4 Champion
  ADD COLUMN is_demo TINYINT(1) NOT NULL DEFAULT 0 AFTER tier;      -- local test players only

-- One league group per (week, class, tier), at most 30 players.
CREATE TABLE IF NOT EXISTS league_groups (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  week_start DATE NOT NULL, -- Monday, Kampala time
  grade ENUM('TOP','P1','P2','P3','P4','P5','P6','P7') NOT NULL,
  tier TINYINT UNSIGNED NOT NULL,
  size TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_groups_find (week_start, grade, tier, size)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS league_members (
  week_start DATE NOT NULL,
  player_id INT UNSIGNED NOT NULL,
  group_id INT UNSIGNED NOT NULL,
  xp INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (week_start, player_id),
  KEY idx_members_group (group_id, xp),
  CONSTRAINT fk_members_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  CONSTRAINT fk_members_group FOREIGN KEY (group_id) REFERENCES league_groups(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Parent sign-in: phone + 4-digit PIN, locked for a while after repeated wrong PINs.
ALTER TABLE parents
  ADD COLUMN failed_logins TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER pin_hash,
  ADD COLUMN locked_until DATETIME NULL AFTER failed_logins;

CREATE TABLE IF NOT EXISTS parent_tokens (
  token_hash CHAR(64) PRIMARY KEY,
  parent_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ptokens_parent FOREIGN KEY (parent_id) REFERENCES parents(id) ON DELETE CASCADE
) ENGINE=InnoDB;
