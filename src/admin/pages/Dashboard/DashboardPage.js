import React, { useState, useEffect } from 'react';
import { Typography, Box, Card, CardContent, CircularProgress, List, ListItem, ListItemText, Chip, Grid } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import EventIcon from '@mui/icons-material/Event';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
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
  const [expenses, setExpenses] = useState({
    general: [],
    business: [],
    home: []
  });

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
        
        // Exclude Done status orders
        const orderStatus = order.orderStatus || order.status || order.invoiceStatus || order.orderDetails?.status;
        if (typeof orderStatus === 'string' && orderStatus.trim().toLowerCase() === 'done') {
          return;
        }
        
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
      
      // Fetch from collections and expenses (including customer-invoices for T-invoices)
      const [ordersSnapshot, corporateOrdersSnapshot, taxedInvoicesSnapshot, customerInvoicesSnapshot, generalExpensesSnapshot, businessExpensesSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'corporate-orders'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'taxedInvoices'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'customer-invoices'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'generalExpenses'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'businessExpenses'), orderBy('createdAt', 'desc')))
      ]);
      
      // Map regular orders - EXCLUDE orders with hasTInvoice flag
      const regularOrders = ordersSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          orderType: 'regular'
        }))
        .filter(order => order.hasTInvoice !== true);
      
      // Map corporate orders - EXCLUDE orders with hasTInvoice flag
      const corporateOrders = corporateOrdersSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          orderType: 'corporate'
        }))
        .filter(order => order.hasTInvoice !== true);
      
      // Map taxed invoices - filter out customer invoices (only include corporate)
      const taxedInvoices = taxedInvoicesSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          orderType: doc.data().orderType || 'regular',
          source: 'taxedInvoices'
        }))
        .filter(invoice => {
          // Exclude customer invoices - only include corporate invoices
          const isCustomerInvoice = invoice.orderType === 'customer' || invoice.source === 'customer-invoices';
          return !isCustomerInvoice;
        });
      
      // Map T-invoices from customer-invoices (only T- format)
      const tInvoices = customerInvoicesSnapshot.docs
        .map(doc => {
          const data = doc.data();
          const invoiceNumber = data.invoiceNumber || '';
          const isTFormat = String(invoiceNumber).startsWith('T-');
          return isTFormat ? {
            id: doc.id,
            ...data,
            orderType: 'regular',
            source: 'customer-invoices',
            isTInvoice: true
          } : null;
        })
        .filter(invoice => invoice !== null);
      
      // Fetch original orders for T-invoices to get cost data
      const tInvoicesWithCosts = await Promise.all(
        tInvoices.map(async (tInvoice) => {
          if (tInvoice.originalOrderId) {
            try {
              const orderDoc = await getDoc(doc(db, 'orders', tInvoice.originalOrderId));
              if (orderDoc.exists()) {
                const orderData = orderDoc.data();
                // Attach cost data from original order to T-invoice
                return {
                  ...tInvoice,
                  // Cost data from original order
                  furnitureData: orderData.furnitureData,
                  furnitureGroups: orderData.furnitureGroups,
                  extraExpenses: orderData.extraExpenses,
                  // Keep revenue data from T-invoice (items, calculations, etc.)
                };
              }
            } catch (error) {
              console.error('Error fetching original order for T-invoice:', tInvoice.id, error);
            }
          }
          return tInvoice;
        })
      );
      
      // Combine all orders (excluding orders with hasTInvoice, but including T-invoices)
      const allOrders = [...regularOrders, ...corporateOrders, ...taxedInvoices, ...tInvoicesWithCosts];
      
      // Sort by createdAt descending
      allOrders.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : new Date(0));
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : new Date(0));
        return dateB - dateA;
      });
      
      // Process expenses
      const generalExpenses = generalExpensesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      const businessExpenses = [];
      const homeExpenses = [];
      businessExpensesSnapshot.docs.forEach(doc => {
        const expense = { id: doc.id, ...doc.data() };
        const expenseType = expense.type || 'business';
        if (expenseType === 'home') {
          homeExpenses.push(expense);
        } else {
          businessExpenses.push(expense);
        }
      });
      
      setOrders(allOrders);
      setExpenses({
        general: generalExpenses,
        business: businessExpenses,
        home: homeExpenses
      });
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

  // Calculate current year summary
  const calculateCurrentYearSummary = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    
    let revenue = 0;
    let cost = 0;
    let profit = 0;
    let totalTaxedInvoice = 0;
    
    // Process each order once and aggregate all allocations for the current year
    orders.forEach(order => {
      const hasAllocation = order.allocation && order.allocation.allocations && order.allocation.allocations.length > 0;
      
      // Normalize order structure
      const normalizedOrder = normalizeOrderForCalculations(order);
      
      // Calculate base totals
      const profitData = calculateOrderProfit(normalizedOrder);
      const baseRevenue = profitData.revenue || 0;
      const baseCost = calculateJLCostAnalysisBeforeTax(normalizedOrder) || 0;
      const baseTotalTaxedInvoice = calculateOrderTotal(normalizedOrder) || 0;
      
      // Check if this is a T-invoice (taxed invoice)
      const isTaxedInvoice = isTFormatInvoice(order);
      
      if (hasAllocation) {
        // Process all allocations for the current year
        try {
          const normalizedAllocation = normalizeAllocation(order.allocation, profitData);
          
          if (normalizedAllocation && normalizedAllocation.allocations) {
            normalizedAllocation.allocations.forEach(allocation => {
              const allocationYear = Number(allocation.year);
              const allocationMonth = Number(allocation.month);
              
              // Only process allocations for the current year
              if (allocationYear === currentYear && allocationMonth >= 1 && allocationMonth <= 12) {
                const allocationMultiplier = (allocation.percentage || 0) / 100;
                const orderRevenue = baseRevenue * allocationMultiplier;
                const orderCost = baseCost * allocationMultiplier;
                const orderTotalTaxedInvoice = baseTotalTaxedInvoice * allocationMultiplier;
                
                revenue += orderRevenue;
                cost += orderCost;
                
                if (isTaxedInvoice) {
                  totalTaxedInvoice += orderTotalTaxedInvoice;
                }
              }
            });
          }
        } catch (error) {
          console.error('Error processing allocation:', error);
        }
      } else {
        // For unallocated orders, check if order date is in the current year
        const startDate = order.orderDetails?.startDate || order.createdAt;
        let orderDate;
        
        try {
          if (startDate?.toDate) {
            orderDate = startDate.toDate();
          } else if (startDate) {
            orderDate = toDateObject(startDate);
          } else {
            return; // Skip if no date
          }
          
          const orderYear = orderDate.getFullYear();
          
          if (orderYear === currentYear) {
            revenue += baseRevenue;
            cost += baseCost;
            
            if (isTaxedInvoice) {
              totalTaxedInvoice += baseTotalTaxedInvoice;
            }
          }
        } catch (error) {
          console.error('Error checking order date:', error);
        }
      }
    });
    
    // Calculate expenses for the current year
    let generalExpensesTotal = 0;
    let businessExpensesTotal = 0;
    let homeExpensesTotal = 0;
    
    // Helper function to get year from date
    const getYearFromDate = (dateValue) => {
      if (!dateValue) return null;
      try {
        const date = toDateObject(dateValue);
        if (!date) {
          console.warn('Could not parse date:', dateValue);
          return null;
        }
        return date.getFullYear();
      } catch (error) {
        console.error('Error parsing expense date:', error, dateValue);
        return null;
      }
    };
    
    // Calculate general expenses for current year
    if (expenses && expenses.general && Array.isArray(expenses.general)) {
      expenses.general.forEach(expense => {
        try {
          const expenseDate = expense.date || expense.createdAt;
          if (!expenseDate) {
            console.warn('General expense missing date:', expense.id);
            return;
          }
          
          const expenseYear = getYearFromDate(expenseDate);
          if (expenseYear === currentYear) {
            const expenseTotal = parseFloat(expense.total || 0);
            generalExpensesTotal += expenseTotal;
          }
        } catch (error) {
          console.error('Error processing general expense:', error, expense);
        }
      });
    }
    
    // Calculate business expenses for current year
    if (expenses && expenses.business && Array.isArray(expenses.business)) {
      expenses.business.forEach(expense => {
        try {
          const expenseDate = expense.date || expense.createdAt;
          if (!expenseDate) {
            console.warn('Business expense missing date:', expense.id);
            return;
          }
          
          const expenseYear = getYearFromDate(expenseDate);
          if (expenseYear === currentYear) {
            const expenseTotal = parseFloat(expense.total || 0);
            businessExpensesTotal += expenseTotal;
          }
        } catch (error) {
          console.error('Error processing business expense:', error, expense);
        }
      });
    }
    
    // Calculate home expenses for current year
    if (expenses && expenses.home && Array.isArray(expenses.home)) {
      expenses.home.forEach(expense => {
        try {
          const expenseDate = expense.date || expense.createdAt;
          if (!expenseDate) {
            console.warn('Home expense missing date:', expense.id);
            return;
          }
          
          const expenseYear = getYearFromDate(expenseDate);
          if (expenseYear === currentYear) {
            const expenseTotal = parseFloat(expense.total || 0);
            homeExpensesTotal += expenseTotal;
          }
        } catch (error) {
          console.error('Error processing home expense:', error, expense);
        }
      });
    }
    
    // Calculate total cost (cost + all expenses)
    const totalCost = cost + generalExpensesTotal + businessExpensesTotal + homeExpensesTotal;
    
    // Calculate profit (revenue - total cost)
    profit = revenue - totalCost;
    
    return {
      revenue,
      cost,
      generalExpenses: generalExpensesTotal,
      businessExpenses: businessExpensesTotal,
      homeExpenses: homeExpensesTotal,
      totalCost,
      profit,
      totalTaxedInvoice,
      year: currentYear
    };
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
      
      // Calculate expenses for this month
      let generalExpensesTotal = 0;
      let businessExpensesTotal = 0;
      let homeExpensesTotal = 0;
      
      // Helper function to get year and month from date
      const getYearMonthFromDate = (dateValue) => {
        if (!dateValue) return null;
        try {
          const date = toDateObject(dateValue);
          if (!date) {
            console.warn('Could not parse date:', dateValue);
            return null;
          }
          return { year: date.getFullYear(), month: date.getMonth() + 1 };
        } catch (error) {
          console.error('Error parsing expense date:', error, dateValue);
          return null;
        }
      };
      
      // Calculate general expenses for this month
      if (expenses && expenses.general && Array.isArray(expenses.general)) {
        expenses.general.forEach(expense => {
          try {
            const expenseDate = expense.date || expense.createdAt;
            if (!expenseDate) {
              console.warn('General expense missing date:', expense.id);
              return;
            }
            
            const dateInfo = getYearMonthFromDate(expenseDate);
            if (dateInfo && dateInfo.year === year && dateInfo.month === month) {
              const expenseTotal = parseFloat(expense.total || 0);
              generalExpensesTotal += expenseTotal;
            }
          } catch (error) {
            console.error('Error processing general expense:', error, expense);
          }
        });
      }
      
      // Calculate business expenses for this month
      if (expenses && expenses.business && Array.isArray(expenses.business)) {
        expenses.business.forEach(expense => {
          try {
            const expenseDate = expense.date || expense.createdAt;
            if (!expenseDate) {
              console.warn('Business expense missing date:', expense.id);
              return;
            }
            
            const dateInfo = getYearMonthFromDate(expenseDate);
            if (dateInfo && dateInfo.year === year && dateInfo.month === month) {
              const expenseTotal = parseFloat(expense.total || 0);
              businessExpensesTotal += expenseTotal;
            }
          } catch (error) {
            console.error('Error processing business expense:', error, expense);
          }
        });
      }
      
      // Calculate home expenses for this month
      if (expenses && expenses.home && Array.isArray(expenses.home)) {
        expenses.home.forEach(expense => {
          try {
            const expenseDate = expense.date || expense.createdAt;
            if (!expenseDate) {
              console.warn('Home expense missing date:', expense.id);
              return;
            }
            
            const dateInfo = getYearMonthFromDate(expenseDate);
            if (dateInfo && dateInfo.year === year && dateInfo.month === month) {
              const expenseTotal = parseFloat(expense.total || 0);
              homeExpensesTotal += expenseTotal;
            }
          } catch (error) {
            console.error('Error processing home expense:', error, expense);
          }
        });
      }
      
      // Calculate total cost (cost + all expenses)
      const totalCost = cost + generalExpensesTotal + businessExpensesTotal + homeExpensesTotal;
      
      // Calculate profit (revenue - total cost)
      profit = revenue - totalCost;
      
      return {
        revenue,
        cost,
        generalExpenses: generalExpensesTotal,
        businessExpenses: businessExpensesTotal,
        homeExpenses: homeExpensesTotal,
        totalCost,
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
  const currentYearSummary = calculateCurrentYearSummary();

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

      {/* Current Year Summary Card */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card 
            sx={{ 
              backgroundColor: '#2a2a2a', 
              border: '2px solid #b98f33', 
              height: '100%',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                backgroundColor: '#333333',
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 8px rgba(185, 143, 51, 0.3)',
              },
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <TrendingUpIcon sx={{ color: '#b98f33', fontSize: 28 }} />
                <Typography variant="h6" sx={{ color: '#b98f33', fontWeight: 'bold' }}>
                  Current Year Summary
                </Typography>
                <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 'bold', ml: 'auto' }}>
                  {currentYearSummary.year}
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box>
                  <Typography variant="body2" sx={{ color: '#b98f33', mb: 0.5 }}>
                    Total Taxed Invoice
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                    {formatCurrency(currentYearSummary.totalTaxedInvoice)}
                  </Typography>
                </Box>
                
                <Box>
                  <Typography variant="body2" sx={{ color: '#b98f33', mb: 0.5 }}>
                    Revenue
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                    {formatCurrency(currentYearSummary.revenue)}
                  </Typography>
                </Box>
                
                <Box>
                  <Typography variant="body2" sx={{ color: '#b98f33', mb: 0.5 }}>
                    Cost
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                    {formatCurrency(currentYearSummary.cost)}
                  </Typography>
                </Box>
                
                <Box>
                  <Typography variant="body2" sx={{ color: '#b98f33', mb: 0.5 }}>
                    General Expenses
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                    {formatCurrency(currentYearSummary.generalExpenses)}
                  </Typography>
                </Box>
                
                <Box>
                  <Typography variant="body2" sx={{ color: '#b98f33', mb: 0.5 }}>
                    Home Expenses
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                    {formatCurrency(currentYearSummary.homeExpenses)}
                  </Typography>
                </Box>
                
                <Box>
                  <Typography variant="body2" sx={{ color: '#b98f33', mb: 0.5 }}>
                    Business Expenses
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                    {formatCurrency(currentYearSummary.businessExpenses)}
                  </Typography>
                </Box>
                
                <Box sx={{ borderTop: '1px solid #555555', pt: 1, mt: 0.5 }}>
                  <Typography variant="body2" sx={{ color: '#b98f33', mb: 0.5, fontWeight: 'bold' }}>
                    Total Cost
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                    {formatCurrency(currentYearSummary.totalCost)}
                  </Typography>
                </Box>
                
                <Box>
                  <Typography variant="body2" sx={{ color: '#b98f33', mb: 0.5 }}>
                    Profit
                  </Typography>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      color: currentYearSummary.profit >= 0 ? '#4caf50' : '#f44336', 
                      fontWeight: 'bold' 
                    }}
                  >
                    {formatCurrency(currentYearSummary.profit)}
                  </Typography>
                  {currentYearSummary.revenue > 0 && (
                    <Typography variant="caption" sx={{ color: '#b98f33' }}>
                      {((currentYearSummary.profit / currentYearSummary.revenue) * 100).toFixed(1)}% margin
                    </Typography>
                  )}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Monthly Summary Cards */}
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
                      General Expenses
                    </Typography>
                    <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                      {formatCurrency(data.generalExpenses)}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" sx={{ color: '#b98f33', mb: 0.5 }}>
                      Home Expenses
                    </Typography>
                    <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                      {formatCurrency(data.homeExpenses)}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" sx={{ color: '#b98f33', mb: 0.5 }}>
                      Business Expenses
                    </Typography>
                    <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                      {formatCurrency(data.businessExpenses)}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ borderTop: '1px solid #555555', pt: 1, mt: 0.5 }}>
                    <Typography variant="body2" sx={{ color: '#b98f33', mb: 0.5, fontWeight: 'bold' }}>
                      Total Cost
                    </Typography>
                    <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                      {formatCurrency(data.totalCost)}
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
      </Grid>

      {/* Main Content Grid */}
      <Grid container spacing={3} sx={{ mb: 3 }}>

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
