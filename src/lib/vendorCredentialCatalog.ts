// Static catalog of vendor industries and the credentials that prove legitimacy.
// Reference data only - not stored in DB.

export interface CredentialDef {
  type: string;
  label: string;
  /** Short hint shown under the number input */
  hint?: string;
  /** True if the credential is issued by a U.S. state and needs a state selector */
  requiresState?: boolean;
  /** True if the credential carries an expiration date (notary, OSHA, NMLS, licenses) */
  requiresExpiration?: boolean;
  /** Public lookup URL we can link to so admins/users can verify */
  verifyUrl?: string;
  /** Numeric format example for placeholder */
  placeholder?: string;
}

export const CREDENTIAL_CATALOG: Record<string, CredentialDef> = {
  ein: {
    type: 'ein',
    label: 'EIN (Employer Identification Number)',
    placeholder: '12-3456789',
    hint: '9-digit federal tax ID from the IRS',
    verifyUrl: 'https://apps.irs.gov/app/eos/',
  },
  tax_exempt_ein: {
    type: 'tax_exempt_ein',
    label: '501(c)(3) Tax-Exempt EIN',
    placeholder: '12-3456789',
    verifyUrl: 'https://apps.irs.gov/app/eos/',
  },
  state_re_license: {
    type: 'state_re_license',
    label: 'State Real Estate License',
    requiresState: true,
    requiresExpiration: true,
    hint: 'Broker or salesperson license number',
  },
  brokerage_license: {
    type: 'brokerage_license',
    label: 'Brokerage Firm License',
    requiresState: true,
    requiresExpiration: true,
  },
  mls_id: {
    type: 'mls_id',
    label: 'MLS Member ID',
    hint: 'Local MLS (CRMLS, Bright MLS, etc.)',
  },
  nrds_id: {
    type: 'nrds_id',
    label: 'NRDS ID (NAR Member)',
    placeholder: '123456789',
    hint: '9-digit National REALTOR® ID',
  },
  nmls_id: {
    type: 'nmls_id',
    label: 'NMLS ID (Mortgage)',
    placeholder: '1234567',
    requiresExpiration: true,
    verifyUrl: 'https://www.nmlsconsumeraccess.org/',
  },
  state_mortgage_license: {
    type: 'state_mortgage_license',
    label: 'State Mortgage License',
    requiresState: true,
    requiresExpiration: true,
  },
  title_producer: {
    type: 'title_producer',
    label: 'State Title Insurance Producer License',
    requiresState: true,
    requiresExpiration: true,
  },
  escrow_agent_license: {
    type: 'escrow_agent_license',
    label: 'Escrow Agent License',
    requiresState: true,
    requiresExpiration: true,
  },
  alta_membership: {
    type: 'alta_membership',
    label: 'ALTA Membership ID',
  },
  state_appraiser_license: {
    type: 'state_appraiser_license',
    label: 'State Appraiser License',
    requiresState: true,
    requiresExpiration: true,
    verifyUrl: 'https://www.asc.gov/National-Registries/',
  },
  asc_registry: {
    type: 'asc_registry',
    label: 'ASC National Registry #',
    verifyUrl: 'https://www.asc.gov/National-Registries/',
  },
  state_inspector_license: {
    type: 'state_inspector_license',
    label: 'State Home Inspector License',
    requiresState: true,
    requiresExpiration: true,
  },
  ashi_cert: {
    type: 'ashi_cert',
    label: 'ASHI Certification #',
  },
  internachi_cert: {
    type: 'internachi_cert',
    label: 'InterNACHI Certification #',
  },
  state_gc_license: {
    type: 'state_gc_license',
    label: 'State General Contractor License',
    requiresState: true,
    requiresExpiration: true,
  },
  state_trade_license: {
    type: 'state_trade_license',
    label: 'State Trade License (Plumbing/Electrical/HVAC)',
    requiresState: true,
    requiresExpiration: true,
  },
  epa_rrp: {
    type: 'epa_rrp',
    label: 'EPA RRP Lead-Safe Certification',
    placeholder: 'NAT-XXXXXXXX',
    requiresExpiration: true,
  },
  osha_card: {
    type: 'osha_card',
    label: 'OSHA 10/30 Card',
    requiresExpiration: true,
  },
  state_pm_license: {
    type: 'state_pm_license',
    label: 'State Property Management License',
    requiresState: true,
    requiresExpiration: true,
  },
  cpm_irem: {
    type: 'cpm_irem',
    label: 'CPM® Designation (IREM)',
  },
  narpm_id: {
    type: 'narpm_id',
    label: 'NARPM Membership ID',
  },
  npn: {
    type: 'npn',
    label: 'NPN (National Producer #)',
    placeholder: '1234567890',
    verifyUrl: 'https://nipr.com/help/look-up-your-npn',
  },
  state_insurance_license: {
    type: 'state_insurance_license',
    label: 'State Insurance Producer License',
    requiresState: true,
    requiresExpiration: true,
  },
  state_bar: {
    type: 'state_bar',
    label: 'State Bar # (Attorney)',
    requiresState: true,
  },
  cpa_license: {
    type: 'cpa_license',
    label: 'CPA License',
    requiresState: true,
    requiresExpiration: true,
  },
  ptin: {
    type: 'ptin',
    label: 'PTIN (IRS Preparer)',
    placeholder: 'P12345678',
  },
  ncarb: {
    type: 'ncarb',
    label: 'NCARB Certificate / State Architect License',
    requiresState: true,
    requiresExpiration: true,
  },
  pe_license: {
    type: 'pe_license',
    label: 'PE License (Professional Engineer)',
    requiresState: true,
    requiresExpiration: true,
  },
  pls_license: {
    type: 'pls_license',
    label: 'PLS License (Land Surveyor)',
    requiresState: true,
    requiresExpiration: true,
  },
  notary_commission: {
    type: 'notary_commission',
    label: 'Notary Commission #',
    requiresState: true,
    requiresExpiration: true,
  },
  nna_id: {
    type: 'nna_id',
    label: 'NNA ID (Signing Agent)',
  },
  uei: {
    type: 'uei',
    label: 'UEI (SAM.gov)',
    placeholder: '12 alphanumeric chars',
    verifyUrl: 'https://sam.gov/content/entity-information',
  },
  sba_cert: {
    type: 'sba_cert',
    label: 'SBA Certification (8(a)/WOSB/MBE/HUBZone/DBE)',
    verifyUrl: 'https://certify.sba.gov',
  },
  leed_ap: {
    type: 'leed_ap',
    label: 'LEED AP / GBCI ID',
  },
  state_business_entity: {
    type: 'state_business_entity',
    label: 'State Business Entity # (Secretary of State)',
    requiresState: true,
  },
  dba_filing: {
    type: 'dba_filing',
    label: 'DBA / Fictitious Business Name Filing',
    requiresState: true,
  },
  other: {
    type: 'other',
    label: 'Other Credential',
    hint: 'Provide issuing authority in notes',
  },
};

