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
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel
} from '@mui/material';
import {
  Search as SearchIcon,
  AccountBalance as AccountBalanceIcon,
  Receipt as ReceiptIcon,
  TrendingUp as TrendingUpIcon,
  MonetizationOn as MonetizationOnIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  PictureAsPdf as PdfIcon,
  Refresh as RefreshIcon,
  DateRange as DateRangeIcon,
  FilterList as FilterListIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  CalendarToday as CalendarIcon,
  Assignment as AssignmentIcon,
  Close as CloseIcon,
  Print as PrintIcon
} from '@mui/icons-material';
import { collection, getDocs, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../shared/firebase/config';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../shared/components/Common/NotificationSystem';
import { calculateOrderTotal, calculateJLCostAnalysisBeforeTax, calculateOrderProfit, normalizePaymentData, validatePaymentData, calculatePickupDeliveryCost } from '../shared/utils/orderCalculations';
import { calculateTimeBasedAllocation, formatCurrency, formatPercentage } from '../shared/utils/plCalculations';
import { formatDate, formatDateOnly, formatDateRange, toDateObject } from '../../../utils/dateUtils';
import { generateInvoicePreviewHtml, calculateInvoiceTotals } from '../../shared/utils/invoicePreview';
import { fetchMaterialCompanyTaxRates } from '../../../utils/materialTaxRates';

// Invoice statuses will be loaded dynamically from database

const FinancePage = () => {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [invoiceStatuses, setInvoiceStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingStatus, setEditingStatus] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  
  // Enhanced validation dialog state
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [validationError, setValidationError] = useState({ 
    type: '', 
    message: '', 
    order: null, 
    newStatus: null,
    pendingAmount: 0,
    currentAmount: 0
  });
  
  // Allocation popup state
  const [allocationDialogOpen, setAllocationDialogOpen] = useState(false);
  const [selectedOrderForAllocation, setSelectedOrderForAllocation] = useState(null);
  const [allocationMethod, setAllocationMethod] = useState('time-based');
  const [manualAllocations, setManualAllocations] = useState([]);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [plPreviewData, setPlPreviewData] = useState(null);
  
  // Invoice preview dialog state
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewOrder, setPreviewOrder] = useState(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [materialTaxRates, setMaterialTaxRates] = useState({});
  
  // Year/Month filter state
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonths, setSelectedMonths] = useState([]);
  
  // Date filtering state - default to current month
  const [dateFrom, setDateFrom] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1); // First day of current month
  });
  const [dateTo, setDateTo] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of current month
  });
  const [appliedDateFrom, setAppliedDateFrom] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1); // First day of current month
  });
  const [appliedDateTo, setAppliedDateTo] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of current month
  });
  const [financialSummary, setFinancialSummary] = useState({
    totalRevenue: 0,
    totalCost: 0,
    totalProfit: 0,
    averageProfitMargin: 0,
    paidAmount: 0,
    pendingAmount: 0,
    totalExtraExpenses: 0,
    totalPickupDelivery: 0,
    totalTax: 0,
    totalOrders: 0
  });

  const { showSuccess, showError } = useNotification();
  const navigate = useNavigate();

  // Fetch orders and statuses from Firebase
  const fetchOrders = async () => {
    try {
      setLoading(true);
      
      // Fetch orders
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, orderBy('orderDetails.billInvoice', 'desc'));
      const querySnapshot = await getDocs(q);
      const ordersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Add default invoice status if not present
        invoiceStatus: doc.data().invoiceStatus || 'in_progress'
      }));

      // Get invoice statuses to identify end states
      const statusesRef = collection(db, 'invoiceStatuses');
      const statusesSnapshot = await getDocs(statusesRef);
      const statusesData = statusesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Filter out cancelled and pending orders, include all other orders (including done)
      const excludedStatuses = statusesData.filter(status => 
        status.isEndState && (status.endStateType === 'cancelled' || status.endStateType === 'pending')
      );
      const excludedValues = excludedStatuses.map(status => status.value);

      const activeOrders = ordersData.filter(order => 
        !excludedValues.includes(order.invoiceStatus)
      );
      
      setOrders(activeOrders);
      setFilteredOrders(activeOrders);
      calculateFinancialSummary(activeOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      showError('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  // Fetch invoice statuses from database
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

  // Helper function to calculate partial amounts for allocated orders
  const calculatePartialAmounts = (order, profitData, normalizedPayment) => {
    let orderRevenue = profitData.revenue;
    // Calculate cost: JL Cost Analysis Total (before tax)
    let orderCost = calculateJLCostAnalysisBeforeTax(order);
    // Calculate profit
    let orderProfit = orderRevenue - orderCost;
    let orderPaidAmount = normalizedPayment.amountPaid;
    let orderExtraExpenses = 0;
    let orderPickupDelivery = 0;
    let orderTax = 0;
    
    // Calculate extra expenses total (for display purposes)
    if (order.extraExpenses && Array.isArray(order.extraExpenses)) {
      orderExtraExpenses = order.extraExpenses.reduce((sum, exp) => {
        return sum + (parseFloat(exp.total) || 0);
      }, 0);
    }
    
    // Calculate pickup & delivery cost
    if (order.paymentData?.pickupDeliveryEnabled) {
      const baseCost = parseFloat(order.paymentData.pickupDeliveryCost) || 0;
      const serviceType = order.paymentData.pickupDeliveryServiceType || 'both';
      orderPickupDelivery = calculatePickupDeliveryCost(baseCost, serviceType);
    }
    
    // Calculate tax on the base amount (before pickup & delivery)
    const baseRevenueForTax = orderRevenue - orderPickupDelivery;
    orderTax = baseRevenueForTax * 0.13; // 13% tax rate
    
    // For allocated orders, calculate partial amounts based on date filter
    if (order.allocation && order.allocation.allocations && order.allocation.allocations.length > 0 && appliedDateFrom && appliedDateTo) {
      const fromDate = new Date(appliedDateFrom);
      const toDate = new Date(appliedDateTo);
      
      // Set time to start/end of day for accurate comparison
      fromDate.setHours(0, 0, 0, 0);
      toDate.setHours(23, 59, 59, 999);
      
      // Calculate total allocation percentage for the filtered date range
      let totalAllocationPercentage = 0;
      order.allocation.allocations.forEach(allocation => {
        const allocationDate = new Date(allocation.year, allocation.month, 1);
        if (allocationDate >= fromDate && allocationDate <= toDate) {
          totalAllocationPercentage += allocation.percentage || 0;
        }
      });
      

      
      // Only apply allocation if there are allocations in the date range
      if (totalAllocationPercentage > 0) {
        const allocationMultiplier = totalAllocationPercentage / 100;
        
        // Apply allocation to all components
        orderRevenue = profitData.revenue * allocationMultiplier;
        orderCost = orderCost * allocationMultiplier;
        orderProfit = orderRevenue - orderCost;
        orderPaidAmount = normalizedPayment.amountPaid * allocationMultiplier;
        orderExtraExpenses = orderExtraExpenses * allocationMultiplier;
        orderPickupDelivery = orderPickupDelivery * allocationMultiplier;
        
        // Recalculate tax on allocated base revenue
        const allocatedBaseRevenueForTax = orderRevenue - orderPickupDelivery;
        orderTax = allocatedBaseRevenueForTax * 0.13;
        

      }
    }
    
    return {
      revenue: orderRevenue,
      cost: orderCost,
      profit: orderProfit,
      paidAmount: orderPaidAmount,
      extraExpenses: orderExtraExpenses,
      pickupDelivery: orderPickupDelivery,
      tax: orderTax,
      profitPercentage: orderRevenue > 0 ? (orderProfit / orderRevenue) * 100 : 0
    };
  };

  // Calculate financial summary with allocation support
  const calculateFinancialSummary = (ordersData) => {
    const summary = ordersData.reduce((acc, order) => {
      const profitData = calculateOrderProfit(order);
      const normalizedPayment = normalizePaymentData(order.paymentData);
      
      // Use the enhanced calculatePartialAmounts function
      const partialAmounts = calculatePartialAmounts(order, profitData, normalizedPayment);
      
      acc.totalRevenue += partialAmounts.revenue;
      acc.totalCost += partialAmounts.cost;
      acc.totalProfit += partialAmounts.profit;
      acc.paidAmount += partialAmounts.paidAmount;
      acc.pendingAmount += (partialAmounts.revenue - partialAmounts.paidAmount);
      acc.totalExtraExpenses += partialAmounts.extraExpenses;
      acc.totalPickupDelivery += partialAmounts.pickupDelivery;
      acc.totalTax += partialAmounts.tax;
      acc.totalOrders += 1;
      
      return acc;
    }, { 
      totalRevenue: 0, 
      totalCost: 0, 
      totalProfit: 0, 
      paidAmount: 0, 
      pendingAmount: 0, 
      totalExtraExpenses: 0,
      totalPickupDelivery: 0,
      totalTax: 0,
      totalOrders: 0 
    });
    
    // Calculate average profit margin
    summary.averageProfitMargin = summary.totalRevenue > 0 ? 
      (summary.totalProfit / summary.totalRevenue) * 100 : 0;
    
    setFinancialSummary(summary);
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
          orderDate = toDateObject(startDate);
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

  // Clear year/month filters
  const handleClearYearMonthFilters = () => {
    setSelectedYear(null);
    setSelectedMonths([]);
  };

  // Search and filter logic
  useEffect(() => {
    let filtered = orders;
    
    // Apply year/month filter
    if (selectedYear !== null) {
      filtered = filtered.filter(order => {
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
    
    // Apply date range filter
    if (appliedDateFrom && appliedDateTo) {
      filtered = filtered.filter(order => {
        const fromDate = new Date(appliedDateFrom);
        const toDate = new Date(appliedDateTo);
        
        // Set time to start/end of day for accurate comparison
        fromDate.setHours(0, 0, 0, 0);
        toDate.setHours(23, 59, 59, 999);
        
        // For allocated orders, check both allocation months and order dates
        if (order.allocation && order.allocation.allocations && order.allocation.allocations.length > 0) {

          
          // Check if any allocation month falls within the selected date range
          const hasAllocationInRange = order.allocation.allocations.some(allocation => {
            const allocationDate = new Date(allocation.year, allocation.month, 1);
            

            
            return allocationDate >= fromDate && allocationDate <= toDate;
          });
          
          // Also check if the order's startDate/endDate (updated during allocation) fall within the range
          let hasOrderDateInRange = false;
          if (order.orderDetails?.startDate && order.orderDetails?.endDate) {
            try {
              const orderStartDate = toDateObject(order.orderDetails.startDate);
              const orderEndDate = toDateObject(order.orderDetails.endDate);
              
              // Check if the order date range overlaps with the filter date range
              hasOrderDateInRange = (orderStartDate <= toDate && orderEndDate >= fromDate);
              

            } catch (error) {
              console.error('Error checking order dates for allocated order:', error);
            }
          }
          
          // Return true if either allocation months OR order dates fall within the range
          const finalResult = hasAllocationInRange || hasOrderDateInRange;
          

          
          return finalResult;
        } else {
          // For unallocated orders, use startDate if available, otherwise use createdAt
          let orderDate;
          
          if (order.orderDetails?.startDate) {
            // Use dateUtils to properly convert Firestore Timestamps
            try {
              orderDate = toDateObject(order.orderDetails.startDate);
            } catch (error) {
              console.error('Error converting startDate:', error);
              // Fallback to createdAt
              orderDate = toDateObject(order.createdAt);
            }
          } else {
            orderDate = toDateObject(order.createdAt);
          }
          
          // Debug logging for fast orders
          if (order.isFastOrder) {
            console.log('Fast order filtering:', {
              orderId: order.id,
              billInvoice: order.orderDetails?.billInvoice,
              startDate: order.orderDetails?.startDate,
              createdAt: order.createdAt,
              orderDate: orderDate,
              fromDate: fromDate,
              toDate: toDate,
              isInRange: orderDate >= fromDate && orderDate <= toDate
            });
          }
          
          return orderDate >= fromDate && orderDate <= toDate;
        }
      });
    }
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.personalInfo?.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.orderDetails?.billInvoice?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.personalInfo?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.personalInfo?.phone?.includes(searchTerm)
      );
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.invoiceStatus === statusFilter);
    }
    
    setFilteredOrders(filtered);
    calculateFinancialSummary(filtered);
  }, [searchTerm, statusFilter, orders, appliedDateFrom, appliedDateTo, selectedYear, selectedMonths]);

  // Apply date filter functions
  const handleApplyDateFilter = () => {
    setAppliedDateFrom(dateFrom);
    setAppliedDateTo(dateTo);
  };

  const handleClearDateFilter = () => {
    setDateFrom(() => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    setDateTo(() => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth() + 1, 0);
    });
    setAppliedDateFrom(() => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    setAppliedDateTo(() => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth() + 1, 0);
    });
  };

  // Update invoice status
  const updateInvoiceStatus = async (orderId, newStatus) => {
    try {
      // Find the order and new status
      const order = orders.find(o => o.id === orderId);
      const newStatusObj = invoiceStatuses.find(s => s.value === newStatus);
      
      if (!order || !newStatusObj) {
        showError('Order or status not found');
        return;
      }

      // Payment validation for end states
      if (newStatusObj.isEndState) {
        const totalAmount = calculateOrderProfit(order).revenue;
        const normalizedPayment = normalizePaymentData(order.paymentData);
        
        if (newStatusObj.endStateType === 'done') {
          // For "done" - must be fully paid
          if (normalizedPayment.amountPaid < totalAmount) {
            const pendingAmount = totalAmount - normalizedPayment.amountPaid;
            setValidationError({
              type: 'done',
              message: `Cannot complete order: Payment not fully received. Required: $${totalAmount.toFixed(2)}, Paid: $${normalizedPayment.amountPaid.toFixed(2)}`,
              order: order,
              newStatus: newStatusObj,
              pendingAmount: pendingAmount,
              currentAmount: normalizedPayment.amountPaid
            });
            setValidationDialogOpen(true);
            setStatusDialogOpen(false); // Close the status dialog when validation dialog opens
            return;
          }
          
          // Show allocation dialog for all "End Done" orders
          console.log('Showing allocation dialog for completed order:', order.id);
          handleAllocationDialog(order, newStatusObj);
          setStatusDialogOpen(false);
          return;
        } else if (newStatusObj.endStateType === 'cancelled') {
          // For "cancelled" - must have $0 payment
          if (normalizedPayment.amountPaid > 0) {
            setValidationError({
              type: 'cancelled',
              message: `Cannot cancel order: Payment has been received ($${normalizedPayment.amountPaid.toFixed(2)}). Please refund the customer first.`,
              order: order,
              newStatus: newStatusObj,
              pendingAmount: 0,
              currentAmount: normalizedPayment.amountPaid
            });
            setValidationDialogOpen(true);
            setStatusDialogOpen(false); // Close the status dialog when validation dialog opens
            return;
          }
        }
      }

      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, { invoiceStatus: newStatus });
      
      // Update local state
      const updatedOrders = orders.map(order =>
        order.id === orderId ? { ...order, invoiceStatus: newStatus } : order
      );
      setOrders(updatedOrders);
      
      showSuccess('Invoice status updated successfully');
      setStatusDialogOpen(false);
      setValidationDialogOpen(false);
      setEditingStatus(null);
      fetchOrders();
    } catch (error) {
      console.error('Error updating invoice status:', error);
      showError('Failed to update invoice status');
    }
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
    const profitData = calculateOrderProfit(order);
    
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
        : profitData.revenue * (allocation.percentage / 100);
      const cost = allocation.costs !== undefined 
        ? allocation.costs 
        : profitData.cost * (allocation.percentage / 100);
      const profit = allocation.profit !== undefined 
        ? allocation.profit 
        : revenue - cost;

      details += `${formatMonthKey(allocation.monthKey)}:\n`;
      details += `  Percentage: ${formatPercentage(allocation.percentage)}\n`;
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
        paymentData: normalizePaymentData(order.paymentData || {}),
        // Normalize furniture data structure if needed
        furnitureData: order.furnitureData || { groups: [] }
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

  // Format date
  const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
      const dateObj = toDateObject(date);
      return dateObj.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  };

  // Get status info
  const getStatusInfo = (status) => {
    return invoiceStatuses.find(s => s.value === status) || 
           { value: status, label: status, color: '#757575' };
  };

  // Get payment status
  const getPaymentStatus = (order) => {
    const total = calculateOrderTotal(order);
    const normalizedPayment = normalizePaymentData(order.paymentData);
    
    if (normalizedPayment.amountPaid >= total) return { status: 'Fully Paid', color: '#4caf50' };
    if (normalizedPayment.amountPaid >= normalizedPayment.deposit && normalizedPayment.deposit > 0) return { status: 'Deposit Paid', color: '#ff9800' };
    if (normalizedPayment.amountPaid > 0) return { status: 'Partial Payment', color: '#f44336' };
    return { status: 'Not Paid', color: '#757575' };
  };

  // Check if order spans multiple months
  const checkIfCrossMonth = (order, customStartDate = null, customEndDate = null) => {
    const startDate = customStartDate || toDateObject(order.createdAt);
    const endDate = customEndDate || new Date();
    
    const startMonth = startDate.getMonth();
    const startYear = startDate.getFullYear();
    const endMonth = endDate.getMonth();
    const endYear = endDate.getFullYear();
    
    return (startYear !== endYear) || (startMonth !== endMonth);
  };

  // Calculate allocation for an order
  const calculateAllocation = (order, startDate, endDate) => {
    console.log('Calculating allocation for order:', order.id, 'startDate:', startDate, 'endDate:', endDate);
    const profitData = calculateOrderProfit(order);
    console.log('Profit data:', profitData);
    const allocations = calculateTimeBasedAllocation({
      ...order,
      startDate,
      endDate,
      profitData
    });
    console.log('Time-based allocations:', allocations);
    
    return allocations.map(allocation => ({
      ...allocation,
      revenue: profitData.revenue * (allocation.percentage / 100),
      costs: profitData.cost * (allocation.percentage / 100),
      profit: profitData.profit * (allocation.percentage / 100)
    }));
  };

  // Handle allocation dialog
  const handleAllocationDialog = (order, newStatus) => {
    const orderStartDate = toDateObject(order.createdAt);
    const orderEndDate = new Date(); // Current date when status changes
    
    setSelectedOrderForAllocation({ ...order, newStatus });
    setStartDate(orderStartDate);
    setEndDate(orderEndDate);
    setAllocationMethod('time-based');
    
    const allocations = calculateAllocation(order, orderStartDate, orderEndDate);
    setManualAllocations(allocations);
    
    setAllocationDialogOpen(true);
  };

  // Apply allocation and update status
  const applyAllocation = async () => {
    try {
      if (!selectedOrderForAllocation) return;
      
      // Convert dates to Firestore Timestamps for consistent storage
      const { Timestamp } = await import('firebase/firestore');
      const firestoreNow = Timestamp.fromDate(new Date());
      const firestoreStartDate = startDate ? Timestamp.fromDate(startDate) : null;
      const firestoreEndDate = endDate ? Timestamp.fromDate(endDate) : null;
      
      const orderRef = doc(db, 'orders', selectedOrderForAllocation.id);
      
      // Update order with new dates and allocation
      const updateData = {
        invoiceStatus: selectedOrderForAllocation.newStatus.value,
        statusUpdatedAt: firestoreNow,
        allocation: {
          method: allocationMethod,
          allocations: manualAllocations,
          appliedAt: firestoreNow,
          startDate: firestoreStartDate,
          endDate: firestoreEndDate
        },
        // Update orderDetails dates to match allocation dates
        'orderDetails.startDate': firestoreStartDate,
        'orderDetails.endDate': firestoreEndDate,
        'orderDetails.lastUpdated': firestoreNow
      };
      
      await updateDoc(orderRef, updateData);
      
      // Update local state
      const updatedOrders = orders.map(order =>
        order.id === selectedOrderForAllocation.id 
          ? { ...order, ...updateData }
          : order
      );
      setOrders(updatedOrders);
      
      showSuccess('Order completed and allocation applied successfully');
      setAllocationDialogOpen(false);
      setSelectedOrderForAllocation(null);
      fetchOrders();
      
      // Show option to view P&L
      setTimeout(() => {
        if (window.confirm('Allocation applied successfully! Would you like to view the updated P&L Statement?')) {
          navigate('/admin/pl');
        }
      }, 1000);
    } catch (error) {
      console.error('Error applying allocation:', error);
      showError('Failed to apply allocation');
    }
  };

  // Enhanced payment update functions
  const handleMakeFullyPaid = async () => {
    try {
      const { order, newStatus, pendingAmount } = validationError;
      const orderRef = doc(db, 'orders', order.id);
      
      // Normalize existing payment data
      const normalizedPaymentData = normalizePaymentData(order.paymentData);
      
      // Calculate new total paid amount
      const newTotalPaid = normalizedPaymentData.amountPaid + pendingAmount;
      
      // Validate the new payment data
      const validation = validatePaymentData({
        ...normalizedPaymentData,
        amountPaid: newTotalPaid
      });
      
      if (!validation.isValid) {
        showError(`Payment validation failed: ${validation.errors.join(', ')}`);
        return;
      }
      
      // Prepare payment history entry
      const paymentEntry = {
        amount: pendingAmount,
        date: firestoreNow,
        type: 'Status Change - Full Payment',
        method: 'System Adjustment',
        description: `Auto-payment for status change to ${newStatus.label}`
      };
      
      // Update order with new payment data
      const updateData = {
        'paymentData.amountPaid': newTotalPaid,
        'paymentData.paymentHistory': [
          ...(normalizedPaymentData.paymentHistory),
          paymentEntry
        ]
      };
      
      await updateDoc(orderRef, updateData);
      
      // Now update the status directly
      const statusUpdateData = {
        invoiceStatus: newStatus.value,
        statusUpdatedAt: firestoreNow
      };
      
      await updateDoc(orderRef, statusUpdateData);
      
      showSuccess(`Payment updated and order status changed to "${newStatus.label}"`);
      setValidationDialogOpen(false);
      
      // Show allocation dialog after payment is handled
      console.log('Payment handled, now showing allocation dialog for order:', order.id);
      handleAllocationDialog(order, newStatus);
      
      fetchOrders();
    } catch (error) {
      console.error('Error updating payment:', error);
      showError('Failed to update payment');
    }
  };

  const handleSetPaymentToZero = async () => {
    try {
      const { order, newStatus, currentAmount } = validationError;
      const orderRef = doc(db, 'orders', order.id);
      
      // Normalize existing payment data
      const normalizedPaymentData = normalizePaymentData(order.paymentData);
      
      // Validate the new payment data
      const validation = validatePaymentData({
        ...normalizedPaymentData,
        amountPaid: 0
      });
      
      if (!validation.isValid) {
        showError(`Payment validation failed: ${validation.errors.join(', ')}`);
        return;
      }
      
      // Prepare payment history entry for refund
      const paymentEntry = {
        amount: -currentAmount, // Negative amount for refund
        date: firestoreNow,
        type: 'Status Change - Refund',
        method: 'System Adjustment',
        description: `Auto-refund for status change to ${newStatus.label}`
      };
      
      // Update order with zero payment
      const updateData = {
        'paymentData.amountPaid': 0,
        'paymentData.paymentHistory': [
          ...(normalizedPaymentData.paymentHistory),
          paymentEntry
        ]
      };
      
      await updateDoc(orderRef, updateData);
      
      // Now update the status directly
      const statusUpdateData = {
        invoiceStatus: newStatus.value,
        statusUpdatedAt: firestoreNow
      };
      
      await updateDoc(orderRef, statusUpdateData);
      
      showSuccess(`Payment reset to $0 and order status changed to "${newStatus.label}"`);
      setValidationDialogOpen(false);
      
      // Show allocation dialog after payment is handled (for cancelled orders too)
      console.log('Payment handled, now showing allocation dialog for cancelled order:', order.id);
      handleAllocationDialog(order, newStatus);
      
      fetchOrders();
    } catch (error) {
      console.error('Error updating payment:', error);
      showError('Failed to update payment');
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchInvoiceStatuses();
    fetchMaterialCompanyTaxRates().then(setMaterialTaxRates);
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <AccountBalanceIcon sx={{ fontSize: 32, color: '#b98f33', mr: 2 }} />
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
            Financial Management
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<SettingsIcon />}
            onClick={() => navigate('/admin/status-management')}
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
            Manage Statuses
          </Button>
          <Button
            variant="contained"
            startIcon={<TrendingUpIcon />}
            onClick={() => navigate('/admin/pl')}
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
            P&L Statement
          </Button>
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={() => {
              fetchOrders();
              fetchInvoiceStatuses();
            }}
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
            Refresh Data
          </Button>
        </Box>
      </Box>

      {/* Status Integration Info */}
      {invoiceStatuses.length === 0 && (
        <Alert 
          severity="info" 
          sx={{ mb: 3 }}
          action={
            <Button 
              size="small" 
              onClick={() => navigate('/admin/status-management')}
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
              Setup Statuses
            </Button>
          }
        >
          <strong>No custom statuses found.</strong> Create custom invoice statuses in Status Management for better workflow control.
        </Alert>
      )}

      {/* Financial Summary Cards - Compact Single Row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
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
                  {formatCurrency(financialSummary.totalRevenue)}
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
                  Total Costs
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 0.5, fontSize: '1.1rem', color: '#ffffff' }}>
                  {formatCurrency(financialSummary.totalCost)}
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
                  Total Profit
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 0.5, fontSize: '1.1rem', color: '#ffffff' }}>
                  {formatCurrency(financialSummary.totalProfit)}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.9, fontSize: '0.65rem', color: '#b98f33' }}>
                  {financialSummary.averageProfitMargin.toFixed(1)}% margin
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
                <MonetizationOnIcon sx={{ fontSize: 24, mb: 0.5, color: '#b98f33' }} />
                <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.75rem', color: '#b98f33' }}>
                  Paid Amount
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 0.5, fontSize: '1.1rem', color: '#ffffff' }}>
                  {formatCurrency(financialSummary.paidAmount)}
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
                <ReceiptIcon sx={{ fontSize: 24, mb: 0.5, color: '#b98f33' }} />
                <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.75rem', color: '#b98f33' }}>
                  Pending
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 0.5, fontSize: '1.1rem', color: '#ffffff' }}>
                  {formatCurrency(financialSummary.pendingAmount)}
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
                <ReceiptIcon sx={{ fontSize: 24, mb: 0.5, color: '#b98f33' }} />
                <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.75rem', color: '#b98f33' }}>
                  Total Orders
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 0.5, fontSize: '1.1rem', color: '#ffffff' }}>
                  {financialSummary.totalOrders}
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
                <MonetizationOnIcon sx={{ fontSize: 24, mb: 0.5, color: '#b98f33' }} />
                <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.75rem', color: '#b98f33' }}>
                  Avg Order
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 0.5, fontSize: '1.1rem', color: '#ffffff' }}>
                  {formatCurrency(financialSummary.totalOrders > 0 ? financialSummary.totalRevenue / financialSummary.totalOrders : 0)}
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
                  Collection %
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 0.5, fontSize: '1.1rem', color: '#ffffff' }}>
                  {financialSummary.totalRevenue > 0 ? 
                    ((financialSummary.paidAmount / financialSummary.totalRevenue) * 100).toFixed(1) : 0}%
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Extra Expenses Summary Card */}
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
                  Extra Expenses
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 0.5, fontSize: '1.1rem', color: '#ffffff' }}>
                  {formatCurrency(financialSummary.totalExtraExpenses)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Pickup & Delivery Summary Card */}
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
                <AssignmentIcon sx={{ fontSize: 24, mb: 0.5, color: '#b98f33' }} />
                <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.75rem', color: '#b98f33' }}>
                  Pickup & Delivery
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 0.5, fontSize: '1.1rem', color: '#ffffff' }}>
                  {formatCurrency(financialSummary.totalPickupDelivery)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Tax Summary Card */}
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
                  Tax Amount
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 0.5, fontSize: '1.1rem', color: '#ffffff' }}>
                  {formatCurrency(financialSummary.totalTax)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

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
                  onClick={handleClearYearMonthFilters}
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

      {/* Filters */}
      <Paper sx={{ p: 3, mb: 3, border: '1px solid #333333', backgroundColor: '#2a2a2a' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <FilterListIcon sx={{ color: '#b98f33', mr: 1 }} />
          <Typography variant="h6" sx={{ color: '#b98f33', fontWeight: 'bold' }}>
            Filters & Search
          </Typography>
        </Box>
        
        <Grid container spacing={3} alignItems="center">
          {/* Search Field */}
          <Grid item xs={12} lg={4}>
            <TextField
              fullWidth
              placeholder="Search by customer name, invoice number, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                )
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': { borderColor: '#b98f33' },
                  '&.Mui-focused fieldset': { borderColor: '#b98f33' }
                }
              }}
            />
          </Grid>

          {/* Date Range Filters */}
          <Grid item xs={12} sm={6} lg={2}>
            <TextField
              fullWidth
              label="From Date"
              type="date"
              value={dateFrom ? dateFrom.toISOString().split('T')[0] : ''}
              onChange={(e) => {
                if (e.target.value) {
                  const date = new Date(e.target.value);
                  date.setHours(0, 0, 0, 0); // Set to start of day
                  setDateFrom(date);
                } else {
                  setDateFrom(null);
                }
              }}
              InputLabelProps={{ shrink: true }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <DateRangeIcon sx={{ color: '#b98f33' }} />
                  </InputAdornment>
                )
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': { borderColor: '#b98f33' },
                  '&.Mui-focused fieldset': { borderColor: '#b98f33' }
                }
              }}
            />
          </Grid>

          <Grid item xs={12} sm={6} lg={2}>
            <TextField
              fullWidth
              label="To Date"
              type="date"
              value={dateTo ? dateTo.toISOString().split('T')[0] : ''}
              onChange={(e) => {
                if (e.target.value) {
                  const date = new Date(e.target.value);
                  date.setHours(0, 0, 0, 0); // Set to start of day
                  setDateTo(date);
                } else {
                  setDateTo(null);
                }
              }}
              InputLabelProps={{ shrink: true }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': { borderColor: '#b98f33' },
                  '&.Mui-focused fieldset': { borderColor: '#b98f33' }
                }
              }}
            />
          </Grid>

          {/* Date Filter Actions */}
          <Grid item xs={12} sm={6} lg={1}>
            <Box sx={{ display: 'flex', gap: 1, height: '100%', alignItems: 'center' }}>
              <Button
                size="small"
                variant="contained"
                onClick={handleApplyDateFilter}
                sx={{ 
                  fontSize: '0.75rem',
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
                Apply
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={handleClearDateFilter}
                sx={{ 
                  fontSize: '0.75rem',
                  borderColor: '#b98f33',
                  color: '#b98f33',
                  '&:hover': { 
                    borderColor: '#d4af5a',
                    color: '#d4af5a'
                  }
                }}
              >
                Clear
              </Button>
            </Box>
          </Grid>

          {/* Status Filter */}
          <Grid item xs={12} sm={6} lg={2.5}>
            <FormControl fullWidth>
              <InputLabel sx={{ color: '#b98f33' }}>Invoice Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Invoice Status"
                sx={{
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#b98f33' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#b98f33' }
                }}
              >
                <MenuItem value="all">
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        backgroundColor: '#757575',
                        mr: 2
                      }}
                    />
                    All Statuses
                  </Box>
                </MenuItem>
                {invoiceStatuses.map(status => (
                  <MenuItem key={status.value} value={status.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: status.color,
                          mr: 2
                        }}
                      />
                      {status.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Quick Date Filters & Results */}
          <Grid item xs={12} lg={1.5}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => {
                    const now = new Date();
                    setDateFrom(new Date(now.getFullYear(), now.getMonth(), 1));
                    setDateTo(new Date(now.getFullYear(), now.getMonth() + 1, 0));
                    setAppliedDateFrom(new Date(now.getFullYear(), now.getMonth(), 1));
                    setAppliedDateTo(new Date(now.getFullYear(), now.getMonth() + 1, 0));
                  }}
                  sx={{ 
                    fontSize: '0.75rem',
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
                  This Month
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => {
                    const now = new Date();
                    setDateFrom(new Date(now.getFullYear(), 0, 1));
                    setDateTo(new Date(now.getFullYear(), 11, 31));
                    setAppliedDateFrom(new Date(now.getFullYear(), 0, 1));
                    setAppliedDateTo(new Date(now.getFullYear(), 11, 31));
                  }}
                  sx={{ 
                    fontSize: '0.75rem',
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
                  This Year
                </Button>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                <strong>{filteredOrders.length}</strong> of <strong>{orders.length}</strong> orders
              </Typography>
            </Box>
          </Grid>
        </Grid>

        {/* Active Filters Display */}
        {(statusFilter !== 'all' || searchTerm || (appliedDateFrom && appliedDateTo)) && (
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #333333' }}>
            <Typography variant="body2" sx={{ mb: 1, color: '#b98f33', fontWeight: 'bold' }}>
              Active Filters:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {statusFilter !== 'all' && (
                <Chip
                  label={`Status: ${invoiceStatuses.find(s => s.value === statusFilter)?.label}`}
                  onDelete={() => setStatusFilter('all')}
                  color="primary"
                  size="small"
                />
              )}
              {searchTerm && (
                <Chip
                  label={`Search: "${searchTerm}"`}
                  onDelete={() => setSearchTerm('')}
                  color="primary"
                  size="small"
                />
              )}
              {appliedDateFrom && appliedDateTo && (
                <Chip
                  label={`Date: ${formatDateRange(appliedDateFrom, appliedDateTo)}`}
                  onDelete={() => {
                    const now = new Date();
                    setDateFrom(new Date(now.getFullYear(), now.getMonth(), 1));
                    setDateTo(new Date(now.getFullYear(), now.getMonth() + 1, 0));
                    setAppliedDateFrom(new Date(now.getFullYear(), now.getMonth(), 1));
                    setAppliedDateTo(new Date(now.getFullYear(), now.getMonth() + 1, 0));
                  }}
                  color="primary"
                  size="small"
                />
              )}
              <Button
                size="small"
                variant="contained"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  const now = new Date();
                  setDateFrom(new Date(now.getFullYear(), now.getMonth(), 1));
                  setDateTo(new Date(now.getFullYear(), now.getMonth() + 1, 0));
                  setAppliedDateFrom(new Date(now.getFullYear(), now.getMonth(), 1));
                  setAppliedDateTo(new Date(now.getFullYear(), now.getMonth() + 1, 0));
                }}
                sx={{ 
                  backgroundColor: '#b98f33',
                  color: '#000000',
                  border: '1px solid #8b6b1f',
                  boxShadow: '0 2px 4px rgba(185, 143, 51, 0.3)',
                  background: 'linear-gradient(135deg, #b98f33 0%, #d4af5a 100%)',
                  fontSize: '0.75rem',
                  '&:hover': { 
                    backgroundColor: '#d4af5a',
                    boxShadow: '0 4px 8px rgba(185, 143, 51, 0.4)'
                  }
                }}
              >
                Clear All
              </Button>
            </Box>
          </Box>
        )}
      </Paper>

      {/* Orders Table */}
      <TableContainer component={Paper} sx={{ boxShadow: 2, backgroundColor: '#2a2a2a' }}>
        <Table>
          <TableHead sx={{ backgroundColor: '#b98f33' }}>
            <TableRow>
              <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Customer</TableCell>
              <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Invoice #</TableCell>
              <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Start Date</TableCell>
              <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Allocation</TableCell>
              <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Revenue</TableCell>
              <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Cost</TableCell>
              <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Profit</TableCell>
              <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Profit %</TableCell>
              <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Paid</TableCell>
              <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Balance</TableCell>
              <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Payment Status</TableCell>
              <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Invoice Status</TableCell>
              <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Date</TableCell>
              <TableCell sx={{ color: '#000000', fontWeight: 'bold' }} align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredOrders.map((order) => {
              const profitData = calculateOrderProfit(order);
              const normalizedPayment = normalizePaymentData(order.paymentData);
              const partialAmounts = calculatePartialAmounts(order, profitData, normalizedPayment);
              const balance = partialAmounts.revenue - partialAmounts.paidAmount;
              const paymentStatus = getPaymentStatus(order);
              const statusInfo = getStatusInfo(order.invoiceStatus);
              
              // Check if order has allocation
              const hasAllocation = order.allocation && order.allocation.allocations && order.allocation.allocations.length > 0;
              
              // Get start date
              const startDate = order.orderDetails?.startDate || order.createdAt;
              
              return (
                <TableRow key={order.id} hover>
                  <TableCell>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                        {order.personalInfo?.customerName || 'N/A'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {order.personalInfo?.email || 'No email'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {order.personalInfo?.phone || 'No phone'}
                      </Typography>
                    </Box>
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                      {order.orderDetails?.billInvoice || 'N/A'}
                    </Typography>
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
                            <CheckCircleIcon sx={{ fontSize: 18, color: '#4caf50' }} />
                            <Typography variant="body2" sx={{ color: '#4caf50', fontWeight: 'bold' }}>
                              Yes
                            </Typography>
                          </>
                        ) : (
                          <>
                            <CancelIcon sx={{ fontSize: 18, color: '#757575' }} />
                            <Typography variant="body2" sx={{ color: '#757575' }}>
                              No
                            </Typography>
                          </>
                        )}
                      </Box>
                    </Tooltip>
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                      {formatCurrency(partialAmounts.revenue)}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                      {formatCurrency(partialAmounts.cost)}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Typography 
                      variant="subtitle1" 
                      sx={{ 
                        fontWeight: 'bold', 
                        color: partialAmounts.profit >= 0 ? '#4caf50' : '#f44336' 
                      }}
                    >
                      {formatCurrency(partialAmounts.profit)}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Typography 
                        variant="subtitle2" 
                        sx={{ 
                          fontWeight: 'bold', 
                          color: partialAmounts.profitPercentage >= 0 ? '#4caf50' : '#f44336',
                          mr: 1
                        }}
                      >
                        {partialAmounts.profitPercentage.toFixed(1)}%
                      </Typography>
                      <Box
                        sx={{
                          width: 40,
                          height: 8,
                          backgroundColor: '#e0e0e0',
                          borderRadius: 4,
                          overflow: 'hidden'
                        }}
                      >
                        <Box
                          sx={{
                            width: `${Math.min(Math.abs(partialAmounts.profitPercentage), 100)}%`,
                            height: '100%',
                            backgroundColor: partialAmounts.profitPercentage >= 0 ? '#4caf50' : '#f44336',
                            transition: 'width 0.3s ease'
                          }}
                        />
                      </Box>
                    </Box>
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                      {formatCurrency(partialAmounts.paidAmount)}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Typography 
                      variant="subtitle1" 
                      sx={{ 
                        fontWeight: 'bold', 
                        color: balance > 0 ? '#f44336' : '#4caf50' 
                      }}
                    >
                      {formatCurrency(balance)}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Chip
                      label={paymentStatus.status}
                      sx={{
                        backgroundColor: paymentStatus.color,
                        color: 'white',
                        fontWeight: 'bold'
                      }}
                    />
                  </TableCell>
                  
                  <TableCell>
                    <Chip
                      label={statusInfo.label}
                      sx={{
                        backgroundColor: statusInfo.color,
                        color: 'white',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        setSelectedOrder(order);
                        setEditingStatus(order.invoiceStatus);
                        setStatusDialogOpen(true);
                      }}
                    />
                  </TableCell>
                  
                  <TableCell>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Typography variant="body2" sx={{ color: '#4caf50', fontWeight: 'bold' }}>
                        {formatDateOnly(order.orderDetails?.startDate || order.createdAt)}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#b98f33', fontWeight: 'bold' }}>
                        {formatDateOnly(order.orderDetails?.endDate || order.statusUpdatedAt || order.createdAt)}
                      </Typography>
                    </Box>
                  </TableCell>
                  
                  <TableCell align="center">
                    <Tooltip title="View Order">
                      <IconButton 
                        size="small" 
                        onClick={() => navigate(`/admin/orders`, { state: { viewOrder: order } })}
                        sx={{ color: '#b98f33' }}
                      >
                        <ViewIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="View Invoice">
                      <IconButton 
                        size="small" 
                        onClick={() => handlePreviewInvoice(order)}
                        sx={{ color: '#b98f33' }}
                      >
                        <ViewIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Professional Status Dialog */}
      <Dialog 
        open={statusDialogOpen} 
        onClose={() => setStatusDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            zIndex: 1000
          }
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #b98f33 0%, #8b6b1f 100%)',
          color: '#000000',
          display: 'flex',
          alignItems: 'center',
          gap: 2
        }}>
          <AssignmentIcon />
          Update Invoice Status
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          {/* Current Status Display */}
          <Box sx={{ mb: 3, p: 2, backgroundColor: '#3a3a3a', borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ color: '#b98f33', mb: 1 }}>
              Current Status
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: getStatusInfo(editingStatus)?.color || '#607d8b'
                }}
              />
              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                {getStatusInfo(editingStatus)?.label || editingStatus || 'Unknown Status'}
              </Typography>
            </Box>
          </Box>

          {/* Status Dropdown */}
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Select New Status</InputLabel>
            <Select
              value={editingStatus || ''}
              onChange={(e) => setEditingStatus(e.target.value)}
              label="Select New Status"
            >
              {invoiceStatuses
                .sort((a, b) => (a.sortOrder || 1) - (b.sortOrder || 1))
                .map(status => (
                  <MenuItem key={status.value} value={status.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: status.color
                        }}
                      />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                          {status.label}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#666' }}>
                          {status.description || `Order is ${status.label.toLowerCase()}`}
                        </Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                ))}
            </Select>
          </FormControl>

          {/* Status Description */}
          {editingStatus && (
            <Box sx={{ p: 2, backgroundColor: '#3a3a3a', borderRadius: 1 }}>
              <Typography variant="body2" sx={{ color: '#b98f33' }}>
                <strong>Selected:</strong> {getStatusInfo(editingStatus)?.label || editingStatus}
              </Typography>
              <Typography variant="caption" sx={{ color: '#ffffff', display: 'block', mt: 1 }}>
                {getStatusInfo(editingStatus)?.description || 'Status will be updated for this order.'}
              </Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={() => setStatusDialogOpen(false)}
            variant="contained"
            size="small"
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
            onClick={() => updateInvoiceStatus(selectedOrder.id, editingStatus)}
            variant="contained"
            disabled={!editingStatus}
            size="small"
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
            Update Status
          </Button>
        </DialogActions>
      </Dialog>

      {/* Enhanced Validation Dialog */}
      <Dialog open={validationDialogOpen} onClose={() => setValidationDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Payment Validation Required</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 3 }}>
            {validationError.message}
          </Typography>
          
          {validationError.type === 'done' && (
            <Button 
              variant="contained" 
              onClick={handleMakeFullyPaid}
              fullWidth
              sx={{ 
                mb: 2,
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
              startIcon={<CheckCircleIcon />}
            >
              Make ${validationError.pendingAmount.toFixed(2)} as Paid
            </Button>
          )}
          
          {validationError.type === 'cancelled' && (
            <Button 
              variant="contained" 
              onClick={handleSetPaymentToZero}
              fullWidth
              sx={{ 
                mb: 2,
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
              startIcon={<CancelIcon />}
            >
              Set Payment Amount to $0.00
            </Button>
          )}
          
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            This action will update the payment history and automatically change the order status.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setValidationDialogOpen(false)}
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
        </DialogActions>
      </Dialog>

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
            Order Completion & Date Allocation
          </Box>
        </DialogTitle>
        
        <DialogContent>
          {selectedOrderForAllocation && (
            <Box sx={{ mt: 2 }}>
              {/* Order Summary */}
              <Paper sx={{ p: 2, mb: 3, backgroundColor: '#3a3a3a' }}>
                <Typography variant="h6" sx={{ mb: 2, color: '#b98f33' }}>
                  Order Summary
                </Typography>
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    <strong>Order Completion:</strong> Please review and adjust the order dates if needed. 
                    This information will be used for accurate P&L reporting and financial analysis.
                  </Typography>
                </Alert>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Order: {selectedOrderForAllocation.orderDetails?.billInvoice || selectedOrderForAllocation.id}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Customer: {selectedOrderForAllocation.personalInfo?.customerName}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Total Revenue: {formatCurrency(calculateOrderProfit(selectedOrderForAllocation).revenue)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Costs: {formatCurrency(calculateOrderProfit(selectedOrderForAllocation).cost)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Gross Profit: {formatCurrency(calculateOrderProfit(selectedOrderForAllocation).profit)}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>

              {/* Date Range */}
              <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Date Range
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Start Date"
                      type="date"
                      value={startDate ? startDate.toISOString().split('T')[0] : ''}
                      onChange={(e) => {
                        const newStartDate = new Date(e.target.value);
                        setStartDate(newStartDate);
                        if (endDate && newStartDate > endDate) {
                          setEndDate(newStartDate);
                        }
                        // Recalculate allocations
                        const allocations = calculateAllocation(selectedOrderForAllocation, newStartDate, endDate);
                        setManualAllocations(allocations);
                      }}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="End Date"
                      type="date"
                      value={endDate ? endDate.toISOString().split('T')[0] : ''}
                      onChange={(e) => {
                        const newEndDate = new Date(e.target.value);
                        // Validate end date
                        const today = new Date();
                        today.setHours(23, 59, 59, 999);
                        if (newEndDate > today) {
                          showError('End date cannot be in the future');
                          return;
                        }
                        if (startDate && newEndDate < startDate) {
                          showError('End date cannot be before start date');
                          return;
                        }
                        setEndDate(newEndDate);
                        // Recalculate allocations
                        const allocations = calculateAllocation(selectedOrderForAllocation, startDate, newEndDate);
                        setManualAllocations(allocations);
                      }}
                      InputLabelProps={{ shrink: true }}
                      inputProps={{ max: new Date().toISOString().split('T')[0] }}
                    />
                  </Grid>
                </Grid>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Duration: {startDate && endDate ? 
                    Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1 : 0} days
                </Typography>
              </Paper>

              {/* Allocation Method */}
              <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Allocation Method
                </Typography>
                <FormControl component="fieldset" fullWidth>
                  <RadioGroup
                    value={allocationMethod}
                    onChange={(e) => setAllocationMethod(e.target.value)}
                  >
                    <FormControlLabel 
                      value="time-based" 
                      control={<Radio />} 
                      label="Time-based allocation (recommended - proportional to days in each month)" 
                    />
                    <FormControlLabel 
                      value="manual" 
                      control={<Radio />} 
                      label="Manual allocation (for special cases - specify percentages)" 
                    />
                  </RadioGroup>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Time-based allocation is recommended for most orders. Use manual allocation only for special cases where the time-based calculation doesn't reflect the actual work distribution.
                  </Typography>
                </FormControl>
              </Paper>

              {/* Monthly Breakdown */}
              <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Monthly Breakdown
                </Typography>
                
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Month</TableCell>
                        <TableCell>Days</TableCell>
                        <TableCell>Percentage</TableCell>
                        <TableCell>Revenue</TableCell>
                        <TableCell>Costs</TableCell>
                        <TableCell>Profit</TableCell>
                        {allocationMethod === 'manual' && (
                          <TableCell>Manual %</TableCell>
                        )}
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
                          {allocationMethod === 'manual' && (
                            <TableCell>
                              <TextField
                                size="small"
                                type="number"
                                value={allocation.percentage}
                                onChange={(e) => {
                                  const newAllocations = [...manualAllocations];
                                  newAllocations[index].percentage = parseFloat(e.target.value) || 0;
                                  setManualAllocations(newAllocations);
                                }}
                                inputProps={{ min: 0, max: 100, step: 0.1 }}
                                sx={{ width: 80 }}
                              />
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                {allocationMethod === 'manual' && (
                  <Box sx={{ mt: 2, p: 2, backgroundColor: '#fff3cd', borderRadius: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Total Percentage: {formatPercentage(manualAllocations.reduce((sum, a) => sum + a.percentage, 0))}
                      {manualAllocations.reduce((sum, a) => sum + a.percentage, 0) !== 100 && (
                        <span style={{ color: '#d32f2f' }}> (Must equal 100%)</span>
                      )}
                    </Typography>
                  </Box>
                )}
              </Paper>
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
            disabled={allocationMethod === 'manual' && 
              manualAllocations.reduce((sum, a) => sum + a.percentage, 0) !== 100}
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
            Complete Order & Apply Allocation
          </Button>
        </DialogActions>
      </Dialog>

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
            <ReceiptIcon sx={{ color: '#000000', fontSize: 28 }} />
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
    </Box>
  );
};

export default FinancePage; 
