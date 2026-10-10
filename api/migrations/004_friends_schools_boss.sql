-- Friends (added only with a code shared in person), schools and the weekly Boss Battle.
--   C:\xampp\mysql\bin\mysql.exe -uroot brainsprint < api\migrations\004_friends_schools_boss.sql

-- Children type a school name, so new schools wait for a person to approve them
-- before they appear in public rankings (members still see their own school).
CREATE TABLE IF NOT EXISTS schools (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  district VARCHAR(40) NOT NULL,
  status ENUM('pending', 'approved', 'hidden') NOT NULL DEFAULT 'pending',
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_school (name, district),
  KEY idx_schools_status (status)
) ENGINE=InnoDB;

ALTER TABLE players
  ADD COLUMN friend_code CHAR(6) NULL AFTER badges,
  ADD COLUMN school_id INT UNSIGNED NULL AFTER friend_code,
  ADD UNIQUE KEY uq_friend_code (friend_code),
  ADD CONSTRAINT fk_players_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL;

-- Stored both ways (A→B and B→A) so "my friends" is one simple query.
CREATE TABLE IF NOT EXISTS friends (
  player_id INT UNSIGNED NOT NULL,
  friend_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (player_id, friend_id),
  CONSTRAINT fk_friends_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  CONSTRAINT fk_friends_friend FOREIGN KEY (friend_id) REFERENCES players(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Best Boss Battle result per child per week.
CREATE TABLE IF NOT EXISTS boss_results (
  week_start DATE NOT NULL,
  player_id INT UNSIGNED NOT NULL,
  grade ENUM('TOP','P1','P2','P3','P4','P5','P6','P7') NOT NULL,
  damage SMALLINT UNSIGNED NOT NULL,
  defeated TINYINT(1) NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (week_start, player_id),
  KEY idx_boss_board (week_start, grade, damage),
  CONSTRAINT fk_boss_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
) ENGINE=InnoDB;
