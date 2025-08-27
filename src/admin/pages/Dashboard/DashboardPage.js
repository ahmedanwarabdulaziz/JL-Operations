import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Paper, 
  Box, 
  Grid, 
  Card, 
  CardContent,
  CircularProgress,
  Alert,
  Chip,
  Button
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ReceiptIcon from '@mui/icons-material/Receipt';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PeopleIcon from '@mui/icons-material/People';
import BuildIcon from '@mui/icons-material/Build';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import RefreshIcon from '@mui/icons-material/Refresh';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../../shared/firebase/config';
import { calculateOrderProfit, normalizePaymentData } from '../../../shared/utils/orderCalculations';
import { formatCurrency } from '../../../shared/utils/plCalculations';

// Helper function to calculate partial amounts for allocated orders (same as Finance page)
const calculatePartialAmounts = (order, profitData, normalizedPayment, startOfMonth, endOfMonth) => {
  let orderRevenue = profitData.revenue;
  let orderCost = profitData.cost;
  let orderProfit = profitData.profit;
  let orderPaidAmount = normalizedPayment.amountPaid;
  
  // For allocated orders, calculate partial amounts based on current month
  if (order.allocation && order.allocation.allocations && order.allocation.allocations.length > 0) {
    // Set time to start/end of day for accurate comparison
    const fromDate = new Date(startOfMonth);
    const toDate = new Date(endOfMonth);
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);
    
    // Calculate total allocation percentage for the current month
    let totalAllocationPercentage = 0;
    order.allocation.allocations.forEach(allocation => {
      const allocationDate = new Date(allocation.year, allocation.month - 1, 1);
      if (allocationDate >= fromDate && allocationDate <= toDate) {
        totalAllocationPercentage += allocation.percentage || 0;
      }
    });
    
    // Only apply allocation if there are allocations in the current month
    if (totalAllocationPercentage > 0) {
      const allocationMultiplier = totalAllocationPercentage / 100;
      orderRevenue = profitData.revenue * allocationMultiplier;
      orderCost = profitData.cost * allocationMultiplier;
      orderProfit = profitData.profit * allocationMultiplier;
      orderPaidAmount = normalizedPayment.amountPaid * allocationMultiplier;
    }
  }
  
  return {
    revenue: orderRevenue,
    cost: orderCost,
    profit: orderProfit,
    paidAmount: orderPaidAmount,
    profitPercentage: orderRevenue > 0 ? (orderProfit / orderRevenue) * 100 : 0
  };
};

