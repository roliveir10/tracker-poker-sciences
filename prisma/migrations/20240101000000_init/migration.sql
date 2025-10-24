-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('queued', 'processing', 'done', 'failed');

-- CreateEnum
CREATE TYPE "Street" AS ENUM ('preflop', 'flop', 'turn', 'river');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('fold', 'check', 'call', 'bet', 'raise', 'push');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Import" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'queued',
    "fileKey" TEXT NOT NULL,
    "numHands" INTEGER NOT NULL DEFAULT 0,
    "numImported" INTEGER NOT NULL DEFAULT 0,
    "numDuplicates" INTEGER NOT NULL DEFAULT 0,
    "numInvalid" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Import_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "importId" TEXT,
    "room" TEXT NOT NULL DEFAULT 'betclic',
    "gameId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "buyInCents" INTEGER NOT NULL,
    "rakeCents" INTEGER NOT NULL DEFAULT 0,
    "prizePoolCents" INTEGER NOT NULL DEFAULT 0,
    "prizeMultiplier" DOUBLE PRECISION NOT NULL,
    "heroResultPosition" INTEGER,
    "profitCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hand" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "handNo" TEXT,
    "heroSeat" INTEGER,
    "sbCents" INTEGER,
    "bbCents" INTEGER,
    "dealtCards" TEXT,
    "board" TEXT,
    "boardFlop" TEXT,
    "boardTurn" TEXT,
    "boardRiver" TEXT,
    "winnerSeat" INTEGER,
    "playedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalPotCents" INTEGER,
    "mainPotCents" INTEGER,
    "evRealizedCents" INTEGER,
    "evAllInAdjCents" INTEGER,
    "evSamples" INTEGER NOT NULL DEFAULT 0,
    "evUpdatedAt" TIMESTAMP(3),

    CONSTRAINT "Hand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Action" (
    "id" TEXT NOT NULL,
    "handId" TEXT NOT NULL,
    "street" "Street" NOT NULL,
    "seat" INTEGER NOT NULL,
    "type" "ActionType" NOT NULL,
    "sizeCents" INTEGER,
    "isAllIn" BOOLEAN NOT NULL DEFAULT false,
    "orderNo" INTEGER NOT NULL,

    CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandPlayer" (
    "id" TEXT NOT NULL,
    "handId" TEXT NOT NULL,
    "seat" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "hole" TEXT,
    "startingStackCents" INTEGER,
    "isHero" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "HandPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Import_userId_idx" ON "Import"("userId");

-- CreateIndex
CREATE INDEX "Import_status_idx" ON "Import"("status");

-- CreateIndex
CREATE INDEX "Tournament_userId_idx" ON "Tournament"("userId");

-- CreateIndex
CREATE INDEX "Tournament_importId_idx" ON "Tournament"("importId");

-- CreateIndex
CREATE INDEX "Tournament_startedAt_idx" ON "Tournament"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tournament_userId_gameId_key" ON "Tournament"("userId", "gameId");

-- CreateIndex
CREATE INDEX "Hand_tournamentId_idx" ON "Hand"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "Hand_tournamentId_handNo_key" ON "Hand"("tournamentId", "handNo");

-- CreateIndex
CREATE INDEX "Action_handId_idx" ON "Action"("handId");

-- CreateIndex
CREATE INDEX "Action_street_idx" ON "Action"("street");

-- CreateIndex
CREATE INDEX "HandPlayer_handId_idx" ON "HandPlayer"("handId");

-- CreateIndex
CREATE UNIQUE INDEX "HandPlayer_handId_seat_key" ON "HandPlayer"("handId", "seat");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Import" ADD CONSTRAINT "Import_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hand" ADD CONSTRAINT "Hand_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_handId_fkey" FOREIGN KEY ("handId") REFERENCES "Hand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandPlayer" ADD CONSTRAINT "HandPlayer_handId_fkey" FOREIGN KEY ("handId") REFERENCES "Hand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

