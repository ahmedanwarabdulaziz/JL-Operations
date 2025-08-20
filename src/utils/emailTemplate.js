export const generateOrderEmailTemplate = (orderData) => {
  const {
    personalInfo,
    orderDetails,
    furnitureData,
    paymentData
  } = orderData;

  const customerFirstName = personalInfo.customerName?.split(' ')[0] || 'Customer';
  const billNo = orderDetails.billInvoice;
  const furnitureItemsArray = furnitureData.groups || [];
  const currentYear = new Date().getFullYear();
  
  // Business constants (you can move these to a config file)
  const YOUR_BUSINESS_NAME = 'JL Upholstery';
  const YOUR_PAYMENT_EMAIL = 'jl@jlupholstery.com';
  const YOUR_BUSINESS_EMAIL_SIGNATURE = 'JL Upholstery Team';

  const formatCurrency = (amount) => {
    return parseFloat(amount || 0).toFixed(2);
  };

  const generateFurnitureItemsHTML = () => {
    if (!furnitureItemsArray || furnitureItemsArray.length === 0) {
      return '<p>No specific furniture items were detailed for this quote.</p>';
    }

    return furnitureItemsArray.map((item, index) => {
      let labourText = '';
      if (item.labourWork && parseFloat(item.labourWork) > 0) {
        labourText = `Labour work for the ${item.furnitureType || 'item'} costs <strong>$${formatCurrency(item.labourWork)}</strong>`;
        if (item.labourNote && String(item.labourNote).trim() !== "") {
          let cleanLabourNote = String(item.labourNote).replace(/[()]/g, '').trim();
          if (cleanLabourNote) {
            labourText += ` for ${cleanLabourNote}`;
          }
        }
        labourText += `.`;
      }

      let materialOutput = '';
      if (item.materialCode || (item.materialPrice && parseFloat(item.materialPrice) > 0) || (item.quantity && parseFloat(item.quantity) > 0)) {
        materialOutput = `Material code you chose for your ${item.furnitureType || 'item'} is `;
        if (item.materialCode && String(item.materialCode).trim() !== "") {
          materialOutput += `(<strong>${String(item.materialCode).trim()}</strong>)`;
        } else {
          materialOutput += `(not specified)`;
        }
        if (item.materialPrice && parseFloat(item.materialPrice) > 0) {
          materialOutput += ` costs <strong>$${formatCurrency(item.materialPrice)}/yard</strong> (+Tax)`;
        }
        if (item.quantity && parseFloat(item.quantity) > 0) {
          materialOutput += ((item.materialPrice && parseFloat(item.materialPrice) > 0) || (item.materialCode && String(item.materialCode).trim() !== "")) ?
            ` and we need <strong>${parseFloat(item.quantity).toFixed(2)}</strong> yards.` :
            ` We need <strong>${parseFloat(item.quantity).toFixed(2)}</strong> yards.`;
        } else if (materialOutput.includes("costs") || (item.materialCode && String(item.materialCode).trim() !== "")) {
          materialOutput += `.`;
        }
      }

      let foamHtmlOutput = '';
      if ((item.foamPrice && parseFloat(item.foamPrice) > 0) || (item.foamThickness && String(item.foamThickness).trim() !== "")) {
        foamHtmlOutput = `Regarding the foam, it will be `;
        foamHtmlOutput += `high density commercial grade with one layer of Batting`;
        if (item.foamThickness && String(item.foamThickness).trim() !== "") {
          foamHtmlOutput += ` <strong>${item.foamThickness}"</strong> thickness`;
        }
        if (item.foamPrice && parseFloat(item.foamPrice) > 0) {
          foamHtmlOutput += `, costing <strong>$${formatCurrency(item.foamPrice)}</strong> (+Tax)`;
        }
        if (item.foamNote && String(item.foamNote).trim() !== "") {
          foamHtmlOutput += `, ${String(item.foamNote).trim()}`;
        }
        foamHtmlOutput += `.`;
      }

      let paintingHtmlOutput = '';
      if ((item.paintingLabour && parseFloat(item.paintingLabour) > 0) || (item.paintingNote && String(item.paintingNote).trim() !== "")) {
        paintingHtmlOutput = `For the painting service`;
        if (item.paintingLabour && parseFloat(item.paintingLabour) > 0) {
          paintingHtmlOutput += `, the labour cost will be <strong>$${formatCurrency(item.paintingLabour)}</strong> (+Tax)`;
        }
        if (item.paintingNote && String(item.paintingNote).trim() !== "") {
          paintingHtmlOutput += `, ${String(item.paintingNote).trim()}`;
        }
        paintingHtmlOutput += `.`;
      }

      return `
        <div class="furniture-item">
          <h4>For your ${item.furnitureType || ('Item ' + (index + 1))}</h4>
          ${labourText ? `<p>${labourText}</p>` : ''}
          ${materialOutput ? `<p>${materialOutput}</p>` : ''}
          ${foamHtmlOutput ? `<p>${foamHtmlOutput}</p>` : ''}
          ${paintingHtmlOutput ? `<p>${paintingHtmlOutput}</p>` : ''}
          ${item.customerNote && String(item.customerNote).trim() !== "" ? 
            `<p><strong>Note for this item:</strong> ${item.customerNote}</p>` : ''}
        </div>
      `;
    }).join('');
  };

  const pickupDeliverySection = paymentData.pickupDeliveryEnabled && paymentData.pickupDeliveryCost && parseFloat(paymentData.pickupDeliveryCost) > 0 ?
    `<p class="pickup-delivery-section">
      <img src="https://fonts.gstatic.com/s/i/googlematerialicons/drive_file_move/v10/gm_grey-24dp/1x/gm_drive_file_move_gm_grey_24dp.png" alt="🚚" />
      Pickup &amp; delivery each way from your location costs <strong>$${formatCurrency(paymentData.pickupDeliveryCost)}</strong>.
    </p>` : '';

  const depositSection = paymentData.deposit && parseFloat(paymentData.deposit) > 0 ?
    `<li>We will need a deposit of <strong>$${formatCurrency(paymentData.deposit)}</strong>, you may send it to ${YOUR_PAYMENT_EMAIL}.</li>` : '';

  const etransferSection = billNo ?
    `<div class="etransfer-details" style="margin-top: 15px; padding-top:10px; border-top: 1px solid #444;"> 
      <p style="font-size: 14px; color: #DAA520; margin-bottom: 10px; font-weight:bold;">E-Transfer Security Question & Answer:</p>
      <div style="padding-left: 15px;">
        <p style="font-size: 14px; line-height: 1.6; margin-bottom: 5px;">
          <span style="color: #DAA520; font-weight: 600; display: inline-block; width: 80px;">Question:</span> What is the invoice number?
        </p>
        <p style="font-size: 14px; line-height: 1.6;">
          <span style="color: #DAA520; font-weight: 600; display: inline-block; width: 80px;">Answer:</span> ${billNo}
        </p>
      </div>
    </div>` : '';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your ${YOUR_BUSINESS_NAME} Service Quote</title>
        <style>
            body { margin:0; padding:0; -webkit-font-smoothing:antialiased; width:100%!important; background-color:#f4f4f4; font-family:Arial,'Helvetica Neue',Helvetica,sans-serif; font-size:16px; line-height:1.6; color:#333; }
            .email-wrapper { width:100%; background-color:#f4f4f4; padding:20px 0; }
            .email-container { width:90%; max-width:680px; margin:0 auto; background-color:#fff; border-radius:8px; overflow:hidden; border:1px solid #ddd; }
            .email-header { background-color:#1A1A1A; color:#DAA520; padding:25px; text-align:center; }
            .email-header h1 { margin:0; font-size:24px; font-weight:bold; }
            .email-body { padding:25px 30px; }
            .greeting { font-size:17px; margin-bottom:20px; }
            .quote-summary-header { display:table; width:100%; margin-bottom:20px; padding-bottom:10px; border-bottom:1px solid #eee; }
            .quote-summary-title { display:table-cell; font-size:18px; font-weight:bold; color:#DAA520; vertical-align:middle; }
            .invoice-number { display:table-cell; font-size:16px; color:#DAA520; text-align:right; vertical-align:middle; font-weight:bold; }
            .furniture-item { background-color: #f9f9f9; border: 1px solid #e9e9e9; padding: 15px; margin-bottom: 15px; border-radius: 5px; }
            .furniture-item h4 { font-size: 16px; color: #1A1A1A; margin-top: 0; margin-bottom: 12px; font-weight:bold; }
            .furniture-item p { margin-bottom: 8px; font-size: 14px; color: #444; line-height: 1.5; }
            .furniture-item strong { color: #222; font-weight: 600; }
            .pickup-delivery-section { margin-top: 20px; margin-bottom:20px; font-size: 14px; text-align: left; padding:10px; background-color:#f9f9f9; border-left: 3px solid #DAA520; }
            .pickup-delivery-section img { width: 18px; height: 18px; vertical-align: middle; margin-right: 8px; display:inline-block; }
            .payment-section { background-color:#2C2C2C; color:#F0F0F0; padding:20px 30px; margin-top:25px; border-radius: 5px; }
            .payment-section h2 { font-size:18px; color:#DAA520; margin-top:0; margin-bottom:15px; text-align:left; border-bottom: 1px solid #444; padding-bottom: 8px;}
            .payment-section ul { list-style:none; padding:0; margin:0; }
            .payment-section ul li { margin-bottom:10px; font-size:14px; }
            .payment-section strong { color: #DAA520; font-weight:600; }
            .highlight-note { background-color:#fffaf0; border-left:4px solid #DAA520; padding:15px; margin:25px 0; font-size:14px; color: #555;}
            .highlight-note strong { color: #333; }
            .closing { margin-top:25px; font-size:14px; }
            .signature { font-weight:bold; color:#1A1A1A; font-size:14px; }
            .email-footer { background-color:#333; color:#bbb; padding:20px; text-align:center; font-size:12px; border-top: 1px solid #444;}
        </style>
    </head>
    <body>
        <div class="email-wrapper">
            <div class="email-container">
                <div class="email-header"><h1>Upholstery Service Quote</h1></div>
                <div class="email-body">
                    <p class="greeting">Dear ${customerFirstName},</p>
                    <p>It was a pleasure discussing your upholstery needs. Please find the detailed quote below based on our conversation.</p>
                    
                    <div class="quote-summary-header">
                        <span class="quote-summary-title">Quote Summary</span>
                        ${billNo ? `<span class="invoice-number">Invoice #${billNo}</span>` : ''}
                    </div>

                    ${generateFurnitureItemsHTML()}

                    ${pickupDeliverySection}
                    
                    <div class="payment-section">
                        <h2>Payment & Confirmation</h2>
                        <ul>
                            ${depositSection}
                        </ul>
                        ${etransferSection}
                    </div>
                    <div class="highlight-note">
                        <p><strong>Confirmation of this quote via deposit payment allows us to secure your selected materials.</strong></p>
                        <p><strong>Scheduling Note:</strong> New fabric orders are consolidated and placed every Monday morning.</p>
                    </div>
                    <p class="closing">We look forward to transforming your piece! ✨ Please let us know if you have any questions. ❓</p>
                    <p>Sincerely,</p>
                    <p class="signature">${YOUR_BUSINESS_EMAIL_SIGNATURE}</p>
                </div>
                <div class="email-footer">
                    <p>&copy; ${currentYear} ${YOUR_BUSINESS_NAME}. All Rights Reserved.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
  `;
}; 