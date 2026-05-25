// Maps raw XRPL transaction types into human-friendly labels for UI surfaces.

export interface HumanizeInput {
  type?: string | null;
  direction?: 'sent' | 'received' | null;
  is_swap?: boolean | null;
}

export function prettifyType(type?: string | null): string {
  if (!type) return 'Transaction';
  return type
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
}

export function humanizeTx({ type, direction, is_swap }: HumanizeInput): string {
  if (is_swap) return 'Token swap';
  switch (type) {
    case 'Payment':
      return direction === 'received' ? 'Received payment' : 'Sent payment';
    case 'EscrowCreate':
      return direction === 'received' ? 'Incoming escrow' : 'Escrow created';
    case 'EscrowFinish':
      return direction === 'received' ? 'Escrow released to you' : 'Escrow released';
    case 'EscrowCancel':
      return 'Escrow refunded';
    case 'OfferCreate':
      return 'DEX order placed';
    case 'OfferCancel':
      return 'DEX order cancelled';
    case 'TrustSet':
      return 'Trustline updated';
    case 'AccountSet':
      return 'Account settings updated';
    case 'SetRegularKey':
      return 'Signing key updated';
    case 'SignerListSet':
      return 'Signers updated';
    case 'NFTokenMint':
      return 'NFT minted';
    case 'NFTokenBurn':
      return 'NFT burned';
    case 'NFTokenCreateOffer':
      return 'NFT offer created';
    case 'NFTokenCancelOffer':
      return 'NFT offer cancelled';
    case 'NFTokenAcceptOffer':
      return 'NFT offer accepted';
    case 'MPTokenIssuanceCreate':
      return 'Token issued';
    case 'MPTokenIssuanceDestroy':
      return 'Token destroyed';
    case 'MPTokenAuthorize':
      return 'Token authorized';
    case 'DIDSet':
      return 'Identity updated';
    case 'DIDDelete':
      return 'Identity removed';
    case 'CredentialCreate':
      return direction === 'received' ? 'Credential received' : 'Credential issued';
    case 'CredentialAccept':
      return 'Credential accepted';
    case 'CredentialDelete':
      return 'Credential revoked';
    case 'CheckCreate':
      return direction === 'received' ? 'Incoming check' : 'Check created';
    case 'CheckCash':
      return 'Check cashed';
    case 'CheckCancel':
      return 'Check cancelled';
    case 'PaymentChannelCreate':
      return 'Payment channel opened';
    case 'PaymentChannelFund':
      return 'Payment channel funded';
    case 'PaymentChannelClaim':
      return 'Payment channel claimed';
    default:
      return prettifyType(type);
  }
}
