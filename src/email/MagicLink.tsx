import { Body, Button, Container, Head, Html, Preview, Section, Text } from "@react-email/components";
import { mail } from "./theme";

export function MagicLinkEmail({ url }: { url: string }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Your JetJob sign-in link</Preview>
      <Body style={{ backgroundColor: mail.sky, fontFamily: mail.font, color: mail.ink, margin: 0, padding: "32px 0" }}>
        <Container style={{ backgroundColor: mail.card, borderRadius: 16, padding: 32, maxWidth: 480 }}>
          <Text style={{ fontSize: 22, fontWeight: 600, margin: "0 0 12px" }}>Confirm your email</Text>
          <Text style={{ fontSize: 16, lineHeight: "24px", color: mail.muted, margin: "0 0 24px" }}>
            Tap the button to finish setting up JetJob. The link works for 30 minutes.
          </Text>
          <Section>
            <Button
              href={url}
              style={{
                backgroundColor: mail.accent,
                color: mail.onAccent,
                borderRadius: 999,
                padding: "12px 24px",
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              Confirm email
            </Button>
          </Section>
          <Text style={{ fontSize: 14, lineHeight: "20px", color: mail.muted, margin: "24px 0 0" }}>
            If you did not ask for this, you can ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
