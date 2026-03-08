INSERT INTO public.properties (
  owner_user_id, owner_wallet, title, address, city, state, zip,
  property_type, bedrooms, bathrooms, square_feet, year_built,
  estimated_value, description, images, total_tokens, tokens_available,
  price_per_token, projected_rental_yield, status
) VALUES (
  'b6f3eec4-be1a-439c-9334-c4624b7f2b42',
  'rPZdYatVHP4YegTp3qQzkdojCAihb8DmAx',
  'Coral Reef Beach House Token',
  '221B Baker Street',
  'Fort Lauderdale',
  'FL',
  '55252',
  'Single Family',
  4, 2, 800, 2018,
  1400000,
  'Beautiful property in a prime location with modern amenities and excellent investment potential. Recently renovated with high-end finishes throughout.',
  ARRAY['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80'],
  7000, 7000,
  200, 8.5,
  'active'
)