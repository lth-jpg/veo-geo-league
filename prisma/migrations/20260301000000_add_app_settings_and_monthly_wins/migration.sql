-- CreateTable: AppSettings (singleton row, id=1)
CREATE TABLE "AppSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "simulatedDate" TEXT,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: MonthlyWin (one row per month, tracks monthly champion)
CREATE TABLE "MonthlyWin" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "avgScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyWin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyWin_year_month_key" ON "MonthlyWin"("year", "month");

-- AddForeignKey
ALTER TABLE "MonthlyWin" ADD CONSTRAINT "MonthlyWin_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
