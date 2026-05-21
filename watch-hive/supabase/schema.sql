-- ============================================================================
-- WatchHive Supabase Database Schema
-- ============================================================================
-- This schema file sets up all tables, functions, triggers, RLS policies,
-- and vectorization support for WatchHive.
-- Execute this file in the Supabase SQL editor to set up the database.
-- ============================================================================
--
-- SCHEMA MAP (where to find things)
-- ----------------------------------------------------------------------------
-- User identity & search:     profiles (+ idx_profiles_display_name, idx_profiles_display_name_lower,
--                              profile_id_for_display_name for case-insensitive lookup)
-- Watched / progress:         watched_content, series_progress, series_seasons, series_episodes
-- Wishlist & reminders:       wishlist, wishlist_reminders
-- Favorites (heart):          user_favorites
-- Custom lists:               custom_lists, custom_list_items, list_collaborators
-- Social:                     friends, friend_request_notify_throttle
-- Notifications & push:       notifications, notification_preferences, push_subscriptions
-- Realtime:                   `friends` + `notifications` added to `supabase_realtime` at end of file (Supabase)
-- Reviews (optional):         reviews, review_votes
-- Embeddings / vectors:       content_embeddings, user_preference_embeddings
-- Edge / cache:               release_cache, series_sync_queue
-- Release pipeline:           catalog_episodes, regional_airings, notification_queue
-- Watching reminders:         watching_reminders
-- ============================================================================

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

-- Media type enum (movie or tv series)
CREATE TYPE media_type AS ENUM ('movie', 'tv');

-- Vote type enum for review voting
CREATE TYPE vote_type AS ENUM ('upvote', 'downvote');

-- Friend request status enum
CREATE TYPE friend_status AS ENUM ('pending', 'accepted', 'blocked');

-- Release reminder offset (global default and per-title override)
CREATE TYPE reminder_kind AS ENUM ('release_day', 'one_day_before', 'one_week_before', 'custom');

-- TMDB sync queue row status
CREATE TYPE sync_queue_status AS ENUM ('pending', 'processing', 'done', 'failed');

-- Airing metadata source (TVMaze preferred, TMDB fallback)
CREATE TYPE airing_source AS ENUM ('tvmaze', 'tmdb');

-- Precomputed notification delivery queue
CREATE TYPE notification_queue_status AS ENUM ('pending', 'materialized', 'failed');

-- ============================================================================
-- CORE TABLES (MVP)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles - Extended user profiles (extends Supabase auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    preferences JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT display_name_length CHECK (char_length(display_name) >= 2)
);

COMMENT ON TABLE profiles IS 'Extended user profiles that reference Supabase auth.users';
COMMENT ON COLUMN profiles.display_name IS 'Unique display name (required, 2+ chars), unique case-insensitively — used for search, friend requests by name';
COMMENT ON COLUMN profiles.preferences IS 'User preferences (JSONB), including profile_visibility: anyone | friends | no_one';

-- Server-side lookup: case-insensitive display_name → id (service_role only).
CREATE OR REPLACE FUNCTION public.profile_id_for_display_name(p_name TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM profiles p
  WHERE LOWER(TRIM(p.display_name)) = LOWER(TRIM(p_name))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.profile_id_for_display_name(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_id_for_display_name(TEXT) TO service_role;

-- ----------------------------------------------------------------------------
-- watched_content - Track watched movies/series
-- ----------------------------------------------------------------------------
CREATE TABLE watched_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content_id INTEGER NOT NULL,
    media_type media_type NOT NULL,
    date_watched TIMESTAMPTZ DEFAULT NOW(),
    times_watched INTEGER DEFAULT 1 CHECK (times_watched > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, content_id, media_type)
);

COMMENT ON TABLE watched_content IS 'Tracks movies and series that users have watched';
COMMENT ON COLUMN watched_content.content_id IS 'TMDB content ID';
COMMENT ON COLUMN watched_content.times_watched IS 'Number of times the user has watched this content';

-- ----------------------------------------------------------------------------
-- wishlist - User wishlists
-- ----------------------------------------------------------------------------
CREATE TABLE wishlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content_id INTEGER NOT NULL,
    media_type media_type NOT NULL,
    date_added TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, content_id, media_type)
);

COMMENT ON TABLE wishlist IS 'User wishlist of movies and series to watch later';
COMMENT ON COLUMN wishlist.content_id IS 'TMDB content ID';

-- ----------------------------------------------------------------------------
-- user_favorites - Saved favorites (heart), separate from wishlist (save / reminders)
-- ----------------------------------------------------------------------------
CREATE TABLE user_favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content_id INTEGER NOT NULL,
    media_type media_type NOT NULL,
    date_added TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, content_id, media_type)
);

COMMENT ON TABLE user_favorites IS 'User favorite titles (heart); distinct from wishlist release reminders';
COMMENT ON COLUMN user_favorites.content_id IS 'TMDB content ID';

-- ----------------------------------------------------------------------------
-- series_progress - Series watching progress
-- ----------------------------------------------------------------------------
CREATE TABLE series_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    series_id INTEGER NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    last_watched TIMESTAMPTZ,
    catalog_total_episodes INTEGER,
    catalog_refreshed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, series_id)
);

COMMENT ON TABLE series_progress IS 'Tracks overall progress for TV series';
COMMENT ON COLUMN series_progress.series_id IS 'TMDB series ID';
COMMENT ON COLUMN series_progress.catalog_total_episodes IS 'TMDB regular-season episode count sum; refreshed by refresh_series_progress_catalog Edge function';
COMMENT ON COLUMN series_progress.catalog_refreshed_at IS 'When catalog_total_episodes was last updated from TMDB';

-- ----------------------------------------------------------------------------
-- series_seasons - Season-level progress
-- ----------------------------------------------------------------------------
CREATE TABLE series_seasons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    series_progress_id UUID NOT NULL REFERENCES series_progress(id) ON DELETE CASCADE,
    season_number INTEGER NOT NULL CHECK (season_number >= 0),
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (series_progress_id, season_number)
);

