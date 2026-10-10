-- Fact Engine: tables of checked facts that the app turns into many questions.
-- A fact set is a small table ("Body organs": organ | job | system) plus question patterns
-- ("Which organ {job}?" → answer column "organ"). See docs/algorithms.md.

CREATE TABLE IF NOT EXISTS fact_sets (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  subject ENUM('maths','english','science','sst') NOT NULL,
  name VARCHAR(60) NOT NULL,           -- also the topic name in reports, e.g. "body organs"
  grade_from ENUM('TOP','P1','P2','P3','P4','P5','P6','P7') NOT NULL,
  grade_to ENUM('TOP','P1','P2','P3','P4','P5','P6','P7') NOT NULL,
  columns JSON NOT NULL,               -- ["organ", "job", "system"]
  templates JSON NOT NULL,             -- [{"ask": "Which organ {job}?", "answer": "organ", "level": "simple"}, …]
  `explain` VARCHAR(255) NULL,         -- "The {organ} {job}. It is part of the {system} system."
  status ENUM('draft','approved','retired') NOT NULL DEFAULT 'draft',
  source VARCHAR(80) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_fact_set (subject, name),
  KEY idx_fact_sets_pick (subject, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS facts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  set_id INT UNSIGNED NOT NULL,
  `values` JSON NOT NULL,              -- ["heart", "pumps blood", "circulatory"], in column order
  position SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  KEY idx_facts_set (set_id, position),
  CONSTRAINT fk_facts_set FOREIGN KEY (set_id) REFERENCES fact_sets(id) ON DELETE CASCADE
) ENGINE=InnoDB;
