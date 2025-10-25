import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Alert,
  Snackbar,
  CircularProgress,
  Chip,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  FileDownload as DownloadIcon,
  Visibility as ViewIcon,
  Receipt as ReceiptIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Print as PrintIcon,
} from '@mui/icons-material';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import { calculateOrderTotal, calculateOrderCost, calculateOrderTax, getOrderCostBreakdown, formatFurnitureDetails, isRapidOrder, calculatePickupDeliveryCost } from '../../../shared/utils/orderCalculations';
import { fetchMaterialCompanyTaxRates, getMaterialCompanyTaxRate } from '../../../shared/utils/materialTaxRates';
import autoTable from 'jspdf-autotable';

// Register the autoTable plugin
jsPDF.API.autoTable = autoTable;

const TaxedInvoicesPage = () => {
  const [taxedInvoices, setTaxedInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ open: false, message: '', type: 'info' });
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [materialTaxRates, setMaterialTaxRates] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    fetchTaxedInvoices();
    fetchMaterialCompanyTaxRates().then(setMaterialTaxRates);
  }, []);

  useEffect(() => {
    applyFilters();
  }, [taxedInvoices, searchTerm, dateFilter]);

  const fetchTaxedInvoices = async () => {
    try {
      setLoading(true);
      
      // Fetch taxed invoices - no ordering since we'll sort manually
      const taxedInvoicesRef = collection(db, 'taxedInvoices');
      const querySnapshot = await getDocs(taxedInvoicesRef);
      
      const invoicesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort by invoice number (handle both orderDetails.billInvoice and invoiceNumber)
      invoicesData.sort((a, b) => {
        const aInvoice = a.invoiceNumber || a.orderDetails?.billInvoice || '0';
        const bInvoice = b.invoiceNumber || b.orderDetails?.billInvoice || '0';
        return parseInt(aInvoice) - parseInt(bInvoice);
      });
      
      setTaxedInvoices(invoicesData);
    } catch (error) {
      console.error('Error fetching taxed invoices:', error);
      showNotification('Error fetching taxed invoices', 'error');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...taxedInvoices];
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(invoice => {
        const searchLower = searchTerm.toLowerCase();
        
        // Search in regular customer fields
        if (invoice.customerInfo?.customerName?.toLowerCase().includes(searchLower) ||
            invoice.originalCustomerInfo?.customerName?.toLowerCase().includes(searchLower) ||
            invoice.customerInfo?.phone?.includes(searchTerm) ||
            invoice.originalCustomerInfo?.phone?.includes(searchTerm)) {
          return true;
        }
        
        // Search in corporate customer fields
        if (invoice.orderType === 'corporate') {
          if (invoice.corporateCustomer?.corporateName?.toLowerCase().includes(searchLower) ||
              invoice.contactPerson?.name?.toLowerCase().includes(searchLower) ||
              invoice.contactPerson?.phone?.includes(searchTerm) ||
              invoice.contactPerson?.email?.toLowerCase().includes(searchLower)) {
            return true;
          }
        }
        
        // Search in invoice number
        if ((invoice.orderDetails?.billInvoice || invoice.invoiceNumber)?.toString().includes(searchTerm)) {
          return true;
        }
        
        return false;
      });
    }
    
    // Apply date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      let startDate;
      
      switch (dateFilter) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = null;
      }
      
      if (startDate) {
        filtered = filtered.filter(invoice => {
          const invoiceDate = new Date(invoice.closedAt || invoice.createdAt);
          return invoiceDate >= startDate;
        });
      }
    }
    
    setFilteredInvoices(filtered);
  };

  const showNotification = (message, type = 'info') => {
    setNotification({ open: true, message, type });
  };

  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  const formatCurrency = (value) => {
    const num = parseFloat(value);
    return isNaN(num) ? '$0.00' : `$${num.toFixed(2)}`;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    
    try {
      // Handle different date formats
      let dateObj;
      
      if (date instanceof Date) {
        dateObj = date;
      } else if (typeof date === 'string') {
        // Try to parse the date string
        dateObj = new Date(date);
      } else if (date.seconds) {
        // Handle Firestore timestamp
        dateObj = new Date(date.seconds * 1000);
      } else if (date._seconds) {
        // Handle Firestore timestamp with _seconds
        dateObj = new Date(date._seconds * 1000);
      } else {
        dateObj = new Date(date);
      }
      
      // Check if the date is valid
      if (isNaN(dateObj.getTime())) {
        return 'N/A';
      }
      
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Date formatting error:', error, 'Date value:', date);
      return 'N/A';
    }
  };

  const calculateInvoiceTotals = (invoice) => {
    if (!invoice) return { 
      grandTotal: 0, 
      amountPaid: 0, 
      balanceDue: 0,
      subtotal: 0,
      taxAmount: 0
    };
    
    // Check if the invoice has stored calculations
    if (invoice.calculations) {
      const subtotal = invoice.calculations.subtotal || 0;
      const taxAmount = invoice.calculations.taxAmount || 0;
      const grandTotal = invoice.calculations.total || (subtotal + taxAmount);
      
      return {
        grandTotal: grandTotal,
        subtotal: subtotal,
        taxAmount: taxAmount,
      amountPaid: invoice.orderType === 'corporate' 
        ? (invoice.paymentDetails?.amountPaid || 0)
        : (invoice.paymentData?.amountPaid || 0),
      balanceDue: grandTotal - (invoice.orderType === 'corporate' 
        ? (invoice.paymentDetails?.amountPaid || 0)
        : (invoice.paymentData?.amountPaid || 0))
      };
    }
    
    // Fallback: try to calculate using the order calculation functions
    console.log('Calculating totals for invoice:', invoice.id, 'orderType:', invoice.orderType);
    console.log('Invoice data structure:', {
      furnitureData: invoice.furnitureData,
      furnitureGroups: invoice.furnitureGroups,
      paymentData: invoice.paymentData,
      paymentDetails: invoice.paymentDetails
    });
    
    const total = calculateOrderTotal(invoice);
    const taxAmount = calculateOrderTax(invoice);
    const subtotal = total - taxAmount;
    
    console.log('Calculation results:', { total, taxAmount, subtotal });
    
    // If calculations are 0, try to calculate manually for corporate orders
    if (total === 0 && invoice.orderType === 'corporate' && invoice.furnitureGroups) {
      console.log('Manual calculation for corporate order...');
      let manualSubtotal = 0;
      let manualTaxAmount = 0;
      
      invoice.furnitureGroups.forEach((group, groupIndex) => {
        console.log(`Processing group ${groupIndex}:`, group);
        
        // Material costs
        const materialPrice = parseFloat(group.materialPrice) || 0;
        const materialQnty = parseFloat(group.materialQnty) || 0;
        const materialTotal = materialPrice * materialQnty;
        manualSubtotal += materialTotal;
        manualTaxAmount += materialTotal * 0.13; // 13% tax on materials
        
        // Labour costs (not taxable)
        const labourPrice = parseFloat(group.labourPrice) || 0;
        const labourQnty = parseFloat(group.labourQnty) || 0;
        manualSubtotal += labourPrice * labourQnty;
        
        // Foam costs (taxable)
        if (group.foamEnabled || group.foamPrice > 0) {
          const foamPrice = parseFloat(group.foamPrice) || 0;
          const foamQnty = parseFloat(group.foamQnty) || 0;
          const foamTotal = foamPrice * foamQnty;
          manualSubtotal += foamTotal;
          manualTaxAmount += foamTotal * 0.13; // 13% tax on foam
        }
        
        // Painting costs (not taxable - labour)
        if (group.paintingEnabled || group.paintingLabour > 0) {
          const paintingPrice = parseFloat(group.paintingLabour) || 0;
          const paintingQnty = parseFloat(group.paintingQnty) || 0;
          manualSubtotal += paintingPrice * paintingQnty;
        }
      });
      
      const manualTotal = manualSubtotal + manualTaxAmount;
      console.log('Manual calculation results:', { 
        manualSubtotal, 
        manualTaxAmount, 
        manualTotal 
      });
      
      return {
        grandTotal: manualTotal,
        subtotal: manualSubtotal,
        taxAmount: manualTaxAmount,
        amountPaid: invoice.paymentDetails?.amountPaid || 0,
        balanceDue: manualTotal - (invoice.paymentDetails?.amountPaid || 0)
      };
    }
    
    return {
      grandTotal: total,
      subtotal: subtotal,
      taxAmount: taxAmount,
      amountPaid: invoice.orderType === 'corporate' 
        ? (invoice.paymentDetails?.amountPaid || 0)
        : (invoice.paymentData?.amountPaid || 0),
      balanceDue: total - (invoice.orderType === 'corporate' 
        ? (invoice.paymentDetails?.amountPaid || 0)
        : (invoice.paymentData?.amountPaid || 0))
    };
  };

  const handleViewInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setViewDialogOpen(true);
  };

  const handlePrintInvoice = async (invoice) => {
    try {
      showNotification('Opening print preview...', 'info');
      
      const printWindow = window.open('', '_blank', 'width=800,height=600');
      const totals = calculateInvoiceTotals(invoice);
      
      // Generate HTML content for the invoice
      const htmlContent = generateInvoiceHTML(invoice, totals);
      
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    } catch (error) {
      console.error('Error printing invoice:', error);
      showNotification('Error printing invoice', 'error');
    }
  };

  const generateInvoiceHTML = (invoice, totals) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Taxed Invoice - ${invoice.invoiceNumber || invoice.orderDetails?.billInvoice || 'N/A'}</title>
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
          .taxed-badge {
            background-color: #4caf50;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8rem;
            font-weight: bold;
            margin-top: 8px;
            display: inline-block;
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
          .totals-section {
            width: 300px;
            margin-left: auto;
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
          <!-- Header -->
          <div class="header">
            <div class="customer-info">
              <div class="customer-name">
                ${invoice.orderType === 'corporate' 
                  ? (invoice.corporateCustomer?.corporateName || 'N/A')
                  : (invoice.customerInfo?.customerName || invoice.originalCustomerInfo?.customerName || 'N/A')
                }
              </div>
              <div style="display: flex; gap: 16px;">
                <div>
                  <div class="detail-item">Phone: ${invoice.orderType === 'corporate'
                    ? (invoice.contactPerson?.phone || 'N/A')
                    : (invoice.customerInfo?.phone || invoice.originalCustomerInfo?.phone || 'N/A')
                  }</div>
                  <div class="detail-item">Email: ${invoice.orderType === 'corporate'
                    ? (invoice.contactPerson?.email || 'N/A')
                    : (invoice.customerInfo?.email || invoice.originalCustomerInfo?.email || 'N/A')
                  }</div>
                </div>
                <div>
                  <div class="detail-item">Address: ${invoice.orderType === 'corporate'
                    ? (invoice.corporateCustomer?.address || 'N/A')
                    : (invoice.customerInfo?.address || invoice.originalCustomerInfo?.address || 'N/A')
                  }</div>
                  <div class="detail-item">Date: ${formatDate(invoice.closedAt || invoice.createdAt)}</div>
                </div>
              </div>
            </div>
            <div class="invoice-number">
              <img src="/assets/images/logo-001.png" alt="JL Upholstery Logo" class="logo">
              <h1>${invoice.invoiceNumber || invoice.orderDetails?.billInvoice || 'N/A'}</h1>
              <div class="taxed-badge">TAXED INVOICE</div>
            </div>
          </div>

          <!-- Invoice Items Table -->
          <table class="table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${generateInvoiceItemsHTML(invoice)}
            </tbody>
          </table>

          <!-- Totals -->
          <div class="totals-section">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>${formatCurrency(totals.grandTotal - (totals.grandTotal * 0.13))}</span>
            </div>
            <div class="total-row">
              <span>Tax (13%):</span>
              <span>${formatCurrency(totals.grandTotal * 0.13)}</span>
            </div>
            <div class="total-row grand-total">
              <span>Grand Total:</span>
              <span>${formatCurrency(totals.grandTotal)}</span>
            </div>
            <div class="total-row">
              <span>Amount Paid:</span>
              <span>${formatCurrency(totals.amountPaid)}</span>
            </div>
            <div class="total-row">
              <span>Balance Due:</span>
              <span>${formatCurrency(totals.balanceDue)}</span>
            </div>
          </div>

          <div class="footer">
            <p>This invoice has been closed and moved to taxed invoices.</p>
            <p>Closed on: ${formatDate(invoice.closedAt)}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const generateInvoiceItemsHTML = (invoice) => {
    if (!invoice.furnitureGroups || !Array.isArray(invoice.furnitureGroups)) {
      return '<tr><td colspan="4">No items found</td></tr>';
    }

    let html = '';
    
    invoice.furnitureGroups.forEach((group, groupIndex) => {
      if (group.furnitureType) {
        html += `
          <tr style="background-color: #f8f8f8;">
            <td colspan="4" style="font-weight: bold; padding: 4px 8px;">
              ${group.furnitureType}
            </td>
          </tr>
        `;
        
        // Materials
        if (group.materialCode && group.materialPrice) {
          html += `
            <tr>
              <td>Material: ${group.materialCode}</td>
              <td>${group.materialQnty || 1}</td>
              <td>${formatCurrency(group.materialPrice)}</td>
              <td>${formatCurrency((parseFloat(group.materialPrice) || 0) * (parseFloat(group.materialQnty) || 1))}</td>
            </tr>
          `;
        }
        
        // Labour
        if (group.labourPrice) {
          html += `
            <tr>
              <td>Labour${group.labourNote ? ': ' + group.labourNote : ''}</td>
              <td>${group.labourQnty || 1}</td>
              <td>${formatCurrency(group.labourPrice)}</td>
              <td>${formatCurrency((parseFloat(group.labourPrice) || 0) * (parseFloat(group.labourQnty) || 1))}</td>
            </tr>
          `;
        }
        
        // Foam
        if (group.foamEnabled && group.foamPrice) {
          html += `
            <tr>
              <td>Foam${group.foamNote ? ': ' + group.foamNote : ''}</td>
              <td>${group.foamQnty || 1}</td>
              <td>${formatCurrency(group.foamPrice)}</td>
              <td>${formatCurrency((parseFloat(group.foamPrice) || 0) * (parseFloat(group.foamQnty) || 1))}</td>
            </tr>
          `;
        }
      }
    });
    
    return html;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#274290', mb: 1 }}>
          Taxed Invoices
        </Typography>
        <Typography variant="body1" color="text.secondary">
          View and manage closed customer invoices in sequential order
        </Typography>
      </Box>

      {/* Filters and Search */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              placeholder="Search by customer name, invoice number, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Date Filter</InputLabel>
              <Select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                label="Date Filter"
              >
                <MenuItem value="all">All Time</MenuItem>
                <MenuItem value="today">Today</MenuItem>
                <MenuItem value="week">This Week</MenuItem>
                <MenuItem value="month">This Month</MenuItem>
                <MenuItem value="year">This Year</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip 
                label={`${filteredInvoices.length} invoices`}
                color="primary"
                variant="outlined"
              />
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Invoices Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell sx={{ fontWeight: 'bold' }}>Invoice #</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Customer</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Invoice Date</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Date Closed</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Subtotal</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Tax</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Total</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredInvoices.map((invoice) => {
                const totals = calculateInvoiceTotals(invoice);
                return (
                  <TableRow key={invoice.id} hover>
                    <TableCell>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                        #{invoice.invoiceNumber || invoice.orderDetails?.billInvoice || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                          {invoice.orderType === 'corporate' 
                            ? (invoice.corporateCustomer?.corporateName || 'N/A')
                            : (invoice.customerInfo?.customerName || invoice.originalCustomerInfo?.customerName || 'N/A')
                          }
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {invoice.orderType === 'corporate'
                            ? (invoice.contactPerson?.phone || 'N/A')
                            : (invoice.customerInfo?.phone || invoice.originalCustomerInfo?.phone || 'N/A')
                          }
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const invoiceDate = invoice.createdAt || invoice.dateCreated || invoice.invoiceDate;
                        console.log('Invoice date fields:', {
                          createdAt: invoice.createdAt,
                          dateCreated: invoice.dateCreated,
                          invoiceDate: invoice.invoiceDate,
                          selected: invoiceDate
                        });
                        return formatDate(invoiceDate);
                      })()}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        console.log('Closed date:', invoice.closedAt);
                        return formatDate(invoice.closedAt);
                      })()}
                    </TableCell>
                    <TableCell>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                        {formatCurrency(totals.subtotal)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#d32f2f' }}>
                        {formatCurrency(totals.taxAmount)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                        {formatCurrency(totals.grandTotal)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="View Invoice">
                          <IconButton 
                            size="small" 
                            onClick={() => handleViewInvoice(invoice)}
                            sx={{ color: '#274290' }}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Print Invoice">
                          <IconButton 
                            size="small" 
                            onClick={() => handlePrintInvoice(invoice)}
                            sx={{ color: '#b98f33' }}
                          >
                            <PrintIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* View Invoice Dialog */}
      <Dialog 
        open={viewDialogOpen} 
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Invoice #{selectedInvoice?.invoiceNumber || selectedInvoice?.orderDetails?.billInvoice || 'N/A'} - Taxed Invoice
        </DialogTitle>
        <DialogContent>
          {selectedInvoice && (
            <Box>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" sx={{ mb: 1 }}>Customer Information</Typography>
                  <Typography><strong>Name:</strong> {selectedInvoice.orderType === 'corporate' 
                    ? (selectedInvoice.corporateCustomer?.corporateName || 'N/A')
                    : (selectedInvoice.customerInfo?.customerName || selectedInvoice.originalCustomerInfo?.customerName || 'N/A')
                  }</Typography>
                  <Typography><strong>Phone:</strong> {selectedInvoice.orderType === 'corporate'
                    ? (selectedInvoice.contactPerson?.phone || 'N/A')
                    : (selectedInvoice.customerInfo?.phone || selectedInvoice.originalCustomerInfo?.phone || 'N/A')
                  }</Typography>
                  <Typography><strong>Email:</strong> {selectedInvoice.orderType === 'corporate'
                    ? (selectedInvoice.contactPerson?.email || 'N/A')
                    : (selectedInvoice.customerInfo?.email || selectedInvoice.originalCustomerInfo?.email || 'N/A')
                  }</Typography>
                  <Typography><strong>Address:</strong> {selectedInvoice.orderType === 'corporate'
                    ? (selectedInvoice.corporateCustomer?.address || 'N/A')
                    : (selectedInvoice.customerInfo?.address || selectedInvoice.originalCustomerInfo?.address || 'N/A')
                  }</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" sx={{ mb: 1 }}>Invoice Details</Typography>
                  <Typography><strong>Invoice #:</strong> {selectedInvoice.invoiceNumber || selectedInvoice.orderDetails?.billInvoice || 'N/A'}</Typography>
                  <Typography><strong>Date Closed:</strong> {formatDate(selectedInvoice.closedAt)}</Typography>
                  <Typography><strong>Subtotal:</strong> {formatCurrency(calculateInvoiceTotals(selectedInvoice).subtotal)}</Typography>
                  <Typography><strong>Tax (13%):</strong> {formatCurrency(calculateInvoiceTotals(selectedInvoice).taxAmount)}</Typography>
                  <Typography><strong>Total Amount:</strong> {formatCurrency(calculateInvoiceTotals(selectedInvoice).grandTotal)}</Typography>
                  <Typography><strong>Amount Paid:</strong> {formatCurrency(calculateInvoiceTotals(selectedInvoice).amountPaid)}</Typography>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
          <Button 
            onClick={() => selectedInvoice && handlePrintInvoice(selectedInvoice)}
            variant="contained"
            startIcon={<PrintIcon />}
            sx={{ backgroundColor: '#b98f33' }}
          >
            Print Invoice
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleCloseNotification} 
          severity={notification.type}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TaxedInvoicesPage;