COMMENT ON TABLE series_seasons IS 'Tracks progress for individual seasons within a series';

-- ----------------------------------------------------------------------------
-- series_episodes - Episode-level tracking
-- ----------------------------------------------------------------------------
CREATE TABLE series_episodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    series_season_id UUID NOT NULL REFERENCES series_seasons(id) ON DELETE CASCADE,
    episode_number INTEGER NOT NULL CHECK (episode_number > 0),
    watched_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (series_season_id, episode_number)
);

COMMENT ON TABLE series_episodes IS 'Tracks individual episodes that have been watched';

-- ----------------------------------------------------------------------------
-- custom_lists - User-created lists
-- ----------------------------------------------------------------------------
CREATE TABLE custom_lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    items_count INTEGER NOT NULL DEFAULT 0 CHECK (items_count >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT name_length CHECK (char_length(name) >= 1 AND char_length(name) <= 100)
);

COMMENT ON TABLE custom_lists IS 'User-created custom lists (e.g., "Christmas Movies", "Horror Collection")';
COMMENT ON COLUMN custom_lists.is_public IS 'Whether the list is visible to other users';
COMMENT ON COLUMN custom_lists.items_count IS 'Denormalized count of rows in custom_list_items for this list; maintained by triggers';

-- ----------------------------------------------------------------------------
-- custom_list_items - Items in custom lists
-- ----------------------------------------------------------------------------
CREATE TABLE custom_list_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    list_id UUID NOT NULL REFERENCES custom_lists(id) ON DELETE CASCADE,
    content_id INTEGER NOT NULL,
    media_type media_type NOT NULL,
    title TEXT NOT NULL,
    date_added TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (list_id, content_id, media_type)
);

COMMENT ON TABLE custom_list_items IS 'Items (movies/series) within user-created custom lists';
COMMENT ON COLUMN custom_list_items.title IS 'Cached title for quick display without API calls';

-- ----------------------------------------------------------------------------
-- list_collaborators - Users who can collaborate on lists
-- ----------------------------------------------------------------------------
CREATE TABLE list_collaborators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    list_id UUID NOT NULL REFERENCES custom_lists(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    permission TEXT DEFAULT 'editor' CHECK (permission IN ('viewer', 'editor', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (list_id, user_id)
);

COMMENT ON TABLE list_collaborators IS 'Users who can collaborate on custom lists';
COMMENT ON COLUMN list_collaborators.permission IS 'Permission level: viewer (read-only), editor (can add/remove items), admin (can edit list and manage collaborators)';

-- ----------------------------------------------------------------------------
-- reviews - User reviews
-- ----------------------------------------------------------------------------
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content_id INTEGER NOT NULL,
    media_type media_type NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 10),
    review_text TEXT,
    contains_spoilers BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, content_id, media_type)
);

COMMENT ON TABLE reviews IS 'User reviews for movies and series (Letterboxd-like)';
COMMENT ON COLUMN reviews.rating IS 'User rating from 1-10 (separate from TMDB rating)';

-- ----------------------------------------------------------------------------
-- review_votes - Review upvotes/downvotes
-- ----------------------------------------------------------------------------
CREATE TABLE review_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    vote_type vote_type NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (review_id, user_id)
);

COMMENT ON TABLE review_votes IS 'Upvotes and downvotes on user reviews';

-- ----------------------------------------------------------------------------
-- friends - User friendships
-- ----------------------------------------------------------------------------
CREATE TABLE friends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status friend_status DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, friend_id),
    CONSTRAINT no_self_friend CHECK (user_id != friend_id)
);

COMMENT ON TABLE friends IS 'User friendships and friend requests';
COMMENT ON COLUMN friends.status IS 'Status of the friendship: pending, accepted, or blocked';

-- ----------------------------------------------------------------------------
-- friend_request_notify_throttle - In-app + push rate limit (1h per sender→receiver)
-- ----------------------------------------------------------------------------
CREATE TABLE friend_request_notify_throttle (
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    last_notified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (sender_id, receiver_id)
);

COMMENT ON TABLE friend_request_notify_throttle IS
    'Last friend-request in-app or Web Push notification per sender/receiver pair (1h throttle).';

ALTER TABLE friend_request_notify_throttle ENABLE ROW LEVEL SECURITY;
-- RLS enabled with no policies: clients cannot access via PostgREST; API uses service role for throttle rows.

-- Existing DB migration from friend_request_push_throttle (run once if upgrading):
-- ALTER TABLE friend_request_push_throttle RENAME TO friend_request_notify_throttle;
-- ALTER TABLE friend_request_notify_throttle RENAME COLUMN last_push_at TO last_notified_at;
-- COMMENT ON TABLE friend_request_notify_throttle IS 'Last friend-request in-app or Web Push notification per sender/receiver pair (1h throttle).';

-- ----------------------------------------------------------------------------
-- notifications - In-app notifications
-- ----------------------------------------------------------------------------
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    push_sent_at TIMESTAMPTZ,
    dedupe_key TEXT
);

COMMENT ON TABLE notifications IS 'In-app notifications for users';
COMMENT ON COLUMN notifications.type IS 'Types: friend_request, release_reminder, catalog_expanded, series_catchup, new_episodes (legacy), etc.';
COMMENT ON COLUMN notifications.push_sent_at IS 'When Web Push was sent for this row (NULL = not pushed yet)';
COMMENT ON COLUMN notifications.dedupe_key IS 'Idempotent key for cron-generated release rows; unique per user when set';

-- ----------------------------------------------------------------------------
-- notification_preferences - Release reminders and push master toggle
-- ----------------------------------------------------------------------------
CREATE TABLE notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    timezone TEXT NOT NULL DEFAULT 'America/Toronto',
    default_reminder_kind reminder_kind NOT NULL DEFAULT 'release_day',
    default_reminder_kinds TEXT[] NOT NULL DEFAULT ARRAY['release_day']::TEXT[],
    custom_days_before SMALLINT CHECK (custom_days_before IS NULL OR (custom_days_before >= 1 AND custom_days_before <= 30)),
    push_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    push_friends BOOLEAN NOT NULL DEFAULT TRUE,
    push_catchup BOOLEAN NOT NULL DEFAULT TRUE,
    push_releases BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE notification_preferences IS 'Per-user defaults for release reminders and push opt-in';
COMMENT ON COLUMN notification_preferences.default_reminder_kinds IS 'Multiple reminder timings (UI checkboxes); default_reminder_kind mirrors one value for legacy Edge readers';
COMMENT ON COLUMN notification_preferences.push_friends IS 'Web Push for friend_request (master push_enabled must be true)';
COMMENT ON COLUMN notification_preferences.push_catchup IS 'Web Push for series_catchup weekly nudges';
COMMENT ON COLUMN notification_preferences.push_releases IS 'Web Push for release_reminder and catalog_expanded';

-- Existing DB migration (run once if upgrading):
-- ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS push_friends BOOLEAN NOT NULL DEFAULT TRUE;
-- ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS push_catchup BOOLEAN NOT NULL DEFAULT TRUE;
-- ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS push_releases BOOLEAN NOT NULL DEFAULT TRUE;

-- ----------------------------------------------------------------------------
-- push_subscriptions - Web Push subscription JSON (VAPID)
-- ----------------------------------------------------------------------------
CREATE TABLE push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    subscription JSONB NOT NULL,
    endpoint TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (endpoint)
);

COMMENT ON TABLE push_subscriptions IS 'Browser Web Push subscriptions; one row per endpoint';

-- ----------------------------------------------------------------------------
-- release_cache - TMDB snapshot for enqueue/sync (Canada region v1)
-- ----------------------------------------------------------------------------
CREATE TABLE release_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id INTEGER NOT NULL,
    media_type media_type NOT NULL,
    title TEXT,
    release_date DATE,
    poster_path TEXT,
    refreshed_at TIMESTAMPTZ DEFAULT NOW(),
    tmdb_region TEXT NOT NULL DEFAULT 'CA',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (content_id, media_type)
);

COMMENT ON TABLE release_cache IS 'Cached TMDB release metadata; keyed by TMDB id + media type';

-- ----------------------------------------------------------------------------
-- series_sync_queue - Work queue for TMDB refresh (not per-user)
-- ----------------------------------------------------------------------------
CREATE TABLE series_sync_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id INTEGER NOT NULL,
    media_type media_type NOT NULL,
    status sync_queue_status NOT NULL DEFAULT 'pending',
    attempts SMALLINT NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE series_sync_queue IS 'Pending TMDB fetches; dedupe one pending row per (content_id, media_type)';

-- ----------------------------------------------------------------------------
-- catalog_episodes - Global TV episode catalog (TVMaze / TMDB ingestion)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- regional_airings - Factual release instant per region (episode or movie)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- notification_queue - Precomputed release reminders (dispatch → notifications)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- wishlist_reminders - Override release reminder per wishlist row
-- ----------------------------------------------------------------------------
CREATE TABLE wishlist_reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wishlist_id UUID NOT NULL REFERENCES wishlist(id) ON DELETE CASCADE,
    use_global_default BOOLEAN NOT NULL DEFAULT TRUE,
    reminder_kind reminder_kind,
    custom_days_before SMALLINT CHECK (custom_days_before IS NULL OR (custom_days_before >= 1 AND custom_days_before <= 30)),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (wishlist_id)
);

-- ----------------------------------------------------------------------------
-- watching_reminders - Override per watched_content row (in-progress series)
-- ----------------------------------------------------------------------------
CREATE TABLE watching_reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    watched_content_id UUID NOT NULL REFERENCES watched_content(id) ON DELETE CASCADE,
    use_global_default BOOLEAN NOT NULL DEFAULT TRUE,
    reminder_kind reminder_kind,
    custom_days_before SMALLINT CHECK (custom_days_before IS NULL OR (custom_days_before >= 1 AND custom_days_before <= 30)),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (watched_content_id)
);

-- ----------------------------------------------------------------------------
-- content_embeddings - Vector embeddings for recommendations
-- ----------------------------------------------------------------------------
CREATE TABLE content_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id INTEGER NOT NULL,
    media_type media_type NOT NULL,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (content_id, media_type)
);

COMMENT ON TABLE content_embeddings IS 'Vector embeddings for content (movies/series) for AI-powered recommendations';
COMMENT ON COLUMN content_embeddings.embedding IS 'Vector embedding (1536 dimensions for OpenAI embeddings)';
COMMENT ON COLUMN content_embeddings.metadata IS 'Additional metadata like genres, keywords, etc.';

-- ----------------------------------------------------------------------------
-- user_preference_embeddings - User preference vectors
-- ----------------------------------------------------------------------------
CREATE TABLE user_preference_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    embedding vector(1536),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id)
);

COMMENT ON TABLE user_preference_embeddings IS 'Vector embeddings representing user preferences for personalized recommendations';

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- update_updated_at() - Trigger function to update updated_at timestamp
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_updated_at() IS 'Trigger function to automatically update the updated_at timestamp';

-- ----------------------------------------------------------------------------
-- adjust_custom_list_items_count() - Keep custom_lists.items_count in sync
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION adjust_custom_list_items_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE custom_lists SET items_count = items_count + 1 WHERE id = NEW.list_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE custom_lists
        SET items_count = GREATEST(0, items_count - 1)
        WHERE id = OLD.list_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION adjust_custom_list_items_count() IS 'Increments/decrements custom_lists.items_count when custom_list_items rows are inserted or deleted';

-- ----------------------------------------------------------------------------
-- create_profile_for_new_user() - Trigger to auto-create profile on user signup
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_profile_for_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_display_name TEXT;
    v_email_prefix TEXT;
    v_base_display_name TEXT;
    v_counter INTEGER := 0;
