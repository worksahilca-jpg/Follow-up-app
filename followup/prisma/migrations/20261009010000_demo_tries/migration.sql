-- Live answers on the home page's "Try it yourself" demo, for its limits
-- (3 per visitor a day, 40 per 10 minutes and 300 a day for the whole site).
-- Additive only.
CREATE TABLE IF NOT EXISTS "DemoTry" (
    "id" TEXT NOT NULL,
    "visitor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DemoTry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DemoTry_visitor_createdAt_idx" ON "DemoTry"("visitor", "createdAt");
CREATE INDEX IF NOT EXISTS "DemoTry_createdAt_idx" ON "DemoTry"("createdAt");

-- Every table is closed to the public API roles (same as every table since RLS was turned on).
ALTER TABLE "DemoTry" ENABLE ROW LEVEL SECURITY;
