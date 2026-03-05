export const generateDepositEmailTemplate = (orderData) => {
  const {
    personalInfo,
    orderDetails,
    paymentData
  } = orderData;

  // Extract customer name (first name only)
  const customerFirstName = personalInfo?.customerName?.split(' ')[0] || 'Customer';
  
  // Extract invoice number
  const billNo = orderDetails?.billInvoice || 'N/A';
  
  // Extract deposit amount
  const depositAmount = parseFloat(paymentData?.deposit) || 0;
  const formattedDeposit = depositAmount.toFixed(2);
  
  // Business constants
  const currentYear = new Date().getFullYear();
  const YOUR_BUSINESS_EMAIL_SIGNATURE = 'JL Team';
  const YOUR_BUSINESS_NAME = 'JL Upholstery';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Deposit Confirmation</title>
    <style>
        body { margin:0; padding:0; -webkit-font-smoothing:antialiased; width:100%!important; background-color:#f4f4f4; font-family:Arial,'Helvetica Neue',Helvetica,sans-serif; font-size:16px; line-height:1.6; color:#333; }
        .email-wrapper { width:100%; background-color:#f4f4f4; padding:20px 0; }
        .email-container { width:90%; max-width:680px; margin:0 auto; background-color:#fff; border-radius:8px; overflow:hidden; border:1px solid #ddd; }
        .email-header { background-color:#1A1A1A; color:#DAA520; padding:25px; text-align:center; }
        .email-header h1 { margin:0; font-size:28px; font-weight:bold; }
        .email-body { padding:25px 30px; }
        .email-body p { margin:0 0 10px 0; }
        .greeting { font-size:17px; margin-bottom:10px; }
        .deposit-details { background-color:#f9f9f9; border:1px solid #e0e0e0; padding:20px; margin:15px 0; border-radius:5px; }
        .deposit-amount { color:#333333; font-weight:bold; }
        .invoice-number { font-weight:bold; color:#333333; }
        .highlight-note { background-color:#fffaf0; border-left:4px solid #DAA520; padding:15px; margin:25px 0; font-size:14px; color: #555; }
        .highlight-note strong { color: #333; }
        .closing { margin-top:15px; margin-bottom:0; }
        .signature { font-weight:bold; color:#1A1A1A; margin-top:10px; }
        .email-footer { background-color:#2C2C2C; color:#ccc; padding:20px; text-align:center; font-size:12px; }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-container">
            <div class="email-header">
                <h1>Deposit Received</h1>
            </div>
            <div class="email-body">
                <p class="greeting">Dear ${customerFirstName},</p>
                <p>Thank you for your payment. We're pleased to confirm that your deposit has been received.</p>
                <div class="deposit-details">
                    <p>We received your deposit with amount <span class="deposit-amount">$${formattedDeposit}</span> for invoice # <span class="invoice-number">${billNo}</span>.</p>
                </div>
                <p>We've updated your order status and will keep you informed of your project's progress. If you have any questions, please don't hesitate to contact us.</p>
                <div class="highlight-note">
                    <p style="margin-top:0;"><strong>Pickup &amp; storage</strong></p>
                    <p>Once your order is complete, we will notify you that your piece(s) are ready for pickup. We kindly request that items be collected within 7 days of notification, as our workshop space is limited and we need to accommodate incoming projects.</p>
                    <p>If pickup is delayed beyond 7 days, a storage fee of $5 per day may apply from the 8th day onward. Please contact us in advance if you need additional time — we are happy to work with you when possible.</p>
                    <p style="margin-bottom:0;">Thank you for your understanding and cooperation.</p>
                </div>
                <p class="closing">Thank you for choosing us for your upholstery needs.</p>
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

/**
 * Deposit reminder email (fabric order) – same visual style as other JL emails.
 * orderData: { orderDetails, paymentData or paymentDetails, personalInfo (optional), contactPerson/corporateCustomer (optional) }
 */
export const generateDepositReminderEmailTemplate = (orderData) => {
  const orderDetails = orderData?.orderDetails || {};
  const paymentData = orderData?.paymentData || orderData?.paymentDetails || {};
  const billNo = orderDetails?.billInvoice || 'N/A';
  const depositAmount = parseFloat(paymentData?.deposit) || 0;
  const formattedAmount = depositAmount > 0 ? depositAmount.toFixed(2) : '0.00';
  const customerFirstName = (orderData?.personalInfo?.customerName || orderData?.contactPerson?.name || 'Customer').split(' ')[0];
  const currentYear = new Date().getFullYear();
  const YOUR_BUSINESS_EMAIL_SIGNATURE = 'JL Team';
  const YOUR_BUSINESS_NAME = 'JL Upholstery';
  const YOUR_PAYMENT_EMAIL = 'jl@jlupholstery.com';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Deposit Reminder</title>
    <style>
        body { margin:0; padding:0; -webkit-font-smoothing:antialiased; width:100%!important; background-color:#f4f4f4; font-family:Arial,'Helvetica Neue',Helvetica,sans-serif; font-size:16px; line-height:1.6; color:#333; }
        .email-wrapper { width:100%; background-color:#f4f4f4; padding:20px 0; }
        .email-container { width:90%; max-width:680px; margin:0 auto; background-color:#fff; border-radius:8px; overflow:hidden; border:1px solid #ddd; }
        .email-header { background-color:#1A1A1A; color:#DAA520; padding:25px; text-align:center; }
        .email-header h1 { margin:0; font-size:28px; font-weight:bold; }
        .email-body { padding:25px 30px; }
        .email-body p { margin:0 0 10px 0; }
        .deposit-details { background-color:#f9f9f9; border:1px solid #e0e0e0; padding:20px; margin:15px 0; border-radius:5px; }
        .deposit-amount { color:#333333; font-weight:bold; }
        .payment-section { background-color:#2C2C2C; color:#F0F0F0; padding:20px 30px; margin-top:25px; border-radius: 5px; }
        .payment-section h2 { font-size:18px; color:#DAA520; margin-top:0; margin-bottom:15px; text-align:left; border-bottom: 1px solid #444; padding-bottom: 8px;}
        .payment-section ul { list-style:none; padding:0; margin:0; }
        .payment-section ul li { margin-bottom:10px; font-size:14px; }
        .payment-section strong { color: #DAA520; font-weight:600; }
        .closing { margin-top:15px; margin-bottom:0; }
        .signature { font-weight:bold; color:#1A1A1A; margin-top:10px; }
        .email-footer { background-color:#2C2C2C; color:#ccc; padding:20px; text-align:center; font-size:12px; }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-container">
            <div class="email-header">
                <h1>Deposit Reminder – Fabric Order Confirmation</h1>
            </div>
            <div class="email-body">
                <p>Dear ${customerFirstName},</p>
                <p>Thank you again for confirming your fabric selection — we're excited to bring your project to life.</p>
                <p>This is a gentle reminder regarding the deposit of <span class="deposit-amount">$${formattedAmount}</span>, which is required to secure and place your fabric order. Please note that we submit all fabric orders every Monday.</p>
                <p>Once the deposit is received, we'll confirm your fabric order and ensure everything stays on track for your timeline.</p>
                <div class="payment-section">
                    <h2>Payment & Confirmation</h2>
                    <ul>
                        <li>We will need a deposit of <strong>$${formattedAmount}</strong>, you may send it to ${YOUR_PAYMENT_EMAIL}.</li>
                    </ul>
                    <div class="etransfer-details" style="margin-top: 15px; padding-top:10px; border-top: 1px solid #444;">
                        <p style="font-size: 14px; color: #DAA520; margin-bottom: 10px; font-weight:bold;">E-Transfer Security Question & Answer:</p>
                        <div style="padding-left: 15px;">
                            <p style="font-size: 14px; line-height: 1.6; margin-bottom: 5px;">
                                <span style="color: #DAA520; font-weight: 600; display: inline-block; width: 80px;">Question:</span> What is the invoice number?
                            </p>
                            <p style="font-size: 14px; line-height: 1.6;">
                                <span style="color: #DAA520; font-weight: 600; display: inline-block; width: 80px;">Answer:</span> ${billNo}
                            </p>
                        </div>
                    </div>
                </div>
                <p class="closing">Please don't hesitate to reach out if you have any questions or if you'd like us to resend the payment details.</p>
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

/**
 * Pickup ready email – same visual style as other JL emails.
 * pickupOptions: { customerName (full or first), pickupDate, timeStart, timeEnd, remainingBalanceFormatted, paymentMethod ('cash'|'etransfer'), etransferEmail }
 */
export const generatePickupReadyEmailTemplate = (pickupOptions) => {
  const customerFirstName = (pickupOptions?.customerName || 'Customer').split(' ')[0];
  const pickupDate = pickupOptions?.pickupDate || '[Insert Date]';
  const timeStart = pickupOptions?.timeStart || '12:00 PM';
  const timeEnd = pickupOptions?.timeEnd || '2:00 PM';
  const remainingBalanceFormatted = pickupOptions?.remainingBalanceFormatted || '$0.00';
  const paymentMethod = pickupOptions?.paymentMethod || 'etransfer';
  const etransferEmail = pickupOptions?.etransferEmail || 'jl@jlupholstery.com';
  const currentYear = new Date().getFullYear();
  const YOUR_BUSINESS_EMAIL_SIGNATURE = 'JL Team';
  const YOUR_BUSINESS_NAME = 'JL Upholstery';

  const paymentText = paymentMethod === 'cash'
    ? `The remaining balance is <span class="balance-amount">${remainingBalanceFormatted}</span>, which can be paid by <strong>Cash</strong>.`
    : `The remaining balance is <span class="balance-amount">${remainingBalanceFormatted}</span>, which can be paid via <strong>e-transfer</strong> to <strong>${etransferEmail}</strong>.`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Furniture Is Ready for Pickup</title>
    <style>
        body { margin:0; padding:0; -webkit-font-smoothing:antialiased; width:100%!important; background-color:#f4f4f4; font-family:Arial,'Helvetica Neue',Helvetica,sans-serif; font-size:16px; line-height:1.6; color:#333; }
        .email-wrapper { width:100%; background-color:#f4f4f4; padding:20px 0; }
        .email-container { width:90%; max-width:680px; margin:0 auto; background-color:#fff; border-radius:8px; overflow:hidden; border:1px solid #ddd; }
        .email-header { background-color:#1A1A1A; color:#DAA520; padding:25px; text-align:center; }
        .email-header h1 { margin:0; font-size:28px; font-weight:bold; }
        .email-body { padding:25px 30px; }
        .email-body p { margin:0 0 10px 0; }
        .pickup-details { background-color:#f9f9f9; border:1px solid #e0e0e0; padding:20px; margin:15px 0; border-radius:5px; }
        .balance-amount { color:#333333; font-weight:bold; }
        .closing { margin-top:15px; margin-bottom:0; }
        .signature { font-weight:bold; color:#1A1A1A; margin-top:10px; }
        .email-footer { background-color:#2C2C2C; color:#ccc; padding:20px; text-align:center; font-size:12px; }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-container">
            <div class="email-header">
                <h1>Your Furniture Is Ready for Pickup</h1>
            </div>
            <div class="email-body">
                <p>Dear ${customerFirstName},</p>
                <p>Great news — your furniture is ready for pickup!</p>
                <p>You can collect it on <strong>${pickupDate}</strong>, between <strong>${timeStart}</strong> and <strong>${timeEnd}</strong>.</p>
                <div class="pickup-details">
                    <p>${paymentText}</p>
                </div>
                <p>Kindly note that payment is required at the time of pickup.</p>
                <p class="closing">We're excited to hand over your furniture and hope you enjoy it for years to come.</p>
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