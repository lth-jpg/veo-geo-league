-- AlterTable: add isDoubleDay to Score
ALTER TABLE "Score" ADD COLUMN "isDoubleDay" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: LeagueConfig
CREATE TABLE "LeagueConfig" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "activeDays" TEXT NOT NULL DEFAULT '[]',
    "scoreCount" INTEGER NOT NULL DEFAULT 15,
    "doubleDayDate" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeagueConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeagueConfig_year_month_key" ON "LeagueConfig"("year", "month");
