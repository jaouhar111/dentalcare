/**
 * Tool context — opaque object passed to every booking tool builder.
 *
 * The AI never sees these fields; the webhook handler / engine resolves
 * them upfront (from the WhatsApp number on inbound messages, or from
 * the user session for the admin AI playground) and hands them to the
 * tools at construction time. Tools then operate scoped to this clinic
 * without trusting any model-provided IDs.
 */
export interface AIToolContext {
  /// Clinic the AI is acting on behalf of. Comes from the WhatsApp
  /// number → Clinic mapping or the admin user's session.
  clinicId: string;
  /// Optional — when the inbound message is from a known patient, we
  /// already know who they are and tools can skip the lookup.
  patientId?: string | null;
  /// Patient phone in E.164 normalised form. Used as a fallback when
  /// `patientId` is unset (new patient texting in).
  patientPhone?: string | null;
  /// User id to attribute audit log entries to. Null for AI-driven
  /// actions, in which case audit rows carry `userId: null` and
  /// `action: "ai.*"`.
  userId?: string | null;
}
