import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { mail } from "./theme";

export type DigestItem = {
  title: string;
  company: string;
  location: string;
  reason: string;
  applyUrl: string;
  interestedUrl: string;
  notForMeUrl: string;
};

const pill = (primary: boolean) => ({
  display: "inline-block",
  borderRadius: 999,
  padding: "8px 16px",
  fontSize: 14,
  fontWeight: 600,
  textDecoration: "none",
  marginRight: 8,
  marginTop: 8,
  backgroundColor: primary ? mail.accent : mail.card,
  color: primary ? mail.onAccent : mail.ink,
  border: `1px solid ${primary ? mail.accent : mail.line}`,
});

export function DigestEmail({
  items,
  matchesUrl,
  settingsUrl,
  unsubscribeUrl,
}: {
  items: DigestItem[];
  matchesUrl: string;
  settingsUrl: string;
  unsubscribeUrl: string;
}) {
  const first = items[0];
  return (
    <Html lang="en">
      <Head />
      <Preview>{first ? `${first.title} at ${first.company}, and ${items.length - 1} more` : "New internships"}</Preview>
      <Body style={{ backgroundColor: mail.sky, fontFamily: mail.font, color: mail.ink, margin: 0, padding: "32px 0" }}>
        <Container style={{ maxWidth: 560, padding: "0 16px" }}>
          <Text style={{ fontSize: 22, fontWeight: 600, margin: "0 0 4px" }}>
            {items.length} new {items.length === 1 ? "internship" : "internships"} for you
          </Text>
          <Text style={{ fontSize: 15, color: mail.muted, margin: "0 0 20px" }}>
            Tell us which ones interest you. Every answer makes the next email better.
          </Text>
          {items.map((it) => (
            <Section
              key={it.applyUrl}
              style={{ backgroundColor: mail.card, borderRadius: 16, padding: 20, marginBottom: 12, border: `1px solid ${mail.line}` }}
            >
              <Text style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>
                <Link href={it.applyUrl} style={{ color: mail.ink, textDecoration: "underline" }}>
                  {it.title}
                </Link>
              </Text>
              <Text style={{ fontSize: 15, color: mail.muted, margin: "4px 0 0" }}>
                {it.company}
                {it.location ? `, ${it.location}` : ""}
              </Text>
              <Text style={{ fontSize: 14, color: mail.muted, margin: "8px 0 4px" }}>{it.reason}</Text>
              <Link href={it.interestedUrl} style={pill(true)}>
                Interested
              </Link>
              <Link href={it.notForMeUrl} style={pill(false)}>
                Not for me
              </Link>
            </Section>
          ))}
          <Text style={{ fontSize: 15, margin: "16px 0" }}>
            <Link href={matchesUrl} style={{ color: mail.accent, fontWeight: 600, textDecoration: "underline" }}>
              See all your matches
            </Link>
          </Text>
          <Hr style={{ borderColor: mail.line }} />
          <Text style={{ fontSize: 13, color: mail.muted, lineHeight: "20px" }}>
            You get this because you signed up for JetJob.{" "}
            <Link href={settingsUrl} style={{ color: mail.muted, textDecoration: "underline" }}>
              Change how often
            </Link>{" "}
            or{" "}
            <Link href={unsubscribeUrl} style={{ color: mail.muted, textDecoration: "underline" }}>
              unsubscribe
            </Link>
            .
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
