-- Add EV caching fields to Hand
ALTER TABLE "Hand"
ADD COLUMN "evRealizedCents" INTEGER,
ADD COLUMN "evAllInAdjCents" INTEGER,
ADD COLUMN "evSamples" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "evUpdatedAt" TIMESTAMP(3);
