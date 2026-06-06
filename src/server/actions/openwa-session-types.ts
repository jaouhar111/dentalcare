/**
 * Plain types for the WhatsApp QR-onboarding panel. Lives in a sibling
 * file because "use server" modules can only export async functions
 * (see project memory: feedback-use-server-no-types).
 */

export interface OpenwaConnectionState {
  /// `not_connected` when the clinic has no openwaSessionId.
  /// `connecting`    when the session is created/initializing.
  /// `awaiting_scan` when OpenWA is waiting for the QR scan.
  /// `ready`         when the linked WhatsApp is fully usable.
  /// `failed`        when OpenWA reported an error.
  /// `unknown`       when the gateway didn't return a status we map.
  state:
    | "not_connected"
    | "connecting"
    | "awaiting_scan"
    | "ready"
    | "failed"
    | "unknown";
  /// OpenWA session UUID — null when not yet provisioned.
  sessionId: string | null;
  /// Data-URL PNG of the QR. Only present when `state === "awaiting_scan"`.
  qrCode: string | null;
  /// E.164-ish phone reported by OpenWA after authentication.
  phone: string | null;
  /// WhatsApp display name reported by OpenWA after authentication.
  pushName: string | null;
  /// Surface gateway errors verbatim so the UI can show actionable text.
  error: string | null;
}
