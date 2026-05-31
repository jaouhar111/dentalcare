/**
 * Plain types for the AI Conversations admin UI. Lives in a sibling file
 * because "use server" modules can only export async functions (see
 * project memory: feedback-use-server-no-types).
 */

import type { AIConversationStatus } from "@prisma/client";
import type { ChatMessage } from "@/lib/ai/types";

export interface AIConversationListItem {
  id: string;
  patientPhone: string;
  patientId: string | null;
  patientName: string | null;
  status: AIConversationStatus;
  totalTurns: number;
  totalTokens: number;
  lastActivityAt: Date;
  /// Preview of the last user OR assistant message — empty when the
  /// row was just created and no turn has fired yet.
  lastSnippet: string;
  /// `true` when a patient message landed since the admin last opened
  /// this conversation. Drives the sidebar unread badge + per-row dot.
  unread: boolean;
}

export interface AIConversationDetail {
  id: string;
  patientPhone: string;
  patientId: string | null;
  patientName: string | null;
  status: AIConversationStatus;
  totalTurns: number;
  totalTokens: number;
  lastActivityAt: Date;
  createdAt: Date;
  handedOffAt: Date | null;
  handedOffByName: string | null;
  history: ChatMessage[];
}