const DashboardPage = () => {
  const [monthlyData, setMonthlyData] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    totalCost: 0,
    totalProfit: 0,
    totalPaid: 0,
    pendingAmount: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    inProgressOrders: 0,
    averageOrderValue: 0,
    profitMargin: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMonthlyData();
  }, []);

  const fetchMonthlyData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current month start and end dates
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      // Fetch orders for current month
      const ordersRef = collection(db, 'orders');
      
      // Try with date filtering first
      let q = query(
        ordersRef,
        where('createdAt', '>=', startOfMonth),
        where('createdAt', '<=', endOfMonth),
        orderBy('createdAt', 'desc')
      );

      let querySnapshot;
      try {
        querySnapshot = await getDocs(q);
      } catch (error) {
        console.log('Dashboard: Date query failed, trying without date filter:', error);
        // If date query fails, try without date filter and filter in memory
        q = query(ordersRef, orderBy('createdAt', 'desc'));
        querySnapshot = await getDocs(q);
      }
      let orders = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

             // If we got all orders (no date filter), filter them client-side
       if (orders.length > 0 && orders[0].createdAt) {
         const firstOrderDate = orders[0].createdAt.toDate ? orders[0].createdAt.toDate() : new Date(orders[0].createdAt);
         if (firstOrderDate < startOfMonth) {
           console.log('Dashboard: Filtering orders client-side');
           orders = orders.filter(order => {
             const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
             
                           // Include orders created in current month OR allocated orders with allocations in current month
              const isInCurrentMonth = orderDate >= startOfMonth && orderDate <= endOfMonth;
              const hasAllocationsInCurrentMonth = order.allocation && order.allocation.allocations && order.allocation.allocations.some(allocation => {
                const allocationDate = new Date(allocation.year, allocation.month - 1, 1);
                return allocationDate >= startOfMonth && allocationDate <= endOfMonth;
              });
              
              return isInCurrentMonth || hasAllocationsInCurrentMonth;
           });
         }
       }

             console.log('Dashboard: Fetched orders for current month:', orders.length);
       console.log('Dashboard: Date range:', startOfMonth.toDateString(), 'to', endOfMonth.toDateString());
       
               // Log allocated orders for debugging
        const allocatedOrders = orders.filter(order => order.allocation && order.allocation.allocations && order.allocation.allocations.length > 0);
        console.log('Dashboard: Allocated orders found:', allocatedOrders.length);
        allocatedOrders.forEach(order => {
          console.log(`Dashboard: Order ${order.invoiceNumber} has ${order.allocation.allocations.length} allocations`);
        });

      // Calculate monthly statistics
      let totalOrders = 0;
      let totalRevenue = 0;
      let totalCost = 0;
      let totalProfit = 0;
      let totalPaid = 0;
      let pendingAmount = 0;
      let completedOrders = 0;
      let cancelledOrders = 0;
      let inProgressOrders = 0;

      // Filter orders using the same logic as Finance page
      const currentMonthOrders = orders.filter(order => {
        // For allocated orders, check if any allocation falls within the current month
        if (order.allocation && order.allocation.allocations && order.allocation.allocations.length > 0) {
          // Check if any allocation month falls within the current month
          const hasAllocationInCurrentMonth = order.allocation.allocations.some(allocation => {
            const allocationDate = new Date(allocation.year, allocation.month - 1, 1);
            return allocationDate >= startOfMonth && allocationDate <= endOfMonth;
          });
          
          return hasAllocationInCurrentMonth;
        } else {
          // For unallocated orders, use startDate if available, otherwise use createdAt
          const orderDate = order.orderDetails?.startDate ? 
            (order.orderDetails.startDate?.toDate ? order.orderDetails.startDate.toDate() : new Date(order.orderDetails.startDate)) :
            (order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt));
          
          return orderDate >= startOfMonth && orderDate <= endOfMonth;
        }
      });

      console.log('Dashboard: Orders filtered for current month:', currentMonthOrders.length);

      // Calculate statistics for filtered orders
      currentMonthOrders.forEach(order => {
        // Calculate partial amounts for allocated orders (same as Finance page)
        const profitData = calculateOrderProfit(order);
        const normalizedPayment = normalizePaymentData(order.paymentData);
        const partialData = calculatePartialAmounts(order, profitData, normalizedPayment, startOfMonth, endOfMonth);
        
        totalOrders++;
        totalRevenue += partialData.revenue;
        totalCost += partialData.cost;
        totalProfit += partialData.profit;
        totalPaid += partialData.paidAmount;
        pendingAmount += (partialData.revenue - partialData.paidAmount);

        // Count orders by status
        if (order.invoiceStatus === 'done') {
          completedOrders++;
        } else if (order.invoiceStatus === 'cancelled') {
          cancelledOrders++;
        } else {
          // All other statuses (including undefined, null, or any other status) count as in progress
          inProgressOrders++;
        }
      });

      // Calculate averages and percentages
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

      console.log('Dashboard: Calculated data:', {
        totalOrders,
        totalRevenue,
        totalCost,
        totalProfit,
        totalPaid,
        pendingAmount,
        completedOrders,
        cancelledOrders,
        inProgressOrders,
        averageOrderValue,
        profitMargin
      });

      // Debug: Log order statuses for current month
      console.log('Dashboard: Current month orders by status:');
      const statusCounts = {};
      currentMonthOrders.forEach(order => {
        const status = order.invoiceStatus || 'unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      console.log('Dashboard: Status breakdown:', statusCounts);

      setMonthlyData({
        totalOrders,
        totalRevenue,
        totalCost,
        totalProfit,
        totalPaid,
        pendingAmount,
        completedOrders,
        cancelledOrders,
        inProgressOrders,
        averageOrderValue,
        profitMargin
      });

    } catch (err) {
      console.error('Error fetching monthly data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentMonthName = () => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[new Date().getMonth()];
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress size={60} sx={{ color: '#b98f33' }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ width: '100%', maxWidth: '100%' }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', maxWidth: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <DashboardIcon sx={{ fontSize: 32, color: '#b98f33', mr: 2 }} />
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
            Dashboard
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
          <Typography variant="subtitle1" color="text.secondary" sx={{ textAlign: 'right' }}>
            {getCurrentMonthName()} {new Date().getFullYear()} Monthly Report
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right', display: 'block' }}>
            {new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString()} - {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toLocaleDateString()}
          </Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={fetchMonthlyData}
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
            Refresh Data
          </Button>
        </Box>
      </Box>

             {/* Monthly Overview Cards */}
       <Grid container spacing={3} sx={{ mb: 4 }}>
         <Grid item xs={6} sm={3} md={1.5}>
           <Card sx={{ 
             backgroundColor: '#2a2a2a', 
             color: '#ffffff', 
             height: '100%',
             border: '1px solid #333333',
             boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
             background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)'
           }}>
             <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
               <Box sx={{ textAlign: 'center' }}>
                 <ReceiptIcon sx={{ fontSize: 24, mb: 0.5, color: '#b98f33' }} />
                 <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.75rem', color: '#b98f33' }}>
                   Total Orders
                 </Typography>
                 <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 0.5, fontSize: '1.1rem', color: '#ffffff' }}>
                   {monthlyData.totalOrders}
                 </Typography>
                 <Typography variant="caption" sx={{ opacity: 0.9, fontSize: '0.65rem', color: '#b98f33' }}>
                   Orders this month
                 </Typography>
               </Box>
             </CardContent>
           </Card>
         </Grid>

         <Grid item xs={6} sm={3} md={1.5}>
           <Card sx={{ 
             backgroundColor: '#2a2a2a', 
             color: '#ffffff', 
             height: '100%',
             border: '1px solid #333333',
             boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
             background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)'
           }}>
             <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
               <Box sx={{ textAlign: 'center' }}>
                 <TrendingUpIcon sx={{ fontSize: 24, mb: 0.5, color: '#b98f33' }} />
                 <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.75rem', color: '#b98f33' }}>
                   Total Revenue
                 </Typography>
                 <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 0.5, fontSize: '1.1rem', color: '#ffffff' }}>
                   {formatCurrency(monthlyData.totalRevenue)}
                 </Typography>
                 <Typography variant="caption" sx={{ opacity: 0.9, fontSize: '0.65rem', color: '#b98f33' }}>
                   Revenue this month
                 </Typography>
               </Box>
             </CardContent>
           </Card>
         </Grid>

         <Grid item xs={6} sm={3} md={1.5}>
           <Card sx={{ 
             backgroundColor: '#2a2a2a', 
             color: '#ffffff', 
             height: '100%',
             border: '1px solid #333333',
             boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
             background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)'
           }}>
             <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
               <Box sx={{ textAlign: 'center' }}>
                 <AccountBalanceIcon sx={{ fontSize: 24, mb: 0.5, color: '#b98f33' }} />
                 <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.75rem', color: '#b98f33' }}>
                   Total Profit
                 </Typography>
                 <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 0.5, fontSize: '1.1rem', color: '#ffffff' }}>
                   {formatCurrency(monthlyData.totalProfit)}
                 </Typography>
                 <Typography variant="caption" sx={{ opacity: 0.9, fontSize: '0.65rem', color: '#b98f33' }}>
                   {monthlyData.profitMargin.toFixed(1)}% margin
                 </Typography>
               </Box>
             </CardContent>
           </Card>
         </Grid>

         <Grid item xs={6} sm={3} md={1.5}>
           <Card sx={{ 
             backgroundColor: '#2a2a2a', 
             color: '#ffffff', 
             height: '100%',
             border: '1px solid #333333',
             boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
             background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)'
           }}>
             <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
               <Box sx={{ textAlign: 'center' }}>
                 <PeopleIcon sx={{ fontSize: 24, mb: 0.5, color: '#b98f33' }} />
                 <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.75rem', color: '#b98f33' }}>
                   Avg Order Value
                 </Typography>
                 <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 0.5, fontSize: '1.1rem', color: '#ffffff' }}>
                   {formatCurrency(monthlyData.averageOrderValue)}
                 </Typography>
                 <Typography variant="caption" sx={{ opacity: 0.9, fontSize: '0.65rem', color: '#b98f33' }}>
                   Per order average
                 </Typography>
               </Box>
             </CardContent>
           </Card>
         </Grid>
       </Grid>

             {/* Detailed Statistics */}
       <Grid container spacing={3} sx={{ mb: 4 }}>
         <Grid item xs={12} md={6}>
           <Card sx={{ 
             height: '100%',
             backgroundColor: '#2a2a2a',
             border: '1px solid #333333',
             boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
           }}>
             <CardContent>
                               <Typography variant="h6" sx={{ mb: 3, color: '#b98f33', fontWeight: 'bold' }}>
                  Order Status Breakdown - {getCurrentMonthName()} {new Date().getFullYear()}
                </Typography>
                             <Grid container spacing={2}>
                 <Grid item xs={6}>
                   <Box sx={{ textAlign: 'center', p: 2, backgroundColor: '#3a3a3a', borderRadius: 1, border: '1px solid #444444' }}>
                     <CheckCircleIcon sx={{ fontSize: 40, color: '#4caf50', mb: 1 }} />
                     <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#4caf50' }}>
                       {monthlyData.completedOrders}
                     </Typography>
                     <Typography variant="body2" sx={{ color: '#ffffff' }}>
                       Completed
                     </Typography>
                   </Box>
                 </Grid>
                 <Grid item xs={6}>
                   <Box sx={{ textAlign: 'center', p: 2, backgroundColor: '#3a3a3a', borderRadius: 1, border: '1px solid #444444' }}>
                     <BuildIcon sx={{ fontSize: 40, color: '#ff9800', mb: 1 }} />
                     <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#ff9800' }}>
                       {monthlyData.inProgressOrders}
                     </Typography>
                     <Typography variant="body2" sx={{ color: '#ffffff' }}>
                       In Progress
                     </Typography>
                   </Box>
                 </Grid>
                 <Grid item xs={6}>
                   <Box sx={{ textAlign: 'center', p: 2, backgroundColor: '#3a3a3a', borderRadius: 1, border: '1px solid #444444' }}>
                     <CancelIcon sx={{ fontSize: 40, color: '#f44336', mb: 1 }} />
                     <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#f44336' }}>
                       {monthlyData.cancelledOrders}
                     </Typography>
                     <Typography variant="body2" sx={{ color: '#ffffff' }}>
                       Cancelled
                     </Typography>
                   </Box>
                 </Grid>
                 <Grid item xs={6}>
                   <Box sx={{ textAlign: 'center', p: 2, backgroundColor: '#3a3a3a', borderRadius: 1, border: '1px solid #444444' }}>
                     <AccountBalanceIcon sx={{ fontSize: 40, color: '#2196f3', mb: 1 }} />
                     <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#2196f3' }}>
                       {formatCurrency(monthlyData.totalPaid)}
                     </Typography>
                     <Typography variant="body2" sx={{ color: '#ffffff' }}>
                       Total Paid
                     </Typography>
                   </Box>
                 </Grid>
               </Grid>
            </CardContent>
          </Card>
        </Grid>

                 <Grid item xs={12} md={6}>
           <Card sx={{ 
             height: '100%',
             backgroundColor: '#2a2a2a',
             border: '1px solid #333333',
             boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
           }}>
             <CardContent>
                               <Typography variant="h6" sx={{ mb: 3, color: '#b98f33', fontWeight: 'bold' }}>
                  Financial Summary - {getCurrentMonthName()} {new Date().getFullYear()}
                </Typography>
                             <Box sx={{ space: 2 }}>
                 <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, p: 2, backgroundColor: '#3a3a3a', borderRadius: 1 }}>
                   <Typography variant="body1" sx={{ color: '#ffffff' }}>Total Revenue:</Typography>
                   <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#4caf50' }}>
                     {formatCurrency(monthlyData.totalRevenue)}
                   </Typography>
                 </Box>
                 <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, p: 2, backgroundColor: '#3a3a3a', borderRadius: 1 }}>
                   <Typography variant="body1" sx={{ color: '#ffffff' }}>Total Costs:</Typography>
                   <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#f44336' }}>
                     {formatCurrency(monthlyData.totalCost)}
                   </Typography>
                 </Box>
                 <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, p: 2, backgroundColor: '#3a3a3a', borderRadius: 1 }}>
                   <Typography variant="body1" sx={{ color: '#ffffff' }}>Gross Profit:</Typography>
                   <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#2196f3' }}>
                     {formatCurrency(monthlyData.totalProfit)}
                   </Typography>
                 </Box>
                 <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, p: 2, backgroundColor: '#3a3a3a', borderRadius: 1 }}>
                   <Typography variant="body1" sx={{ color: '#ffffff' }}>Pending Amount:</Typography>
                   <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#ff9800' }}>
                     {formatCurrency(monthlyData.pendingAmount)}
                   </Typography>
                 </Box>
                 <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 2, backgroundColor: '#3a3a3a', borderRadius: 1 }}>
                   <Typography variant="body1" sx={{ color: '#ffffff' }}>Profit Margin:</Typography>
                   <Chip 
                     label={`${monthlyData.profitMargin.toFixed(1)}%`}
                     color={monthlyData.profitMargin >= 20 ? 'success' : monthlyData.profitMargin >= 10 ? 'warning' : 'error'}
                     sx={{ fontWeight: 'bold' }}
                   />
                 </Box>
               </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

             {/* Welcome Section */}
       <Paper sx={{ 
         p: 3, 
         backgroundColor: '#2a2a2a',
         border: '1px solid #333333',
         boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
       }}>
         <Typography variant="h5" gutterBottom sx={{ color: '#b98f33', fontWeight: 'bold' }}>
           Welcome to JL Operation Dashboard!
         </Typography>
         <Typography variant="body1" sx={{ mb: 2, color: '#ffffff' }}>
           This dashboard provides a comprehensive overview of your business performance for {getCurrentMonthName()} {new Date().getFullYear()}. 
           Monitor your orders, revenue, and profitability in real-time.
         </Typography>
         <Typography variant="body2" sx={{ color: '#cccccc' }}>
           Use the navigation menu to access detailed reports and manage your operations efficiently.
         </Typography>
       </Paper>
    </Box>
  );
};

export default DashboardPage; 
