-- Task Quest Supabase Schema
-- Run this in your Supabase SQL Editor
-- All tables prefixed with tq_ for easy identification

-- 1. PROFILES TABLE (user state)
CREATE TABLE tq_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  nickname TEXT,
  role TEXT NOT NULL DEFAULT 'child', -- child, guardian, educator, therapist, family_support
  avatar_url TEXT,
  current_level INTEGER DEFAULT 1,
  total_xp INTEGER DEFAULT 0,
  coins INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_task_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. FAMILY LINKS (connect family members)
CREATE TABLE tq_family_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code TEXT UNIQUE NOT NULL, -- shared code to join family
  created_by UUID REFERENCES tq_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tq_family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES tq_family_links(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES tq_profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- guardian_primary, guardian_secondary, child, sibling, etc.
  permissions TEXT[] DEFAULT '{}',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(family_id, profile_id)
);

-- 3. TASK COMPLETIONS (daily log)
CREATE TABLE tq_task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES tq_profiles(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL, -- references task from embedded config
  task_category TEXT NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  verified_by UUID REFERENCES tq_profiles(id),
  verified_at TIMESTAMPTZ,
  xp_earned INTEGER DEFAULT 0,
  coins_earned INTEGER DEFAULT 0,
  notes TEXT,
  completion_date DATE DEFAULT CURRENT_DATE
);

-- 4. ACHIEVEMENTS UNLOCKED
CREATE TABLE tq_achievements_unlocked (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES tq_profiles(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  xp_reward INTEGER DEFAULT 0,
  coin_reward INTEGER DEFAULT 0,
  UNIQUE(profile_id, achievement_id)
);

-- 5. REWARD PURCHASES
CREATE TABLE tq_reward_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES tq_profiles(id) ON DELETE CASCADE,
  reward_id TEXT NOT NULL,
  cost_coins INTEGER NOT NULL,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  redeemed BOOLEAN DEFAULT FALSE,
  redeemed_at TIMESTAMPTZ,
  approved_by UUID REFERENCES tq_profiles(id),
  notes TEXT
);

-- 6. DAILY SUMMARIES (for streak tracking)
CREATE TABLE tq_daily_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES tq_profiles(id) ON DELETE CASCADE,
  summary_date DATE NOT NULL,
  tasks_completed INTEGER DEFAULT 0,
  tasks_total INTEGER DEFAULT 0,
  xp_earned INTEGER DEFAULT 0,
  coins_earned INTEGER DEFAULT 0,
  is_perfect_day BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, summary_date)
);

-- 7. AUDIT LOG (for HIPAA compliance)
CREATE TABLE tq_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES tq_profiles(id),
  action TEXT NOT NULL,
  target_table TEXT,
  target_id UUID,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE tq_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tq_family_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE tq_family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tq_task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tq_achievements_unlocked ENABLE ROW LEVEL SECURITY;
ALTER TABLE tq_reward_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE tq_daily_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE tq_audit_log ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own profile
CREATE POLICY "Users can view own profile" ON tq_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON tq_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON tq_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Family members can view each other's profiles
CREATE POLICY "Family members can view each other" ON tq_profiles
  FOR SELECT USING (
    id IN (
      SELECT fm2.profile_id FROM tq_family_members fm1
      JOIN tq_family_members fm2 ON fm1.family_id = fm2.family_id
      WHERE fm1.profile_id = auth.uid()
    )
  );

