export type SalePrintAudience = 'customer' | 'admin';

export type SalePrintFulfillmentLine = {
  lotNumber: string;
  warehouseName: string;
  textLines: string[];
};

export type SalePrintItem = {
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  itemMarginPct?: number;
  fulfillments?: SalePrintFulfillmentLine[];
};

export type SalePrintInput = {
  audience: SalePrintAudience;
  saleId: string;
  saleDate: string;
  warehouseName: string;
  salesPerson: { name: string; email: string; phone?: string } | null;
  notes?: string;
  items: SalePrintItem[];
  totalRevenue: number;
  totalCost?: number;
  totalProfit?: number;
  marginPct?: number;
};

function money(n: number) {
  return `BDT ${Number(n).toLocaleString()}`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** HTML for `react-native-print` (opens the OS print dialog). */
export function buildSalePrintHtml(p: SalePrintInput): string {
  const isAdmin = p.audience === 'admin';
  const itemRows: string[] = [];

  for (const it of p.items) {
    let block = `<tr><td colspan="2"><strong>${esc(it.productName)}</strong></td></tr>`;
    block += `<tr><td colspan="2" class="muted">${Number(it.quantity).toLocaleString()} × ${esc(money(it.unitPrice))} = <strong>${esc(money(it.subtotal))}</strong></td></tr>`;
    if (isAdmin && it.itemMarginPct !== undefined) {
      block += `<tr><td colspan="2" class="muted">Margin: ${it.itemMarginPct.toFixed(1)}%</td></tr>`;
    }
    if (isAdmin && it.fulfillments?.length) {
      for (const f of it.fulfillments) {
        block += `<tr><td colspan="2" class="lot">Lot ${esc(f.lotNumber)} — ${esc(f.warehouseName)}</td></tr>`;
        for (const line of f.textLines) {
          block += `<tr><td colspan="2" class="small">${esc(line)}</td></tr>`;
        }
      }
    }
    itemRows.push(block);
  }

  let personHtml = '';
  if (p.salesPerson) {
    personHtml = `<p><strong>Sales person:</strong> ${esc(p.salesPerson.name)}<br/>
      ${esc(p.salesPerson.email)}${p.salesPerson.phone ? `<br/>${esc(p.salesPerson.phone)}` : ''}</p>`;
  }

  const notesHtml = p.notes?.trim()
    ? `<p><strong>Notes:</strong> ${esc(p.notes.trim())}</p>`
    : '';

  let totalsHtml = `<p class="total"><strong>Revenue:</strong> ${esc(money(p.totalRevenue))}</p>`;
  if (isAdmin && p.totalCost !== undefined && p.totalProfit !== undefined && p.marginPct !== undefined) {
    totalsHtml += `<p><strong>Cost:</strong> ${esc(money(p.totalCost))}</p>`;
    totalsHtml += `<p><strong>Net ${p.totalProfit >= 0 ? 'profit' : 'loss'}:</strong> ${esc(money(p.totalProfit))}</p>`;
    totalsHtml += `<p><strong>Margin:</strong> ${p.marginPct.toFixed(1)}%</p>`;
  }

  const title = isAdmin ? 'ADMIN — SALE DETAIL (INTERNAL)' : 'CUSTOMER COPY';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111; padding: 16px; font-size: 14px; line-height: 1.45; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    .tag { color: #444; font-size: 13px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    td { padding: 4px 0; vertical-align: top; }
    .muted { color: #555; font-size: 13px; }
    .lot { font-size: 12px; color: #333; padding-top: 6px; }
    .small { font-size: 12px; color: #444; padding-left: 8px; }
    .total { font-size: 16px; margin-top: 12px; }
    hr { border: none; border-top: 1px solid #ccc; margin: 16px 0; }
  </style>
</head>
<body>
  <h1>HS SALES</h1>
  <p class="tag">${esc(title)}</p>
  <p><strong>Sale ref:</strong> ${esc(p.saleId)}<br/>
  <strong>Date:</strong> ${esc(p.saleDate)}<br/>
  <strong>Warehouse:</strong> ${esc(p.warehouseName)}</p>
  ${personHtml}
  ${notesHtml}
  <hr />
  <h2 style="font-size:15px;margin:0 0 8px;">Items</h2>
  <table>${itemRows.join('')}</table>
  <hr />
  ${totalsHtml}
</body>
</html>`;
}

export function buildSalePrintDocument(p: SalePrintInput): string {
  const lines: string[] = [];
  const isAdmin = p.audience === 'admin';

  lines.push('HS SALES');
  lines.push(isAdmin ? 'ADMIN — SALE DETAIL (INTERNAL)' : 'CUSTOMER COPY');
  lines.push('─'.repeat(36));
  lines.push(`Sale ref: ${p.saleId}`);
  lines.push(`Date: ${p.saleDate}`);
  lines.push(`Warehouse: ${p.warehouseName}`);

  if (p.salesPerson) {
    lines.push(`Sales person: ${p.salesPerson.name}`);
    lines.push(`  ${p.salesPerson.email}`);
    if (p.salesPerson.phone) lines.push(`  ${p.salesPerson.phone}`);
  }

  if (p.notes?.trim()) {
    lines.push(`Notes: ${p.notes.trim()}`);
  }

  lines.push('');
  lines.push('ITEMS');
  lines.push('─'.repeat(36));

  for (const it of p.items) {
    lines.push(`• ${it.productName}`);
    lines.push(
      `  ${Number(it.quantity).toLocaleString()} × ${money(it.unitPrice)} = ${money(it.subtotal)}`,
    );
    if (isAdmin && it.itemMarginPct !== undefined) {
      lines.push(`  Margin: ${it.itemMarginPct.toFixed(1)}%`);
    }
    if (isAdmin && it.fulfillments?.length) {
      for (const f of it.fulfillments) {
        lines.push(`  Lot ${f.lotNumber} @ ${f.warehouseName}`);
        for (const t of f.textLines) {
          lines.push(`    ${t}`);
        }
      }
    }
    lines.push('');
  }

  lines.push('TOTALS');
  lines.push('─'.repeat(36));
  lines.push(`Revenue: ${money(p.totalRevenue)}`);

  if (isAdmin && p.totalCost !== undefined && p.totalProfit !== undefined && p.marginPct !== undefined) {
    lines.push(`Cost: ${money(p.totalCost)}`);
    lines.push(`Net ${p.totalProfit >= 0 ? 'profit' : 'loss'}: ${money(p.totalProfit)}`);
    lines.push(`Margin: ${p.marginPct.toFixed(1)}%`);
  }

  lines.push('');
  lines.push('— End —');

  return lines.join('\n');
}
