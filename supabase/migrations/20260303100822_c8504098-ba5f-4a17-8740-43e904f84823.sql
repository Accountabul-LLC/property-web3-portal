
-- Portfolio holdings
CREATE TABLE public.portfolio_holdings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  tokens_owned int NOT NULL DEFAULT 0,
  average_purchase_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(wallet_address, property_id)
);

-- Portfolio transactions
CREATE TABLE public.portfolio_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  transaction_type text NOT NULL, -- buy/sell
  tokens int NOT NULL,
  price_per_token numeric NOT NULL,
  total_amount numeric NOT NULL,
  tx_hash text,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Property reviews
CREATE TABLE public.property_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  wallet_address text NOT NULL,
  user_name text,
  rating int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  ownership_percentage numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Property documents
CREATE TABLE public.property_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  file_url text NOT NULL,
  file_type text DEFAULT 'PDF',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Token orders (order book)
CREATE TABLE public.token_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  wallet_address text NOT NULL,
  side text NOT NULL, -- buy/sell
  price numeric NOT NULL,
  quantity int NOT NULL,
  filled_quantity int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open', -- open/filled/cancelled
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Token price history
CREATE TABLE public.token_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  price numeric NOT NULL,
  volume int DEFAULT 0,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

-- Saved properties / watchlist
CREATE TABLE public.saved_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(wallet_address, property_id)
);

-- Newsletter subscribers
CREATE TABLE public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  subscribed_at timestamptz NOT NULL DEFAULT now()
);

-- Service bookings
CREATE TABLE public.service_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES public.professionals(id) ON DELETE CASCADE NOT NULL,
  wallet_address text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending/confirmed/completed/cancelled
  notes text,
  scheduled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS Policies

-- portfolio_holdings: owner read/write
ALTER TABLE public.portfolio_holdings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read portfolio holdings" ON public.portfolio_holdings FOR SELECT USING (true);
CREATE POLICY "Anyone can insert portfolio holdings" ON public.portfolio_holdings FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update portfolio holdings" ON public.portfolio_holdings FOR UPDATE USING (true);

-- portfolio_transactions: owner read, system insert
ALTER TABLE public.portfolio_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read portfolio transactions" ON public.portfolio_transactions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert portfolio transactions" ON public.portfolio_transactions FOR INSERT WITH CHECK (true);

-- property_reviews: public read, wallet owner insert
ALTER TABLE public.property_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read property reviews" ON public.property_reviews FOR SELECT USING (true);
CREATE POLICY "Anyone can insert property reviews" ON public.property_reviews FOR INSERT WITH CHECK (true);

-- property_documents: public read
ALTER TABLE public.property_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read property documents" ON public.property_documents FOR SELECT USING (true);
CREATE POLICY "Anyone can insert property documents" ON public.property_documents FOR INSERT WITH CHECK (true);

-- token_orders: public read, wallet owner insert/update
ALTER TABLE public.token_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read token orders" ON public.token_orders FOR SELECT USING (true);
CREATE POLICY "Anyone can insert token orders" ON public.token_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update token orders" ON public.token_orders FOR UPDATE USING (true);

-- token_price_history: public read
ALTER TABLE public.token_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read price history" ON public.token_price_history FOR SELECT USING (true);
CREATE POLICY "Anyone can insert price history" ON public.token_price_history FOR INSERT WITH CHECK (true);

-- saved_properties: wallet owner read/write
ALTER TABLE public.saved_properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read saved properties" ON public.saved_properties FOR SELECT USING (true);
CREATE POLICY "Anyone can insert saved properties" ON public.saved_properties FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete saved properties" ON public.saved_properties FOR DELETE USING (true);

-- newsletter_subscribers: insert only (public)
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can subscribe" ON public.newsletter_subscribers FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read subscribers" ON public.newsletter_subscribers FOR SELECT USING (true);

-- service_bookings: wallet owner read/write
ALTER TABLE public.service_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read service bookings" ON public.service_bookings FOR SELECT USING (true);
CREATE POLICY "Anyone can insert service bookings" ON public.service_bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update service bookings" ON public.service_bookings FOR UPDATE USING (true);
