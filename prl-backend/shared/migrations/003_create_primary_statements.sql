-- Migration: Create primary_statements table
-- Database: pulse

CREATE TABLE IF NOT EXISTS primary_statements (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    candidate_id VARCHAR(20) NOT NULL,
    date DATE NULL,
    source VARCHAR(50) NULL,
    text TEXT NULL,
    categories JSON NULL,
    tweet_id VARCHAR(30) NULL,
    INDEX idx_ps_candidate_id (candidate_id),
    INDEX idx_ps_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
