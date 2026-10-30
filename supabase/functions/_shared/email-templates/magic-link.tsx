/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Hr, Text } from 'npm:@react-email/components@0.0.22'
import * as s from './_styles.ts'

interface Props { siteName: string; confirmationUrl: string; token?: string; recipient?: string }

export const MagicLinkEmail = ({ siteName, confirmationUrl, token, recipient }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre lien de connexion Tontine Digitale</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Text style={s.wordmark}>{s.BRAND}</Text>
          <Text style={s.eyebrow}>{s.TAGLINE}</Text>
        </Section>
        <Heading style={s.h1}>Votre lien de connexion</Heading>
        <Text style={s.text}>
          Cliquez sur le bouton ci-dessous pour vous connecter en toute sécurité. Ce lien expire dans 1 heure.
        </Text>
        <Section style={{ margin: '8px 0 24px' }}>
          <Button style={s.button} href={confirmationUrl}>Se connecter</Button>
        </Section>
        {token ? (
          <Section style={s.codeCard}>
            <Text style={s.codeLabel}>Ou saisissez ce code</Text>
            <Text style={s.codeValue}>{token}</Text>
          </Section>
        ) : null}
        <Hr style={s.hr} />
        <Text style={s.footer}>
          {recipient ? `Email envoyé à ${recipient}. ` : ''}Si vous n'avez pas demandé ce lien, ignorez ce message.
        </Text>
        <Text style={s.footerSmall}>{s.BRAND} · {siteName}</Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail