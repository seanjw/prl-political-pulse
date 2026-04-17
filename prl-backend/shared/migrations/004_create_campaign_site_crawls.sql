-- Migration: Create campaign site crawl tracking tables
-- Database: elite

CREATE TABLE IF NOT EXISTS campaign_site_crawls (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    source_type ENUM('official_federal_gov', 'official_federal_campaign', 'official_state_gov', 'official_state_campaign', 'challenger') NOT NULL,
    source_id VARCHAR(50) NOT NULL,
    name VARCHAR(255) NULL,
    site_url VARCHAR(500) NOT NULL,
    crawl_date DATE NOT NULL,
    status ENUM('success', 'partial', 'failure', 'skipped') NOT NULL,
    error_message TEXT NULL,
    pages_crawled INT NOT NULL DEFAULT 0,
    pages_changed INT NOT NULL DEFAULT 0,
    pages_new INT NOT NULL DEFAULT 0,
    site_content_hash VARCHAR(64) NULL,
    s3_json_key VARCHAR(500) NULL,
    s3_html_zip_key VARCHAR(500) NULL,
    duration_seconds FLOAT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_csc_source (source_type, source_id, crawl_date DESC),
    INDEX idx_csc_date (crawl_date),
    INDEX idx_csc_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS campaign_site_page_hashes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    crawl_id BIGINT NOT NULL,
    page_url VARCHAR(2000) NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    title VARCHAR(500) NULL,
    word_count INT NOT NULL DEFAULT 0,
    INDEX idx_csph_crawl (crawl_id),
    INDEX idx_csph_url (page_url(191)),
    CONSTRAINT fk_csph_crawl FOREIGN KEY (crawl_id)
        REFERENCES campaign_site_crawls(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
