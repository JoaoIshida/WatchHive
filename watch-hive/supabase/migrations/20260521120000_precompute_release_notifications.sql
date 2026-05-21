-- Precomputed release notifications: catalog airings + notification queue

CREATE TYPE airing_source AS ENUM ('tvmaze', 'tmdb');
CREATE TYPE notification_queue_status AS ENUM ('pending', 'materialized', 'failed');

-- Global TV episode catalog (ingested from TVMaze / TMDB)
CREATE TABLE catalog_episodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    show_id INTEGER NOT NULL,
    season_number INTEGER NOT NULL CHECK (season_number >= 0),
    episode_number INTEGER NOT NULL CHECK (episode_number > 0),
    title TEXT,
    source airing_source NOT NULL DEFAULT 'tvmaze',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (show_id, season_number, episode_number)
);

COMMENT ON TABLE catalog_episodes IS 'TV episode catalog keyed by TMDB show id; used for regional airings';

CREATE TABLE regional_airings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    show_id INTEGER,
    episode_id UUID REFERENCES catalog_episodes(id) ON DELETE CASCADE,
    content_id INTEGER,
    media_type media_type,
    region_code TEXT NOT NULL DEFAULT 'CA',
    release_at_utc TIMESTAMPTZ NOT NULL,
    source airing_source NOT NULL DEFAULT 'tvmaze',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (
        (episode_id IS NOT NULL AND show_id IS NOT NULL AND content_id IS NULL AND media_type IS NULL)
        OR (episode_id IS NULL AND show_id IS NULL AND content_id IS NOT NULL AND media_type IS NOT NULL)
    )
);

COMMENT ON TABLE regional_airings IS 'Per-episode or per-movie release instant in UTC for a region';

CREATE UNIQUE INDEX idx_regional_airings_episode_region
    ON regional_airings (episode_id, region_code)
    WHERE episode_id IS NOT NULL;

CREATE UNIQUE INDEX idx_regional_airings_content_region
    ON regional_airings (content_id, media_type, region_code)
    WHERE episode_id IS NULL;

CREATE INDEX idx_regional_airings_region_release
    ON regional_airings (region_code, release_at_utc);

CREATE INDEX idx_regional_airings_show_id
    ON regional_airings (show_id)
    WHERE show_id IS NOT NULL;

CREATE TABLE notification_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'release_reminder',
    send_at_utc TIMESTAMPTZ NOT NULL,
    dedupe_key TEXT NOT NULL,
    payload JSONB NOT NULL,
    status notification_queue_status NOT NULL DEFAULT 'pending',
    materialized_notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE notification_queue IS 'Precomputed release reminders; dispatch inserts into notifications';

CREATE UNIQUE INDEX idx_notification_queue_user_dedupe_active
    ON notification_queue (user_id, dedupe_key)
    WHERE status IN ('pending', 'materialized');

CREATE INDEX idx_notification_queue_pending_send
    ON notification_queue (send_at_utc)
    WHERE status = 'pending';

CREATE TRIGGER update_catalog_episodes_updated_at
    BEFORE UPDATE ON catalog_episodes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_regional_airings_updated_at
    BEFORE UPDATE ON regional_airings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_notification_queue_updated_at
    BEFORE UPDATE ON notification_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

ALTER TABLE catalog_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE regional_airings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

-- Service role only (no policies), same as release_cache / series_sync_queue