BEGIN
    -- Get display_name from metadata (required and unique)
    v_display_name := NEW.raw_user_meta_data->>'display_name';
    
    -- If no display_name provided, generate from email prefix
    IF v_display_name IS NULL OR v_display_name = '' THEN
        -- Extract email prefix and sanitize
        v_email_prefix := LOWER(SPLIT_PART(NEW.email, '@', 1));
        v_email_prefix := REGEXP_REPLACE(v_email_prefix, '[^a-z0-9]', '', 'g');
        
        -- Ensure minimum length (2 chars)
        IF LENGTH(v_email_prefix) >= 2 THEN
            v_base_display_name := v_email_prefix;
        ELSE
            -- If prefix too short, pad with UUID suffix
            v_base_display_name := v_email_prefix || SUBSTRING(REPLACE(NEW.id::text, '-', '') FROM 1 FOR (10 - LENGTH(v_email_prefix)));
        END IF;
        
        v_display_name := v_base_display_name;
    END IF;
    
    -- Trim whitespace from display_name
    v_display_name := TRIM(v_display_name);
    
    -- Ensure display_name meets minimum length constraint (2 chars)
    IF LENGTH(v_display_name) < 2 THEN
        v_display_name := v_display_name || '0';
        IF LENGTH(v_display_name) < 2 THEN
            v_display_name := v_display_name || '0';
        END IF;
    END IF;
    
    -- Ensure uniqueness - append counter if needed
    WHILE EXISTS (SELECT 1 FROM profiles WHERE display_name = v_display_name) LOOP
        v_counter := v_counter + 1;
        IF v_counter > 999999 THEN
            -- Fallback: use UUID substring if too many conflicts
            v_display_name := 'user' || SUBSTRING(REPLACE(NEW.id::text, '-', '') FROM 1 FOR 20);
            EXIT;
        END IF;
        
        -- Append counter to ensure uniqueness
        v_base_display_name := v_display_name;
        v_display_name := v_base_display_name || v_counter::text;
    END LOOP;
    
    -- Insert profile with display_name (unique and required)
    -- Use ON CONFLICT to handle race conditions gracefully
    INSERT INTO profiles (id, display_name)
    VALUES (
        NEW.id,
        v_display_name
    )
    ON CONFLICT (id) DO NOTHING;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail the user creation
        -- This allows user to be created even if profile creation fails
        -- The application code will handle profile creation manually
        RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_profile_for_new_user() IS 'Automatically creates a profile with a required unique display_name when a new user signs up';

-- ----------------------------------------------------------------------------
-- update_series_completion() - Function to check/update series completion status
-- ----------------------------------------------------------------------------
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
    
    -- If all seasons are completed, mark series as completed
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

COMMENT ON FUNCTION update_series_completion() IS 'Automatically updates season and series completion status when episodes are watched';

-- ----------------------------------------------------------------------------
-- get_user_stats() - Function to calculate user statistics
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS TABLE (
    watched_count INTEGER,
    wishlist_count INTEGER,
    favorites_count INTEGER,
    series_in_progress INTEGER,
    completed_series INTEGER,
    total_episodes_watched INTEGER,
    custom_lists_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*)::INTEGER FROM watched_content WHERE user_id = p_user_id) AS watched_count,
        (SELECT COUNT(*)::INTEGER FROM wishlist WHERE user_id = p_user_id) AS wishlist_count,
        (SELECT COUNT(*)::INTEGER FROM user_favorites WHERE user_id = p_user_id) AS favorites_count,
        (SELECT COUNT(DISTINCT series_id)::INTEGER 
         FROM series_progress 
         WHERE user_id = p_user_id AND completed = FALSE) AS series_in_progress,
        (SELECT COUNT(DISTINCT series_id)::INTEGER 
         FROM series_progress 
         WHERE user_id = p_user_id AND completed = TRUE) AS completed_series,
        (SELECT COUNT(*)::INTEGER 
         FROM series_episodes se
         JOIN series_seasons ss ON se.series_season_id = ss.id
         JOIN series_progress sp ON ss.series_progress_id = sp.id
         WHERE sp.user_id = p_user_id) AS total_episodes_watched,
        (SELECT COUNT(*)::INTEGER FROM custom_lists WHERE user_id = p_user_id) AS custom_lists_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_user_stats(UUID) IS
    'Returns watched_count, wishlist_count, favorites_count (user_favorites), series_in_progress, completed_series, total_episodes_watched, custom_lists_count';

