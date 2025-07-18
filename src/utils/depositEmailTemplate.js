export const generateDepositEmailTemplate = (data) => {
  const {
    customerSalutationName = 'Customer',
    formattedDeposit = '0',
    billNo = 'N/A',
    currentYear = new Date().getFullYear(),
    YOUR_BUSINESS_EMAIL_SIGNATURE = 'ANWAR JL Upholstery',
    YOUR_BUSINESS_NAME = 'ANWAR JL Upholstery'
  } = data;

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
        .greeting { font-size:17px; margin-bottom:20px; }
        .deposit-details { background-color:#f9f9f9; border:1px solid #e0e0e0; padding:20px; margin:25px 0; border-radius:5px; }
        .deposit-amount { color:#333333; font-weight:bold; }
        .invoice-number { font-weight:bold; color:#333333; }
        .closing { margin-top:25px; }
        .signature { font-weight:bold; color:#1A1A1A; }
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
                <p class="greeting">Dear ${customerSalutationName},</p>
                <p>Thank you for your payment. We're pleased to confirm that your deposit has been received.</p>
                <div class="deposit-details">
                    <p>We received your deposit with amount <span class="deposit-amount">$${formattedDeposit}</span> for invoice # <span class="invoice-number">${billNo}</span>.</p>
                </div>
                <p>We've updated your order status and will keep you informed of your project's progress. If you have any questions, please don't hesitate to contact us.</p>
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