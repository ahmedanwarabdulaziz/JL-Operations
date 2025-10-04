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
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider
} from '@mui/material';
import {
  Search as SearchIcon,
  Receipt as ReceiptIcon,
  TrendingUp as TrendingUpIcon,
  MonetizationOn as MonetizationOnIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Refresh as RefreshIcon,
  DateRange as DateRangeIcon,
  FilterList as FilterListIcon,
  ExpandMore as ExpandMoreIcon,
  Assignment as AssignmentIcon,
  AttachMoney as AttachMoneyIcon,
  Category as CategoryIcon,
  CalendarToday as CalendarIcon,
  Business as BusinessIcon
} from '@mui/icons-material';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../../components/Common/NotificationSystem';
import { formatDate, formatDateOnly } from '../../utils/dateUtils';
import { buttonStyles } from '../../styles/buttonStyles';

const ExtraExpensesPage = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  
  const [orders, setOrders] = useState([]);
  const [extraExpenses, setExtraExpenses] = useState([]);
  const [filteredExpenses, setFilteredExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expenseTypeFilter, setExpenseTypeFilter] = useState('all');
  
  // Summary statistics
  const [summaryStats, setSummaryStats] = useState({
    totalExpenses: 0,
    totalAmount: 0,
    averageExpense: 0,
    expenseCount: 0,
    ordersWithExpenses: 0,
    totalTaxAmount: 0,
    expenseCategories: {},
    monthlyBreakdown: {}
  });

  // Fetch all orders and extract extra expenses
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const ordersRef = collection(db, 'orders');
      const ordersQuery = query(ordersRef, orderBy('createdAt', 'desc'));
      const ordersSnapshot = await getDocs(ordersQuery);
      
      const ordersData = [];
      const allExpenses = [];
      
      ordersSnapshot.forEach((doc) => {
        const orderData = { id: doc.id, ...doc.data() };
        ordersData.push(orderData);
        
        // Extract extra expenses with order context
        if (orderData.extraExpenses && Array.isArray(orderData.extraExpenses)) {
          orderData.extraExpenses.forEach((expense, index) => {
            allExpenses.push({
              id: `${orderData.id}_${index}`,
              orderId: orderData.id,
              orderBillNumber: orderData.orderDetails?.billInvoice || 'N/A',
              customerName: orderData.personalInfo?.name || 'Unknown',
              customerEmail: orderData.personalInfo?.email || '',
              orderDate: orderData.createdAt || orderData.orderDetails?.orderDate || '',
              orderStatus: orderData.invoiceStatus || 'Unknown',
              description: expense.description || 'Extra Expense',
              price: parseFloat(expense.price) || 0,
              unit: expense.unit || '',
              tax: parseFloat(expense.tax) || 0,
              taxType: expense.taxType || 'fixed',
              total: parseFloat(expense.total) || 0,
              originalExpense: expense
            });
          });
        }
      });
      
      setOrders(ordersData);
      setExtraExpenses(allExpenses);
      setFilteredExpenses(allExpenses);
      
      // Calculate summary statistics
      calculateSummaryStats(allExpenses);
      
    } catch (error) {
      console.error('Error fetching orders:', error);
      showError(`Failed to fetch orders: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const calculateSummaryStats = (expenses) => {
    const totalAmount = expenses.reduce((sum, exp) => sum + exp.total, 0);
    const expenseCount = expenses.length;
    const ordersWithExpenses = new Set(expenses.map(exp => exp.orderId)).size;
    const averageExpense = expenseCount > 0 ? totalAmount / expenseCount : 0;
    const totalTaxAmount = expenses.reduce((sum, exp) => sum + exp.tax, 0);
    
    // Calculate expense categories (based on description keywords)
    const categories = {};
    expenses.forEach(exp => {
      const desc = exp.description.toLowerCase();
      let category = 'Other';
      
      if (desc.includes('shipping') || desc.includes('delivery') || desc.includes('transport')) {
        category = 'Shipping & Delivery';
      } else if (desc.includes('material') || desc.includes('fabric') || desc.includes('foam')) {
        category = 'Materials';
      } else if (desc.includes('labor') || desc.includes('labour') || desc.includes('work')) {
        category = 'Labor';
      } else if (desc.includes('repair') || desc.includes('fix') || desc.includes('maintenance')) {
        category = 'Repairs & Maintenance';
      } else if (desc.includes('tax') || desc.includes('fee') || desc.includes('charge')) {
        category = 'Fees & Charges';
      }
      
      categories[category] = (categories[category] || 0) + exp.total;
    });
    
    // Calculate monthly breakdown
    const monthlyBreakdown = {};
    expenses.forEach(exp => {
      if (exp.orderDate) {
        const date = new Date(exp.orderDate);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyBreakdown[monthKey] = (monthlyBreakdown[monthKey] || 0) + exp.total;
      }
    });
    
    setSummaryStats({
      totalExpenses: totalAmount,
      totalAmount,
      averageExpense,
      expenseCount,
      ordersWithExpenses,
      totalTaxAmount,
      expenseCategories: categories,
      monthlyBreakdown
    });
  };

  // Filter expenses based on search and filters
  const filterExpenses = () => {
    let filtered = [...extraExpenses];
    
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(expense => 
        expense.description.toLowerCase().includes(searchLower) ||
        expense.customerName.toLowerCase().includes(searchLower) ||
        expense.orderBillNumber.toLowerCase().includes(searchLower) ||
        expense.customerEmail.toLowerCase().includes(searchLower)
      );
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(expense => expense.orderStatus === statusFilter);
    }
    
    // Date range filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filtered = filtered.filter(expense => {
        const expenseDate = new Date(expense.orderDate);
        return expenseDate >= fromDate;
      });
    }
    
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999); // Include entire end date
      filtered = filtered.filter(expense => {
        const expenseDate = new Date(expense.orderDate);
        return expenseDate <= toDate;
      });
    }
    
    // Expense type filter (could be enhanced with categorization)
    if (expenseTypeFilter !== 'all') {
      // For now, we'll filter by tax type
      if (expenseTypeFilter === 'taxed') {
        filtered = filtered.filter(expense => expense.tax > 0);
      } else if (expenseTypeFilter === 'no_tax') {
        filtered = filtered.filter(expense => expense.tax === 0);
      }
    }
    
    setFilteredExpenses(filtered);
    calculateSummaryStats(filtered);
  };

  useEffect(() => {
    filterExpenses();
  }, [searchTerm, statusFilter, dateFrom, dateTo, expenseTypeFilter, extraExpenses]);

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleViewOrder = (orderId) => {
    navigate(`/workshop`);
    // Could add logic to select the specific order
  };

  const getStatusColor = (status) => {
    const statusColors = {
      'Pending': 'warning',
      'In Progress': 'info',
      'Completed': 'success',
      'Cancelled': 'error',
      'On Hold': 'secondary'
    };
    return statusColors[status] || 'default';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <Box sx={{ p: 3, backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ 
          color: '#d4af5a', 
          fontWeight: 'bold', 
          mb: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 2
        }}>
          <ReceiptIcon sx={{ fontSize: '2rem' }} />
          Extra Expenses Management
        </Typography>
        <Typography variant="body1" sx={{ color: '#ffffff', opacity: 0.8 }}>
          Track and analyze all extra expenses across orders
        </Typography>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={2}>
          <Card sx={{ 
            backgroundColor: '#2a2a2a', 
            border: '1px solid #d4af5a',
            '&:hover': { backgroundColor: '#333333' }
          }}>
            <CardContent sx={{ textAlign: 'center', p: 2 }}>
              <MonetizationOnIcon sx={{ fontSize: '2rem', color: '#d4af5a', mb: 1 }} />
              <Typography variant="h6" sx={{ color: '#d4af5a', fontWeight: 'bold' }}>
                {formatCurrency(summaryStats.totalAmount)}
              </Typography>
              <Typography variant="body2" sx={{ color: '#ffffff', opacity: 0.8 }}>
                Total Expenses
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={2}>
          <Card sx={{ 
            backgroundColor: '#2a2a2a', 
            border: '1px solid #d4af5a',
            '&:hover': { backgroundColor: '#333333' }
          }}>
            <CardContent sx={{ textAlign: 'center', p: 2 }}>
              <ReceiptIcon sx={{ fontSize: '2rem', color: '#d4af5a', mb: 1 }} />
              <Typography variant="h6" sx={{ color: '#d4af5a', fontWeight: 'bold' }}>
                {summaryStats.expenseCount}
              </Typography>
              <Typography variant="body2" sx={{ color: '#ffffff', opacity: 0.8 }}>
                Expense Items
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={2}>
          <Card sx={{ 
            backgroundColor: '#2a2a2a', 
            border: '1px solid #d4af5a',
            '&:hover': { backgroundColor: '#333333' }
          }}>
            <CardContent sx={{ textAlign: 'center', p: 2 }}>
              <TrendingUpIcon sx={{ fontSize: '2rem', color: '#d4af5a', mb: 1 }} />
              <Typography variant="h6" sx={{ color: '#d4af5a', fontWeight: 'bold' }}>
                {formatCurrency(summaryStats.averageExpense)}
              </Typography>
              <Typography variant="body2" sx={{ color: '#ffffff', opacity: 0.8 }}>
                Average Expense
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={2}>
          <Card sx={{ 
            backgroundColor: '#2a2a2a', 
            border: '1px solid #d4af5a',
            '&:hover': { backgroundColor: '#333333' }
          }}>
            <CardContent sx={{ textAlign: 'center', p: 2 }}>
              <AttachMoneyIcon sx={{ fontSize: '2rem', color: '#d4af5a', mb: 1 }} />
              <Typography variant="h6" sx={{ color: '#d4af5a', fontWeight: 'bold' }}>
                {formatCurrency(summaryStats.totalTaxAmount)}
              </Typography>
              <Typography variant="body2" sx={{ color: '#ffffff', opacity: 0.8 }}>
                Total Tax Amount
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={2}>
          <Card sx={{ 
            backgroundColor: '#2a2a2a', 
            border: '1px solid #d4af5a',
            '&:hover': { backgroundColor: '#333333' }
          }}>
            <CardContent sx={{ textAlign: 'center', p: 2 }}>
              <BusinessIcon sx={{ fontSize: '2rem', color: '#d4af5a', mb: 1 }} />
              <Typography variant="h6" sx={{ color: '#d4af5a', fontWeight: 'bold' }}>
                {summaryStats.ordersWithExpenses}
              </Typography>
              <Typography variant="body2" sx={{ color: '#ffffff', opacity: 0.8 }}>
                Orders with Expenses
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={2}>
          <Card sx={{ 
            backgroundColor: '#2a2a2a', 
            border: '1px solid #d4af5a',
            '&:hover': { backgroundColor: '#333333' }
          }}>
            <CardContent sx={{ textAlign: 'center', p: 2 }}>
              <RefreshIcon sx={{ fontSize: '2rem', color: '#d4af5a', mb: 1 }} />
              <IconButton 
                onClick={fetchOrders}
                sx={{ color: '#d4af5a' }}
                disabled={loading}
              >
                <RefreshIcon />
              </IconButton>
              <Typography variant="body2" sx={{ color: '#ffffff', opacity: 0.8 }}>
                Refresh Data
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Expense Categories and Monthly Breakdown */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, backgroundColor: '#2a2a2a', border: '1px solid #444444' }}>
            <Typography variant="h6" sx={{ color: '#d4af5a', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <CategoryIcon />
              Expense Categories
            </Typography>
            {Object.keys(summaryStats.expenseCategories).length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {Object.entries(summaryStats.expenseCategories)
                  .sort(([,a], [,b]) => b - a)
                  .map(([category, amount]) => (
                    <Box key={category} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, backgroundColor: '#1a1a1a', borderRadius: 1 }}>
                      <Typography variant="body2" sx={{ color: '#ffffff' }}>
                        {category}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#d4af5a', fontWeight: 'bold' }}>
                        {formatCurrency(amount)}
                      </Typography>
                    </Box>
                  ))}
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: '#ffffff', opacity: 0.7 }}>
                No categorized expenses found
              </Typography>
            )}
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, backgroundColor: '#2a2a2a', border: '1px solid #444444' }}>
            <Typography variant="h6" sx={{ color: '#d4af5a', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarIcon />
              Monthly Breakdown
            </Typography>
            {Object.keys(summaryStats.monthlyBreakdown).length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {Object.entries(summaryStats.monthlyBreakdown)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .slice(0, 6) // Show last 6 months
                  .map(([month, amount]) => (
                    <Box key={month} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, backgroundColor: '#1a1a1a', borderRadius: 1 }}>
                      <Typography variant="body2" sx={{ color: '#ffffff' }}>
                        {new Date(month + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#d4af5a', fontWeight: 'bold' }}>
                        {formatCurrency(amount)}
                      </Typography>
                    </Box>
                  ))}
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: '#ffffff', opacity: 0.7 }}>
                No monthly data available
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 3, mb: 3, backgroundColor: '#2a2a2a', border: '1px solid #444444' }}>
        <Typography variant="h6" sx={{ color: '#d4af5a', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <FilterListIcon />
          Filters
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search expenses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#d4af5a' }} />
                  </InputAdornment>
                ),
                sx: { 
                  backgroundColor: '#1a1a1a',
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#d4af5a' },
                    '&:hover fieldset': { borderColor: '#d4af5a' },
                    '&.Mui-focused fieldset': { borderColor: '#d4af5a' }
                  },
                  '& .MuiInputBase-input': { color: '#ffffff' }
                }
              }}
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth>
              <InputLabel sx={{ color: '#d4af5a' }}>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                sx={{
                  backgroundColor: '#1a1a1a',
                  color: '#ffffff',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#d4af5a' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#d4af5a' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#d4af5a' }
                }}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="Pending">Pending</MenuItem>
                <MenuItem value="In Progress">In Progress</MenuItem>
                <MenuItem value="Completed">Completed</MenuItem>
                <MenuItem value="Cancelled">Cancelled</MenuItem>
                <MenuItem value="On Hold">On Hold</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              type="date"
              label="From Date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              InputLabelProps={{ shrink: true, sx: { color: '#d4af5a' } }}
              sx={{
                backgroundColor: '#1a1a1a',
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: '#d4af5a' },
                  '&:hover fieldset': { borderColor: '#d4af5a' },
                  '&.Mui-focused fieldset': { borderColor: '#d4af5a' }
                },
                '& .MuiInputBase-input': { color: '#ffffff' }
              }}
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              type="date"
              label="To Date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              InputLabelProps={{ shrink: true, sx: { color: '#d4af5a' } }}
              sx={{
                backgroundColor: '#1a1a1a',
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: '#d4af5a' },
                  '&:hover fieldset': { borderColor: '#d4af5a' },
                  '&.Mui-focused fieldset': { borderColor: '#d4af5a' }
                },
                '& .MuiInputBase-input': { color: '#ffffff' }
              }}
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth>
              <InputLabel sx={{ color: '#d4af5a' }}>Expense Type</InputLabel>
              <Select
                value={expenseTypeFilter}
                onChange={(e) => setExpenseTypeFilter(e.target.value)}
                sx={{
                  backgroundColor: '#1a1a1a',
                  color: '#ffffff',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#d4af5a' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#d4af5a' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#d4af5a' }
                }}
              >
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="taxed">With Tax</MenuItem>
                <MenuItem value="no_tax">No Tax</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Expenses Table */}
      <Paper sx={{ backgroundColor: '#2a2a2a', border: '1px solid #444444' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#1a1a1a' }}>
                <TableCell sx={{ color: '#d4af5a', fontWeight: 'bold' }}>Description</TableCell>
                <TableCell sx={{ color: '#d4af5a', fontWeight: 'bold' }}>Customer</TableCell>
                <TableCell sx={{ color: '#d4af5a', fontWeight: 'bold' }}>Order #</TableCell>
                <TableCell sx={{ color: '#d4af5a', fontWeight: 'bold' }}>Date</TableCell>
                <TableCell sx={{ color: '#d4af5a', fontWeight: 'bold' }}>Status</TableCell>
                <TableCell sx={{ color: '#d4af5a', fontWeight: 'bold' }}>Price</TableCell>
                <TableCell sx={{ color: '#d4af5a', fontWeight: 'bold' }}>Unit</TableCell>
                <TableCell sx={{ color: '#d4af5a', fontWeight: 'bold' }}>Tax</TableCell>
                <TableCell sx={{ color: '#d4af5a', fontWeight: 'bold' }}>Total</TableCell>
                <TableCell sx={{ color: '#d4af5a', fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} sx={{ textAlign: 'center', py: 4 }}>
                    <CircularProgress sx={{ color: '#d4af5a' }} />
                    <Typography variant="body2" sx={{ color: '#ffffff', mt: 2 }}>
                      Loading expenses...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : filteredExpenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} sx={{ textAlign: 'center', py: 4 }}>
                    <ReceiptIcon sx={{ fontSize: '3rem', color: '#666666', mb: 2 }} />
                    <Typography variant="h6" sx={{ color: '#ffffff', mb: 1 }}>
                      No expenses found
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', opacity: 0.7 }}>
                      {extraExpenses.length === 0 
                        ? 'No extra expenses have been added to any orders yet.'
                        : 'Try adjusting your search filters to find expenses.'
                      }
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredExpenses.map((expense) => (
                  <TableRow 
                    key={expense.id}
                    sx={{ 
                      '&:hover': { backgroundColor: '#333333' },
                      borderBottom: '1px solid #444444'
                    }}
                  >
                    <TableCell sx={{ color: '#ffffff' }}>
                      <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        {expense.description}
                      </Typography>
                    </TableCell>
                    
                    <TableCell sx={{ color: '#ffffff' }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          {expense.customerName}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#ffffff', opacity: 0.7 }}>
                          {expense.customerEmail}
                        </Typography>
                      </Box>
                    </TableCell>
                    
                    <TableCell sx={{ color: '#ffffff' }}>
                      <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        {expense.orderBillNumber}
                      </Typography>
                    </TableCell>
                    
                    <TableCell sx={{ color: '#ffffff' }}>
                      <Typography variant="body2">
                        {expense.orderDate ? formatDateOnly(expense.orderDate) : 'N/A'}
                      </Typography>
                    </TableCell>
                    
                    <TableCell>
                      <Chip 
                        label={expense.orderStatus}
                        size="small"
                        color={getStatusColor(expense.orderStatus)}
                        sx={{ 
                          backgroundColor: getStatusColor(expense.orderStatus) === 'warning' ? '#ff9800' :
                                          getStatusColor(expense.orderStatus) === 'info' ? '#2196f3' :
                                          getStatusColor(expense.orderStatus) === 'success' ? '#4caf50' :
                                          getStatusColor(expense.orderStatus) === 'error' ? '#f44336' : '#666666',
                          color: '#ffffff',
                          fontWeight: 'medium'
                        }}
                      />
                    </TableCell>
                    
                    <TableCell sx={{ color: '#ffffff', textAlign: 'right' }}>
                      {formatCurrency(expense.price)}
                    </TableCell>
                    
                    <TableCell sx={{ color: '#ffffff', textAlign: 'center' }}>
                      {expense.unit || 'N/A'}
                    </TableCell>
                    
                    <TableCell sx={{ color: '#ffffff', textAlign: 'right' }}>
                      {expense.taxType === 'percent' 
                        ? `${expense.tax}%`
                        : formatCurrency(expense.tax)
                      }
                    </TableCell>
                    
                    <TableCell sx={{ color: '#d4af5a', textAlign: 'right', fontWeight: 'bold' }}>
                      {formatCurrency(expense.total)}
                    </TableCell>
                    
                    <TableCell>
                      <Tooltip title="View Order">
                        <IconButton
                          size="small"
                          onClick={() => handleViewOrder(expense.orderId)}
                          sx={{ color: '#d4af5a' }}
                        >
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default ExtraExpensesPage;
