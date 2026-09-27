-- Sign-ins and "Sign out everywhere" (design brain A-041).
ALTER TABLE "User" ADD COLUMN "sessionsRevokedAt" TIMESTAMP(3);

CREATE TABLE "SignIn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "place" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignIn_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SignIn_userId_createdAt_idx" ON "SignIn"("userId", "createdAt");

ALTER TABLE "SignIn" ADD CONSTRAINT "SignIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Closed to Supabase's Data API from the start, like every other table
-- (20260926090000_enable_rls_all_public_tables): RLS on, no policies.
ALTER TABLE "SignIn" ENABLE ROW LEVEL SECURITY;
