-- ============================================================
-- Ledgerly - Supabase Cloud Database Schema
-- Run this in your Supabase SQL Editor:
-- Dashboard -> SQL Editor -> New Query -> Paste & Run
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Bank Accounts Table
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  nickname TEXT NOT NULL,
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  last_four_digits TEXT,
  logo TEXT,
  color TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, user_id)
);
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_accounts_owner_policy" ON public.bank_accounts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user ON public.bank_accounts (user_id);

-- 2. Business Loans Table
CREATE TABLE IF NOT EXISTS public.business_loans (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  principal NUMERIC NOT NULL,
  date_lent TEXT NOT NULL,
  monthly_interest NUMERIC NOT NULL,
  first_due_date TEXT NOT NULL,
  bank_account_id TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  principal_remaining NUMERIC NOT NULL,
  is_others_money BOOLEAN DEFAULT false,
  others_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, user_id)
);
ALTER TABLE public.business_loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "business_loans_owner_policy" ON public.business_loans
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_business_loans_user ON public.business_loans (user_id);

-- 3. Monthly Interest Records Table
CREATE TABLE IF NOT EXISTS public.monthly_interest_records (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loan_id TEXT NOT NULL,
  month INT NOT NULL,
  year INT NOT NULL,
  principal NUMERIC NOT NULL,
  expected_interest NUMERIC NOT NULL,
  collected_amount NUMERIC NOT NULL DEFAULT 0,
  pending_amount NUMERIC NOT NULL DEFAULT 0,
  due_date TEXT NOT NULL,
  collection_date TEXT,
  collection_bank_account_id TEXT,
  status TEXT NOT NULL DEFAULT 'coming_soon',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, user_id)
);
ALTER TABLE public.monthly_interest_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "monthly_interest_records_owner_policy" ON public.monthly_interest_records
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_interest_user ON public.monthly_interest_records (user_id);

-- 4. Principal Repayments Table
CREATE TABLE IF NOT EXISTS public.principal_repayments (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loan_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  bank_account_id TEXT,
  date TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, user_id)
);
ALTER TABLE public.principal_repayments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "principal_repayments_owner_policy" ON public.principal_repayments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_principal_repayments_user ON public.principal_repayments (user_id);

-- 5. Personal Loans Table
CREATE TABLE IF NOT EXISTS public.personal_loans (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_name TEXT NOT NULL,
  amount_lent NUMERIC NOT NULL,
  date_lent TEXT,
  expected_repayment_date TEXT,
  bank_account_id TEXT,
  notes TEXT,
  amount_returned NUMERIC NOT NULL DEFAULT 0,
  outstanding_balance NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, user_id)
);
ALTER TABLE public.personal_loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "personal_loans_owner_policy" ON public.personal_loans
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_personal_loans_user ON public.personal_loans (user_id);

-- 6. Personal Repayments Table
CREATE TABLE IF NOT EXISTS public.personal_repayments (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  personal_loan_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  bank_account_id TEXT,
  date TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, user_id)
);
ALTER TABLE public.personal_repayments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "personal_repayments_owner_policy" ON public.personal_repayments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_personal_repayments_user ON public.personal_repayments (user_id);

-- 7. Expenses Table
CREATE TABLE IF NOT EXISTS public.expenses (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  bank_account_id TEXT,
  category TEXT NOT NULL,
  spent_for TEXT NOT NULL,
  date TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, user_id)
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses_owner_policy" ON public.expenses
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user ON public.expenses (user_id);

-- 8. Incomes Table
CREATE TABLE IF NOT EXISTS public.incomes (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  source TEXT NOT NULL,
  bank_account_id TEXT NOT NULL,
  date TEXT NOT NULL,
  description TEXT,
  related_transaction_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, user_id)
);
ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "incomes_owner_policy" ON public.incomes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_incomes_user ON public.incomes (user_id);

-- 9. Bank Transfers Table
CREATE TABLE IF NOT EXISTS public.bank_transfers (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_account_id TEXT NOT NULL,
  to_account_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  date TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, user_id)
);
ALTER TABLE public.bank_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_transfers_owner_policy" ON public.bank_transfers
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_bank_transfers_user ON public.bank_transfers (user_id);

-- 10. Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  date TEXT NOT NULL,
  bank_account_id TEXT NOT NULL,
  secondary_bank_account_id TEXT,
  description TEXT NOT NULL,
  category TEXT,
  related_entity_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, user_id)
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transactions_owner_policy" ON public.transactions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON public.transactions (user_id);

-- 11. Activity Logs (Passbook Audit Trail) Table
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp TEXT NOT NULL,
  date TEXT NOT NULL,
  module TEXT NOT NULL,
  action_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC,
  flow TEXT,
  bank_account_id TEXT,
  bank_account_name TEXT,
  secondary_bank_account_id TEXT,
  secondary_bank_account_name TEXT,
  entity_id TEXT,
  person_name TEXT,
  category TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, user_id)
);
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_logs_owner_policy" ON public.activity_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON public.activity_logs (user_id);

-- 12. App Settings Table
CREATE TABLE IF NOT EXISTS public.app_settings (
  id TEXT NOT NULL DEFAULT 'app_settings',
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, user_id)
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_settings_owner_policy" ON public.app_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_app_settings_user ON public.app_settings (user_id);
