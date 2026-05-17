import { Button, Heading, Row, Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout } from "./base-layout";

export interface InvoiceReceiptEmailProps {
  patientName: string;
  invoiceNumber: string;
  amount: string;
  issueDate: string;
  pdfUrl: string;
  clinicName: string;
}

export function InvoiceReceiptEmail({
  patientName,
  invoiceNumber,
  amount,
  issueDate,
  pdfUrl,
  clinicName,
}: InvoiceReceiptEmailProps) {
  return (
    <BaseLayout
      preview={`Votre facture ${invoiceNumber} - ${clinicName}`}
      clinicName={clinicName}
    >
      <Heading className="text-xl font-semibold text-slate-900">
        Bonjour {patientName},
      </Heading>
      <Text className="text-base leading-7 text-slate-700">
        Veuillez trouver ci-joint votre facture <strong>{invoiceNumber}</strong> émise par{" "}
        {clinicName}.
      </Text>
      <Section className="my-4 rounded-lg bg-slate-50 p-4">
        <Row>
          <Text className="m-0 text-xs uppercase tracking-wide text-slate-500">Numéro</Text>
          <Text className="m-0 text-sm font-medium text-slate-900">{invoiceNumber}</Text>
        </Row>
        <Row className="mt-2">
          <Text className="m-0 text-xs uppercase tracking-wide text-slate-500">Date</Text>
          <Text className="m-0 text-sm font-medium text-slate-900">{issueDate}</Text>
        </Row>
        <Row className="mt-2">
          <Text className="m-0 text-xs uppercase tracking-wide text-slate-500">Montant</Text>
          <Text className="m-0 text-sm font-semibold text-cyan-600">{amount}</Text>
        </Row>
      </Section>
      <Section className="my-6 text-center">
        <Button
          href={pdfUrl}
          className="inline-block rounded-lg bg-cyan-500 px-6 py-3 text-sm font-semibold text-white"
        >
          Télécharger la facture (PDF)
        </Button>
      </Section>
      <Text className="text-sm text-slate-600">
        Si vous avez des questions concernant cette facture, n'hésitez pas à nous contacter
        directement au cabinet.
      </Text>
    </BaseLayout>
  );
}
