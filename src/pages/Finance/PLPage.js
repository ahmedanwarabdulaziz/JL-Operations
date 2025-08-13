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
  Card,
  CardContent,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Divider,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
  FormControlLabel,
  Radio,
  RadioGroup,
  FormLabel
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AccountBalance as AccountBalanceIcon,
  MonetizationOn as MonetizationOnIcon,
  CalendarToday as CalendarIcon,
  FilterList as FilterListIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  PictureAsPdf as PdfIcon,
  GetApp as ExportIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';
import { collection, getDocs, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNotification } from '../../components/Common/NotificationSystem';
import { calculateOrderTotal, calculateOrderCost, calculateOrderProfit } from '../../utils/orderCalculations';
import { fetchMaterialCompanyTaxRates } from '../../utils/materialTaxRates';
import { 
  processOrdersForPL, 
  calculateTimeBasedAllocation, 
  formatCurrency, 
  formatPercentage,
  getPeriodComparison,
  calculateYTD
} from '../../utils/plCalculations';

const PLPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [allocationDialogOpen, setAllocationDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [allocationMethod, setAllocationMethod] = useState('time-based');
  const [manualAllocations, setManualAllocations] = useState([]);
  const [plData, setPlData] = useState({
    monthly: {},
    quarterly: {},
    yearly: {}
  });
  const [crossMonthOrders, setCrossMonthOrders] = useState([]);
  const [viewMode, setViewMode] = useState('summary'); // summary, detailed, trends
  const [cashFlowMode, setCashFlowMode] = useState(false); // false = accrual, true = cash
  const [materialTaxRates, setMaterialTaxRates] = useState({});

  const { showSuccess, showError } = useNotification();

  // Fetch orders from Firebase
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const ordersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Fetch material tax rates
      const taxRates = await fetchMaterialCompanyTaxRates();
      setMaterialTaxRates(taxRates);
      
      setOrders(ordersData);
      processOrdersForPLData(ordersData, taxRates);
    } catch (error) {
      console.error('Error fetching orders:', error);
      showError('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  // Process orders for P&L calculations
  const processOrdersForPLData = (ordersData, taxRates = materialTaxRates) => {
    console.log('Processing orders for P&L:', ordersData.length);
    const result = processOrdersForPL(ordersData, taxRates);
    console.log('P&L result:', result);
    setCrossMonthOrders(result.crossMonthOrders);
    setPlData({ 
      monthly: result.monthly, 
      quarterly: result.quarterly, 
      yearly: result.yearly 
    });
  };

  // Handle allocation dialog
  const handleAllocationDialog = (order) => {
    setSelectedOrder(order);
    setAllocationMethod(order.allocation?.method || 'time-based');
    
    if (order.allocation?.method === 'manual') {
      setManualAllocations(order.allocation.allocations || []);
    } else {
      const timeBasedAllocations = calculateTimeBasedAllocation(order);
      setManualAllocations(timeBasedAllocations);
    }
    
    setAllocationDialogOpen(true);
  };

  // Apply allocation
  const applyAllocation = async () => {
    try {
      if (!selectedOrder) return;
      
      const orderRef = doc(db, 'orders', selectedOrder.id);
      const allocationData = {
        method: allocationMethod,
        allocations: manualAllocations,
        appliedAt: new Date()
      };
      
      await updateDoc(orderRef, { allocation: allocationData });
      
      // Update local state
      const updatedOrders = orders.map(order =>
        order.id === selectedOrder.id 
          ? { ...order, allocation: allocationData }
          : order
      );
      
      setOrders(updatedOrders);
      processOrdersForPLData(updatedOrders, materialTaxRates);
      
      showSuccess('Allocation applied successfully');
      setAllocationDialogOpen(false);
    } catch (error) {
      console.error('Error applying allocation:', error);
      showError('Failed to apply allocation');
    }
  };

  // Get current period data and comparison
  const getCurrentPeriodData = () => {
    console.log('Getting current period data:', { selectedPeriod, selectedYear, selectedMonth });
    console.log('PL Data:', plData);
    const comparison = getPeriodComparison(plData, selectedPeriod, selectedYear, selectedMonth);
    console.log('Comparison:', comparison);
    return comparison?.current || {
      revenue: 0,
      costs: 0,
      profit: 0,
      orderCount: 0,
      profitMargin: 0
    };
  };

  // Get YTD data
  const getYTDData = () => {
    return calculateYTD(plData[selectedPeriod], selectedYear);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Refresh data when component mounts or when navigating to this page
  useEffect(() => {
    const handleFocus = () => {
      fetchOrders();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  const currentData = getCurrentPeriodData();

  return (
    <Box sx={{ p: 3, backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <TrendingUpIcon sx={{ fontSize: 32, color: '#b98f33', mr: 2 }} />
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
            Profit & Loss Statement
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<SettingsIcon />}
            onClick={() => setViewMode(viewMode === 'summary' ? 'detailed' : 'summary')}
            sx={{ 
              backgroundColor: '#b98f33',
              color: '#000000',
              border: '2px solid #8b6b1f',
              boxShadow: '0 4px 8px rgba(185, 143, 51, 0.3)',
              background: 'linear-gradient(135deg, #b98f33 0%, #d4af5a 100%)',
              '&:hover': { 
                backgroundColor: '#d4af5a',
                boxShadow: '0 6px 12px rgba(185, 143, 51, 0.4)',
                transform: 'translateY(-1px)'
              }
            }}
          >
            {viewMode === 'summary' ? 'Detailed View' : 'Summary View'}
          </Button>
          
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={fetchOrders}
            sx={{ 
              backgroundColor: '#b98f33',
              color: '#000000',
              border: '2px solid #8b6b1f',
              boxShadow: '0 4px 8px rgba(185, 143, 51, 0.3)',
              background: 'linear-gradient(135deg, #b98f33 0%, #d4af5a 100%)',
              '&:hover': { 
                backgroundColor: '#d4af5a',
                boxShadow: '0 6px 12px rgba(185, 143, 51, 0.4)',
                transform: 'translateY(-1px)'
              }
            }}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Cross-Month Orders Alert */}
      {crossMonthOrders.length > 0 && (
        <Alert 
          severity="warning" 
          sx={{ mb: 3 }}
          action={
            <Button 
              size="small" 
              variant="contained"
              onClick={() => setViewMode('detailed')}
              sx={{ 
                backgroundColor: '#b98f33',
                color: '#000000',
                border: '1px solid #8b6b1f',
                boxShadow: '0 2px 4px rgba(185, 143, 51, 0.3)',
                background: 'linear-gradient(135deg, #b98f33 0%, #d4af5a 100%)',
                '&:hover': { 
                  backgroundColor: '#d4af5a',
                  boxShadow: '0 4px 8px rgba(185, 143, 51, 0.4)'
                }
              }}
            >
              Review Allocations
            </Button>
          }
        >
          <strong>{crossMonthOrders.length} orders span multiple months.</strong> 
          Review and adjust allocations for accurate P&L reporting.
        </Alert>
      )}

      {/* Period Selection */}
      <Paper sx={{ p: 3, mb: 3, backgroundColor: '#2a2a2a', border: '1px solid #333333' }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Period Type</InputLabel>
              <Select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                label="Period Type"
              >
                <MenuItem value="monthly">Monthly</MenuItem>
                <MenuItem value="quarterly">Quarterly</MenuItem>
                <MenuItem value="yearly">Yearly</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Year"
              type="number"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            />
          </Grid>
          
          {selectedPeriod === 'monthly' && (
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Month</InputLabel>
                <Select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  label="Month"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <MenuItem key={i} value={i}>
                      {new Date(2024, i).toLocaleDateString('en-US', { month: 'long' })}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* P&L Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
                      <Card sx={{ 
              backgroundColor: '#2a2a2a', 
              color: '#ffffff',
              border: '1px solid #333333',
              boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
              background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)'
            }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, justifyContent: 'center' }}>
                  <MonetizationOnIcon sx={{ mr: 1, color: '#b98f33' }} />
                  <Typography variant="h6" sx={{ color: '#b98f33' }}>Revenue</Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#ffffff', textAlign: 'center' }}>
                  {formatCurrency(currentData.revenue)}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8, color: '#b98f33', textAlign: 'center' }}>
                  {currentData.orderCount} orders
                </Typography>
              </CardContent>
            </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            backgroundColor: '#2a2a2a', 
            color: '#ffffff',
            border: '1px solid #333333',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, justifyContent: 'center' }}>
                <AccountBalanceIcon sx={{ mr: 1, color: '#b98f33' }} />
                <Typography variant="h6" sx={{ color: '#b98f33' }}>Costs</Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#ffffff', textAlign: 'center' }}>
                {formatCurrency(currentData.costs)}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.8, color: '#b98f33', textAlign: 'center' }}>
                {formatPercentage(currentData.profitMargin)} of revenue
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            backgroundColor: '#2a2a2a', 
            color: '#ffffff',
            border: '1px solid #333333',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, justifyContent: 'center' }}>
                <TrendingUpIcon sx={{ mr: 1, color: '#b98f33' }} />
                <Typography variant="h6" sx={{ color: '#b98f33' }}>Gross Profit</Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#ffffff', textAlign: 'center' }}>
                {formatCurrency(currentData.profit)}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.8, color: '#b98f33', textAlign: 'center' }}>
                {formatPercentage(currentData.profitMargin)} margin
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            backgroundColor: '#2a2a2a', 
            color: '#ffffff',
            border: '1px solid #333333',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, justifyContent: 'center' }}>
                <BarChartIcon sx={{ mr: 1, color: '#b98f33' }} />
                <Typography variant="h6" sx={{ color: '#b98f33' }}>Avg Order</Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#ffffff', textAlign: 'center' }}>
                {formatCurrency(currentData.orderCount > 0 ? currentData.revenue / currentData.orderCount : 0)}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.8, color: '#b98f33', textAlign: 'center' }}>
                per order
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* YTD Summary */}
      <Paper sx={{ p: 3, mb: 3, backgroundColor: '#2a2a2a', border: '1px solid #333333' }}>
        <Typography variant="h6" sx={{ mb: 2, color: '#b98f33', fontWeight: 'bold' }}>
          Year-to-Date Summary ({selectedYear})
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                {formatCurrency(getYTDData().revenue)}
              </Typography>
              <Typography variant="body2" sx={{ color: '#ffffff' }}>
                YTD Revenue
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                {formatCurrency(getYTDData().costs)}
              </Typography>
              <Typography variant="body2" sx={{ color: '#ffffff' }}>
                YTD Costs
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                {formatCurrency(getYTDData().profit)}
              </Typography>
              <Typography variant="body2" sx={{ color: '#ffffff' }}>
                YTD Profit
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                {formatPercentage(getYTDData().profitMargin)}
              </Typography>
              <Typography variant="body2" sx={{ color: '#ffffff' }}>
                YTD Margin
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Detailed View */}
      {viewMode === 'detailed' && (
        <Paper sx={{ p: 3, mb: 3, backgroundColor: '#2a2a2a', border: '1px solid #333333' }}>
          <Typography variant="h6" sx={{ mb: 2, color: '#b98f33', fontWeight: 'bold' }}>
            Cross-Month Order Allocations
          </Typography>
          
          {crossMonthOrders.length === 0 ? (
            <Alert severity="info">No orders span multiple months.</Alert>
          ) : (
            <TableContainer>
              <Table>
                <TableHead sx={{ backgroundColor: '#b98f33' }}>
                  <TableRow>
                    <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Order #</TableCell>
                    <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Customer</TableCell>
                    <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Period</TableCell>
                    <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Revenue</TableCell>
                    <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Costs</TableCell>
                    <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Profit</TableCell>
                    <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Allocation</TableCell>
                    <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {crossMonthOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>{order.orderDetails?.billInvoice || order.id}</TableCell>
                      <TableCell>{order.personalInfo?.customerName}</TableCell>
                      <TableCell>
                        {order.startDate.toLocaleDateString()} - {order.endDate.toLocaleDateString()}
                      </TableCell>
                      <TableCell>{formatCurrency(order.profitData.revenue)}</TableCell>
                      <TableCell>{formatCurrency(order.profitData.cost)}</TableCell>
                      <TableCell>{formatCurrency(order.profitData.profit)}</TableCell>
                      <TableCell>
                        {order.allocation ? (
                          <Chip 
                            label={order.allocation.method} 
                            color="success" 
                            size="small" 
                          />
                        ) : (
                          <Chip 
                            label="Pending" 
                            color="warning" 
                            size="small" 
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<EditIcon />}
                          onClick={() => handleAllocationDialog(order)}
                          sx={{ 
                            backgroundColor: '#b98f33',
                            color: '#000000',
                            border: '1px solid #8b6b1f',
                            boxShadow: '0 2px 4px rgba(185, 143, 51, 0.3)',
                            background: 'linear-gradient(135deg, #b98f33 0%, #d4af5a 100%)',
                            '&:hover': { 
                              backgroundColor: '#d4af5a',
                              boxShadow: '0 4px 8px rgba(185, 143, 51, 0.4)'
                            }
                          }}
                        >
                          Allocate
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {/* Allocation Dialog */}
      <Dialog 
        open={allocationDialogOpen} 
        onClose={() => setAllocationDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <CalendarIcon sx={{ mr: 1, color: '#b98f33' }} />
            Order Allocation: {selectedOrder?.orderDetails?.billInvoice || selectedOrder?.id}
          </Box>
        </DialogTitle>
        
        <DialogContent>
          {selectedOrder && (
            <Box sx={{ mt: 2 }}>
              {/* Order Summary */}
              <Paper sx={{ p: 2, mb: 3, backgroundColor: '#3a3a3a' }}>
                <Typography variant="h6" sx={{ mb: 2, color: '#b98f33' }}>
                  Order Summary
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Customer: {selectedOrder.personalInfo?.customerName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Period: {selectedOrder.startDate.toLocaleDateString()} - {selectedOrder.endDate.toLocaleDateString()}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Total Revenue: {formatCurrency(selectedOrder.profitData.revenue)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Costs: {formatCurrency(selectedOrder.profitData.cost)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Gross Profit: {formatCurrency(selectedOrder.profitData.profit)}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>

              {/* Allocation Method Selection */}
              <FormControl component="fieldset" sx={{ mb: 3 }}>
                <FormLabel component="legend">Allocation Method</FormLabel>
                <RadioGroup
                  value={allocationMethod}
                  onChange={(e) => setAllocationMethod(e.target.value)}
                >
                  <FormControlLabel 
                    value="time-based" 
                    control={<Radio />} 
                    label="Time-based (proportional to days in each month)" 
                  />
                  <FormControlLabel 
                    value="manual" 
                    control={<Radio />} 
                    label="Manual allocation (specify percentages)" 
                  />
                </RadioGroup>
              </FormControl>

              {/* Allocation Results */}
              <Typography variant="h6" sx={{ mb: 2 }}>
                Monthly Breakdown
              </Typography>
              
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Month</TableCell>
                      <TableCell>Days</TableCell>
                      <TableCell>Percentage</TableCell>
                      <TableCell>Revenue</TableCell>
                      <TableCell>Costs</TableCell>
                      <TableCell>Profit</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {manualAllocations.map((allocation, index) => (
                      <TableRow key={index}>
                        <TableCell>{allocation.monthKey}</TableCell>
                        <TableCell>{allocation.days}</TableCell>
                        <TableCell>{formatPercentage(allocation.percentage)}</TableCell>
                        <TableCell>{formatCurrency(allocation.revenue)}</TableCell>
                        <TableCell>{formatCurrency(allocation.costs)}</TableCell>
                        <TableCell>{formatCurrency(allocation.profit)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Manual Allocation Controls */}
              {allocationMethod === 'manual' && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Adjust percentages (must total 100%):
                  </Typography>
                  <Grid container spacing={2}>
                    {manualAllocations.map((allocation, index) => (
                      <Grid item xs={12} sm={6} key={index}>
                        <TextField
                          fullWidth
                          label={`${allocation.monthKey} (%)`}
                          type="number"
                          value={allocation.percentage}
                          onChange={(e) => {
                            const newAllocations = [...manualAllocations];
                            newAllocations[index].percentage = parseFloat(e.target.value) || 0;
                            setManualAllocations(newAllocations);
                          }}
                          inputProps={{ min: 0, max: 100, step: 0.1 }}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button 
            onClick={() => setAllocationDialogOpen(false)}
            variant="contained"
            sx={{ 
              backgroundColor: '#b98f33',
              color: '#000000',
              border: '1px solid #8b6b1f',
              boxShadow: '0 2px 4px rgba(185, 143, 51, 0.3)',
              background: 'linear-gradient(135deg, #b98f33 0%, #d4af5a 100%)',
              '&:hover': { 
                backgroundColor: '#d4af5a',
                boxShadow: '0 4px 8px rgba(185, 143, 51, 0.4)'
              }
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={applyAllocation}
            variant="contained"
            sx={{ 
              backgroundColor: '#b98f33',
              color: '#000000',
              border: '2px solid #8b6b1f',
              boxShadow: '0 4px 8px rgba(185, 143, 51, 0.3)',
              background: 'linear-gradient(135deg, #b98f33 0%, #d4af5a 100%)',
              '&:hover': { 
                backgroundColor: '#d4af5a',
                boxShadow: '0 6px 12px rgba(185, 143, 51, 0.4)',
                transform: 'translateY(-1px)'
              }
            }}
          >
            Apply Allocation
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
  };

  export default PLPage; 