export type UserRole = 'admin' | 'sales';

export type User = {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
};

export type Currency = {
  id: string;
  code: string;
};

export type Unit = {
  id: string;
  label: string;
  globalFactor?: number;
  isWholeNumber?: boolean;
};

export type Product = {
  id: string;
  name: string;
  /** FK into `units` (preferred). */
  unitId: string;
  /** Legacy seed / migration only — resolve via `unitId` when missing. */
  unit?: string;
  /** Custom unit conversions (e.g. {"bag-id": 50}) */
  conversions?: Record<string, number>;
};

export type Warehouse = {
  id: string;
  name: string;
};

export type Sale = {
  id: string;
  saleDate: string;
  warehouseId: string;
  createdBy: string;
  notes?: string;
  orderId?: string;
  status?: string;
  cancelledAt?: string;
  cancelReason?: string;
  paidAmount?: number;
  totalAmount?: number;
  paymentStatus?: 'paid' | 'partial' | 'due';
  extraCost?: number;
};

export type SalePayment = {
  id: string;
  saleId: string;
  amount: number;
  collectedBy: string;
  collectedByName?: string;
  paidAt: string;
  notes?: string;
};

export type BottleBreakdownItem = {
  sizeLiter: number;
  count: number;
  bottleCost: number;
};

export type SalesItem = {
  id: string;
  saleId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  currencyId?: string;
  bottleBreakdown?: string; // JSON string of BottleBreakdownItem[]
};

/** Aggregated on-hand from lot batches (GET /api/inventory/stock). */
export type StockRow = {
  id?: string;
  batchLotId?: string;
  lotId?: string;
  lotNumber?: string;
  purchaseDate?: string;
  purchaseNotes?: string;
  productId: string;
  productName: string;
  unit: string;
  warehouseId: string;
  warehouseName: string;
  quantityOnHand: number;
  unitCost?: number;
  baseUnitCost?: number;
  acquiredAt?: string;
};

export type AdminNotification = {
  id: string;
  type: 'sale_created' | 'lot_depleted' | 'sell_viewing' | 'order_created';
  saleId?: string;
  lotId?: string;
  orderId?: string;
  productId?: string;
  title: string;
  body: string;
  createdAt: string;
  actorUserId: string;
  readByUserIds?: string[];
  unread: boolean;
};

export type Lot = {
  id: string;
  productId: string;
  lotNumber: string;
};

export type LotBatch = {
  id: string;
  lotId: string;
  warehouseId: string;
  acquiredAt: string;
  unitCost: number;
  baseUnitCost?: number;
  notes?: string;
  originalQuantity: number;
  remainingQuantity: number;
};

export type LotPurchaseLog = {
  id: string;
  lotId: string;
  acquiredAt: string;
  quantity: number;
  baseUnitCost: number;
  extraCost?: number;
  effectiveUnitCost: number;
  notes?: string;
};

export type SalesItemAllocation = {
  id: string;
  salesItemId: string;
  lotBatchId: string;
  quantityAllocated: number;
  unitCostAtTime: number;
};

export type InventoryTransfer = {
  id: string;
  transferDate: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  createdBy: string;
  notes?: string;
};

export type InventoryTransferLine = {
  id: string;
  transferId: string;
  productId: string;
  lotId?: string;
  quantity: number;
};

// ── Production ─────────────────────────────────────────────────────────────────
export type ProductionStatus = 'draft' | 'in_progress' | 'completed' | 'cancelled';

export type ExtraCost = { label: string; amount: number };

export type ProductionInputLot = { lotBatchId: string; quantity: number };

export type Production = {
  id: string;
  productionNumber: string;
  status: ProductionStatus;
  orderDate: string;
  startDate?: string;
  completedDate?: string;
  cancelDate?: string;
  inputLotBatchId?: string;  // first lot — kept for backward compat
  inputQuantity?: number;    // total across all lots — kept for backward compat
  inputLots?: string;        // JSON: ProductionInputLot[]
  processingCostPerUnit?: number;
  extraCosts?: string; // JSON string of ExtraCost[]
  outputProductId: string;
  expectedOutputQty?: number;
  actualOutputQty?: number;
  effectiveCostPerOutputUnit?: number;
  outputLotBatchId?: string;
  cancelReason?: string;
  bottlePrices?: string; // JSON string of { "5": number, "2": number, ... }
  notes?: string;
  createdBy: string;
};

export type ProductionConsumption = {
  id: string;
  productionId: string;
  productionNumber: string;
  lotBatchId: string;
  quantity: number;
  consumedAt: string;
  createdBy: string;
};

export type OrderPayment = {
  id: string;
  orderId: string;
  amount: number;
  notes?: string;
  paidAt: string;
  recordedBy: string;
  orderStep?: string;
  type?: string; // 'payment' (default) | 'refund'
};

export type OrderStatus = 'draft' | 'confirmed' | 'processing' | 'out_for_delivery' | 'delivered' | 'cancelled';

export type Order = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  orderDate: string;
  expectedDelivery?: string;
  deliveredDate?: string;
  confirmedDate?: string;
  processingDate?: string;
  outForDeliveryDate?: string;
  warehouseId?: string;
  advancePaid?: number;
  notes?: string;
  createdBy: string;
  cancelReason?: string;
};

export type OrderItem = {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  currencyId?: string;
  lotIds?: string[]; // lot IDs selected at processing time (ordered priority)
  lotAllocations?: { lotId: string; quantity: number }[]; // explicit qty per lot
};
