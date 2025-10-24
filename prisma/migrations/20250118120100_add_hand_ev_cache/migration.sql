-- Add EV caching fields to Hand (safe if columns already exist)
ALTER TABLE "Hand"
ADD COLUMN IF NOT EXISTS "evRealizedCents" INTEGER,
ADD COLUMN IF NOT EXISTS "evAllInAdjCents" INTEGER,
ADD COLUMN IF NOT EXISTS "evSamples" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "evUpdatedAt" TIMESTAMP(3);
