// Shared helper: write verified field values into profile_field_verifications
// and auto-fill empty profile columns. Service-role client only.

type SupabaseClientLike = {
  from: (table: string) => any;
};

const KYC_TO_PROFILE: Record<string, string> = {
  legal_first_name: 'first_name',
  legal_last_name: 'last_name',
  date_of_birth: 'date_of_birth',
  address_line1: 'address_line1',
  address_line2: 'address_line2',
  city: 'city',
  state: 'state',
  postal_code: 'zip',
  country: 'country',
};

function normalize(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

/**
 * Pull the latest kyc_form_data for a case and write verified field rows.
 * Also backfills empty profile columns (never overwrites user-entered values).
 */
export async function applyKycVerifications(
  svc: SupabaseClientLike,
  params: { userId: string; kycCaseId: string; source: 'stripe_identity' | 'kyc_review'; metadata?: Record<string, unknown> },
) {
  const { userId, kycCaseId, source, metadata = {} } = params;

  const { data: form } = await svc
    .from('kyc_form_data')
    .select('*')
    .eq('kyc_case_id', kycCaseId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!form) return { written: 0, autofilled: 0 };

  const verifications: Array<{ field_name: string; verified_value: string }> = [];
  for (const [kycField, profileField] of Object.entries(KYC_TO_PROFILE)) {
    const raw = normalize((form as any)[kycField]);
    if (raw) verifications.push({ field_name: profileField, verified_value: raw });
  }

  if (verifications.length === 0) return { written: 0, autofilled: 0 };

  const now = new Date().toISOString();
  const rows = verifications.map((v) => ({
    user_id: userId,
    field_name: v.field_name,
    source,
    verified_value: v.verified_value,
    verified_at: now,
    metadata,
  }));

  const { error: upsertError } = await svc
    .from('profile_field_verifications')
    .upsert(rows, { onConflict: 'user_id,field_name' });

  if (upsertError) {
    console.error('profile_field_verifications upsert failed', upsertError);
    return { written: 0, autofilled: 0 };
  }

  // Backfill empty profile columns.
  const { data: profile } = await svc
    .from('profiles')
    .select('first_name,last_name,date_of_birth,address_line1,address_line2,city,state,zip,country')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) return { written: rows.length, autofilled: 0 };

  const patch: Record<string, string> = {};
  for (const v of verifications) {
    const existing = normalize((profile as any)[v.field_name]);
    if (!existing) patch[v.field_name] = v.verified_value;
  }

  let autofilled = 0;
  if (Object.keys(patch).length > 0) {
    const { error: updErr } = await svc.from('profiles').update(patch).eq('id', userId);
    if (updErr) {
      console.error('profile autofill failed', updErr);
    } else {
      autofilled = Object.keys(patch).length;
    }
  }

  return { written: rows.length, autofilled };
}
