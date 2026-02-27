/*
  Warnings:

  - Added the required column `order_code` to the `ProductionOrder` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ProductionOrder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "order_code" TEXT NOT NULL,
    "model_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "status" TEXT NOT NULL DEFAULT 'planned',
    "notes" TEXT,
    "due_date" DATETIME,
    "started_at" DATETIME,
    "completed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ProductionOrder_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "Model" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ProductionOrder" ("order_code", "created_at", "id", "model_id", "quantity", "status", "updated_at") 
SELECT 'UE-2026-' || printf('%04d', id), "created_at", "id", "model_id", "quantity", "status", "updated_at" FROM "ProductionOrder";
DROP TABLE "ProductionOrder";
ALTER TABLE "new_ProductionOrder" RENAME TO "ProductionOrder";
CREATE UNIQUE INDEX "ProductionOrder_order_code_key" ON "ProductionOrder"("order_code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
