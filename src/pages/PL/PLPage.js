import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  InputAdornment,
  Button,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AccountBalance as AccountBalanceIcon,
  MonetizationOn as MonetizationOnIcon,
  Receipt as ReceiptIcon,
  CalendarToday as CalendarIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  PictureAsPdf as PdfIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  Timeline as TimelineIcon,
  Assessment as AssessmentIcon,
  Business as BusinessIcon,
  AttachMoney as AttachMoneyIcon,
  ShowChart as ShowChartIcon
} from '@mui/icons-material';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNotification } from '../../components/Common/NotificationSystem';
import { calculateOrderProfit, normalizePaymentData } from '../../utils/orderCalculations';
import { formatCurrency, formatPercentage, calculateTimeBasedAllocation, processOrdersForPL } from '../../utils/plCalculations';
import { formatDate, formatDateOnly, formatDateRange } from '../../utils/dateUtils';
import { fetchMaterialCompanyTaxRates } from '../../utils/materialTaxRates';

const PLPage = () => {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [dateTo, setDateTo] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0);
  });
  const [selectedPeriod, setSelectedPeriod] = useState('current-month');
  const [selectedTab, setSelectedTab] = useState(0);
  const [expandedSection, setExpandedSection] = useState('summary');
  const [appliedDateFrom, setAppliedDateFrom] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [appliedDateTo, setAppliedDateTo] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0);
  });
  const [materialTaxRates, setMaterialTaxRates] = useState({});

  const [financialData, setFinancialData] = useState({
    totalRevenue: 0,
    totalCosts: 0,
    grossProfit: 0,
    grossProfitMargin: 0,
    netProfit: 0,
    netProfitMargin: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    collectionRate: 0,
    monthlyBreakdown: [],
    categoryBreakdown: [],
    allocationAnalysis: {
      allocatedOrders: [],
      unallocatedOrders: [],
      crossMonthAllocations: [],
      allocationSummary: {
        totalAllocated: 0,
        totalUnallocated: 0,
        crossMonthCount: 0,
        averageAllocationTime: 0
      }
    },
    paymentAnalysis: {
      fullyPaid: 0,
      partiallyPaid: 0,
      unpaid: 0,
      totalPaid: 0,
      totalPending: 0
    }
  });

  const { showError } = useNotification();

  // Fetch all orders including completed ones
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch material tax rates
      const taxRates = await fetchMaterialCompanyTaxRates();
      setMaterialTaxRates(taxRates);
      
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, orderBy('orderDetails.billInvoice', 'desc'));
      const querySnapshot = await getDocs(q);
      const ordersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setOrders(ordersData);
      setFilteredOrders(ordersData);
      calculateFinancialData(ordersData);
    } catch (error) {
      console.error('Error fetching orders:', error);
      showError('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  // Calculate comprehensive financial data
  const calculateFinancialData = (ordersData) => {
    // Process orders with allocation support first
    const summaryPlResult = processOrdersForPL(ordersData, materialTaxRates);
    
    console.log('PL Result for summary:', summaryPlResult);
    
    // Calculate summary from allocated data
    const summary = {
      totalRevenue: 0,
      totalCosts: 0,
      grossProfit: 0,
      totalOrders: 0,
      totalPaid: 0,
      totalPending: 0,
      fullyPaid: 0,
      partiallyPaid: 0,
      unpaid: 0
    };
    
    // Sum up all monthly data to get total allocated amounts
    Object.values(summaryPlResult.monthly).forEach(monthData => {
      summary.totalRevenue += monthData.revenue;
      summary.totalCosts += monthData.costs;
      summary.grossProfit += monthData.profit;
      summary.totalOrders += monthData.orderCount;
    });
    
    // Calculate payment data from original orders (payment data doesn't get allocated)
    // Note: Payment amounts are based on actual payments received, not allocated amounts
    ordersData.forEach(order => {
      const profitData = calculateOrderProfit(order);
      const normalizedPayment = normalizePaymentData(order.paymentData);
      
      summary.totalPaid += normalizedPayment.amountPaid;
      summary.totalPending += (profitData.revenue - normalizedPayment.amountPaid);
      
      // Payment analysis
      if (normalizedPayment.amountPaid >= profitData.revenue) {
        summary.fullyPaid += 1;
      } else if (normalizedPayment.amountPaid > 0) {
        summary.partiallyPaid += 1;
      } else {
        summary.unpaid += 1;
      }
    });

    // Calculate margins and averages
    summary.grossProfitMargin = summary.totalRevenue > 0 ? 
      (summary.grossProfit / summary.totalRevenue) * 100 : 0;
    summary.netProfitMargin = summary.totalRevenue > 0 ? 
      (summary.grossProfit / summary.totalRevenue) * 100 : 0;
    summary.averageOrderValue = summary.totalOrders > 0 ? 
      summary.totalRevenue / summary.totalOrders : 0;
    summary.collectionRate = summary.totalRevenue > 0 ? 
      (summary.totalPaid / summary.totalRevenue) * 100 : 0;

    // Monthly breakdown - Use allocation data for proper monthly distribution
    const monthlyData = {};
    
    // Use the same processed result from above
    console.log('Monthly data from processOrdersForPL:', summaryPlResult.monthly);
    
    // Use the processed monthly data that includes allocations
    Object.entries(summaryPlResult.monthly).forEach(([monthKey, data]) => {
      monthlyData[monthKey] = {
        month: monthKey,
        revenue: data.revenue,
        costs: data.costs,
        profit: data.profit,
        orders: data.orderCount
      };
    });
    
    console.log('Final monthly breakdown:', monthlyData);

    const monthlyBreakdown = Object.values(monthlyData)
      .sort((a, b) => b.month.localeCompare(a.month))
      .map(item => ({
        ...item,
        margin: item.revenue > 0 ? (item.profit / item.revenue) * 100 : 0
      }));

    // Allocation Analysis
    const allocationAnalysis = analyzeAllocations(ordersData);

    setFinancialData({
      ...summary,
      monthlyBreakdown,
      allocationAnalysis,
      paymentAnalysis: {
        fullyPaid: summary.fullyPaid,
        partiallyPaid: summary.partiallyPaid,
        unpaid: summary.unpaid,
        totalPaid: summary.totalPaid,
        totalPending: summary.totalPending
      }
    });
  };

  // Analyze order allocations
  const analyzeAllocations = (ordersData) => {
    const allocatedOrders = [];
    const unallocatedOrders = [];
    const crossMonthAllocations = [];
    let totalAllocationTime = 0;
    let crossMonthCount = 0;

    ordersData.forEach(order => {
      const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
      const allocation = order.allocation;
      
      if (allocation && allocation.appliedAt) {
        const allocationDate = allocation.appliedAt?.toDate ? allocation.appliedAt.toDate() : new Date(allocation.appliedAt);
        const timeDiff = allocationDate.getTime() - orderDate.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
        
        allocatedOrders.push({
          ...order,
          allocationDays: daysDiff,
          allocationDate: allocationDate
        });

        totalAllocationTime += daysDiff;

        // Check for cross-month allocations
        const orderMonth = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
        const allocationMonth = `${allocationDate.getFullYear()}-${String(allocationDate.getMonth() + 1).padStart(2, '0')}`;
        
        if (orderMonth !== allocationMonth) {
          crossMonthAllocations.push({
            order: order,
            orderMonth: orderMonth,
            allocationMonth: allocationMonth,
            daysDiff: daysDiff,
            allocationDate: allocationDate
          });
          crossMonthCount++;
        }
      } else {
        unallocatedOrders.push(order);
      }
    });

    const averageAllocationTime = allocatedOrders.length > 0 ? 
      totalAllocationTime / allocatedOrders.length : 0;

    return {
      allocatedOrders,
      unallocatedOrders,
      crossMonthAllocations,
      allocationSummary: {
        totalAllocated: allocatedOrders.length,
        totalUnallocated: unallocatedOrders.length,
        crossMonthCount,
        averageAllocationTime: Math.round(averageAllocationTime)
      }
    };
  };

  // Filter orders based on date range and search
  useEffect(() => {
    let filtered = orders;
    
    // Apply date range filter based on allocation months for allocated orders, or start date for unallocated orders
    if (appliedDateFrom && appliedDateTo) {
      filtered = filtered.filter(order => {
        const fromDate = new Date(appliedDateFrom);
        const toDate = new Date(appliedDateTo);
        
        fromDate.setHours(0, 0, 0, 0);
        toDate.setHours(23, 59, 59, 999);
        
        // For allocated orders, check if any allocation month falls within the date range
        if (order.allocation && order.allocation.allocations && order.allocation.allocations.length > 0) {
          // Check if any allocation month falls within the selected date range
          const hasAllocationInRange = order.allocation.allocations.some(allocation => {
            const allocationDate = new Date(allocation.label + '-01'); // Convert "2024-04" to Date
            return allocationDate >= fromDate && allocationDate <= toDate;
          });
          
          console.log(`Order ${order.orderDetails?.billInvoice}: Allocated order - ${hasAllocationInRange ? 'INCLUDED' : 'EXCLUDED'} in date range`, {
            allocations: order.allocation.allocations.map(a => a.label),
            dateRange: `${fromDate.toISOString().split('T')[0]} to ${toDate.toISOString().split('T')[0]}`,
            hasAllocationInRange
          });
          
          return hasAllocationInRange;
        } else {
          // For unallocated orders, use the start date (when work actually began)
          let orderStartDate;
          
          if (order.orderDetails?.startDate) {
            // Use the start date from order details
            if (order.orderDetails.startDate.toDate) {
              orderStartDate = order.orderDetails.startDate.toDate();
            } else {
              orderStartDate = new Date(order.orderDetails.startDate);
            }
          } else {
            // Fallback to creation date if no start date is set
            orderStartDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
          }
          
          const isInRange = orderStartDate >= fromDate && orderStartDate <= toDate;
          
          console.log(`Order ${order.orderDetails?.billInvoice}: Unallocated order - ${isInRange ? 'INCLUDED' : 'EXCLUDED'} in date range`, {
            startDate: orderStartDate.toISOString().split('T')[0],
            dateRange: `${fromDate.toISOString().split('T')[0]} to ${toDate.toISOString().split('T')[0]}`
          });
          
          return isInRange;
        }
      });
    }
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.personalInfo?.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.orderDetails?.billInvoice?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    console.log('Date filtering:', {
      appliedDateFrom: appliedDateFrom?.toISOString(),
      appliedDateTo: appliedDateTo?.toISOString(),
      totalOrders: orders.length,
      filteredOrders: filtered.length,
      dateRangeApplied: !!(appliedDateFrom && appliedDateTo)
    });
    
    setFilteredOrders(filtered);
    calculateFinancialData(filtered);
  }, [searchTerm, orders, appliedDateFrom, appliedDateTo]);

  // Handle period selection
  const handlePeriodChange = (period) => {
    setSelectedPeriod(period);
    const now = new Date();
    
    let newDateFrom, newDateTo;
    
    switch (period) {
      case 'current-month':
        newDateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
        newDateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'last-month':
        newDateFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        newDateTo = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'current-quarter':
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        newDateFrom = quarterStart;
        newDateTo = new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 0);
        break;
      case 'current-year':
        newDateFrom = new Date(now.getFullYear(), 0, 1);
        newDateTo = new Date(now.getFullYear(), 11, 31);
        break;
      case 'all-time':
        newDateFrom = null;
        newDateTo = null;
        break;
      default:
        return;
    }
    
    // Set the date inputs
    setDateFrom(newDateFrom);
    setDateTo(newDateTo);
    
    // Apply the filter immediately for period selections
    setAppliedDateFrom(newDateFrom);
    setAppliedDateTo(newDateTo);
    
    console.log('Period changed and applied:', {
      period,
      from: newDateFrom?.toISOString(),
      to: newDateTo?.toISOString()
    });
  };

  // Apply date filter manually
  const handleApplyDateFilter = () => {
    setAppliedDateFrom(dateFrom);
    setAppliedDateTo(dateTo);
    console.log('Applying date filter:', {
      from: dateFrom?.toISOString(),
      to: dateTo?.toISOString()
    });
  };

  // Clear date filter
  const handleClearDateFilter = () => {
    setDateFrom(null);
    setDateTo(null);
    setAppliedDateFrom(null);
    setAppliedDateTo(null);
    setSelectedPeriod('all-time');
  };

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, backgroundColor: '#e6e7e8', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <AssessmentIcon sx={{ fontSize: 32, color: '#274290', mr: 2 }} />
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#274290' }}>
            Profit & Loss Statement
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary">
          Comprehensive financial analysis and performance metrics
        </Typography>
      </Box>

      {/* Period Selection */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <CalendarIcon sx={{ color: '#274290', mr: 1 }} />
          <Typography variant="h6" sx={{ color: '#274290', fontWeight: 'bold' }}>
            Analysis Period
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {[
            { value: 'current-month', label: 'Current Month' },
            { value: 'last-month', label: 'Last Month' },
            { value: 'current-quarter', label: 'Current Quarter' },
            { value: 'current-year', label: 'Current Year' },
            { value: 'all-time', label: 'All Time' }
          ].map((period) => (
            <Button
              key={period.value}
              variant={selectedPeriod === period.value ? 'contained' : 'outlined'}
              size="small"
              onClick={() => handlePeriodChange(period.value)}
              sx={{
                backgroundColor: selectedPeriod === period.value ? '#274290' : 'transparent',
                color: selectedPeriod === period.value ? 'white' : '#274290',
                borderColor: '#274290',
                '&:hover': {
                  backgroundColor: selectedPeriod === period.value ? '#1e3a8a' : '#f5f8ff'
                }
              }}
            >
              {period.label}
            </Button>
          ))}
        </Box>
      </Paper>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <FilterListIcon sx={{ color: '#274290', mr: 1 }} />
          <Typography variant="h6" sx={{ color: '#274290', fontWeight: 'bold' }}>
            Filters
          </Typography>
        </Box>
                 <Grid container spacing={2} alignItems="center">
           <Grid item xs={12} md={3}>
             <TextField
               fullWidth
               placeholder="Search orders..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               InputProps={{
                 startAdornment: (
                   <InputAdornment position="start">
                     <SearchIcon />
                   </InputAdornment>
                 )
               }}
             />
           </Grid>
           <Grid item xs={12} md={2}>
             <TextField
               fullWidth
               label="From Date"
               type="date"
               value={dateFrom ? dateFrom.toISOString().split('T')[0] : ''}
               onChange={(e) => setDateFrom(e.target.value ? new Date(e.target.value) : null)}
               InputLabelProps={{ shrink: true }}
             />
           </Grid>
           <Grid item xs={12} md={2}>
             <TextField
               fullWidth
               label="To Date"
               type="date"
               value={dateTo ? dateTo.toISOString().split('T')[0] : ''}
               onChange={(e) => setDateTo(e.target.value ? new Date(e.target.value) : null)}
               InputLabelProps={{ shrink: true }}
             />
           </Grid>
           <Grid item xs={12} md={3}>
             <Box sx={{ display: 'flex', gap: 1 }}>
               <Button
                 variant="contained"
                 onClick={handleApplyDateFilter}
                 disabled={!dateFrom || !dateTo}
                 sx={{
                   backgroundColor: '#4caf50',
                   '&:hover': { backgroundColor: '#45a049' },
                   '&:disabled': { backgroundColor: '#cccccc' }
                 }}
               >
                 Apply Filter
               </Button>
               <Button
                 variant="outlined"
                 onClick={handleClearDateFilter}
                 sx={{
                   borderColor: '#f44336',
                   color: '#f44336',
                   '&:hover': {
                     borderColor: '#d32f2f',
                     backgroundColor: 'rgba(244, 67, 54, 0.1)'
                   }
                 }}
               >
                 Clear
               </Button>
             </Box>
           </Grid>
           <Grid item xs={12} md={2}>
             <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
               <Typography variant="body2" color="text.secondary">
                 Applied:
               </Typography>
               <Chip
                 label={appliedDateFrom && appliedDateTo ? 
                   `${(() => {
                     try {
                       const fromDate = appliedDateFrom?.toDate ? appliedDateFrom.toDate() :
                         (appliedDateFrom?.seconds ? new Date(appliedDateFrom.seconds * 1000) :
                         new Date(appliedDateFrom));
                       const toDate = appliedDateTo?.toDate ? appliedDateTo.toDate() :
                         (appliedDateTo?.seconds ? new Date(appliedDateTo.seconds * 1000) :
                         new Date(appliedDateTo));
                       return `${fromDate.toLocaleDateString()} - ${toDate.toLocaleDateString()}`;
                     } catch (error) {
                       console.error('Error formatting applied date range:', error);
                       return 'Invalid Date Range';
                     }
                   })()}` : 
                   'No filter'
                 }
                 size="small"
                 color={appliedDateFrom && appliedDateTo ? 'success' : 'default'}
               />
             </Box>
           </Grid>
         </Grid>
      </Paper>

      {/* Main Content Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={selectedTab} 
          onChange={(e, newValue) => setSelectedTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Summary" icon={<AssessmentIcon />} />
          <Tab label="Monthly Analysis" icon={<TimelineIcon />} />
          <Tab label="Payment Analysis" icon={<MonetizationOnIcon />} />
          <Tab label="Allocation Analysis" icon={<ShowChartIcon />} />
          <Tab label="Detailed Breakdown" icon={<BarChartIcon />} />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      {selectedTab === 0 && (
        <Box>
          {/* Key Metrics Cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ 
                background: 'linear-gradient(135deg, #4caf50 0%, #66bb6a 100%)',
                color: 'white',
                boxShadow: 3
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <TrendingUpIcon sx={{ mr: 1 }} />
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      Total Revenue
                    </Typography>
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {formatCurrency(financialData.totalRevenue)}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    {financialData.totalOrders} orders
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ 
                background: 'linear-gradient(135deg, #f44336 0%, #e57373 100%)',
                color: 'white',
                boxShadow: 3
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <TrendingDownIcon sx={{ mr: 1 }} />
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      Total Costs
                    </Typography>
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {formatCurrency(financialData.totalCosts)}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    {formatPercentage(financialData.totalRevenue > 0 ? 
                      (financialData.totalCosts / financialData.totalRevenue) * 100 : 0)} of revenue
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ 
                background: 'linear-gradient(135deg, #2196f3 0%, #42a5f5 100%)',
                color: 'white',
                boxShadow: 3
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <AttachMoney sx={{ mr: 1 }} />
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      Gross Profit
                    </Typography>
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {formatCurrency(financialData.grossProfit)}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    {formatPercentage(financialData.grossProfitMargin)} margin
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ 
                background: 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)',
                color: 'white',
                boxShadow: 3
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <MonetizationOnIcon sx={{ mr: 1 }} />
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      Collection Rate
                    </Typography>
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {formatPercentage(financialData.collectionRate)}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    {formatCurrency(financialData.paymentAnalysis.totalPaid)} collected
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Detailed Summary */}
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, color: '#274290', fontWeight: 'bold' }}>
                    <BusinessIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Business Performance
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Average Order Value
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#274290' }}>
                      {formatCurrency(financialData.averageOrderValue)}
                    </Typography>
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Profit Margin
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#4caf50' }}>
                      {formatPercentage(financialData.grossProfitMargin)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Pending Collections
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#f44336' }}>
                      {formatCurrency(financialData.paymentAnalysis.totalPending)}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, color: '#274290', fontWeight: 'bold' }}>
                    <ReceiptIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Payment Status
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Fully Paid</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {financialData.paymentAnalysis.fullyPaid} orders
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={financialData.totalOrders > 0 ? 
                        (financialData.paymentAnalysis.fullyPaid / financialData.totalOrders) * 100 : 0}
                      sx={{ backgroundColor: '#e0e0e0', '& .MuiLinearProgress-bar': { backgroundColor: '#4caf50' } }}
                    />
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Partially Paid</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {financialData.paymentAnalysis.partiallyPaid} orders
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={financialData.totalOrders > 0 ? 
                        (financialData.paymentAnalysis.partiallyPaid / financialData.totalOrders) * 100 : 0}
                      sx={{ backgroundColor: '#e0e0e0', '& .MuiLinearProgress-bar': { backgroundColor: '#ff9800' } }}
                    />
                  </Box>
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Unpaid</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {financialData.paymentAnalysis.unpaid} orders
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={financialData.totalOrders > 0 ? 
                        (financialData.paymentAnalysis.unpaid / financialData.totalOrders) * 100 : 0}
                      sx={{ backgroundColor: '#e0e0e0', '& .MuiLinearProgress-bar': { backgroundColor: '#f44336' } }}
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, color: '#274290', fontWeight: 'bold' }}>
                    <BarChartIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Allocation Status
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Allocated Orders</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#4caf50' }}>
                        {financialData.allocationAnalysis.allocationSummary.totalAllocated} orders
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={financialData.totalOrders > 0 ? 
                        (financialData.allocationAnalysis.allocationSummary.totalAllocated / financialData.totalOrders) * 100 : 0}
                      sx={{ backgroundColor: '#e0e0e0', '& .MuiLinearProgress-bar': { backgroundColor: '#4caf50' } }}
                    />
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Unallocated Orders</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#ff9800' }}>
                        {financialData.allocationAnalysis.allocationSummary.totalUnallocated} orders
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={financialData.totalOrders > 0 ? 
                        (financialData.allocationAnalysis.allocationSummary.totalUnallocated / financialData.totalOrders) * 100 : 0}
                      sx={{ backgroundColor: '#e0e0e0', '& .MuiLinearProgress-bar': { backgroundColor: '#ff9800' } }}
                    />
                  </Box>
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Cross-Month Allocations</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#2196f3' }}>
                        {financialData.allocationAnalysis.allocationSummary.crossMonthCount} orders
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={financialData.allocationAnalysis.allocationSummary.totalAllocated > 0 ? 
                        (financialData.allocationAnalysis.allocationSummary.crossMonthCount / financialData.allocationAnalysis.allocationSummary.totalAllocated) * 100 : 0}
                      sx={{ backgroundColor: '#e0e0e0', '& .MuiLinearProgress-bar': { backgroundColor: '#2196f3' } }}
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      {selectedTab === 1 && (
        <Box>
          <Typography variant="h6" sx={{ mb: 2, color: '#274290', fontWeight: 'bold' }}>
            <TimelineIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Monthly Performance Analysis
          </Typography>
          
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#274290' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Month</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Orders</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Revenue</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Costs</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Profit</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Margin</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Avg Order</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {financialData.monthlyBreakdown.map((month) => (
                  <TableRow key={month.month} hover>
                    <TableCell>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                        {new Date(month.month + '-01').toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long' 
                        })}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={month.orders} 
                        size="small" 
                        color="primary"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#4caf50' }}>
                        {formatCurrency(month.revenue)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#f44336' }}>
                        {formatCurrency(month.costs)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography 
                        variant="subtitle1" 
                        sx={{ 
                          fontWeight: 'bold', 
                          color: month.profit >= 0 ? '#2196f3' : '#f44336' 
                        }}
                      >
                        {formatCurrency(month.profit)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={formatPercentage(month.margin)}
                        size="small"
                        color={month.margin >= 0 ? 'success' : 'error'}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatCurrency(month.orders > 0 ? month.revenue / month.orders : 0)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {selectedTab === 2 && (
        <Box>
          <Typography variant="h6" sx={{ mb: 2, color: '#274290', fontWeight: 'bold' }}>
            <MonetizationOnIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Payment Analysis
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, color: '#274290' }}>
                    Payment Status Distribution
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Fully Paid</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#4caf50' }}>
                        {formatCurrency(financialData.paymentAnalysis.totalPaid)}
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={financialData.totalRevenue > 0 ? 
                        (financialData.paymentAnalysis.totalPaid / financialData.totalRevenue) * 100 : 0}
                      sx={{ height: 8, borderRadius: 4, backgroundColor: '#e0e0e0' }}
                    />
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Pending</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#f44336' }}>
                        {formatCurrency(financialData.paymentAnalysis.totalPending)}
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={financialData.totalRevenue > 0 ? 
                        (financialData.paymentAnalysis.totalPending / financialData.totalRevenue) * 100 : 0}
                      sx={{ height: 8, borderRadius: 4, backgroundColor: '#e0e0e0' }}
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, color: '#274290' }}>
                    Collection Metrics
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Box sx={{ textAlign: 'center', p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                        <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#4caf50' }}>
                          {formatPercentage(financialData.collectionRate)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Collection Rate
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6}>
                      <Box sx={{ textAlign: 'center', p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                        <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#f44336' }}>
                          {formatPercentage(100 - financialData.collectionRate)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Outstanding Rate
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      {selectedTab === 3 && (
        <Box>
          <Typography variant="h6" sx={{ mb: 2, color: '#274290', fontWeight: 'bold' }}>
            <ShowChartIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Cross-Month Order Allocations
          </Typography>
          
          {/* Allocation Summary Cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ 
                background: 'linear-gradient(135deg, #4caf50 0%, #66bb6a 100%)',
                color: 'white',
                boxShadow: 3
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <TrendingUpIcon sx={{ mr: 1 }} />
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      Allocated Orders
                    </Typography>
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {financialData.allocationAnalysis.allocationSummary.totalAllocated}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    {formatPercentage(financialData.totalOrders > 0 ? 
                      (financialData.allocationAnalysis.allocationSummary.totalAllocated / financialData.totalOrders) * 100 : 0)} of total
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ 
                background: 'linear-gradient(135deg, #f44336 0%, #e57373 100%)',
                color: 'white',
                boxShadow: 3
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <TrendingDownIcon sx={{ mr: 1 }} />
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      Unallocated Orders
                    </Typography>
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {financialData.allocationAnalysis.allocationSummary.totalUnallocated}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    {formatPercentage(financialData.totalOrders > 0 ? 
                      (financialData.allocationAnalysis.allocationSummary.totalUnallocated / financialData.totalOrders) * 100 : 0)} of total
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ 
                background: 'linear-gradient(135deg, #2196f3 0%, #42a5f5 100%)',
                color: 'white',
                boxShadow: 3
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <TimelineIcon sx={{ mr: 1 }} />
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      Cross-Month Allocations
                    </Typography>
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {financialData.allocationAnalysis.allocationSummary.crossMonthCount}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    {formatPercentage(financialData.allocationAnalysis.allocationSummary.totalAllocated > 0 ? 
                      (financialData.allocationAnalysis.allocationSummary.crossMonthCount / financialData.allocationAnalysis.allocationSummary.totalAllocated) * 100 : 0)} of allocated
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ 
                background: 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)',
                color: 'white',
                boxShadow: 3
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <CalendarIcon sx={{ mr: 1 }} />
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      Avg Allocation Time
                    </Typography>
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {financialData.allocationAnalysis.allocationSummary.averageAllocationTime} days
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Average processing time
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Cross-Month Allocations Table */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, color: '#274290', fontWeight: 'bold' }}>
                Cross-Month Allocation Details
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#274290' }}>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Invoice #</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Customer</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Order Month</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Days Difference</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Revenue</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {financialData.allocationAnalysis.crossMonthAllocations.map((item, index) => {
                      const profitData = calculateOrderProfit(item.order);
                      return (
                        <TableRow key={index} hover>
                          <TableCell>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                              {item.order.orderDetails?.billInvoice || 'N/A'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {item.order.personalInfo?.customerName || 'N/A'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={new Date(item.orderMonth + '-01').toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'short' 
                              })}
                              size="small"
                              color="primary"
                            />
                          </TableCell>

                          <TableCell>
                            <Chip 
                              label={`${item.daysDiff} days`}
                              size="small"
                              color={item.daysDiff > 30 ? 'error' : item.daysDiff > 7 ? 'warning' : 'success'}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#4caf50' }}>
                              {formatCurrency(profitData.revenue)}
                            </Typography>
                          </TableCell>

                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          {/* Unallocated Orders */}
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, color: '#274290', fontWeight: 'bold' }}>
                Unallocated Orders ({financialData.allocationAnalysis.unallocatedOrders.length})
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#f44336' }}>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Invoice #</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Customer</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Order Date</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Revenue</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Days Since Order</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {financialData.allocationAnalysis.unallocatedOrders.map((order, index) => {
                      const profitData = calculateOrderProfit(order);
                      const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
                      const daysSinceOrder = Math.ceil((new Date().getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
                      
                      return (
                        <TableRow key={index} hover>
                          <TableCell>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                              {order.orderDetails?.billInvoice || 'N/A'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {order.personalInfo?.customerName || 'N/A'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {(() => {
                                try {
                                  if (orderDate?.toDate) {
                                    return orderDate.toDate().toLocaleDateString();
                                  } else if (orderDate?.seconds) {
                                    return new Date(orderDate.seconds * 1000).toLocaleDateString();
                                  } else if (orderDate) {
                                    return new Date(orderDate).toLocaleDateString();
                                  }
                                  return 'N/A';
                                } catch (error) {
                                  console.error('Error formatting order date:', error);
                                  return 'N/A';
                                }
                              })()}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#4caf50' }}>
                              {formatCurrency(profitData.revenue)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={order.status || 'Unknown'}
                              size="small"
                              color={order.status === 'done' ? 'success' : 'default'}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={`${daysSinceOrder} days`}
                              size="small"
                              color={daysSinceOrder > 30 ? 'error' : daysSinceOrder > 7 ? 'warning' : 'info'}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Box>
      )}

      {selectedTab === 4 && (
        <Box>
          <Typography variant="h6" sx={{ mb: 2, color: '#274290', fontWeight: 'bold' }}>
            <BarChartIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Detailed Financial Breakdown
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, color: '#274290' }}>
                    Revenue vs Costs Analysis
                  </Typography>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Metric</TableCell>
                          <TableCell align="right">Amount</TableCell>
                          <TableCell align="right">Percentage</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>Total Revenue</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', color: '#4caf50' }}>
                            {formatCurrency(financialData.totalRevenue)}
                          </TableCell>
                          <TableCell align="right">100%</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>Total Costs</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', color: '#f44336' }}>
                            {formatCurrency(financialData.totalCosts)}
                          </TableCell>
                          <TableCell align="right">
                            {formatPercentage(financialData.totalRevenue > 0 ? 
                              (financialData.totalCosts / financialData.totalRevenue) * 100 : 0)}
                          </TableCell>
                        </TableRow>
                        <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                          <TableCell sx={{ fontWeight: 'bold' }}>Gross Profit</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', color: '#2196f3' }}>
                            {formatCurrency(financialData.grossProfit)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                            {formatPercentage(financialData.grossProfitMargin)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, color: '#274290' }}>
                    Key Performance Indicators
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Profit Margin
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#4caf50' }}>
                      {formatPercentage(financialData.grossProfitMargin)}
                    </Typography>
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Average Order Value
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#274290' }}>
                      {formatCurrency(financialData.averageOrderValue)}
                    </Typography>
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Collection Rate
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#ff9800' }}>
                      {formatPercentage(financialData.collectionRate)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Total Orders
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#9c27b0' }}>
                      {financialData.totalOrders}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Action Buttons */}
      <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'center' }}>
        <Button
          variant="outlined"
          startIcon={<PdfIcon />}
          sx={{ color: '#f44336', borderColor: '#f44336' }}
        >
          Export PDF
        </Button>
        <Button
          variant="outlined"
          startIcon={<PrintIcon />}
          sx={{ color: '#274290', borderColor: '#274290' }}
        >
          Print Report
        </Button>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          sx={{ color: '#4caf50', borderColor: '#4caf50' }}
        >
          Export Data
        </Button>
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={fetchOrders}
          sx={{ backgroundColor: '#f27921', '&:hover': { backgroundColor: '#e66a1a' } }}
        >
          Refresh Data
        </Button>
      </Box>
    </Box>
  );
};

export default PLPage; 