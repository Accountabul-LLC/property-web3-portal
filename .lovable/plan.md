

# Test MPT Minting with XLS-24d Metadata on Testnet

This is a hands-on testing task that requires browser interaction (filling forms, clicking buttons, verifying results). I'll switch to implementation mode to:

1. **Navigate to the Mint page** and select MPT token type
2. **Select an existing testnet wallet** as the issuing wallet
3. **Fill out the full MPT form** including:
   - Token name, description, max supply, asset scale
   - Property details (address, city, state, beds, baths, sqft, etc.)
   - Collection name/family and image URL fields (new XLS-24d fields)
   - Token flags (transferable, clawback, etc.)
4. **Submit and sign** the minting transaction via Auto-Sign
5. **Navigate to Portfolio** and verify the newly minted MPT appears under the same wallet with fully decoded XLS-24d metadata (attributes grid, collection info)

No code changes expected — this is purely an end-to-end verification of the updated minting pipeline.

