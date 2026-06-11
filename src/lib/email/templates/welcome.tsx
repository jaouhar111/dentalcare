import { Button, Heading, Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout } from "./base-layout";

export interface WelcomeEmailProps {
  /// Admin first name (or full name) — used in the greeting.
  adminFirstName: string;
  /// Clinic name as registered. Surfaced in headings and footer.
  clinicName: string;
  /// Deep link to the cabinet dashboard (the recipient is already signed
  /// in by the signup flow, so this drops them straight into the product).
  dashboardUrl: string;
  /// Human-readable trial end date ("18 juin 2026") so the recipient
  /// knows when they will need to subscribe.
  trialEndsAtLabel: string;
}

/**
 * Welcome email — fires once when a new cabinet completes signup.
 *
 * Goals:
 *   1. Confirm the account was created (deliverability check).
 *   2. Hand the recipient a single primary action ("set up your bot").
 *   3. Reassure them about the 30-day trial — no card required.
 *
 * Kept short on purpose: the actual setup happens in Paramètres, not here.
 * Anything more would push the CTA below the fold on mobile clients.
 */
export function WelcomeEmail({
  adminFirstName,
  clinicName,
  dashboardUrl,
  trialEndsAtLabel,
}: WelcomeEmailProps) {
  return (
    <BaseLayout
      preview={`Bienvenue sur DentalCare, ${adminFirstName} — votre essai gratuit de 30 jours est actif.`}
      clinicName={clinicName}
    >
      <Heading className="text-xl font-semibold text-slate-900">
        Bienvenue, {adminFirstName} 👋
      </Heading>
      <Text className="text-base leading-7 text-slate-700">
        Votre cabinet <strong>{clinicName}</strong> est créé sur DentalCare.
        Votre essai gratuit de 30 jours est actif jusqu&apos;au{" "}
        <strong>{trialEndsAtLabel}</strong> — aucune carte bancaire requise.
      </Text>
      <Section className="my-6 text-center">
        <Button
          href={dashboardUrl}
          className="inline-block rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-white"
        >
          Accéder à mon tableau de bord
        </Button>
      </Section>
      <Text className="text-base leading-7 text-slate-700">
        Pour démarrer, rendez-vous dans <strong>Paramètres</strong> :
      </Text>
      <Text className="ml-4 text-sm leading-7 text-slate-700">
        1. <strong>Connecter WhatsApp</strong> en scannant un QR code avec
        l&apos;app WhatsApp Business du cabinet.
        <br />
        2. <strong>Définir vos horaires</strong> et ajouter au moins un
        dentiste.
        <br />
        3. <strong>Activer la réceptionniste IA</strong> — elle répond aux
        patients 24/7.
      </Text>
      <Text className="text-sm text-slate-600">
        Une question pendant le démarrage ? Répondez à cet email ou écrivez à{" "}
        <a className="text-emerald-600" href="mailto:support@dentalcare.ma">
          support@dentalcare.ma
        </a>
        .
      </Text>
    </BaseLayout>
  );
}
