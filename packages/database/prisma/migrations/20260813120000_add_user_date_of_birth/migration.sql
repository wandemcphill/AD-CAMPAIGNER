-- Add nullable date of birth for the 18+ age gate (financial products, managed ads).
ALTER TABLE "User" ADD COLUMN "dateOfBirth" TIMESTAMP(3);
