# Missouri Deed & Title Protection — Awareness Page

Pivot from "build deed monitoring" to "be the trusted guide that connects Missouri owners to the free protection services that already exist." No data integration, no scraping, no vendor negotiations. Just a clean info page + smart routing + optional reminder during signup/tokenization.

## What we're building

### 1. A new public page: `/protection/deed-fraud` (Missouri v1)
- Hero: "Protect your Missouri property from deed fraud"
- Plain-English explainer: what deed fraud is, how it happens, why it goes undetected
- County selector (St. Louis City, St. Louis County, St. Charles, Jackson/KC, Greene/Springfield, "Other Missouri county")
- For each county: a card with the official Property Fraud Alert signup URL, a one-line description, and an outbound CTA button ("Sign up — free, takes 2 minutes")
- Trust framing: "We don't collect your data. These are free services run by your county Recorder of Deeds."
- Footer note: also available statewide via `propertyfraudalert.com`

### 2. Soft prompts in two existing flows
- **Account signup / first dashboard visit:** a dismissible banner — "Own property in Missouri? Set up free deed-fraud alerts →" linking to the new page. Stored in `localStorage` so it doesn't reappear after dismissal.
- **Tokenization intake:** if the property address is in Missouri, show an inline callout on the intake form with the same link. Non-blocking.

### 3. Nav entry
- Add "Protection" link under a Resources/Help section in the footer. Don't crowd the main nav.

## Out of scope

- No data ingestion, no scraping, no vendor contracts.
- No per-user monitoring inside our app.
- No backend tables, no edge functions, no migrations.
- No payments, no gating, no auth requirement (page is public).

## Files to touch

```text
src/pages/DeedProtection.tsx           NEW — the page
src/data/moCountyFraudAlerts.ts        NEW — county → URL data
src/App.tsx                            add route /protection/deed-fraud
src/components/Footer.tsx              add Resources link
src/pages/Dashboard.tsx                add dismissible banner
src/components/tokenize/...            add MO callout where address is collected
public/sitemap.xml                     add the new route
```

## Content sources (already verified)

```text
St. Louis City    https://www.propertyfraudalert.com/MOCityofStLouis
St. Louis County  https://stlouiscountymo.gov/.../property-fraud-alert/
Statewide         https://www.propertyfraudalert.com/
```
Other MO counties on Fidlar can be added incrementally — same URL pattern.

## SEO

- Title: "Missouri Deed Fraud Protection — Free Alerts by County | Accountabul" (<60 chars target, will tighten)
- Meta description focused on "free deed fraud alerts for Missouri homeowners, by county"
- Single H1, semantic sections per county, JSON-LD `WebPage` with `about` referencing each Recorder of Deeds office. This page has real organic search value.

## Tracked separately (not in this plan)

- Payment end-to-end test
- CodeX session handoff note
- Phase 2 (only if you ever want it): in-app monitoring requires the data-access work from the prior research brief
