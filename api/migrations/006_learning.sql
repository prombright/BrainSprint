-- How each child is doing topic by topic (for weak-spot practice, parents and teachers),
-- practice sprints that mix levels, and PLE mock exam results.

-- running totals per child per topic ("fractions", "place value", "word problem" …)
CREATE TABLE IF NOT EXISTS topic_stats (
  player_id INT UNSIGNED NOT NULL,
  subject ENUM('maths','english','science','sst') NOT NULL,
  grade ENUM('TOP','P1','P2','P3','P4','P5','P6','P7') NOT NULL,
  topic VARCHAR(40) NOT NULL,
  correct INT UNSIGNED NOT NULL DEFAULT 0,
  total INT UNSIGNED NOT NULL DEFAULT 0,
  recent_correct TINYINT UNSIGNED NOT NULL DEFAULT 0, -- out of the last answers, see recent_total
  recent_total TINYINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (player_id, subject, grade, topic),
  CONSTRAINT fk_topics_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- practice sprints mix questions from several levels
ALTER TABLE sprints MODIFY level ENUM('simple','medium','hard','pro','mixed') NOT NULL;

-- PLE-style mock exams (P6/P7)
CREATE TABLE IF NOT EXISTS mock_results (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  player_id INT UNSIGNED NOT NULL,
  grade ENUM('TOP','P1','P2','P3','P4','P5','P6','P7') NOT NULL,
  correct TINYINT UNSIGNED NOT NULL,
  total TINYINT UNSIGNED NOT NULL,
  minutes_used SMALLINT UNSIGNED NOT NULL,
  topics JSON NOT NULL, -- {"fractions": [3, 4], …} correct / asked per topic
  taken_at DATETIME NOT NULL,
  KEY idx_mocks_player (player_id, taken_at),
  CONSTRAINT fk_mocks_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
) ENGINE=InnoDB;
