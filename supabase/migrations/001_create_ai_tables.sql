-- 001_create_ai_tables.sql
-- Create tables for AI video generation jobs, niches, and voices

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS niches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  prompt_template text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS voices (
  id text PRIMARY KEY,
  name text,
  provider text,
  language text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text,
  niche_id uuid REFERENCES niches(id),
  voice_id text,
  prompt text,
  status text DEFAULT 'queued', -- queued / running / failed / complete
  result_video_url text,
  result_audio_url text,
  error_text text,
  parameters jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add platforms and source_job_id to scheduled_posts if not present
ALTER TABLE IF EXISTS scheduled_posts
  ADD COLUMN IF NOT EXISTS platforms text,
  ADD COLUMN IF NOT EXISTS source_job_id uuid;
