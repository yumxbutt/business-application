-- Run once on VPS MySQL/MariaDB (edit password first):
--   mysql -u root -p < deploy/mysql-setup.sql

CREATE DATABASE IF NOT EXISTS business_management
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'business_app'@'localhost' IDENTIFIED BY 'CHANGE_ME_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON business_management.* TO 'business_app'@'localhost';
FLUSH PRIVILEGES;
