/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Hr,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
  token?: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
  token,
}: SignupEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre code de vérification Tontine Digitale{token ? ` : ${token}` : ''}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={wordmark}>Tontine Digitale</Text>
          <Text style={eyebrow}>Infrastructure financière</Text>
        </Section>
        <Heading style={h1}>Vérifiez votre adresse email</Heading>
        <Text style={text}>
          Bienvenue. Pour finaliser la création de votre compte, saisissez le code ci-dessous dans l'application.
        </Text>
        {token ? (
          <Section style={codeCard}>
            <Text style={codeLabel}>Code de vérification</Text>
            <Text style={codeValue}>{token}</Text>
            <Text style={codeHint}>Ce code expire dans 1 heure.</Text>
          </Section>
        ) : null}
        <Text style={text}>
          Vous pouvez aussi utiliser ce lien de secours :{' '}
          <Link href={confirmationUrl} style={link}>Confirmer mon email</Link>.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          Email envoyé à {recipient}. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.
        </Text>
        <Text style={footerSmall}>
          Tontine Digitale · <Link href={siteUrl} style={footerLink}>{siteName}</Link>
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
  color: '#0F1F24',
}
const container = { padding: '32px 28px', maxWidth: '560px' }
const header = { paddingBottom: '20px', borderBottom: '1px solid #E6ECEE', marginBottom: '28px' }
const wordmark = { fontSize: '18px', fontWeight: 600 as const, color: '#0D7377', margin: 0, letterSpacing: '-0.01em' }
const eyebrow = { fontSize: '11px', color: '#6B7A80', margin: '4px 0 0', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }
const h1 = { fontSize: '22px', fontWeight: 600 as const, color: '#0F1F24', margin: '0 0 12px', letterSpacing: '-0.01em' }
const text = { fontSize: '15px', color: '#374A52', lineHeight: '1.6', margin: '0 0 20px' }
const link = { color: '#0D7377', textDecoration: 'underline' }
const codeCard = {
  backgroundColor: '#F5F9FA',
  border: '1px solid #D9E5E8',
  borderRadius: '12px',
  padding: '24px',
  textAlign: 'center' as const,
  margin: '8px 0 24px',
}
const codeLabel = { fontSize: '11px', color: '#6B7A80', margin: 0, textTransform: 'uppercase' as const, letterSpacing: '0.12em' }
const codeValue = {
  fontSize: '34px',
  fontWeight: 600 as const,
  color: '#0D7377',
  margin: '10px 0 6px',
  letterSpacing: '0.35em',
  fontVariantNumeric: 'tabular-nums' as const,
}
const codeHint = { fontSize: '12px', color: '#6B7A80', margin: 0 }
const hr = { border: 'none', borderTop: '1px solid #E6ECEE', margin: '28px 0 20px' }
const footer = { fontSize: '12px', color: '#6B7A80', margin: '0 0 6px', lineHeight: '1.5' }
const footerSmall = { fontSize: '11px', color: '#8A969C', margin: 0 }
const footerLink = { color: '#6B7A80', textDecoration: 'none' }
