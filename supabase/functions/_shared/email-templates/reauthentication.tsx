/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Section, Hr, Text } from 'npm:@react-email/components@0.0.22'
import * as s from './_styles.ts'

interface Props { token: string; siteName?: string }

export const ReauthenticationEmail = ({ token, siteName }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre code de vérification : {token}</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Text style={s.wordmark}>{s.BRAND}</Text>
          <Text style={s.eyebrow}>{s.TAGLINE}</Text>
        </Section>
        <Heading style={s.h1}>Code de vérification</Heading>
        <Text style={s.text}>
          Saisissez ce code pour confirmer une action sensible sur votre compte.
        </Text>
        <Section style={s.codeCard}>
          <Text style={s.codeLabel}>Code</Text>
          <Text style={s.codeValue}>{token}</Text>
          <Text style={s.codeHint}>Ce code expire dans 1 heure.</Text>
        </Section>
        <Hr style={s.hr} />
        <Text style={s.footer}>Si vous n'avez pas initié cette action, ignorez ce message et sécurisez votre compte.</Text>
        <Text style={s.footerSmall}>{s.BRAND}{siteName ? ` · ${siteName}` : ''}</Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail