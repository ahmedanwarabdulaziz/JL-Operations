import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert,
  TextField,
  IconButton,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Collapse,
  IconButton as MuiIconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import { Grid } from '@mui/material';

import {
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
  Chair as ChairIcon,
  LocalShipping as ShippingIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  CalendarToday as CalendarIcon,
  Assignment as AssignmentIcon,
  TrendingUp as TrendingUpIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  Business as BusinessIcon,
  Visibility as VisibilityIcon,
  Close as CloseIcon,
  Print as PrintIcon
} from '@mui/icons-material';

import { useNavigate } from 'react-router-dom';
import { useNotification } from '../../shared/components/Common/NotificationSystem';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { calculateOrderProfit, calculateOrderTax, getOrderCostBreakdown, calculatePickupDeliveryCost } from '../../utils/orderCalculations';
import { fetchMaterialCompanyTaxRates } from '../../utils/materialTaxRates';
import { formatCurrency } from '../../utils/plCalculations';
import { formatDate } from '../../utils/plCalculations';
import { normalizeAllocation } from '../../shared/utils/allocationUtils';
import { sendCompletionEmailWithGmail } from '../../services/emailService';

const EndDonePage = () => {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [invoiceStatuses, setInvoiceStatuses] = useState([]);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [materialTaxRates, setMaterialTaxRates] = useState({});
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewOrder, setPreviewOrder] = useState(null);
  const [completionEmailDialog, setCompletionEmailDialog] = useState({
    open: false,
    sendEmail: true,
    includeReview: true,
    order: null
  });
  const [sendingCompletionEmail, setSendingCompletionEmail] = useState(false);

  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();

  // Fetch orders with "done" end state
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      
      // First get all invoice statuses to identify "done" end states
      const statusesRef = collection(db, 'invoiceStatuses');
      const statusesSnapshot = await getDocs(statusesRef);
      const statusesData = statusesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setInvoiceStatuses(statusesData);

      // Get all orders from both regular orders and done-orders collections
      const [ordersRef, doneOrdersRef] = await Promise.all([
        getDocs(query(collection(db, 'orders'), orderBy('orderDetails.billInvoice', 'desc'))),
        getDocs(query(collection(db, 'done-orders'), orderBy('orderDetails.billInvoice', 'desc')))
      ]);

      const ordersData = ordersRef.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        orderType: 'individual'
      }));

      const doneOrdersData = doneOrdersRef.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Combine both collections
      const allOrders = [...ordersData, ...doneOrdersData];

      // Filter for orders with "done" end state status
      const doneStatuses = statusesData.filter(status => 
        status.isEndState && status.endStateType === 'done'
      );
      const doneStatusValues = doneStatuses.map(status => status.value);

      const doneOrders = allOrders.filter(order => {
        // For regular orders, check invoiceStatus
        if (order.invoiceStatus) {
          return doneStatusValues.includes(order.invoiceStatus);
        }
        // For corporate orders moved to done-orders, check status field
        if (order.status === 'done' || order.orderType === 'corporate') {
          return true;
        }
        return false;
      });

      // Fetch material tax rates
      const taxRates = await fetchMaterialCompanyTaxRates();
      setMaterialTaxRates(taxRates);
      
      setOrders(doneOrders);
      setFilteredOrders(doneOrders);
    } catch (error) {
      console.error('Error fetching done orders:', error);
      showError('Failed to fetch completed orders');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Handle search
  const handleSearch = (searchValue) => {
    setSearchTerm(searchValue);
    if (!searchValue.trim()) {
      setFilteredOrders(orders);
      return;
    }

    const filtered = orders.filter(order => {
      const searchLower = searchValue.toLowerCase();
      
      // Search in common fields
      if (order.orderDetails?.billInvoice?.toLowerCase().includes(searchLower)) {
        return true;
      }
      
      // Search in individual order fields
      if (order.personalInfo?.customerName?.toLowerCase().includes(searchLower) ||
          order.personalInfo?.phone?.includes(searchValue) ||
          order.personalInfo?.email?.toLowerCase().includes(searchLower)) {
        return true;
      }
      
      // Search in corporate order fields
      if (order.corporateCustomer?.corporateName?.toLowerCase().includes(searchLower) ||
          order.contactPerson?.name?.toLowerCase().includes(searchLower) ||
          order.contactPerson?.phone?.includes(searchValue) ||
          order.contactPerson?.email?.toLowerCase().includes(searchLower)) {
        return true;
      }
      
      return false;
    });

    setFilteredOrders(filtered);
  };

  // Handle row expansion
  const handleRowToggle = (orderId) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(orderId)) {
      newExpandedRows.delete(orderId);
    } else {
      newExpandedRows.add(orderId);
    }
    setExpandedRows(newExpandedRows);
  };

  // Get status info
  const getStatusInfo = (status) => {
    const statusObj = invoiceStatuses.find(s => s.value === status);
    return statusObj || { label: status, color: '#666' };
  };

  // Calculate order totals
  const calculateOrderTotals = (order) => {
    const profitData = calculateOrderProfit(order, materialTaxRates);
    return {
      revenue: profitData.revenue,
      cost: profitData.cost,
      profit: profitData.profit
    };
  };

  // Get allocation info
  const getAllocationInfo = (order) => {
    if (!order.allocation) return null;
    
    // Normalize allocation to handle both old and new formats
    const profitData = calculateOrderProfit(order, materialTaxRates);
    const normalizedAllocation = normalizeAllocation(order.allocation, profitData);
    
    if (!normalizedAllocation || !normalizedAllocation.allocations) return null;
    
    // Filter out allocations with 0% or very small percentages (< 0.01%)
    const validAllocations = normalizedAllocation.allocations.filter(
      alloc => alloc && (alloc.percentage || 0) > 0.01
    );
    
    // Only return allocation info if there are valid allocations with actual percentages
    if (!validAllocations || validAllocations.length === 0) return null;
    
    const totalAllocations = validAllocations.length;
    const appliedAt = normalizedAllocation.appliedAt;
    const originalRevenue = profitData.revenue;
    
    return {
      totalAllocations,
      originalRevenue,
      appliedAt: typeof appliedAt === 'string' ? new Date(appliedAt) : (appliedAt?.toDate ? appliedAt.toDate() : new Date(appliedAt))
    };
  };

  // Format date
  const formatDateDisplay = (date) => {
    if (!date) return 'N/A';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return dateObj.toLocaleDateString();
  };

  // Calculate invoice totals (same as InvoicePage)
  const calculateInvoiceTotals = (order) => {
    if (!order) return { 
      grandTotal: 0, 
      amountPaid: 0,
      balanceDue: 0,
      itemsSubtotal: 0,
      taxAmount: 0,
      pickupDeliveryCost: 0,
      jlSubtotalBeforeTax: 0,
      jlGrandTotal: 0
    };

    const taxAmount = calculateOrderTax(order);
    const pickupDeliveryCost = order.paymentData?.pickupDeliveryEnabled ? 
      calculatePickupDeliveryCost(
        parseFloat(order.paymentData.pickupDeliveryCost) || 0,
        order.paymentData.pickupDeliveryServiceType || 'both'
      ) : 0;
    
    const breakdown = getOrderCostBreakdown(order);
    const itemsSubtotal = breakdown.material + breakdown.labour + breakdown.foam + breakdown.painting;
    const grandTotal = itemsSubtotal + taxAmount + pickupDeliveryCost;
    
    const amountPaid = order.orderType === 'corporate' 
      ? (parseFloat(order.paymentDetails?.amountPaid || 0))
      : (parseFloat(order.paymentData?.amountPaid || 0));
    
    const balanceDue = grandTotal - amountPaid;

    // Calculate JL costs
    let jlSubtotalBeforeTax = 0;
    if (order.furnitureData?.groups) {
      order.furnitureData.groups.forEach(group => {
        if (group.materialJLPrice && group.materialJLQnty) {
          const materialJLTotal = (parseFloat(group.materialJLPrice) || 0) * (parseFloat(group.materialJLQnty) || 0);
          const materialTaxRate = materialTaxRates[group.materialCompany] || 0.13;
          jlSubtotalBeforeTax += materialJLTotal * materialTaxRate;
        }
        if (group.foamJLPrice && group.foamQnty) {
          jlSubtotalBeforeTax += (parseFloat(group.foamJLPrice) || 0) * (parseFloat(group.foamQnty) || 1);
        }
      });
    }

    // Add extra expenses
    if (order.extraExpenses && order.extraExpenses.length > 0) {
      order.extraExpenses.forEach(expense => {
        jlSubtotalBeforeTax += parseFloat(expense.total) || 0;
      });
    }

    const jlGrandTotal = jlSubtotalBeforeTax;

    return {
      grandTotal,
      itemsSubtotal,
      taxAmount,
      pickupDeliveryCost,
      amountPaid,
      balanceDue,
      jlSubtotalBeforeTax,
      jlGrandTotal
    };
  };

      // Handle review/print preview
  const handleReviewInvoice = (order) => {
    try {
      setPreviewOrder(order);
      setPreviewDialogOpen(true);
    } catch (error) {
      console.error('Error opening invoice preview:', error);
      showError('Failed to open invoice preview');
    }
  };

  // Handle print
  const handlePrint = () => {
    if (!previewOrder) return;
    
    // Create a print window with the invoice content
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    const totals = calculateInvoiceTotals(previewOrder);
    const order = previewOrder;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - ${order.orderDetails?.billInvoice || 'N/A'}</title>
        <style>
          @media print {
            @page {
              margin: 0.5in 0.75in 0.5in 0.5in;
              size: A4;
            }
            body {
              margin: 0;
              padding: 0;
            }
          }
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
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="header">
            <div class="customer-info">
              <div class="customer-name">${order.orderType === 'corporate' ? (order.corporateCustomer?.corporateName || 'N/A') : (order.personalInfo?.customerName || 'N/A')}</div>
              <div class="customer-details">
                <div class="detail-column">
                  <div class="detail-item">Email: ${order.orderType === 'corporate' ? (order.contactPerson?.email || order.corporateCustomer?.email || 'N/A') : (order.personalInfo?.email || 'N/A')}</div>
                  <div class="detail-item">Phone: ${order.orderType === 'corporate' ? (order.contactPerson?.phone || 'N/A') : (order.personalInfo?.phone || 'N/A')}</div>
                  <div class="detail-item">Platform: ${order.orderDetails?.platform || 'N/A'}</div>
                </div>
                <div class="detail-column">
                  <div class="detail-item">Date: ${formatDateDisplay(order.createdAt)}</div>
                  <div class="detail-item">Address: ${order.orderType === 'corporate' ? (order.corporateCustomer?.address || 'N/A') : (order.personalInfo?.address || 'N/A')}</div>
                </div>
              </div>
            </div>
            <div class="invoice-number">
              <img src="/assets/images/logo-001.png" alt="JL Upholstery Logo" class="logo" />
              <h1>${order.orderDetails?.billInvoice || 'N/A'}</h1>
            </div>
          </div>

          <div class="section-title">Items & Services</div>
          <table class="table">
            <thead>
              <tr>
                <th style="width: 60%">Description</th>
                <th style="text-align: right; width: 13%">Price</th>
                <th style="text-align: right; width: 13%">Qty</th>
                <th style="text-align: right; width: 14%">Total</th>
              </tr>
            </thead>
            <tbody>
              ${order.furnitureData?.groups?.map(group => `
                <tr class="furniture-group-header">
                  <td colspan="4">${group.furnitureType || 'Furniture Group'}</td>
                </tr>
                ${group.labourPrice && parseFloat(group.labourPrice) > 0 ? `
                  <tr>
                    <td>Labour ${group.labourNote || ''}</td>
                    <td style="text-align: right">$${(parseFloat(group.labourPrice) || 0).toFixed(2)}</td>
                    <td style="text-align: right">${group.labourQnty || 1}</td>
                    <td style="text-align: right">$${((parseFloat(group.labourPrice) || 0) * (parseFloat(group.labourQnty) || 1)).toFixed(2)}</td>
                  </tr>
                ` : ''}
                ${group.materialPrice && parseFloat(group.materialPrice) > 0 ? `
                  <tr>
                    <td>Material ${group.materialCompany || ''} ${group.materialCode ? `(${group.materialCode})` : ''}</td>
                    <td style="text-align: right">$${(parseFloat(group.materialPrice) || 0).toFixed(2)}</td>
                    <td style="text-align: right">${group.materialQnty || 1}</td>
                    <td style="text-align: right">$${((parseFloat(group.materialPrice) || 0) * (parseFloat(group.materialQnty) || 0)).toFixed(2)}</td>
                  </tr>
                ` : ''}
                ${group.foamPrice && parseFloat(group.foamPrice) > 0 ? `
                  <tr>
                    <td>Foam${group.foamThickness ? ` (${group.foamThickness}")` : ''}${group.foamNote ? ` - ${group.foamNote}` : ''}</td>
                    <td style="text-align: right">$${(parseFloat(group.foamPrice) || 0).toFixed(2)}</td>
                    <td style="text-align: right">${group.foamQnty || 1}</td>
                    <td style="text-align: right">$${((parseFloat(group.foamPrice) || 0) * (parseFloat(group.foamQnty) || 1)).toFixed(2)}</td>
                  </tr>
                ` : ''}
                ${group.paintingLabour && parseFloat(group.paintingLabour) > 0 ? `
                  <tr>
                    <td>Painting${group.paintingNote ? ` - ${group.paintingNote}` : ''}</td>
                    <td style="text-align: right">$${(parseFloat(group.paintingLabour) || 0).toFixed(2)}</td>
                    <td style="text-align: right">${group.paintingQnty || 1}</td>
                    <td style="text-align: right">$${((parseFloat(group.paintingLabour) || 0) * (parseFloat(group.paintingQnty) || 1)).toFixed(2)}</td>
                  </tr>
                ` : ''}
              `).join('') || ''}
              ${order.paymentData?.pickupDeliveryEnabled && totals.pickupDeliveryCost > 0 ? `
                <tr>
                  <td>Pickup & Delivery</td>
                  <td style="text-align: right">$${totals.pickupDeliveryCost.toFixed(2)}</td>
                  <td style="text-align: right">1</td>
                  <td style="text-align: right">$${totals.pickupDeliveryCost.toFixed(2)}</td>
                </tr>
              ` : ''}
            </tbody>
          </table>

          <div class="notes-totals-section">
            <div class="notes-section">
              <div class="notes-header">Internal Notes</div>
              <div class="notes-content">${order.paymentData?.notes || ''}</div>
              <div class="notes-header" style="margin-top: 16px">Customer's Item Notes</div>
              <div class="notes-content">${order.furnitureData?.groups?.filter(group => group.customerNote && group.customerNote.trim() !== '').map(group => `<strong>${group.furnitureType || 'Furniture Group'}:</strong><br/>${group.customerNote}`).join('<br/><br/>') || ''}</div>
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
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Wait for content to load, then print
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 250);
  };

  // Render invoice details (same as InvoicePage)
  const renderInvoiceDetails = () => {
    if (!previewOrder) {
      return (
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100%',
          textAlign: 'center',
          p: 4,
          backgroundColor: '#ffffff',
          color: '#000000'
        }}>
          <ReceiptIcon sx={{ fontSize: 64, color: '#666666', mb: 2 }} />
          <Typography variant="h6" sx={{ color: '#000000', mb: 1 }}>
            No order selected
          </Typography>
        </Box>
      );
    }

    const totals = calculateInvoiceTotals(previewOrder);
    const order = previewOrder;

    return (
      <Box sx={{ 
        p: 3, 
        backgroundColor: '#ffffff',
        color: '#000000',
        minHeight: '297mm',
        width: '210mm',
        margin: '0 auto',
        boxShadow: '0 0 10px rgba(0,0,0,0.1)',
        fontFamily: 'Arial, sans-serif'
      }}>
        {/* PDF-Style Invoice Header */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          mb: 2,
          pb: 1.5,
          borderBottom: '1px solid #ccc'
        }}>
          {/* Left Side - Customer Info */}
          <Box sx={{ flex: 1 }}>
            <Typography variant="h4" sx={{ 
              fontWeight: 'bold', 
              mb: 1.5, 
              color: '#000000',
              fontSize: '1.5rem'
            }}>
              {order.orderType === 'corporate' 
                ? (order.corporateCustomer?.corporateName || 'N/A')
                : (order.personalInfo?.customerName || 'N/A')}
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 4 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ mb: 0.5, color: '#666666', fontSize: '0.8rem' }}>
                  Email: {order.orderType === 'corporate' 
                    ? (order.contactPerson?.email || order.corporateCustomer?.email || 'N/A')
                    : (order.personalInfo?.email || 'N/A')}
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.5, color: '#666666', fontSize: '0.8rem' }}>
                  Phone: {order.orderType === 'corporate' 
                    ? (order.contactPerson?.phone || 'N/A')
                    : (order.personalInfo?.phone || 'N/A')}
                </Typography>
                <Typography variant="body2" sx={{ color: '#666666', fontSize: '0.8rem' }}>
                  Platform: {order.orderDetails?.platform || 'N/A'}
                </Typography>
              </Box>
              
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ mb: 0.5, color: '#666666', fontSize: '0.8rem' }}>
                  Date: {formatDateDisplay(order.createdAt)}
                </Typography>
                <Typography variant="body2" sx={{ color: '#666666', fontSize: '0.8rem' }}>
                  Address: {order.orderType === 'corporate' 
                    ? (order.corporateCustomer?.address || 'N/A')
                    : (order.personalInfo?.address || 'N/A')}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Box sx={{ textAlign: 'right' }}>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <img 
                src="/assets/images/logo-001.png" 
                alt="JL Upholstery Logo" 
                style={{ 
                  height: '60px', 
                  width: 'auto',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                }}
              />
            </Box>
            <Typography variant="h4" sx={{ 
              fontWeight: 'bold', 
              color: '#000000',
              mb: 1
            }}>
              {order.orderDetails?.billInvoice || 'N/A'}
            </Typography>
          </Box>
        </Box>

        {/* Items & Services Section */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ 
            fontWeight: 'bold', 
            mb: 1.5,
            color: '#000000'
          }}>
            Items & Services
          </Typography>

          <Box sx={{ 
            display: 'flex',
            backgroundColor: '#f0f0f0',
            border: '1px solid #ccc',
            fontWeight: 'bold',
            fontSize: '0.8rem',
            color: '#000000'
          }}>
            <Box sx={{ flex: 3, p: 0.5, borderRight: '1px solid #ccc' }}>Description</Box>
            <Box sx={{ flex: 1, p: 0.5, borderRight: '1px solid #ccc', textAlign: 'right' }}>Price</Box>
            <Box sx={{ flex: 1, p: 0.5, borderRight: '1px solid #ccc', textAlign: 'right' }}>Qty</Box>
            <Box sx={{ flex: 1, p: 0.5, textAlign: 'right' }}>Total</Box>
          </Box>

          {order.furnitureData?.groups?.map((group, groupIndex) => (
            <Box key={groupIndex}>
              <Box sx={{ 
                display: 'flex',
                backgroundColor: '#f8f8f8',
                border: '1px solid #ccc',
                borderTop: 'none',
                fontWeight: 'bold',
                fontSize: '0.8rem',
                color: '#000000',
                minHeight: '24px'
              }}>
                <Box sx={{ flex: 6, py: 0.25, px: 0.5, display: 'flex', alignItems: 'center' }}>
                  {group.furnitureType || 'Furniture Group'}
                </Box>
              </Box>

              {group.labourPrice && parseFloat(group.labourPrice) > 0 && (
                <Box sx={{ 
                  display: 'flex',
                  borderLeft: '1px solid #ccc',
                  borderRight: '1px solid #ccc',
                  fontSize: '0.8rem',
                  color: '#000000',
                  minHeight: '24px'
                }}>
                  <Box sx={{ flex: 3, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', display: 'flex', alignItems: 'center' }}>
                    Labour {group.labourNote || ''}
                  </Box>
                  <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    ${(parseFloat(group.labourPrice) || 0).toFixed(2)}
                  </Box>
                  <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    {group.labourQnty || 1}
                  </Box>
                  <Box sx={{ flex: 1, py: 0.25, px: 0.5, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    ${((parseFloat(group.labourPrice) || 0) * (parseFloat(group.labourQnty) || 1)).toFixed(2)}
                  </Box>
                </Box>
              )}

              {group.materialPrice && parseFloat(group.materialPrice) > 0 && (
                <Box sx={{ 
                  display: 'flex',
                  borderLeft: '1px solid #ccc',
                  borderRight: '1px solid #ccc',
                  fontSize: '0.8rem',
                  color: '#000000',
                  minHeight: '24px'
                }}>
                  <Box sx={{ flex: 3, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', display: 'flex', alignItems: 'center' }}>
                    Material {group.materialCompany || ''} {group.materialCode ? `(${group.materialCode})` : ''}
                  </Box>
                  <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    ${(parseFloat(group.materialPrice) || 0).toFixed(2)}
                  </Box>
                  <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    {group.materialQnty || 1}
                  </Box>
                  <Box sx={{ flex: 1, py: 0.25, px: 0.5, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    ${((parseFloat(group.materialPrice) || 0) * (parseFloat(group.materialQnty) || 0)).toFixed(2)}
                  </Box>
                </Box>
              )}

              {group.foamPrice && parseFloat(group.foamPrice) > 0 && (
                <Box sx={{ 
                  display: 'flex',
                  borderLeft: '1px solid #ccc',
                  borderRight: '1px solid #ccc',
                  fontSize: '0.8rem',
                  color: '#000000',
                  minHeight: '24px'
                }}>
                  <Box sx={{ flex: 3, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', display: 'flex', alignItems: 'center' }}>
                    Foam{group.foamThickness ? ` (${group.foamThickness}")` : ''}{group.foamNote ? ` - ${group.foamNote}` : ''}
                  </Box>
                  <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    ${(parseFloat(group.foamPrice) || 0).toFixed(2)}
                  </Box>
                  <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    {group.foamQnty || 1}
                  </Box>
                  <Box sx={{ flex: 1, py: 0.25, px: 0.5, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    ${((parseFloat(group.foamPrice) || 0) * (parseFloat(group.foamQnty) || 1)).toFixed(2)}
                  </Box>
                </Box>
              )}

              {group.paintingLabour && parseFloat(group.paintingLabour) > 0 && (
                <Box sx={{ 
                  display: 'flex',
                  borderLeft: '1px solid #ccc',
                  borderRight: '1px solid #ccc',
                  fontSize: '0.8rem',
                  color: '#000000',
                  minHeight: '24px'
                }}>
                  <Box sx={{ flex: 3, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', display: 'flex', alignItems: 'center' }}>
                    Painting{group.paintingNote ? ` - ${group.paintingNote}` : ''}
                  </Box>
                  <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    ${(parseFloat(group.paintingLabour) || 0).toFixed(2)}
                  </Box>
                  <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    {group.paintingQnty || 1}
                  </Box>
                  <Box sx={{ flex: 1, py: 0.25, px: 0.5, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    ${((parseFloat(group.paintingLabour) || 0) * (parseFloat(group.paintingQnty) || 1)).toFixed(2)}
                  </Box>
                </Box>
              )}
            </Box>
          ))}

          {order.paymentData?.pickupDeliveryEnabled && totals.pickupDeliveryCost > 0 && (
            <Box sx={{ 
              display: 'flex',
              border: '1px solid #ccc',
              borderTop: 'none',
              fontSize: '0.8rem',
              color: '#000000',
              minHeight: '24px'
            }}>
              <Box sx={{ flex: 3, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', display: 'flex', alignItems: 'center' }}>
                Pickup & Delivery
              </Box>
              <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                ${totals.pickupDeliveryCost.toFixed(2)}
              </Box>
              <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                1
              </Box>
              <Box sx={{ flex: 1, py: 0.25, px: 0.5, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                ${totals.pickupDeliveryCost.toFixed(2)}
              </Box>
            </Box>
          )}
        </Box>

        {/* Notes and Totals Section */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ mb: 1 }}>
              <Box sx={{ 
                backgroundColor: '#f8f8f8',
                p: 0.5,
                border: '1px solid #ccc',
                borderBottom: 'none',
                fontWeight: 'bold',
                fontSize: '0.8rem',
                color: '#000000'
              }}>
                Internal Notes
              </Box>
              <Box sx={{ 
                border: '1px solid #ccc',
                minHeight: 60,
                p: 1.5,
                fontSize: '0.8rem',
                backgroundColor: '#ffffff',
                color: '#000000'
              }}>
                {order.paymentData?.notes || ''}
              </Box>
            </Box>
            <Box>
              <Box sx={{ 
                backgroundColor: '#f8f8f8',
                p: 0.5,
                border: '1px solid #ccc',
                borderBottom: 'none',
                fontWeight: 'bold',
                fontSize: '0.8rem',
                color: '#000000'
              }}>
                Customer's Item Notes
              </Box>
              <Box sx={{ 
                border: '1px solid #ccc',
                minHeight: 60,
                p: 1.5,
                fontSize: '0.8rem',
                backgroundColor: '#ffffff',
                color: '#000000'
              }}>
                {order.furnitureData?.groups?.filter(group => group.customerNote && group.customerNote.trim() !== '').map(group => (
                  <Box key={group.id || Math.random()} sx={{ mb: 1 }}>
                    <Box sx={{ fontWeight: 'bold', mb: 0.5 }}>
                      {group.furnitureType || 'Furniture Group'}:
                    </Box>
                    <Box sx={{ ml: 1 }}>
                      {group.customerNote}
                    </Box>
                  </Box>
                )) || ''}
              </Box>
            </Box>
          </Box>

          <Box sx={{ width: 300 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, fontSize: '0.8rem', color: '#000000' }}>
              <span>Items Subtotal:</span>
              <span>${totals.itemsSubtotal.toFixed(2)}</span>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, fontSize: '0.8rem', color: '#000000' }}>
              <span>Tax (13% on M&F):</span>
              <span>${totals.taxAmount.toFixed(2)}</span>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, fontSize: '0.8rem', color: '#000000' }}>
              <span>Pickup & Delivery:</span>
              <span>${totals.pickupDeliveryCost.toFixed(2)}</span>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, fontSize: '0.9rem', fontWeight: 'bold', color: '#000000', borderTop: '1px solid #ccc', pt: 0.5 }}>
              <span>Grand Total:</span>
              <span>${totals.grandTotal.toFixed(2)}</span>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, fontSize: '0.8rem', color: '#000000' }}>
              <span>Deposit Paid:</span>
              <span>-${totals.amountPaid.toFixed(2)}</span>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 'bold', color: '#000000', backgroundColor: '#fff3cd', p: 0.5, borderRadius: 0.5 }}>
              <span>Balance Due:</span>
              <span>${totals.balanceDue.toFixed(2)}</span>
            </Box>
          </Box>
        </Box>
      </Box>
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#b98f33', mb: 1 }}>
          <CheckCircleIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#b98f33' }} />
          Completed Orders
        </Typography>
        <Typography variant="body1" sx={{ color: '#ffffff' }}>
          All orders that have been successfully completed and allocated
        </Typography>
      </Box>

      {/* Search Bar */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Search completed orders..."
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#b98f33' }} />
              </InputAdornment>
            ),
            endAdornment: searchTerm && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => handleSearch('')} sx={{ color: '#b98f33' }}>
                  <RefreshIcon />
                </IconButton>
              </InputAdornment>
            )
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              backgroundColor: '#2a2a2a',
              '&:hover fieldset': { borderColor: '#b98f33' },
              '&.Mui-focused fieldset': { borderColor: '#b98f33' }
            },
            '& .MuiInputBase-input': {
              color: '#ffffff'
            },
            '& .MuiInputLabel-root': {
              color: '#b98f33'
            }
          }}
        />
      </Box>

      {/* Orders Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden', backgroundColor: '#2a2a2a', border: '1px solid #333333' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#b98f33' }}>
                <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Invoice #</TableCell>
                <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Customer</TableCell>
                <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Revenue</TableCell>
                <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Cost</TableCell>
                <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Profit</TableCell>
                <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Status</TableCell>
                <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Completed</TableCell>
                <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Alert severity="info">
                      {searchTerm ? 'No completed orders found matching your search' : 'No completed orders found'}
                    </Alert>
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <React.Fragment key={order.id}>
                    <TableRow hover>
                      <TableCell sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                        #{order.orderDetails?.billInvoice || order.id}
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Box display="flex" alignItems="center" gap={1} mb={1}>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#ffffff' }}>
                              {order.orderType === 'corporate' 
                                ? order.corporateCustomer?.corporateName || 'Unknown Corporate'
                                : order.personalInfo?.customerName || 'Unknown Customer'
                              }
                            </Typography>
                            {order.orderType === 'corporate' && (
                              <Chip
                                icon={<BusinessIcon />}
                                label="Corporate"
                                size="small"
                                sx={{
                                  backgroundColor: '#f27921',
                                  color: 'white',
                                  fontSize: '0.7rem',
                                  height: '20px'
                                }}
                              />
                            )}
                          </Box>
                          <Typography variant="caption" sx={{ color: '#b98f33' }}>
                            {order.orderType === 'corporate'
                              ? order.contactPerson?.phone || 'No Phone'
                              : order.personalInfo?.phone || 'No Phone'
                            }
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: '#b98f33', fontWeight: 'bold' }}>
                          {formatCurrency(calculateOrderTotals(order).revenue)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: '#b98f33', fontWeight: 'bold' }}>
                          {formatCurrency(calculateOrderTotals(order).cost)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: '#b98f33', fontWeight: 'bold' }}>
                          {formatCurrency(calculateOrderTotals(order).profit)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getStatusInfo(order.invoiceStatus).label}
                          size="small"
                          sx={{
                            backgroundColor: getStatusInfo(order.invoiceStatus).color,
                            color: 'white',
                            fontWeight: 'bold'
                          }}
                        />
                      </TableCell>
                                             <TableCell>
                         <Typography variant="body2" sx={{ color: '#ffffff' }}>
                           {formatDateDisplay(order.completedAt || order.statusUpdatedAt || order.updatedAt)}
                         </Typography>
                         <Typography variant="caption" sx={{ color: '#b98f33', display: 'block', fontSize: '0.7rem' }}>
                           Status: Done
                         </Typography>
                       </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'center' }}>
                          <Tooltip title="Review Invoice">
                            <IconButton
                              size="small"
                              onClick={() => handleReviewInvoice(order)}
                              sx={{ 
                                color: '#b98f33',
                                '&:hover': {
                                  backgroundColor: 'rgba(185, 143, 51, 0.1)',
                                  color: '#d4af5a'
                                }
                              }}
                            >
                              <VisibilityIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Send Completion Email">
                            <IconButton
                              size="small"
                              onClick={() => {
                                const customerEmail = order.orderType === 'corporate' 
                                  ? order.contactPerson?.email || order.corporateCustomer?.email
                                  : order.personalInfo?.email;
                                
                                if (!customerEmail) {
                                  showError('No customer email available for this order');
                                  return;
                                }
                                
                                setCompletionEmailDialog({
                                  open: true,
                                  sendEmail: true,
                                  includeReview: true,
                                  order: order
                                });
                              }}
                              sx={{ 
                                color: '#b98f33',
                                '&:hover': {
                                  backgroundColor: 'rgba(185, 143, 51, 0.1)',
                                  color: '#d4af5a'
                                }
                              }}
                            >
                              <EmailIcon />
                            </IconButton>
                          </Tooltip>
                          <MuiIconButton
                            size="small"
                            onClick={() => handleRowToggle(order.id)}
                            sx={{ color: '#b98f33' }}
                          >
                            {expandedRows.has(order.id) ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                          </MuiIconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
                        <Collapse in={expandedRows.has(order.id)} timeout="auto" unmountOnExit>
                          <Box sx={{ margin: 1 }}>
                            <Card sx={{ mb: 2 }}>
                              <CardContent>
                                {/* Customer Information */}
                                <Box sx={{ mb: 3 }}>
                                  <Typography variant="h6" sx={{ mb: 2, color: '#b98f33' }}>
                                    <PersonIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#b98f33' }} />
                                    Customer Information
                                  </Typography>
                                  <Card sx={{ 
                                    background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)', 
                                    color: 'white',
                                    boxShadow: 3,
                                    border: '1px solid #333333'
                                  }}>
                                    <CardContent>
                                      <Grid container spacing={3}>
                                        <Grid item xs={12} sm={6}>
                                          <Box sx={{ textAlign: 'center' }}>
                                            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                              {order.personalInfo?.customerName || 'N/A'}
                                            </Typography>
                                            <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                              Customer Name
                                            </Typography>
                                          </Box>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Box sx={{ textAlign: 'center' }}>
                                            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                              {order.personalInfo?.phone || 'N/A'}
                                            </Typography>
                                            <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                              Phone Number
                                            </Typography>
                                          </Box>
                                        </Grid>
                                        <Grid item xs={12}>
                                          <Box sx={{ textAlign: 'center' }}>
                                            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                              {order.personalInfo?.email || 'N/A'}
                                            </Typography>
                                            <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                              Email Address
                                            </Typography>
                                          </Box>
                                        </Grid>
                                        <Grid item xs={12}>
                                          <Box sx={{ textAlign: 'center' }}>
                                            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                              {order.personalInfo?.address || 'N/A'}
                                            </Typography>
                                            <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                              Delivery Address
                                            </Typography>
                                          </Box>
                                        </Grid>
                                      </Grid>
                                    </CardContent>
                                  </Card>
                                </Box>

                                {/* Financial Summary */}
                                <Box sx={{ mb: 3 }}>
                                  <Typography variant="h6" sx={{ mb: 2, color: '#b98f33' }}>
                                    <TrendingUpIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#b98f33' }} />
                                    Financial Summary
                                  </Typography>
                                  <Grid container spacing={2}>
                                    <Grid item xs={12} sm={4}>
                                      <Card sx={{ 
                                        background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)', 
                                        color: 'white',
                                        boxShadow: 3,
                                        border: '1px solid #333333'
                                      }}>
                                        <CardContent sx={{ textAlign: 'center' }}>
                                          <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1, color: '#b98f33' }}>
                                            {formatCurrency(calculateOrderTotals(order).revenue)}
                                          </Typography>
                                          <Typography variant="body2" sx={{ opacity: 0.9, color: '#ffffff' }}>
                                            Total Revenue
                                          </Typography>
                                        </CardContent>
                                      </Card>
                                    </Grid>
                                    <Grid item xs={12} sm={4}>
                                      <Card sx={{ 
                                        background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)', 
                                        color: 'white',
                                        boxShadow: 3,
                                        border: '1px solid #333333'
                                      }}>
                                        <CardContent sx={{ textAlign: 'center' }}>
                                          <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1, color: '#b98f33' }}>
                                            {formatCurrency(calculateOrderTotals(order).cost)}
                                          </Typography>
                                          <Typography variant="body2" sx={{ opacity: 0.9, color: '#ffffff' }}>
                                            Total Cost
                                          </Typography>
                                        </CardContent>
                                      </Card>
                                    </Grid>
                                    <Grid item xs={12} sm={4}>
                                      <Card sx={{ 
                                        background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)', 
                                        color: 'white',
                                        boxShadow: 3,
                                        border: '1px solid #333333'
                                      }}>
                                        <CardContent sx={{ textAlign: 'center' }}>
                                          <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1, color: '#b98f33' }}>
                                            {formatCurrency(calculateOrderTotals(order).profit)}
                                          </Typography>
                                          <Typography variant="body2" sx={{ opacity: 0.9, color: '#ffffff' }}>
                                            Total Profit
                                          </Typography>
                                        </CardContent>
                                      </Card>
                                    </Grid>
                                  </Grid>
                                </Box>

                                {/* Allocation Information */}
                                {getAllocationInfo(order) && (
                                  <Box sx={{ mb: 3 }}>
                                    <Typography variant="h6" sx={{ mb: 2, color: '#b98f33' }}>
                                      <AssignmentIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#b98f33' }} />
                                      Financial Allocation Details
                                    </Typography>
                                    <Card sx={{ 
                                      background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)', 
                                      color: 'white',
                                      boxShadow: 3,
                                      border: '1px solid #333333'
                                    }}>
                                      <CardContent>
                                        <Grid container spacing={3}>
                                          <Grid item xs={12} sm={4}>
                                            <Box sx={{ textAlign: 'center' }}>
                                              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                                {getAllocationInfo(order).totalAllocations}
                                              </Typography>
                                              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                                Month(s) Allocated
                                              </Typography>
                                            </Box>
                                          </Grid>
                                          <Grid item xs={12} sm={4}>
                                            <Box sx={{ textAlign: 'center' }}>
                                              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                                {formatCurrency(getAllocationInfo(order).originalRevenue)}
                                              </Typography>
                                              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                                Original Revenue
                                              </Typography>
                                            </Box>
                                          </Grid>
                                          <Grid item xs={12} sm={4}>
                                            <Box sx={{ textAlign: 'center' }}>
                                              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                                {formatDateDisplay(getAllocationInfo(order).appliedAt)}
                                              </Typography>
                                              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                                Applied Date
                                              </Typography>
                                            </Box>
                                          </Grid>
                                        </Grid>
                                      </CardContent>
                                    </Card>
                                  </Box>
                                )}
                              </CardContent>
                            </Card>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Invoice Preview Dialog */}
      <Dialog 
        open={previewDialogOpen} 
        onClose={() => setPreviewDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#3a3a3a',
            border: '2px solid #b98f33',
            borderRadius: '10px',
            color: '#ffffff',
            maxHeight: '90vh'
          }
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #b98f33 0%, #8b6b1f 100%)',
          color: '#000000',
          fontWeight: 'bold',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #b98f33'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <ReceiptIcon sx={{ color: '#000000', fontSize: 28 }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#000000' }}>
              Invoice Preview - {previewOrder?.orderDetails?.billInvoice || 'N/A'}
            </Typography>
          </Box>
          <IconButton
            onClick={() => setPreviewDialogOpen(false)}
            sx={{
              color: '#000000',
              '&:hover': {
                backgroundColor: 'rgba(0,0,0,0.1)'
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ 
          p: 2,
          backgroundColor: '#3a3a3a',
          overflow: 'auto',
          display: 'flex',
          justifyContent: 'center',
          '&::-webkit-scrollbar': {
            width: '8px'
          },
          '&::-webkit-scrollbar-track': {
            background: '#2a2a2a'
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#b98f33',
            borderRadius: '4px'
          }
        }}>
          <Box sx={{ 
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            overflow: 'hidden'
          }}>
            {renderInvoiceDetails()}
          </Box>
        </DialogContent>
        <DialogActions sx={{ 
          backgroundColor: '#3a3a3a',
          borderTop: '1px solid #b98f33',
          p: 2,
          gap: 2
        }}>
          <Button
            onClick={() => setPreviewDialogOpen(false)}
            sx={{
              color: '#ffffff',
              borderColor: '#666666',
              '&:hover': {
                borderColor: '#b98f33',
                backgroundColor: 'rgba(185, 143, 51, 0.1)'
              }
            }}
            variant="outlined"
          >
            Close
          </Button>
          <Button
            onClick={handlePrint}
            variant="contained"
            startIcon={<PrintIcon />}
            sx={{
              background: 'linear-gradient(135deg, #b98f33 0%, #8b6b1f 100%)',
              color: '#000000',
              fontWeight: 'bold',
              border: '2px solid #8b6b1f',
              boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
              '&:hover': {
                background: 'linear-gradient(135deg, #d4af5a 0%, #b98f33 100%)',
                transform: 'translateY(-1px)',
                boxShadow: '0 6px 12px rgba(0,0,0,0.4)'
              }
            }}
          >
            Print
          </Button>
        </DialogActions>
      </Dialog>

      {/* Completion Email Dialog */}
      <Dialog
        open={completionEmailDialog.open}
        onClose={() => setCompletionEmailDialog({ open: false, sendEmail: false, includeReview: false, order: null })}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#3a3a3a',
            borderRadius: 2,
            border: '2px solid #b98f33',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
          }
        }}
      >
        <DialogTitle sx={{ 
          backgroundColor: '#2a2a2a', 
          color: '#ffffff',
          borderBottom: '2px solid #b98f33',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <EmailIcon sx={{ color: '#b98f33' }} />
          Send Completion Email
        </DialogTitle>
        
        <DialogContent sx={{ mt: 2 }}>
          {completionEmailDialog.order && (
            <Box sx={{ 
              p: 3, 
              backgroundColor: '#2a2a2a', 
              borderRadius: 1, 
              mb: 2,
              border: '1px solid #b98f33'
            }}>
              <Typography variant="h6" sx={{ color: '#b98f33', mb: 1, fontWeight: 'bold' }}>
                Order #{completionEmailDialog.order.orderDetails?.billInvoice || 'N/A'}
              </Typography>
              <Typography variant="body1" sx={{ color: '#ffffff', mb: 1 }}>
                Customer: {completionEmailDialog.order.orderType === 'corporate' 
                  ? (completionEmailDialog.order.corporateCustomer?.corporateName || 'N/A')
                  : (completionEmailDialog.order.personalInfo?.customerName || 'N/A')}
              </Typography>
              <Typography variant="body2" sx={{ color: '#cccccc' }}>
                Email: {completionEmailDialog.order.orderType === 'corporate' 
                  ? (completionEmailDialog.order.contactPerson?.email || completionEmailDialog.order.corporateCustomer?.email || 'N/A')
                  : (completionEmailDialog.order.personalInfo?.email || 'N/A')}
              </Typography>
            </Box>
          )}
          
          <Box sx={{ p: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={completionEmailDialog.sendEmail}
                  onChange={(e) => setCompletionEmailDialog(prev => ({ ...prev, sendEmail: e.target.checked }))}
                  sx={{
                    color: '#b98f33',
                    '&.Mui-checked': {
                      color: '#b98f33',
                    },
                  }}
                />
              }
              label="Send completion email to customer"
              sx={{ 
                color: '#ffffff',
                mb: 1,
                '& .MuiFormControlLabel-label': {
                  fontWeight: 500
                }
              }}
            />
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={completionEmailDialog.includeReview}
                  onChange={(e) => setCompletionEmailDialog(prev => ({ ...prev, includeReview: e.target.checked }))}
                  sx={{
                    color: '#b98f33',
                    '&.Mui-checked': {
                      color: '#b98f33',
                    },
                  }}
                />
              }
              label="Include Google review request"
              sx={{ 
                color: '#ffffff',
                '& .MuiFormControlLabel-label': {
                  fontWeight: 500
                }
              }}
            />
            
            <Typography variant="body2" sx={{ 
              mt: 1, 
              color: '#cccccc', 
              fontStyle: 'italic',
              fontSize: '13px'
            }}>
              The email will include a warm thank you message, treatment care instructions, and a review request.
            </Typography>
          </Box>
        </DialogContent>
        
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => setCompletionEmailDialog({ open: false, sendEmail: false, includeReview: false, order: null })}
            sx={{
              color: '#ffffff',
              borderColor: '#666666',
              '&:hover': {
                borderColor: '#b98f33',
                backgroundColor: 'rgba(185, 143, 51, 0.1)'
              }
            }}
            variant="outlined"
          >
            Cancel
          </Button>
          <Button
            onClick={async () => {
              try {
                const order = completionEmailDialog.order;
                if (!order) return;
                
                setSendingCompletionEmail(true);
                setCompletionEmailDialog({ open: false, sendEmail: false, includeReview: false, order: null });
                
                // Prepare order data for email
                const orderDataForEmail = order.orderType === 'corporate' ? {
                  corporateCustomer: order.corporateCustomer,
                  contactPerson: order.contactPerson,
                  orderDetails: order.orderDetails,
                  furnitureData: {
                    groups: order.furnitureData?.groups || order.furnitureGroups || []
                  },
                  paymentData: order.paymentData
                } : {
                  personalInfo: order.personalInfo,
                  orderDetails: order.orderDetails,
                  furnitureData: {
                    groups: order.furnitureData?.groups || order.furnitureGroups || []
                  },
                  paymentData: order.paymentData
                };

                // Get customer email
                const customerEmail = order.orderType === 'corporate' 
                  ? order.contactPerson?.email || order.corporateCustomer?.email
                  : order.personalInfo?.email;

                // Progress callback for email sending
                const onEmailProgress = (message) => {
                  console.log('📧 Completion email progress:', message);
                  showSuccess(`📧 ${message}`);
                };

                // Send the completion email
                const emailResult = await sendCompletionEmailWithGmail(
                  orderDataForEmail, 
                  customerEmail, 
                  completionEmailDialog.includeReview,
                  onEmailProgress
                );
                
                if (emailResult.success) {
                  showSuccess('✅ Completion email sent successfully!');
                } else {
                  showError(`❌ Failed to send completion email: ${emailResult.message}`);
                }
              } catch (error) {
                console.error('Error sending completion email:', error);
                showError(`Failed to send completion email: ${error.message}`);
              } finally {
                setSendingCompletionEmail(false);
              }
            }}
            variant="contained"
            startIcon={<EmailIcon />}
            disabled={!completionEmailDialog.sendEmail || sendingCompletionEmail}
            sx={{
              background: 'linear-gradient(135deg, #b98f33 0%, #8b6b1f 100%)',
              color: '#000000',
              fontWeight: 'bold',
              border: '2px solid #8b6b1f',
              boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
              '&:hover': {
                background: 'linear-gradient(135deg, #d4af5a 0%, #b98f33 100%)',
                transform: 'translateY(-1px)',
                boxShadow: '0 6px 12px rgba(0,0,0,0.4)'
              },
              '&:disabled': {
                background: '#666666',
                color: '#999999'
              }
            }}
          >
            {sendingCompletionEmail ? 'Sending...' : 'Send Email'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Email Sending Overlay */}
      {sendingCompletionEmail && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white'
          }}
        >
          <CircularProgress size={60} sx={{ color: '#b98f33', mb: 2 }} />
          <Typography variant="h6" sx={{ mb: 1 }}>
            Sending Completion Email...
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.8, textAlign: 'center', maxWidth: 400 }}>
            Please wait while we send the email. This may take a few moments.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default EndDonePage; 