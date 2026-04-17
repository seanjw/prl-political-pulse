-- Migration: Create primary_winners table for tracking primary race results
-- Database: elite

CREATE TABLE IF NOT EXISTS primary_winners (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    candidate_id VARCHAR(20) NOT NULL,
    race_id VARCHAR(10) NOT NULL,
    called_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    called_by VARCHAR(100) DEFAULT 'admin',
    UNIQUE KEY uq_candidate_race (candidate_id, race_id),
    INDEX idx_race (race_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
