import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  InputAdornment,
  CircularProgress,
  Button,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Search as SearchIcon,
  AccountBalance as AccountBalanceIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  Close as CloseIcon,
  Print as PrintIcon
} from '@mui/icons-material';
import { collection, getDocs, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNotification } from '../../components/Common/NotificationSystem';
import { calculateOrderTotal, calculateJLCostAnalysisBeforeTax } from '../../utils/orderCalculations';
import { fetchMaterialCompanyTaxRates } from '../../utils/materialTaxRates';
import { buttonStyles } from '../../styles/buttonStyles';
import { formatDateOnly, toDateObject } from '../../utils/dateUtils';
import { CheckCircle, Cancel } from '@mui/icons-material';
import { generateInvoicePreviewHtml, calculateInvoiceTotals } from '../../shared/utils/invoicePreview';

const FinancePage = () => {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [materialTaxRates, setMaterialTaxRates] = useState({});
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewOrder, setPreviewOrder] = useState(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [invoiceStatuses, setInvoiceStatuses] = useState([]);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [editingStatus, setEditingStatus] = useState(null);

  const { showError, showSuccess } = useNotification();

  // Fetch invoice statuses from Firebase
  const fetchInvoiceStatuses = async () => {
    try {
      const statusesRef = collection(db, 'invoiceStatuses');
      const querySnapshot = await getDocs(statusesRef);
      const statusesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort by sortOrder
      statusesData.sort((a, b) => (a.sortOrder || 1) - (b.sortOrder || 1));
      setInvoiceStatuses(statusesData);
    } catch (error) {
      console.error('Error fetching invoice statuses:', error);
      // Fallback to default statuses if database fetch fails
      setInvoiceStatuses([
        { value: 'in_progress', label: 'In Progress', color: '#2196f3' },
        { value: 'done', label: 'Done', color: '#4caf50' }
      ]);
    }
  };

  // Fetch orders and material tax rates from Firebase
  const fetchOrders = async () => {
    try {
      setLoading(true);
      
      // Fetch regular orders, corporate orders, and material tax rates
      const [ordersSnapshot, corporateOrdersSnapshot, taxRates] = await Promise.all([
        getDocs(query(collection(db, 'orders'), orderBy('orderDetails.billInvoice', 'desc'))),
        getDocs(query(collection(db, 'corporate-orders'), orderBy('orderDetails.billInvoice', 'desc'))),
        fetchMaterialCompanyTaxRates()
      ]);
      
      // Set material tax rates
      setMaterialTaxRates(taxRates);
      
      // Map regular orders
      const regularOrders = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        orderType: 'regular',
        // Add default invoice status if not present
        invoiceStatus: doc.data().invoiceStatus || 'in_progress'
      }));
      
      // Map corporate orders
      const corporateOrders = corporateOrdersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        orderType: 'corporate',
        // Add default invoice status if not present
        invoiceStatus: doc.data().invoiceStatus || 'in_progress'
      }));
      
      // Combine all orders
      const allOrders = [...regularOrders, ...corporateOrders];
      
      // Sort by invoice number descending
      allOrders.sort((a, b) => {
        const invoiceA = a.orderDetails?.billInvoice || '';
        const invoiceB = b.orderDetails?.billInvoice || '';
        return invoiceB.localeCompare(invoiceA);
      });
      
      setOrders(allOrders);
      setFilteredOrders(allOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      showError('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  // Calculate all totals for an order (Invoice, Cost, Profit)
  const calculateOrderFinancials = (order) => {
    // Normalize payment data for corporate orders (they use paymentDetails instead of paymentData)
    const paymentData = order.orderType === 'corporate' 
      ? (order.paymentDetails || {})
      : (order.paymentData || {});
    
    const normalizedOrder = {
      ...order,
      paymentData: paymentData
    };
    
    // Calculate invoice total (customer-facing total including tax)
    const invoiceTotal = calculateOrderTotal(normalizedOrder);
    
    // Calculate cost total: JL Cost Analysis Total (before tax)
    const costTotal = calculateJLCostAnalysisBeforeTax(normalizedOrder);
    
    // Calculate profit
    const profit = invoiceTotal - costTotal;

    return {
      invoiceTotal,
      costTotal,
      profit
    };
  };

  // Format currency
  const formatCurrency = (amount) => {
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  // Format allocation details for tooltip
  const formatAllocationDetails = (order) => {
    if (!order.allocation || !order.allocation.allocations || order.allocation.allocations.length === 0) {
      return 'No allocation data';
    }

    const allocations = order.allocation.allocations;
    const financials = calculateOrderFinancials(order);
    
    // Format month key (e.g., "2024-01" -> "January 2024")
    const formatMonthKey = (monthKey) => {
      const [year, month] = monthKey.split('-');
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                          'July', 'August', 'September', 'October', 'November', 'December'];
      return `${monthNames[parseInt(month) - 1]} ${year}`;
    };

    let details = 'Allocation Details:\n\n';
    
    allocations.forEach((allocation, index) => {
      const revenue = allocation.revenue !== undefined 
        ? allocation.revenue 
        : financials.invoiceTotal * (allocation.percentage / 100);
      const cost = allocation.costs !== undefined 
        ? allocation.costs 
        : financials.costTotal * (allocation.percentage / 100);
      const profit = allocation.profit !== undefined 
        ? allocation.profit 
        : revenue - cost;

      details += `${formatMonthKey(allocation.monthKey)}:\n`;
      details += `  Percentage: ${allocation.percentage.toFixed(2)}%\n`;
      if (allocation.days !== undefined) {
        details += `  Days: ${allocation.days}\n`;
      }
      details += `  Revenue: ${formatCurrency(revenue)}\n`;
      details += `  Cost: ${formatCurrency(cost)}\n`;
      details += `  Profit: ${formatCurrency(profit)}\n`;
      
      if (index < allocations.length - 1) {
        details += '\n';
      }
    });

    return details;
  };

  // Handle invoice preview
  const handlePreviewInvoice = (order) => {
    try {
      setPreviewOrder(order);
      
      // Normalize order structure for invoice preview
      // Corporate orders use furnitureGroups, regular orders use furnitureData.groups
      const normalizedOrder = {
        ...order,
        paymentData: order.orderType === 'corporate' 
          ? (order.paymentDetails || {})
          : (order.paymentData || {}),
        // Normalize furniture data structure
        furnitureData: order.orderType === 'corporate' && order.furnitureGroups
          ? { groups: order.furnitureGroups }
          : (order.furnitureData || { groups: [] }),
        // Normalize personal info for corporate orders
        personalInfo: order.orderType === 'corporate'
          ? {
              customerName: order.corporateCustomer?.corporateName || 'N/A',
              email: order.contactPerson?.email || order.corporateCustomer?.email || '',
              phone: order.contactPerson?.phone || order.corporateCustomer?.phone || '',
              address: order.corporateCustomer?.address || ''
            }
          : (order.personalInfo || {})
      };
      
      // Generate invoice preview HTML
      const totals = calculateInvoiceTotals(normalizedOrder, materialTaxRates);
      const html = generateInvoicePreviewHtml(normalizedOrder, totals, materialTaxRates);
      setPreviewHtml(html);
      
      setPreviewDialogOpen(true);
    } catch (error) {
      console.error('Error generating invoice preview:', error);
      showError('Failed to generate invoice preview');
    }
  };

  // Handle print
  const handlePrint = () => {
    if (!previewHtml) return;
    
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      showError('Unable to open print window. Pop-up might be blocked.');
      return;
    }
    
    printWindow.document.write(previewHtml);
    printWindow.document.close();
    
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  // Get available years and months from orders
  const getAvailableYearsAndMonths = () => {
    const yearMonthMap = new Map();
    
    orders.forEach(order => {
      const startDate = order.orderDetails?.startDate || order.createdAt;
      let orderDate;
      
      try {
        if (startDate?.toDate) {
          orderDate = startDate.toDate();
        } else if (startDate) {
          orderDate = new Date(startDate);
        } else {
          return;
        }
        
        const year = orderDate.getFullYear();
        const month = orderDate.getMonth() + 1; // 1-12
        
        if (!yearMonthMap.has(year)) {
          yearMonthMap.set(year, new Set());
        }
        yearMonthMap.get(year).add(month);
      } catch (error) {
        console.error('Error processing date:', error);
      }
    });
    
    // Convert to sorted arrays
    const years = Array.from(yearMonthMap.keys()).sort((a, b) => b - a);
    const monthsByYear = {};
    years.forEach(year => {
      monthsByYear[year] = Array.from(yearMonthMap.get(year)).sort((a, b) => a - b);
    });
    
    return { years, monthsByYear };
  };

  // Handle year selection
  const handleYearClick = (year) => {
    if (selectedYear === year) {
      setSelectedYear(null);
      setSelectedMonths([]);
    } else {
      setSelectedYear(year);
      setSelectedMonths([]);
    }
  };

  // Handle month selection
  const handleMonthClick = (month) => {
    setSelectedMonths(prev => {
      if (prev.includes(month)) {
        return prev.filter(m => m !== month);
      } else {
        return [...prev, month];
      }
    });
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSelectedYear(null);
    setSelectedMonths([]);
  };

  // Search and filter logic
  useEffect(() => {
    let filtered = orders;
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.orderDetails?.billInvoice?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply year/month filter
    if (selectedYear !== null) {
      filtered = filtered.filter(order => {
        const startDate = order.orderDetails?.startDate || order.createdAt;
        let orderDate;
        
        try {
          if (startDate?.toDate) {
            orderDate = startDate.toDate();
          } else if (startDate) {
            orderDate = new Date(startDate);
          } else {
            return false;
          }
          
          const orderYear = orderDate.getFullYear();
          const orderMonth = orderDate.getMonth() + 1;
          
          if (orderYear !== selectedYear) {
            return false;
          }
          
          if (selectedMonths.length > 0 && !selectedMonths.includes(orderMonth)) {
            return false;
          }
          
          return true;
        } catch (error) {
          console.error('Error filtering by date:', error);
          return false;
        }
      });
    }
    
    setFilteredOrders(filtered);
  }, [searchTerm, orders, selectedYear, selectedMonths]);

  // Get status info for display
  const getStatusInfo = (status) => {
    const statusObj = invoiceStatuses.find(s => s.value === status);
    if (statusObj) {
      return {
        label: statusObj.label,
        color: statusObj.color || '#757575'
      };
    }
    return {
      label: status || 'Unknown',
      color: '#757575'
    };
  };

  // Update invoice status
  const updateInvoiceStatus = async (orderId, newStatus, orderType) => {
    try {
      const order = orders.find(o => o.id === orderId);
      const newStatusObj = invoiceStatuses.find(s => s.value === newStatus);
      
      if (!order || !newStatusObj) {
        showError('Order or status not found');
        return;
      }

      // Update in Firebase
      const collectionName = orderType === 'corporate' ? 'corporate-orders' : 'orders';
      const orderRef = doc(db, collectionName, orderId);
      await updateDoc(orderRef, { invoiceStatus: newStatus });
      
      // Update local state
      const updatedOrders = orders.map(order =>
        order.id === orderId ? { ...order, invoiceStatus: newStatus } : order
      );
      setOrders(updatedOrders);
      
      showSuccess('Invoice status updated successfully');
      setStatusDialogOpen(false);
      setEditingStatus(null);
      setSelectedOrder(null);
    } catch (error) {
      console.error('Error updating invoice status:', error);
      showError('Failed to update invoice status');
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchInvoiceStatuses();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  // Calculate totals for all orders
  const grandTotals = filteredOrders.reduce((acc, order) => {
    const financials = calculateOrderFinancials(order);
    acc.invoiceTotal += financials.invoiceTotal;
    acc.costTotal += financials.costTotal;
    acc.profit += financials.profit;
    return acc;
  }, {
    invoiceTotal: 0,
    costTotal: 0,
    profit: 0
  });

  return (
    <Box sx={{ p: 3, backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <AccountBalanceIcon sx={{ fontSize: 32, color: '#b98f33', mr: 2 }} />
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
            Finance
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={fetchOrders}
          sx={buttonStyles.primaryButton}
        >
          Refresh
        </Button>
      </Box>

      {/* Year/Month Filter Cards */}
      {(() => {
        const { years, monthsByYear } = getAvailableYearsAndMonths();
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        return (
          <Paper sx={{ p: 2, mb: 3, border: '1px solid #333333', backgroundColor: '#2a2a2a' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ color: '#b98f33', fontWeight: 'bold' }}>
                Filter by Year & Month
              </Typography>
              {(selectedYear !== null || selectedMonths.length > 0) && (
                <Button
                  size="small"
                  onClick={handleClearFilters}
                  sx={{
                    color: '#b98f33',
                    borderColor: '#b98f33',
                    '&:hover': {
                      borderColor: '#d4af5a',
                      backgroundColor: 'rgba(185, 143, 51, 0.1)'
                    }
                  }}
                  variant="outlined"
                >
                  Clear Filters
                </Button>
              )}
            </Box>
            
            {/* Years */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ color: '#ffffff', mb: 1 }}>
                Years:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {years.map(year => (
                  <Chip
                    key={year}
                    label={year}
                    onClick={() => handleYearClick(year)}
                    sx={{
                      backgroundColor: selectedYear === year ? '#b98f33' : '#3a3a3a',
                      color: selectedYear === year ? '#000000' : '#ffffff',
                      fontWeight: selectedYear === year ? 'bold' : 'normal',
                      border: selectedYear === year ? '2px solid #8b6b1f' : '1px solid #555555',
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: selectedYear === year ? '#d4af5a' : '#4a4a4a',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                      },
                      transition: 'all 0.2s ease'
                    }}
                  />
                ))}
              </Box>
            </Box>
            
            {/* Months for selected year */}
            {selectedYear !== null && monthsByYear[selectedYear] && (
              <Box>
                <Typography variant="subtitle2" sx={{ color: '#ffffff', mb: 1 }}>
                  Months for {selectedYear}:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {monthsByYear[selectedYear].map(month => (
                    <Chip
                      key={month}
                      label={monthNames[month - 1]}
                      onClick={() => handleMonthClick(month)}
                      sx={{
                        backgroundColor: selectedMonths.includes(month) ? '#b98f33' : '#3a3a3a',
                        color: selectedMonths.includes(month) ? '#000000' : '#ffffff',
                        fontWeight: selectedMonths.includes(month) ? 'bold' : 'normal',
                        border: selectedMonths.includes(month) ? '2px solid #8b6b1f' : '1px solid #555555',
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: selectedMonths.includes(month) ? '#d4af5a' : '#4a4a4a',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                        },
                        transition: 'all 0.2s ease'
                      }}
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Paper>
        );
      })()}

      {/* Search */}
      <Paper sx={{ p: 2, mb: 3, border: '1px solid #333333', backgroundColor: '#2a2a2a' }}>
        <TextField
          fullWidth
          placeholder="Search by invoice number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#b98f33' }} />
              </InputAdornment>
            )
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              color: '#ffffff',
              '& fieldset': { borderColor: '#333333' },
              '&:hover fieldset': { borderColor: '#b98f33' },
              '&.Mui-focused fieldset': { borderColor: '#b98f33' }
            },
            '& .MuiInputBase-input::placeholder': {
              color: '#888888'
            }
          }}
        />
      </Paper>

      {/* Orders Table */}
      <TableContainer component={Paper} sx={{ boxShadow: 2, backgroundColor: '#2a2a2a' }}>
        <Table>
          <TableHead sx={{ backgroundColor: '#b98f33' }}>
            <TableRow>
              <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Invoice Number</TableCell>
              <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Start Date</TableCell>
              <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Allocation</TableCell>
              <TableCell sx={{ color: '#000000', fontWeight: 'bold' }} align="right">Total Invoice</TableCell>
              <TableCell sx={{ color: '#000000', fontWeight: 'bold' }} align="right">Total Cost</TableCell>
              <TableCell sx={{ color: '#000000', fontWeight: 'bold' }} align="right">Profit</TableCell>
              <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Status</TableCell>
              <TableCell sx={{ color: '#000000', fontWeight: 'bold' }} align="center">View</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredOrders.map((order) => {
              const financials = calculateOrderFinancials(order);
              
              // Get customer info based on order type
              const customerName = order.orderType === 'corporate'
                ? (order.corporateCustomer?.corporateName || 'N/A')
                : (order.personalInfo?.customerName || 'N/A');
              
              const customerEmail = order.orderType === 'corporate'
                ? (order.contactPerson?.email || order.corporateCustomer?.email || 'No email')
                : (order.personalInfo?.email || 'No email');
              
              const customerPhone = order.orderType === 'corporate'
                ? (order.contactPerson?.phone || order.corporateCustomer?.phone || 'No phone')
                : (order.personalInfo?.phone || 'No phone');
              
              const customerDetails = `${customerName} | ${customerEmail} | ${customerPhone}`;
              
              // Check if order has allocation
              const hasAllocation = order.allocation && order.allocation.allocations && order.allocation.allocations.length > 0;
              
              // Get start date
              const startDate = order.orderDetails?.startDate || order.createdAt;
              
              return (
                <TableRow key={order.id} hover>
                  <TableCell>
                    <Tooltip title={customerDetails} arrow>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#b98f33', cursor: 'help' }}>
                        {order.orderDetails?.billInvoice || 'N/A'}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="body2" sx={{ color: '#ffffff' }}>
                      {formatDateOnly(startDate)}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Tooltip 
                      title={hasAllocation ? formatAllocationDetails(order) : 'No allocation'}
                      arrow
                      placement="right"
                      componentsProps={{
                        tooltip: {
                          sx: {
                            backgroundColor: '#2a2a2a',
                            border: '1px solid #b98f33',
                            color: '#ffffff',
                            fontSize: '0.875rem',
                            whiteSpace: 'pre-line',
                            maxWidth: '400px',
                            '& .MuiTooltip-arrow': {
                              color: '#2a2a2a',
                              '&::before': {
                                border: '1px solid #b98f33'
                              }
                            }
                          }
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: hasAllocation ? 'help' : 'default' }}>
                        {hasAllocation ? (
                          <>
                            <CheckCircle sx={{ fontSize: 18, color: '#4caf50' }} />
                            <Typography variant="body2" sx={{ color: '#4caf50', fontWeight: 'bold' }}>
                              Yes
                            </Typography>
                          </>
                        ) : (
                          <>
                            <Cancel sx={{ fontSize: 18, color: '#757575' }} />
                            <Typography variant="body2" sx={{ color: '#757575' }}>
                              No
                            </Typography>
                          </>
                        )}
                      </Box>
                    </Tooltip>
                  </TableCell>
                  
                  <TableCell align="right">
                    <Typography variant="body1" sx={{ color: '#ffffff' }}>
                      {formatCurrency(financials.invoiceTotal)}
                    </Typography>
                  </TableCell>
                  
                  <TableCell align="right">
                    <Typography variant="body1" sx={{ color: '#ffffff' }}>
                      {formatCurrency(financials.costTotal)}
                    </Typography>
                  </TableCell>
                  
                  <TableCell align="right">
                    <Typography 
                      variant="body1" 
                      sx={{ 
                        fontWeight: 'bold', 
                        color: financials.profit >= 0 ? '#4caf50' : '#f44336' 
                      }}
                    >
                      {formatCurrency(financials.profit)}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    {(() => {
                      const statusInfo = getStatusInfo(order.invoiceStatus);
                      return (
                        <Chip
                          label={statusInfo.label}
                          onClick={() => {
                            setSelectedOrder(order);
                            setEditingStatus(order.invoiceStatus);
                            setStatusDialogOpen(true);
                          }}
                          sx={{
                            backgroundColor: statusInfo.color,
                            color: 'white',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            '&:hover': {
                              opacity: 0.8,
                              transform: 'scale(1.05)'
                            },
                            transition: 'all 0.2s ease'
                          }}
                        />
                      );
                    })()}
                  </TableCell>
                  
                  <TableCell align="center">
                    <Tooltip title="View Invoice" arrow>
                      <IconButton
                        onClick={() => handlePreviewInvoice(order)}
                        sx={{
                          color: '#b98f33',
                          '&:hover': {
                            backgroundColor: 'rgba(185, 143, 51, 0.1)'
                          }
                        }}
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
            
            {/* Grand Totals Row */}
            {filteredOrders.length > 0 && (
              <TableRow sx={{ backgroundColor: '#3a3a3a', '& td': { borderTop: '2px solid #b98f33' } }}>
                <TableCell>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                    GRAND TOTAL
                  </Typography>
                </TableCell>
                <TableCell colSpan={2}></TableCell>
                <TableCell align="right">
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                    {formatCurrency(grandTotals.invoiceTotal)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                    {formatCurrency(grandTotals.costTotal)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography 
                    variant="subtitle1" 
                    sx={{ 
                      fontWeight: 'bold', 
                      color: grandTotals.profit >= 0 ? '#4caf50' : '#f44336' 
                    }}
                  >
                    {formatCurrency(grandTotals.profit)}
                  </Typography>
                </TableCell>
                <TableCell colSpan={2}></TableCell>
              </TableRow>
            )}
            
            {filteredOrders.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Typography variant="body1" sx={{ color: '#888888' }}>
                    {searchTerm ? 'No invoices found matching your search.' : 'No invoices found.'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

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
            <AccountBalanceIcon sx={{ color: '#000000', fontSize: 28 }} />
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
            overflow: 'hidden',
            width: '100%'
          }}>
            <iframe
              srcDoc={previewHtml}
              style={{
                width: '100%',
                minHeight: '600px',
                border: 'none',
                display: 'block'
              }}
              title="Invoice Preview"
            />
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

      {/* Status Update Dialog */}
      <Dialog 
        open={statusDialogOpen} 
        onClose={() => {
          setStatusDialogOpen(false);
          setSelectedOrder(null);
          setEditingStatus(null);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#2a2a2a',
            border: '2px solid #b98f33',
            borderRadius: '10px'
          }
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #b98f33 0%, #8b6b1f 100%)',
          color: '#000000',
          fontWeight: 'bold',
          borderBottom: '1px solid #b98f33'
        }}>
          Update Invoice Status
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {selectedOrder && (
            <Box>
              <Typography variant="body2" sx={{ color: '#ffffff', mb: 2 }}>
                Invoice: <strong>{selectedOrder.orderDetails?.billInvoice || 'N/A'}</strong>
              </Typography>
              <FormControl fullWidth>
                <InputLabel sx={{ color: '#ffffff' }}>Status</InputLabel>
                <Select
                  value={editingStatus || selectedOrder.invoiceStatus || 'in_progress'}
                  onChange={(e) => setEditingStatus(e.target.value)}
                  label="Status"
                  sx={{
                    color: '#ffffff',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#555555'
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#b98f33'
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#b98f33'
                    },
                    '& .MuiSvgIcon-root': {
                      color: '#ffffff'
                    }
                  }}
                >
                  {invoiceStatuses.map((status) => (
                    <MenuItem key={status.value} value={status.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            backgroundColor: status.color || '#757575'
                          }}
                        />
                        {status.label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #333333' }}>
          <Button
            onClick={() => {
              setStatusDialogOpen(false);
              setSelectedOrder(null);
              setEditingStatus(null);
            }}
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
            onClick={() => {
              if (selectedOrder && editingStatus) {
                updateInvoiceStatus(selectedOrder.id, editingStatus, selectedOrder.orderType);
              }
            }}
            variant="contained"
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
            Update Status
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FinancePage;
