-- AlterTable: add positionChange to Score
ALTER TABLE "Score" ADD COLUMN "positionChange" INTEGER;

-- AlterTable: add reason to RedCard
ALTER TABLE "RedCard" ADD COLUMN "reason" TEXT;

-- CreateTable: BreakingNews
CREATE TABLE "BreakingNews" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BreakingNews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BreakingNews_createdAt_idx" ON "BreakingNews"("createdAt");

-- CreateIndex
CREATE INDEX "BreakingNews_expiresAt_idx" ON "BreakingNews"("expiresAt");

-- AddForeignKey
ALTER TABLE "BreakingNews" ADD CONSTRAINT "BreakingNews_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
