export const LIVE_PRODUCT_PATHS = new Set([
  '/causes',
  '/causes/apply',
  '/causes/my-donations',
  '/marketplace',
  '/professionals',
  '/ai-agents',
  '/portfolio',
])

export const LOCKED_PRODUCT_PATHS = new Set([
  '/pricing',
  '/treasury',
  '/swap',
  '/pools',
  '/tokenize',
  '/payments',
  '/payments/history',
  '/smart-escrow',
  '/escrow',
])

export function isLockedProductPath(path: string) {
  return LOCKED_PRODUCT_PATHS.has(path)
}

export const lockedProductCopy = {
  title: 'Locked for now',
  description:
    'This product is visible in the navigation, but it is not open for user interaction yet while we finish the current product phase.',
  backLabel: 'Back to Dashboard',
}
