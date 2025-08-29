import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  CircularProgress,
  Alert,
  Chip,
  Grid,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Checkbox,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Receipt as ReceiptIcon,
  BarChart as BarChartIcon,
  RestartAlt as RestartAltIcon
} from '@mui/icons-material';
import { collection, getDocs, query, orderBy, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNotification } from '../../components/Common/NotificationSystem';
import { calculateOrderProfit, calculateOrderTotal } from '../../utils/orderCalculations';
import { formatCurrency } from '../../utils/plCalculations';
import { formatDate, formatDateOnly, formatDateRange } from '../../utils/dateUtils';

const TestingFinancialPage = () => {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showError, showSuccess } = useNotification();

  // Filter states
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1; // 1-12
  const currentYear = currentDate.getFullYear();
  
  const [selectedMonths, setSelectedMonths] = useState([currentMonth]);
  const [selectedYears, setSelectedYears] = useState([currentYear]);
  const [appliedFilters, setAppliedFilters] = useState({
    months: [currentMonth],
    years: [currentYear]
  });

  // Allocation dialog state
  const [allocationDialogOpen, setAllocationDialogOpen] = useState(false);
  const [selectedOrderForAllocation, setSelectedOrderForAllocation] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [monthlyAllocations, setMonthlyAllocations] = useState([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [showAllocationTable, setShowAllocationTable] = useState(false);
  
  // Tooltip state
  const [tooltipData, setTooltipData] = useState({
    show: false,
    content: '',
    x: 0,
    y: 0
  });

  // Calculate totals for displayed records
  const calculateTotals = () => {
    const result = filteredOrders.reduce((totals, order) => {
      const profitData = calculateOrderProfit(order);
      
      // For allocated orders, calculate the portion that belongs to selected months
      if (order.allocation && order.allocation.allocations && order.allocation.allocations.length > 0) {
        const relevantAllocations = order.allocation.allocations.filter(allocation => {
          const monthMatch = appliedFilters.months.length === 0 || appliedFilters.months.includes(allocation.month);
          const yearMatch = appliedFilters.years.length === 0 || appliedFilters.years.includes(allocation.year);
          return monthMatch && yearMatch;
        });
        
        const totalPercentage = relevantAllocations.reduce((sum, allocation) => sum + allocation.percentage, 0);
        const multiplier = totalPercentage / 100;
        
        return {
          revenue: totals.revenue + (profitData.revenue * multiplier),
          cost: totals.cost + (profitData.cost * multiplier),
          profit: totals.profit + (profitData.profit * multiplier),
          invoiceCount: totals.invoiceCount + 1
        };
      } else {
        // For unallocated orders, use full amounts
        return {
          revenue: totals.revenue + profitData.revenue,
          cost: totals.cost + profitData.cost,
          profit: totals.profit + profitData.profit,
          invoiceCount: totals.invoiceCount + 1
        };
      }
    }, { revenue: 0, cost: 0, profit: 0, invoiceCount: 0 });

    // Calculate profit percentage
    const profitPercentage = result.revenue > 0 ? (result.profit / result.revenue) * 100 : 0;
    
    return {
      ...result,
      profitPercentage
    };
  };

  // Get available months and years from orders
  const getAvailableMonthsAndYears = () => {
    const years = new Set();
    
    orders.forEach(order => {
      const startDate = order.orderDetails?.startDate ? 
        (order.orderDetails.startDate?.toDate ? order.orderDetails.startDate.toDate() : new Date(order.orderDetails.startDate)) :
        (order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt));
      
      years.add(startDate.getFullYear());
    });
    
    return {
      months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], // Always show all 12 months
      years: Array.from(years).sort((a, b) => a - b)
    };
  };

  // Apply filters
  const applyFilters = () => {
    let filtered = orders;
    
    // Apply month and year filters
    if (appliedFilters.months.length > 0 || appliedFilters.years.length > 0) {
      filtered = filtered.filter(order => {
        // For allocated orders, check if any allocation month falls within the selected filters
        if (order.allocation && order.allocation.allocations && order.allocation.allocations.length > 0) {
          return order.allocation.allocations.some(allocation => {
            const monthMatch = appliedFilters.months.length === 0 || appliedFilters.months.includes(allocation.month);
            const yearMatch = appliedFilters.years.length === 0 || appliedFilters.years.includes(allocation.year);
            return monthMatch && yearMatch;
          });
        } else {
          // For unallocated orders, use startDate or createdAt
          const orderDate = order.orderDetails?.startDate ? 
            (order.orderDetails.startDate?.toDate ? order.orderDetails.startDate.toDate() : new Date(order.orderDetails.startDate)) :
            (order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt));
          
          const monthMatch = appliedFilters.months.length === 0 || appliedFilters.months.includes(orderDate.getMonth() + 1);
          const yearMatch = appliedFilters.years.length === 0 || appliedFilters.years.includes(orderDate.getFullYear());
          
          return monthMatch && yearMatch;
        }
      });
    }
    
    setFilteredOrders(filtered);
  };

  // Handle filter application
  const handleApplyFilters = () => {
    setAppliedFilters({
      months: selectedMonths,
      years: selectedYears
    });
  };

  // Select all months
  const handleSelectAllMonths = () => {
    setSelectedMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  };

  // Deselect all months
  const handleDeselectAllMonths = () => {
    setSelectedMonths([]);
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSelectedMonths([currentMonth]);
    setSelectedYears([currentYear]);
    setAppliedFilters({
      months: [currentMonth],
      years: [currentYear]
    });
  };

  // Fetch orders from Firebase
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, orderBy('orderDetails.billInvoice', 'desc'));
      const querySnapshot = await getDocs(q);
      const ordersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Get invoice statuses to identify cancelled orders
      const statusesRef = collection(db, 'invoiceStatuses');
      const statusesSnapshot = await getDocs(statusesRef);
      const statusesData = statusesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Filter out cancelled orders
      const cancelledStatuses = statusesData.filter(status => 
        status.isEndState && status.endStateType === 'cancelled'
      );
      const cancelledValues = cancelledStatuses.map(status => status.value);

      const activeOrders = ordersData.filter(order => 
        !cancelledValues.includes(order.invoiceStatus)
      );
      
      setOrders(activeOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      showError('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Apply filters when appliedFilters changes
  useEffect(() => {
    applyFilters();
  }, [appliedFilters, orders]);

  // Initialize filtered orders when orders are loaded
  useEffect(() => {
    // Apply the default filters immediately when orders are loaded
    if (orders.length > 0) {
      applyFilters();
    } else {
      setFilteredOrders(orders);
    }
  }, [orders]);

  // Helper function to format date
  const formatDate = (date) => {
    if (!date) return 'N/A';
    let dateObj;
    if (date.toDate) {
      dateObj = date.toDate();
    } else {
      dateObj = new Date(date);
    }
    return dateObj.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric',
      year: 'numeric' 
    });
  };

  // Helper function to check if order is allocated
  const isAllocated = (order) => {
    return order.allocation && order.allocation.allocations && order.allocation.allocations.length > 0;
  };

  // Helper function to get start date
  const getStartDate = (order) => {
    if (order.orderDetails?.startDate) {
      return formatDate(order.orderDetails.startDate);
    }
    return formatDate(order.createdAt);
  };

  // Helper function to get end date
  const getEndDate = (order) => {
    if (order.orderDetails?.endDate) {
      return formatDate(order.orderDetails.endDate);
    }
    return formatDate(order.createdAt);
  };

  // Helper function to get payment status
  const getPaymentStatus = (order) => {
    const total = calculateOrderTotal(order);
    const amountPaid = parseFloat(order.paymentData?.amountPaid) || 0;
    const deposit = parseFloat(order.paymentData?.deposit) || 0;
    
    // Ensure amounts are valid numbers
    const validAmountPaid = isNaN(amountPaid) ? 0 : amountPaid;
    const validDeposit = isNaN(deposit) ? 0 : deposit;
    
    if (validAmountPaid >= total) return { status: 'Fully Paid', color: '#4caf50' };
    if (validAmountPaid >= validDeposit && validDeposit > 0) return { status: 'Deposit Paid', color: '#ff9800' };
    if (validAmountPaid > 0) return { status: 'Partial Payment', color: '#f44336' };
    return { status: 'Not Paid', color: '#757575' };
  };

  // Generate months between dates for allocation
  const generateMonthsBetweenDates = (startDate, endDate) => {
    const months = [];
    const currentDate = new Date(startDate);
    currentDate.setDate(1); // Start from first day of month
    
    while (currentDate <= endDate) {
      months.push({
        month: currentDate.getMonth() + 1,
        year: currentDate.getFullYear(),
        label: currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        percentage: 100 / Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24 * 30.44))) // Distribute evenly
      });
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    return months;
  };

  // Generate default allocation table
  const generateMonthlyAllocations = (order) => {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    const months = [];
    for (let i = -2; i <= 2; i++) {
      const month = (currentMonth + i + 12) % 12;
      const year = currentYear + Math.floor((currentMonth + i) / 12);
      months.push({
        month: month + 1,
        year,
        label: new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        percentage: i === 0 ? 100 : 0 // Default 100% to current month
      });
    }
    
    return months;
  };

  // Calculate allocation totals
  const calculateAllocationTotals = (allocations) => {
    return allocations.reduce((totals, allocation) => ({
      totalPercentage: totals.totalPercentage + (allocation.percentage || 0),
      totalRevenue: totals.totalRevenue + (totalRevenue * (allocation.percentage || 0) / 100),
      totalCost: totals.totalCost + (totalCost * (allocation.percentage || 0) / 100),
      totalProfit: totals.totalProfit + ((totalRevenue - totalCost) * (allocation.percentage || 0) / 100)
    }), { totalPercentage: 0, totalRevenue: 0, totalCost: 0, totalProfit: 0 });
  };

  // Get allocation status
  const getAllocationStatus = () => {
    const totals = calculateAllocationTotals(monthlyAllocations);
    const remaining = 100 - totals.totalPercentage;
    
    if (Math.abs(remaining) < 0.01) {
      return { status: 'valid', message: 'Allocation is valid (100%)', color: '#4CAF50' };
    } else if (totals.totalPercentage > 100) {
      return { status: 'over', message: `Total exceeds 100% by ${(totals.totalPercentage - 100).toFixed(1)}%`, color: '#f44336' };
    } else {
      return { status: 'under', message: `${remaining.toFixed(1)}% remaining to reach 100%`, color: '#ff9800' };
    }
  };

  // Update allocation percentage
  const updateAllocationPercentage = (index, percentage) => {
    const newAllocations = [...monthlyAllocations];
    let newPercentage = parseFloat(percentage) || 0;
    
    // Constrain percentage to valid range (0-100)
    newPercentage = Math.max(0, Math.min(100, newPercentage));
    
    // Calculate current total excluding the current index
    const currentTotal = newAllocations.reduce((sum, allocation, i) => {
      if (i !== index) {
        return sum + (allocation.percentage || 0);
      }
      return sum;
    }, 0);
    
    // Check if new percentage would exceed 100%
    if (currentTotal + newPercentage > 100) {
      // Cap the percentage to what's remaining
      newPercentage = Math.max(0, 100 - currentTotal);
    }
    
    newAllocations[index].percentage = newPercentage;
    setMonthlyAllocations(newAllocations);
  };

  // Save dates and update allocation table
  const handleSaveDates = async () => {
    if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      showError('Please enter valid start and end dates');
      return;
    }

    if (startDate > endDate) {
      showError('Start date cannot be after end date');
      return;
    }

    // Generate new allocations based on date range
    const newAllocations = generateMonthsBetweenDates(startDate, endDate);
    
    if (newAllocations.length === 0) {
      showError('No valid months found between the selected dates');
      return;
    }

    setMonthlyAllocations(newAllocations);
    setShowAllocationTable(true);
  };

  // Reset allocation to default
  const resetAllocationToDefault = () => {
    if (selectedOrderForAllocation) {
      const initialAllocations = generateMonthlyAllocations(selectedOrderForAllocation);
      setMonthlyAllocations(initialAllocations);
      setShowAllocationTable(true);
    }
  };

  // Handle allocation dialog open
  const handleAllocationDialog = (order) => {
    setSelectedOrderForAllocation(order);
    setAllocationDialogOpen(true);
    setShowAllocationTable(false);
    
    // Set default dates
    let start, end;
    
    if (order.orderDetails?.startDate) {
      if (order.orderDetails.startDate.toDate) {
        start = order.orderDetails.startDate.toDate();
      } else {
        start = new Date(order.orderDetails.startDate);
      }
    }
    
    if (order.orderDetails?.endDate) {
      if (order.orderDetails.endDate.toDate) {
        end = order.orderDetails.endDate.toDate();
      } else {
        end = new Date(order.orderDetails.endDate);
      }
    }
    
    // Only set dates if they are valid
    if (start && !isNaN(start.getTime())) {
      setStartDate(start);
    } else {
      setStartDate(new Date()); // Default to today
    }
    
    if (end && !isNaN(end.getTime())) {
      setEndDate(end);
    } else {
      setEndDate(new Date()); // Default to today
    }

    // Check if order already has allocation data
    if (order.allocation && order.allocation.allocations) {
      // Use existing allocation data
      setMonthlyAllocations(order.allocation.allocations.map(allocation => ({
        month: allocation.month,
        year: allocation.year,
        label: new Date(allocation.year, allocation.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        percentage: allocation.percentage
      })));
      setShowAllocationTable(true);
    } else {
      // Generate initial allocations
      const initialAllocations = generateMonthlyAllocations(order);
      setMonthlyAllocations(initialAllocations);
    }

    const profitData = calculateOrderProfit(order);
    setTotalRevenue(profitData.revenue);
    setTotalCost(profitData.cost);
  };

  // Handle tooltip show
  const handleTooltipShow = (event, content) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipData({
      show: true,
      content,
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    });
  };

  // Handle tooltip hide
  const handleTooltipHide = () => {
    setTooltipData(prev => ({ ...prev, show: false }));
  };

  // Apply allocation
  const applyAllocation = async () => {
    try {
      if (!selectedOrderForAllocation) return;

      const totals = calculateAllocationTotals(monthlyAllocations);
      if (Math.abs(totals.totalPercentage - 100) > 0.01) {
        showError('Total percentage must equal 100%');
        return;
      }

      // Convert dates to Firestore Timestamps for consistent storage
      const { Timestamp } = await import('firebase/firestore');
      const firestoreNow = Timestamp.fromDate(new Date());
      const firestoreStartDate = startDate ? Timestamp.fromDate(startDate) : null;
      const firestoreEndDate = endDate ? Timestamp.fromDate(endDate) : null;

      // Prepare update data
      const updateData = {
        allocation: {
          allocations: monthlyAllocations,
          appliedAt: firestoreNow,
          totalRevenue,
          totalCost,
          totalProfit: totalRevenue - totalCost
        },
        'orderDetails.startDate': firestoreStartDate,
        'orderDetails.endDate': firestoreEndDate,
        'startDate': firestoreStartDate,
        'endDate': firestoreEndDate
      };

      // Update in Firebase
      const orderRef = doc(db, 'orders', selectedOrderForAllocation.id);
      await updateDoc(orderRef, updateData);
      
      // Update local state
      const updatedOrder = {
        ...selectedOrderForAllocation,
        ...updateData
      };
      
      setOrders(orders.map(order => 
        order.id === selectedOrderForAllocation.id ? updatedOrder : order
      ));
      
      showSuccess('Allocation applied successfully');
      setAllocationDialogOpen(false);
    } catch (error) {
      console.error('Error applying allocation:', error);
      showError('Failed to apply allocation');
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
      {/* Custom CSS for allocation visualization */}
                    <style>
         {`
           .allocation-tooltip {
             pointer-events: none;
             opacity: 0;
             visibility: hidden;
             transition: opacity 0.3s ease, visibility 0.3s ease;
             z-index: 999999 !important;
           }
           .allocation-bar-segment:hover .allocation-tooltip {
             opacity: 1 !important;
             visibility: visible !important;
             z-index: 999999 !important;
           }
         `}
       </style>
             {/* Header */}
       <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
         <Box sx={{ display: 'flex', alignItems: 'center' }}>
           <TrendingUpIcon sx={{ fontSize: 32, color: '#b98f33', mr: 2 }} />
           <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
             Testing Financial
           </Typography>
         </Box>
       </Box>

       {/* Filters Section */}
       <Paper sx={{ backgroundColor: '#2a2a2a', border: '1px solid #333333', mb: 2, p: 2 }}>
         <Typography variant="h6" sx={{ color: '#b98f33', mb: 2 }}>
           Filters
         </Typography>
                   <Grid container spacing={2} alignItems="center">
                                                 {/* Month Selection */}
             <Grid item xs={12} sm={6} md={4}>
               <Box>
                 <FormControl fullWidth sx={{ minWidth: '250px', mb: 1 }}>
                   <InputLabel sx={{ color: '#b98f33' }}>Months</InputLabel>
                   <Select
                     multiple
                     value={selectedMonths}
                     onChange={(e) => setSelectedMonths(e.target.value)}
                     input={<OutlinedInput label="Months" />}
                     renderValue={(selected) => selected.map(month => {
                       const monthNames = [
                         'January', 'February', 'March', 'April', 'May', 'June',
                         'July', 'August', 'September', 'October', 'November', 'December'
                       ];
                       return monthNames[month - 1];
                     }).join(', ')
                     }
                     sx={{
                       '& .MuiOutlinedInput-notchedOutline': { borderColor: '#b98f33' },
                       '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#d4af5a' },
                       '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#b98f33' },
                       '& .MuiSelect-select': { color: '#ffffff' }
                     }}
                   >
                     {/* Individual Month Options */}
                     {getAvailableMonthsAndYears().months.map((month) => {
                       const monthNames = [
                         'January', 'February', 'March', 'April', 'May', 'June',
                         'July', 'August', 'September', 'October', 'November', 'December'
                       ];
                       return (
                         <MenuItem key={month} value={month}>
                           <Checkbox checked={selectedMonths.indexOf(month) > -1} />
                           <ListItemText primary={monthNames[month - 1]} />
                         </MenuItem>
                       );
                     })}
                   </Select>
                 </FormControl>
                 
                 {/* Select All / Deselect All Buttons */}
                 <Box sx={{ display: 'flex', gap: 1 }}>
                   <Button
                     size="small"
                     variant="outlined"
                     onClick={handleSelectAllMonths}
                     sx={{
                       color: '#4caf50',
                       borderColor: '#4caf50',
                       fontSize: '0.75rem',
                       py: 0.5,
                       '&:hover': {
                         borderColor: '#45a049',
                         backgroundColor: 'rgba(76, 175, 80, 0.1)'
                       }
                     }}
                   >
                     Select All
                   </Button>
                   <Button
                     size="small"
                     variant="outlined"
                     onClick={handleDeselectAllMonths}
                     sx={{
                       color: '#ff5722',
                       borderColor: '#ff5722',
                       fontSize: '0.75rem',
                       py: 0.5,
                       '&:hover': {
                         borderColor: '#e64a19',
                         backgroundColor: 'rgba(255, 87, 34, 0.1)'
                       }
                     }}
                   >
                     Deselect All
                   </Button>
                 </Box>
               </Box>
             </Grid>

                         {/* Year Selection */}
             <Grid item xs={12} sm={6} md={2}>
               <Box>
                 <FormControl fullWidth sx={{ minWidth: '150px', mb: 1 }}>
                   <InputLabel sx={{ color: '#b98f33' }}>Years</InputLabel>
                   <Select
                     multiple
                     value={selectedYears}
                     onChange={(e) => setSelectedYears(e.target.value)}
                     input={<OutlinedInput label="Years" />}
                     renderValue={(selected) => selected.join(', ')}
                     sx={{
                       '& .MuiOutlinedInput-notchedOutline': { borderColor: '#b98f33' },
                       '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#d4af5a' },
                       '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#b98f33' },
                       '& .MuiSelect-select': { color: '#ffffff' }
                     }}
                   >
                     {getAvailableMonthsAndYears().years.map((year) => (
                       <MenuItem key={year} value={year}>
                         <Checkbox checked={selectedYears.indexOf(year) > -1} />
                         <ListItemText primary={year} />
                       </MenuItem>
                     ))}
                   </Select>
                 </FormControl>
                 
                 {/* Empty space to align with month buttons */}
                 <Box sx={{ display: 'flex', gap: 1, height: '32px' }}>
                   {/* This empty box maintains alignment with the month buttons */}
                 </Box>
               </Box>
             </Grid>

                        {/* Apply Filter Button */}
             <Grid item xs={12} sm={6} md={3}>
               <Button
                 variant="contained"
                 onClick={handleApplyFilters}
                 fullWidth
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
                 Apply Filters
               </Button>
             </Grid>

             {/* Clear Filter Button */}
             <Grid item xs={12} sm={6} md={3}>
               <Button
                 variant="outlined"
                 onClick={handleClearFilters}
                 fullWidth
                 sx={{
                   color: '#b98f33',
                   borderColor: '#b98f33',
                   '&:hover': {
                     borderColor: '#d4af5a',
                     backgroundColor: 'rgba(185, 143, 51, 0.1)'
                   }
                 }}
               >
                 Clear All
               </Button>
             </Grid>
         </Grid>
       </Paper>

                           {/* Totals Summary */}
        <Paper sx={{ backgroundColor: '#2a2a2a', border: '1px solid #333333', mb: 2, p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ textAlign: 'center', minWidth: '150px' }}>
              <Typography variant="h6" sx={{ color: '#4caf50', fontWeight: 'bold' }}>
                Total Revenue
              </Typography>
              <Typography variant="h5" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                {formatCurrency(calculateTotals().revenue)}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center', minWidth: '150px' }}>
              <Typography variant="h6" sx={{ color: '#ff9800', fontWeight: 'bold' }}>
                Total Cost
              </Typography>
              <Typography variant="h5" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                {formatCurrency(calculateTotals().cost)}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center', minWidth: '150px' }}>
              <Typography variant="h6" sx={{ color: '#2196f3', fontWeight: 'bold' }}>
                Total Profit
              </Typography>
              <Typography variant="h5" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                {formatCurrency(calculateTotals().profit)}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center', minWidth: '150px' }}>
              <Typography variant="h6" sx={{ color: '#b98f33', fontWeight: 'bold' }}>
                Total Invoices
              </Typography>
              <Typography variant="h5" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                {calculateTotals().invoiceCount}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center', minWidth: '150px' }}>
              <Typography variant="h6" sx={{ color: '#9c27b0', fontWeight: 'bold' }}>
                Profit %
              </Typography>
              <Typography variant="h5" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                {calculateTotals().profitPercentage.toFixed(1)}%
              </Typography>
            </Box>
          </Box>
        </Paper>

               {/* Data Table */}
        <Paper sx={{ backgroundColor: '#2a2a2a', border: '1px solid #333333' }}>
         <TableContainer sx={{ overflow: 'visible' }}>
          <Table>
                         <TableHead sx={{ backgroundColor: '#b98f33' }}>
                               <TableRow>
                  <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Invoice NO</TableCell>
                  <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Status</TableCell>
                  <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Paid Status</TableCell>
                  <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Start Date</TableCell>
                  <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>End Date</TableCell>
                  <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Allocated</TableCell>
                  <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Revenue</TableCell>
                  <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Cost</TableCell>
                  <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Profit</TableCell>

                  <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Actions</TableCell>
                </TableRow>
             </TableHead>
                                                   <TableBody>
                {filteredOrders.map((order) => {
                 const profitData = calculateOrderProfit(order);
                 
                 // Calculate the correct amounts to display based on allocations and filters
                 let displayRevenue = profitData.revenue;
                 let displayCost = profitData.cost;
                 let displayProfit = profitData.profit;
                 
                 // For allocated orders, calculate the portion that belongs to selected months
                 if (order.allocation && order.allocation.allocations && order.allocation.allocations.length > 0) {
                   const relevantAllocations = order.allocation.allocations.filter(allocation => {
                     const monthMatch = appliedFilters.months.length === 0 || appliedFilters.months.includes(allocation.month);
                     const yearMatch = appliedFilters.years.length === 0 || appliedFilters.years.includes(allocation.year);
                     return monthMatch && yearMatch;
                   });
                   
                   const totalPercentage = relevantAllocations.reduce((sum, allocation) => sum + allocation.percentage, 0);
                   const multiplier = totalPercentage / 100;
                   
                   displayRevenue = profitData.revenue * multiplier;
                   displayCost = profitData.cost * multiplier;
                   displayProfit = profitData.profit * multiplier;
                 }
                 
                                   return (
                    <TableRow key={order.id} sx={{ '&:hover': { backgroundColor: '#3a3a3a' } }}>
                      <TableCell sx={{ color: '#ffffff' }}>
                        {order.orderDetails?.billInvoice || order.id}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={order.invoiceStatus || 'Unknown'}
                          size="small"
                          sx={{
                            backgroundColor: order.invoiceStatus === 'Done' ? '#4caf50' : 
                                             order.invoiceStatus === 'In Progress' ? '#2196f3' : 
                                             order.invoiceStatus === 'Pending' ? '#ff9800' : '#666666',
                            color: '#ffffff',
                            fontWeight: 'bold'
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const paymentInfo = getPaymentStatus(order);
                          return (
                            <Chip
                              label={paymentInfo.status}
                              size="small"
                              sx={{
                                backgroundColor: paymentInfo.color,
                                color: '#ffffff',
                                fontWeight: 'bold'
                              }}
                            />
                          );
                        })()}
                      </TableCell>
                      <TableCell sx={{ color: '#ffffff' }}>
                        {getStartDate(order)}
                      </TableCell>
                      <TableCell sx={{ color: '#ffffff' }}>
                        {getEndDate(order)}
                      </TableCell>
                     <TableCell>
                       <Chip
                         label={isAllocated(order) ? 'Yes' : 'No'}
                         color={isAllocated(order) ? 'success' : 'warning'}
                         size="small"
                         sx={{
                           backgroundColor: isAllocated(order) ? '#4caf50' : '#ff9800',
                           color: '#ffffff'
                         }}
                       />
                     </TableCell>
                     <TableCell sx={{ color: '#ffffff' }}>
                       {formatCurrency(displayRevenue)}
                     </TableCell>
                     <TableCell sx={{ color: '#ffffff' }}>
                       {formatCurrency(displayCost)}
                     </TableCell>
                                           <TableCell sx={{ color: '#ffffff' }}>
                        {formatCurrency(displayProfit)}
                      </TableCell>

                      <TableCell>
                        <Tooltip title="Allocate Financial Data">
                          <IconButton
                            onClick={() => handleAllocationDialog(order)}
                            size="small"
                            sx={{
                              color: '#b98f33',
                              '&:hover': {
                                backgroundColor: 'rgba(185, 143, 51, 0.1)',
                              },
                            }}
                          >
                            <BarChartIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
             </TableBody>
          </Table>
        </TableContainer>
      </Paper>

             {/* Summary */}
               <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: '#b98f33' }}>
            Total Records: {filteredOrders.length} {appliedFilters.months.length > 0 || appliedFilters.years.length > 0 ? `(Filtered from ${orders.length} total)` : ''}
          </Typography>
        </Box>

        {/* Allocation Dialog */}
        <Dialog 
          open={allocationDialogOpen} 
          onClose={() => setAllocationDialogOpen(false)} 
          maxWidth="lg" 
          fullWidth
          sx={{
            '& .MuiDialog-paper': {
              zIndex: 1000
            },
            '& .MuiBackdrop-root': {
              zIndex: 999
            }
          }}
        >
          <DialogTitle sx={{ 
            background: 'linear-gradient(135deg, #b98f33 0%, #8b6b1f 100%)',
            color: '#000000',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}>
            <BarChartIcon />
            Financial Allocation
          </DialogTitle>
          
          <DialogContent sx={{ backgroundColor: '#3a3a3a', p: 3 }}>
            {/* Order Summary */}
            {selectedOrderForAllocation && (
              <Box sx={{ mb: 3, p: 2, backgroundColor: '#2a2a2a', borderRadius: 1, border: '1px solid #b98f33' }}>
                <Typography variant="h6" sx={{ mb: 1, color: '#b98f33', fontWeight: 'bold' }}>Order Summary</Typography>
                <Typography variant="body2" sx={{ color: '#ffffff' }}>
                  <strong style={{ color: '#b98f33' }}>Order #:</strong> {selectedOrderForAllocation.orderDetails?.billInvoice}
                </Typography>
                <Typography variant="body2" sx={{ color: '#ffffff' }}>
                  <strong style={{ color: '#b98f33' }}>Customer:</strong> {selectedOrderForAllocation.personalInfo?.customerName}
                </Typography>
                <Typography variant="body2" sx={{ color: '#ffffff' }}>
                  <strong style={{ color: '#b98f33' }}>Total Revenue:</strong> ${totalRevenue.toFixed(2)}
                </Typography>
                <Typography variant="body2" sx={{ color: '#ffffff' }}>
                  <strong style={{ color: '#b98f33' }}>Total Cost:</strong> ${totalCost.toFixed(2)}
                </Typography>
                <Typography variant="body2" sx={{ color: '#ffffff' }}>
                  <strong style={{ color: '#b98f33' }}>Total Profit:</strong> ${(totalRevenue - totalCost).toFixed(2)}
                </Typography>
                {selectedOrderForAllocation.allocation && selectedOrderForAllocation.allocation.allocations && (
                  <Typography variant="body2" sx={{ color: '#4CAF50', fontStyle: 'italic', mt: 1 }}>
                    ⚠️ This order already has allocation data. You can edit it or reset to defaults.
                  </Typography>
                )}
              </Box>
            )}

            {/* Editable Dates */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, color: '#b98f33', fontWeight: 'bold' }}>Order Dates</Typography>
              <Grid container spacing={2}>
                <Grid item xs={5}>
                  <TextField
                    label="Start Date"
                    type="date"
                    value={startDate && startDate instanceof Date && !isNaN(startDate) ? startDate.toISOString().split('T')[0] : ''}
                    onChange={(e) => {
                      const date = new Date(e.target.value);
                      if (!isNaN(date.getTime())) {
                        setStartDate(date);
                      }
                    }}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': {
                          borderColor: '#333333',
                        },
                        '&:hover fieldset': {
                          borderColor: '#b98f33',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#b98f33',
                        },
                      },
                      '& .MuiInputLabel-root': {
                        color: '#b98f33',
                      },
                      '& .MuiInputBase-input': {
                        color: '#ffffff',
                      },
                    }}
                  />
                </Grid>
                <Grid item xs={5}>
                  <TextField
                    label="End Date"
                    type="date"
                    value={endDate && endDate instanceof Date && !isNaN(endDate) ? endDate.toISOString().split('T')[0] : ''}
                    onChange={(e) => {
                      const date = new Date(e.target.value);
                      if (!isNaN(date.getTime())) {
                        setEndDate(date);
                      }
                    }}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': {
                          borderColor: '#333333',
                        },
                        '&:hover fieldset': {
                          borderColor: '#b98f33',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#b98f33',
                        },
                      },
                      '& .MuiInputLabel-root': {
                        color: '#b98f33',
                      },
                      '& .MuiInputBase-input': {
                        color: '#ffffff',
                      },
                    }}
                  />
                </Grid>
                <Grid item xs={2}>
                  <Button
                    variant="contained"
                    onClick={handleSaveDates}
                    fullWidth
                    sx={{ 
                      height: '56px',
                      background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
                      color: '#000000',
                      border: '3px solid #4CAF50',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.3)',
                      position: 'relative',
                      '&:hover': {
                        background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
                        border: '3px solid #45a049',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.3), 0 6px 12px rgba(0,0,0,0.4)'
                      },
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '50%',
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
                        borderRadius: '6px 6px 0 0',
                        pointerEvents: 'none'
                      }
                    }}
                  >
                    Save & Confirm
                  </Button>
                </Grid>
              </Grid>
              <Typography variant="body2" sx={{ mt: 1, color: '#b98f33', fontStyle: 'italic' }}>
                Click "Save & Confirm" to update the allocation table with months between your selected dates
              </Typography>
            </Box>

            {/* Reset to Default Button */}
            <Box sx={{ mb: 3 }}>
              <Button
                variant="outlined"
                startIcon={<RestartAltIcon />}
                onClick={resetAllocationToDefault}
                sx={{
                  borderColor: '#b98f33',
                  color: '#b98f33',
                  '&:hover': {
                    borderColor: '#d4af5a',
                    backgroundColor: 'rgba(185, 143, 51, 0.1)',
                  },
                }}
              >
                Reset to Default
              </Button>
            </Box>

            {/* Financial Allocation Table */}
            {showAllocationTable && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 2, color: '#b98f33', fontWeight: 'bold' }}>Monthly Financial Allocation</Typography>
                <Typography variant="body2" sx={{ mb: 2, color: '#b98f33' }}>
                  Distribute the order's revenue and costs across the months between your selected dates. Total percentage must equal 100%.
                </Typography>
              
                <TableContainer component={Paper} sx={{ maxHeight: 400, backgroundColor: '#2a2a2a' }}>
                  <Table stickyHeader>
                    <TableHead>
                      <TableRow sx={{ backgroundColor: '#b98f33' }}>
                        <TableCell sx={{ fontWeight: 'bold', color: '#000000' }}>Month</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: '#000000' }}>Percentage (%)</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: '#000000' }}>Revenue ($)</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: '#000000' }}>Cost ($)</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: '#000000' }}>Profit ($)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {monthlyAllocations.map((allocation, index) => {
                        const revenue = (totalRevenue * allocation.percentage / 100);
                        const cost = (totalCost * allocation.percentage / 100);
                        const profit = revenue - cost;
                        
                        return (
                          <TableRow key={index} sx={{ backgroundColor: '#3a3a3a', '&:hover': { backgroundColor: '#4a4a4a' } }}>
                            <TableCell sx={{ color: '#ffffff' }}>{allocation.label}</TableCell>
                            <TableCell>
                              <TextField
                                type="number"
                                value={allocation.percentage}
                                onChange={(e) => updateAllocationPercentage(index, e.target.value)}
                                size="small"
                                sx={{ 
                                  width: 80,
                                  '& .MuiOutlinedInput-root': {
                                    '& fieldset': {
                                      borderColor: '#333333',
                                    },
                                    '&:hover fieldset': {
                                      borderColor: '#b98f33',
                                    },
                                    '&.Mui-focused fieldset': {
                                      borderColor: '#b98f33',
                                    },
                                  },
                                  '& .MuiInputLabel-root': {
                                    color: '#b98f33',
                                  },
                                  '& .MuiInputBase-input': {
                                    color: '#ffffff',
                                  },
                                }}
                                inputProps={{ 
                                  min: 0, 
                                  max: 100, 
                                  step: 0.1 
                                }}
                              />
                            </TableCell>
                            <TableCell sx={{ fontWeight: 'bold', color: '#4CAF50' }}>
                              ${revenue.toFixed(2)}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 'bold', color: '#f27921' }}>
                              ${cost.toFixed(2)}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 'bold', color: profit >= 0 ? '#4CAF50' : '#f27921' }}>
                              ${profit.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {/* Totals Row */}
                      <TableRow sx={{ backgroundColor: '#b98f33' }}>
                        <TableCell sx={{ fontWeight: 'bold', color: '#000000' }}>TOTAL</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: '#000000' }}>
                          {calculateAllocationTotals(monthlyAllocations).totalPercentage.toFixed(1)}%
                        </TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: '#000000' }}>
                          ${calculateAllocationTotals(monthlyAllocations).totalRevenue.toFixed(2)}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: '#000000' }}>
                          ${calculateAllocationTotals(monthlyAllocations).totalCost.toFixed(2)}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: '#000000' }}>
                          ${calculateAllocationTotals(monthlyAllocations).totalProfit.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
                
                                 {/* Allocation Visualization Bar */}
                 {showAllocationTable && (
                   <Box sx={{ mt: 3, mb: 2 }}>
                     <Typography variant="h6" sx={{ mb: 2, color: '#b98f33', fontWeight: 'bold' }}>
                       Allocation Visualization
                     </Typography>
                     <Box sx={{ 
                       display: 'flex', 
                       height: '40px', 
                       borderRadius: '8px', 
                       overflow: 'hidden',
                       border: '2px solid #333333',
                       boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                       position: 'relative'
                     }}>
                       {monthlyAllocations.map((allocation, index) => {
                         const percentage = allocation.percentage || 0;
                         const width = `${percentage}%`;
                         
                         // Generate professional color palette
                         const colors = [
                           '#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336',
                           '#00BCD4', '#8BC34A', '#FF5722', '#3F51B5', '#009688',
                           '#E91E63', '#673AB7'
                         ];
                         const color = colors[index % colors.length];
                         
                         return (
                           <Box
                             key={index}
                             className="allocation-bar-segment"
                             sx={{
                               width,
                               backgroundColor: color,
                               position: 'relative',
                               transition: 'all 0.3s ease',
                               cursor: 'pointer',
                               '&:hover': {
                                 filter: 'brightness(1.2)',
                                 transform: 'scaleY(1.05)',
                                 zIndex: 10
                               }
                             }}
                           >
                                                           {/* Percentage label on hover */}
                              <Box
                                sx={{
                                  position: 'absolute',
                                  top: '-30px',
                                  left: '50%',
                                  transform: 'translateX(-50%)',
                                  backgroundColor: '#2a2a2a',
                                  color: '#ffffff',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  fontWeight: 'bold',
                                  opacity: 0,
                                  transition: 'opacity 0.3s ease',
                                  whiteSpace: 'nowrap',
                                  zIndex: 99999,
                                  '&::after': {
                                    content: '""',
                                    position: 'absolute',
                                    top: '100%',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    border: '4px solid transparent',
                                    borderTopColor: '#2a2a2a'
                                  }
                                }}
                                className="allocation-tooltip"
                                style={{ zIndex: 99999 }}
                              >
                               {allocation.label}: {percentage.toFixed(1)}%
                             </Box>
                           </Box>
                         );
                       })}
                     </Box>
                     
                     {/* Legend */}
                     <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                       {monthlyAllocations.map((allocation, index) => {
                         const colors = [
                           '#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336',
                           '#00BCD4', '#8BC34A', '#FF5722', '#3F51B5', '#009688',
                           '#E91E63', '#673AB7'
                         ];
                         const color = colors[index % colors.length];
                         
                         return (
                           <Box
                             key={index}
                             sx={{
                               display: 'flex',
                               alignItems: 'center',
                               gap: 0.5,
                               padding: '4px 8px',
                               borderRadius: '4px',
                               backgroundColor: '#2a2a2a',
                               border: '1px solid #333333'
                             }}
                           >
                             <Box
                               sx={{
                                 width: '12px',
                                 height: '12px',
                                 backgroundColor: color,
                                 borderRadius: '2px'
                               }}
                             />
                             <Typography variant="caption" sx={{ color: '#ffffff', fontSize: '11px' }}>
                               {allocation.label}: {allocation.percentage.toFixed(1)}%
                             </Typography>
                           </Box>
                         );
                       })}
                     </Box>
                   </Box>
                 )}

                 {/* Allocation Status */}
                 {showAllocationTable && (
                   <Box sx={{ mt: 2 }}>
                     {(() => {
                       const status = getAllocationStatus();
                       return (
                         <Alert 
                           severity={status.status === 'valid' ? 'success' : status.status === 'over' ? 'error' : 'warning'} 
                           sx={{ 
                             '& .MuiAlert-message': { 
                               color: status.color,
                               fontWeight: 'bold'
                             }
                           }}
                         >
                           {status.message}
                         </Alert>
                       );
                     })()}
                   </Box>
                 )}

                {/* Allocation Summary */}
                {showAllocationTable && getAllocationStatus().status === 'valid' && (
                  <Box sx={{ mt: 3, p: 2, backgroundColor: '#2a2a2a', borderRadius: 1, border: '1px solid #b98f33' }}>
                    <Typography variant="h6" sx={{ mb: 1, color: '#b98f33', fontWeight: 'bold' }}>Allocation Summary</Typography>
                    <Typography variant="body2" sx={{ mb: 1, color: '#ffffff' }}>
                      <strong style={{ color: '#b98f33' }}>Order:</strong> {selectedOrderForAllocation?.orderDetails?.billInvoice || selectedOrderForAllocation?.id}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1, color: '#ffffff' }}>
                      <strong style={{ color: '#b98f33' }}>Date Range:</strong> {(() => {
                        try {
                          const startDateStr = startDate?.toDate ? startDate.toDate().toLocaleDateString() :
                            (startDate?.seconds ? new Date(startDate.seconds * 1000).toLocaleDateString() :
                            (startDate ? new Date(startDate).toLocaleDateString() : 'Not set'));
                          const endDateStr = endDate?.toDate ? endDate.toDate().toLocaleDateString() :
                            (endDate?.seconds ? new Date(endDate.seconds * 1000).toLocaleDateString() :
                            (endDate ? new Date(endDate).toLocaleDateString() : 'Not set'));
                          return `${startDateStr} - ${endDateStr}`;
                        } catch (error) {
                          console.error('Error formatting date range:', error);
                          return 'Invalid Date Range';
                        }
                      })()}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1, color: '#ffffff' }}>
                      <strong style={{ color: '#b98f33' }}>Total Revenue:</strong> {formatCurrency(totalRevenue)}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1, color: '#ffffff' }}>
                      <strong style={{ color: '#b98f33' }}>Total Cost:</strong> {formatCurrency(totalCost)}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1, color: '#ffffff' }}>
                      <strong style={{ color: '#b98f33' }}>Total Profit:</strong> {formatCurrency(totalRevenue - totalCost)}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1, color: '#ffffff' }}>
                      <strong style={{ color: '#b98f33' }}>Allocation Breakdown:</strong>
                    </Typography>
                    <Box sx={{ ml: 2 }}>
                      {monthlyAllocations.map((allocation, index) => (
                        <Typography key={index} variant="body2" sx={{ fontSize: '0.875rem', color: '#ffffff' }}>
                          • {allocation.label}: {allocation.percentage.toFixed(1)}% ({formatCurrency(totalRevenue * allocation.percentage / 100)})
                        </Typography>
                      ))}
                    </Box>
                    <Typography variant="body2" sx={{ mt: 1, fontSize: '0.75rem', color: '#b98f33', fontStyle: 'italic' }}>
                      Last recalculated: {new Date().toLocaleString()}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </DialogContent>
          
          <DialogActions sx={{ backgroundColor: '#3a3a3a', p: 2, gap: 1 }}>
            <Button 
              onClick={() => setAllocationDialogOpen(false)}
              variant="outlined"
              size="small"
              sx={{
                borderColor: '#b98f33',
                color: '#b98f33',
                '&:hover': {
                  borderColor: '#d4af5a',
                  backgroundColor: 'rgba(185, 143, 51, 0.1)',
                },
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={applyAllocation}
              variant="contained"
              disabled={Math.abs(calculateAllocationTotals(monthlyAllocations).totalPercentage - 100) > 0.01}
              size="small"
              sx={{ 
                background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
                color: '#000000',
                border: '3px solid #f27921',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.3)',
                position: 'relative',
                '&:hover': {
                  background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
                  border: '3px solid #e06810',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.3), 0 6px 12px rgba(0,0,0,0.4)'
                },
                '&:disabled': {
                  background: 'linear-gradient(145deg, #a0a0a0 0%, #808080 50%, #606060 100%)',
                  border: '3px solid #666666',
                  color: '#666666',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.2)'
                },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '50%',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
                  borderRadius: '6px 6px 0 0',
                  pointerEvents: 'none'
                }
              }}
            >
              {(() => {
                const status = getAllocationStatus();
                if (status.status === 'valid') {
                  return 'Apply Allocation';
                } else if (status.status === 'over') {
                  return 'Total Exceeds 100% - Cannot Apply';
                } else {
                  return `${Math.abs(100 - calculateAllocationTotals(monthlyAllocations).totalPercentage).toFixed(1)}% Remaining`;
                }
              })()}
            </Button>
          </DialogActions>
                 </Dialog>
         
         {/* Portal Tooltip */}
         {tooltipData.show && createPortal(
           <Box
             sx={{
               position: 'fixed',
               left: tooltipData.x,
               top: tooltipData.y,
               transform: 'translateX(-50%)',
               backgroundColor: '#1a1a1a',
               color: '#ffffff',
               padding: '8px 12px',
               borderRadius: '8px',
               fontSize: '13px',
               fontWeight: 'bold',
               whiteSpace: 'nowrap',
               zIndex: 999999,
               pointerEvents: 'none',
               border: '2px solid #b98f33',
               boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
               textAlign: 'center',
               '&::after': {
                 content: '""',
                 position: 'absolute',
                 top: '100%',
                 left: '50%',
                 transform: 'translateX(-50%)',
                 border: '6px solid transparent',
                 borderTopColor: '#1a1a1a'
               }
             }}
           >
             {tooltipData.content}
           </Box>,
           document.body
         )}
       </Box>
     );
   };

  export default TestingFinancialPage;
