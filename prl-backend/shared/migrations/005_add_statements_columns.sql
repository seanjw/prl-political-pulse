-- Migration: Add headline, scrape_attempts, scrape_error to statements table
-- Database: elite

ALTER TABLE elite.statements
    ADD COLUMN headline VARCHAR(1000) NULL AFTER date,
    ADD COLUMN scrape_attempts INT NOT NULL DEFAULT 0 AFTER content_has_been_scraped,
    ADD COLUMN scrape_error TEXT NULL AFTER scrape_attempts;
