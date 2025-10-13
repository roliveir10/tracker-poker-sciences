/*
  Warnings:

  - Added the required column `gameId` to the `Tournament` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Tournament" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "importId" TEXT,
    "room" TEXT NOT NULL DEFAULT 'betclic',
    "gameId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "buyInCents" INTEGER NOT NULL,
    "rakeCents" INTEGER NOT NULL DEFAULT 0,
    "prizeMultiplier" REAL NOT NULL,
    "resultPosition" INTEGER,
    "profitCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Tournament_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Tournament_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Tournament" ("buyInCents", "createdAt", "id", "importId", "prizeMultiplier", "profitCents", "rakeCents", "resultPosition", "room", "startedAt", "userId") SELECT "buyInCents", "createdAt", "id", "importId", "prizeMultiplier", "profitCents", "rakeCents", "resultPosition", "room", "startedAt", "userId" FROM "Tournament";
DROP TABLE "Tournament";
ALTER TABLE "new_Tournament" RENAME TO "Tournament";
CREATE INDEX "Tournament_userId_idx" ON "Tournament"("userId");
CREATE INDEX "Tournament_importId_idx" ON "Tournament"("importId");
CREATE INDEX "Tournament_startedAt_idx" ON "Tournament"("startedAt");
CREATE UNIQUE INDEX "Tournament_userId_gameId_key" ON "Tournament"("userId", "gameId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
