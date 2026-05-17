import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import * as React from "react";

/**
 * Shared shell for transactional emails.
 *
 * Mirrors the brand palette from `docs/brand/brand-guidelines.md` so the
 * dentist's patients see a consistent look between the app and the inbox.
 * Tailwind class names are resolved at render time by `@react-email/tailwind`
 * — most modern clients (Gmail, Apple Mail, Outlook 365) render the inlined
 * styles; older clients fall back to the Body's default styles.
 */
export function BaseLayout({
  preview,
  clinicName,
  children,
}: {
  preview: string;
  clinicName: string;
  children: React.ReactNode;
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind>
        <Body className="bg-slate-50 font-sans">
          <Container className="mx-auto my-10 max-w-[560px] rounded-2xl bg-white p-8 shadow-sm">
            <Section>
              <Img
                src="https://placehold.co/120x40/06b6d4/ffffff?text=DentalCare"
                width="120"
                height="40"
                alt={clinicName}
                className="mb-6"
              />
            </Section>
            {children}
            <Hr className="my-8 border-slate-200" />
            <Section>
              <Text className="text-xs text-slate-500">
                {clinicName} — message automatique, merci de ne pas répondre.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
