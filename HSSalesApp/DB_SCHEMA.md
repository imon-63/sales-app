# Database Schema & Relations

## Entity Map

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  CATALOG (lookup tables)                                                                    │
│                                                                                             │
│  users              units              currencies         warehouses         products        │
│  ──────────         ──────────         ──────────         ──────────         ────────────   │
│  id (PK)            id (PK)            id (PK)            id (PK)            id (PK)        │
│  email              label              code               name               name            │
│  name               globalFactor                                             unitId ────────►│units
│  phone              isWholeNumber                                            unit (legacy)   │
│  role                                                                                       │
│  (admin|sales)                                                                              │
└─────────────────────────────────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────────────────┐
│  INVENTORY / LOT SYSTEM                                                      │
│                                                                              │
│  lots                  lotBatches                 lotPurchaseLogs            │
│  ─────────────         ──────────────────         ──────────────────         │
│  id (PK)               id (PK)                    id (PK)                    │
│  productId ──────────► products                   lotId ──────────────────► lots
│  lotNumber             lotId ───────────────────► lots                       │
│                        warehouseId ─────────────► warehouses                 │
│                        acquiredAt                 acquiredAt                 │
│                        unitCost                   quantity                   │
│                        baseUnitCost               baseUnitCost               │
│                        originalQuantity           extraCost                  │
│                        remainingQuantity ◄──────── decremented by sales      │
│                        notes                      effectiveUnitCost          │
│                                                   notes                      │
└──────────────────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  SALES                                                                                       │
│                                                                                              │
│  sales                  salesItems                 salesItemAllocations      salePayments    │
│  ──────────────         ────────────────           ─────────────────────     ─────────────  │
│  id (PK)                id (PK)                    id (PK)                   id (PK)         │
│  saleDate               saleId ──────────────────► sales                     saleId ───────► sales
│  warehouseId ─────────► warehouses                 salesItemId ─────────────► salesItems     │
│  createdBy ───────────► users                      lotBatchId ──────────────► lotBatches     │
│  orderId ─────────────► orders (optional)          quantityAllocated         amount          │
│  status                 productId ───────────────► products                  collectedBy ──► users
│  cancelledAt            quantity                   unitCostAtTime            collectedByName │
│  cancelReason           unitPrice                                            paidAt          │
│  paidAmount             currencyId ──────────────► currencies                notes          │
│  totalAmount            unitId ──────────────────► units                                    │
│  paymentStatus          bottleBreakdown (JSON)                                              │
│  extraCost                                                                                  │
│  notes                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  ORDERS                                                                                 │
│                                                                                         │
│  orders                 orderItems                 orderPayments                        │
│  ──────────────         ───────────────            ──────────────                       │
│  id (PK)                id (PK)                    id (PK)                              │
│  orderNumber            orderId ─────────────────► orders                               │
│  status                 productId ───────────────► products                             │
│  customerName           quantity                   orderId ────────────────────────────► orders
│  customerPhone          unitPrice                  amount                               │
│  customerAddress        currencyId ─────────────► currencies                            │
│  orderDate              lotIds (JSON array)──────► lots (priority order)                │
│  expectedDelivery       lotAllocations (JSON)      paidAt                               │
│  deliveredDate          batchAllocations (JSON)    recordedBy ─────────────────────────► users
│  warehouseId ─────────► warehouses                 orderStep                            │
│  advancePaid            (unitPrice)                type (payment|refund)                │
│  createdBy ───────────► users                                                           │
│  cancelReason                                                                           │
│  stockReserved                                                                          │
│  confirmedDate / processingDate / outForDeliveryDate                                    │
└─────────────────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  PRODUCTION                                                                                 │
│                                                                                             │
│  productions                          productionConsumptions                               │
│  ─────────────────────                ──────────────────────                               │
│  id (PK)                              id (PK)                                              │
│  productionNumber                     productionId ────────────────────────────────────────► productions
│  status (draft|in_progress|           productionNumber                                     │
│          completed|cancelled)         lotBatchId ──────────────────────────────────────────► lotBatches
│  orderDate                            quantity                                             │
│  inputLotBatchId ───────────────────► lotBatches  (raw material)                          │
│  inputQuantity                        consumedAt                                           │
│  processingCostPerUnit                createdBy ──────────────────────────────────────────► users
│  extraCosts (JSON)                                                                         │
│  outputProductId ───────────────────► products    (finished good)                          │
│  expectedOutputQty                                                                         │
│  actualOutputQty                                                                           │
│  effectiveCostPerOutputUnit                                                                │
│  outputLotBatchId ──────────────────► lotBatches  (new batch created on completion)        │
│  cancelReason                                                                              │
│  bottlePrices (JSON)                                                                       │
│  notes                                                                                     │
│  createdBy ─────────────────────────► users                                                │
└─────────────────────────────────────────────────────────────────────────────────────────────┘


