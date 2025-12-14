import { calculatePickupDeliveryCost, getOrderCostBreakdown, calculateOrderTax } from './orderCalculations';
import { getMaterialCompanyTaxRate } from './materialTaxRates';
import { formatDate } from '../../utils/dateUtils';

export const calculateInvoiceTotals = (order, materialTaxRates = {}) => {
  if (!order) {
    return {
      itemsSubtotal: 0,
      taxAmount: 0,
      pickupDeliveryCost: 0,
      grandTotal: 0,
      amountPaid: 0,
      balanceDue: 0,
      jlGrandTotal: 0,
      extraExpensesTotal: 0,
      jlSubtotalBeforeTax: 0
    };
  }

  const taxAmount = calculateOrderTax(order);

  const pickupDeliveryCost = order.paymentData?.pickupDeliveryEnabled
    ? calculatePickupDeliveryCost(
        parseFloat(order.paymentData.pickupDeliveryCost) || 0,
        order.paymentData.pickupDeliveryServiceType || 'both'
      )
    : 0;

  const breakdown = getOrderCostBreakdown(order);
  const itemsSubtotal = breakdown.material + breakdown.labour + breakdown.foam + breakdown.painting;

  const grandTotal = itemsSubtotal + taxAmount + pickupDeliveryCost;
  const amountPaid = parseFloat(order.paymentData?.amountPaid) || 0;
  const balanceDue = grandTotal - amountPaid;

  let jlSubtotalBeforeTax = 0;
  let jlGrandTotal = 0;

  const groups = order.furnitureData?.groups || [];

  groups.forEach((group) => {
    if (group.materialJLPrice && parseFloat(group.materialJLPrice) > 0) {
      const qty = parseFloat(group.materialJLQnty) || 0;
      const price = parseFloat(group.materialJLPrice) || 0;
      const subtotal = qty * price;
      jlSubtotalBeforeTax += subtotal;

      const taxRate = getMaterialCompanyTaxRate(group.materialCompany, materialTaxRates);
      jlGrandTotal += subtotal + subtotal * taxRate;
    }

    if (group.foamJLPrice && parseFloat(group.foamJLPrice) > 0) {
      const qty = parseFloat(group.foamQnty) || 1;
      const price = parseFloat(group.foamJLPrice) || 0;
      const subtotal = qty * price;
      jlSubtotalBeforeTax += subtotal;
      jlGrandTotal += subtotal;
    }

    if (group.otherExpenses && parseFloat(group.otherExpenses) > 0) {
      const expense = parseFloat(group.otherExpenses) || 0;
      jlSubtotalBeforeTax += expense;
      jlGrandTotal += expense;
    }

    if (group.shipping && parseFloat(group.shipping) > 0) {
      const shipping = parseFloat(group.shipping) || 0;
      jlSubtotalBeforeTax += shipping;
      jlGrandTotal += shipping;
    }
  });

  if (order.extraExpenses && order.extraExpenses.length > 0) {
    order.extraExpenses.forEach((exp) => {
      const expenseTotal = parseFloat(exp.total) || 0;
      jlSubtotalBeforeTax += expenseTotal;
      jlGrandTotal += expenseTotal;
    });
  }

  return {
    itemsSubtotal,
    taxAmount,
    pickupDeliveryCost,
    grandTotal,
    amountPaid,
    balanceDue,
    jlGrandTotal,
    extraExpensesTotal: 0,
    jlSubtotalBeforeTax
  };
};

