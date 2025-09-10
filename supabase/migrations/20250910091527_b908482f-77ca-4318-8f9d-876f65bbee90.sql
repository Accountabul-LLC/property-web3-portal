-- Create table for tracking Xaman payloads
CREATE TABLE public.xaman_payloads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  uuid TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  wallet_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  signed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for wallet profiles
CREATE TABLE public.wallet_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_login TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.xaman_payloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for xaman_payloads (system access for edge functions)
CREATE POLICY "System can manage Xaman payloads" 
ON public.xaman_payloads 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create policies for wallet_profiles
CREATE POLICY "Users can view all wallet profiles" 
ON public.wallet_profiles 
FOR SELECT 
USING (true);

CREATE POLICY "System can manage wallet profiles" 
ON public.wallet_profiles 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update wallet profiles" 
ON public.wallet_profiles 
FOR UPDATE 
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_xaman_payloads_updated_at
BEFORE UPDATE ON public.xaman_payloads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_wallet_profiles_updated_at
BEFORE UPDATE ON public.wallet_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();