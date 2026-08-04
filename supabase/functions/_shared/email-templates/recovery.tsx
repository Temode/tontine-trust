/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Link, Preview, Section, Hr, Text } from 'npm:@react-email/components@0.0.22'
import * as s from './_styles.ts'

interface Props { siteName: string; confirmationUrl: string; token?: string; recipient?: string }

export const RecoveryEmail = ({ siteName, confirmationUrl, token, recipient }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Réinitialisation de votre mot de passe Tontine Digitale{token ? ` : ${token}` : ''}</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Text style={s.wordmark}>{s.BRAND}</Text>
          <Text style={s.eyebrow}>{s.TAGLINE}</Text>
        </Section>
        <Heading style={s.h1}>Réinitialiser votre mot de passe</Heading>
        <Text style={s.text}>
          Nous avons reçu une demande de réinitialisation. Saisissez le code ci-dessous pour continuer.
        </Text>
        {token ? (
          <Section style={s.codeCard}>
            <Text style={s.codeLabel}>Code de réinitialisation</Text>
            <Text style={s.codeValue}>{token}</Text>
            <Text style={s.codeHint}>Ce code expire dans 1 heure.</Text>
          </Section>
        ) : null}
        <Text style={s.text}>
          Lien de secours : <Link href={confirmationUrl} style={s.link}>Réinitialiser mon mot de passe</Link>.
        </Text>
        <Hr style={s.hr} />
        <Text style={s.footer}>
          {recipient ? `Email envoyé à ${recipient}. ` : ''}Si vous n'êtes pas à l'origine de cette demande, ignorez ce message — votre mot de passe restera inchangé.
        </Text>
        <Text style={s.footerSmall}>{s.BRAND} · {siteName}</Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail