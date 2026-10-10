-- BrainSprint Kids database
-- Local setup: mysql -uroot < api/schema.sql

CREATE DATABASE IF NOT EXISTS brainsprint CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE brainsprint;

-- Grown-ups own the account and pay. Children never log in with a phone number.
CREATE TABLE IF NOT EXISTS parents (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(20) NOT NULL UNIQUE, -- MoMo / Airtel number, e.g. 2567XXXXXXXX
  name VARCHAR(80) NULL,
  pin_hash VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- A child profile. Starts anonymous on a device; linked to a parent once they sign up.
CREATE TABLE IF NOT EXISTS players (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parent_id INT UNSIGNED NULL,
  device_id VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(30) NOT NULL,
  avatar VARCHAR(16) NOT NULL,
  grade ENUM('TOP','P1','P2','P3','P4','P5','P6','P7') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_players_parent FOREIGN KEY (parent_id) REFERENCES parents(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- One finished sprint (10 questions).
CREATE TABLE IF NOT EXISTS sprints (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  player_id INT UNSIGNED NOT NULL,
  subject ENUM('maths','english','science','sst') NOT NULL,
  grade ENUM('TOP','P1','P2','P3','P4','P5','P6','P7') NOT NULL,
  level ENUM('simple','medium','hard','pro') NOT NULL,
  score SMALLINT UNSIGNED NOT NULL,
  correct TINYINT UNSIGNED NOT NULL,
  total TINYINT UNSIGNED NOT NULL,
  avg_ms INT UNSIGNED NOT NULL,
  best_streak TINYINT UNSIGNED NOT NULL DEFAULT 0,
  played_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_sprints_player (player_id, played_at),
  CONSTRAINT fk_sprints_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Paid access: a day, week or month pass.
CREATE TABLE IF NOT EXISTS subscriptions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parent_id INT UNSIGNED NOT NULL,
  plan ENUM('day','week','month') NOT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  payment_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_subs_parent (parent_id, ends_at),
  CONSTRAINT fk_subs_parent FOREIGN KEY (parent_id) REFERENCES parents(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Mobile money payments (MTN MoMo / Airtel Money).
CREATE TABLE IF NOT EXISTS payments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parent_id INT UNSIGNED NOT NULL,
  provider ENUM('mtn','airtel') NOT NULL,
  plan ENUM('day','week','month') NOT NULL,
  amount_ugx INT UNSIGNED NOT NULL,
  phone VARCHAR(20) NOT NULL,
  reference VARCHAR(64) NOT NULL UNIQUE, -- our id sent to the provider
  provider_ref VARCHAR(100) NULL,
  status ENUM('pending','success','failed') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_parent FOREIGN KEY (parent_id) REFERENCES parents(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Question bank for subjects that can't be generated from templates
-- (English, Science, SST). Teachers review before a question goes live.
CREATE TABLE IF NOT EXISTS questions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  subject ENUM('maths','english','science','sst') NOT NULL,
  grade ENUM('TOP','P1','P2','P3','P4','P5','P6','P7') NOT NULL,
  level ENUM('simple','medium','hard','pro') NOT NULL,
  topic VARCHAR(60) NOT NULL,
  prompt TEXT NOT NULL,
  speak TEXT NULL, -- read-aloud text; falls back to prompt
  image_url VARCHAR(255) NULL,
  choices JSON NOT NULL, -- ["cat","dog","hen","cow"]
  answer VARCHAR(100) NOT NULL,
  status ENUM('draft','approved','retired') NOT NULL DEFAULT 'draft',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_questions_pick (subject, grade, level, status)
) ENGINE=InnoDB;
