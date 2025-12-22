import React, { useState, useEffect } from 'react';
import { Typography, Box, Card, CardContent, CircularProgress, List, ListItem, ListItemText, Chip, Grid } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import EventIcon from '@mui/icons-material/Event';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../../shared/firebase/config';
import { formatDateOnly, toDateObject } from '../../../utils/dateUtils';
import { useNavigate } from 'react-router-dom';
import { calculateOrderTotal, calculateJLCostAnalysisBeforeTax, calculateOrderProfit } from '../../../shared/utils/orderCalculations';
import { formatCurrency } from '../../../shared/utils/plCalculations';
import { normalizeAllocation } from '../../../shared/utils/allocationUtils';

const DashboardPage = () => {
  const navigate = useNavigate();
  const [upcomingOrders, setUpcomingOrders] = useState([]);
  const [allDeadlineOrders, setAllDeadlineOrders] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deadlineLoading, setDeadlineLoading] = useState(true);
  const [financeLoading, setFinanceLoading] = useState(true);

  useEffect(() => {
    fetchUpcomingOrders();
    fetchAllDeadlineOrders();
    fetchOrders();
  }, []);

  const fetchUpcomingOrders = async () => {
    try {
      setLoading(true);
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, orderBy('orderDetails.deadline', 'desc'));
      const querySnapshot = await getDocs(q);

      const today = new Date();
      const eightDaysFromNow = new Date(today);
      eightDaysFromNow.setDate(today.getDate() + 8);
      eightDaysFromNow.setHours(23, 59, 59, 999);

      const upcoming = [];
      
      querySnapshot.docs.forEach(doc => {
        const order = { id: doc.id, ...doc.data() };
        const deadline = order.orderDetails?.deadline;
        
        if (deadline) {
          // Use toDateObject utility for consistent date handling
          const deadlineDate = toDateObject(deadline);
          
          if (deadlineDate && deadlineDate >= today && deadlineDate <= eightDaysFromNow) {
            const daysLeft = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));
            upcoming.push({
              ...order,
              daysLeft,
              deadlineDate
            });
          }
        }
      });

      // Sort by days left (ascending - closest deadline first)
      upcoming.sort((a, b) => a.daysLeft - b.daysLeft);
      setUpcomingOrders(upcoming);
    } catch (err) {
      console.error('Error fetching upcoming orders:', err);
    } finally {
      setLoading(false);
    }
  };


  const fetchAllDeadlineOrders = async () => {
    try {
      setDeadlineLoading(true);
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, orderBy('orderDetails.deadline', 'desc'));
      const querySnapshot = await getDocs(q);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const allDeadlines = [];
      
      querySnapshot.docs.forEach(doc => {
        const order = { id: doc.id, ...doc.data() };
        const deadline = order.orderDetails?.deadline;
        
        if (deadline) {
          // Use toDateObject utility for consistent date handling
          const deadlineDate = toDateObject(deadline);
          
          if (deadlineDate) {
            const daysLeft = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));
            allDeadlines.push({
              ...order,
              daysLeft,
              deadlineDate
            });
          }
        }
      });

      // Sort by deadline date (ascending - closest deadline first)
      allDeadlines.sort((a, b) => {
        if (!a.deadlineDate || !b.deadlineDate) return 0;
        return a.deadlineDate - b.deadlineDate;
      });
      
      setAllDeadlineOrders(allDeadlines);
    } catch (err) {
      console.error('Error fetching all deadline orders:', err);
    } finally {
      setDeadlineLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      setFinanceLoading(true);
      
      // Fetch from collections (excluding customer-invoices)
      const [ordersSnapshot, corporateOrdersSnapshot, taxedInvoicesSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'corporate-orders'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'taxedInvoices'), orderBy('createdAt', 'desc')))
      ]);
      
      // Map regular orders
      const regularOrders = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        orderType: 'regular'
      }));
      
      // Map corporate orders
      const corporateOrders = corporateOrdersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        orderType: 'corporate'
      }));
      
      // Map taxed invoices - filter out customer invoices (only include corporate)
      const taxedInvoices = taxedInvoicesSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          orderType: doc.data().orderType || 'regular',
          source: 'taxedInvoices'
        }))
        .filter(invoice => {
          const isCustomerInvoice = invoice.orderType === 'customer' || invoice.source === 'customer-invoices';
          return !isCustomerInvoice;
        });
      
      // Combine all orders (excluding customer invoices)
      const allOrders = [...regularOrders, ...corporateOrders, ...taxedInvoices];
      
      setOrders(allOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setFinanceLoading(false);
    }
  };

  // Normalize order structure for calculations
  const normalizeOrderForCalculations = (order) => {
    if (order.orderType === 'corporate') {
      return {
        ...order,
        furnitureData: {
          groups: order.furnitureGroups || []
        },
        paymentData: order.paymentDetails || {}
      };
    }
    return {
      ...order,
      furnitureData: order.furnitureData || { groups: [] },
      paymentData: order.paymentData || {}
    };
  };

  // Check if invoice number is T- format (taxed invoice)
  const isTFormatInvoice = (order) => {
    const invoiceNumber = order.invoiceNumber || order.orderDetails?.billInvoice || '';
    if (!invoiceNumber) return false;
    const str = String(invoiceNumber).trim();
    return str.toUpperCase().startsWith('T-');
  };

  // Calculate monthly summaries (previous, current, next month)
  const calculateMonthlySummaries = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    const getPreviousMonth = () => {
      if (currentMonth === 1) {
        return { year: currentYear - 1, month: 12 };
      }
      return { year: currentYear, month: currentMonth - 1 };
    };
    
    const getNextMonth = () => {
      if (currentMonth === 12) {
        return { year: currentYear + 1, month: 1 };
      }
      return { year: currentYear, month: currentMonth + 1 };
    };
    
    const previousMonth = getPreviousMonth();
    const currentMonthData = { year: currentYear, month: currentMonth };
    const nextMonth = getNextMonth();
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    
    const calculateMonthSummary = (year, month) => {
      let revenue = 0;
      let cost = 0;
      let profit = 0;
      let totalTaxedInvoice = 0;
      
      orders.forEach(order => {
        const hasAllocation = order.allocation && order.allocation.allocations && order.allocation.allocations.length > 0;
        let orderRevenue = 0;
        let orderCost = 0;
        let orderTotalTaxedInvoice = 0;
        let shouldIncludeForMonth = false;
        
        const normalizedOrder = normalizeOrderForCalculations(order);
        const profitData = calculateOrderProfit(normalizedOrder);
        const baseRevenue = profitData.revenue || 0;
        const baseCost = calculateJLCostAnalysisBeforeTax(normalizedOrder) || 0;
        const baseTotalTaxedInvoice = calculateOrderTotal(normalizedOrder) || 0;
        const isTaxedInvoice = isTFormatInvoice(order);
        
        if (hasAllocation) {
          try {
            const normalizedAllocation = normalizeAllocation(order.allocation, profitData);
            
            if (normalizedAllocation && normalizedAllocation.allocations) {
              const matchingAllocation = normalizedAllocation.allocations.find(allocation => {
                const allocationYear = Number(allocation.year);
                const allocationMonth = Number(allocation.month);
                return allocationYear === year && allocationMonth === month;
              });
              
              if (matchingAllocation) {
                const allocationMultiplier = (matchingAllocation.percentage || 0) / 100;
                orderRevenue = baseRevenue * allocationMultiplier;
                orderCost = baseCost * allocationMultiplier;
                orderTotalTaxedInvoice = baseTotalTaxedInvoice * allocationMultiplier;
                shouldIncludeForMonth = true;
              }
            }
          } catch (error) {
            console.error('Error processing allocation:', error);
          }
        } else {
          const startDate = order.orderDetails?.startDate || order.createdAt;
          let orderDate;
          
          try {
            if (startDate?.toDate) {
              orderDate = startDate.toDate();
            } else if (startDate) {
              orderDate = toDateObject(startDate);
            } else {
              return;
            }
            
            const orderYear = orderDate.getFullYear();
            const orderMonth = orderDate.getMonth() + 1;
            
            if (orderYear === year && orderMonth === month) {
              orderRevenue = baseRevenue;
              orderCost = baseCost;
              orderTotalTaxedInvoice = baseTotalTaxedInvoice;
              shouldIncludeForMonth = true;
            }
          } catch (error) {
            console.error('Error checking order date:', error);
          }
        }
        
        revenue += orderRevenue;
        cost += orderCost;
        
        if (isTaxedInvoice && shouldIncludeForMonth) {
          totalTaxedInvoice += orderTotalTaxedInvoice;
        }
      });
      
      profit = revenue - cost;
      
      return {
        revenue,
        cost,
        profit,
        totalTaxedInvoice,
        monthName: monthNames[month - 1],
        year,
        month
      };
    };
    
    return {
      previous: calculateMonthSummary(previousMonth.year, previousMonth.month),
      current: calculateMonthSummary(currentMonthData.year, currentMonthData.month),
      next: calculateMonthSummary(nextMonth.year, nextMonth.month)
    };
  };

  const getDaysLeftColor = (daysLeft) => {
    if (daysLeft < 0) return '#9e9e9e'; // Gray for past deadlines
    if (daysLeft <= 2) return '#f44336'; // Red for urgent
    if (daysLeft <= 4) return '#ff9800'; // Orange for soon
    return '#2196f3'; // Blue for normal
  };

  const handleCardClick = (year, month) => {
    navigate(`/admin/finance?year=${year}&month=${month}`);
  };

  const monthlySummaries = calculateMonthlySummaries();

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
      </Box>

      {/* Main Content Grid */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Left Side - Monthly Summary Cards */}
        <Grid item xs={12} md={8}>
          <Grid container spacing={2}>
            {[
              { key: 'previous', data: monthlySummaries.previous, label: 'Previous Month' },
              { key: 'current', data: monthlySummaries.current, label: 'Current Month' },
              { key: 'next', data: monthlySummaries.next, label: 'Next Month' }
            ].map(({ key, data, label }) => (
              <Grid item xs={12} sm={4} key={key}>
            <Card 
              onClick={() => handleCardClick(data.year, data.month)}
              sx={{ 
                backgroundColor: '#2a2a2a', 
                border: '1px solid #333333', 
                height: '100%',
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  backgroundColor: '#333333',
                  borderColor: '#b98f33',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 8px rgba(185, 143, 51, 0.3)',
                },
              }}
            >
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, color: '#b98f33', fontWeight: 'bold' }}>
                  {label}
                </Typography>
                <Typography variant="subtitle1" sx={{ mb: 2, color: '#ffffff', fontWeight: 'bold' }}>
                  {data.monthName} {data.year}
                </Typography>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box>
                    <Typography variant="body2" sx={{ color: '#b98f33', mb: 0.5 }}>
                      Total Taxed Invoice
                    </Typography>
                    <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                      {formatCurrency(data.totalTaxedInvoice)}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" sx={{ color: '#b98f33', mb: 0.5 }}>
                      Revenue
                    </Typography>
                    <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                      {formatCurrency(data.revenue)}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" sx={{ color: '#b98f33', mb: 0.5 }}>
                      Cost
                    </Typography>
                    <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                      {formatCurrency(data.cost)}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" sx={{ color: '#b98f33', mb: 0.5 }}>
                      Profit
                    </Typography>
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        color: data.profit >= 0 ? '#4caf50' : '#f44336', 
                        fontWeight: 'bold' 
                      }}
                    >
                      {formatCurrency(data.profit)}
                    </Typography>
                    {data.revenue > 0 && (
                      <Typography variant="caption" sx={{ color: '#b98f33' }}>
                        {((data.profit / data.revenue) * 100).toFixed(1)}% margin
                      </Typography>
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>
              </Grid>
            ))}
          </Grid>
        </Grid>

        {/* Right Side - All Invoices with Deadlines Card */}
        <Grid item xs={12} md={4}>
          <Card sx={{ 
            width: '100%',
            backgroundColor: '#2a2a2a',
            border: '1px solid #333333',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            height: '100%'
          }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <EventIcon sx={{ fontSize: 28, color: '#b98f33', mr: 1 }} />
            <Typography variant="h6" sx={{ color: '#b98f33', fontWeight: 'bold' }}>
              All Invoices with Deadlines
            </Typography>
          </Box>

          {deadlineLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
              <CircularProgress size={40} sx={{ color: '#b98f33' }} />
            </Box>
          ) : allDeadlineOrders.length === 0 ? (
            <Typography variant="body1" sx={{ color: '#ffffff', textAlign: 'center', py: 4 }}>
              No invoices with deadlines found
            </Typography>
          ) : (
            <List sx={{ maxHeight: '600px', overflow: 'auto' }}>
              {allDeadlineOrders.map((order, index) => {
                const isPast = order.daysLeft < 0;
                return (
                  <ListItem
                    key={order.id}
                    sx={{
                      backgroundColor: index % 2 === 0 ? '#1a1a1a' : '#2a2a2a',
                      borderRadius: 1,
                      mb: 1,
                      border: '1px solid #333333',
                      opacity: isPast ? 0.7 : 1,
                      '&:hover': {
                        backgroundColor: '#3a3a3a',
                        borderColor: '#b98f33'
                      }
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                          <Typography variant="body1" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                            Invoice #{order.orderDetails?.billInvoice || 'N/A'}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                            {order.hasTInvoice === true && (
                              <Chip
                                label="Has T-Invoice"
                                size="small"
                                sx={{
                                  backgroundColor: '#b98f33',
                                  color: '#ffffff',
                                  fontWeight: 'bold',
                                  fontSize: '0.7rem'
                                }}
                              />
                            )}
                            <Chip
                              label={isPast 
                                ? `${Math.abs(order.daysLeft)} day${Math.abs(order.daysLeft) !== 1 ? 's' : ''} overdue`
                                : `${order.daysLeft} day${order.daysLeft !== 1 ? 's' : ''} left`}
                              size="small"
                              sx={{
                                backgroundColor: getDaysLeftColor(order.daysLeft),
                                color: '#ffffff',
                                fontWeight: 'bold'
                              }}
                            />
                          </Box>
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" sx={{ color: '#cccccc', mt: 0.5 }}>
                            {order.personalInfo?.customerName || 'Unknown Customer'}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#b98f33', display: 'block', mt: 0.5 }}>
                            Deadline: {formatDateOnly(order.deadlineDate)}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                );
              })}
            </List>
          )}
        </CardContent>
      </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardPage; 
