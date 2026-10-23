/// <reference types="npm:@types/react@18.3.1" />
import type * as React from 'npm:react@18.3.1'

type S = React.CSSProperties

export const main: S = {
  backgroundColor: '#ffffff',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
  color: '#0F1F24',
}
export const container: S = { padding: '32px 28px', maxWidth: '560px' }
export const header: S = { paddingBottom: '20px', borderBottom: '1px solid #E6ECEE', marginBottom: '28px' }
export const wordmark: S = { fontSize: '18px', fontWeight: 600, color: '#0D7377', margin: 0, letterSpacing: '-0.01em' }
export const eyebrow: S = { fontSize: '11px', color: '#6B7A80', margin: '4px 0 0', textTransform: 'uppercase', letterSpacing: '0.08em' }
export const h1: S = { fontSize: '22px', fontWeight: 600, color: '#0F1F24', margin: '0 0 12px', letterSpacing: '-0.01em' }
export const text: S = { fontSize: '15px', color: '#374A52', lineHeight: '1.6', margin: '0 0 20px' }
export const link: S = { color: '#0D7377', textDecoration: 'underline' }
export const button: S = {
  backgroundColor: '#0D7377',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 600,
  borderRadius: '10px',
  padding: '12px 20px',
  textDecoration: 'none',
  display: 'inline-block',
}
export const codeCard: S = {
  backgroundColor: '#F5F9FA',
  border: '1px solid #D9E5E8',
  borderRadius: '12px',
  padding: '24px',
  textAlign: 'center',
  margin: '8px 0 24px',
}
export const codeLabel: S = { fontSize: '11px', color: '#6B7A80', margin: 0, textTransform: 'uppercase', letterSpacing: '0.12em' }
export const codeValue: S = {
  fontSize: '34px',
  fontWeight: 600,
  color: '#0D7377',
  margin: '10px 0 6px',
  letterSpacing: '0.35em',
  fontVariantNumeric: 'tabular-nums',
}
export const codeHint: S = { fontSize: '12px', color: '#6B7A80', margin: 0 }
export const hr: S = { border: 'none', borderTop: '1px solid #E6ECEE', margin: '28px 0 20px' }
export const footer: S = { fontSize: '12px', color: '#6B7A80', margin: '0 0 6px', lineHeight: '1.5' }
export const footerSmall: S = { fontSize: '11px', color: '#8A969C', margin: 0 }
export const footerLink: S = { color: '#6B7A80', textDecoration: 'none' }

export const BRAND = 'Tontine Digitale'
export const TAGLINE = 'Infrastructure financière'