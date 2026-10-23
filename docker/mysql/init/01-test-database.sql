-- Separate databases for the test suites: pantry_test for the API tests, pantry_migrate for
-- the Alembic upgrade/downgrade round trip and pantry_e2e for the Playwright browser tests.
-- The app user (MYSQL_USER) is created by the image before init scripts run.
CREATE DATABASE IF NOT EXISTS pantry_test
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS pantry_migrate
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS pantry_e2e
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

GRANT ALL PRIVILEGES ON pantry_test.* TO 'pantry'@'%';
GRANT ALL PRIVILEGES ON pantry_migrate.* TO 'pantry'@'%';
GRANT ALL PRIVILEGES ON pantry_e2e.* TO 'pantry'@'%';
FLUSH PRIVILEGES;
