export interface CreateSupportTicketDto {
  subject: string;
  body: string;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
}

export interface UpdateSupportTicketDto {
  status?: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
}

export interface SupportTicketQueryDto {
  status?: string;
  priority?: string;
}
