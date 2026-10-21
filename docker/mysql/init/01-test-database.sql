-- Separate database for the backend test suite.
-- The app user (MYSQL_USER) is created by the image before init scripts run.
CREATE DATABASE IF NOT EXISTS pantry_test
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

GRANT ALL PRIVILEGES ON pantry_test.* TO 'pantry'@'%';
FLUSH PRIVILEGES;