-- ----------------------------------------------------------------------------
-- vector_search_similar_content() - Function for vector similarity search
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vector_search_similar_content(
    p_embedding vector(1536),
    p_media_type media_type DEFAULT NULL,
    p_limit INTEGER DEFAULT 10,
    p_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
    content_id INTEGER,
    media_type media_type,
    similarity FLOAT,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ce.content_id,
        ce.media_type,
        1 - (ce.embedding <=> p_embedding) AS similarity,
        ce.metadata
    FROM content_embeddings ce
    WHERE (p_media_type IS NULL OR ce.media_type = p_media_type)
    AND (1 - (ce.embedding <=> p_embedding)) >= p_threshold
    ORDER BY ce.embedding <=> p_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION vector_search_similar_content(vector, media_type, INTEGER, FLOAT) IS 'Performs cosine similarity search on content embeddings for recommendations';

-- ----------------------------------------------------------------------------
-- series_ids_for_catalog_refresh() - Distinct in-progress series for catalog Edge job
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.series_ids_for_catalog_refresh(p_limit INTEGER DEFAULT 40)
RETURNS TABLE (series_id INTEGER)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sp.series_id
  FROM series_progress sp
  GROUP BY sp.series_id
  ORDER BY MIN(sp.catalog_refreshed_at) ASC NULLS FIRST
  LIMIT COALESCE(p_limit, 40);
$$;

COMMENT ON FUNCTION public.series_ids_for_catalog_refresh(INTEGER) IS 'Distinct series_id from series_progress; stalest catalog_refreshed_at first for refresh_series_progress_catalog Edge job';

GRANT EXECUTE ON FUNCTION public.series_ids_for_catalog_refresh(INTEGER) TO service_role;

-- ----------------------------------------------------------------------------
-- prevent_owner_as_collaborator() - Prevent list owners from being added as collaborators
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_owner_as_collaborator()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if the user being added as collaborator is the list owner
    IF EXISTS (
        SELECT 1 FROM custom_lists cl
        WHERE cl.id = NEW.list_id
        AND cl.user_id = NEW.user_id
    ) THEN
        RAISE EXCEPTION 'List owner cannot be added as a collaborator';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION prevent_owner_as_collaborator() IS 'Prevents list owners from being added as collaborators (owners already have full access)';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp for all tables
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_watched_content_updated_at
    BEFORE UPDATE ON watched_content
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_wishlist_updated_at
    BEFORE UPDATE ON wishlist
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_user_favorites_updated_at
    BEFORE UPDATE ON user_favorites
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_series_progress_updated_at
    BEFORE UPDATE ON series_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_series_seasons_updated_at
    BEFORE UPDATE ON series_seasons
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_series_episodes_updated_at
    BEFORE UPDATE ON series_episodes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_custom_lists_updated_at
    BEFORE UPDATE ON custom_lists
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_custom_list_items_updated_at
    BEFORE UPDATE ON custom_list_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER custom_list_items_count_after_insert
    AFTER INSERT ON custom_list_items
    FOR EACH ROW
    EXECUTE FUNCTION adjust_custom_list_items_count();

CREATE TRIGGER custom_list_items_count_after_delete
    AFTER DELETE ON custom_list_items
    FOR EACH ROW
    EXECUTE FUNCTION adjust_custom_list_items_count();

CREATE TRIGGER update_reviews_updated_at
    BEFORE UPDATE ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_friends_updated_at
    BEFORE UPDATE ON friends
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_content_embeddings_updated_at
    BEFORE UPDATE ON content_embeddings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_user_preference_embeddings_updated_at
    BEFORE UPDATE ON user_preference_embeddings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_list_collaborators_updated_at
    BEFORE UPDATE ON list_collaborators
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_release_cache_updated_at
    BEFORE UPDATE ON release_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_series_sync_queue_updated_at
    BEFORE UPDATE ON series_sync_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

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

CREATE TRIGGER update_wishlist_reminders_updated_at
    BEFORE UPDATE ON wishlist_reminders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_watching_reminders_updated_at
    BEFORE UPDATE ON watching_reminders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Auto-create profile when new user signs up
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_profile_for_new_user();

-- Auto-update series completion when episodes are watched
CREATE TRIGGER on_episode_watched
    AFTER INSERT ON series_episodes
    FOR EACH ROW
    EXECUTE FUNCTION update_series_completion();

-- Prevent list owners from being added as collaborators
CREATE TRIGGER prevent_owner_collaborator
    BEFORE INSERT OR UPDATE ON list_collaborators
    FOR EACH ROW
    EXECUTE FUNCTION prevent_owner_as_collaborator();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE watched_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE series_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE series_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE series_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE release_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE series_sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE regional_airings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE watching_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preference_embeddings ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- profiles RLS Policies
-- ----------------------------------------------------------------------------
-- Users can read their own profile and public profiles
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can view public profiles"
    ON profiles FOR SELECT
    USING (true); -- All authenticated users can view profiles (can be restricted later)

-- Users can only update their own profile
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- Allow trigger to insert profiles (required for create_profile_for_new_user trigger)
-- Even though the trigger uses SECURITY DEFINER, RLS policies may still be enforced
CREATE POLICY "Trigger can insert profiles"
    ON profiles FOR INSERT
    WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- watched_content RLS Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view own watched content"
    ON watched_content FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own watched content"
    ON watched_content FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own watched content"
    ON watched_content FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own watched content"
    ON watched_content FOR DELETE
    USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- wishlist RLS Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view own wishlist"
    ON wishlist FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wishlist items"
    ON wishlist FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own wishlist items"
    ON wishlist FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own wishlist items"
    ON wishlist FOR DELETE
    USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- user_favorites RLS Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view own favorites"
    ON user_favorites FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorites"
    ON user_favorites FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own favorites"
    ON user_favorites FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites"
    ON user_favorites FOR DELETE
    USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- series_progress RLS Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view own series progress"
    ON series_progress FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own series progress"
    ON series_progress FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own series progress"
    ON series_progress FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own series progress"
    ON series_progress FOR DELETE
    USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- series_seasons RLS Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view own series seasons"
    ON series_seasons FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM series_progress sp
            WHERE sp.id = series_seasons.series_progress_id
            AND sp.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own series seasons"
    ON series_seasons FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM series_progress sp
            WHERE sp.id = series_seasons.series_progress_id
            AND sp.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own series seasons"
    ON series_seasons FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM series_progress sp
            WHERE sp.id = series_seasons.series_progress_id
            AND sp.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own series seasons"
    ON series_seasons FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM series_progress sp
            WHERE sp.id = series_seasons.series_progress_id
            AND sp.user_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- series_episodes RLS Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view own series episodes"
    ON series_episodes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM series_seasons ss
            JOIN series_progress sp ON ss.series_progress_id = sp.id
            WHERE ss.id = series_episodes.series_season_id
            AND sp.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own series episodes"
    ON series_episodes FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM series_seasons ss
            JOIN series_progress sp ON ss.series_progress_id = sp.id
            WHERE ss.id = series_episodes.series_season_id
            AND sp.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own series episodes"
    ON series_episodes FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM series_seasons ss
            JOIN series_progress sp ON ss.series_progress_id = sp.id
            WHERE ss.id = series_episodes.series_season_id
            AND sp.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own series episodes"
    ON series_episodes FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM series_seasons ss
            JOIN series_progress sp ON ss.series_progress_id = sp.id
            WHERE ss.id = series_episodes.series_season_id
            AND sp.user_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- custom_lists RLS Policies
-- ----------------------------------------------------------------------------
-- Users can view their own lists, public lists, and lists they collaborate on
CREATE POLICY "Users can view own lists, public lists, and collaborative lists"
    ON custom_lists FOR SELECT
    USING (
        auth.uid() = user_id 
        OR is_public = true
        OR EXISTS (
            SELECT 1 FROM list_collaborators lc
            WHERE lc.list_id = custom_lists.id
            AND lc.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own lists"
    ON custom_lists FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own lists or lists where they are admin collaborators
CREATE POLICY "Users can update own lists or admin collaborative lists"
    ON custom_lists FOR UPDATE
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM list_collaborators lc
            WHERE lc.list_id = custom_lists.id
            AND lc.user_id = auth.uid()
            AND lc.permission = 'admin'
        )
    );

CREATE POLICY "Users can delete own lists"
    ON custom_lists FOR DELETE
    USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- custom_list_items RLS Policies
-- ----------------------------------------------------------------------------
-- Users can view items in their own lists, public lists, and collaborative lists
CREATE POLICY "Users can view items in own lists, public lists, and collaborative lists"
    ON custom_list_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM custom_lists cl
            LEFT JOIN list_collaborators lc ON cl.id = lc.list_id AND lc.user_id = auth.uid()
            WHERE cl.id = custom_list_items.list_id
            AND (cl.user_id = auth.uid() OR cl.is_public = true OR lc.id IS NOT NULL)
        )
    );

