-- CreateTable
CREATE TABLE "LinkClick" (
    "id" TEXT NOT NULL,
    "source" TEXT,
    "medium" TEXT,
    "campaign" TEXT,
    "content" TEXT,
    "term" TEXT,
    "ref" TEXT,
    "params" JSONB,
    "user_agent" TEXT,
    "referer" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkClick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LinkClick_campaign_idx" ON "LinkClick"("campaign");

-- CreateIndex
CREATE INDEX "LinkClick_created_at_idx" ON "LinkClick"("created_at");
