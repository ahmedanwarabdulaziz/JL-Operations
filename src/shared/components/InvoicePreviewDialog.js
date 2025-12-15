import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  IconButton,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  Receipt as ReceiptIcon,
  Print as PrintIcon,
} from '@mui/icons-material';
import {
  isCorporateInvoice,
  calculateCorporateInvoiceTotals,
  calculateInvoiceTotals,
  generateCorporateInvoiceHTML,
  generateCustomerInvoiceHTML,
} from '../utils/invoicePreview';

/**
 * Unified Invoice Preview Dialog Component
 * Automatically detects invoice type (corporate vs regular) and displays accordingly
 * 
 * @param {Object} props
 * @param {boolean} props.open - Whether dialog is open
 * @param {Function} props.onClose - Callback when dialog closes
 * @param {Object} props.order - Order/invoice object
 * @param {Object} props.materialTaxRates - Material tax rates (for regular invoices)
 * @param {boolean} props.creditCardFeeEnabled - Whether credit card fee is enabled (for corporate invoices)
 * @param {string} props.title - Optional custom title
 */
const InvoicePreviewDialog = ({
  open,
  onClose,
  order,
  materialTaxRates = {},
  creditCardFeeEnabled = false,
  title,
}) => {
  if (!order) {
    return null;
  }

  const isCorporate = isCorporateInvoice(order);
  
  // Calculate totals based on invoice type
  const totals = isCorporate
    ? calculateCorporateInvoiceTotals(order, creditCardFeeEnabled)
    : calculateInvoiceTotals(order, materialTaxRates);

  // Generate HTML based on invoice type
  const htmlContent = isCorporate
    ? generateCorporateInvoiceHTML(order, totals, creditCardFeeEnabled)
    : generateCustomerInvoiceHTML(order, totals, materialTaxRates);

  // Get invoice number for title
  const invoiceNumber = isCorporate
    ? (order.invoiceNumber || order.orderDetails?.billInvoice || 'N/A')
    : (order.orderDetails?.billInvoice || 'N/A');

  const dialogTitle = title || `Invoice Preview - ${invoiceNumber}`;

  // Handle print
  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      console.error('Unable to open print window. Pop-up might be blocked.');
      return;
    }

    printWindow.document.write(htmlContent);
    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.print();
    };
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#3a3a3a',
          border: '2px solid #b98f33',
          borderRadius: '10px',
          color: '#ffffff',
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle
        sx={{
          background: 'linear-gradient(135deg, #b98f33 0%, #8b6b1f 100%)',
          color: '#000000',
          fontWeight: 'bold',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #b98f33',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <ReceiptIcon sx={{ color: '#000000', fontSize: 28 }} />
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#000000' }}>
            {dialogTitle}
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          sx={{
            color: '#000000',
            '&:hover': {
              backgroundColor: 'rgba(0,0,0,0.1)',
            },
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent
        sx={{
          p: 2,
          backgroundColor: '#3a3a3a',
          overflow: 'auto',
          display: 'flex',
          justifyContent: 'center',
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#2a2a2a',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#b98f33',
            borderRadius: '4px',
          },
        }}
      >
        <Box
          sx={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            overflow: 'hidden',
            width: '100%',
          }}
        >
          <iframe
            srcDoc={htmlContent}
            style={{
              width: '100%',
              minHeight: '600px',
              border: 'none',
              display: 'block',
            }}
            title="Invoice Preview"
          />
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          backgroundColor: '#3a3a3a',
          borderTop: '1px solid #b98f33',
          padding: '12px 24px',
        }}
      >
        <Button
          onClick={handlePrint}
          variant="contained"
          startIcon={<PrintIcon />}
          sx={{
            backgroundColor: '#b98f33',
            color: '#000000',
            fontWeight: 'bold',
            '&:hover': {
              backgroundColor: '#8b6b1f',
            },
          }}
        >
          Print
        </Button>
        <Button
          onClick={onClose}
          variant="outlined"
          sx={{
            borderColor: '#b98f33',
            color: '#ffffff',
            '&:hover': {
              borderColor: '#8b6b1f',
              backgroundColor: 'rgba(185, 143, 51, 0.1)',
            },
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InvoicePreviewDialog;

