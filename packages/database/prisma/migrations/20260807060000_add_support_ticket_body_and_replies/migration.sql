-- SupportTicket had no message body column and no reply thread, making it
-- unusable as an actual ticketing feature. Adds both.

ALTER TABLE "SupportTicket" ADD COLUMN "body" TEXT NOT NULL DEFAULT '';

CREATE TABLE "SupportTicketReply" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "ticketId" TEXT NOT NULL,
  "authorUserId" TEXT NOT NULL,
  "authorType" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SupportTicketReply_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportTicketReply_ticketId_createdAt_idx" ON "SupportTicketReply"("ticketId", "createdAt");

ALTER TABLE "SupportTicketReply" ADD CONSTRAINT "SupportTicketReply_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