-- Users can insert items in their own lists or lists where they are editor/admin
CREATE POLICY "Users can insert items in own lists or collaborative lists"
    ON custom_list_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM custom_lists cl
            LEFT JOIN list_collaborators lc ON cl.id = lc.list_id AND lc.user_id = auth.uid()
            WHERE cl.id = custom_list_items.list_id
            AND (
                cl.user_id = auth.uid()
                OR (lc.id IS NOT NULL AND lc.permission IN ('editor', 'admin'))
            )
        )
    );

-- Users can update items in their own lists or lists where they are editor/admin
CREATE POLICY "Users can update items in own lists or collaborative lists"
    ON custom_list_items FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM custom_lists cl
            LEFT JOIN list_collaborators lc ON cl.id = lc.list_id AND lc.user_id = auth.uid()
            WHERE cl.id = custom_list_items.list_id
            AND (
                cl.user_id = auth.uid()
                OR (lc.id IS NOT NULL AND lc.permission IN ('editor', 'admin'))
            )
        )
    );

-- Users can delete items from their own lists or lists where they are editor/admin
CREATE POLICY "Users can delete items from own lists or collaborative lists"
    ON custom_list_items FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM custom_lists cl
            LEFT JOIN list_collaborators lc ON cl.id = lc.list_id AND lc.user_id = auth.uid()
            WHERE cl.id = custom_list_items.list_id
            AND (
                cl.user_id = auth.uid()
                OR (lc.id IS NOT NULL AND lc.permission IN ('editor', 'admin'))
            )
        )
    );

-- ----------------------------------------------------------------------------
-- list_collaborators RLS Policies
-- ----------------------------------------------------------------------------
-- List owners and collaborators can view collaborators
CREATE POLICY "Users can view collaborators on own lists or lists they collaborate on"
    ON list_collaborators FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM custom_lists cl
            WHERE cl.id = list_collaborators.list_id
            AND (
                cl.user_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM list_collaborators lc2
                    WHERE lc2.list_id = cl.id
                    AND lc2.user_id = auth.uid()
                )
            )
        )
    );

-- List owners and admin collaborators can add collaborators
CREATE POLICY "List owners and admins can add collaborators"
    ON list_collaborators FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM custom_lists cl
            LEFT JOIN list_collaborators lc ON cl.id = lc.list_id AND lc.user_id = auth.uid()
            WHERE cl.id = list_collaborators.list_id
            AND (
                cl.user_id = auth.uid()
                OR (lc.id IS NOT NULL AND lc.permission = 'admin')
            )
        )
    );

-- List owners and admin collaborators can update collaborators
CREATE POLICY "List owners and admins can update collaborators"
    ON list_collaborators FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM custom_lists cl
            LEFT JOIN list_collaborators lc ON cl.id = lc.list_id AND lc.user_id = auth.uid()
            WHERE cl.id = list_collaborators.list_id
            AND (
                cl.user_id = auth.uid()
                OR (lc.id IS NOT NULL AND lc.permission = 'admin')
            )
        )
    );

-- List owners and admin collaborators can remove collaborators
CREATE POLICY "List owners and admins can remove collaborators"
    ON list_collaborators FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM custom_lists cl
            LEFT JOIN list_collaborators lc ON cl.id = lc.list_id AND lc.user_id = auth.uid()
            WHERE cl.id = list_collaborators.list_id
            AND (
                cl.user_id = auth.uid()
                OR (lc.id IS NOT NULL AND lc.permission = 'admin')
            )
        )
    );

-- ----------------------------------------------------------------------------
-- reviews RLS Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Anyone can view reviews"
    ON reviews FOR SELECT
    USING (true);

CREATE POLICY "Users can insert own reviews"
    ON reviews FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reviews"
    ON reviews FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reviews"
    ON reviews FOR DELETE
    USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- review_votes RLS Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Anyone can view review votes"
    ON review_votes FOR SELECT
    USING (true);

CREATE POLICY "Users can insert own votes"
    ON review_votes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own votes"
    ON review_votes FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own votes"
    ON review_votes FOR DELETE
    USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- friends RLS Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view own friendships"
    ON friends FOR SELECT
    USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can insert own friend requests"
    ON friends FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own friendships"
    ON friends FOR UPDATE
    USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can delete own friendships"
    ON friends FOR DELETE
    USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- ----------------------------------------------------------------------------
-- notifications RLS Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view own notifications"
    ON notifications FOR SELECT
    USING (auth.uid() = user_id);

