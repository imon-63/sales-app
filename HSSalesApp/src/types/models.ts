export type UserRole = 'admin' | 'sales';

export type User = {
  id: string;
  email: string;
  role: UserRole;
};

export type Unit = {
  id: string;
  label: string;
};

export type Currency = {
  id: string;
  code: string;
};

export type Product = {
  id: string;
  name: string;
  /** FK into `units` (preferred). */
  unitId: string;
  /** Legacy seed / migration only — resolve via `unitId` when missing. */
  unit?: string;
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
  type: 'sale_created';
  saleId: string;
  title: string;
  body: string;
  createdAt: string;
  actorUserId: string;
  readByUserIds?: string[];
  unread: boolean;
};
