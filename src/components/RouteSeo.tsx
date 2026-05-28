import { useLocation } from 'react-router-dom';
import { Seo } from '@/components/Seo';

const SITE_NAME = 'Accountabul';

interface RouteMeta {
  title: string;
  description: string;
  noindex?: boolean;
}

const STATIC_ROUTES: Record<string, RouteMeta> = {
  '/': {
    title: `${SITE_NAME} | Digital Real Estate Asset Management`,
    description:
      'Secure digital marketplace for tokenized real estate. Streamline property issuance, treasury operations, and portfolio tracking on the XRP Ledger.',
  },
  '/marketplace': {
    title: `Marketplace | ${SITE_NAME}`,
    description:
      'Browse tokenized real estate listings on Accountabul. Discover fractional property investments with transparent on-chain pricing.',
  },
  '/professionals': {
    title: `Professionals Directory | ${SITE_NAME}`,
    description:
      'Connect with vetted real estate, legal, and compliance professionals supporting tokenized property transactions.',
  },
  '/vendor': {
    title: `Verified Vendors | ${SITE_NAME}`,
    description:
      'Apply to become a verified vendor on Accountabul and gain business profile, marketplace placement, and lead access after manual review.',
  },
  '/credentials': {
    title: `Credentials Catalog | ${SITE_NAME}`,
    description:
      'Apply for identity, compliance, and trading credentials needed to unlock tokenized real estate features on Accountabul.',
  },
  '/kyc': {
    title: `Identity Verification | ${SITE_NAME}`,
    description:
      'Complete identity verification to unlock tokenization, trading, and treasury features on Accountabul.',
  },
  '/auth': {
    title: `Sign In | ${SITE_NAME}`,
    description:
      'Sign in or create an Accountabul account to manage tokenized real estate, wallets, and credentials.',
  },
  // Private / app surfaces — noindex
  '/dashboard': { title: `Dashboard | ${SITE_NAME}`, description: 'Manage your Accountabul account, wallets, and profile.', noindex: true },
  '/portfolio': { title: `Portfolio | ${SITE_NAME}`, description: 'Track your tokenized real estate holdings and balances.', noindex: true },
  '/treasury': { title: `Treasury | ${SITE_NAME}`, description: 'Treasury operations dashboard for Accountabul.', noindex: true },
  '/kyc/status': { title: `KYC Status | ${SITE_NAME}`, description: 'Identity verification status.', noindex: true },
  '/reset-password': { title: `Reset Password | ${SITE_NAME}`, description: 'Reset your Accountabul account password.', noindex: true },
  '/tokenize': { title: `Tokenize Property | ${SITE_NAME}`, description: 'Submit a property for tokenization on the XRP Ledger.', noindex: true },
  '/ai-agents': { title: `AI Agents | ${SITE_NAME}`, description: 'AI agent marketplace.', noindex: true },
  '/swap': { title: `Swap | ${SITE_NAME}`, description: 'Swap tokens on the XRP Ledger.', noindex: true },
  '/pools': { title: `Pools | ${SITE_NAME}`, description: 'Liquidity pools.', noindex: true },
  '/mint': { title: `Mint Sandbox | ${SITE_NAME}`, description: 'XRPL mint sandbox.', noindex: true },
  '/smart-escrow': { title: `Smart Escrow | ${SITE_NAME}`, description: 'XRPL escrow hub for campaign donations and escrow-capable tokens.' },
  '/escrow': { title: `Smart Escrow | ${SITE_NAME}`, description: 'XRPL escrow hub for campaign donations and escrow-capable tokens.' },
  '/action-items': { title: `Action Items | ${SITE_NAME}`, description: 'Pending action items.', noindex: true },
  '/admin': { title: `Admin | ${SITE_NAME}`, description: 'Admin console.', noindex: true },
  '/admin/kyc': { title: `Admin KYC | ${SITE_NAME}`, description: 'Admin KYC review.', noindex: true },
  '/admin/ai-panel': { title: `Admin AI Panel | ${SITE_NAME}`, description: 'Admin AI panel.', noindex: true },
  '/admin/credentials': { title: `Admin Credentials | ${SITE_NAME}`, description: 'Admin credentials management.', noindex: true },
  '/admin/vendors': { title: `Admin Vendors | ${SITE_NAME}`, description: 'Admin verified vendor CRM.', noindex: true },
  '/admin/payments': { title: `Admin Payments | ${SITE_NAME}`, description: 'Admin payments ledger.', noindex: true },
  '/admin/payments/console': { title: `Payments Console | ${SITE_NAME}`, description: 'Payments developer console.', noindex: true },
  '/admin/users': { title: `Admin Users | ${SITE_NAME}`, description: 'Admin user management redirect.', noindex: true },
  '/payments': { title: `Payments | ${SITE_NAME}`, description: 'Payments and invoices.', noindex: true },
  '/payments/history': { title: `Payment History | ${SITE_NAME}`, description: 'Payment history.', noindex: true },
  '/settings': { title: `Settings | ${SITE_NAME}`, description: 'Account settings and preferences.', noindex: true },
  '/vendor/onboarding': { title: `Apply to Become a Vendor | ${SITE_NAME}`, description: 'Submit your vendor application.', noindex: true },
  '/vendor/status': { title: `Vendor Application Status | ${SITE_NAME}`, description: 'Check your vendor application status.', noindex: true },
  '/vendor/dashboard': { title: `Vendor Dashboard | ${SITE_NAME}`, description: 'Manage your vendor profile and tools.', noindex: true },
};

const matchDynamic = (pathname: string): RouteMeta | null => {
  if (pathname.startsWith('/property/')) {
    return {
      title: `Property Details | ${SITE_NAME}`,
      description: 'View tokenized property details, financials, documents, and on-chain ownership on Accountabul.',
    };
  }
  return null;
};

export const RouteSeo = () => {
  const { pathname } = useLocation();
  const meta = STATIC_ROUTES[pathname] || matchDynamic(pathname);
  if (!meta) return null;
  return <Seo title={meta.title} description={meta.description} path={pathname} noindex={meta.noindex} />;
};