-- Clients cannot forge cron-generated release or catalog rows (Edge uses service role)
CREATE POLICY "Users can insert own notifications"
    ON notifications FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND type IS DISTINCT FROM 'release_reminder'
        AND type IS DISTINCT FROM 'new_episodes'
    );

CREATE POLICY "Users can update own notifications"
    ON notifications FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
    ON notifications FOR DELETE
    USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- notification_preferences RLS Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view own notification preferences"
    ON notification_preferences FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences"
    ON notification_preferences FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
    ON notification_preferences FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notification preferences"
    ON notification_preferences FOR DELETE
    USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- push_subscriptions RLS Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view own push subscriptions"
    ON push_subscriptions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own push subscriptions"
    ON push_subscriptions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push subscriptions"
    ON push_subscriptions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own push subscriptions"
    ON push_subscriptions FOR DELETE
    USING (auth.uid() = user_id);

-- release_cache, series_sync_queue, catalog_episodes, regional_airings, notification_queue:
-- RLS enabled, no policies — service role only

-- ----------------------------------------------------------------------------
-- wishlist_reminders RLS Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view own wishlist reminders"
    ON wishlist_reminders FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM wishlist w
            WHERE w.id = wishlist_reminders.wishlist_id AND w.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own wishlist reminders"
    ON wishlist_reminders FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM wishlist w
            WHERE w.id = wishlist_reminders.wishlist_id AND w.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own wishlist reminders"
    ON wishlist_reminders FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM wishlist w
            WHERE w.id = wishlist_reminders.wishlist_id AND w.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own wishlist reminders"
    ON wishlist_reminders FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM wishlist w
            WHERE w.id = wishlist_reminders.wishlist_id AND w.user_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- watching_reminders RLS Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view own watching reminders"
    ON watching_reminders FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM watched_content wc
            WHERE wc.id = watching_reminders.watched_content_id AND wc.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own watching reminders"
    ON watching_reminders FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM watched_content wc
            WHERE wc.id = watching_reminders.watched_content_id AND wc.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own watching reminders"
    ON watching_reminders FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM watched_content wc
            WHERE wc.id = watching_reminders.watched_content_id AND wc.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own watching reminders"
    ON watching_reminders FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM watched_content wc
            WHERE wc.id = watching_reminders.watched_content_id AND wc.user_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- content_embeddings RLS Policies
-- ----------------------------------------------------------------------------
-- Content embeddings are read-only for all authenticated users (for recommendations)
CREATE POLICY "Anyone can view content embeddings"
    ON content_embeddings FOR SELECT
    USING (true);

-- Only service role can insert/update embeddings (via API)
-- This would typically be done via service role, not through RLS

-- ----------------------------------------------------------------------------
-- user_preference_embeddings RLS Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view own preference embeddings"
    ON user_preference_embeddings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preference embeddings"
    ON user_preference_embeddings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preference embeddings"
    ON user_preference_embeddings FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own preference embeddings"
    ON user_preference_embeddings FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Profile indexes for user search and lookup
CREATE INDEX idx_profiles_display_name ON profiles(display_name);
-- Case-insensitive username uniqueness (display_name column remains UNIQUE for exact string)
CREATE UNIQUE INDEX idx_profiles_display_name_lower ON profiles (LOWER(TRIM(display_name)));

-- Foreign key indexes for better join performance
CREATE INDEX idx_watched_content_user_id ON watched_content(user_id);
CREATE INDEX idx_watched_content_content_id ON watched_content(content_id);
CREATE INDEX idx_watched_content_media_type ON watched_content(media_type);
CREATE INDEX idx_watched_content_date_watched ON watched_content(date_watched DESC);

CREATE INDEX idx_wishlist_user_id ON wishlist(user_id);
CREATE INDEX idx_wishlist_content_id ON wishlist(content_id);
CREATE INDEX idx_wishlist_media_type ON wishlist(media_type);
CREATE INDEX idx_wishlist_date_added ON wishlist(date_added DESC);

CREATE INDEX idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX idx_user_favorites_content_id ON user_favorites(content_id);
CREATE INDEX idx_user_favorites_media_type ON user_favorites(media_type);
CREATE INDEX idx_user_favorites_date_added ON user_favorites(date_added DESC);

CREATE INDEX idx_series_progress_user_id ON series_progress(user_id);
CREATE INDEX idx_series_progress_series_id ON series_progress(series_id);
CREATE INDEX idx_series_progress_completed ON series_progress(completed);
CREATE INDEX idx_series_progress_catalog_refreshed ON series_progress(catalog_refreshed_at);

CREATE INDEX idx_series_seasons_progress_id ON series_seasons(series_progress_id);
CREATE INDEX idx_series_seasons_season_number ON series_seasons(season_number);

CREATE INDEX idx_series_episodes_season_id ON series_episodes(series_season_id);
CREATE INDEX idx_series_episodes_episode_number ON series_episodes(episode_number);

CREATE INDEX idx_custom_lists_user_id ON custom_lists(user_id);
CREATE INDEX idx_custom_lists_is_public ON custom_lists(is_public);
CREATE INDEX idx_custom_lists_created_at ON custom_lists(created_at DESC);

CREATE INDEX idx_custom_list_items_list_id ON custom_list_items(list_id);
CREATE INDEX idx_custom_list_items_content_id ON custom_list_items(content_id);
CREATE INDEX idx_custom_list_items_media_type ON custom_list_items(media_type);

CREATE INDEX idx_list_collaborators_list_id ON list_collaborators(list_id);
CREATE INDEX idx_list_collaborators_user_id ON list_collaborators(user_id);
CREATE INDEX idx_list_collaborators_permission ON list_collaborators(permission);

CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_reviews_content_id ON reviews(content_id);
CREATE INDEX idx_reviews_media_type ON reviews(media_type);
CREATE INDEX idx_reviews_rating ON reviews(rating);
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);

CREATE INDEX idx_review_votes_review_id ON review_votes(review_id);
CREATE INDEX idx_review_votes_user_id ON review_votes(user_id);

