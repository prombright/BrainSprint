-- Admin accounts, school/parent enquiries from the website, and a record of applied migrations.
--   C:\xampp\php\php.exe api\migrate.php     (applies every migration not yet applied)

CREATE TABLE IF NOT EXISTS admins (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(40) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  failed_logins TINYINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS admin_tokens (
  token_hash CHAR(64) PRIMARY KEY,
  admin_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_atokens_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- "Contact us" from the landing page: schools asking about licences, parents with questions.
CREATE TABLE IF NOT EXISTS leads (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kind ENUM('school', 'parent', 'other') NOT NULL,
  name VARCHAR(80) NOT NULL,
  organisation VARCHAR(120) NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(120) NULL,
  message TEXT NULL,
  ip VARCHAR(45) NULL,
  status ENUM('new', 'contacted', 'closed') NOT NULL DEFAULT 'new',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_leads_status (status, created_at)
) ENGINE=InnoDB;
