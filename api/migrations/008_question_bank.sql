-- Question bank: worked steps, who wrote each question, and teacher suggestions awaiting review.

ALTER TABLE questions
  ADD COLUMN steps JSON NULL AFTER answer,                           -- ["Step one", "Step two"]
  ADD COLUMN source VARCHAR(80) NULL AFTER status,                   -- "admin:prombright", "import:starter.csv", …
  ADD COLUMN teacher_id INT UNSIGNED NULL AFTER source,              -- set when a teacher suggested it
  ADD COLUMN review_note VARCHAR(255) NULL AFTER teacher_id,         -- why a suggestion was sent back
  ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at,
  ADD KEY idx_questions_teacher (teacher_id),
  ADD CONSTRAINT fk_questions_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL;
