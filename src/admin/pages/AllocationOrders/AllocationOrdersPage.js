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
  Tooltip,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  Assignment as AssignmentIcon,
  CalendarToday as CalendarIcon,
  TrendingUp as TrendingUpIcon,
  AccountBalance as AccountBalanceIcon,
  FilterList as FilterListIcon,
  Timeline as TimelineIcon,
  CheckCircle as CheckCircleIcon,
  Settings as SettingsIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../../shared/firebase/config';
import { useNotification } from '../../../shared/components/Common/NotificationSystem';
import { calculateOrderProfit, normalizePaymentData } from '../../../shared/utils/orderCalculations';
import { formatCurrency, formatPercentage } from '../../../shared/utils/plCalculations';
import { fetchMaterialCompanyTaxRates } from '../../../shared/utils/materialTaxRates';

const AllocationOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [allocationMethodFilter, setAllocationMethodFilter] = useState('all');
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [materialTaxRates, setMaterialTaxRates] = useState({});
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState(null);

  const { showError } = useNotification();

  // Fetch orders with allocation data
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch regular orders
      const ordersRef = collection(db, 'orders');
      const ordersQuery = query(ordersRef, orderBy('orderDetails.billInvoice', 'desc'));
      const ordersSnapshot = await getDocs(ordersQuery);
      const ordersData = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        orderType: 'regular'
      }));

      // Fetch corporate orders
      const corporateOrdersRef = collection(db, 'corporate-orders');
      const corporateOrdersQuery = query(corporateOrdersRef, orderBy('orderDetails.billInvoice', 'desc'));
      const corporateOrdersSnapshot = await getDocs(corporateOrdersQuery);
      const corporateOrdersData = corporateOrdersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        orderType: 'corporate'
      }));

      // Combine all orders
      const allOrders = [...ordersData, ...corporateOrdersData];

      // Filter orders that have allocation data across multiple months
      // Exclude single-month orders as they don't need allocation handling
      const allocatedOrders = allOrders.filter(order => {
        if (!order.allocation || !order.allocation.allocations || order.allocation.allocations.length === 0) {
          return false;
        }
        // Filter out 0% allocations and check if there's more than one month
        const validAllocations = order.allocation.allocations.filter(alloc => alloc.percentage > 0.01);
        return validAllocations.length > 1; // Only show orders allocated across multiple months
      });

      // Fetch material tax rates
      const taxRates = await fetchMaterialCompanyTaxRates();
      setMaterialTaxRates(taxRates);

      setOrders(allocatedOrders);
      setFilteredOrders(allocatedOrders);
    } catch (error) {
      console.error('Error fetching allocation orders:', error);
      showError('Failed to fetch allocation orders');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Handle search and filters
  useEffect(() => {
    let filtered = [...orders];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(order => {
        const customerName = order.orderType === 'corporate'
          ? (order.corporateCustomer?.corporateName || '')
          : (order.personalInfo?.customerName || '');
        const billInvoice = order.orderDetails?.billInvoice || '';
        
        return customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
               billInvoice.toLowerCase().includes(searchTerm.toLowerCase());
      });
    }

    // Apply allocation method filter
    if (allocationMethodFilter !== 'all') {
      filtered = filtered.filter(order => {
        const method = order.allocation?.method || 'unknown';
        return method === allocationMethodFilter;
      });
    }

    setFilteredOrders(filtered);
  }, [searchTerm, allocationMethodFilter, orders]);

  // Toggle row expansion
  const toggleRowExpansion = (orderId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedRows(newExpanded);
  };

  // Deduplicate allocations by monthKey, combining percentages
  const deduplicateAllocations = (rawAllocations) => {
    const allocationsMap = new Map();
    
    rawAllocations.forEach(alloc => {
      // Always prefer constructing monthKey from month/year if available
      // This fixes the bug where monthKey was created incorrectly (0-indexed month used directly)
      let monthKey = null;
      let monthNum = null;
      
      if (alloc.month !== undefined && alloc.year !== undefined) {
        // month is stored as 1-indexed (1-12) in new format
        monthNum = typeof alloc.month === 'number' ? alloc.month : parseInt(alloc.month);
        // Handle both 0-indexed (old format) and 1-indexed (new format)
        if (monthNum >= 0 && monthNum <= 11) {
          // Old format: 0-indexed, convert to 1-indexed
          monthNum = monthNum + 1;
        }
        // Ensure month is between 1-12
        if (monthNum >= 1 && monthNum <= 12) {
          monthKey = `${alloc.year}-${String(monthNum).padStart(2, '0')}`;
        }
      } else if (alloc.monthKey) {
        // Fallback to existing monthKey if month/year not available
        monthKey = alloc.monthKey;
        const parts = monthKey.split('-');
        if (parts.length >= 2) {
          monthNum = parseInt(parts[1]);
        }
      }
      
      if (monthKey && monthNum >= 1 && monthNum <= 12) {
        // Normalize monthKey format
        const parts = monthKey.split('-');
        if (parts.length >= 2) {
          const normalizedKey = `${parts[0]}-${String(monthNum).padStart(2, '0')}`;
          
          if (allocationsMap.has(normalizedKey)) {
            // Combine percentages if duplicate monthKey found
            const existing = allocationsMap.get(normalizedKey);
            existing.percentage += alloc.percentage;
            existing.revenue = (existing.revenue || 0) + (alloc.revenue || 0);
            existing.cost = (existing.cost || 0) + (alloc.cost || 0);
            existing.profit = (existing.profit || 0) + (alloc.profit || 0);
            // Update days if available
            if (alloc.days) {
              existing.days = (existing.days || 0) + alloc.days;
            }
          } else {
            // Create new entry with normalized monthKey, ensuring month and year are set
            allocationsMap.set(normalizedKey, {
              ...alloc,
              month: monthNum,
              year: alloc.year || parseInt(normalizedKey.split('-')[0]),
              monthKey: normalizedKey
            });
          }
        }
      } else {
        console.warn('Skipping allocation with invalid month data:', alloc);
      }
    });
    
    // Convert map back to array and sort by monthKey for consistent display
    return Array.from(allocationsMap.values()).sort((a, b) => {
      if (a.monthKey && b.monthKey) {
        return a.monthKey.localeCompare(b.monthKey);
      }
      return 0;
    });
  };

  // Format month key to readable format (handles both monthKey string and allocation object)
  const formatMonthKey = (monthKeyOrAllocation) => {
    let monthKey = monthKeyOrAllocation;
    
    // If it's an allocation object, extract monthKey
    if (monthKeyOrAllocation && typeof monthKeyOrAllocation === 'object') {
      monthKey = monthKeyOrAllocation.monthKey;
      // If no monthKey, generate from month and year
      if (!monthKey && monthKeyOrAllocation.month !== undefined && monthKeyOrAllocation.year !== undefined) {
        monthKey = `${monthKeyOrAllocation.year}-${String(monthKeyOrAllocation.month).padStart(2, '0')}`;
      }
    }
    
    if (!monthKey) return 'N/A';
    try {
      const parts = monthKey.split('-');
      if (parts.length < 2) {
        console.warn('Invalid monthKey format:', monthKey);
        return 'N/A';
      }
      const year = parts[0];
      let month = parseInt(parts[1]);
      
      // Handle both 0-indexed (0-11) and 1-indexed (1-12) months
      // If month is 0, it's invalid (should be 1-12), so try to handle it
      if (month === 0) {
        console.warn('Month is 0 in monthKey (likely 0-indexed), treating as January:', monthKey);
        month = 1; // Treat 0 as January (month 1)
      }
      
      if (isNaN(month) || month < 1 || month > 12) {
        console.warn('Invalid month number:', month, 'from monthKey:', monthKey);
        return 'N/A';
      }
      
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                          'July', 'August', 'September', 'October', 'November', 'December'];
      return `${monthNames[month - 1]} ${year}`;
    } catch (error) {
      console.error('Error formatting monthKey:', error, monthKey);
      return 'N/A';
    }
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
      let dateObj;
      if (date.toDate) {
        dateObj = date.toDate();
      } else if (date instanceof Date) {
        dateObj = date;
      } else {
        dateObj = new Date(date);
      }
      
      // Check if date is valid
      if (isNaN(dateObj.getTime())) {
        return 'N/A';
      }
      
      const formatted = dateObj.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
      
      // Check if formatting returned a valid string
      return formatted && formatted !== 'Invalid Date' ? formatted : 'N/A';
    } catch (error) {
      console.error('Error formatting date:', error, date);
      return 'N/A';
    }
  };

  // Calculate order totals
  const getOrderTotals = (order) => {
    // Normalize order structure for consistent calculations
    // Corporate orders use furnitureGroups and paymentDetails
    // Regular orders use furnitureData.groups and paymentData
    let normalizedOrder = { ...order };
    
    if (order.orderType === 'corporate') {
      normalizedOrder = {
        ...order,
        furnitureData: {
          groups: order.furnitureGroups || []
        },
        paymentData: order.paymentDetails || {}
      };
    } else {
      normalizedOrder = {
        ...order,
        furnitureData: order.furnitureData || { groups: [] },
        paymentData: order.paymentData || {}
      };
    }
    
    const profitData = calculateOrderProfit(normalizedOrder, materialTaxRates);
    return profitData;
  };

  // Calculate allocation summary
  const getAllocationSummary = () => {
    const totalOrders = filteredOrders.length;
    const timeBasedCount = filteredOrders.filter(o => o.allocation?.method === 'time-based').length;
    const manualCount = filteredOrders.filter(o => o.allocation?.method === 'manual').length;
    
    let totalRevenue = 0;
    let totalCost = 0;
    let totalProfit = 0;

    filteredOrders.forEach(order => {
      const totals = getOrderTotals(order);
      totalRevenue += totals.revenue;
      totalCost += totals.cost;
      totalProfit += totals.profit;
    });

    return {
      totalOrders,
      timeBasedCount,
      manualCount,
      totalRevenue,
      totalCost,
      totalProfit
    };
  };

  const summary = getAllocationSummary();

  // Handle detail dialog
  const handleViewDetails = (order) => {
    setSelectedOrderForDetail(order);
    setDetailDialogOpen(true);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={60} sx={{ color: '#b98f33' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#b98f33', mb: 1 }}>
          <TimelineIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#b98f33' }} />
          Allocation Orders
        </Typography>
        <Typography variant="body1" sx={{ color: '#ffffff' }}>
          View and manage orders with allocation details across multiple periods
        </Typography>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ backgroundColor: '#2a2a2a', border: '1px solid #b98f33' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <AssignmentIcon sx={{ color: '#b98f33', mr: 1 }} />
                <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                  Total Orders
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ color: '#b98f33', fontWeight: 'bold' }}>
                {summary.totalOrders}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ backgroundColor: '#2a2a2a', border: '1px solid #4caf50' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <CheckCircleIcon sx={{ color: '#4caf50', mr: 1 }} />
                <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                  Time-Based
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ color: '#4caf50', fontWeight: 'bold' }}>
                {summary.timeBasedCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ backgroundColor: '#2a2a2a', border: '1px solid #2196f3' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <SettingsIcon sx={{ color: '#2196f3', mr: 1 }} />
                <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                  Manual
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ color: '#2196f3', fontWeight: 'bold' }}>
                {summary.manualCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ backgroundColor: '#2a2a2a', border: '1px solid #ff9800' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <TrendingUpIcon sx={{ color: '#ff9800', mr: 1 }} />
                <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                  Total Revenue
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ color: '#ff9800', fontWeight: 'bold' }}>
                {formatCurrency(summary.totalRevenue)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters and Search */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          placeholder="Search by customer name or bill invoice..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#b98f33' }} />
              </InputAdornment>
            ),
            endAdornment: searchTerm && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchTerm('')} sx={{ color: '#b98f33' }}>
                  <RefreshIcon />
                </IconButton>
              </InputAdornment>
            )
          }}
          sx={{
            flexGrow: 1,
            minWidth: 300,
            '& .MuiOutlinedInput-root': {
              backgroundColor: '#2a2a2a',
              color: '#ffffff',
              '& fieldset': {
                borderColor: '#b98f33',
              },
              '&:hover fieldset': {
                borderColor: '#d4af37',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#b98f33',
              },
            },
            '& .MuiInputBase-input::placeholder': {
              color: '#999',
            },
          }}
        />

        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel sx={{ color: '#b98f33' }}>Allocation Method</InputLabel>
          <Select
            value={allocationMethodFilter}
            onChange={(e) => setAllocationMethodFilter(e.target.value)}
            label="Allocation Method"
            sx={{
              backgroundColor: '#2a2a2a',
              color: '#ffffff',
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: '#b98f33',
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: '#d4af37',
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: '#b98f33',
              },
              '& .MuiSvgIcon-root': {
                color: '#b98f33',
              },
            }}
          >
            <MenuItem value="all">All Methods</MenuItem>
            <MenuItem value="time-based">Time-Based</MenuItem>
            <MenuItem value="manual">Manual</MenuItem>
          </Select>
        </FormControl>

        <IconButton
          onClick={fetchOrders}
          sx={{
            backgroundColor: '#b98f33',
            color: '#000000',
            '&:hover': {
              backgroundColor: '#d4af37',
            },
          }}
        >
          <RefreshIcon />
        </IconButton>
      </Box>

      {/* Orders Table */}
      {filteredOrders.length === 0 ? (
        <Alert severity="info" sx={{ backgroundColor: '#2a2a2a', color: '#ffffff' }}>
          No allocation orders found. Orders with allocation data will appear here.
        </Alert>
      ) : (
        <TableContainer component={Paper} sx={{ backgroundColor: '#2a2a2a', borderRadius: 2 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#1a1a1a' }}>
                <TableCell sx={{ color: '#b98f33', fontWeight: 'bold', width: 50 }}></TableCell>
                <TableCell sx={{ color: '#b98f33', fontWeight: 'bold' }}>Bill Invoice</TableCell>
                <TableCell sx={{ color: '#b98f33', fontWeight: 'bold' }}>Customer</TableCell>
                <TableCell sx={{ color: '#b98f33', fontWeight: 'bold' }}>Method</TableCell>
                <TableCell sx={{ color: '#b98f33', fontWeight: 'bold' }}>Period</TableCell>
                <TableCell sx={{ color: '#b98f33', fontWeight: 'bold' }}>Allocations</TableCell>
                <TableCell sx={{ color: '#b98f33', fontWeight: 'bold' }}>Total Revenue</TableCell>
                <TableCell sx={{ color: '#b98f33', fontWeight: 'bold' }}>Applied At</TableCell>
                <TableCell sx={{ color: '#b98f33', fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredOrders.map((order) => {
                const isExpanded = expandedRows.has(order.id);
                const totals = getOrderTotals(order);
                const allocation = order.allocation;
                // Read dates from dateRange if available, otherwise fall back to startDate/endDate
                const startDate = allocation?.dateRange?.startDate || allocation?.startDate;
                const endDate = allocation?.dateRange?.endDate || allocation?.endDate;
                // Filter out allocations with 0% or very small percentages (< 0.01%)
                const rawAllocations = (allocation?.allocations || []).filter(alloc => alloc.percentage > 0.01);
                // Deduplicate allocations by monthKey
                const allocations = deduplicateAllocations(rawAllocations);

                return (
                  <React.Fragment key={order.id}>
                    <TableRow
                      sx={{
                        '&:hover': { backgroundColor: '#333333' },
                        cursor: 'pointer',
                      }}
                    >
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => toggleRowExpansion(order.id)}
                          sx={{ color: '#b98f33' }}
                        >
                          {isExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                        </IconButton>
                      </TableCell>
                      <TableCell sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                        {order.orderDetails?.billInvoice || 'N/A'}
                      </TableCell>
                      <TableCell sx={{ color: '#ffffff' }}>
                        {order.orderType === 'corporate'
                          ? (order.corporateCustomer?.corporateName || 'N/A')
                          : (order.personalInfo?.customerName || 'N/A')}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={allocation?.method === 'manual' ? 'Manual' : 'Time-Based'}
                          size="small"
                          sx={{
                            backgroundColor: allocation?.method === 'manual' ? '#2196f3' : '#4caf50',
                            color: '#ffffff',
                            fontWeight: 'bold',
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ color: '#ffffff' }}>
                        {startDate && endDate
                          ? (() => {
                              const start = formatDate(startDate);
                              const end = formatDate(endDate);
                              return start !== 'N/A' && end !== 'N/A' 
                                ? `${start} - ${end}` 
                                : 'N/A';
                            })()
                          : 'N/A'}
                      </TableCell>
                      <TableCell sx={{ color: '#ffffff' }}>
                        {allocations.length} month{allocations.length !== 1 ? 's' : ''}
                      </TableCell>
                      <TableCell sx={{ color: '#b98f33', fontWeight: 'bold' }}>
                        {formatCurrency(totals.revenue)}
                      </TableCell>
                      <TableCell sx={{ color: '#ffffff' }}>
                        {allocation?.appliedAt ? formatDate(allocation.appliedAt) : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => handleViewDetails(order)}
                            sx={{ color: '#b98f33' }}
                          >
                            <AssignmentIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={9} sx={{ py: 0, border: 0 }}>
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ p: 3, backgroundColor: '#1a1a1a' }}>
                            <Typography variant="h6" sx={{ color: '#b98f33', mb: 2 }}>
                              Allocation Breakdown
                            </Typography>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ color: '#b98f33', fontWeight: 'bold' }}>Period</TableCell>
                                  <TableCell sx={{ color: '#b98f33', fontWeight: 'bold' }} align="right">Percentage</TableCell>
                                  <TableCell sx={{ color: '#b98f33', fontWeight: 'bold' }} align="right">Revenue</TableCell>
                                  <TableCell sx={{ color: '#b98f33', fontWeight: 'bold' }} align="right">Cost</TableCell>
                                  <TableCell sx={{ color: '#b98f33', fontWeight: 'bold' }} align="right">Profit</TableCell>
                                  <TableCell sx={{ color: '#b98f33', fontWeight: 'bold' }}>Visual</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {allocations.map((alloc, index) => {
                                  const allocRevenue = totals.revenue * (alloc.percentage / 100);
                                  const allocCost = totals.cost * (alloc.percentage / 100);
                                  const allocProfit = allocRevenue - allocCost;

                                  return (
                                    <TableRow key={index}>
                                      <TableCell sx={{ color: '#ffffff' }}>
                                        {formatMonthKey(alloc)}
                                      </TableCell>
                                      <TableCell align="right" sx={{ color: '#ffffff' }}>
                                        {formatPercentage(alloc.percentage)}
                                      </TableCell>
                                      <TableCell align="right" sx={{ color: '#4caf50', fontWeight: 'bold' }}>
                                        {formatCurrency(allocRevenue)}
                                      </TableCell>
                                      <TableCell align="right" sx={{ color: '#f44336', fontWeight: 'bold' }}>
                                        {formatCurrency(allocCost)}
                                      </TableCell>
                                      <TableCell align="right" sx={{ color: '#b98f33', fontWeight: 'bold' }}>
                                        {formatCurrency(allocProfit)}
                                      </TableCell>
                                      <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                          <LinearProgress
                                            variant="determinate"
                                            value={alloc.percentage}
                                            sx={{
                                              flexGrow: 1,
                                              height: 8,
                                              borderRadius: 1,
                                              backgroundColor: '#333333',
                                              '& .MuiLinearProgress-bar': {
                                                backgroundColor: '#b98f33',
                                              },
                                            }}
                                          />
                                          {alloc.days && (
                                            <Typography variant="caption" sx={{ color: '#999', minWidth: 50 }}>
                                              {alloc.days} days
                                            </Typography>
                                          )}
                                        </Box>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                                <TableRow sx={{ backgroundColor: '#2a2a2a' }}>
                                  <TableCell sx={{ color: '#b98f33', fontWeight: 'bold' }}>Total</TableCell>
                                  <TableCell align="right" sx={{ color: '#b98f33', fontWeight: 'bold' }}>
                                    {formatPercentage(allocations.reduce((sum, a) => sum + a.percentage, 0))}
                                  </TableCell>
                                  <TableCell align="right" sx={{ color: '#4caf50', fontWeight: 'bold' }}>
                                    {formatCurrency(totals.revenue)}
                                  </TableCell>
                                  <TableCell align="right" sx={{ color: '#f44336', fontWeight: 'bold' }}>
                                    {formatCurrency(totals.cost)}
                                  </TableCell>
                                  <TableCell align="right" sx={{ color: '#b98f33', fontWeight: 'bold' }}>
                                    {formatCurrency(totals.profit)}
                                  </TableCell>
                                  <TableCell></TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Detail Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#2a2a2a',
            color: '#ffffff',
          },
        }}
      >
        <DialogTitle sx={{ color: '#b98f33', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            Allocation Details
          </Typography>
          <IconButton onClick={() => setDetailDialogOpen(false)} sx={{ color: '#b98f33' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {selectedOrderForDetail && (
            <Box>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" sx={{ color: '#999' }}>Bill Invoice</Typography>
                  <Typography variant="body1" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                    {selectedOrderForDetail.orderDetails?.billInvoice || 'N/A'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" sx={{ color: '#999' }}>Customer</Typography>
                  <Typography variant="body1" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                    {selectedOrderForDetail.orderType === 'corporate'
                      ? (selectedOrderForDetail.corporateCustomer?.corporateName || 'N/A')
                      : (selectedOrderForDetail.personalInfo?.customerName || 'N/A')}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" sx={{ color: '#999' }}>Allocation Method</Typography>
                  <Chip
                    label={selectedOrderForDetail.allocation?.method === 'manual' ? 'Manual' : 'Time-Based'}
                    size="small"
                    sx={{
                      backgroundColor: selectedOrderForDetail.allocation?.method === 'manual' ? '#2196f3' : '#4caf50',
                      color: '#ffffff',
                      fontWeight: 'bold',
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" sx={{ color: '#999' }}>Applied At</Typography>
                  <Typography variant="body1" sx={{ color: '#ffffff' }}>
                    {selectedOrderForDetail.allocation?.appliedAt
                      ? formatDate(selectedOrderForDetail.allocation.appliedAt)
                      : 'N/A'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" sx={{ color: '#999' }}>Period</Typography>
                  <Typography variant="body1" sx={{ color: '#ffffff' }}>
                    {(() => {
                      const alloc = selectedOrderForDetail.allocation;
                      const startDate = alloc?.dateRange?.startDate || alloc?.startDate;
                      const endDate = alloc?.dateRange?.endDate || alloc?.endDate;
                      if (!startDate || !endDate) return 'N/A';
                      const start = formatDate(startDate);
                      const end = formatDate(endDate);
                      return start !== 'N/A' && end !== 'N/A' 
                        ? `${start} - ${end}` 
                        : 'N/A';
                    })()}
                  </Typography>
                </Grid>
              </Grid>

              <Typography variant="h6" sx={{ color: '#b98f33', mb: 2 }}>
                Monthly Allocations
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: '#b98f33', fontWeight: 'bold' }}>Period</TableCell>
                    <TableCell sx={{ color: '#b98f33', fontWeight: 'bold' }} align="right">Percentage</TableCell>
                    <TableCell sx={{ color: '#b98f33', fontWeight: 'bold' }} align="right">Revenue</TableCell>
                    <TableCell sx={{ color: '#b98f33', fontWeight: 'bold' }} align="right">Cost</TableCell>
                    <TableCell sx={{ color: '#b98f33', fontWeight: 'bold' }} align="right">Profit</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(() => {
                    const rawAllocations = selectedOrderForDetail.allocation?.allocations
                      ?.filter(alloc => alloc.percentage > 0.01) || [];
                    return deduplicateAllocations(rawAllocations).map((alloc, index) => {
                    const totals = getOrderTotals(selectedOrderForDetail);
                    const allocRevenue = totals.revenue * (alloc.percentage / 100);
                    const allocCost = totals.cost * (alloc.percentage / 100);
                    const allocProfit = allocRevenue - allocCost;

                    return (
                      <TableRow key={index}>
                        <TableCell sx={{ color: '#ffffff' }}>
                          {formatMonthKey(alloc)}
                        </TableCell>
                        <TableCell align="right" sx={{ color: '#ffffff' }}>
                          {formatPercentage(alloc.percentage)}
                        </TableCell>
                        <TableCell align="right" sx={{ color: '#4caf50', fontWeight: 'bold' }}>
                          {formatCurrency(allocRevenue)}
                        </TableCell>
                        <TableCell align="right" sx={{ color: '#f44336', fontWeight: 'bold' }}>
                          {formatCurrency(allocCost)}
                        </TableCell>
                        <TableCell align="right" sx={{ color: '#b98f33', fontWeight: 'bold' }}>
                          {formatCurrency(allocProfit)}
                        </TableCell>
                      </TableRow>
                    );
                  })})()}
                </TableBody>
              </Table>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#1a1a1a' }}>
          <Button onClick={() => setDetailDialogOpen(false)} sx={{ color: '#b98f33' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AllocationOrdersPage;



