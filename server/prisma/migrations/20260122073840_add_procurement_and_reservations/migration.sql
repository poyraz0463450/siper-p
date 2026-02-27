-- CreateTable
CREATE TABLE "Supplier" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PartSupplier" (
    "part_id" INTEGER NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "unit_price" REAL NOT NULL,
    "last_purchase_price" REAL,
    "is_preferred" BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY ("part_id", "supplier_id"),
    CONSTRAINT "PartSupplier_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "Part" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PartSupplier_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchaseRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pr_code" TEXT NOT NULL,
    "part_id" INTEGER NOT NULL,
    "order_id" INTEGER,
    "quantity" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "supplier_id" INTEGER,
    "unit_price" REAL,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "PurchaseRequest_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "Part" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchaseRequest_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "ProductionOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PurchaseRequest_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockReservation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "part_id" INTEGER NOT NULL,
    "order_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "reserved_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockReservation_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "Part" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockReservation_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "ProductionOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequest_pr_code_key" ON "PurchaseRequest"("pr_code");

-- CreateIndex
CREATE UNIQUE INDEX "StockReservation_part_id_order_id_key" ON "StockReservation"("part_id", "order_id");
