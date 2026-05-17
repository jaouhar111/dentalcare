import { Button, Heading, Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout } from "./base-layout";

export interface PasswordResetEmailProps {
  recipientName: string;
  resetLink: string;
  clinicName: string;
  /// Window during which the link is valid (e.g. "30 minutes")
  validFor: string;
}

export function PasswordResetEmail({
  recipientName,
  resetLink,
  clinicName,
  validFor,
}: PasswordResetEmailProps) {
  return (
    <BaseLayout preview={`Réinitialisation de votre mot de passe ${clinicName}`} clinicName={clinicName}>
      <Heading className="text-xl font-semibold text-slate-900">
        Bonjour {recipientName},
      </Heading>
      <Text className="text-base leading-7 text-slate-700">
        Vous avez demandé à réinitialiser le mot de passe de votre compte sur{" "}
        <strong>{clinicName}</strong>. Cliquez sur le bouton ci-dessous pour choisir un nouveau
        mot de passe.
      </Text>
      <Section className="my-6 text-center">
        <Button
          href={resetLink}
          className="inline-block rounded-lg bg-cyan-500 px-6 py-3 text-sm font-semibold text-white"
        >
          Réinitialiser mon mot de passe
        </Button>
      </Section>
      <Text className="text-sm text-slate-600">
        Ce lien est valable {validFor}. Passé ce délai, demandez-en un nouveau depuis la page
        de connexion.
      </Text>
      <Text className="text-sm text-slate-600">
        Si vous n'êtes pas à l'origine de cette demande, ignorez ce message — votre mot de
        passe restera inchangé.
      </Text>
      <Text className="break-all text-xs text-slate-400">
        Lien direct : {resetLink}
      </Text>
    </BaseLayout>
  );
}
