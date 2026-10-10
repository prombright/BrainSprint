-- Teachers, their classes (pupils join with a code), and homework.

CREATE TABLE IF NOT EXISTS teachers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  school VARCHAR(80) NULL,
  failed_logins TINYINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS teacher_tokens (
  token_hash CHAR(64) PRIMARY KEY,
  teacher_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ttokens_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS classes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  teacher_id INT UNSIGNED NOT NULL,
  name VARCHAR(40) NOT NULL,
  grade ENUM('TOP','P1','P2','P3','P4','P5','P6','P7') NOT NULL,
  code CHAR(6) NOT NULL UNIQUE, -- pupils type this to join
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_classes_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS class_members (
  class_id INT UNSIGNED NOT NULL,
  player_id INT UNSIGNED NOT NULL,
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (class_id, player_id),
  KEY idx_members_player (player_id),
  CONSTRAINT fk_cm_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  CONSTRAINT fk_cm_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- homework: one sprint at a level, or practice on one topic, due by a date
CREATE TABLE IF NOT EXISTS assignments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  class_id INT UNSIGNED NOT NULL,
  title VARCHAR(80) NOT NULL,
  subject ENUM('maths','english','science','sst') NOT NULL,
  level ENUM('simple','medium','hard','pro') NULL,
  topic VARCHAR(40) NULL,
  due_on DATE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_assign_class (class_id, due_on),
  CONSTRAINT fk_assign_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- each pupil's best attempt at a piece of homework
CREATE TABLE IF NOT EXISTS assignment_results (
  assignment_id INT UNSIGNED NOT NULL,
  player_id INT UNSIGNED NOT NULL,
  correct TINYINT UNSIGNED NOT NULL,
  total TINYINT UNSIGNED NOT NULL,
  score SMALLINT UNSIGNED NOT NULL,
  completed_at DATETIME NOT NULL,
  PRIMARY KEY (assignment_id, player_id),
  CONSTRAINT fk_ar_assign FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
  CONSTRAINT fk_ar_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
) ENGINE=InnoDB;
