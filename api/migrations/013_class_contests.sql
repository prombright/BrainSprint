-- Class vs class inside one school: two to six classes of the same year answer one server-built paper.
-- Set up by any teacher of the school; no accept step (it's one school), and any of the classes' teachers
-- can call it off before it starts.
CREATE TABLE IF NOT EXISTS class_contests (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id INT UNSIGNED NOT NULL,
  grade ENUM('TOP','P1','P2','P3','P4','P5','P6','P7') NOT NULL,
  subject ENUM('maths','english','science','sst','mixed') NOT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  status ENUM('on','cancelled') NOT NULL DEFAULT 'on',
  paper_id INT UNSIGNED NOT NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_cc_school (school_id, starts_at),
  CONSTRAINT fk_cc_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_cc_paper FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE,
  CONSTRAINT fk_cc_teacher FOREIGN KEY (created_by) REFERENCES teachers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS class_contest_classes (
  contest_id INT UNSIGNED NOT NULL,
  class_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (contest_id, class_id),
  KEY idx_ccc_class (class_id),
  CONSTRAINT fk_ccc_contest FOREIGN KEY (contest_id) REFERENCES class_contests(id) ON DELETE CASCADE,
  CONSTRAINT fk_ccc_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- the class a child played for, like school_id for school contests
ALTER TABLE paper_attempts ADD COLUMN class_id INT UNSIGNED NULL AFTER school_id;
