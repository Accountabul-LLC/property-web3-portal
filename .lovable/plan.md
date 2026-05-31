## Plan

1. **Remove wallet blocking from Saved Homes**
   - Update `PropertyListingsSection` so the Saved Homes tab only requires the user to be signed in.
   - Remove the `activeAddress` / `openConnectModal` dependency and all “Connect Wallet” CTAs from that saved-list UI.
   - Update copy to say saved homes are tied to the signed-in account, not the wallet.

2. **Show saved property cards without a wallet**
   - Keep the existing saved-properties query based on the authenticated user.
   - Make the saved tab render saved property cards whenever `user` exists and `filteredSavedProperties` has results.

3. **Fix saved-heart visual state**
   - Update `PropertySaveButton` so saved properties use a red/destructive heart treatment instead of a white-on-primary look.
   - Ensure the heart icon itself is filled red/visible when saved, while unsaved remains outline/neutral.

4. **Clean up dashboard copy**
   - Update the Dashboard saved homes card text so it no longer says saved homes stay tied to an active wallet.

5. **Verify behavior**
   - Check the affected files for no remaining wallet gate in Saved Homes and confirm the heart classes reflect saved vs unsaved state.