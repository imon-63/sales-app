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
  return `BDT ${Number(n).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Beautiful HTML invoice for `react-native-print`. */
export function buildSalePrintHtml(p: SalePrintInput): string {
  const isAdmin = p.audience === 'admin';
  const accentColor = isAdmin ? '#0066CC' : '#00875A';
  const lightAccent = isAdmin ? '#E8F0FE' : '#E6F4EA';

  // Item rows
  const itemRows = p.items.map((it, i) => {
    const bg = i % 2 === 0 ? '#FFFFFF' : '#F8F9FA';
    let row = `
      <tr style="background:${bg}">
        <td style="padding:10px 12px;border-bottom:1px solid #E8EAED">
          <div style="font-weight:700;font-size:14px;color:#1A1A1A">${esc(it.productName)}</div>
          ${isAdmin && it.itemMarginPct !== undefined ? `<div style="font-size:11px;color:#666;margin-top:2px">Margin: ${it.itemMarginPct.toFixed(1)}%</div>` : ''}
          ${isAdmin && it.fulfillments?.length ? it.fulfillments.map(f =>
            `<div style="font-size:11px;color:#555;margin-top:4px;padding:4px 6px;background:#F0F2F5;border-radius:4px;border-left:3px solid ${accentColor}">
              Lot ${esc(f.lotNumber)} · ${esc(f.warehouseName)}
              ${f.textLines.map(l => `<br/><span style="color:#777">${esc(l)}</span>`).join('')}
            </div>`
          ).join('') : ''}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #E8EAED;text-align:center;color:#555;font-size:13px;white-space:nowrap">
          ${Number(it.quantity).toLocaleString()} × ${money(it.unitPrice)}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #E8EAED;text-align:right;font-weight:700;font-size:14px;white-space:nowrap">
          ${money(it.subtotal)}
        </td>
      </tr>`;
    return row;
  }).join('');

  // Totals section
  let totalsHtml = `
    <tr>
      <td colspan="2" style="padding:10px 12px;text-align:right;font-size:13px;color:#555">Subtotal</td>
      <td style="padding:10px 12px;text-align:right;font-weight:700">${money(p.totalRevenue)}</td>
    </tr>
    <tr style="background:${lightAccent}">
      <td colspan="2" style="padding:12px 12px;text-align:right;font-weight:900;font-size:15px;color:${accentColor}">TOTAL</td>
      <td style="padding:12px 12px;text-align:right;font-weight:900;font-size:16px;color:${accentColor}">${money(p.totalRevenue)}</td>
    </tr>`;

  if (isAdmin && p.totalCost !== undefined && p.totalProfit !== undefined && p.marginPct !== undefined) {
    const profitColor = p.totalProfit >= 0 ? '#00875A' : '#C0392B';
    totalsHtml += `
    <tr><td colspan="3" style="padding:0;height:8px"></td></tr>
    <tr style="background:#F8F9FA">
      <td colspan="2" style="padding:8px 12px;font-size:12px;color:#666">Cost of Goods</td>
      <td style="padding:8px 12px;text-align:right;font-size:12px;color:#666">${money(p.totalCost)}</td>
    </tr>
    <tr style="background:#F8F9FA">
      <td colspan="2" style="padding:8px 12px;font-size:13px;font-weight:700;color:${profitColor}">Net ${p.totalProfit >= 0 ? 'Profit' : 'Loss'}</td>
      <td style="padding:8px 12px;text-align:right;font-size:13px;font-weight:700;color:${profitColor}">${money(p.totalProfit)}</td>
    </tr>
    <tr style="background:#F8F9FA">
      <td colspan="2" style="padding:8px 12px;font-size:12px;color:#666">Margin</td>
      <td style="padding:8px 12px;text-align:right;font-size:12px;color:${profitColor};font-weight:700">${p.marginPct.toFixed(1)}%</td>
    </tr>`;
  }

  const customerSection = p.notes?.trim() ? `
    <div style="margin-bottom:20px;padding:14px 16px;background:${lightAccent};border-radius:8px;border-left:4px solid ${accentColor}">
      <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;color:${accentColor};margin-bottom:6px">Customer</div>
      <div style="font-size:14px;font-weight:600;color:#1A1A1A;white-space:pre-line">${esc(p.notes.trim())}</div>
    </div>` : '';

  const sellerSection = p.salesPerson ? `
    <div style="margin-bottom:0">
      <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;color:#888;margin-bottom:4px">Sales Person</div>
      <div style="font-size:13px;font-weight:700;color:#333">${esc(p.salesPerson.name)}</div>
      <div style="font-size:12px;color:#666">${esc(p.salesPerson.email)}${p.salesPerson.phone ? `&ensp;·&ensp;${esc(p.salesPerson.phone)}` : ''}</div>
    </div>` : '';

  const badgeLabel = isAdmin ? '⬛ INTERNAL COPY' : '📄 CUSTOMER RECEIPT';
  const badgeBg = isAdmin ? '#1A1A2E' : accentColor;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #1A1A1A; background: #FFFFFF; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <!-- Header -->
  <div style="background:${accentColor};padding:24px 24px 20px;color:#fff">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-size:26px;font-weight:900;letter-spacing:-0.5px">HS Sales</div>
        <div style="font-size:12px;opacity:0.85;margin-top:2px">Homaira Enterprise</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:10px;background:rgba(255,255,255,0.25);padding:3px 8px;border-radius:4px;font-weight:700;letter-spacing:0.5px">${badgeLabel}</div>
        <div style="font-size:12px;margin-top:8px;opacity:0.9">Ref: ${esc(p.saleId.slice(0, 12).toUpperCase())}</div>
      </div>
    </div>
  </div>

  <!-- Meta bar -->
  <div style="display:flex;background:#F8F9FA;border-bottom:1px solid #E8EAED;padding:0">
    <div style="flex:1;padding:12px 16px;border-right:1px solid #E8EAED">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#888;margin-bottom:3px">Date</div>
      <div style="font-size:13px;font-weight:700">${esc(p.saleDate)}</div>
    </div>
    <div style="flex:1;padding:12px 16px;border-right:1px solid #E8EAED">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#888;margin-bottom:3px">Warehouse</div>
      <div style="font-size:13px;font-weight:700">${esc(p.warehouseName)}</div>
    </div>
    <div style="flex:1;padding:12px 16px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#888;margin-bottom:3px">Items</div>
      <div style="font-size:13px;font-weight:700">${p.items.length}</div>
    </div>
  </div>

  <!-- Body -->
  <div style="padding:20px 16px">
    ${customerSection}

    <!-- Items table -->
    <div style="border:1px solid #E8EAED;border-radius:8px;overflow:hidden;margin-bottom:16px">
      <div style="background:${accentColor};padding:10px 12px">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;color:rgba(255,255,255,0.9)">Items</div>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#F0F2F5">
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#666;border-bottom:1px solid #E8EAED">Product</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#666;border-bottom:1px solid #E8EAED;white-space:nowrap">Qty × Rate</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#666;border-bottom:1px solid #E8EAED">Amount</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
        <tfoot style="border-top:2px solid ${accentColor}">${totalsHtml}</tfoot>
      </table>
    </div>

    ${sellerSection}
  </div>

  <!-- Footer -->
  <div style="margin-top:8px;padding:16px;border-top:1px solid #E8EAED;text-align:center;color:#999;font-size:11px">
    ${isAdmin ? 'Internal document — not for distribution' : 'Thank you for your business!'}
    &nbsp;·&nbsp; HS Sales · Homaira Enterprise
  </div>
</body>
</html>`;
}

