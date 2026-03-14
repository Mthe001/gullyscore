const FALLBACK_SITE_URL = 'https://gullyscore-pro.vercel.app'

export function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  return (configured && configured.length > 0 ? configured : FALLBACK_SITE_URL).replace(/\/+$/, '')
}

export function toAbsoluteUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${getSiteUrl()}${normalizedPath}`
}
