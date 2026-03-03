

## Current State

Your database is completely empty -- no tables exist. All data in the application is hardcoded as mock/dummy data directly in the component files:

- **Properties** (PropertyListingsSection, PropertyDetail) -- 3 mock property listings and 1 detailed property, all inline
- **Portfolio** (PortfolioSection) -- fake holdings, transactions, summary stats
- **Professionals** (MarketplaceSection) -- 6 fake service providers
- **AI Agents** (AIAgentMarketplaceSection) -- 8 fake AI agents
- **Xaman/Wallet** -- Edge Functions reference `xaman_payloads` and `wallet_profiles` tables that don't exist yet

## Plan: Build Core Database Schema

### Migration 1 -- Core Tables

Create these tables to back the application's real features:

```text
wallet_profiles
├── id (uuid, PK)
├── wallet_address (text, unique, not null)
├── display_name (text, nullable)
├── avatar_url (text, nullable)
├── created_at (timestamptz)
└── last_login (timestamptz)

xaman_payloads
├── id (uuid, PK)
├── uuid (text, unique, not null)
├── wallet_address (text, nullable)
├── status (text, default 'pending')  -- pending/signed/cancelled/expired
├── signed_at (timestamptz, nullable)
└── created_at (timestamptz)

properties
├── id (uuid, PK)
├── owner_wallet (text, references wallet_profiles.wallet_address)
├── title (text)
├── address, city, state, zip (text)
├── description (text)
├── property_type (text)
├── bedrooms, bathrooms (int)
├── square_feet (int)
├── year_built (int)
├── amenities (text[])
├── images (text[])
├── status (text, default 'Active')  -- Active/Sold/Coming Soon
├── price_per_token (numeric)
├── total_tokens (int)
├── tokens_available (int)
├── projected_annual_return (numeric)
├── projected_rental_yield (numeric)
├── market_cap (numeric)
├── estimated_value (numeric)
├── created_at / updated_at (timestamptz)

professionals
├── id (uuid, PK)
├── wallet_address (text, nullable)
├── name, title, description (text)
├── service_type (text)
├── location (text)
├── rating (numeric)
├── review_count (int)
├── completed_jobs (int)
├── response_time (text)
├── price_range (text)
├── verified (boolean, default false)
├── specialties (text[])
├── created_at (timestamptz)

ai_agents
├── id (uuid, PK)
├── name, type, description (text)
├── role (text)
├── rating (numeric)
├── rating_count, tasks_completed (int)
├── response_time, price_model, price_text (text)
├── skills (text[])
├── created_at (timestamptz)
```

### Migration 2 -- RLS Policies

- **wallet_profiles**: Public read, owner can update own row (matched by wallet_address)
- **xaman_payloads**: Insert open for edge functions (anon), select/update for service role only
- **properties**: Public read for all, insert/update restricted to authenticated or owner
- **professionals**: Public read, insert/update for verified users
- **ai_agents**: Public read, admin-only write

### Code Changes

1. **Remove all inline mock data** from PropertyListingsSection, PortfolioSection, MarketplaceSection, AIAgentMarketplaceSection, and PropertyDetail
2. **Add data-fetching hooks** using `@tanstack/react-query` + Supabase client for each section (e.g., `useProperties`, `useProfessionals`, `useAIAgents`)
3. **Update components** to show loading states and empty states when no data exists (empty states already exist in PropertyListingsSection)
4. **Fix Edge Functions** (`xaman-create-payload`, `xaman-check-payload`) to work with the new tables

### What This Gives You

- A clean, real database backing every section of the app
- The Xaman wallet flow will actually persist payload tracking and wallet profiles
- Components will pull live data instead of showing fake entries
- Empty states will display naturally until real data is added
- Ready to add admin tooling or forms to populate real listings

