-- Password reset via emailed single-use token links.
--
-- Before this, /forgot-password was a client-only wizard: it collected a
-- "recovery question" answer and a "recovery PIN" that had no columns backing
-- them, made no API call, and then displayed a success screen. There was no
-- password-reset endpoint of any kind.
--
-- Only the SHA-256 hash of the token is persisted, mirroring Session.tokenHash,
-- so read access to this table cannot be replayed into an account takeover.
-- Rows are marked used rather than deleted so that a replayed link is
-- distinguishable from an unknown one during incident review.

CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "requestIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_userId_usedAt_idx" ON "PasswordResetToken"("userId", "usedAt");
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

ALTER TABLE "PasswordResetToken"
    ADD CONSTRAINT "PasswordResetToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
