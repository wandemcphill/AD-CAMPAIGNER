-- Notification delivery layer (Termii SMS/Email/WhatsApp).
--
-- 1. User gains phone/phoneVerifiedAt, mirroring the existing email/emailVerifiedAt
--    pattern -- there was previously no phone number anywhere on User, so SMS/WhatsApp
--    delivery to authenticated users had nowhere to resolve a destination from.
-- 2. Notification.workspaceId becomes nullable and gains guestEmail/guestPhone so
--    guest-checkout transactions (no workspace, no userId) can use the exact same
--    notification + delivery-attempt tracking as authenticated notifications instead
--    of a parallel table.
-- 3. NotificationPreference gains an sms toggle alongside the existing inApp/email/whatsapp.

ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

ALTER TABLE "Notification" ALTER COLUMN "workspaceId" DROP NOT NULL;
ALTER TABLE "Notification" ADD COLUMN "guestEmail" TEXT;
ALTER TABLE "Notification" ADD COLUMN "guestPhone" TEXT;

ALTER TABLE "NotificationPreference" ADD COLUMN "sms" BOOLEAN NOT NULL DEFAULT true;
