## Goal
Edits in the admin "Edit Cause" dialog should survive accidental closes. Nothing commits to the database until **Save Changes** is clicked — closing, clicking outside, or navigating away just stashes the draft locally.

## Behavior
- Open Edit on a cause → if a local draft exists for that cause id, load the draft; otherwise load current DB values.
- Every keystroke / image upload / gallery change updates the in-memory form *and* writes a draft to `localStorage` (debounced ~300ms).
- Closing the dialog (X, outside click, Esc, Cancel) leaves the draft intact. Re-opening the same cause restores exactly what was there.
- Visual cue: when a draft is loaded (form differs from DB), show a small "Unsaved draft" badge in the dialog header with a "Discard draft" link that wipes the draft and reloads DB values.
- **Save Changes** = the only commit path. On success: clear the draft for that cause id, close dialog, refresh list.
- Same pattern applied to the "Add Cause" create dialog (single draft key, cleared on successful create).

## Scope
Frontend only — `src/pages/AdminCauses.tsx`. No edge function, RLS, or schema changes. The existing `campaign-admin` update call stays exactly as-is.

## Technical notes
- Storage keys: `admin-causes:edit-draft:<campaignId>` and `admin-causes:create-draft`.
- Tiny helper inside the file (or `src/lib/draftStorage.ts`) with `loadDraft / saveDraft / clearDraft` — JSON serialize the form shape already defined in state.
- Use `useEffect` on `editForm` to persist; on open (when `editId` changes) read the draft and merge with DB values (draft wins).
- Update `onOpenChange` so closing does **not** wipe `editId` immediately if we want re-open to find the draft — actually fine to clear `editId`, draft is keyed by campaign id, not by open state.
- Discard-draft button calls `clearDraft(editId)` then re-seeds `editForm` from the campaign row in the cached list.
- Keep existing validation and the `campaign-admin` `action: 'update'` payload unchanged.

## Out of scope
- No autosave to server.
- No "are you sure you want to close?" modal — drafts make that unnecessary.
- No changes to approve/reject/delete flows.