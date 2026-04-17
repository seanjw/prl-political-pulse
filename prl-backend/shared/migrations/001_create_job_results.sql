CREATE TABLE IF NOT EXISTS operations.job_results (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    job_name VARCHAR(64) NOT NULL,
    started_at DATETIME(3) NOT NULL,
    completed_at DATETIME(3) NULL,
    duration_seconds FLOAT NULL,
    status ENUM('running','success','failure','partial') NOT NULL DEFAULT 'running',
    exit_code INT NULL,
    records_processed INT NOT NULL DEFAULT 0,
    error_count INT NOT NULL DEFAULT 0,
    errors_json JSON NULL,
    metrics_json JSON NOT NULL DEFAULT (JSON_OBJECT()),
    headline_metrics_json JSON NULL,
    steps_json JSON NULL,
    INDEX idx_job_started (job_name, started_at DESC),
    INDEX idx_started (started_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
