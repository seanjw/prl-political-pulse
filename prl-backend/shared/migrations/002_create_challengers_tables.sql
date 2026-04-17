-- Migration: Create challenger pipeline tables
-- Database: elite

CREATE TABLE IF NOT EXISTS challengers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    candidate_id VARCHAR(20) NOT NULL UNIQUE,
    bioguide_id VARCHAR(20) NULL,
    state VARCHAR(2) NOT NULL,
    name VARCHAR(255) NOT NULL,
    party VARCHAR(50),
    party_full VARCHAR(100),
    office CHAR(1) NOT NULL COMMENT 'S=Senate, H=House',
    office_full VARCHAR(50),
    district VARCHAR(10) NULL,
    twitter_handle VARCHAR(500) NULL COMMENT 'Comma-separated if multiple',
    twitter_id VARCHAR(500) NULL COMMENT 'Comma-separated if multiple',
    campaign_website VARCHAR(500) NULL,
    candidate_status VARCHAR(10) NULL,
    incumbent_challenge CHAR(1) NOT NULL COMMENT 'C=Challenger, O=Open seat',
    incumbent_challenge_full VARCHAR(50),
    candidate_inactive BOOLEAN NOT NULL DEFAULT FALSE,
    has_raised_funds BOOLEAN NOT NULL DEFAULT FALSE,
    federal_funds_flag BOOLEAN NOT NULL DEFAULT FALSE,
    first_file_date DATE NULL,
    last_file_date DATE NULL,
    active_through VARCHAR(10) NULL,
    election_years TEXT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    error_flags JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_challengers_state (state),
    INDEX idx_challengers_party (party),
    INDEX idx_challengers_office (office),
    INDEX idx_challengers_incumbent_challenge (incumbent_challenge),
    INDEX idx_challengers_active (active),
    INDEX idx_challengers_twitter_handle (twitter_handle(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tweets_challengers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL,
    candidate_id VARCHAR(20) NOT NULL,
    text TEXT,
    tweet_id VARCHAR(30) NOT NULL UNIQUE,
    created_at DATETIME,
    public_metrics JSON NULL,
    media JSON NULL,
    twitter_id VARCHAR(50),
    media_urls JSON NULL,
    follower_count INT NULL,
    INDEX idx_tc_candidate_id (candidate_id),
    INDEX idx_tc_date (date),
    INDEX idx_tc_tweet_id (tweet_id),
    CONSTRAINT fk_tweets_challengers_candidate
        FOREIGN KEY (candidate_id) REFERENCES challengers(candidate_id)
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS classifications_challengers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    source_id BIGINT NOT NULL,
    source VARCHAR(50) NOT NULL DEFAULT 'tweets_challengers',
    text TEXT,
    date DATE,
    candidate_id VARCHAR(20) NULL,
    classified TINYINT DEFAULT 0,
    attack_personal TINYINT NULL,
    attack_type VARCHAR(255) NULL,
    attack_target VARCHAR(255) NULL,
    attack_policy TINYINT NULL,
    outcome_bipartisanship TINYINT NULL,
    outcome_creditclaiming TINYINT NULL,
    policy TINYINT NULL,
    policy_area TEXT NULL,
    extreme_label VARCHAR(255) NULL,
    extreme_target VARCHAR(255) NULL,
    errors JSON NULL,
    INDEX idx_cc_source (source),
    INDEX idx_cc_source_id (source_id),
    INDEX idx_cc_date (date),
    INDEX idx_cc_classified (classified),
    INDEX idx_cc_candidate_id (candidate_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
