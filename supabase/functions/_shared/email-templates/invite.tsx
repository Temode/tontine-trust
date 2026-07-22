/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Hr, Text } from 'npm:@react-email/components@0.0.22'
import * as s from './_styles.ts'

interface Props { siteName: string; siteUrl: string; confirmationUrl: string; recipient?: string }

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl, recipient }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Vous êtes invité·e sur Tontine Digitale</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Text style={s.wordmark}>{s.BRAND}</Text>
          <Text style={s.eyebrow}>{s.TAGLINE}</Text>
        </Section>
        <Heading style={s.h1}>Vous êtes invité·e</Heading>
        <Text style={s.text}>
          Rejoignez {siteName} pour gérer vos tontines en toute confiance : rotation automatisée, traçabilité complète, score de fiabilité.
        </Text>
        <Section style={{ margin: '8px 0 24px' }}>
          <Button style={s.button} href={confirmationUrl}>Accepter l'invitation</Button>
        </Section>
        <Hr style={s.hr} />
        <Text style={s.footer}>{recipient ? `Email envoyé à ${recipient}.` : ''}</Text>
        <Text style={s.footerSmall}>{s.BRAND} · {siteName} · {siteUrl}</Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail