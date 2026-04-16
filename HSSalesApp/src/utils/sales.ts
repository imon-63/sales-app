import type { Product, Sale, SalesItem, Unit, UserRole, Warehouse } from '../types/models';

export function unitLabelForProduct(product: Product, units: Unit[]): string {
  if (product.unitId) {
    const u = units.find((x) => x.id === product.unitId);
    if (u) return u.label;
  }
  return product.unit ?? '';
}

export function filterSalesByRole(
  sales: Sale[],
  role: UserRole,
  userId: string,
) {
  if (role === 'admin') return sales;
  return sales.filter((s) => s.createdBy === userId);
}

export function sumRevenueForSales(saleIds: Set<string>, items: SalesItem[]) {
  return items
    .filter((i) => saleIds.has(i.saleId))
    .reduce((acc, i) => acc + Number(i.quantity) * Number(i.unitPrice), 0);
}

export function mapById<T extends { id: string }>(rows: T[]) {
  const m = new Map<string, T>();
  for (const r of rows) m.set(r.id, r);
  return m;
}

export type SaleAgendaItem = {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
};

export function buildAgendaSections(
  sales: Sale[],
  items: SalesItem[],
  products: Product[],
  warehouses: Warehouse[],
) {
  const productById = mapById(products);
  const warehouseById = mapById(warehouses);

  const itemsBySale = new Map<string, SalesItem[]>();
  for (const it of items) {
    const arr = itemsBySale.get(it.saleId) ?? [];
    arr.push(it);
    itemsBySale.set(it.saleId, arr);
  }

  const sorted = [...sales].sort((a, b) =>
    a.saleDate < b.saleDate ? -1 : a.saleDate > b.saleDate ? 1 : 0,
  );

  const sections: { title: string; data: SaleAgendaItem[] }[] = [];

  for (const sale of sorted) {
    const saleItems = itemsBySale.get(sale.id) ?? [];
    const productNames = saleItems
      .map((si) => productById.get(si.productId)?.name ?? 'Product')
      .slice(0, 3);
    const extra =
      saleItems.length > productNames.length
        ? ` +${saleItems.length - productNames.length}`
        : '';
    const wh = warehouseById.get(sale.warehouseId)?.name ?? 'Warehouse';
    const lines = saleItems.length;

    const sectionTitle = sale.saleDate; // YYYY-MM-DD
    let section = sections.find((s) => s.title === sectionTitle);
    if (!section) {
      section = { title: sectionTitle, data: [] };
      sections.push(section);
    }

    section.data.push({
      id: sale.id,
      title: `${lines} line${lines === 1 ? '' : 's'} · ${wh}`,
      subtitle: `${productNames.join(' · ')}${extra}`,
      meta: sale.notes ? String(sale.notes) : 'Recorded sale',
    });
  }

  return sections;
}
