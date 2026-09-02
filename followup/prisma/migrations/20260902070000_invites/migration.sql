-- Real team invites: a pending Invite (by email) that a Google sign-in
-- consumes to join an existing business instead of getting its own new
-- one. Purely additive — one new table.

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL DEFAULT 'SALES',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invite_businessId_email_key" ON "Invite"("businessId", "email");

-- CreateIndex
CREATE INDEX "Invite_businessId_idx" ON "Invite"("businessId");

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
