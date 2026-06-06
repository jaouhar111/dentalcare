import { Button, Heading, Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout } from "./base-layout";

export interface TrialExpiringEmailProps {
  adminFirstName: string;
  clinicName: string;
  /// Days remaining as an integer (1, 2, or 3). Used to vary the
  /// urgency in the headline.
  daysLeft: number;
  /// "18 juin 2026"-style label so users don't have to do mental math.
  trialEndsAtLabel: string;
  /// Direct link to the billing page so the upgrade is one click away.
  upgradeUrl: string;
}

/**
 * Trial-expiring nag — fires 3 days, 1 day, and the day before the
 * trial ends. Tone is friendly first ("you've been using it!") and
 * informative second ("here's how to keep going"). Hard sell would
 * push cabinets to churn rather than convert.
 */
export function TrialExpiringEmail({
  adminFirstName,
  clinicName,
  daysLeft,
  trialEndsAtLabel,
  upgradeUrl,
}: TrialExpiringEmailProps) {
  const headline =
    daysLeft <= 1
      ? "Votre essai gratuit se termine demain"
      : `Votre essai gratuit se termine dans ${daysLeft} jours`;
  return (
    <BaseLayout
      preview={`Votre essai DentalCare se termine ${
        daysLeft <= 1 ? "demain" : `dans ${daysLeft} jours`
      }. Choisissez votre plan pour continuer.`}
      clinicName={clinicName}
    >
      <Heading className="text-xl font-semibold text-slate-900">
        Bonjour {adminFirstName},
      </Heading>
      <Text className="text-base leading-7 text-slate-700">
        {headline} — le {trialEndsAtLabel}. Pour continuer à utiliser
        DentalCare et la réceptionniste IA sans interruption, activez
        votre abonnement.
      </Text>
      <Section className="my-6 text-center">
        <Button
          href={upgradeUrl}
          className="inline-block rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-white"
        >
          Choisir mon plan
        </Button>
      </Section>
      <Text className="text-sm leading-6 text-slate-700">
        <strong>Pro — 200 DH / mois</strong>
        <br />
        Jusqu&apos;à 3 dentistes, bot IA WhatsApp, recalls automatiques.
      </Text>
      <Text className="text-sm leading-6 text-slate-700">
        <strong>Cabinet+ — 500 DH / mois</strong>
        <br />
        Dentistes illimités, voice notes IA, support prioritaire.
      </Text>
      <Text className="text-sm text-slate-600">
        Vous pouvez annuler à tout moment. Vos données restent
        accessibles pendant 30 jours après la fin de l&apos;essai si vous
        ne souscrivez pas.
      </Text>
    </BaseLayout>
  );
}
