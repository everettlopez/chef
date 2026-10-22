-- Separate databases for the backend test suite: pantry_test for the API tests and
-- pantry_migrate for the Alembic upgrade/downgrade round trip.
-- The app user (MYSQL_USER) is created by the image before init scripts run.
CREATE DATABASE IF NOT EXISTS pantry_test
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS pantry_migrate
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

GRANT ALL PRIVILEGES ON pantry_test.* TO 'pantry'@'%';
GRANT ALL PRIVILEGES ON pantry_migrate.* TO 'pantry'@'%';
FLUSH PRIVILEGES;