export function buildSalePrintDocument(p: SalePrintInput): string {
  const isAdmin = p.audience === 'admin';
  const W = 42;
  const line = '─'.repeat(W);
  const lines: string[] = [];

  lines.push('HS SALES — Homaira Enterprise');
  lines.push(isAdmin ? 'INTERNAL COPY' : 'CUSTOMER RECEIPT');
  lines.push(line);
  lines.push(`Ref:        ${p.saleId.slice(0, 12).toUpperCase()}`);
  lines.push(`Date:       ${p.saleDate}`);
  lines.push(`Warehouse:  ${p.warehouseName}`);

  if (p.notes?.trim()) {
    lines.push(line);
    lines.push('CUSTOMER');
    lines.push(p.notes.trim());
  }

  if (p.salesPerson) {
    lines.push(line);
    lines.push('SALES PERSON');
    lines.push(p.salesPerson.name);
    lines.push(p.salesPerson.email);
    if (p.salesPerson.phone) lines.push(p.salesPerson.phone);
  }

  lines.push(line);
  lines.push('ITEMS');
  lines.push(line);

  for (const it of p.items) {
    lines.push(`• ${it.productName}`);
    lines.push(`  ${Number(it.quantity).toLocaleString()} × ${money(it.unitPrice)}`);
    lines.push(`  = ${money(it.subtotal)}`);
    if (isAdmin && it.itemMarginPct !== undefined) {
      lines.push(`  Margin: ${it.itemMarginPct.toFixed(1)}%`);
    }
    if (isAdmin && it.fulfillments?.length) {
      for (const f of it.fulfillments) {
        lines.push(`  Lot ${f.lotNumber} @ ${f.warehouseName}`);
        for (const t of f.textLines) lines.push(`    ${t}`);
      }
    }
    lines.push('');
  }

  lines.push(line);
  lines.push(`TOTAL:  ${money(p.totalRevenue)}`);

  if (isAdmin && p.totalCost !== undefined && p.totalProfit !== undefined && p.marginPct !== undefined) {
    lines.push(`Cost:   ${money(p.totalCost)}`);
    lines.push(`Net ${p.totalProfit >= 0 ? 'Profit' : 'Loss'}: ${money(p.totalProfit)}`);
    lines.push(`Margin: ${p.marginPct.toFixed(1)}%`);
  }

  lines.push(line);
  lines.push(isAdmin ? '— Internal document —' : '— Thank you for your business! —');

  return lines.join('\n');
}
