

## Add "Generate Test Data" Button to MPT Form (Testnet Only)

### What
Add a prominent button at the top of the MPT form that fills all fields with randomized but realistic property data. Only visible when the selected wallet is on testnet.

### Changes

**1. Pass `network` prop to MPTForm (`MintWizard.tsx`)**

Update the MPTForm usage at line 346 to pass the current network:
```tsx
{tokenType === 'mpt' && <MPTForm params={mptParams} onChange={setMptParams} network={network} />}
```

**2. Add random data generator and button (`MPTForm.tsx`)**

- Add `network` to `MPTFormProps`
- Create a `generateTestData()` function with arrays of randomized property names, addresses, cities, states, owner names, tickers, descriptions, property types, and value ranges
- Each call picks random entries from these arrays and randomizes numeric fields (beds 1-6, baths 1-4, sqft 800-5000, year 1950-2024, value $100K-$5M, supply 100-1M, scale 0-2, fee 0-5000)
- Randomly toggle permission flags
- Use a stock house image URL from Unsplash (with a few random options)
- Show a "Generate Test Data" button with a `FlaskConical` icon at the top of the form, only when `network === 'testnet'`
- Button calls `onChange(generatedParams)` to fill all fields at once
- Styled with a testnet-colored badge/alert to make it clear this is for testing

### Data Pool Examples
- Names: "Sunset Ridge Estate Token", "Harbor View Loft Token", "Mountain Crest Villa Token", etc.
- Addresses: "742 Evergreen Terrace", "1600 Pennsylvania Ave", "221B Baker Street", etc.
- Cities/States: Miami/FL, Austin/TX, Denver/CO, Portland/OR, etc.
- Owners: "Alice Johnson", "Bob Martinez", "Charlie Kim", etc.
- Tickers: "SNST", "HRBR", "MTCR", "PALM", etc.
- Images: 3-4 Unsplash house photo URLs

