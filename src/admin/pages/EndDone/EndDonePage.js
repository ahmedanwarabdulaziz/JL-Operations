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
  Tooltip
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
  Visibility as VisibilityIcon
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

const EndDonePage = () => {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [invoiceStatuses, setInvoiceStatuses] = useState([]);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [materialTaxRates, setMaterialTaxRates] = useState({});

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
      
      console.log('All orders fetched:', allOrders.length);
      console.log('Regular orders:', ordersData.length);
      console.log('Done orders:', doneOrdersData.length);
      console.log('Done orders data:', doneOrdersData);

      // Filter for orders with "done" end state status
      const doneStatuses = statusesData.filter(status => 
        status.isEndState && status.endStateType === 'done'
      );
      const doneStatusValues = doneStatuses.map(status => status.value);

      const doneOrders = allOrders.filter(order => {
        // For regular orders, check invoiceStatus
        if (order.invoiceStatus) {
          const isRegularDone = doneStatusValues.includes(order.invoiceStatus);
          console.log('Regular order check:', order.orderDetails?.billInvoice, 'invoiceStatus:', order.invoiceStatus, 'isDone:', isRegularDone);
          return isRegularDone;
        }
        // For corporate orders moved to done-orders, check status field
        if (order.status === 'done' || order.orderType === 'corporate') {
          console.log('Corporate order check:', order.orderDetails?.billInvoice, 'status:', order.status, 'orderType:', order.orderType, 'isDone:', true);
          return true;
        }
        console.log('Order not matching any criteria:', order.orderDetails?.billInvoice, 'invoiceStatus:', order.invoiceStatus, 'status:', order.status, 'orderType:', order.orderType);
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
    </Box>
  );
};

export default EndDonePage; 