┌───────────────────────────────────────────────────────────────────────────────┐
│  INVENTORY TRANSFERS                                                          │
│                                                                               │
│  inventoryTransfers       inventoryTransferLines                              │
│  ───────────────────      ──────────────────────                              │
│  id (PK)                  id (PK)                                             │
│  transferDate             transferId ─────────────────────────────────────── ► inventoryTransfers
│  fromWarehouseId ───────► warehouses                                          │
│  toWarehouseId ─────────► warehouses                                          │
│  createdBy ─────────────► users                  productId ─────────────────► products
│  notes                                           lotId ───────────────────── ► lots (optional)
│                                                  quantity                     │
└───────────────────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────────┐
│  NOTIFICATIONS                                                       │
│                                                                      │
│  notifications                                                       │
│  ─────────────────────                                               │
│  id (PK)                                                             │
│  type  (sale_created | lot_depleted | sell_viewing | order_created)  │
│  saleId ──────────────────────────────────────────────────────────► sales (optional)
│  lotId ───────────────────────────────────────────────────────────► lots (optional)
│  productId ───────────────────────────────────────────────────────► products (optional)
│  orderId ─────────────────────────────────────────────────────────► orders (optional)
│  title / body / createdAt                                            │
│  actorUserId ─────────────────────────────────────────────────────► users
│  readByUserIds (JSON array) ──────────────────────────────────────► users[]
│  unread                                                              │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Key Relation Summary

| From | Field | To | Note |
|------|-------|----|------|
| `products` | `unitId` | `units` | Default unit for this product |
| `lots` | `productId` | `products` | A lot tracks one product's stock identity |
| `lotBatches` | `lotId` | `lots` | One lot can have multiple batches (tranches) |
| `lotBatches` | `warehouseId` | `warehouses` | Physical location of this batch |
| `lotPurchaseLogs` | `lotId` | `lots` | Purchase history record per lot |
| `sales` | `warehouseId` | `warehouses` | Where stock was dispatched from |
| `sales` | `createdBy` | `users` | Who created the sale |
| `sales` | `orderId` | `orders` | Optional — sale generated from an order |
| `salesItems` | `saleId` | `sales` | Line items belonging to a sale |
| `salesItems` | `productId` | `products` | What was sold |
| `salesItemAllocations` | `salesItemId` | `salesItems` | Which line item used which batch |
| `salesItemAllocations` | `lotBatchId` | `lotBatches` | Which batch stock was taken from |
| `salePayments` | `saleId` | `sales` | Payment instalments for a sale |
| `orders` | `warehouseId` | `warehouses` | Fulfillment warehouse |
| `orders` | `createdBy` | `users` | Who placed the order |
| `orderItems` | `orderId` | `orders` | Products in an order |
| `orderPayments` | `orderId` | `orders` | Payment / refund records for an order |
| `productions` | `inputLotBatchId` | `lotBatches` | Raw material batch consumed |
| `productions` | `outputProductId` | `products` | Finished product type |
| `productions` | `outputLotBatchId` | `lotBatches` | New batch created on completion |
| `productionConsumptions` | `productionId` | `productions` | Mid-run consumption records |
| `productionConsumptions` | `lotBatchId` | `lotBatches` | Which batch was consumed |
| `inventoryTransfers` | `fromWarehouseId` | `warehouses` | Source |
| `inventoryTransfers` | `toWarehouseId` | `warehouses` | Destination |
| `inventoryTransferLines` | `transferId` | `inventoryTransfers` | Line items of a transfer |
| `inventoryTransferLines` | `lotId` | `lots` | Which lot was moved |
| `notifications` | `actorUserId` | `users` | Who triggered the event |

---

## Stock Flow

```
Purchase ──► LotBatch (remainingQty full)
                │
                ├──► Production (consumes input batch, creates output batch)
                │
                ├──► InventoryTransfer (moves batch between warehouses)
                │
                └──► Sale ──► SalesItem ──► SalesItemAllocation
                                               (decrements remainingQty)
```

## Payment Flow

```
Order ──► OrderPayments  (advance / instalments / refunds)
Sale  ──► SalePayments   (collected at/after delivery)
          sale.paidAmount tracks running total
          sale.paymentStatus = paid | partial | due
```
