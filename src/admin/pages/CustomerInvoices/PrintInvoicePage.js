import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  IconButton,
  CircularProgress
} from '@mui/material';
import {
  Print as PrintIcon,
  ArrowBack as ArrowBackIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useNotification } from '../../../components/Common/NotificationSystem';
import { buttonStyles } from '../../../styles/buttonStyles';
import { formatDate } from '../../../utils/dateUtils';

const PrintInvoicePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError } = useNotification();
  
  const [invoiceData, setInvoiceData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (location.state?.invoiceData) {
      setInvoiceData(location.state.invoiceData);
    } else {
      // Redirect back if no invoice data
      navigate('/admin/customer-invoices');
    }
  }, [location.state, navigate]);

  // Handle print
  const handlePrint = () => {
    window.print();
  };

  // Handle download as PDF (using browser's print to PDF)
  const handleDownloadPDF = () => {
    showSuccess('Use your browser\'s print dialog and select "Save as PDF" to download the invoice as a PDF file.');
    setTimeout(() => {
      window.print();
    }, 1000);
  };

  if (!invoiceData) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  // Company information (you can customize this)
  const companyInfo = {
    name: 'JL Operations',
    logo: 'JL',
    tagline: 'Upholstery',
    fullName: 'JLUPHOLSTERY',
    address: '322 Etheridge ave, Milton, ON CANADA L9E 1H7',
    phone: '(555) 123-4567',
    email: 'JL@JLupholstery.com',
    website: 'JLUPHOLSTERY.COM',
    taxNumber: '798633319-RT0001'
  };

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header - Only visible on screen, hidden when printing */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 3,
        flexWrap: 'wrap',
        gap: 2,
        '@media print': {
          display: 'none'
        }
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton 
            onClick={() => navigate('/admin/customer-invoices')}
            sx={{ color: 'primary.main' }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
              Invoice Print View
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Invoice #{invoiceData.invoiceNumber}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadPDF}
            sx={buttonStyles.cancelButton}
          >
            Download PDF
          </Button>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
            sx={buttonStyles.primaryButton}
          >
            Print Invoice
          </Button>
        </Box>
      </Box>

      {/* Invoice Content */}
      <Paper 
        elevation={3} 
        sx={{ 
          p: 4, 
          maxWidth: '210mm', // A4 width
          mx: 'auto',
          backgroundColor: 'white',
          '@media print': {
            boxShadow: 'none',
            elevation: 0,
            maxWidth: 'none',
            mx: 0,
            p: 3
          },
          '& .MuiTableHead-root': {
            backgroundColor: '#ffffff !important'
          },
          '& .MuiTableCell-head': {
            backgroundColor: '#ffffff !important'
          },
          '& .MuiTableRow-head': {
            backgroundColor: '#ffffff !important'
          }
        }}
      >
        {/* Professional Invoice Header */}
        <Box sx={{ 
          mb: 4,
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Header Background with Diagonal Stripes */}
          <Box sx={{
            backgroundColor: '#2c2c2c',
            position: 'relative',
            p: 3,
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              right: 0,
              width: '60%',
              height: '100%',
              background: 'linear-gradient(45deg, #b98f33 0%, #b98f33 25%, transparent 25%, transparent 50%, #b98f33 50%, #b98f33 75%, transparent 75%, transparent 100%)',
              backgroundSize: '20px 20px',
              opacity: 0.8
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              width: '40%',
              height: '100%',
              background: 'linear-gradient(-45deg, #666 0%, #666 25%, transparent 25%, transparent 50%, #666 50%, #666 75%, transparent 75%, transparent 100%)',
              backgroundSize: '20px 20px',
              opacity: 0.6
            }
          }}>
            <Grid container spacing={3} sx={{ position: 'relative', zIndex: 1 }}>
              <Grid item xs={12} md={6}>
                {/* INVOICE Title */}
                <Typography variant="h2" sx={{ 
                  fontWeight: 'bold', 
                  color: 'white',
                  fontSize: '3rem',
                  letterSpacing: '0.1em',
                  textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
                }}>
                  INVOICE
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                {/* Company Logo and Info */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start' }}>
                  <Box sx={{ textAlign: 'right' }}>
                    {/* Logo */}
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                      <Typography variant="h3" sx={{ 
                        fontWeight: 'bold', 
                        color: '#b98f33',
                        fontSize: '2.5rem',
                        mr: 1,
                        textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
                      }}>
                        {companyInfo.logo}
                      </Typography>
                    </Box>
                    <Typography variant="h6" sx={{ 
                      color: '#b98f33',
                      fontStyle: 'italic',
                      fontSize: '1.2rem',
                      mb: 0.5,
                      textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
                    }}>
                      {companyInfo.tagline}
                    </Typography>
                    <Box sx={{ 
                      backgroundColor: 'white', 
                      px: 2, 
                      py: 0.5, 
                      borderRadius: 1,
                      display: 'inline-block'
                    }}>
                      <Typography variant="body1" sx={{ 
                        fontWeight: 'bold', 
                        color: '#2c2c2c',
                        fontSize: '0.9rem',
                        letterSpacing: '0.05em'
                      }}>
                        {companyInfo.fullName}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Box>

          {/* Invoice Details */}
          <Box sx={{ 
            mt: 3,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start'
          }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body1" sx={{ color: 'black', mb: 0.5 }}>
                Date: {formatDate(invoiceData.createdAt)}
              </Typography>
              <Typography variant="body1" sx={{ color: 'black', mb: 0.5 }}>
                Invoice #: {invoiceData.invoiceNumber}
              </Typography>
              <Typography variant="body1" sx={{ color: 'black', mb: 0.5 }}>
                Tax #: {companyInfo.taxNumber}
              </Typography>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body1" sx={{ color: 'black', mb: 0.5 }}>
                Order Ref: #{invoiceData.originalOrderNumber || invoiceData.originalOrderId}
              </Typography>
              <Typography variant="body1" sx={{ color: 'black', mb: 0.5 }}>
                Phone: {companyInfo.phone}
              </Typography>
              <Typography variant="body1" sx={{ color: 'black' }}>
                Email: {companyInfo.email}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Divider sx={{ mb: 4, borderColor: 'black' }} />

        {/* Customer Information */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ 
            fontWeight: 'bold', 
            color: 'black',
            mb: 2
          }}>
            Invoice to:
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 1, color: 'black' }}>
            {invoiceData.customerInfo.customerName}
          </Typography>
          <Box sx={{ 
            width: '100%', 
            height: '2px', 
            backgroundColor: 'black',
            mb: 2
          }} />
          {invoiceData.customerInfo.email && (
            <Typography variant="body1" sx={{ mb: 0.5, color: 'black' }}>
              {invoiceData.customerInfo.email}
            </Typography>
          )}
          {invoiceData.customerInfo.phone && (
            <Typography variant="body1" sx={{ mb: 0.5, color: 'black' }}>
              {invoiceData.customerInfo.phone}
            </Typography>
          )}
          {invoiceData.customerInfo.address && (
            <Typography variant="body1" sx={{ whiteSpace: 'pre-line', color: 'black' }}>
              {invoiceData.customerInfo.address}
            </Typography>
          )}
        </Box>

        {/* Items Table - Custom HTML Table */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ 
            border: '1px solid #ddd',
            borderRadius: 1,
            overflow: 'hidden'
          }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              backgroundColor: 'white'
            }}>
              <thead style={{ backgroundColor: 'white' }}>
                <tr style={{ backgroundColor: 'white' }}>
                  <th style={{ 
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: 'bold',
                    color: 'black',
                    backgroundColor: 'white',
                    border: 'none',
                    borderBottom: '1px solid #ddd'
                  }}>Description</th>
                  <th style={{ 
                    padding: '12px 16px',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    color: 'black',
                    backgroundColor: 'white',
                    border: 'none',
                    borderBottom: '1px solid #ddd'
                  }}>Price</th>
                  <th style={{ 
                    padding: '12px 16px',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    color: 'black',
                    backgroundColor: 'white',
                    border: 'none',
                    borderBottom: '1px solid #ddd'
                  }}>Unit</th>
                  <th style={{ 
                    padding: '12px 16px',
                    textAlign: 'right',
                    fontWeight: 'bold',
                    color: 'black',
                    backgroundColor: 'white',
                    border: 'none',
                    borderBottom: '1px solid #ddd'
                  }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoiceData.items.map((item, index) => (
                  <tr key={item.id || index} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ 
                      padding: '16px',
                      color: 'black',
                      border: 'none'
                    }}>
                      {item.name}
                    </td>
                    <td style={{ 
                      padding: '16px',
                      textAlign: 'center',
                      color: 'black',
                      border: 'none'
                    }}>
                      ${parseFloat(item.price).toFixed(2)}
                    </td>
                    <td style={{ 
                      padding: '16px',
                      textAlign: 'center',
                      color: 'black',
                      border: 'none'
                    }}>
                      {item.quantity}
                    </td>
                    <td style={{ 
                      padding: '16px',
                      textAlign: 'right',
                      fontWeight: 'bold',
                      color: 'black',
                      border: 'none'
                    }}>
                      ${((parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0)).toFixed(2)}
                    </td>
                  </tr>
                ))}
                {/* Add empty rows to match the design */}
                {Array.from({ length: Math.max(0, 8 - invoiceData.items.length) }).map((_, index) => (
                  <tr key={`empty-${index}`} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '16px', border: 'none' }}></td>
                    <td style={{ padding: '16px', border: 'none' }}></td>
                    <td style={{ padding: '16px', border: 'none' }}></td>
                    <td style={{ 
                      padding: '16px', 
                      textAlign: 'right',
                      color: 'black',
                      border: 'none'
                    }}>
                      $0.00
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        </Box>

        {/* Totals and Payment Information */}
        <Grid container spacing={4} sx={{ mb: 4 }}>
          {/* Totals Section */}
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Box sx={{ minWidth: 250 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body1" sx={{ color: 'black' }}>Subtotal:</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black' }}>
                    ${invoiceData.calculations?.subtotal?.toFixed(2) || '0.00'}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body1" sx={{ color: 'black' }}>
                    Tax Rate :
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black' }}>
                    ${(invoiceData.headerSettings?.taxPercentage || 0) / 100}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body1" sx={{ color: 'black' }}>
                    Tax Due :
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black' }}>
                    ${invoiceData.calculations?.taxAmount?.toFixed(2) || '0.00'}
                  </Typography>
                </Box>
                
                {invoiceData.headerSettings?.creditCardFeeEnabled && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body1" sx={{ color: 'black' }}>
                      Credit Card Fee:
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black' }}>
                      ${invoiceData.calculations?.creditCardFeeAmount?.toFixed(2) || '0.00'}
                    </Typography>
                  </Box>
                )}
                
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  mb: 1,
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  p: 1,
                  borderRadius: 1
                }}>
                  <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'white' }}>
                    Paid:
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'white' }}>
                    $0.00
                  </Typography>
                </Box>
                
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  backgroundColor: '#2c2c2c',
                  color: 'white',
                  p: 1,
                  borderRadius: 1
                }}>
                  <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'white' }}>
                    Total:
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'white' }}>
                    ${invoiceData.calculations?.total?.toFixed(2) || '0.00'}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Grid>

          {/* Signature Section */}
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: 'black', mb: 2 }}>
                  Signature
                </Typography>
                <Box sx={{ 
                  width: 200, 
                  height: 1, 
                  backgroundColor: 'black',
                  mb: 1
                }} />
                <Typography variant="body2" sx={{ color: 'black', fontStyle: 'italic' }}>
                  Ahmed Albaghdadi
                </Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>

        {/* Terms and Conditions */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ 
            backgroundColor: '#f27921',
            color: 'white',
            p: 1,
            mb: 2
          }}>
            <Typography variant="h6" sx={{ 
              fontWeight: 'bold', 
              color: 'white',
              textAlign: 'center',
              textTransform: 'uppercase'
            }}>
              Terms and Conditions
            </Typography>
          </Box>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black', mb: 1 }}>
                Payment by Cheque:
              </Typography>
              <Typography variant="body2" sx={{ color: 'black' }}>
                Mail to: {companyInfo.address}
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black', mb: 1 }}>
                Payment by direct deposit:
              </Typography>
              <Typography variant="body2" sx={{ color: 'black' }}>
                Transit Number: 07232
              </Typography>
              <Typography variant="body2" sx={{ color: 'black' }}>
                Institution Number: 010
              </Typography>
              <Typography variant="body2" sx={{ color: 'black' }}>
                Account Number: 1090712
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black', mb: 1 }}>
                Payment by e-transfer:
              </Typography>
              <Typography variant="body2" sx={{ color: 'black' }}>
                {companyInfo.email}
              </Typography>
            </Grid>
          </Grid>
        </Box>

        {/* Professional Footer */}
        <Box sx={{ 
          backgroundColor: '#2c2c2c',
          position: 'relative',
          p: 3,
          mt: 6,
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            right: 0,
            width: '60%',
            height: '100%',
            background: 'linear-gradient(45deg, #b98f33 0%, #b98f33 25%, transparent 25%, transparent 50%, #b98f33 50%, #b98f33 75%, transparent 75%, transparent 100%)',
            backgroundSize: '20px 20px',
            opacity: 0.8
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '40%',
            height: '100%',
            background: 'linear-gradient(-45deg, #666 0%, #666 25%, transparent 25%, transparent 50%, #666 50%, #666 75%, transparent 75%, transparent 100%)',
            backgroundSize: '20px 20px',
            opacity: 0.6
          }
        }}>
          <Typography variant="h6" sx={{ 
            fontWeight: 'bold', 
            color: 'white',
            textAlign: 'center',
            position: 'relative',
            zIndex: 1,
            letterSpacing: '0.1em'
          }}>
            {companyInfo.website}
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default PrintInvoicePage;
