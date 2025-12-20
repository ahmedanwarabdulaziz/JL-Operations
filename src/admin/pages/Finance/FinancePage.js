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
  CircularProgress,
  Alert,
  Tooltip,
  Chip,
  Button,
  Select,
  MenuItem,
  FormControl,
} from '@mui/material';
import {
  Search as SearchIcon,
  AccountBalance as AccountBalanceIcon,
  Receipt as ReceiptIcon,
  TrendingUp as TrendingUpIcon,
  MonetizationOn as MonetizationOnIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { collection, getDocs, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../shared/firebase/config';
import { useNotification } from '../../../shared/components/Common/NotificationSystem';
import { calculateOrderTotal, calculateJLCostAnalysisBeforeTax, calculateOrderProfit, normalizePaymentData } from '../../../shared/utils/orderCalculations';
import { formatCurrency, formatPercentage } from '../../../shared/utils/plCalculations';
import { formatDateOnly, toDateObject } from '../../../utils/dateUtils';
import { normalizeAllocation } from '../../../shared/utils/allocationUtils';

const FinancePage = () => {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [invoiceStatuses, setInvoiceStatuses] = useState([]);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  
  // Year/Month filter state
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);

  const { showError, showSuccess } = useNotification();

  // Format customer details for tooltip
  const formatCustomerDetails = (order) => {
    if (order.orderType === 'corporate') {
      const corporateName = order.corporateCustomer?.corporateName || 'N/A';
      const email = order.contactPerson?.email || order.corporateCustomer?.email || 'No email';
      const phone = order.contactPerson?.phone || order.corporateCustomer?.phone || 'No phone';
      const address = order.corporateCustomer?.address || 'No address';
      
      return `Corporate Customer:\n${corporateName}\n\nEmail: ${email}\nPhone: ${phone}\nAddress: ${address}`;
    } else {
      const customerName = order.personalInfo?.customerName || 'N/A';
      const email = order.personalInfo?.email || 'No email';
      const phone = order.personalInfo?.phone || 'No phone';
      const address = order.personalInfo?.address || 'No address';
      
      return `Customer:\n${customerName}\n\nEmail: ${email}\nPhone: ${phone}\nAddress: ${address}`;
    }
  };

  // Format allocation details for tooltip
  const formatAllocationDetails = (order) => {
    if (!order.allocation || !order.allocation.allocations || order.allocation.allocations.length === 0) {
      return 'No allocation data';
    }

    // Normalize allocation to handle both old and new formats
    const profitData = calculateOrderProfit(order);
    const normalizedAllocation = normalizeAllocation(order.allocation, profitData);
    
    if (!normalizedAllocation || !normalizedAllocation.allocations || normalizedAllocation.allocations.length === 0) {
      return 'No allocation data';
    }

    const allocations = normalizedAllocation.allocations;
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    
    // Format month name from allocation (month is 1-indexed: 1-12)
    const formatMonthName = (allocation) => {
      const month = Number(allocation.month);
      const year = Number(allocation.year);
      
      if (isNaN(month) || isNaN(year) || month < 1 || month > 12 || year <= 0) {
        return 'N/A';
      }
      
      const monthIndex = month - 1;
      if (monthIndex < 0 || monthIndex > 11) {
        return `Month ${month} ${year}`;
      }
      
      return `${monthNames[monthIndex]} ${year}`;
    };

    let details = 'Allocation Details:\n\n';
    
    allocations.forEach((allocation, index) => {
      const revenue = allocation.revenue !== undefined 
        ? allocation.revenue 
        : profitData.revenue * (allocation.percentage / 100);
      const cost = allocation.cost !== undefined
        ? allocation.cost
        : profitData.cost * (allocation.percentage / 100);
      const profit = allocation.profit !== undefined 
        ? allocation.profit 
        : revenue - cost;

      details += `${formatMonthName(allocation)}:\n`;
      details += `  Percentage: ${formatPercentage(allocation.percentage)}\n`;
      details += `  Revenue: ${formatCurrency(revenue)}\n`;
      details += `  Cost: ${formatCurrency(cost)}\n`;
      details += `  Profit: ${formatCurrency(profit)}\n`;
      
      if (index < allocations.length - 1) {
        details += '\n';
      }
    });

    return details;
  };

  // Fetch invoice statuses
  const fetchInvoiceStatuses = async () => {
    try {
      const statusesRef = collection(db, 'invoiceStatuses');
      const statusesSnapshot = await getDocs(statusesRef);
      const statusesData = statusesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort by sortOrder if available, otherwise by label
      statusesData.sort((a, b) => {
        if (a.sortOrder !== undefined && b.sortOrder !== undefined) {
          return a.sortOrder - b.sortOrder;
        }
        return (a.label || '').localeCompare(b.label || '');
      });
      setInvoiceStatuses(statusesData);
    } catch (error) {
      console.error('Error fetching invoice statuses:', error);
      showError('Failed to fetch invoice statuses');
    }
  };

  // Check if invoice number is T- format (taxed invoice)
  const isTFormatInvoice = (order) => {
    // Check multiple possible locations for invoice number
    const invoiceNumber = order.invoiceNumber || order.orderDetails?.billInvoice || '';
    if (!invoiceNumber) return false;
    const str = String(invoiceNumber).trim();
    // Check for T- prefix (case insensitive)
    return str.toUpperCase().startsWith('T-');
  };

  // Fetch orders from Firebase (both regular and corporate, plus taxed invoices and customer invoices)
  const fetchOrders = async () => {
    try {
      setLoading(true);
      
      // Fetch from all collections that might contain invoices
      const [ordersSnapshot, corporateOrdersSnapshot, taxedInvoicesSnapshot, customerInvoicesSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'corporate-orders'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'taxedInvoices'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'customer-invoices'), orderBy('createdAt', 'desc')))
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
      
      // Map taxed invoices
      const taxedInvoices = taxedInvoicesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        orderType: doc.data().orderType || 'regular',
        source: 'taxedInvoices'
      }));
      
      // Map customer invoices
      const customerInvoices = customerInvoicesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        orderType: doc.data().orderType || 'regular',
        source: 'customer-invoices'
      }));
      
      // Combine all orders
      const allOrders = [...regularOrders, ...corporateOrders, ...taxedInvoices, ...customerInvoices];
      
      // Sort by createdAt descending
      allOrders.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : new Date(0));
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : new Date(0));
        return dateB - dateA;
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

  useEffect(() => {
    fetchInvoiceStatuses();
    fetchOrders();
  }, []);

  // Get status label and color
  const getStatusInfo = (statusValue) => {
    const status = invoiceStatuses.find(s => s.value === statusValue);
    return {
      label: status?.label || statusValue || 'N/A',
      color: status?.color || '#757575'
    };
  };

  // Handle status change
  const handleStatusChange = async (orderId, newStatusValue, orderType) => {
    try {
      setUpdatingStatus(orderId);
      
      // Determine which collection to update based on order type
      const collectionName = orderType === 'corporate' ? 'corporate-orders' : 'orders';
      const orderRef = doc(db, collectionName, orderId);
      
      await updateDoc(orderRef, {
        invoiceStatus: newStatusValue,
        statusUpdatedAt: new Date()
      });
      
      // Update local state
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId 
            ? { ...order, invoiceStatus: newStatusValue, statusUpdatedAt: new Date() }
            : order
        )
      );
      
      showSuccess('Order status updated successfully');
    } catch (error) {
      console.error('Error updating order status:', error);
      showError('Failed to update order status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  // Normalize order structure for calculations (handles both regular and corporate orders)
  const normalizeOrderForCalculations = (order) => {
    // Corporate orders use furnitureGroups and paymentDetails
    // Regular orders use furnitureData.groups and paymentData
    if (order.orderType === 'corporate') {
      return {
        ...order,
        furnitureData: {
          groups: order.furnitureGroups || []
        },
        paymentData: order.paymentDetails || {}
      };
    }
    // Regular orders - ensure structure is consistent
    return {
      ...order,
      furnitureData: order.furnitureData || { groups: [] },
      paymentData: order.paymentData || {}
    };
  };

  // Calculate partial amounts for allocated orders based on selected month/year
  const calculatePartialAmounts = (order, profitData, normalizedPayment) => {
    let orderRevenue = profitData.revenue || 0;
    
    // Normalize order structure before calculating cost
    const normalizedOrder = normalizeOrderForCalculations(order);
    let orderCost = calculateJLCostAnalysisBeforeTax(normalizedOrder) || 0;
    let orderProfit = orderRevenue - orderCost;
    
    // Handle payment data for both regular and corporate orders
    let orderPaidAmount = 0;
    if (order.orderType === 'corporate') {
      orderPaidAmount = order.paymentDetails?.amountPaid || normalizedPayment.amountPaid || 0;
    } else {
      orderPaidAmount = normalizedPayment.amountPaid || 0;
    }
    
    // If filtering by month/year and order has allocation, calculate partial amounts
    if (selectedYear !== null && selectedMonth !== null && order.allocation && order.allocation.allocations && order.allocation.allocations.length > 0) {
      try {
        const normalizedAllocation = normalizeAllocation(order.allocation, profitData);
        
        if (normalizedAllocation && normalizedAllocation.allocations) {
          // Find the allocation for the selected month/year
          const matchingAllocation = normalizedAllocation.allocations.find(allocation => {
            const allocationYear = Number(allocation.year);
            const allocationMonth = Number(allocation.month);
            return allocationYear === selectedYear && allocationMonth === selectedMonth;
          });
          
          if (matchingAllocation) {
            // Calculate partial amounts based on allocation percentage
            const allocationMultiplier = (matchingAllocation.percentage || 0) / 100;
            
            orderRevenue = (profitData.revenue || 0) * allocationMultiplier;
            orderCost = orderCost * allocationMultiplier;
            orderProfit = orderRevenue - orderCost;
            orderPaidAmount = orderPaidAmount * allocationMultiplier;
          } else {
            // No matching allocation for this month/year, return zeros
            return {
              revenue: 0,
              cost: 0,
              profit: 0,
              paidAmount: 0,
              balance: 0
            };
          }
        }
      } catch (error) {
        console.error('Error calculating partial amounts:', error);
      }
    }
    
    return {
      revenue: orderRevenue,
      cost: orderCost,
      profit: orderProfit,
      paidAmount: orderPaidAmount,
      balance: orderRevenue - orderPaidAmount
    };
  };

  // Get available years and months from orders (including allocation months)
  const getAvailableYearsAndMonths = () => {
    const yearMonthMap = new Map();
    
    orders.forEach(order => {
      // Add months from allocations if order has allocation
      if (order.allocation && order.allocation.allocations && order.allocation.allocations.length > 0) {
        try {
          const profitData = calculateOrderProfit(order);
          const normalizedAllocation = normalizeAllocation(order.allocation, profitData);
          
          if (normalizedAllocation && normalizedAllocation.allocations) {
            normalizedAllocation.allocations.forEach(allocation => {
              const year = Number(allocation.year);
              const month = Number(allocation.month);
              
              if (!isNaN(year) && !isNaN(month) && month >= 1 && month <= 12 && year > 0 && Number.isFinite(year) && Number.isFinite(month)) {
                if (!yearMonthMap.has(year)) {
                  yearMonthMap.set(year, new Set());
                }
                yearMonthMap.get(year).add(month);
              }
            });
          }
        } catch (error) {
          console.error('Error processing allocation months:', error);
        }
      }
      
      // For unallocated orders, use startDate or createdAt
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
        
        const year = orderDate.getFullYear();
        const month = orderDate.getMonth() + 1;
        
        if (!isNaN(year) && !isNaN(month) && month >= 1 && month <= 12 && year > 0 && Number.isFinite(year) && Number.isFinite(month)) {
          if (!yearMonthMap.has(year)) {
            yearMonthMap.set(year, new Set());
          }
          yearMonthMap.get(year).add(month);
        }
      } catch (error) {
        console.error('Error processing date:', error);
      }
    });
    
    // Convert to sorted arrays
    const years = Array.from(yearMonthMap.keys())
      .map(year => Number(year))
      .filter(year => !isNaN(year) && Number.isFinite(year) && year > 0)
      .sort((a, b) => b - a);
    
    const monthsByYear = {};
    years.forEach(year => {
      if (!yearMonthMap.has(year)) return;
      
      const monthSet = yearMonthMap.get(year);
      if (!monthSet) return;
      
      const months = Array.from(monthSet)
        .map(month => Number(month))
        .filter(month => !isNaN(month) && Number.isFinite(month) && month >= 1 && month <= 12)
        .sort((a, b) => a - b);
      
      if (months.length > 0) {
        monthsByYear[year] = months;
      }
    });
    
    return { years, monthsByYear };
  };

  // Filter orders by year/month and search
  useEffect(() => {
    let filtered = orders;
    
    // Apply year/month filter
    if (selectedYear !== null && selectedMonth !== null) {
      filtered = filtered.filter(order => {
        const hasAllocation = order.allocation && order.allocation.allocations && order.allocation.allocations.length > 0;
        
        // For allocated orders, ONLY check allocation months - don't fall back to startDate
        if (hasAllocation) {
          try {
            const profitData = calculateOrderProfit(order);
            const normalizedAllocation = normalizeAllocation(order.allocation, profitData);
            
            if (normalizedAllocation && normalizedAllocation.allocations) {
              // Check if any allocation month matches the selected year/month
              const hasMatchingAllocation = normalizedAllocation.allocations.some(allocation => {
                const allocationYear = Number(allocation.year);
                const allocationMonth = Number(allocation.month);
                
                if (isNaN(allocationYear) || isNaN(allocationMonth) || allocationMonth < 1 || allocationMonth > 12) {
                  return false;
                }
                
                return allocationYear === selectedYear && allocationMonth === selectedMonth;
              });
              
              // Only show if there's a matching allocation
              return hasMatchingAllocation;
            }
            
            // If allocation exists but can't be normalized, don't show it
            return false;
          } catch (error) {
            console.error('Error checking allocation months:', error);
            return false;
          }
        }
        
        // For unallocated orders, check order startDate or createdAt
        const startDate = order.orderDetails?.startDate || order.createdAt;
        let orderDate;
        
        try {
          if (startDate?.toDate) {
            orderDate = startDate.toDate();
          } else if (startDate) {
            orderDate = toDateObject(startDate);
          } else {
            return false;
          }
          
          const orderYear = orderDate.getFullYear();
          const orderMonth = orderDate.getMonth() + 1;
          
          return orderYear === selectedYear && orderMonth === selectedMonth;
        } catch (error) {
          console.error('Error checking order date:', error);
          return false;
        }
      });
      
      // Additional filter: Remove orders with zero revenue after calculating partial amounts
      filtered = filtered.filter(order => {
        // Normalize order structure for calculations
        const normalizedOrder = normalizeOrderForCalculations(order);
        const profitData = calculateOrderProfit(normalizedOrder);
        
        // Normalize payment data for corporate orders
        const paymentData = order.orderType === 'corporate' 
          ? (order.paymentDetails || {})
          : (order.paymentData || {});
        const normalizedPayment = normalizePaymentData(paymentData);
        const partialAmounts = calculatePartialAmounts(order, profitData, normalizedPayment);
        
        // Only show orders with non-zero revenue
        return partialAmounts.revenue > 0;
      });
    }
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(order => {
        const searchLower = searchTerm.toLowerCase();
        const invoiceMatch = order.orderDetails?.billInvoice?.toLowerCase().includes(searchLower);
        
        // Check customer name based on order type
        let customerMatch = false;
        if (order.orderType === 'corporate') {
          customerMatch = order.corporateCustomer?.corporateName?.toLowerCase().includes(searchLower) ||
                         order.contactPerson?.email?.toLowerCase().includes(searchLower) ||
                         order.corporateCustomer?.email?.toLowerCase().includes(searchLower) ||
                         order.contactPerson?.phone?.toLowerCase().includes(searchLower) ||
                         order.corporateCustomer?.phone?.toLowerCase().includes(searchLower);
        } else {
          customerMatch = order.personalInfo?.customerName?.toLowerCase().includes(searchLower) ||
                         order.personalInfo?.email?.toLowerCase().includes(searchLower) ||
                         order.personalInfo?.phone?.toLowerCase().includes(searchLower);
        }
        
        return invoiceMatch || customerMatch;
      });
    }
    
    setFilteredOrders(filtered);
  }, [searchTerm, orders, selectedYear, selectedMonth]);

  // Calculate monthly summaries (previous, current, next month)
  const calculateMonthlySummaries = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-indexed
    
    // Calculate previous, current, and next month/year
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
          // Check if order has allocation for this month
          try {
            const normalizedAllocation = normalizeAllocation(order.allocation, profitData);
            
            if (normalizedAllocation && normalizedAllocation.allocations) {
              const matchingAllocation = normalizedAllocation.allocations.find(allocation => {
                const allocationYear = Number(allocation.year);
                const allocationMonth = Number(allocation.month);
                return allocationYear === year && allocationMonth === month;
              });
              
              if (matchingAllocation) {
                // Calculate partial amounts based on allocation percentage
                const allocationMultiplier = (matchingAllocation.percentage || 0) / 100;
                orderRevenue = baseRevenue * allocationMultiplier;
                orderCost = baseCost * allocationMultiplier;
                orderTotalTaxedInvoice = baseTotalTaxedInvoice * allocationMultiplier;
                shouldIncludeForMonth = true;
              }
              // If no matching allocation, don't add anything for this month
            }
          } catch (error) {
            console.error('Error processing allocation:', error);
          }
        } else {
          // For unallocated orders, check if order date matches this month
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
        
        // Add to revenue and cost for all orders in this month
        revenue += orderRevenue;
        cost += orderCost;
        
        // Only add to totalTaxedInvoice if it's a T-invoice AND should be included for this month
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const monthlySummaries = calculateMonthlySummaries();

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3, color: '#b98f33', fontWeight: 'bold' }}>
        Finance Overview
      </Typography>

      {/* Monthly Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { key: 'previous', data: monthlySummaries.previous, label: 'Previous Month' },
          { key: 'current', data: monthlySummaries.current, label: 'Current Month' },
          { key: 'next', data: monthlySummaries.next, label: 'Next Month' }
        ].map(({ key, data, label }) => (
          <Grid item xs={12} md={4} key={key}>
            <Card sx={{ backgroundColor: '#2a2a2a', border: '1px solid #333333', height: '100%' }}>
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

      {/* Year/Month Filter */}
      {(() => {
        const { years, monthsByYear } = getAvailableYearsAndMonths();
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        return (
          <Paper sx={{ p: 2, mb: 3, backgroundColor: '#2a2a2a', border: '1px solid #333333' }}>
            <Typography variant="h6" sx={{ mb: 2, color: '#b98f33', fontWeight: 'bold' }}>
              Filter by Year & Month
            </Typography>
            
            {/* Years */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ color: '#ffffff', mb: 1 }}>
                Year:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {years.map(year => {
                  const yearNum = Number(year);
                  return (
                    <Chip
                      key={String(yearNum)}
                      label={String(yearNum)}
                      onClick={() => {
                        setSelectedYear(yearNum);
                        setSelectedMonth(null); // Reset month when year changes
                      }}
                      sx={{
                        backgroundColor: selectedYear === yearNum ? '#b98f33' : '#3a3a3a',
                        color: selectedYear === yearNum ? '#000000' : '#ffffff',
                        fontWeight: selectedYear === yearNum ? 'bold' : 'normal',
                        border: selectedYear === yearNum ? '2px solid #8b6b1f' : '1px solid #555555',
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: selectedYear === yearNum ? '#d4af5a' : '#4a4a4a',
                        },
                      }}
                    />
                  );
                })}
              </Box>
            </Box>
            
            {/* Months for selected year */}
            {selectedYear !== null && monthsByYear[selectedYear] && (
              <Box>
                <Typography variant="subtitle2" sx={{ color: '#ffffff', mb: 1 }}>
                  Month:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {monthsByYear[selectedYear].map(month => {
                    const monthNum = Number(month);
                    const monthIndex = monthNum - 1;
                    const monthName = (monthIndex >= 0 && monthIndex < 12) ? monthNames[monthIndex] : `Month ${monthNum}`;
                    
                    return (
                      <Chip
                        key={String(monthNum)}
                        label={monthName}
                        onClick={() => setSelectedMonth(monthNum)}
                        sx={{
                          backgroundColor: selectedMonth === monthNum ? '#b98f33' : '#3a3a3a',
                          color: selectedMonth === monthNum ? '#000000' : '#ffffff',
                          fontWeight: selectedMonth === monthNum ? 'bold' : 'normal',
                          border: selectedMonth === monthNum ? '2px solid #8b6b1f' : '1px solid #555555',
                          cursor: 'pointer',
                          '&:hover': {
                            backgroundColor: selectedMonth === monthNum ? '#d4af5a' : '#4a4a4a',
                          },
                        }}
                      />
                    );
                  })}
                </Box>
              </Box>
            )}
            
            {/* Clear filter button */}
            {(selectedYear !== null || selectedMonth !== null) && (
              <Box sx={{ mt: 2 }}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setSelectedYear(null);
                    setSelectedMonth(null);
                  }}
                  sx={{
                    color: '#b98f33',
                    borderColor: '#b98f33',
                    '&:hover': {
                      borderColor: '#d4af5a',
                      backgroundColor: 'rgba(185, 143, 51, 0.1)'
                    }
                  }}
                >
                  Clear Filter
                </Button>
              </Box>
            )}
          </Paper>
        );
      })()}

      {/* Search */}
      <Paper sx={{ p: 2, mb: 3, backgroundColor: '#2a2a2a', border: '1px solid #333333' }}>
        <TextField
          fullWidth
          placeholder="Search by invoice number or customer name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#b98f33' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              color: '#ffffff',
              '& fieldset': {
                borderColor: '#555555',
              },
              '&:hover fieldset': {
                borderColor: '#b98f33',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#b98f33',
              },
            },
          }}
        />
      </Paper>

      {/* Orders Table */}
      <Paper sx={{ backgroundColor: '#2a2a2a', border: '1px solid #333333' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#1a1a1a' }}>
                <TableCell sx={{ color: '#b98f33', fontWeight: 'bold' }}>Invoice #</TableCell>
                <TableCell sx={{ color: '#b98f33', fontWeight: 'bold' }}>Date</TableCell>
                <TableCell sx={{ color: '#b98f33', fontWeight: 'bold' }}>Status</TableCell>
                <TableCell sx={{ color: '#b98f33', fontWeight: 'bold' }}>Revenue</TableCell>
                <TableCell sx={{ color: '#b98f33', fontWeight: 'bold' }}>Cost</TableCell>
                <TableCell sx={{ color: '#b98f33', fontWeight: 'bold' }}>Profit</TableCell>
                <TableCell sx={{ color: '#b98f33', fontWeight: 'bold' }}>Paid</TableCell>
                <TableCell sx={{ color: '#b98f33', fontWeight: 'bold' }}>Balance</TableCell>
                <TableCell sx={{ color: '#b98f33', fontWeight: 'bold' }}>Allocation</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ color: '#ffffff', py: 4 }}>
                    <ReceiptIcon sx={{ fontSize: 48, color: '#555555', mb: 2 }} />
                    <Typography variant="body1">No orders found</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => {
                  // Normalize order structure for calculations
                  const normalizedOrder = normalizeOrderForCalculations(order);
                  
                  // Normalize payment data for corporate orders
                  const paymentData = order.orderType === 'corporate' 
                    ? (order.paymentDetails || {})
                    : (order.paymentData || {});
                  const normalizedPayment = normalizePaymentData(paymentData);
                  
                  // Calculate profit using normalized order structure
                  const profitData = calculateOrderProfit(normalizedOrder);
                  const partialAmounts = calculatePartialAmounts(order, profitData, normalizedPayment);
                  const startDate = order.orderDetails?.startDate || order.createdAt;
                  const hasAllocation = order.allocation && order.allocation.allocations && order.allocation.allocations.length > 0;
                  const statusInfo = getStatusInfo(order.invoiceStatus);
                  
                  return (
                    <TableRow key={order.id} sx={{ '&:hover': { backgroundColor: '#333333' } }}>
                      <TableCell sx={{ color: '#ffffff' }}>
                        <Tooltip
                          title={formatCustomerDetails(order)}
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
                          <Box sx={{ cursor: 'help', fontWeight: 'bold' }}>
                            {order.orderDetails?.billInvoice || 'N/A'}
                          </Box>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ color: '#ffffff' }}>
                        {startDate ? formatDateOnly(startDate) : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <FormControl 
                          size="small" 
                          sx={{ 
                            minWidth: 150,
                            '& .MuiOutlinedInput-root': {
                              color: '#ffffff',
                              '& fieldset': {
                                borderColor: '#555555',
                              },
                              '&:hover fieldset': {
                                borderColor: '#b98f33',
                              },
                              '&.Mui-focused fieldset': {
                                borderColor: '#b98f33',
                              },
                            },
                            '& .MuiSelect-icon': {
                              color: '#ffffff',
                            },
                          }}
                        >
                          <Select
                            value={order.invoiceStatus || ''}
                            onChange={(e) => handleStatusChange(order.id, e.target.value, order.orderType)}
                            disabled={updatingStatus === order.id}
                            sx={{
                              backgroundColor: statusInfo.color,
                              color: '#ffffff',
                              fontWeight: 'bold',
                              '& .MuiSelect-select': {
                                py: 0.5,
                              },
                            }}
                            MenuProps={{
                              PaperProps: {
                                sx: {
                                  backgroundColor: '#2a2a2a',
                                  border: '1px solid #555555',
                                  '& .MuiMenuItem-root': {
                                    color: '#ffffff',
                                    '&:hover': {
                                      backgroundColor: '#3a3a3a',
                                    },
                                    '&.Mui-selected': {
                                      backgroundColor: '#b98f33',
                                      '&:hover': {
                                        backgroundColor: '#d4af5a',
                                      },
                                    },
                                  },
                                },
                              },
                            }}
                          >
                            {invoiceStatuses.map((status) => (
                              <MenuItem key={status.id} value={status.value}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Box
                                    sx={{
                                      width: 12,
                                      height: 12,
                                      borderRadius: '50%',
                                      backgroundColor: status.color,
                                    }}
                                  />
                                  {status.label}
                                </Box>
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                        {formatCurrency(partialAmounts.revenue)}
                      </TableCell>
                      <TableCell sx={{ color: '#ffffff' }}>
                        {formatCurrency(partialAmounts.cost)}
                      </TableCell>
                      <TableCell sx={{ 
                        color: partialAmounts.profit >= 0 ? '#4caf50' : '#f44336', 
                        fontWeight: 'bold' 
                      }}>
                        {formatCurrency(partialAmounts.profit)}
                      </TableCell>
                      <TableCell sx={{ color: '#ffffff' }}>
                        {formatCurrency(partialAmounts.paidAmount)}
                      </TableCell>
                      <TableCell sx={{ 
                        color: partialAmounts.balance > 0 ? '#f44336' : '#4caf50', 
                        fontWeight: 'bold' 
                      }}>
                        {formatCurrency(partialAmounts.balance)}
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
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {hasAllocation ? (
                              <CheckCircleIcon sx={{ color: '#4caf50', fontSize: 20 }} />
                            ) : (
                              <CancelIcon sx={{ color: '#f44336', fontSize: 20 }} />
                            )}
                          </Box>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default FinancePage;
