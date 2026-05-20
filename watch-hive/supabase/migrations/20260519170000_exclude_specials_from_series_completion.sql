-- Exclude TMDB specials (season_number 0) when deciding if a series is fully completed.
-- Without this, an incomplete specials season blocks series_progress.completed = TRUE,
-- so get_user_stats() series_in_progress / completed_series stay wrong after all regular
-- episodes are marked watched.

CREATE OR REPLACE FUNCTION update_series_completion()
RETURNS TRIGGER AS $$
DECLARE
    total_episodes INTEGER;
    watched_episodes INTEGER;
    season_completed BOOLEAN;
    all_seasons_completed BOOLEAN;
BEGIN
    -- Update season completion status
    SELECT COUNT(*) INTO total_episodes
    FROM series_episodes se
    WHERE se.series_season_id = NEW.series_season_id;

    SELECT COUNT(*) INTO watched_episodes
    FROM series_episodes se
    WHERE se.series_season_id = NEW.series_season_id;

    -- If all episodes are watched, mark season as completed
    IF watched_episodes > 0 AND watched_episodes = total_episodes THEN
        UPDATE series_seasons
        SET completed = TRUE, updated_at = NOW()
        WHERE id = NEW.series_season_id;
    END IF;

    -- Check if all regular seasons are completed (specials / season_number 0 excluded)
    SELECT COUNT(*) = 0 INTO all_seasons_completed
    FROM series_seasons ss
    WHERE ss.series_progress_id = (
        SELECT series_progress_id FROM series_seasons WHERE id = NEW.series_season_id
    )
    AND ss.season_number > 0
    AND ss.completed = FALSE;

    -- If all regular seasons are completed, mark series as completed
    IF all_seasons_completed THEN
        UPDATE series_progress
        SET completed = TRUE, updated_at = NOW()
        WHERE id = (
            SELECT series_progress_id FROM series_seasons WHERE id = NEW.series_season_id
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_series_completion() IS
    'Updates season completion on episode insert; marks series completed when all regular seasons (season_number > 0) are done';
