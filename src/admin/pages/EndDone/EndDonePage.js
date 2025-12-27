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
  Button
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
  Print as PrintIcon
} from '@mui/icons-material';

import { useNavigate } from 'react-router-dom';
import { useNotification } from '../shared/components/Common/NotificationSystem';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../shared/firebase/config';
import { calculateOrderProfit, calculateOrderTotal, calculateOrderTax, getOrderCostBreakdown, calculatePickupDeliveryCost } from '../shared/utils/orderCalculations';
import { fetchMaterialCompanyTaxRates } from '../shared/utils/materialTaxRates';
import { formatCurrency } from '../shared/utils/plCalculations';
import { formatDate } from '../shared/utils/plCalculations';
import { normalizeAllocation } from '../shared/utils/allocationUtils';
import { formatCorporateInvoiceForInvoice } from '../../../utils/invoiceNumberUtils';

const EndDonePage = () => {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [invoiceStatuses, setInvoiceStatuses] = useState([]);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [materialTaxRates, setMaterialTaxRates] = useState({});
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const navigate = useNavigate();
  const { showError } = useNotification();

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

      // Get all orders from regular orders, done-orders, closed-corporate-orders, and customer-invoices (T-invoices) collections
      const [ordersRef, doneOrdersRef, closedCorporateOrdersRef, customerInvoicesRef] = await Promise.all([
        getDocs(query(collection(db, 'orders'), orderBy('orderDetails.billInvoice', 'desc'))),
        getDocs(query(collection(db, 'done-orders'), orderBy('orderDetails.billInvoice', 'desc'))),
        getDocs(query(collection(db, 'closed-corporate-orders'), orderBy('orderDetails.billInvoice', 'desc'))),
        getDocs(query(collection(db, 'customer-invoices'), orderBy('invoiceNumber', 'desc')))
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

      const closedCorporateOrdersData = closedCorporateOrdersRef.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        orderType: 'corporate',
        source: 'closed-corporate-orders'
      }));

      // Process customer invoices (T-invoices) - include all as they're already completed invoices
      const customerInvoicesData = customerInvoicesRef.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        source: 'customer-invoices',
        orderType: 'customer',
        status: 'closed' // T-invoices are considered closed/completed
      }));

      // Combine all collections
      const allOrders = [...ordersData, ...doneOrdersData, ...closedCorporateOrdersData, ...customerInvoicesData];
      
      console.log('All orders fetched:', allOrders.length);
      console.log('Regular orders:', ordersData.length);
      console.log('Done orders:', doneOrdersData.length);
      console.log('Closed corporate orders:', closedCorporateOrdersData.length);
      console.log('Customer invoices (T-invoices):', customerInvoicesData.length);
      console.log('Sample customer invoice:', customerInvoicesData[0]);

      // Filter for orders with "done" end state status
      const doneStatuses = statusesData.filter(status => 
        status.isEndState && status.endStateType === 'done'
      );
      const doneStatusValues = doneStatuses.map(status => status.value);

      const doneOrders = allOrders.filter(order => {
        // T-invoices from customer-invoices collection are always included (they're completed invoices)
        if (order.source === 'customer-invoices') {
          console.log('T-invoice check:', order.invoiceNumber, 'source:', order.source, 'isDone:', true);
          return true;
        }
        // For regular orders, check invoiceStatus
        if (order.invoiceStatus) {
          const isRegularDone = doneStatusValues.includes(order.invoiceStatus);
          console.log('Regular order check:', order.orderDetails?.billInvoice, 'invoiceStatus:', order.invoiceStatus, 'isDone:', isRegularDone);
          return isRegularDone;
        }
        // For corporate orders from closed-corporate-orders collection
        if (order.source === 'closed-corporate-orders' || order.status === 'closed') {
          console.log('Closed corporate order check:', order.orderDetails?.billInvoice, 'status:', order.status, 'source:', order.source, 'isDone:', true);
          return true;
        }
        // For corporate orders moved to done-orders, check status field
        if (order.status === 'done' || (order.orderType === 'corporate' && !order.invoiceStatus)) {
          console.log('Corporate order check:', order.orderDetails?.billInvoice, 'status:', order.status, 'orderType:', order.orderType, 'isDone:', true);
          return true;
        }
        console.log('Order not matching any criteria:', order.orderDetails?.billInvoice || order.invoiceNumber, 'invoiceStatus:', order.invoiceStatus, 'status:', order.status, 'orderType:', order.orderType, 'source:', order.source);
        return false;
      });

      // Fetch material tax rates
      const taxRates = await fetchMaterialCompanyTaxRates();
      setMaterialTaxRates(taxRates);
      
      console.log('Final done orders:', doneOrders.length);
      console.log('Final done orders data:', doneOrders);
      
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

  // Check if invoice number is T- format
  const isTFormatInvoice = (invoiceNumber) => {
    if (!invoiceNumber) return false;
    const str = String(invoiceNumber).trim();
    return str.toUpperCase().startsWith('T-');
  };

  // Calculate invoice totals for dialog display
  const calculateInvoiceTotals = (order) => {
    if (!order) return { 
      grandTotal: 0, 
      amountPaid: 0, 
      balanceDue: 0,
      subtotal: 0,
      taxAmount: 0
    };
    
    // Check if this is a T-invoice
    const isTInvoice = order.source === 'customer-invoices' || 
                      (order.invoiceNumber && isTFormatInvoice(order.invoiceNumber)) ||
                      (order.orderDetails?.billInvoice && isTFormatInvoice(order.orderDetails.billInvoice));
    
    // For T-invoices, use stored calculations if available
    if (isTInvoice && order.calculations) {
      const grandTotal = order.calculations.total || 0;
      const taxAmount = order.calculations.taxAmount || 0;
      const subtotal = order.calculations.subtotal || 0;
      
      return {
        grandTotal: grandTotal,
        subtotal: subtotal,
        taxAmount: taxAmount,
        amountPaid: order.orderType === 'corporate' 
          ? (order.paymentDetails?.amountPaid || 0)
          : (order.paidAmount || order.paymentData?.amountPaid || 0),
        balanceDue: grandTotal - (order.orderType === 'corporate' 
          ? (order.paymentDetails?.amountPaid || 0)
          : (order.paidAmount || order.paymentData?.amountPaid || 0))
      };
    }
    
    const total = calculateOrderTotal(order);
    const taxAmount = calculateOrderTax(order);
    const subtotal = total - taxAmount;
    const amountPaid = order.orderType === 'corporate' 
      ? (parseFloat(order.paymentDetails?.amountPaid || 0))
      : (parseFloat(order.paymentData?.amountPaid || 0));
    const balanceDue = total - amountPaid;
    
    return {
      grandTotal: total,
      subtotal: subtotal,
      taxAmount: taxAmount,
      amountPaid: amountPaid,
      balanceDue: balanceDue
    };
  };

  // Handle view invoice dialog
  const handleViewInvoice = (order) => {
    try {
      // Force console logs
      console.log('=== VIEW INVOICE CLICKED ===');
      console.log('Viewing invoice - Full object:', order);
      console.log('Viewing invoice - Summary:', {
        id: order.id,
        invoiceNumber: order.invoiceNumber || order.orderDetails?.billInvoice,
        orderType: order.orderType,
        source: order.source,
        hasItems: !!order.items,
        itemsLength: order.items?.length,
        itemsSample: order.items?.slice(0, 2),
        hasFurnitureGroups: !!order.furnitureGroups,
        furnitureGroupsLength: order.furnitureGroups?.length,
        furnitureGroupsSample: order.furnitureGroups?.slice(0, 1),
        hasFurnitureData: !!order.furnitureData,
        furnitureDataGroupsLength: order.furnitureData?.groups?.length,
        furnitureDataGroupsSample: order.furnitureData?.groups?.slice(0, 1),
        allKeys: Object.keys(order)
      });
      alert(`Opening invoice dialog for: ${order.invoiceNumber || order.orderDetails?.billInvoice || order.id}\nCheck console for details.`);
      setSelectedInvoice(order);
      setViewDialogOpen(true);
    } catch (error) {
      console.error('Error in handleViewInvoice:', error);
      alert('Error opening invoice: ' + error.message);
    }
  };

  // Handle print invoice
  const handlePrintInvoice = (order) => {
    handleReviewInvoice(order);
  };

  // Handle review/print preview
  const handleReviewInvoice = (order) => {
    try {
      // Calculate order totals properly
      const taxAmount = calculateOrderTax(order);
      const pickupDeliveryCost = order.paymentData?.pickupDeliveryEnabled ? 
        calculatePickupDeliveryCost(
          parseFloat(order.paymentData.pickupDeliveryCost) || 0,
          order.paymentData.pickupDeliveryServiceType || 'both'
        ) : 0;
      
      const breakdown = getOrderCostBreakdown(order);
      const itemsSubtotal = breakdown.material + breakdown.labour + breakdown.foam + breakdown.painting;
      const grandTotal = itemsSubtotal + taxAmount + pickupDeliveryCost;
      
      // Convert order to invoice format
      // Create customerInfo from order data
      let customerInfo = {};
      if (order.orderType === 'corporate') {
        customerInfo = {
          customerName: order.corporateCustomer?.corporateName || 'N/A',
          phone: order.contactPerson?.phone || '',
          email: order.contactPerson?.email || order.corporateCustomer?.email || '',
          address: order.corporateCustomer?.address || ''
        };
      } else {
        customerInfo = {
          customerName: order.personalInfo?.customerName || 'N/A',
          phone: order.personalInfo?.phone || '',
          email: order.personalInfo?.email || '',
          address: order.personalInfo?.address || ''
        };
      }

      const invoiceData = {
        invoiceNumber: order.orderDetails?.billInvoice || order.id,
        customerInfo: customerInfo,
        personalInfo: order.personalInfo || {},
        corporateCustomer: order.corporateCustomer || {},
        contactPerson: order.contactPerson || {},
        orderDetails: order.orderDetails || {},
        calculations: {
          subtotal: parseFloat(itemsSubtotal.toFixed(2)),
          taxAmount: parseFloat(taxAmount.toFixed(2)),
          total: parseFloat(grandTotal.toFixed(2)),
          paidAmount: order.orderType === 'corporate' 
            ? (parseFloat(order.paymentDetails?.amountPaid || 0))
            : (parseFloat(order.paymentData?.amountPaid || 0)),
          creditCardFeeAmount: 0
        },
        headerSettings: {
          taxPercentage: 13,
          creditCardFeeEnabled: false
        },
        items: [],
        furnitureData: order.furnitureData || { groups: [] }
      };

      // Convert furniture groups to invoice items
      if (order.furnitureData?.groups) {
        order.furnitureData.groups.forEach(group => {
          // Add material item
          if (group.materialPrice && group.materialQnty) {
            invoiceData.items.push({
              name: `${group.furnitureName || 'Furniture'} - Material`,
              price: parseFloat(group.materialPrice || 0),
              quantity: parseFloat(group.materialQnty || 0)
            });
          }
          
          // Add labour item
          if (group.labourPrice && group.labourQnty) {
            invoiceData.items.push({
              name: `${group.furnitureName || 'Furniture'} - Labour`,
              price: parseFloat(group.labourPrice || 0),
              quantity: parseFloat(group.labourQnty || 0)
            });
          }
          
          // Add foam item if enabled
          if ((group.foamEnabled || group.foamPrice) && group.foamQnty) {
            invoiceData.items.push({
              name: `${group.furnitureName || 'Furniture'} - Foam`,
              price: parseFloat(group.foamPrice || 0),
              quantity: parseFloat(group.foamQnty || 0)
            });
          }
          
          // Add painting item if enabled
          if ((group.paintingEnabled || group.paintingLabour) && group.paintingQnty) {
            invoiceData.items.push({
              name: `${group.furnitureName || 'Furniture'} - Painting`,
              price: parseFloat(group.paintingLabour || 0),
              quantity: parseFloat(group.paintingQnty || 0)
            });
          }
        });
      }
      
      // Add pickup/delivery as an item if enabled
      if (order.paymentData?.pickupDeliveryEnabled && pickupDeliveryCost > 0) {
        invoiceData.items.push({
          name: 'Pickup & Delivery',
          price: parseFloat(pickupDeliveryCost.toFixed(2)),
          quantity: 1
        });
      }

      // Navigate to print invoice page
      navigate('/admin/customer-invoices/print', {
        state: { invoiceData }
      });
    } catch (error) {
      console.error('Error preparing invoice preview:', error);
      showError('Failed to open invoice preview');
    }
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
        {/* DEBUG: Test button */}
        <Button 
          onClick={() => {
            console.log('TEST BUTTON CLICKED');
            alert('Test button works!');
            if (filteredOrders.length > 0) {
              console.log('First order:', filteredOrders[0]);
              handleViewInvoice(filteredOrders[0]);
            }
          }}
          variant="contained"
          sx={{ mt: 2, backgroundColor: '#b98f33' }}
        >
          TEST: Click to Test View Invoice
        </Button>
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
                        #{order.invoiceNumber || order.orderDetails?.billInvoice || order.id}
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
                       </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'center' }}>
                          {(() => {
                            const invoiceNumber = order.orderDetails?.billInvoice || order.invoiceNumber;
                            const isTInvoice = invoiceNumber && isTFormatInvoice(invoiceNumber);
                            const isCorporate = order.orderType === 'corporate';
                            const isCustomerInvoice = order.source === 'customer-invoices';
                            
                            // DEBUG: Always show view button for testing
                            const shouldShowView = isCorporate || isTInvoice || isCustomerInvoice;
                            
                            console.log('Button render check:', {
                              invoiceNumber,
                              isTInvoice,
                              isCorporate,
                              isCustomerInvoice,
                              shouldShowView,
                              source: order.source,
                              orderType: order.orderType,
                              orderId: order.id
                            });
                            
                            // Show view dialog for corporate invoices, T-invoices, and customer-invoices
                            return (
                              <Tooltip title={shouldShowView ? "View Invoice" : "Review Invoice"}>
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    window.testClick = true;
                                    console.log('=== BUTTON CLICKED ===');
                                    console.log('Invoice number:', invoiceNumber);
                                    console.log('Order:', order);
                                    alert('Button clicked! Invoice: ' + invoiceNumber);
                                    if (shouldShowView) {
                                      handleViewInvoice(order);
                                    } else {
                                      handleReviewInvoice(order);
                                    }
                                  }}
                                  sx={{ 
                                    color: '#b98f33',
                                    backgroundColor: shouldShowView ? 'rgba(185, 143, 51, 0.2)' : 'transparent',
                                    '&:hover': {
                                      backgroundColor: 'rgba(185, 143, 51, 0.3)',
                                      color: '#d4af5a'
                                    }
                                  }}
                                >
                                  <VisibilityIcon />
                                </IconButton>
                              </Tooltip>
                            );
                          })()}
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
                                        {order.orderType === 'corporate' ? (
                                          <>
                                            <Grid item xs={12} sm={6}>
                                              <Box sx={{ textAlign: 'center' }}>
                                                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                                  {order.corporateCustomer?.corporateName || 'N/A'}
                                                </Typography>
                                                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                                  Corporate Name
                                                </Typography>
                                              </Box>
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                              <Box sx={{ textAlign: 'center' }}>
                                                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                                  {order.contactPerson?.name || 'N/A'}
                                                </Typography>
                                                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                                  Contact Person
                                                </Typography>
                                              </Box>
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                              <Box sx={{ textAlign: 'center' }}>
                                                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                                  {order.contactPerson?.phone || 'N/A'}
                                                </Typography>
                                                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                                  Phone Number
                                                </Typography>
                                              </Box>
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                              <Box sx={{ textAlign: 'center' }}>
                                                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                                  {order.contactPerson?.email || 'N/A'}
                                                </Typography>
                                                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                                  Email Address
                                                </Typography>
                                              </Box>
                                            </Grid>
                                          </>
                                        ) : (
                                          <>
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
                                          </>
                                        )}
                                        <Grid item xs={12}>
                                          <Box sx={{ textAlign: 'center' }}>
                                            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                              {order.orderType === 'corporate' 
                                                ? order.corporateCustomer?.address || 'N/A'
                                                : order.personalInfo?.address || 'N/A'
                                              }
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
                                          <Grid item xs={12} sm={3}>
                                            <Box sx={{ textAlign: 'center' }}>
                                              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                                {getAllocationInfo(order).totalAllocations}
                                              </Typography>
                                              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                                Month(s) Allocated
                                              </Typography>
                                            </Box>
                                          </Grid>
                                          <Grid item xs={12} sm={3}>
                                            <Box sx={{ textAlign: 'center' }}>
                                              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                                {formatCurrency(getAllocationInfo(order).originalRevenue)}
                                              </Typography>
                                              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                                Original Revenue
                                              </Typography>
                                            </Box>
                                          </Grid>
                                          <Grid item xs={12} sm={3}>
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

                                {/* Completion Details */}
                                <Box>
                                  <Typography variant="h6" sx={{ mb: 2, color: '#b98f33' }}>
                                    <CheckCircleIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#b98f33' }} />
                                    Completion Details
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
                                               {formatDateDisplay(order.completedAt || order.statusUpdatedAt || order.updatedAt)}
                                             </Typography>
                                            <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                              Order Completed
                                            </Typography>
                                          </Box>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Box sx={{ textAlign: 'center' }}>
                                                                                         <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                               {formatDateDisplay(order.statusUpdatedAt || order.updatedAt || order.completedAt)}
                                             </Typography>
                                            <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                              Status Updated
                                            </Typography>
                                          </Box>
                                        </Grid>
                                      </Grid>
                                    </CardContent>
                                  </Card>
                                </Box>
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

      {/* View Invoice Dialog */}
      <Dialog 
        open={viewDialogOpen} 
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {(() => {
            if (!selectedInvoice) return 'Invoice - N/A';
            const invoiceNumber = selectedInvoice.invoiceNumber || selectedInvoice.orderDetails?.billInvoice;
            const isTInvoice = invoiceNumber && isTFormatInvoice(invoiceNumber);
            const status = selectedInvoice.status === 'closed' ? 'Closed' : 'Completed';
            return `Invoice #${formatCorporateInvoiceForInvoice(invoiceNumber) || 'N/A'} - ${status} Invoice`;
          })()}
        </DialogTitle>
        <DialogContent>
          {selectedInvoice && (() => {
            console.log('=== DIALOG RENDERING ===');
            console.log('selectedInvoice:', selectedInvoice);
            
            const isTInvoice = selectedInvoice.source === 'customer-invoices' || 
                              (selectedInvoice.invoiceNumber && isTFormatInvoice(selectedInvoice.invoiceNumber)) ||
                              (selectedInvoice.orderDetails?.billInvoice && isTFormatInvoice(selectedInvoice.orderDetails.billInvoice));
            
            console.log('isTInvoice:', isTInvoice);
            
            // Get items based on invoice type - check all possible locations
            let invoiceItems = [];
            let furnitureGroups = [];
            
            console.log('Dialog - Processing invoice data:', {
              isTInvoice,
              hasItems: !!selectedInvoice.items,
              itemsLength: selectedInvoice.items?.length,
              hasFurnitureGroups: !!selectedInvoice.furnitureGroups,
              furnitureGroupsLength: selectedInvoice.furnitureGroups?.length,
              hasFurnitureData: !!selectedInvoice.furnitureData,
              furnitureDataGroupsLength: selectedInvoice.furnitureData?.groups?.length,
              orderType: selectedInvoice.orderType,
              source: selectedInvoice.source,
              invoiceNumber: selectedInvoice.invoiceNumber || selectedInvoice.orderDetails?.billInvoice
            });
            
            // Log sample furniture group to see structure
            if (selectedInvoice.furnitureGroups && selectedInvoice.furnitureGroups.length > 0) {
              console.log('Sample furniture group:', selectedInvoice.furnitureGroups[0]);
            }
            if (selectedInvoice.furnitureData?.groups && selectedInvoice.furnitureData.groups.length > 0) {
              console.log('Sample furnitureData group:', selectedInvoice.furnitureData.groups[0]);
            }
            
            // Check all possible locations for items/furniture data
            // For T-invoices: use items array with furnitureGroups for grouping
            // For corporate invoices: use furnitureGroups with material/labour/foam/painting data
            
            if (isTInvoice && selectedInvoice.items && Array.isArray(selectedInvoice.items) && selectedInvoice.items.length > 0) {
              // T-invoice: use items array
              invoiceItems = selectedInvoice.items.filter(item => item && !item.isGroup && (item.name || item.description));
              console.log('T-invoice - Using items array:', invoiceItems);
            } else {
              // Corporate invoice or regular order: use furnitureGroups
              if (selectedInvoice.furnitureGroups && Array.isArray(selectedInvoice.furnitureGroups) && selectedInvoice.furnitureGroups.length > 0) {
                furnitureGroups = selectedInvoice.furnitureGroups.filter(group => group && (
                  group.furnitureType || 
                  group.materialPrice || 
                  group.labourPrice || 
                  group.foamPrice || 
                  group.paintingLabour ||
                  group.materialCode
                ));
                console.log('Using furnitureGroups:', furnitureGroups);
              } else if (selectedInvoice.furnitureData?.groups && Array.isArray(selectedInvoice.furnitureData.groups) && selectedInvoice.furnitureData.groups.length > 0) {
                furnitureGroups = selectedInvoice.furnitureData.groups.filter(group => group && (
                  group.furnitureType || 
                  group.furnitureName ||
                  group.materialPrice || 
                  group.labourPrice || 
                  group.foamPrice || 
                  group.paintingLabour
                ));
                console.log('Using furnitureData.groups:', furnitureGroups);
              }
            }
            
            // Debug: log what we found
            console.log('Final data for display:', {
              isTInvoice,
              invoiceItemsLength: invoiceItems.length,
              furnitureGroupsLength: furnitureGroups.length,
              firstItem: invoiceItems[0],
              firstGroup: furnitureGroups[0]
            });
            
            console.log('Final data for display:', {
              invoiceItemsLength: invoiceItems.length,
              furnitureGroupsLength: furnitureGroups.length
            });
            
            return (
              <Box>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" sx={{ mb: 1 }}>Customer Information</Typography>
                    <Typography><strong>Name:</strong> {selectedInvoice.orderType === 'corporate' 
                      ? (selectedInvoice.corporateCustomer?.corporateName || selectedInvoice.customerInfo?.customerName || selectedInvoice.originalCustomerInfo?.customerName || 'N/A')
                      : (selectedInvoice.personalInfo?.customerName || selectedInvoice.customerInfo?.customerName || selectedInvoice.originalCustomerInfo?.customerName || 'N/A')
                    }</Typography>
                    <Typography><strong>Phone:</strong> {selectedInvoice.orderType === 'corporate'
                      ? (selectedInvoice.contactPerson?.phone || selectedInvoice.customerInfo?.phone || selectedInvoice.originalCustomerInfo?.phone || 'N/A')
                      : (selectedInvoice.personalInfo?.phone || selectedInvoice.customerInfo?.phone || selectedInvoice.originalCustomerInfo?.phone || 'N/A')
                    }</Typography>
                    <Typography><strong>Email:</strong> {selectedInvoice.orderType === 'corporate'
                      ? (selectedInvoice.contactPerson?.email || selectedInvoice.customerInfo?.email || selectedInvoice.originalCustomerInfo?.email || 'N/A')
                      : (selectedInvoice.personalInfo?.email || selectedInvoice.customerInfo?.email || selectedInvoice.originalCustomerInfo?.email || 'N/A')
                    }</Typography>
                    <Typography><strong>Address:</strong> {selectedInvoice.orderType === 'corporate'
                      ? (selectedInvoice.corporateCustomer?.address || selectedInvoice.customerInfo?.address || selectedInvoice.originalCustomerInfo?.address || 'N/A')
                      : (selectedInvoice.personalInfo?.address || selectedInvoice.customerInfo?.address || selectedInvoice.originalCustomerInfo?.address || 'N/A')
                    }</Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" sx={{ mb: 1 }}>Invoice Details</Typography>
                    <Typography><strong>Invoice #:</strong> {formatCorporateInvoiceForInvoice(selectedInvoice.invoiceNumber || selectedInvoice.orderDetails?.billInvoice) || 'N/A'}</Typography>
                    <Typography><strong>Status:</strong> 
                      <Chip
                        label={selectedInvoice.status === 'closed' ? 'Closed' : 'Completed'}
                        size="small"
                        color={selectedInvoice.status === 'closed' ? 'success' : 'success'}
                        sx={{ ml: 1 }}
                      />
                    </Typography>
                    <Typography><strong>Date Completed:</strong> {formatDateDisplay(selectedInvoice.closedAt || selectedInvoice.completedAt || selectedInvoice.statusUpdatedAt || selectedInvoice.updatedAt)}</Typography>
                    <Typography><strong>Subtotal:</strong> {formatCurrency(calculateInvoiceTotals(selectedInvoice).subtotal)}</Typography>
                    <Typography><strong>Tax (13%):</strong> {formatCurrency(calculateInvoiceTotals(selectedInvoice).taxAmount)}</Typography>
                    <Typography><strong>Total Amount:</strong> {formatCurrency(calculateInvoiceTotals(selectedInvoice).grandTotal)}</Typography>
                    <Typography><strong>Amount Paid:</strong> {formatCurrency(calculateInvoiceTotals(selectedInvoice).amountPaid)}</Typography>
                  </Grid>
                  
                  {/* Invoice Items */}
                  <Grid item xs={12}>
                    <Typography variant="h6" sx={{ mb: 1, mt: 2, fontWeight: 'bold', color: '#274290' }}>Items & Services</Typography>
                    <TableContainer component={Paper} sx={{ maxHeight: 400, border: '1px solid #ddd' }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f8f9fa', color: '#274290', fontSize: '14px', textTransform: 'uppercase' }}>Description</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 'bold', backgroundColor: '#f8f9fa', color: '#274290', fontSize: '14px', textTransform: 'uppercase' }}>Price</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 'bold', backgroundColor: '#f8f9fa', color: '#274290', fontSize: '14px', textTransform: 'uppercase' }}>Qty</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: '#f8f9fa', color: '#274290', fontSize: '14px', textTransform: 'uppercase' }}>Total</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(() => {
                            // For T-invoices: combine items with furnitureGroups
                            if (isTInvoice && invoiceItems.length > 0) {
                              const furnitureGroups = selectedInvoice.furnitureGroups || [];
                              const rows = [];
                              
                              // Group items by furniture group
                              const itemsByGroup = {};
                              invoiceItems.forEach(item => {
                                const match = item.id?.match(/item-(\d+)-/);
                                const groupIndex = match ? parseInt(match[1]) : -1;
                                if (groupIndex >= 0 && groupIndex < furnitureGroups.length) {
                                  if (!itemsByGroup[groupIndex]) {
                                    itemsByGroup[groupIndex] = [];
                                  }
                                  itemsByGroup[groupIndex].push(item);
                                }
                              });
                              
                              // Render groups with items
                              if (furnitureGroups.length > 0 && Object.keys(itemsByGroup).length > 0) {
                                furnitureGroups.forEach((group, groupIndex) => {
                                  // Group header
                                  rows.push(
                                    <TableRow key={`group-${groupIndex}`} sx={{ backgroundColor: '#f8f9fa' }}>
                                      <TableCell colSpan={4} sx={{ fontWeight: 'bold', color: '#274290', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px', py: 1 }}>
                                        {group.name || `Furniture Group ${groupIndex + 1}`}
                                      </TableCell>
                                    </TableRow>
                                  );
                                  
                                  // Items in this group
                                  const groupItems = itemsByGroup[groupIndex] || [];
                                  groupItems.forEach((item, itemIndex) => (
                                    rows.push(
                                      <TableRow key={item.id || `item-${groupIndex}-${itemIndex}`}>
                                        <TableCell sx={{ color: '#333333' }}>{item.name || item.description}</TableCell>
                                        <TableCell align="center" sx={{ color: '#333333' }}>{formatCurrency(item.price || 0)}</TableCell>
                                        <TableCell align="center" sx={{ color: '#333333' }}>{item.quantity || item.qty || 1}</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#333333' }}>
                                          {formatCurrency((parseFloat(item.price || 0) * parseFloat(item.quantity || item.qty || 1)))}
                                        </TableCell>
                                      </TableRow>
                                    )
                                  ));
                                });
                                
                                // Add ungrouped items
                                const ungroupedItems = invoiceItems.filter(item => {
                                  const match = item.id?.match(/item-(\d+)-/);
                                  const groupIndex = match ? parseInt(match[1]) : -1;
                                  return groupIndex < 0 || groupIndex >= furnitureGroups.length;
                                });
                                
                                ungroupedItems.forEach((item, index) => (
                                  rows.push(
                                    <TableRow key={item.id || `ungrouped-${index}`}>
                                      <TableCell sx={{ color: '#333333' }}>{item.name || item.description}</TableCell>
                                      <TableCell align="center" sx={{ color: '#333333' }}>{formatCurrency(item.price || 0)}</TableCell>
                                      <TableCell align="center" sx={{ color: '#333333' }}>{item.quantity || item.qty || 1}</TableCell>
                                      <TableCell align="right" sx={{ fontWeight: 'bold', color: '#333333' }}>
                                        {formatCurrency((parseFloat(item.price || 0) * parseFloat(item.quantity || item.qty || 1)))}
                                      </TableCell>
                                    </TableRow>
                                  )
                                ));
                                
                                return rows;
                              } else {
                                // Fallback: show items without grouping
                                return invoiceItems.map((item, index) => (
                                  <TableRow key={item.id || `item-${index}`}>
                                    <TableCell sx={{ color: '#333333' }}>{item.name || item.description}</TableCell>
                                    <TableCell align="center" sx={{ color: '#333333' }}>{formatCurrency(item.price || 0)}</TableCell>
                                    <TableCell align="center" sx={{ color: '#333333' }}>{item.quantity || item.qty || 1}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 'bold', color: '#333333' }}>
                                      {formatCurrency((parseFloat(item.price || 0) * parseFloat(item.quantity || item.qty || 1)))}
                                    </TableCell>
                                  </TableRow>
                                ));
                              }
                            } else if (furnitureGroups.length > 0) {
                              // Corporate invoices: render from furnitureGroups (matching TaxedInvoicesPage style)
                              const rows = [];
                              furnitureGroups.forEach((group, groupIndex) => {
                                // Furniture Group Header
                                if (group.furnitureType) {
                                  rows.push(
                                    <TableRow key={`group-header-${groupIndex}`} sx={{ backgroundColor: '#f8f9fa' }}>
                                      <TableCell colSpan={4} sx={{ fontWeight: 'bold', color: '#274290', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px', py: 1 }}>
                                        {group.furnitureType}
                                      </TableCell>
                                    </TableRow>
                                  );
                                }
                                
                                // Material
                                if (group.materialPrice && group.materialQnty && parseFloat(group.materialPrice) > 0) {
                                  const materialName = group.materialCode 
                                    ? `${group.materialCompany || 'Material'} - ${group.materialCode}`
                                    : (group.materialCompany || 'Material');
                                  rows.push(
                                    <TableRow key={`material-${groupIndex}`}>
                                      <TableCell sx={{ color: '#333333' }}>{materialName}</TableCell>
                                      <TableCell align="center" sx={{ color: '#333333' }}>{formatCurrency(group.materialPrice)}</TableCell>
                                      <TableCell align="center" sx={{ color: '#333333' }}>{group.materialQnty || group.materialQuantity || 1}</TableCell>
                                      <TableCell align="right" sx={{ fontWeight: 'bold', color: '#333333' }}>
                                        {formatCurrency((parseFloat(group.materialPrice) || 0) * (parseFloat(group.materialQnty || group.materialQuantity) || 1))}
                                      </TableCell>
                                    </TableRow>
                                  );
                                }
                                
                                // Labour
                                if (group.labourPrice && parseFloat(group.labourPrice) > 0) {
                                  const labourName = group.labourNote ? `Labour Work - ${group.labourNote}` : 'Labour Work';
                                  rows.push(
                                    <TableRow key={`labour-${groupIndex}`}>
                                      <TableCell sx={{ color: '#333333' }}>{labourName}</TableCell>
                                      <TableCell align="center" sx={{ color: '#333333' }}>{formatCurrency(group.labourPrice)}</TableCell>
                                      <TableCell align="center" sx={{ color: '#333333' }}>{group.labourQnty || group.labourQuantity || 1}</TableCell>
                                      <TableCell align="right" sx={{ fontWeight: 'bold', color: '#333333' }}>
                                        {formatCurrency((parseFloat(group.labourPrice) || 0) * (parseFloat(group.labourQnty || group.labourQuantity) || 1))}
                                      </TableCell>
                                    </TableRow>
                                  );
                                }
                                
                                // Foam
                                if (group.foamEnabled && group.foamPrice && group.foamQnty && parseFloat(group.foamPrice) > 0) {
                                  const foamName = group.foamNote ? `Foam - ${group.foamNote}` : 'Foam';
                                  rows.push(
                                    <TableRow key={`foam-${groupIndex}`}>
                                      <TableCell sx={{ color: '#333333' }}>{foamName}</TableCell>
                                      <TableCell align="center" sx={{ color: '#333333' }}>{formatCurrency(group.foamPrice)}</TableCell>
                                      <TableCell align="center" sx={{ color: '#333333' }}>{group.foamQnty || group.foamQuantity || 1}</TableCell>
                                      <TableCell align="right" sx={{ fontWeight: 'bold', color: '#333333' }}>
                                        {formatCurrency((parseFloat(group.foamPrice) || 0) * (parseFloat(group.foamQnty || group.foamQuantity) || 1))}
                                      </TableCell>
                                    </TableRow>
                                  );
                                }
                                
                                // Painting
                                if (group.paintingEnabled && group.paintingLabour && group.paintingQnty && parseFloat(group.paintingLabour) > 0) {
                                  const paintingName = group.paintingNote ? `Painting - ${group.paintingNote}` : 'Painting';
                                  rows.push(
                                    <TableRow key={`painting-${groupIndex}`}>
                                      <TableCell sx={{ color: '#333333' }}>{paintingName}</TableCell>
                                      <TableCell align="center" sx={{ color: '#333333' }}>{formatCurrency(group.paintingLabour)}</TableCell>
                                      <TableCell align="center" sx={{ color: '#333333' }}>{group.paintingQnty || group.paintingQuantity || 1}</TableCell>
                                      <TableCell align="right" sx={{ fontWeight: 'bold', color: '#333333' }}>
                                        {formatCurrency((parseFloat(group.paintingLabour) || 0) * (parseFloat(group.paintingQnty || group.paintingQuantity) || 1))}
                                      </TableCell>
                                    </TableRow>
                                  );
                                }
                              });
                              
                              return rows.length > 0 ? rows : (
                                <TableRow>
                                  <TableCell colSpan={4} align="center" sx={{ fontStyle: 'italic', color: '#666', py: 3 }}>
                                    No items found
                                  </TableCell>
                                </TableRow>
                              );
                            } else {
                              // Debug: Show what data we have
                              console.log('No items found - showing debug info');
                              console.log('selectedInvoice keys:', Object.keys(selectedInvoice));
                              console.log('selectedInvoice.items:', selectedInvoice.items);
                              console.log('selectedInvoice.furnitureGroups:', selectedInvoice.furnitureGroups);
                              console.log('selectedInvoice.furnitureData:', selectedInvoice.furnitureData);
                              
                              return (
                                <TableRow>
                                  <TableCell colSpan={4} align="center" sx={{ fontStyle: 'italic', color: '#666', py: 3 }}>
                                    No items found
                                    <Box sx={{ mt: 2, fontSize: '0.75rem', color: '#999', textAlign: 'left', p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                                      <Typography variant="caption" component="div">
                                        <strong>Debug Info:</strong><br/>
                                        Source: {selectedInvoice.source || 'N/A'}<br/>
                                        Order Type: {selectedInvoice.orderType || 'N/A'}<br/>
                                        Has items array: {selectedInvoice.items ? `Yes (${selectedInvoice.items.length} items)` : 'No'}<br/>
                                        Has furnitureGroups: {selectedInvoice.furnitureGroups ? `Yes (${selectedInvoice.furnitureGroups.length} groups)` : 'No'}<br/>
                                        Has furnitureData: {selectedInvoice.furnitureData ? 'Yes' : 'No'}<br/>
                                        Invoice Number: {selectedInvoice.invoiceNumber || selectedInvoice.orderDetails?.billInvoice || 'N/A'}
                                      </Typography>
                                    </Box>
                                  </TableCell>
                                </TableRow>
                              );
                            }
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Grid>
                </Grid>
              </Box>
            );
          })()}
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
    </Box>
  );
};

export default EndDonePage; 
