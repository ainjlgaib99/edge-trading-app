-- trader_settings
CREATE TABLE IF NOT EXISTS trader_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT,
  instruments TEXT[] DEFAULT ARRAY['MNQ', 'MES'],
  strategy TEXT DEFAULT 'FRVP + AMT',
  max_risk_per_trade NUMERIC DEFAULT 250,
  absolute_max_risk NUMERIC DEFAULT 500,
  min_rr NUMERIC DEFAULT 2.0,
  max_trades_per_day INTEGER DEFAULT 2,
  max_losses_per_day INTEGER DEFAULT 2,
  prop_firm TEXT DEFAULT 'Topstep',
  account_size NUMERIC DEFAULT 50000,
  profit_target NUMERIC DEFAULT 3000,
  max_drawdown NUMERIC DEFAULT 2500,
  daily_loss_limit NUMERIC DEFAULT 2000,
  min_trading_days INTEGER DEFAULT 15,
  session_1_start TEXT DEFAULT '6:30 AM',
  session_1_end TEXT DEFAULT '8:00 AM',
  session_2_start TEXT,
  session_2_end TEXT,
  eval_status TEXT DEFAULT 'Paper Trading',
  daily_goal NUMERIC DEFAULT 200,
  airtable_api_key TEXT,
  airtable_base_id TEXT,
  airtable_table_id TEXT,
  slack_webhook_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
ALTER TABLE trader_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "ts_select" ON trader_settings FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "ts_insert" ON trader_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "ts_update" ON trader_settings FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- trades
CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  time_in TEXT,
  time_out TEXT,
  instrument TEXT NOT NULL DEFAULT 'MNQ',
  direction TEXT NOT NULL,
  setup_type TEXT NOT NULL,
  entry_price NUMERIC NOT NULL,
  stop_price NUMERIC NOT NULL,
  target_price NUMERIC NOT NULL,
  exit_price NUMERIC,
  planned_rr NUMERIC,
  actual_rr NUMERIC,
  pnl NUMERIC DEFAULT 0,
  risk_amount NUMERIC,
  result TEXT,
  followed_rules BOOLEAN DEFAULT true,
  rules_broken TEXT[],
  emotional_state TEXT DEFAULT 'Calm',
  emotion_score INTEGER DEFAULT 3,
  trade_grade TEXT DEFAULT 'B',
  screenshot TEXT,
  frvp_level TEXT,
  notes TEXT,
  session TEXT DEFAULT 'NY AM',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trades_user_date ON trades(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_trades_setup ON trades(setup_type);
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "t_select" ON trades FOR SELECT USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "t_insert" ON trades FOR INSERT WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "t_update" ON trades FOR UPDATE USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "t_delete" ON trades FOR DELETE USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- daily_levels
CREATE TABLE IF NOT EXISTS daily_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  instrument TEXT DEFAULT 'MNQ',
  vah NUMERIC,
  val NUMERIC,
  poc NUMERIC,
  prev_day_high NUMERIC,
  prev_day_low NUMERIC,
  weekly_vah NUMERIC,
  weekly_val NUMERIC,
  weekly_poc NUMERIC,
  bias TEXT DEFAULT 'Neutral',
  bias_notes TEXT,
  news_events BOOLEAN DEFAULT false,
  news_details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);
ALTER TABLE daily_levels ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "dl_select" ON daily_levels FOR SELECT USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "dl_insert" ON daily_levels FOR INSERT WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "dl_update" ON daily_levels FOR UPDATE USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- prop_firm_accounts
CREATE TABLE IF NOT EXISTS prop_firm_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account_name TEXT NOT NULL,
  prop_firm TEXT NOT NULL DEFAULT 'Topstep',
  account_size NUMERIC NOT NULL DEFAULT 50000,
  account_type TEXT NOT NULL DEFAULT 'Evaluation',
  status TEXT NOT NULL DEFAULT 'Active',
  start_date DATE DEFAULT CURRENT_DATE,
  profit_target NUMERIC DEFAULT 3000,
  max_drawdown_allowed NUMERIC DEFAULT 2500,
  drawdown_used NUMERIC DEFAULT 0,
  daily_loss_limit NUMERIC DEFAULT 2000,
  trading_days INTEGER DEFAULT 0,
  min_trading_days INTEGER DEFAULT 15,
  activation_fee NUMERIC DEFAULT 0,
  monthly_fee NUMERIC DEFAULT 0,
  payout_split NUMERIC DEFAULT 80,
  total_withdrawn NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE prop_firm_accounts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "pfa_select" ON prop_firm_accounts FOR SELECT USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "pfa_insert" ON prop_firm_accounts FOR INSERT WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "pfa_update" ON prop_firm_accounts FOR UPDATE USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "pfa_delete" ON prop_firm_accounts FOR DELETE USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