-- Task completions: viewable by self and family
CREATE POLICY "Users can view own task completions" ON tq_task_completions
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "Family can view task completions" ON tq_task_completions
  FOR SELECT USING (
    profile_id IN (
      SELECT fm2.profile_id FROM tq_family_members fm1
      JOIN tq_family_members fm2 ON fm1.family_id = fm2.family_id
      WHERE fm1.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own task completions" ON tq_task_completions
  FOR INSERT WITH CHECK (auth.uid() = profile_id);

-- Guardians can verify tasks
CREATE POLICY "Family can verify tasks" ON tq_task_completions
  FOR UPDATE USING (
    profile_id IN (
      SELECT fm2.profile_id FROM tq_family_members fm1
      JOIN tq_family_members fm2 ON fm1.family_id = fm2.family_id
      WHERE fm1.profile_id = auth.uid()
    )
  );

-- Achievements: users can view/insert their own
CREATE POLICY "Users can view own achievements" ON tq_achievements_unlocked
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "Users can insert own achievements" ON tq_achievements_unlocked
  FOR INSERT WITH CHECK (profile_id = auth.uid());

-- Rewards: users can view/insert their own purchases
CREATE POLICY "Users can view own purchases" ON tq_reward_purchases
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "Users can insert own purchases" ON tq_reward_purchases
  FOR INSERT WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Family can view purchases" ON tq_reward_purchases
  FOR SELECT USING (
    profile_id IN (
      SELECT fm2.profile_id FROM tq_family_members fm1
      JOIN tq_family_members fm2 ON fm1.family_id = fm2.family_id
      WHERE fm1.profile_id = auth.uid()
    )
  );

-- Daily summaries
CREATE POLICY "Users can manage own summaries" ON tq_daily_summaries
  FOR ALL USING (profile_id = auth.uid());

-- Family links
CREATE POLICY "Anyone can view family links" ON tq_family_links
  FOR SELECT USING (true);

CREATE POLICY "Users can create family links" ON tq_family_links
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Family members
CREATE POLICY "Users can view own family membership" ON tq_family_members
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "Users can join families" ON tq_family_members
  FOR INSERT WITH CHECK (profile_id = auth.uid());

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION tq_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tq_profiles_updated_at
  BEFORE UPDATE ON tq_profiles
  FOR EACH ROW EXECUTE FUNCTION tq_update_updated_at();

-- Function to calculate level from XP
CREATE OR REPLACE FUNCTION tq_calculate_level(xp INTEGER)
RETURNS INTEGER AS $$
DECLARE
  level INTEGER := 1;
  xp_needed INTEGER := 120;
BEGIN
  WHILE xp >= xp_needed AND level < 50 LOOP
    level := level + 1;
    xp_needed := xp_needed + (100 * level * 1.2)::INTEGER;
  END LOOP;
  RETURN level;
END;
$$ LANGUAGE plpgsql;

-- Function to update streak
CREATE OR REPLACE FUNCTION tq_update_streak(user_id UUID)
RETURNS VOID AS $$
DECLARE
  last_date DATE;
  curr_streak INTEGER;
  long_streak INTEGER;
BEGIN
  SELECT last_task_date, current_streak, longest_streak
  INTO last_date, curr_streak, long_streak
  FROM tq_profiles WHERE id = user_id;

  IF last_date = CURRENT_DATE - 1 THEN
    curr_streak := curr_streak + 1;
  ELSIF last_date < CURRENT_DATE - 1 THEN
    curr_streak := 1;
  END IF;

  IF curr_streak > long_streak THEN
    long_streak := curr_streak;
  END IF;

  UPDATE tq_profiles SET
    current_streak = curr_streak,
    longest_streak = long_streak,
    last_task_date = CURRENT_DATE
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to generate family code
CREATE OR REPLACE FUNCTION tq_generate_family_code()
RETURNS TEXT AS $$
BEGIN
  RETURN upper(substr(md5(random()::text), 1, 8));
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_tq_task_completions_profile ON tq_task_completions(profile_id);
CREATE INDEX idx_tq_task_completions_date ON tq_task_completions(completion_date);
CREATE INDEX idx_tq_daily_summaries_profile_date ON tq_daily_summaries(profile_id, summary_date);
CREATE INDEX idx_tq_family_members_family ON tq_family_members(family_id);
CREATE INDEX idx_tq_audit_log_actor ON tq_audit_log(actor_id);
CREATE INDEX idx_tq_audit_log_created ON tq_audit_log(created_at);
