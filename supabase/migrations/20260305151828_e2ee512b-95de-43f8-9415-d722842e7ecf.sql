
ALTER TABLE public.profiles ADD COLUMN first_name text;
ALTER TABLE public.profiles ADD COLUMN last_name text;
ALTER TABLE public.profiles ADD COLUMN date_of_birth date;
ALTER TABLE public.profiles ADD COLUMN gender text;
ALTER TABLE public.profiles ADD COLUMN address_line1 text;
ALTER TABLE public.profiles ADD COLUMN address_line2 text;
ALTER TABLE public.profiles ADD COLUMN city text;
ALTER TABLE public.profiles ADD COLUMN state text;
ALTER TABLE public.profiles ADD COLUMN zip text;
ALTER TABLE public.profiles ADD COLUMN country text DEFAULT 'US';
