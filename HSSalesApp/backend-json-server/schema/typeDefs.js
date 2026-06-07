'use strict';

const typeDefs = `
  type User { id: ID! email: String! name: String phone: String role: String! }
  type AuthPayload { token: String! user: User! }
  type Unit { id: ID! label: String! globalFactor: Float isWholeNumber: Boolean }
  type Currency { id: ID! code: String! }
  type Product { id: ID! name: String! unitId: String! unit: String }
  type Warehouse { id: ID! name: String! }
  type Sale { id: ID! saleDate: String! warehouseId: String! createdBy: String! notes: String }
  type SalesItem { id: ID! saleId: String! productId: String! quantity: Float! unitPrice: Float! currencyId: String unitId: String bottleBreakdown: String }
  type AdminNotification { id: ID! type: String! saleId: String lotId: String productId: String orderId: String title: String! body: String! createdAt: String! actorUserId: String! unread: Boolean }
  type Lot { id: ID! productId: String! lotNumber: String! }
  type LotBatch { id: ID! lotId: String! warehouseId: String! acquiredAt: String! unitCost: Float! baseUnitCost: Float notes: String originalQuantity: Float! remainingQuantity: Float! }
  type SalesItemAllocation { id: ID! salesItemId: String! lotBatchId: String! quantityAllocated: Float! unitCostAtTime: Float! }
  type InventoryTransfer { id: ID! transferDate: String! fromWarehouseId: String! toWarehouseId: String! createdBy: String! notes: String }
  type InventoryTransferLine { id: ID! transferId: String! productId: String! lotId: String quantity: Float! }
  type StockRow { id: ID! batchLotId: String lotId: String lotNumber: String productId: String! productName: String! unit: String warehouseId: String! warehouseName: String! quantityOnHand: Float! unitCost: Float baseUnitCost: Float acquiredAt: String purchaseDate: String purchaseNotes: String }

  type Order {
    id: ID!
    orderNumber: String!
    status: String!
    customerName: String!
    customerPhone: String
    customerAddress: String
    orderDate: String!
    expectedDelivery: String
    deliveredDate: String
    warehouseId: String
    advancePaid: Float
    notes: String
    createdBy: String!
    cancelReason: String
  }

  type OrderItem {
    id: ID!
    orderId: ID!
    productId: ID!
    quantity: Float!
    unitPrice: Float!
    currencyId: String
    lotIds: [String]
    lotAllocations: String
  }

  input SaleItemInput { productId: String! quantity: Float! unitPrice: Float! currencyId: String unitId: String lotIds: [String!] bottleBreakdown: String }
  input CreateSaleInput { warehouseId: String! saleDate: String notes: String items: [SaleItemInput!]! }
  input CreateSalesUserInput { email: String! password: String! name: String phone: String }
  input PurchaseLineInput { productId: String! quantity: Float! unitCost: Float! baseUnitCost: Float notes: String lotNumber: String unitId: String }
  input CreatePurchaseInput { warehouseId: String! purchaseDate: String notes: String items: [PurchaseLineInput!]! }
  input TransferLineInput { productId: String! quantity: Float! }
  input CreateTransferInput { fromWarehouseId: String! toWarehouseId: String! transferDate: String notes: String lines: [TransferLineInput!]! }
  input CreateNotificationInput { type: String! saleId: String lotId: String productId: String title: String! body: String! actorUserId: String! readByUserIds: [String!] }

  type ProductionConsumption {
    id: ID!
    productionId: ID!
    productionNumber: String!
    lotBatchId: ID!
    quantity: Float!
    consumedAt: String!
    createdBy: String!
  }

  type Production {
    id: ID!
    productionNumber: String!
    status: String!
    orderDate: String!
    startDate: String
    completedDate: String
    cancelDate: String
    inputLotBatchId: ID!
    inputQuantity: Float!
    processingCostPerUnit: Float
    extraCosts: String
    outputProductId: ID!
    expectedOutputQty: Float
    actualOutputQty: Float
    effectiveCostPerOutputUnit: Float
    outputLotBatchId: ID
    cancelReason: String
    bottlePrices: String
    notes: String
    createdBy: String!
  }

  input ExtraCostInput { label: String! amount: Float! }
  input CreateProductionInput {
    inputLotBatchId: ID!
    inputQuantity: Float!
    processingCostPerUnit: Float
    extraCosts: [ExtraCostInput]
    outputProductId: ID!
    expectedOutputQty: Float
    notes: String
    orderDate: String
  }
  input UpdateProductionInput {
    inputQuantity: Float
    processingCostPerUnit: Float
    extraCosts: [ExtraCostInput]
    expectedOutputQty: Float
    notes: String
    orderDate: String
  }
  input CreatePackagingInput {
    productionId: ID!
    outputProductId: ID
    bottleSizeLiter: Float!
    bottleCost: Float!
    quantity: Float!
  }

  type OrderPayment {
    id: ID!
    orderId: ID!
    amount: Float!
    notes: String
    paidAt: String!
    recordedBy: String!
  }

  input AddOrderPaymentInput {
    orderId: ID!
    amount: Float!
    notes: String
    paidAt: String
  }

  input OrderItemInput { productId: ID! quantity: Float! unitPrice: Float! currencyId: String lotIds: [String] lotAllocations: String }
  input CreateOrderInput { customerName: String! customerPhone: String customerAddress: String orderDate: String! expectedDelivery: String warehouseId: String advancePaid: Float notes: String items: [OrderItemInput!]! }
  input UpdateOrderInput { customerName: String customerPhone: String customerAddress: String expectedDelivery: String warehouseId: String advancePaid: Float notes: String items: [OrderItemInput!] }

  type CreateSalePayload { sale: Sale! items: [SalesItem!]! }
  type CreateSalesUserPayload { user: User! }
  type ActionResult { ok: Boolean! purchaseId: String transferId: String }

  type Query {
    me: User
    users: [User!]!
    units: [Unit!]!
    currencies: [Currency!]!
    products: [Product!]!
    warehouses: [Warehouse!]!
    sales: [Sale!]!
    salesItems: [SalesItem!]!
    notifications: [AdminNotification!]!
    inventoryStock: [StockRow!]!
    lots: [Lot!]!
    lotBatches: [LotBatch!]!
    salesItemAllocations: [SalesItemAllocation!]!
    inventoryTransfers: [InventoryTransfer!]!
    inventoryTransferLines: [InventoryTransferLine!]!
    orders: [Order!]!
    orderItems: [OrderItem!]!
    orderPayments(orderId: ID): [OrderPayment!]!
    productions: [Production!]!
    productionConsumptionsForLot(lotId: ID!): [ProductionConsumption!]!
  }

  type Mutation {
    login(email: String!, password: String!): AuthPayload!
    createSalesUser(input: CreateSalesUserInput!): CreateSalesUserPayload!
    createSale(input: CreateSaleInput!): CreateSalePayload!
    markNotificationRead(id: ID!): Boolean!
    createProduct(name: String!, unitId: ID!): Product!
    updateProduct(id: ID!, name: String!, unitId: ID!): Product!
    deleteProduct(id: ID!): Boolean!
    createUnit(label: String!): Unit!
    updateUnit(id: ID!, label: String!): Unit!
    deleteUnit(id: ID!): Boolean!
    createCurrency(code: String!): Currency!
    updateCurrency(id: ID!, code: String!): Currency!
    deleteCurrency(id: ID!): Boolean!
    createWarehouse(name: String!): Warehouse!
    updateWarehouse(id: ID!, name: String!): Warehouse!
    deleteWarehouse(id: ID!): Boolean!
    createPurchase(input: CreatePurchaseInput!): ActionResult!
    createInventoryTransfer(input: CreateTransferInput!): ActionResult!
    createNotification(input: CreateNotificationInput!): AdminNotification!
    createOrder(input: CreateOrderInput!): Order!
    updateOrder(id: ID!, input: UpdateOrderInput!): Order!
    updateOrderStatus(id: ID!, status: String!, cancelReason: String): Order!
    deleteOrder(id: ID!): Boolean!
    addOrderPayment(input: AddOrderPaymentInput!): OrderPayment!
    createProduction(input: CreateProductionInput!): Production!
    updateProduction(id: ID!, input: UpdateProductionInput!): Production!
    updateProductionStatus(id: ID!, status: String!, actualOutputQty: Float, cancelReason: String, bottlePrices: String): Production!
    deleteProduction(id: ID!): Boolean!
  }

  type Subscription {
    notificationCreated: AdminNotification!
  }
`;

module.exports = typeDefs;
