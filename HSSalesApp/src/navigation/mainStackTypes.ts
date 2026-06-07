export type MainStackParamList = {
  Work: undefined;
  StockRoom: undefined;
  ReceiveStock: undefined;
  TransferStock: undefined;
  SaleDetails: { saleId: string };
  LotReport: { lotId: string };
  ProductDetail: { productId: string };
  PurchaseDetail: { lotBatchId: string };
  Notifications: undefined;
};