CREATE INDEX idx_friends_user_id ON friends(user_id);
CREATE INDEX idx_friends_friend_id ON friends(friend_id);
CREATE INDEX idx_friends_status ON friends(status);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, read);

CREATE INDEX idx_content_embeddings_content_id ON content_embeddings(content_id);
CREATE INDEX idx_content_embeddings_media_type ON content_embeddings(media_type);

CREATE INDEX idx_user_preference_embeddings_user_id ON user_preference_embeddings(user_id);

-- Composite indexes for common query patterns
CREATE INDEX idx_watched_content_user_media ON watched_content(user_id, media_type);
CREATE INDEX idx_watched_content_user_content_media ON watched_content(user_id, content_id, media_type);
CREATE INDEX idx_wishlist_user_media ON wishlist(user_id, media_type);
CREATE INDEX idx_wishlist_user_content_media ON wishlist(user_id, content_id, media_type);
CREATE INDEX idx_user_favorites_user_media ON user_favorites(user_id, media_type);
CREATE INDEX idx_user_favorites_user_content_media ON user_favorites(user_id, content_id, media_type);
CREATE INDEX idx_reviews_user_content_media ON reviews(user_id, content_id, media_type);
CREATE INDEX idx_reviews_content_media ON reviews(content_id, media_type);

-- Series progress composite indexes for efficient lookups
CREATE INDEX idx_series_progress_user_series ON series_progress(user_id, series_id);
CREATE INDEX idx_series_seasons_progress_season ON series_seasons(series_progress_id, season_number);
CREATE INDEX idx_series_episodes_season_episode ON series_episodes(series_season_id, episode_number);

-- Custom lists composite indexes for faster access patterns
CREATE INDEX idx_custom_list_items_list_content_media ON custom_list_items(list_id, content_id, media_type);
CREATE INDEX idx_list_collaborators_list_user ON list_collaborators(list_id, user_id);

-- Partial indexes for filtered queries (common access patterns)
CREATE INDEX idx_series_progress_incomplete ON series_progress(user_id, series_id) WHERE completed = FALSE;
CREATE INDEX idx_series_seasons_incomplete ON series_seasons(series_progress_id) WHERE completed = FALSE;
CREATE INDEX idx_notifications_unread ON notifications(user_id, created_at DESC) WHERE read = FALSE;
CREATE INDEX idx_notifications_release_push_pending ON notifications (created_at)
    WHERE type = 'release_reminder' AND push_sent_at IS NULL;
CREATE UNIQUE INDEX idx_notifications_user_dedupe_unique ON notifications (user_id, dedupe_key)
    WHERE dedupe_key IS NOT NULL;

CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);

CREATE INDEX idx_release_cache_refreshed_at ON release_cache(refreshed_at);
CREATE INDEX idx_release_cache_content_media ON release_cache(content_id, media_type);

CREATE INDEX idx_series_sync_queue_pending_created ON series_sync_queue (created_at)
    WHERE status = 'pending';
CREATE UNIQUE INDEX idx_series_sync_queue_pending_unique ON series_sync_queue (content_id, media_type)
    WHERE status = 'pending';

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

CREATE INDEX idx_catalog_episodes_show_id ON catalog_episodes (show_id);

CREATE UNIQUE INDEX idx_notification_queue_user_dedupe_active
    ON notification_queue (user_id, dedupe_key)
    WHERE status IN ('pending', 'materialized');

CREATE INDEX idx_notification_queue_pending_send
    ON notification_queue (send_at_utc)
    WHERE status = 'pending';

CREATE INDEX idx_wishlist_reminders_wishlist_id ON wishlist_reminders(wishlist_id);
CREATE INDEX idx_watching_reminders_watched_content_id ON watching_reminders(watched_content_id);

CREATE INDEX idx_friends_accepted ON friends(user_id, friend_id) WHERE status = 'accepted';
CREATE INDEX idx_friends_pending ON friends(friend_id, created_at DESC) WHERE status = 'pending';
CREATE INDEX idx_custom_lists_public ON custom_lists(created_at DESC) WHERE is_public = TRUE;

-- Content lookup indexes for fast content checks across media types
CREATE INDEX idx_watched_content_lookup ON watched_content(content_id, media_type, user_id);
CREATE INDEX idx_wishlist_lookup ON wishlist(content_id, media_type, user_id);
CREATE INDEX idx_user_favorites_lookup ON user_favorites(content_id, media_type, user_id);

-- Vector similarity search indexes (using HNSW for better performance)
-- Note: These indexes require pgvector extension
CREATE INDEX idx_content_embeddings_vector ON content_embeddings 
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_user_preference_embeddings_vector ON user_preference_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- ============================================================================
-- SUPABASE REALTIME (LIVE PROFILE UI)
-- ============================================================================
-- The Next.js app subscribes to postgres_changes on `friends` and `notifications`
-- when the user has a Supabase Auth session. Idempotent: skips if already in publication.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'friends'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE friends;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;

-- ============================================================================
-- OPTIONAL: ONE-TIME DATA STEPS (EXISTING DATABASES ONLY, NOT FRESH INSTALLS)
-- ============================================================================
-- Incremental migrations under supabase/migrations/ (apply via CLI or merge here):
--   20260328150000_user_favorites.sql          — user_favorites table + RLS (if not using this full schema)
--   20260329120000_display_name_ci_unique_resolve.sql — UNIQUE idx LOWER(TRIM(display_name)), profile_id_for_display_name()
--   20260330120000_get_user_stats_favorites_count.sql — get_user_stats() + favorites_count column
--   20260519170000_exclude_specials_from_series_completion.sql — update_series_completion() ignores season 0
--   20260521120000_precompute_release_notifications.sql — catalog_episodes, regional_airings, notification_queue
--   20260521130000_notification_pipeline_cron.sql — pg_cron templates for ingest / precompute / dispatch
-- A greenfield run of this schema.sql already includes those objects; use migrations only for upgrades.

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================

