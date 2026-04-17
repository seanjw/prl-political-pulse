-- Fix: Add tweet_id to refresh_classification_mat procedure
-- The procedure was missing LEFT JOINs to tweets/tweets_state to populate tweet_id
-- Run as Aurora admin user

DROP PROCEDURE IF EXISTS refresh_classification_mat;

DELIMITER //
CREATE PROCEDURE refresh_classification_mat()
BEGIN
    -- 1) Recreate the view with tweet_id included via LEFT JOIN to tweets/tweets_state
    DROP VIEW IF EXISTS classification_legislator;
    CREATE VIEW classification_legislator AS
        SELECT
            c.text, c.date, CASE WHEN c.source = 'tweets_state' THEN 'tweets' ELSE c.source END AS source,
            c.bioguide_id, c.openstates_id, c.outcome_bipartisanship, c.outcome_creditclaiming, c.policy,
            c.attack_personal, c.attack_policy, c.attack_target, c.extreme_label, c.id AS classification_id,
            o.first_name, o.last_name, o.party, o.state, o.type, o.gender, o.district, o.id AS legislator_id,
            o.active, o.government_website, o.campaign_website, o.twitter_handle, o.youtube, o.truth_social,
            COALESCE(o.name, CONCAT(o.first_name, ' ', o.last_name)) AS name, o.title, o.email,
            CASE WHEN c.openstates_id IS NOT NULL AND c.bioguide_id IS NULL THEN 'state'
                 WHEN c.bioguide_id IS NOT NULL AND c.openstates_id IS NULL THEN 'federal'
                 ELSE NULL
            END AS level,
            t.tweet_id
        FROM classifications c
        JOIN officials o ON c.bioguide_id = o.bioguide_id
        LEFT JOIN tweets t ON c.source_id = t.id AND c.source = 'tweets'
        WHERE c.date >= CURDATE() - INTERVAL 7 DAY AND c.classified = 1
    UNION ALL
        SELECT
            c.text, c.date, CASE WHEN c.source = 'tweets_state' THEN 'tweets' ELSE c.source END AS source,
            c.bioguide_id, c.openstates_id, c.outcome_bipartisanship, c.outcome_creditclaiming, c.policy,
            c.attack_personal, c.attack_policy, c.attack_target, c.extreme_label, c.id AS classification_id,
            o.first_name, o.last_name, o.party, o.state, o.type, o.gender, o.district, o.id AS legislator_id,
            o.active, o.government_website, o.campaign_website, o.twitter_handle, o.youtube, o.truth_social,
            COALESCE(o.name, CONCAT(o.first_name, ' ', o.last_name)) AS name, o.title, o.email,
            CASE WHEN c.openstates_id IS NOT NULL AND c.bioguide_id IS NULL THEN 'state'
                 WHEN c.bioguide_id IS NOT NULL AND c.openstates_id IS NULL THEN 'federal'
                 ELSE NULL
            END AS level,
            ts.tweet_id
        FROM classifications c
        JOIN officials o ON c.openstates_id = o.openstates_id
        LEFT JOIN tweets_state ts ON c.source_id = ts.id AND c.source = 'tweets_state'
        WHERE c.bioguide_id IS NULL AND c.date >= CURDATE() - INTERVAL 7 DAY AND c.classified = 1;

    -- 2) Create a temporary staging table with the fresh (filtered) data
    CREATE TEMPORARY TABLE mat_classification_legislator_stage ENGINE=InnoDB AS
    SELECT * FROM classification_legislator;

    ALTER TABLE mat_classification_legislator_stage ADD PRIMARY KEY (classification_id);

    -- 3) Insert new rows and update existing ones
    INSERT INTO mat_classification_legislator (
        `text`, `date`, `source`, `bioguide_id`, `openstates_id`, `outcome_bipartisanship`, `outcome_creditclaiming`,
        `policy`, `attack_personal`, `attack_policy`, `attack_target`, `extreme_label`, `classification_id`,
        `first_name`, `last_name`, `party`, `state`, `type`, `gender`, `district`, `legislator_id`, `active`,
        `government_website`, `campaign_website`, `twitter_handle`, `youtube`, `truth_social`, `name`, `title`,
        `email`, `level`, `tweet_id`
    )
    SELECT * FROM mat_classification_legislator_stage
    ON DUPLICATE KEY UPDATE
        `text` = VALUES(`text`), `date` = VALUES(`date`), `source` = VALUES(`source`),
        `bioguide_id` = VALUES(`bioguide_id`), `openstates_id` = VALUES(`openstates_id`),
        `outcome_bipartisanship` = VALUES(`outcome_bipartisanship`),
        `outcome_creditclaiming` = VALUES(`outcome_creditclaiming`), `policy` = VALUES(`policy`),
        `attack_personal` = VALUES(`attack_personal`), `attack_policy` = VALUES(`attack_policy`),
        `attack_target` = VALUES(`attack_target`), `extreme_label` = VALUES(`extreme_label`),
        `first_name` = VALUES(`first_name`), `last_name` = VALUES(`last_name`), `party` = VALUES(`party`),
        `state` = VALUES(`state`), `type` = VALUES(`type`), `gender` = VALUES(`gender`),
        `district` = VALUES(`district`), `legislator_id` = VALUES(`legislator_id`), `active` = VALUES(`active`),
        `government_website` = VALUES(`government_website`), `campaign_website` = VALUES(`campaign_website`),
        `twitter_handle` = VALUES(`twitter_handle`), `youtube` = VALUES(`youtube`), `truth_social` = VALUES(`truth_social`),
        `name` = VALUES(`name`), `title` = VALUES(`title`), `email` = VALUES(`email`), `level` = VALUES(`level`),
        `tweet_id` = VALUES(`tweet_id`);

    -- 4) Clean up
    DROP TEMPORARY TABLE mat_classification_legislator_stage;

    -- 5) Rebuild distinct value helper tables
    DROP TABLE IF EXISTS `DistinctLegislatorNames`;
    CREATE TABLE `DistinctLegislatorNames` AS
    SELECT DISTINCT `name` FROM `mat_classification_legislator` WHERE `name` IS NOT NULL AND `name` != '';

    DROP TABLE IF EXISTS `DistinctLegislatorTwitterHandles`;
    CREATE TABLE `DistinctLegislatorTwitterHandles` AS
    SELECT DISTINCT `twitter_handle` FROM `mat_classification_legislator` WHERE `twitter_handle` IS NOT NULL AND `twitter_handle` != '';

    DROP TABLE IF EXISTS `DistinctLegislatorDistricts`;
    CREATE TABLE `DistinctLegislatorDistricts` AS
    SELECT DISTINCT `district` FROM `mat_classification_legislator` WHERE `district` IS NOT NULL AND `district` != '';
END //
DELIMITER ;


-- Backfill: One-time update for ~356K existing records missing tweet_id
-- Run this AFTER updating the procedure above

UPDATE mat_classification_legislator m
JOIN classifications c ON m.classification_id = c.id
LEFT JOIN tweets t ON c.source_id = t.id AND c.source = 'tweets'
LEFT JOIN tweets_state ts ON c.source_id = ts.id AND c.source = 'tweets_state'
SET m.tweet_id = COALESCE(t.tweet_id, ts.tweet_id)
WHERE m.tweet_id IS NULL AND m.source = 'tweets';
