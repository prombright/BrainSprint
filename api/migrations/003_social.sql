-- Who's online, daily streaks, public player cards and the live activity feed.
--   C:\xampp\mysql\bin\mysql.exe -uroot brainsprint < api\migrations\003_social.sql

ALTER TABLE players
  ADD COLUMN last_seen_at DATETIME NULL AFTER is_demo,
  ADD COLUMN activity VARCHAR(40) NULL AFTER last_seen_at,       -- e.g. "maths:P5:hard" while in a sprint
  ADD COLUMN day_streak SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER activity,
  ADD COLUMN badges TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER day_streak,
  ADD KEY idx_players_seen (last_seen_at);

-- Short public news for the live feed: "Amina got a perfect 10 in P5 Maths".
CREATE TABLE IF NOT EXISTS events (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  player_id INT UNSIGNED NOT NULL,
  kind VARCHAR(20) NOT NULL, -- perfect | streak | big_score | race_win | promoted
  detail VARCHAR(120) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_events_recent (created_at),
  CONSTRAINT fk_events_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
) ENGINE=InnoDB;
