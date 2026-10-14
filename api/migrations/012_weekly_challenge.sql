-- The Weekly Challenge: one server-built paper per class per Kampala week, open to every child in that class.
-- Attempts go in paper_attempts (school_id = the child's school when they started, for the school table).
CREATE TABLE IF NOT EXISTS weekly_challenges (
  week_start DATE NOT NULL,
  grade ENUM('TOP','P1','P2','P3','P4','P5','P6','P7') NOT NULL,
  paper_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (week_start, grade),
  CONSTRAINT fk_wc_paper FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
) ENGINE=InnoDB;
