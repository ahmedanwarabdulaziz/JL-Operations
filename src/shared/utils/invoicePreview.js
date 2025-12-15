import { calculatePickupDeliveryCost, getOrderCostBreakdown, calculateOrderTax } from './orderCalculations';
import { getMaterialCompanyTaxRate } from './materialTaxRates';
import { formatDate, formatDateOnly } from '../../utils/dateUtils';
import { formatCorporateInvoiceForInvoice } from '../../utils/invoiceNumberUtils';

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

/**
 * Calculate totals for corporate invoices
 */
export const calculateCorporateInvoiceTotals = (order, creditCardFeeEnabled = false) => {
  if (!order) return { subtotal: 0, delivery: 0, tax: 0, creditCardFee: 0, total: 0 };

  // Calculate subtotal from furniture groups (without delivery)
  const furnitureGroups = order.furnitureGroups || [];
  let subtotal = 0;

  furnitureGroups.forEach(group => {
    // Add material cost
    if (group.materialPrice && group.materialQnty && parseFloat(group.materialPrice) > 0) {
      const price = parseFloat(group.materialPrice) || 0;
      const quantity = parseFloat(group.materialQnty) || 0;
      subtotal += price * quantity;
    }
    
    // Add labour cost
    if (group.labourPrice && group.labourQnty && parseFloat(group.labourPrice) > 0) {
      const price = parseFloat(group.labourPrice) || 0;
      const quantity = parseFloat(group.labourQnty) || 0;
      subtotal += price * quantity;
    }
    
    // Add foam cost if enabled
    if (group.foamEnabled && group.foamPrice && group.foamQnty && parseFloat(group.foamPrice) > 0) {
      const price = parseFloat(group.foamPrice) || 0;
      const quantity = parseFloat(group.foamQnty) || 0;
      subtotal += price * quantity;
    }
    
    // Add painting cost if enabled
    if (group.paintingEnabled && group.paintingLabour && group.paintingQnty && parseFloat(group.paintingLabour) > 0) {
      const price = parseFloat(group.paintingLabour) || 0;
      const quantity = parseFloat(group.paintingQnty) || 0;
      subtotal += price * quantity;
    }
  });

  // Calculate pickup/delivery cost separately
  const paymentDetails = order.paymentDetails || {};
  let delivery = 0;
  if (paymentDetails.pickupDeliveryEnabled) {
    const pickupCost = parseFloat(paymentDetails.pickupDeliveryCost) || 0;
    const serviceType = paymentDetails.pickupDeliveryServiceType;
    if (serviceType === 'both') {
      delivery = pickupCost * 2;
    } else {
      delivery = pickupCost;
    }
  }

  // Calculate tax (13% on subtotal + delivery)
  const tax = (subtotal + delivery) * 0.13;

  // Calculate credit card fee (2.5% on subtotal + delivery + tax) if enabled
  const creditCardFee = creditCardFeeEnabled ? (subtotal + delivery + tax) * 0.025 : 0;

  // Calculate total (subtotal + delivery + tax + credit card fee)
  const total = subtotal + delivery + tax + creditCardFee;

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    delivery: parseFloat(delivery.toFixed(2)),
    tax: parseFloat(tax.toFixed(2)),
    creditCardFee: parseFloat(creditCardFee.toFixed(2)),
    total: parseFloat(total.toFixed(2))
  };
};

/**
 * Generate HTML for corporate invoices (unified style)
 */
