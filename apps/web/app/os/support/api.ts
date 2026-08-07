"use client";

import { apiRequest } from "../../lib/api-client";

export type SupportTicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type SupportTicketPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export interface SupportTicketReply {
  id: string;
  authorType: "USER" | "ADMIN";
  body: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  subject: string;
  body: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  createdAt: string;
  replies: SupportTicketReply[];
}

export async function createSupportTicket(input: {
  subject: string;
  body: string;
  priority?: SupportTicketPriority;
}) {
  return apiRequest<SupportTicket>("/support/tickets", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function listSupportTickets() {
  return apiRequest<SupportTicket[]>("/support/tickets");
}

export async function replyToSupportTicket(id: string, body: string) {
  return apiRequest<SupportTicket>(`/support/tickets/${encodeURIComponent(id)}/replies`, {
    method: "POST",
    body: JSON.stringify({ body })
  });
}