export const generateInvoicePreviewHtml = (order, totals, materialTaxRates = {}) => {
  const customerInfo = order.personalInfo || {};
  const orderDetails = order.orderDetails || {};
  const paymentData = order.paymentData || {};
  const furnitureGroups = order.furnitureData?.groups || [];
  const extraExpenses = order.extraExpenses || [];

  const customerNotes = furnitureGroups
    .filter((group) => group.customerNote && group.customerNote.trim() !== '')
    .map(
      (group) =>
        `<strong>${group.furnitureType || 'Furniture Group'}:</strong><br/>${group.customerNote}`
    )
    .join('<br/><br/>');

  const itemsRows = furnitureGroups
    .map((group) => {
      const labourRow =
        group.labourPrice && parseFloat(group.labourPrice) > 0
          ? `
            <tr>
              <td>Labour ${group.labourNote || ''}</td>
              <td style="text-align: right">$${(parseFloat(group.labourPrice) || 0).toFixed(2)}</td>
              <td style="text-align: right">${group.labourQnty || 1}</td>
              <td style="text-align: right">$${(
                (parseFloat(group.labourPrice) || 0) * (parseFloat(group.labourQnty) || 1)
              ).toFixed(2)}</td>
            </tr>
          `
          : '';

      const materialRow =
        group.materialPrice && parseFloat(group.materialPrice) > 0
          ? `
            <tr>
              <td>Material ${group.materialCompany || ''} ${
              group.materialCode ? `(${group.materialCode})` : ''
            }</td>
              <td style="text-align: right">$${(parseFloat(group.materialPrice) || 0).toFixed(2)}</td>
              <td style="text-align: right">${group.materialQnty || 1}</td>
              <td style="text-align: right">$${(
                (parseFloat(group.materialPrice) || 0) * (parseFloat(group.materialQnty) || 0)
              ).toFixed(2)}</td>
            </tr>
          `
          : '';

      const foamRow =
        group.foamPrice && parseFloat(group.foamPrice) > 0
          ? `
            <tr>
              <td>Foam${group.foamThickness ? ` (${group.foamThickness}")` : ''}${
              group.foamNote ? ` - ${group.foamNote}` : ''
            }</td>
              <td style="text-align: right">$${(parseFloat(group.foamPrice) || 0).toFixed(2)}</td>
              <td style="text-align: right">${group.foamQnty || 1}</td>
              <td style="text-align: right">$${(
                (parseFloat(group.foamPrice) || 0) * (parseFloat(group.foamQnty) || 1)
              ).toFixed(2)}</td>
            </tr>
          `
          : '';

      const paintingRow =
        group.paintingLabour && parseFloat(group.paintingLabour) > 0
          ? `
            <tr>
              <td>Painting${group.paintingNote ? ` - ${group.paintingNote}` : ''}</td>
              <td style="text-align: right">$${(parseFloat(group.paintingLabour) || 0).toFixed(2)}</td>
              <td style="text-align: right">${group.paintingQnty || 1}</td>
              <td style="text-align: right">$${(
                (parseFloat(group.paintingLabour) || 0) * (parseFloat(group.paintingQnty) || 1)
              ).toFixed(2)}</td>
            </tr>
          `
          : '';

      const hasRows = labourRow || materialRow || foamRow || paintingRow;

      if (!hasRows) {
        return '';
      }

      return `
        <tr class="furniture-group-header">
          <td colspan="4">${group.furnitureType || 'Furniture Group'}</td>
        </tr>
        ${labourRow}
        ${materialRow}
        ${foamRow}
        ${paintingRow}
      `;
    })
    .join('');

  const jlRows = furnitureGroups
    .map((group) => {
      const hasMaterial = group.materialJLPrice && parseFloat(group.materialJLPrice) > 0;
      const hasFoam = group.foamJLPrice && parseFloat(group.foamJLPrice) > 0;
      const hasRecords = hasMaterial || hasFoam;

      if (!hasRecords) {
        return '';
      }

      const materialRow = hasMaterial
        ? `
          <tr>
            <td>Material (${group.materialCode || 'N/A'})</td>
            <td style="text-align: right">${(parseFloat(group.materialJLQnty) || 0).toFixed(2)}</td>
            <td style="text-align: right">$${(parseFloat(group.materialJLPrice) || 0).toFixed(2)}</td>
            <td style="text-align: right">$${(
              (parseFloat(group.materialJLQnty) || 0) * (parseFloat(group.materialJLPrice) || 0)
            ).toFixed(2)}</td>
            <td style="text-align: right">$${(
              ((parseFloat(group.materialJLQnty) || 0) * (parseFloat(group.materialJLPrice) || 0)) *
              getMaterialCompanyTaxRate(group.materialCompany, materialTaxRates)
            ).toFixed(2)}</td>
            <td style="text-align: right">$${(
              ((parseFloat(group.materialJLQnty) || 0) * (parseFloat(group.materialJLPrice) || 0)) * 1.13
            ).toFixed(2)}</td>
          </tr>
        `
        : '';

      const foamRow = hasFoam
        ? `
          <tr>
            <td>Foam</td>
            <td style="text-align: right">${(parseFloat(group.foamQnty) || 1).toFixed(2)}</td>
            <td style="text-align: right">$${(parseFloat(group.foamJLPrice) || 0).toFixed(2)}</td>
            <td style="text-align: right">$${(
              (parseFloat(group.foamQnty) || 1) * (parseFloat(group.foamJLPrice) || 0)
            ).toFixed(2)}</td>
            <td style="text-align: right">$0.00</td>
            <td style="text-align: right">$${(
              (parseFloat(group.foamQnty) || 1) * (parseFloat(group.foamJLPrice) || 0)
            ).toFixed(2)}</td>
          </tr>
        `
        : '';

      return `
        <tr class="furniture-group-header">
          <td colspan="6">${group.furnitureType || 'Furniture Group'}</td>
        </tr>
        ${materialRow}
        ${foamRow}
      `;
    })
    .join('');

  const extraExpensesRows =
    extraExpenses.length > 0
      ? `
        <tr class="furniture-group-header">
          <td colspan="6">Extra Expenses</td>
        </tr>
        ${extraExpenses
          .map(
            (expense) => {
              // Handle different quantity field names (quantity, qty, unit)
              const quantity = parseFloat(expense.quantity) || parseFloat(expense.qty) || parseFloat(expense.unit) || 1;
              const price = parseFloat(expense.price) || 0;
              const subtotal = quantity * price;
              const taxRate = parseFloat(expense.taxRate) || 0.13;
              const tax = subtotal * taxRate;
              const total = parseFloat(expense.total) || (subtotal + tax);
              
              return `
              <tr>
                <td>${expense.description || 'Extra Expense'}</td>
                <td style="text-align: right">${quantity.toFixed(2)}</td>
                <td style="text-align: right">$${price.toFixed(2)}</td>
                <td style="text-align: right">$${subtotal.toFixed(2)}</td>
                <td style="text-align: right">$${tax.toFixed(2)}</td>
                <td style="text-align: right">$${total.toFixed(2)}</td>
              </tr>
            `;
            }
          )
          .join('')}
      `
      : '';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Invoice - ${orderDetails.billInvoice || 'N/A'}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 12px;
            background-color: #ffffff;
            color: #000000;
          }
          .invoice-container {
            max-width: 210mm;
            margin: 0 auto;
            padding: 12px;
            background-color: #ffffff;
            color: #000000;
            min-height: 297mm;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid #ccc;
          }
          .customer-info {
            flex: 1;
          }
          .customer-name {
            font-size: 1.5rem;
            font-weight: bold;
            color: #000000;
            margin-bottom: 8px;
          }
          .customer-details {
            display: flex;
            gap: 16px;
          }
          .detail-column {
            flex: 1;
          }
          .detail-item {
            font-size: 0.8rem;
            color: #666666;
            margin-bottom: 4px;
          }
          .invoice-number {
            text-align: right;
          }
          .invoice-number h1 {
            font-size: 1.5rem;
            font-weight: bold;
            color: #000000;
            margin: 0 0 4px 0;
          }
          .logo {
            height: 45px;
            width: auto;
            margin-bottom: 8px;
          }
          .section-title {
            font-size: 1.1rem;
            font-weight: bold;
            color: #000000;
            margin-bottom: 8px;
          }
          .table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
          }
          .table th {
            background-color: #f0f0f0;
            border: 1px solid #ccc;
            padding: 4px 8px;
            font-size: 0.8rem;
            font-weight: bold;
            text-align: left;
          }
          .table td {
            border: 1px solid #ccc;
            padding: 2px 4px;
            font-size: 0.8rem;
            text-align: left;
          }
          .furniture-group-header {
            background-color: #f8f8f8;
            font-weight: bold;
            font-size: 0.8rem;
            padding: 2px 4px;
          }
          .notes-totals-section {
            display: flex;
            gap: 16px;
            margin-bottom: 16px;
          }
          .notes-section {
            flex: 1;
          }
          .notes-header {
            background-color: #f8f8f8;
            padding: 4px 8px;
            border: 1px solid #ccc;
            border-bottom: none;
            font-weight: bold;
            font-size: 0.8rem;
          }
          .notes-content {
            border: 1px solid #ccc;
            min-height: 60px;
            padding: 12px;
            font-size: 0.8rem;
            background-color: #ffffff;
          }
          .notes-item {
            margin-bottom: 8px;
          }
          .totals-section {
            width: 300px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
            font-size: 0.8rem;
          }
          .total-row.grand-total {
            border-top: 1px solid #ccc;
            padding-top: 4px;
            margin-bottom: 8px;
            font-weight: bold;
            font-size: 0.9rem;
          }
          .total-row.balance-due {
            background-color: #fff3cd;
            padding: 4px;
            border-radius: 4px;
            font-weight: bold;
            font-size: 0.9rem;
          }
          .jl-section {
            margin-top: 16px;
          }
          .jl-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
          }
          .jl-table th {
            background-color: #f0f0f0;
            border: 1px solid #ccc;
            padding: 4px 8px;
            font-size: 0.8rem;
            font-weight: bold;
            text-align: left;
          }
          .jl-table td {
            border: 1px solid #ccc;
            padding: 2px 4px;
            font-size: 0.8rem;
            text-align: left;
          }
          .jl-totals {
            width: 300px;
            background-color: #f0f0f0;
            border: 1px solid #999;
            padding: 12px;
            margin-top: 8px;
            margin-left: auto;
          }
          .jl-total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
            font-size: 0.8rem;
          }
          .jl-total-row.grand-total {
            border-top: 1px solid #ccc;
            padding-top: 4px;
            margin-bottom: 8px;
            font-weight: bold;
            font-size: 0.9rem;
          }
          .footer {
            margin-top: 12px;
            padding-top: 8px;
            text-align: center;
            font-size: 0.8rem;
            color: #666666;
            border-top: 1px solid #ccc;
          }
          @media print {
            body { margin: 0; padding: 0; }
            .invoice-container { box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="header">
            <div class="customer-info">
              <div class="customer-name">${customerInfo.customerName || 'N/A'}</div>
              <div class="customer-details">
                <div class="detail-column">
                  <div class="detail-item">Email: ${customerInfo.email || 'N/A'}</div>
                  <div class="detail-item">Phone: ${customerInfo.phone || 'N/A'}</div>
                  <div class="detail-item">Platform: ${orderDetails.platform || 'N/A'}</div>
                </div>
                <div class="detail-column">
                  <div class="detail-item">Date: ${formatDate(order.createdAt)}</div>
                  <div class="detail-item">Address: ${customerInfo.address || 'N/A'}</div>
                </div>
              </div>
            </div>
            <div class="invoice-number">
              <img src="/assets/images/logo-001.png" alt="JL Upholstery Logo" class="logo">
              <h1>${orderDetails.billInvoice || 'N/A'}</h1>
            </div>
          </div>

          <div class="section-title">Items & Services</div>
          <table class="table">
            <thead>
              <tr>
                <th style="flex: 3">Description</th>
                <th style="flex: 1; text-align: right">Price</th>
                <th style="flex: 1; text-align: right">Qty</th>
                <th style="flex: 1; text-align: right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <div class="notes-totals-section">
            <div class="notes-section">
              <div class="notes-item">
                <div class="notes-header">Internal Notes</div>
                <div class="notes-content">${paymentData.notes || ''}</div>
              </div>
              <div class="notes-item">
                <div class="notes-header">Customer's Item Notes</div>
                <div class="notes-content">${customerNotes}</div>
              </div>
            </div>
            <div class="totals-section">
              <div class="total-row">
                <span>Items Subtotal:</span>
                <span>$${totals.itemsSubtotal.toFixed(2)}</span>
              </div>
              <div class="total-row">
                <span>Tax (13% on M&F):</span>
                <span>$${totals.taxAmount.toFixed(2)}</span>
              </div>
              <div class="total-row">
                <span>Pickup & Delivery:</span>
                <span>$${totals.pickupDeliveryCost.toFixed(2)}</span>
              </div>
              <div class="total-row grand-total">
                <span>Grand Total:</span>
                <span>$${totals.grandTotal.toFixed(2)}</span>
              </div>
              <div class="total-row">
                <span>Deposit Paid:</span>
                <span>-$${totals.amountPaid.toFixed(2)}</span>
              </div>
              <div class="total-row balance-due">
                <span>Balance Due:</span>
                <span>$${totals.balanceDue.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div class="jl-section">
            <div class="section-title">Internal JL Cost Analysis</div>
            <table class="jl-table">
              <thead>
                <tr>
                  <th>Component</th>
                  <th style="text-align: right">Qty</th>
                  <th style="text-align: right">Unit Price</th>
                  <th style="text-align: right">Subtotal</th>
                  <th style="text-align: right">TAX</th>
                  <th style="text-align: right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                ${jlRows}
                ${extraExpensesRows}
              </tbody>
            </table>
            <div class="jl-totals">
              <div class="jl-total-row">
                <span>Subtotal (Before Tax):</span>
                <span>$${totals.jlSubtotalBeforeTax.toFixed(2)}</span>
              </div>
              <div class="jl-total-row grand-total">
                <span>Grand Total (JL Internal Cost):</span>
                <span>$${totals.jlGrandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div class="footer">
            Payment is due upon receipt.
          </div>
        </div>
      </body>
    </html>
  `;
};

export const openInvoicePreview = (order, options = {}) => {
  const { materialTaxRates = {} } = options;

  if (!order) {
    throw new Error('Order is required for invoice preview.');
  }

  const totals = calculateInvoiceTotals(order, materialTaxRates);
  const printWindow = window.open('', '_blank', 'width=800,height=600');

  if (!printWindow) {
    throw new Error('Unable to open preview window. Pop-up might be blocked.');
  }

  const htmlContent = generateInvoicePreviewHtml(order, totals, materialTaxRates);
  printWindow.document.write(htmlContent);
  printWindow.document.close();

  printWindow.onload = () => {
    printWindow.print();
  };

  return true;
};