export const generateCorporateInvoiceHTML = (order, totals, creditCardFeeEnabled = false) => {
  const invoiceDate = order.createdAt 
    ? (order.createdAt.toDate ? formatDateOnly(order.createdAt.toDate()) : formatDateOnly(order.createdAt))
    : formatDateOnly(new Date());
  
  const invoiceNumber = formatCorporateInvoiceForInvoice(
    order.invoiceNumber || order.orderDetails?.billInvoice
  ) || 'N/A';

  // Generate items table rows
  const generateItemsRows = () => {
    const furnitureGroups = order.furnitureGroups || [];
    let rows = '';
    
    if (furnitureGroups.length === 0) {
      rows = `
        <tr>
          <td colspan="4" style="
            padding: 16px;
            text-align: center;
            color: #666666;
            font-style: italic;
            border: none;
          ">
            No items found
          </td>
        </tr>
      `;
    } else {
      furnitureGroups.forEach((group, groupIndex) => {
        // Add furniture group header
        rows += `
          <tr style="background-color: #f8f9fa;">
            <td colspan="4" style="
              font-weight: bold;
              color: #274290;
              padding: 10px 16px;
              text-transform: uppercase;
              border: none;
              border-bottom: 1px solid #ddd;
            ">
              ${group.furnitureType || `Furniture Group ${groupIndex + 1}`}
            </td>
          </tr>
        `;
        
        // Create items from furniture group data
        const groupItems = [];
        
        // Add individual furniture items if they exist
        if (group.furniture && Array.isArray(group.furniture)) {
          group.furniture.forEach((furniture, furnitureIndex) => {
            if (furniture.price && furniture.quantity) {
              groupItems.push({
                name: furniture.name || `Furniture Item ${furnitureIndex + 1}`,
                price: parseFloat(furniture.price) || 0,
                quantity: parseFloat(furniture.quantity) || 0
              });
            }
          });
        }
        
        // Add material item
        if (group.materialPrice && group.materialQnty && parseFloat(group.materialPrice) > 0) {
          groupItems.push({
            name: `${group.materialCompany || 'Material'} - ${group.materialCode || 'Code'}`,
            price: parseFloat(group.materialPrice) || 0,
            quantity: parseFloat(group.materialQnty) || 0
          });
        }
        
        // Add labour item
        if (group.labourPrice && group.labourQnty && parseFloat(group.labourPrice) > 0) {
          groupItems.push({
            name: `Labour Work${group.labourNote ? ` - ${group.labourNote}` : ''}`,
            price: parseFloat(group.labourPrice) || 0,
            quantity: parseFloat(group.labourQnty) || 0
          });
        }
        
        // Add foam item if enabled
        if (group.foamEnabled && group.foamPrice && group.foamQnty && parseFloat(group.foamPrice) > 0) {
          groupItems.push({
            name: `Foam${group.foamNote ? ` - ${group.foamNote}` : ''}`,
            price: parseFloat(group.foamPrice) || 0,
            quantity: parseFloat(group.foamQnty) || 0
          });
        }
        
        // Add painting item if enabled
        if (group.paintingEnabled && group.paintingLabour && group.paintingQnty && parseFloat(group.paintingLabour) > 0) {
          groupItems.push({
            name: `Painting${group.paintingNote ? ` - ${group.paintingNote}` : ''}`,
            price: parseFloat(group.paintingLabour) || 0,
            quantity: parseFloat(group.paintingQnty) || 0
          });
        }
        
        // Add all items from this group
        groupItems.forEach(item => {
          const total = item.price * item.quantity;
          rows += `
            <tr>
              <td style="padding: 8px 16px; border: none; border-bottom: 1px solid #ddd; color: black;">${item.name}</td>
              <td style="padding: 8px 16px; text-align: center; border: none; border-bottom: 1px solid #ddd; color: black;">$${item.price.toFixed(2)}</td>
              <td style="padding: 8px 16px; text-align: center; border: none; border-bottom: 1px solid #ddd; color: black;">${item.quantity}</td>
              <td style="padding: 8px 16px; text-align: right; border: none; border-bottom: 1px solid #ddd; color: black;">$${total.toFixed(2)}</td>
            </tr>
          `;
        });
      });
    }
    
    return rows;
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Corporate Invoice - ${invoiceNumber}</title>
      <style>
        @media print {
          @page {
            margin: 0.5in 0.6in 0.5in 0.5in;
            size: A4;
          }
          
          body {
            -webkit-print-color-adjust: exact;
            color-adjust: exact;
            print-color-adjust: exact;
            background: white !important;
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
          }
          
          .invoice-header {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            background: white !important;
          }
          
          .invoice-header img {
            max-height: 100px !important;
            width: 100% !important;
            object-fit: contain !important;
            display: block !important;
          }
          
          .invoice-footer {
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }
          
          .invoice-footer img {
            max-height: 100px !important;
            width: 100% !important;
            object-fit: contain !important;
            display: block !important;
          }
          
          .invoice-container {
            padding-top: 110px !important;
            padding-bottom: 110px !important;
            padding-left: 15px !important;
            padding-right: 20px !important;
            box-sizing: border-box !important;
          }
          
          .terms-header {
            background-color: #cc820d !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .terms-header * {
            color: white !important;
          }
          
          .paid-box {
            background-color: #4CAF50 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .balance-box {
            background-color: #cc820d !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .total-box {
            background-color: #2c2c2c !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .paid-box *, .balance-box *, .total-box * {
            color: white !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="invoice-container" style="width: 100%; height: 100%; display: flex; flex-direction: column;">
        <!-- Professional Invoice Header - Image Only -->
        <div class="invoice-header" style="
          margin-bottom: 16px;
          position: relative;
          overflow: hidden;
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
        ">
          <img 
            src="/assets/images/invoice-headers/Invoice Header.png" 
            alt="Invoice Header" 
            style="
              width: 100%;
              height: auto;
              max-width: 100%;
              object-fit: contain;
              display: block;
            "
          />
        </div>

        <!-- Invoice Information Row - Left: Customer Info, Right: Date/Invoice/Tax -->
        <div style="
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        ">
          <!-- Left Side - Customer Information -->
          <div style="flex: 1; margin-right: 16px;">
            <h6 style="
              font-weight: bold;
              color: black;
              margin-bottom: 8px;
              font-size: 18px;
            ">
              Invoice to:
            </h6>
            <h5 style="font-weight: bold; margin-bottom: 8px; color: black; font-size: 20px;">
              ${order.corporateCustomer?.corporateName || 'N/A'}
            </h5>
            ${order.contactPerson?.name ? `
            <div style="display: flex; align-items: center; margin-bottom: 4px;">
              <span style="margin-right: 8px; font-size: 16px; color: #666666;">👤</span>
              <span style="color: black;">${order.contactPerson.name}</span>
            </div>
            ` : ''}
            ${order.contactPerson?.phone ? `
            <div style="display: flex; align-items: center; margin-bottom: 4px;">
              <span style="margin-right: 8px; font-size: 16px; color: #666666;">📞</span>
              <span style="color: black;">${order.contactPerson.phone}</span>
            </div>
            ` : ''}
            ${order.contactPerson?.email ? `
            <div style="display: flex; align-items: center; margin-bottom: 4px;">
              <span style="margin-right: 8px; font-size: 16px; color: #666666;">✉️</span>
              <span style="color: black;">${order.contactPerson.email}</span>
            </div>
            ` : ''}
            ${order.corporateCustomer?.address ? `
            <div style="display: flex; align-items: flex-start; margin-bottom: 4px;">
              <span style="margin-right: 8px; font-size: 16px; color: #666666; margin-top: 2px;">📍</span>
              <span style="white-space: pre-line; color: black;">${order.corporateCustomer.address}</span>
            </div>
            ` : ''}
          </div>

          <!-- Right Side - Invoice Details -->
          <div style="min-width: 250px; flex-shrink: 0;">
            <div style="color: black; margin-bottom: 4px;">
              <strong>Date:</strong> ${invoiceDate}
            </div>
            <div style="color: black; margin-bottom: 4px;">
              <strong>Invoice #</strong> ${invoiceNumber}
            </div>
            <div style="color: black; margin-bottom: 4px;">
              <strong>Tax #</strong> 798633319-RT0001
            </div>
          </div>
        </div>

        <!-- Items Table and Totals - Professional Layout -->
        <div style="margin-bottom: 16px;">
          <div style="
            border: 2px solid #333333;
            border-radius: 0;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          ">
            <table style="
              width: 100%;
              border-collapse: collapse;
              background-color: white;
              table-layout: fixed;
            ">
              <thead>
                <tr style="background-color: #f5f5f5;">
                  <th style="
                    width: 66.67%;
                    padding: 8px 16px;
                    text-align: left;
                    font-weight: bold;
                    color: #333333;
                    background-color: #f5f5f5;
                    border: none;
                    border-bottom: 2px solid #333333;
                    border-right: 1px solid #ddd;
                    font-size: 14px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                  ">Description</th>
                  <th style="
                    width: 11.11%;
                    padding: 8px 16px;
                    text-align: center;
                    font-weight: bold;
                    color: #333333;
                    background-color: #f5f5f5;
                    border: none;
                    border-bottom: 2px solid #333333;
                    border-right: 1px solid #ddd;
                    font-size: 14px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                  ">Price</th>
                  <th style="
                    width: 11.11%;
                    padding: 8px 16px;
                    text-align: center;
                    font-weight: bold;
                    color: #333333;
                    background-color: #f5f5f5;
                    border: none;
                    border-bottom: 2px solid #333333;
                    border-right: 1px solid #ddd;
                    font-size: 14px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                  ">Unit</th>
                  <th style="
                    width: 11.11%;
                    padding: 8px 16px;
                    text-align: right;
                    font-weight: bold;
                    color: #333333;
                    background-color: #f5f5f5;
                    border: none;
                    border-bottom: 2px solid #333333;
                    font-size: 14px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                  ">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${generateItemsRows()}
              </tbody>
            </table>
          </div>
        </div>
        
        <!-- Terms and Conditions + Totals Section - Side by side -->
        <div style="margin-top: 4px;">
          <div style="display: flex; width: 100%; gap: 16px;">
            <!-- Left Side - Terms and Conditions -->
            <div style="flex: 0 0 50%; max-width: 50%;">
              <div class="terms-header" style="
                background-color: #cc820d;
                color: white;
                padding: 8px;
                margin-bottom: 8px;
              ">
                <h6 style="
                  font-weight: bold;
                  color: white;
                  text-align: center;
                  text-transform: uppercase;
                  margin: 0;
                  font-size: 16px;
                ">
                  Terms and Conditions
                </h6>
              </div>
              
              <div style="display: flex; flex-direction: column; gap: 8px;">
                <div>
                  <p style="font-weight: bold; color: black; margin: 0 0 4px 0; font-size: 14px;">
                    Payment by Cheque: <span style="font-size: 10px; font-weight: normal; color: #666;">(for corporates only)</span>
                  </p>
                  <p style="color: black; margin: 0; font-size: 12px;">
                    Mail to: 322 Etheridge ave, Milton, ON CANADA L9E 1H7
                  </p>
                </div>
                
                <div>
                  <p style="font-weight: bold; color: black; margin: 0 0 4px 0; font-size: 14px;">
                    Payment by direct deposit:
                  </p>
                  <p style="color: black; margin: 0; font-size: 12px;">
                    Transit Number: 07232
                  </p>
                  <p style="color: black; margin: 0; font-size: 12px;">
                    Institution Number: 010
                  </p>
                  <p style="color: black; margin: 0; font-size: 12px;">
                    Account Number: 1090712
                  </p>
                </div>
                
                <div>
                  <p style="font-weight: bold; color: black; margin: 0 0 4px 0; font-size: 14px;">
                    Payment by e-transfer:
                  </p>
                  <p style="color: black; margin: 0; font-size: 12px;">
                    JL@JLupholstery.com
                  </p>
                </div>
              </div>
            </div>
            
            <!-- Right Side - Totals Section -->
            <div style="flex: 1; display: flex; justify-content: flex-end; align-items: flex-start;">
              <div style="min-width: 300px; max-width: 400px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                  <span style="color: black; font-size: 14px;">Subtotal:</span>
                  <span style="font-weight: bold; color: black; font-size: 14px;">
                    $${totals.subtotal.toFixed(2)}
                  </span>
                </div>
                
                ${totals.delivery > 0 ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                  <span style="color: black; font-size: 14px;">Delivery:</span>
                  <span style="font-weight: bold; color: black; font-size: 14px;">
                    $${totals.delivery.toFixed(2)}
                  </span>
                </div>
                ` : ''}
                
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                  <span style="color: black; font-size: 14px;">Tax Rate:</span>
                  <span style="font-weight: bold; color: black; font-size: 14px;">
                    13%
                  </span>
                </div>
                
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                  <span style="color: black; font-size: 14px;">Tax Due:</span>
                  <span style="font-weight: bold; color: black; font-size: 14px;">
                    $${totals.tax.toFixed(2)}
                  </span>
                </div>
                
                ${creditCardFeeEnabled ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                  <span style="color: black; font-size: 14px;">Credit Card Fee:</span>
                  <span style="font-weight: bold; color: black; font-size: 14px;">
                    $${totals.creditCardFee.toFixed(2)}
                  </span>
                </div>
                ` : ''}
                
                <div class="paid-box" style="
                  display: flex;
                  justify-content: space-between;
                  margin-bottom: 4px;
                  background-color: #4CAF50;
                  color: white;
                  padding: 8px;
                  border-radius: 4px;
                ">
                  <span style="font-weight: bold; color: white; font-size: 14px;">Paid:</span>
                  <span style="font-weight: bold; color: white; font-size: 14px;">
                    $0.00
                  </span>
                </div>
                
                <div class="balance-box" style="
                  display: flex;
                  justify-content: space-between;
                  margin-bottom: 4px;
                  background-color: #cc820d;
                  color: white;
                  padding: 8px;
                  border-radius: 4px;
                ">
                  <span style="font-weight: bold; color: white; font-size: 14px;">Balance:</span>
                  <span style="font-weight: bold; color: white; font-size: 14px;">
                    $${totals.total.toFixed(2)}
                  </span>
                </div>
                
                <div class="total-box" style="
                  display: flex;
                  justify-content: space-between;
                  background-color: #2c2c2c;
                  color: white;
                  padding: 8px;
                  border-radius: 4px;
                ">
                  <span style="font-weight: bold; color: white; font-size: 14px;">Total:</span>
                  <span style="font-weight: bold; color: white; font-size: 14px;">
                    $${totals.total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Invoice Footer Image -->
        <div class="invoice-footer" style="
          margin-top: 24px;
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
        ">
          <img 
            src="/assets/images/invoice-headers/invoice Footer.png" 
            alt="Invoice Footer" 
            style="
              width: 100%;
              height: auto;
              max-width: 100%;
              object-fit: contain;
              display: block;
            "
          />
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate HTML for regular customer invoices (unified style)
 * This is the existing generateInvoicePreviewHtml renamed for clarity
 */
export const generateCustomerInvoiceHTML = (order, totals, materialTaxRates = {}) => {
  return generateInvoicePreviewHtml(order, totals, materialTaxRates);
};

/**
 * Legacy function name - kept for backward compatibility
 * @deprecated Use generateCustomerInvoiceHTML instead
 */
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
                  <div class="detail-item">Date: ${formatDateOnly(order.createdAt)}</div>
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

/**
 * Detect if an order is a corporate invoice
 */
export const isCorporateInvoice = (order) => {
  return order.orderType === 'corporate' || 
         order.corporateCustomer || 
         order.furnitureGroups !== undefined;
};

/**
 * Open invoice preview in a new window (for print)
 * Automatically detects invoice type and uses the appropriate generator
 */
export const openInvoicePreview = (order, options = {}) => {
  const { materialTaxRates = {}, creditCardFeeEnabled = false } = options;

  if (!order) {
    throw new Error('Order is required for invoice preview.');
  }

  const printWindow = window.open('', '_blank', 'width=800,height=600');

  if (!printWindow) {
    throw new Error('Unable to open preview window. Pop-up might be blocked.');
  }

  let htmlContent;
  if (isCorporateInvoice(order)) {
    const totals = calculateCorporateInvoiceTotals(order, creditCardFeeEnabled);
    htmlContent = generateCorporateInvoiceHTML(order, totals, creditCardFeeEnabled);
  } else {
    const totals = calculateInvoiceTotals(order, materialTaxRates);
    htmlContent = generateCustomerInvoiceHTML(order, totals, materialTaxRates);
  }

  printWindow.document.write(htmlContent);
  printWindow.document.close();

  printWindow.onload = () => {
    printWindow.print();
  };

  return true;
};




