/** Escape text for safe HTML embedding */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(amount: number, currency: string): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return `${n.toFixed(3)} ${esc(currency)}`;
}

function formatDate(value: unknown): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return esc(value);
  return d.toLocaleDateString('ar-OM', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function workflowActiveStep(
  docType: string,
  status: string,
  paymentStatus?: string,
): number {
  if (docType === 'QUOTATION') {
    if (status === 'CANCELLED') return -1;
    if (status === 'DRAFT') return 0;
    if (['SENT', 'VIEWED', 'OVERDUE'].includes(status)) return 1;
    return 2;
  }
  if (docType !== 'SALES') return -1;
  if (paymentStatus === 'PAID' || status === 'PAID') return 3;
  if (['SENT', 'VIEWED', 'OVERDUE'].includes(status)) return 2;
  if (status === 'DRAFT') return 1;
  return 0;
}

function buildWorkflowHtml(
  docType: string,
  status: string,
  paymentStatus: string | undefined,
  color: string,
): string {
  const labels =
    docType === 'QUOTATION'
      ? ['مسودة', 'مرسل', 'فاتورة']
      : docType === 'SALES'
        ? ['فاتورة مبدئية', 'إصدار', 'مطالبة', 'إيصال سداد']
        : null;
  if (!labels) return '';
  const current = workflowActiveStep(docType, status, paymentStatus);
  if (current < 0) return '';

  const nodes = labels
    .map((label, idx) => {
      const done = idx < current;
      const active = idx === current;
      const circleBg = done || active ? color : '#e2e8f0';
      const circleColor = done || active ? '#fff' : '#94a3b8';
      const textColor = done || active ? '#0f172a' : '#94a3b8';
      const mark = done ? '✓' : String(idx + 1);
      const connector =
        idx < labels.length - 1
          ? `<div style="flex:1;height:2px;margin:0 4px 18px;background:${idx < current ? color : '#e2e8f0'};"></div>`
          : '';
      return `
        <div style="display:flex;align-items:flex-start;flex:1;min-width:0;">
          <div style="display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0;flex:1;">
            <div style="width:22px;height:22px;border-radius:999px;background:${circleBg};color:${circleColor};font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;">${mark}</div>
            <span style="font-size:10px;font-weight:${active ? 700 : 500};color:${textColor};text-align:center;line-height:1.25;">${esc(label)}</span>
          </div>
          ${connector}
        </div>`;
    })
    .join('');

  return `<div style="margin-top:10px;max-width:360px;"><div style="display:flex;align-items:flex-start;width:100%;">${nodes}</div></div>`;
}

type PublicDocPayload = {
  variant: 'invoice' | 'receipt';
  invoice: {
    number: string;
    type: string;
    date: Date | string;
    dueDate: Date | string;
    subtotal: unknown;
    discount: unknown;
    taxAmount: unknown;
    total: unknown;
    currency?: string | null;
    status: string;
    paymentStatus?: string | null;
    notes?: string | null;
    contact: {
      name: string;
      taxId?: string | null;
      crNumber?: string | null;
      address?: string | null;
      city?: string | null;
      phone?: string | null;
    };
    items: Array<{
      description: string;
      quantity: unknown;
      unitPrice: unknown;
      discount: unknown;
      taxAmount: unknown;
      total: unknown;
    }>;
  };
  company: {
    name?: string | null;
    address?: string | null;
    city?: string | null;
    phone?: string | null;
    vatNumber?: string | null;
    crNumber?: string | null;
    currency?: string | null;
    logo?: string | null;
    documentColor?: string | null;
  };
  template?: { headerText?: string | null; footerText?: string | null } | null;
};

export function renderPublicDocumentHtml(payload: PublicDocPayload): string {
  const { invoice, company, variant, template } = payload;
  const isReceipt = variant === 'receipt';
  const color = (company.documentColor || '#059669').toUpperCase();
  const currency = (invoice.currency || company.currency || 'OMR').toUpperCase();
  const isSales = ['SALES', 'QUOTATION', 'CREDIT_NOTE'].includes(invoice.type);
  const docTitle = isReceipt
    ? 'إيصال سداد'
    : invoice.type === 'QUOTATION'
      ? 'عرض سعر'
      : invoice.type === 'CREDIT_NOTE'
        ? 'إشعار دائن'
        : 'فاتورة';

  const workflowHtml =
    !isReceipt && (invoice.type === 'SALES' || invoice.type === 'QUOTATION')
      ? buildWorkflowHtml(
          invoice.type,
          invoice.status,
          invoice.paymentStatus || undefined,
          color,
        )
      : '';

  const companyMeta = [
    [company.address, company.city].filter(Boolean).join('، '),
    company.phone,
    company.vatNumber ? `الرقم الضريبي: ${company.vatNumber}` : '',
    company.crNumber ? `السجل التجاري: ${company.crNumber}` : '',
  ]
    .filter(Boolean)
    .map((line) => `<p style="font-size:11px;color:#475569;margin-top:2px;">${esc(line)}</p>`)
    .join('');

  const itemsHtml = invoice.items
    .map(
      (item) => `
      <tr>
        <td>${esc(item.description)}</td>
        <td>${esc(Number(item.quantity))}</td>
        <td>${money(Number(item.unitPrice), currency)}</td>
        <td>${money(Number(item.discount), currency)}</td>
        <td>${money(Number(item.taxAmount), currency)}</td>
        <td>${money(Number(item.total), currency)}</td>
      </tr>`,
    )
    .join('');

  const contactBits = [
    invoice.contact.address,
    invoice.contact.city,
    invoice.contact.phone,
    invoice.contact.taxId ? `الرقم الضريبي: ${invoice.contact.taxId}` : '',
    invoice.contact.crNumber ? `س.ت: ${invoice.contact.crNumber}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(docTitle)} ${esc(invoice.number)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 20px; color: #0f172a; background: #f1f5f9; direction: rtl; }
    .sheet { max-width: 820px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(15,23,42,.08); }
    .actions { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px; }
    .actions button { border:0; border-radius:8px; padding:10px 14px; font-weight:700; font-size:14px; cursor:pointer; }
    .print-btn { background:${color}; color:#fff; }
    .close-hint { background:#e2e8f0; color:#334155; }
    .header { display:flex; justify-content:space-between; gap:16px; border-bottom:2px solid ${color}; padding-bottom:12px; margin-bottom:14px; }
    .company { font-size:18px; font-weight:800; color:${color}; }
    table { width:100%; border-collapse:collapse; margin:14px 0; font-size:12px; }
    th { background:${color}; color:#fff; padding:8px; text-align:right; }
    td { padding:8px; border-bottom:1px solid #e2e8f0; }
    .totals { margin-right:auto; width:240px; font-size:12px; }
    .totals div { display:flex; justify-content:space-between; padding:4px 0; }
    .grand { font-weight:800; font-size:14px; border-top:2px solid ${color}; padding-top:6px !important; }
    .footer { margin-top:18px; text-align:center; font-size:10px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:10px; white-space:pre-wrap; }
    @media print {
      body { background:#fff; padding:0; }
      .actions { display:none !important; }
      .sheet { box-shadow:none; border-radius:0; max-width:none; padding:12px; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="actions">
      <button class="print-btn" type="button" onclick="window.print()">تحميل / طباعة الفاتورة</button>
      <button class="close-hint" type="button" onclick="window.print()">احفظ كـ PDF من قائمة الطباعة</button>
    </div>
    ${
      isReceipt
        ? `<div style="margin-bottom:12px;padding:8px 12px;border:1px solid ${color};background:#ecfdf5;border-radius:8px;">
            <p style="font-size:13px;font-weight:700;color:${color};">إيصال سداد</p>
            <p style="font-size:11px;color:#047857;">تم استلام المبلغ بالكامل</p>
          </div>`
        : ''
    }
    <div class="header">
      <div style="display:flex;gap:12px;align-items:flex-start;min-width:0;flex:1;">
        ${
          company.logo
            ? `<img src="${esc(company.logo)}" alt="" style="max-height:52px;max-width:140px;object-fit:contain;" />`
            : ''
        }
        <div style="min-width:0;">
          <div class="company">${esc(company.name || 'Hisaby')}</div>
          ${workflowHtml}
          ${companyMeta}
        </div>
      </div>
      <div style="text-align:left;font-size:12px;color:#334155;line-height:1.5;flex-shrink:0;">
        <p style="font-size:15px;font-weight:800;color:#0f172a;margin-bottom:6px;">${esc(docTitle)}</p>
        <p><strong>الرقم:</strong> ${esc(invoice.number)}</p>
        <p><strong>التاريخ:</strong> ${formatDate(invoice.date)}</p>
        ${!isReceipt ? `<p><strong>الاستحقاق:</strong> ${formatDate(invoice.dueDate)}</p>` : ''}
        <p><strong>العملة:</strong> ${esc(currency)}</p>
      </div>
    </div>
    ${
      template?.headerText
        ? `<div style="margin-bottom:10px;font-size:10px;color:#64748b;white-space:pre-wrap;">${esc(template.headerText)}</div>`
        : ''
    }
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;margin-bottom:12px;">
      <span style="font-size:10px;color:#94a3b8;">${isSales ? 'العميل' : 'المورد'}</span>
      <div style="font-weight:700;font-size:13px;">${esc(invoice.contact.name)}</div>
      ${contactBits ? `<p style="font-size:11px;color:#64748b;margin-top:4px;">${esc(contactBits)}</p>` : ''}
    </div>
    <table>
      <thead>
        <tr>
          <th>الوصف</th><th>الكمية</th><th>السعر</th><th>الخصم</th><th>الضريبة</th><th>الإجمالي</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div class="totals">
      <div><span>المجموع الفرعي</span><span>${money(Number(invoice.subtotal), currency)}</span></div>
      <div><span>الضريبة</span><span>${money(Number(invoice.taxAmount), currency)}</span></div>
      <div><span>الخصم</span><span>${money(Number(invoice.discount), currency)}</span></div>
      <div class="grand"><span>الإجمالي</span><span>${money(Number(invoice.total), currency)}</span></div>
    </div>
    ${
      invoice.notes
        ? `<div style="margin-top:16px;padding:10px;background:#f8fafc;border-radius:8px;font-size:12px;"><strong>ملاحظات:</strong> ${esc(invoice.notes)}</div>`
        : ''
    }
    <div class="footer">${esc(template?.footerText || 'تم التحقق من صحة المستند عبر Hisaby')}</div>
  </div>
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () {
        try { window.print(); } catch (e) {}
      }, 600);
    });
  </script>
</body>
</html>`;
}
