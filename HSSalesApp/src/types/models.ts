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
};

export type SalesItem = {
  id: string;
  saleId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  currencyId?: string;
};

/** Aggregated on-hand from lot batches (GET /api/inventory/stock). */
export type StockRow = {
  productId: string;
  productName: string;
  unit: string;
  warehouseId: string;
  warehouseName: string;
  quantityOnHand: number;
};

export type AdminNotification = {
  id: string;
  type: 'sale_created' | 'lot_depleted';
  saleId?: string;
  lotId?: string;
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
  originalQuantity: number;
  remainingQuantity: number;
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
