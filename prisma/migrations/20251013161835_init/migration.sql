-- AlterTable
ALTER TABLE "Hand" ADD COLUMN "boardFlop" TEXT;
ALTER TABLE "Hand" ADD COLUMN "boardRiver" TEXT;
ALTER TABLE "Hand" ADD COLUMN "boardTurn" TEXT;
ALTER TABLE "Hand" ADD COLUMN "totalPotCents" INTEGER;

-- CreateTable
CREATE TABLE "HandPlayer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "handId" TEXT NOT NULL,
    "seat" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "hole" TEXT,
    "startingStackCents" INTEGER,
    "isHero" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "HandPlayer_handId_fkey" FOREIGN KEY ("handId") REFERENCES "Hand" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "HandPlayer_handId_idx" ON "HandPlayer"("handId");

-- CreateIndex
CREATE UNIQUE INDEX "HandPlayer_handId_seat_key" ON "HandPlayer"("handId", "seat");
