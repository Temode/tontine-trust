/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Hr, Text } from 'npm:@react-email/components@0.0.22'
import * as s from './_styles.ts'

interface Props { siteName: string; confirmationUrl: string; token?: string; email?: string; oldEmail?: string; newEmail?: string }

export const EmailChangeEmail = ({ siteName, confirmationUrl, token, email, oldEmail, newEmail }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Confirmez votre nouvelle adresse email</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Text style={s.wordmark}>{s.BRAND}</Text>
          <Text style={s.eyebrow}>{s.TAGLINE}</Text>
        </Section>
        <Heading style={s.h1}>Confirmez votre nouvelle adresse</Heading>
        <Text style={s.text}>
          Une demande de changement d'adresse email a été effectuée{oldEmail ? ` depuis ${oldEmail}` : ''}{newEmail ? ` vers ${newEmail}` : ''}. Saisissez le code ci-dessous pour la confirmer.
        </Text>
        {token ? (
          <Section style={s.codeCard}>
            <Text style={s.codeLabel}>Code de confirmation</Text>
            <Text style={s.codeValue}>{token}</Text>
            <Text style={s.codeHint}>Ce code expire dans 1 heure.</Text>
          </Section>
        ) : null}
        <Text style={s.text}>
          Lien de secours : <Link href={confirmationUrl} style={s.link}>Confirmer le changement</Link>.
        </Text>
        <Hr style={s.hr} />
        <Text style={s.footer}>Si vous n'êtes pas à l'origine de cette demande, ignorez ce message et contactez le support.</Text>
        <Text style={s.footerSmall}>{s.BRAND} · {siteName}{email ? ` · ${email}` : ''}</Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail