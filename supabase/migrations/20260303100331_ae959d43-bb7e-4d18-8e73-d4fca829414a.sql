
-- Core tables for the application

-- Wallet profiles
CREATE TABLE public.wallet_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text UNIQUE NOT NULL,
  display_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login timestamptz DEFAULT now()
);

-- Xaman payloads
CREATE TABLE public.xaman_payloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid text UNIQUE NOT NULL,
  wallet_address text,
  status text NOT NULL DEFAULT 'pending',
  signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Properties
CREATE TABLE public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_wallet text REFERENCES public.wallet_profiles(wallet_address),
  title text NOT NULL,
  address text,
  city text,
  state text,
  zip text,
  description text,
  property_type text,
  bedrooms int,
  bathrooms int,
  square_feet int,
  year_built int,
  amenities text[] DEFAULT '{}',
  images text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'Active',
  price_per_token numeric,
  total_tokens int,
  tokens_available int,
  projected_annual_return numeric,
  projected_rental_yield numeric,
  market_cap numeric,
  estimated_value numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Professionals
CREATE TABLE public.professionals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text,
  name text NOT NULL,
  title text,
  description text,
  service_type text,
  location text,
  rating numeric DEFAULT 0,
  review_count int DEFAULT 0,
  completed_jobs int DEFAULT 0,
  response_time text,
  price_range text,
  verified boolean DEFAULT false,
  specialties text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- AI Agents
CREATE TABLE public.ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text,
  description text,
  role text,
  rating numeric DEFAULT 0,
  rating_count int DEFAULT 0,
  tasks_completed int DEFAULT 0,
  response_time text,
  price_model text,
  price_text text,
  skills text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS Policies

-- wallet_profiles: public read, anon insert (for edge functions)
ALTER TABLE public.wallet_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read wallet profiles" ON public.wallet_profiles FOR SELECT USING (true);
CREATE POLICY "Anon can insert wallet profiles" ON public.wallet_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon can update wallet profiles" ON public.wallet_profiles FOR UPDATE USING (true);

-- xaman_payloads: anon insert, anon select/update (edge functions use anon key)
ALTER TABLE public.xaman_payloads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can insert xaman payloads" ON public.xaman_payloads FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon can select xaman payloads" ON public.xaman_payloads FOR SELECT USING (true);
CREATE POLICY "Anon can update xaman payloads" ON public.xaman_payloads FOR UPDATE USING (true);

-- properties: public read
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read properties" ON public.properties FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert properties" ON public.properties FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can update properties" ON public.properties FOR UPDATE USING (true);

-- professionals: public read
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read professionals" ON public.professionals FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert professionals" ON public.professionals FOR INSERT WITH CHECK (true);

-- ai_agents: public read
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read ai agents" ON public.ai_agents FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert ai agents" ON public.ai_agents FOR INSERT WITH CHECK (true);
