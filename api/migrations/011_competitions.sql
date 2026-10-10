-- Competitions marked by the server: school-vs-school contests and one-to-one duels between friends.
-- Both use a paper the server builds and keeps; phones only ever get the questions without the answers.

-- a teacher speaks for one school (chosen from approved schools); a school can stop accepting challenges
ALTER TABLE teachers ADD COLUMN school_id INT UNSIGNED NULL AFTER school,
  ADD CONSTRAINT fk_teachers_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL;
ALTER TABLE schools ADD COLUMN open_to_challenges TINYINT(1) NOT NULL DEFAULT 1 AFTER status;

-- one paper: the questions with their answers (never sent before the results are out)
CREATE TABLE IF NOT EXISTS papers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  subject ENUM('maths','english','science','sst','mixed') NOT NULL,
  grade ENUM('TOP','P1','P2','P3','P4','P5','P6','P7') NOT NULL,
  questions JSON NOT NULL,
  minutes TINYINT UNSIGNED NOT NULL, -- time each child has once they start
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- one child's go at a paper: started_at/deadline come from the server's clock
CREATE TABLE IF NOT EXISTS paper_attempts (
  paper_id INT UNSIGNED NOT NULL,
  player_id INT UNSIGNED NOT NULL,
  school_id INT UNSIGNED NULL, -- the side they played for (school contests), kept even if they move school
  started_at DATETIME NOT NULL,
  deadline DATETIME NOT NULL,
  submitted_at DATETIME NULL,
  picks JSON NULL,
  correct TINYINT UNSIGNED NULL,
  seconds SMALLINT UNSIGNED NULL, -- time used, the tie-break
  PRIMARY KEY (paper_id, player_id),
  KEY idx_attempts_board (paper_id, correct, seconds),
  CONSTRAINT fk_pa_paper FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE,
  CONSTRAINT fk_pa_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- school A challenges school B; the paper is built when B accepts
CREATE TABLE IF NOT EXISTS school_contests (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_a INT UNSIGNED NOT NULL,
  school_b INT UNSIGNED NOT NULL,
  created_by INT UNSIGNED NULL, -- the challenging teacher
  answered_by INT UNSIGNED NULL, -- the teacher who accepted or declined
  grade ENUM('TOP','P1','P2','P3','P4','P5','P6','P7') NOT NULL,
  subject ENUM('maths','english','science','sst','mixed') NOT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  status ENUM('pending','accepted','declined','cancelled') NOT NULL DEFAULT 'pending',
  paper_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_contests_a (school_a, starts_at),
  KEY idx_contests_b (school_b, starts_at),
  CONSTRAINT fk_sc_a FOREIGN KEY (school_a) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_sc_b FOREIGN KEY (school_b) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_sc_by FOREIGN KEY (created_by) REFERENCES teachers(id) ON DELETE SET NULL,
  CONSTRAINT fk_sc_ans FOREIGN KEY (answered_by) REFERENCES teachers(id) ON DELETE SET NULL,
  CONSTRAINT fk_sc_paper FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- a child challenges a friend: same paper, each plays once before it expires
CREATE TABLE IF NOT EXISTS duels (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  paper_id INT UNSIGNED NOT NULL,
  challenger_id INT UNSIGNED NOT NULL,
  opponent_id INT UNSIGNED NOT NULL,
  grade ENUM('TOP','P1','P2','P3','P4','P5','P6','P7') NOT NULL,
  subject ENUM('maths','english','science','sst','mixed') NOT NULL,
  status ENUM('open','declined') NOT NULL DEFAULT 'open',
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_duels_challenger (challenger_id, created_at),
  KEY idx_duels_opponent (opponent_id, created_at),
  CONSTRAINT fk_duels_paper FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE,
  CONSTRAINT fk_duels_challenger FOREIGN KEY (challenger_id) REFERENCES players(id) ON DELETE CASCADE,
  CONSTRAINT fk_duels_opponent FOREIGN KEY (opponent_id) REFERENCES players(id) ON DELETE CASCADE
) ENGINE=InnoDB;
