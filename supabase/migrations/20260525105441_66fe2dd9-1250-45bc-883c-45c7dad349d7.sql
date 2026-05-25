ALTER TABLE public.campaigns REPLICA IDENTITY FULL;
ALTER TABLE public.campaign_donations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaigns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_donations;