export interface IndustryDef {
  slug: string;
  label: string;
  /** Credential types pre-suggested when this industry is selected */
  suggested: string[];
}

export const INDUSTRIES: IndustryDef[] = [
  {
    slug: 'real_estate',
    label: 'Real Estate Agent / Broker',
    suggested: ['state_re_license', 'mls_id', 'nrds_id', 'brokerage_license'],
  },
  {
    slug: 'mortgage',
    label: 'Mortgage / Lending',
    suggested: ['nmls_id', 'state_mortgage_license'],
  },
  {
    slug: 'title_escrow',
    label: 'Title & Escrow',
    suggested: ['title_producer', 'escrow_agent_license', 'alta_membership'],
  },
  {
    slug: 'appraisal',
    label: 'Appraisal',
    suggested: ['state_appraiser_license', 'asc_registry'],
  },
  {
    slug: 'home_inspection',
    label: 'Home Inspection',
    suggested: ['state_inspector_license', 'ashi_cert', 'internachi_cert'],
  },
  {
    slug: 'general_contractor',
    label: 'General Contractor',
    suggested: ['state_gc_license', 'epa_rrp', 'osha_card'],
  },
  {
    slug: 'specialty_trade',
    label: 'Specialty Trade (Plumbing/Electrical/HVAC)',
    suggested: ['state_trade_license', 'epa_rrp', 'osha_card'],
  },
  {
    slug: 'property_management',
    label: 'Property Management',
    suggested: ['state_pm_license', 'cpm_irem', 'narpm_id'],
  },
  {
    slug: 'insurance',
    label: 'Insurance',
    suggested: ['npn', 'state_insurance_license'],
  },
  {
    slug: 'legal',
    label: 'Legal (Real Estate Attorney)',
    suggested: ['state_bar'],
  },
  {
    slug: 'accounting',
    label: 'Accounting / Tax',
    suggested: ['cpa_license', 'ptin'],
  },
  {
    slug: 'architecture_engineering',
    label: 'Architecture / Engineering / Surveying',
    suggested: ['ncarb', 'pe_license', 'pls_license'],
  },
  {
    slug: 'notary',
    label: 'Notary / Signing Agent',
    suggested: ['notary_commission', 'nna_id'],
  },
  {
    slug: 'government_contractor',
    label: 'Government / SBA Contractor',
    suggested: ['uei', 'sba_cert'],
  },
  {
    slug: 'green_building',
    label: 'Green Building / Sustainability',
    suggested: ['leed_ap'],
  },
  {
    slug: 'nonprofit',
    label: 'Nonprofit / Housing Organization',
    suggested: [],
  },
  {
    slug: 'other',
    label: 'Other',
    suggested: [],
  },
];

export const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA',
  'ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK',
  'OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC','PR',
];

/** Normalize EIN to XX-XXXXXXX. Returns null if not 9 digits. */
export function normalizeEin(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length !== 9) return null;
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

export function einLast4(ein: string | null | undefined): string | null {
  if (!ein) return null;
  const digits = ein.replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
}
