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
  Download as DownloadIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  LocationOn as LocationIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useNotification } from '../../../components/Common/NotificationSystem';
import { buttonStyles } from '../../../styles/buttonStyles';
import { formatDate, formatDateOnly } from '../../../utils/dateUtils';

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

  // Calculate paid amount
  const getPaidAmount = (invoice) => {
    return invoice.paidAmount || invoice.calculations?.paidAmount || 0;
  };

  // Calculate balance
  const calculateBalance = (invoice) => {
    const total = invoice.calculations?.total || 0;
    const paid = getPaidAmount(invoice);
    return total - paid;
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
    <>
      {/* Print Styles */}
      <style>
        {`
          @media print {
            @page {
              margin: 0.5in;
              size: A4;
            }
            
            body {
              -webkit-print-color-adjust: exact;
              color-adjust: exact;
              background: white !important;
            }
            
            /* Hide main app header and sidebar */
            header, nav, .MuiAppBar-root, .MuiDrawer-root, .MuiDrawer-paper {
              display: none !important;
            }
            
            /* Hide common navigation elements */
            .navbar, .sidebar, .header, .navigation, .nav-bar, .main-header {
              display: none !important;
            }
            
            /* Hide screen-only elements */
            .screen-only {
              display: none !important;
            }
            
            /* Show only the invoice content */
            body > div, body > div > div {
              margin: 0 !important;
              padding: 0 !important;
            }
            
            /* Preserve original invoice styling */
            .MuiPaper-root {
              background: white !important;
              box-shadow: none !important;
              margin: 0 !important;
              padding: 20px !important;
            }
            
            /* Preserve color styling for totals sections */
            .MuiBox-root {
              background-color: inherit !important;
            }
            
            /* Preserve table styling */
            table {
              border-collapse: collapse !important;
              width: 100% !important;
            }
            
            th {
              background-color: #f5f5f5 !important;
              color: #333333 !important;
              border: 2px solid #333333 !important;
              border-right: 1px solid #ddd !important;
            }
            
            td {
              border-bottom: 1px solid #ddd !important;
              border-right: 1px solid #eee !important;
              color: #333333 !important;
            }
            
            /* Preserve colored sections in totals */
            .MuiTypography-root[style*="background-color: #4CAF50"] {
              background-color: #4CAF50 !important;
              color: white !important;
            }
            
            .MuiTypography-root[style*="background-color: #f27921"] {
              background-color: #f27921 !important;
              color: white !important;
            }
            
            .MuiTypography-root[style*="background-color: #2c2c2c"] {
              background-color: #2c2c2c !important;
              color: white !important;
            }
            
            /* Hide browser print headers and footers */
            @page :first {
              margin-top: 0.5in;
            }
            
            @page :left {
              margin-left: 0.5in;
              margin-right: 0.5in;
            }
            
            @page :right {
              margin-left: 0.5in;
              margin-right: 0.5in;
            }
          }
        `}
      </style>
      
      <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header - Only visible on screen, hidden when printing */}
      <Box className="screen-only" sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 3,
        flexWrap: 'wrap',
        gap: 2
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
          width: '100%', // Full width
          mx: 'auto',
          backgroundColor: 'white',
          '@media print': {
            boxShadow: 'none',
            elevation: 0,
            width: '100%',
            mx: 0,
            p: 3,
            margin: 0,
            padding: '20px'
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
        {/* Professional Invoice Header - Image Only */}
        <Box sx={{ 
          mb: 4,
          position: 'relative',
          overflow: 'hidden',
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          {/* Header Image Only */}
          <img 
            src="/assets/images/invoice-headers/Invoice Header.png" 
            alt="Invoice Header" 
            style={{ 
              width: '100%',
              height: 'auto',
              maxWidth: '100%',
              objectFit: 'contain',
              display: 'block'
            }}
          />
        </Box>

        {/* Invoice Information Row - Left: Customer Info, Right: Date/Invoice/Tax */}
        <Box sx={{ 
          mb: 4,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          {/* Left Side - Customer Information */}
          <Box sx={{ flex: 1, mr: 4 }}>
            <Typography variant="h6" sx={{ 
              fontWeight: 'bold', 
              color: 'black',
              mb: 2
            }}>
              Invoice to:
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2, color: 'black' }}>
              {invoiceData.customerInfo.customerName}
            </Typography>
            {invoiceData.customerInfo.phone && (
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                <PhoneIcon sx={{ mr: 1, fontSize: '16px', color: '#666666' }} />
                <Typography variant="body1" sx={{ color: 'black' }}>
                  {invoiceData.customerInfo.phone}
                </Typography>
              </Box>
            )}
            {invoiceData.customerInfo.email && (
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                <EmailIcon sx={{ mr: 1, fontSize: '16px', color: '#666666' }} />
                <Typography variant="body1" sx={{ color: 'black' }}>
                  {invoiceData.customerInfo.email}
                </Typography>
              </Box>
            )}
            {invoiceData.customerInfo.address && (
              <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 0.5 }}>
                <LocationIcon sx={{ mr: 1, fontSize: '16px', color: '#666666', mt: 0.2 }} />
                <Typography variant="body1" sx={{ whiteSpace: 'pre-line', color: 'black' }}>
                  {invoiceData.customerInfo.address}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Right Side - Invoice Details */}
          <Box sx={{ 
            minWidth: '250px',
            flexShrink: 0
          }}>
            <Typography variant="body1" sx={{ color: 'black', mb: 1 }}>
              <strong>Date:</strong> {formatDateOnly(invoiceData.createdAt)}
            </Typography>
            <Typography variant="body1" sx={{ color: 'black', mb: 1 }}>
              <strong>Invoice #</strong> {invoiceData.invoiceNumber}
            </Typography>
            <Typography variant="body1" sx={{ color: 'black', mb: 1 }}>
              <strong>Tax #</strong> {companyInfo.taxNumber}
            </Typography>
          </Box>
        </Box>

        {/* Items Table and Totals - Professional Layout */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ 
            border: '2px solid #333333',
            borderRadius: 0,
            overflow: 'hidden',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              backgroundColor: 'white',
              tableLayout: 'fixed'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5' }}>
                  <th style={{ 
                    width: '66.67%',
                    padding: '8px 16px',
                    textAlign: 'left',
                    fontWeight: 'bold',
                    color: '#333333',
                    backgroundColor: '#f5f5f5',
                    border: 'none',
                    borderBottom: '2px solid #333333',
                    borderRight: '1px solid #ddd',
                    fontSize: '14px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>Description</th>
                  <th style={{ 
                    width: '11.11%',
                    padding: '8px 16px',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    color: '#333333',
                    backgroundColor: '#f5f5f5',
                    border: 'none',
                    borderBottom: '2px solid #333333',
                    borderRight: '1px solid #ddd',
                    fontSize: '14px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>Price</th>
                  <th style={{ 
                    width: '11.11%',
                    padding: '8px 16px',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    color: '#333333',
                    backgroundColor: '#f5f5f5',
                    border: 'none',
                    borderBottom: '2px solid #333333',
                    borderRight: '1px solid #ddd',
                    fontSize: '14px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>Unit</th>
                  <th style={{ 
                    width: '11.11%',
                    padding: '8px 16px',
                    textAlign: 'right',
                    fontWeight: 'bold',
                    color: '#333333',
                    backgroundColor: '#f5f5f5',
                    border: 'none',
                    borderBottom: '2px solid #333333',
                    fontSize: '14px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const furnitureGroups = invoiceData.furnitureGroups || [];
                  const items = invoiceData.items || [];
                  
                  const rows = [];
                  
                  // If no items, show a message
                  if (furnitureGroups.length === 0 && items.length === 0) {
                    rows.push(
                      <tr key="no-items">
                        <td colSpan="4" style={{ 
                          padding: '16px',
                          textAlign: 'center',
                          color: '#666666',
                          fontStyle: 'italic',
                          border: 'none'
                        }}>
                          No items found
                        </td>
                      </tr>
                    );
                  } else {
                    // Group items by their furniture group index
                    const itemsByGroup = {};
                    items.forEach(item => {
                      // Extract group index from item ID (e.g., "item-0-material" -> 0)
                      const match = item.id?.match(/item-(\d+)-/);
                      const groupIndex = match ? parseInt(match[1]) : 0;
                      
                      if (!itemsByGroup[groupIndex]) {
                        itemsByGroup[groupIndex] = [];
                      }
                      itemsByGroup[groupIndex].push(item);
                    });
                    
                    // Render each furniture group with its items
                    furnitureGroups.forEach((group, groupIndex) => {
                      // Add furniture group header
                      rows.push(
                        <tr key={`group-${groupIndex}`} style={{ backgroundColor: '#f8f9fa' }}>
                          <td colSpan="4" style={{ 
                            padding: '10px 16px',
                            fontWeight: 'bold',
                            color: '#274290',
                            border: 'none',
                            borderBottom: '1px solid #ddd',
                            fontSize: '14px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            {group.name}
                          </td>
                        </tr>
                      );
                      
                      // Add items that belong to this group
                      const groupItems = itemsByGroup[groupIndex] || [];
                      groupItems.forEach((item, itemIndex) => {
                        rows.push(
                          <tr key={item.id || `item-${groupIndex}-${itemIndex}`} style={{ 
                            borderBottom: '1px solid #ddd'
                          }}>
                            <td style={{ 
                              width: '66.67%',
                              padding: '8px 16px',
                              color: '#333333',
                              border: 'none',
                              borderRight: '1px solid #eee',
                              fontSize: '14px'
                            }}>
                              {item.name}
                            </td>
                            <td style={{ 
                              width: '11.11%',
                              padding: '8px 16px',
                              textAlign: 'center',
                              color: '#333333',
                              border: 'none',
                              borderRight: '1px solid #eee',
                              fontSize: '14px',
                              fontWeight: '500'
                            }}>
                              ${parseFloat(item.price || 0).toFixed(2)}
                            </td>
                            <td style={{ 
                              width: '11.11%',
                              padding: '8px 16px',
                              textAlign: 'center',
                              color: '#333333',
                              border: 'none',
                              borderRight: '1px solid #eee',
                              fontSize: '14px',
                              fontWeight: '500'
                            }}>
                              {item.quantity || 0}
                            </td>
                            <td style={{ 
                              width: '11.11%',
                              padding: '8px 16px',
                              textAlign: 'right',
                              fontWeight: 'bold',
                              color: '#333333',
                              border: 'none',
                              fontSize: '14px'
                            }}>
                              ${((parseFloat(item.quantity || 0) * parseFloat(item.price || 0))).toFixed(2)}
                            </td>
                          </tr>
                        );
                      });
                    });
                    
                    // Add any items that don't belong to any group (fallback)
                    const ungroupedItems = items.filter(item => {
                      const match = item.id?.match(/item-(\d+)-/);
                      const groupIndex = match ? parseInt(match[1]) : -1;
                      return groupIndex >= furnitureGroups.length;
                    });
                    
                    if (ungroupedItems.length > 0) {
                      ungroupedItems.forEach((item, itemIndex) => {
                        rows.push(
                          <tr key={item.id || `ungrouped-${itemIndex}`} style={{ 
                            borderBottom: '1px solid #ddd'
                          }}>
                            <td style={{ 
                              width: '66.67%',
                              padding: '8px 16px',
                              color: '#333333',
                              border: 'none',
                              borderRight: '1px solid #eee',
                              fontSize: '14px'
                            }}>
                              {item.name}
                            </td>
                            <td style={{ 
                              width: '11.11%',
                              padding: '8px 16px',
                              textAlign: 'center',
                              color: '#333333',
                              border: 'none',
                              borderRight: '1px solid #eee',
                              fontSize: '14px',
                              fontWeight: '500'
                            }}>
                              ${parseFloat(item.price || 0).toFixed(2)}
                            </td>
                            <td style={{ 
                              width: '11.11%',
                              padding: '8px 16px',
                              textAlign: 'center',
                              color: '#333333',
                              border: 'none',
                              borderRight: '1px solid #eee',
                              fontSize: '14px',
                              fontWeight: '500'
                            }}>
                              {item.quantity || 0}
                            </td>
                            <td style={{ 
                              width: '11.11%',
                              padding: '8px 16px',
                              textAlign: 'right',
                              fontWeight: 'bold',
                              color: '#333333',
                              border: 'none',
                              fontSize: '14px'
                            }}>
                              ${((parseFloat(item.quantity || 0) * parseFloat(item.price || 0))).toFixed(2)}
                            </td>
                          </tr>
                        );
                      });
                    }
                  }

                  return rows;
                })()}
                {/* Add empty rows to match the design */}
                {Array.from({ length: Math.max(0, 8 - invoiceData.items.length) }).map((_, index) => (
                  <tr key={`empty-${index}`} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ 
                      width: '66.67%',
                      padding: '8px 16px', 
                      border: 'none',
                      borderRight: '1px solid #eee'
                    }}></td>
                    <td style={{ 
                      width: '11.11%',
                      padding: '8px 16px', 
                      border: 'none',
                      borderRight: '1px solid #eee'
                    }}></td>
                    <td style={{ 
                      width: '11.11%',
                      padding: '8px 16px', 
                      border: 'none',
                      borderRight: '1px solid #eee'
                    }}></td>
                    <td style={{ 
                      width: '11.11%',
                      padding: '8px 16px', 
                      textAlign: 'right',
                      color: '#333333',
                      border: 'none',
                      fontSize: '14px'
                    }}>
                      $0.00
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
          
          {/* Terms and Conditions + Totals Section - Side by side */}
          <Box sx={{ mt: 2 }}>
            {/* Left Side - Terms and Conditions */}
            <Box sx={{ 
              display: 'flex',
              width: '100%',
              gap: 4
            }}>
              <Box sx={{ 
                flex: '0 0 50%',
                maxWidth: '50%'
              }}>
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
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black', mb: 1 }}>
                      Payment by Cheque:
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'black' }}>
                      Mail to: {companyInfo.address}
                    </Typography>
                  </Box>
                  
                  <Box>
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
                  </Box>
                  
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black', mb: 1 }}>
                      Payment by e-transfer:
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'black' }}>
                      {companyInfo.email}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Right Side - Totals Section - Far Right */}
              <Box sx={{ 
                flex: '1',
                display: 'flex', 
                justifyContent: 'flex-end', 
                alignItems: 'flex-start'
              }}>
                <Box sx={{ 
                  minWidth: '300px',
                  maxWidth: '400px'
                }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body1" sx={{ color: 'black' }}>Subtotal:</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black' }}>
                      ${invoiceData.calculations?.subtotal?.toFixed(2) || '0.00'}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body1" sx={{ color: 'black' }}>Tax Rate:</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black' }}>
                      ${(invoiceData.headerSettings?.taxPercentage || 0) / 100}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body1" sx={{ color: 'black' }}>Tax Due:</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black' }}>
                      ${invoiceData.calculations?.taxAmount?.toFixed(2) || '0.00'}
                    </Typography>
                  </Box>
                  
                  {invoiceData.headerSettings?.creditCardFeeEnabled && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body1" sx={{ color: 'black' }}>Credit Card Fee:</Typography>
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
                      ${getPaidAmount(invoiceData).toFixed(2)}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    backgroundColor: calculateBalance(invoiceData) >= 0 ? '#f27921' : '#4CAF50',
                    color: 'white',
                    p: 1,
                    borderRadius: 1,
                    mb: 1
                  }}>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'white' }}>
                      Balance:
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'white' }}>
                      ${calculateBalance(invoiceData).toFixed(2)}
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
            </Box>
          </Box>
        </Box>

        {/* Signature Section - Right Aligned */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', mt: 4, mb: 4 }}>
          <Box sx={{ textAlign: 'center', minWidth: 300, mr: 8 }}>
            <Typography variant="body2" sx={{ color: 'black', mb: 2 }}>
              Signature
            </Typography>
            <Box sx={{ 
              width: 250, 
              height: 1, 
              backgroundColor: 'black',
              mb: 1,
              margin: '0 auto'
            }} />
            <Typography variant="h6" sx={{ 
              color: 'black',
              fontFamily: '"Brush Script MT", "Lucida Handwriting", "Kalam", cursive',
              fontSize: '1.5rem',
              fontWeight: 'normal',
              fontStyle: 'normal',
              letterSpacing: '0.1em',
              textAlign: 'center'
            }}>
              Ahmed Albaghdadi
            </Typography>
          </Box>
        </Box>

        {/* Invoice Footer Image */}
        <Box sx={{ 
          mt: 6,
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <img 
            src="/assets/images/invoice-headers/invoice Footer.png" 
            alt="Invoice Footer" 
            style={{ 
              width: '100%',
              height: 'auto',
              maxWidth: '100%',
              objectFit: 'contain',
              display: 'block'
            }}
          />
        </Box>
      </Paper>
    </Box>
    </>
  );
};

export default PrintInvoicePage;
