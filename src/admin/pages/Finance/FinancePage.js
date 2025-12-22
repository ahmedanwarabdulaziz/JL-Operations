import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
} from '@mui/material';
import {
  Search as SearchIcon,
  AccountBalance as AccountBalanceIcon,
  Receipt as ReceiptIcon,
  TrendingUp as TrendingUpIcon,
  MonetizationOn as MonetizationOnIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Assignment as AssignmentIcon,
  Edit as EditIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { collection, getDocs, query, orderBy, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../../shared/firebase/config';
import { useNotification } from '../../../shared/components/Common/NotificationSystem';
import { calculateOrderTotal, calculateJLCostAnalysisBeforeTax, calculateOrderProfit, normalizePaymentData } from '../../../shared/utils/orderCalculations';
import { formatCurrency, formatPercentage } from '../../../shared/utils/plCalculations';
import { formatDateOnly, toDateObject } from '../../../utils/dateUtils';
import { normalizeAllocation, createAllocation } from '../../../shared/utils/allocationUtils';
import { buttonStyles } from '../../../styles/buttonStyles';

const FinancePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [invoiceStatuses, setInvoiceStatuses] = useState([]);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [expenses, setExpenses] = useState({
    general: [],
    business: [],
    home: []
  });
  
  // Status dialog state
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState(null);
  const [selectedOrderForStatus, setSelectedOrderForStatus] = useState(null);
  
  // Allocation dialog state
  const [allocationDialogOpen, setAllocationDialogOpen] = useState(false);
  const [selectedOrderForAllocation, setSelectedOrderForAllocation] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [monthlyAllocations, setMonthlyAllocations] = useState([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [showAllocationTable, setShowAllocationTable] = useState(false);
  
  // Year/Month filter state - initialize from URL params
  const [selectedYear, setSelectedYear] = useState(() => {
    const yearParam = searchParams.get('year');
    return yearParam ? parseInt(yearParam, 10) : null;
  });
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const monthParam = searchParams.get('month');
    return monthParam ? parseInt(monthParam, 10) : null;
  });

  const { showError, showSuccess } = useNotification();

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedYear !== null) {
      params.set('year', selectedYear.toString());
    }
    if (selectedMonth !== null) {
      params.set('month', selectedMonth.toString());
    }
    setSearchParams(params, { replace: true });
  }, [selectedYear, selectedMonth, setSearchParams]);

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

  // Fetch orders from Firebase (regular and corporate orders, plus corporate taxed invoices, plus T-invoices from customer-invoices)
  const fetchOrders = async () => {
    try {
      setLoading(true);
      
      // Fetch from collections and expenses
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
      setFilteredOrders(allOrders);
      setExpenses({
        general: generalExpenses,
        business: businessExpenses,
        home: homeExpenses
      });
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

  // Generate months between dates
  const generateMonthsBetweenDates = (startDate, endDate) => {
    if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return [];
    }
    
    const months = [];
    // Normalize to first day of each month to avoid day-of-month issues
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth(); // 0-indexed
    const endYear = endDate.getFullYear();
    const endMonth = endDate.getMonth(); // 0-indexed
    
    let currentYear = startYear;
    let currentMonth = startMonth;
    
    // Compare using year/month only, not day
    while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
      // Use 1-indexed months (1-12) to match new allocation format
      const month = currentMonth + 1; // Convert from 0-indexed to 1-indexed
      const year = currentYear;
      
      const dateForLabel = new Date(year, currentMonth, 1);
      months.push({
        month: month, // 1-indexed (1-12)
        year: year,
        label: dateForLabel.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        percentage: months.length === 0 ? 100 : 0 // Default 100% to first month
      });
      
      // Move to next month
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
    }
    
    return months;
  };

  // Generate 5-month allocation table (fallback)
  const generateMonthlyAllocations = (order) => {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    const months = [];
    for (let i = -2; i <= 2; i++) {
      const monthIndex = (currentMonth + i + 12) % 12;
      const year = currentYear + Math.floor((currentMonth + i) / 12);
      const month = monthIndex + 1;
      
      months.push({
        month: month,
        year: year,
        label: new Date(year, monthIndex).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        percentage: i === 0 ? 100 : 0
      });
    }
    
    return months;
  };

  // Handle allocation dialog open
  const handleAllocationDialog = (order) => {
    setSelectedOrderForAllocation(order);
    setAllocationDialogOpen(true);
    setShowAllocationTable(false);
    
    // Helper function to normalize date to local date-only (avoid timezone issues)
    const normalizeToLocalDate = (dateValue) => {
      if (!dateValue) return null;
      
      let date;
      if (dateValue.toDate) {
        // Firestore Timestamp
        date = dateValue.toDate();
      } else if (dateValue instanceof Date) {
        date = dateValue;
      } else {
        date = new Date(dateValue);
      }
      
      if (isNaN(date.getTime())) return null;
      
      // Normalize to local date only (ignore time component to avoid timezone shifts)
      return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    };
    
    // Set default dates with proper validation
    const start = normalizeToLocalDate(order.orderDetails?.startDate);
    const end = normalizeToLocalDate(order.orderDetails?.endDate);
    
    if (start && !isNaN(start.getTime())) {
      setStartDate(start);
    } else {
      setStartDate(new Date());
    }
    
    if (end && !isNaN(end.getTime())) {
      setEndDate(end);
    } else {
      setEndDate(new Date());
    }

    // Check if order already has allocation data
    if (order.allocation && order.allocation.allocations) {
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                          'July', 'August', 'September', 'October', 'November', 'December'];
      
      // Normalize allocation to ensure month/year are correct
      const profitData = calculateOrderProfit(order);
      const normalizedAllocation = normalizeAllocation(order.allocation, profitData);
      
      if (normalizedAllocation && normalizedAllocation.allocations) {
        setMonthlyAllocations(normalizedAllocation.allocations.map(allocation => {
          const month = Number(allocation.month);
          const year = Number(allocation.year);
          
          // Validate month is in valid range (1-12)
          if (isNaN(month) || month < 1 || month > 12) {
            console.warn('Invalid month in allocation:', allocation);
            return null;
          }
          
          // Use month names array directly to avoid timezone issues with Date objects
          const monthIndex = month - 1; // Convert 1-indexed to 0-indexed for array
          const label = `${monthNames[monthIndex]} ${year}`;
          
          return {
            month: month,
            year: year,
            label: label,
            percentage: allocation.percentage
          };
        }).filter(alloc => alloc !== null));
        setShowAllocationTable(true);
      } else {
        const initialAllocations = generateMonthlyAllocations(order);
        setMonthlyAllocations(initialAllocations);
      }
    } else {
      const initialAllocations = generateMonthlyAllocations(order);
      setMonthlyAllocations(initialAllocations);
    }

    const normalizedOrder = normalizeOrderForCalculations(order);
    const profitData = calculateOrderProfit(normalizedOrder);
    setTotalRevenue(profitData.revenue);
    setTotalCost(calculateJLCostAnalysisBeforeTax(normalizedOrder));
  };

  // Handle save dates
  const handleSaveDates = async () => {
    if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      showError('Please select valid start and end dates');
      return;
    }

    if (!selectedOrderForAllocation) {
      showError('No order selected for allocation');
      return;
    }

    const newAllocations = generateMonthsBetweenDates(startDate, endDate);
    
    if (newAllocations.length === 0) {
      showError('No valid months found between the selected dates');
      return;
    }

    try {
      // Determine collection name
      let collectionName;
      if (selectedOrderForAllocation.source === 'taxedInvoices') {
        collectionName = 'taxedInvoices';
      } else if (selectedOrderForAllocation.orderType === 'corporate') {
        collectionName = 'corporate-orders';
      } else {
        collectionName = 'orders';
      }

      const orderRef = doc(db, collectionName, selectedOrderForAllocation.id);
      await updateDoc(orderRef, {
        'orderDetails.startDate': startDate,
        'orderDetails.endDate': endDate,
        'orderDetails.lastUpdated': new Date()
      });

      setSelectedOrderForAllocation(prev => ({
        ...prev,
        orderDetails: {
          ...prev.orderDetails,
          startDate: startDate,
          endDate: endDate,
          lastUpdated: new Date()
        }
      }));

      setMonthlyAllocations(newAllocations);
      setShowAllocationTable(true);
      showSuccess('Dates saved! Table updated with relevant months.');
    } catch (error) {
      console.error('Error saving dates:', error);
      showError('Failed to save dates to database');
    }
  };

  // Calculate totals
  const calculateAllocationTotals = (allocations) => {
    const totalPercentage = allocations.reduce((sum, item) => sum + (parseFloat(item.percentage) || 0), 0);
    const calculatedRevenue = allocations.reduce((sum, item) => sum + (totalRevenue * (parseFloat(item.percentage) || 0) / 100), 0);
    const calculatedCost = allocations.reduce((sum, item) => sum + (totalCost * (parseFloat(item.percentage) || 0) / 100), 0);
    const calculatedProfit = calculatedRevenue - calculatedCost;
    
    return { totalPercentage, totalRevenue: calculatedRevenue, totalCost: calculatedCost, totalProfit: calculatedProfit };
  };

  // Get allocation status
  const getAllocationStatus = () => {
    const totals = calculateAllocationTotals(monthlyAllocations);
    const remainingPercentage = 100 - totals.totalPercentage;
    
    if (Math.abs(remainingPercentage) <= 0.01) {
      return { status: 'valid', message: 'Allocation is complete and ready to apply', color: '#4caf50' };
    } else if (totals.totalPercentage > 100) {
      return { status: 'over', message: `Total exceeds 100% by ${Math.abs(remainingPercentage).toFixed(1)}%`, color: '#f44336' };
    } else {
      return { status: 'under', message: `${Math.abs(remainingPercentage).toFixed(1)}% remaining to reach 100%`, color: '#ff9800' };
    }
  };

  // Update allocation percentage
  const updateAllocationPercentage = (index, percentage) => {
    const newAllocations = [...monthlyAllocations];
    newAllocations[index] = {
      ...newAllocations[index],
      percentage: parseFloat(percentage) || 0
    };
    setMonthlyAllocations(newAllocations);
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

      const profitData = {
        revenue: totalRevenue,
        cost: totalCost,
        profit: totalRevenue - totalCost
      };

      const allocationData = createAllocation(monthlyAllocations, profitData);

      // Determine collection name
      let collectionName;
      if (selectedOrderForAllocation.source === 'taxedInvoices') {
        collectionName = 'taxedInvoices';
      } else if (selectedOrderForAllocation.orderType === 'corporate') {
        collectionName = 'corporate-orders';
      } else {
        collectionName = 'orders';
      }

      const orderRef = doc(db, collectionName, selectedOrderForAllocation.id);
      await updateDoc(orderRef, {
        allocation: allocationData
      });
      
      // Update local state
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === selectedOrderForAllocation.id 
            ? { ...order, allocation: allocationData }
            : order
        )
      );
      
      setFilteredOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === selectedOrderForAllocation.id 
            ? { ...order, allocation: allocationData }
            : order
        )
      );
      
      showSuccess('Allocation applied successfully');
      setAllocationDialogOpen(false);
      setSelectedOrderForAllocation(null);
      setMonthlyAllocations([]);
      setShowAllocationTable(false);
      fetchOrders();
    } catch (error) {
      console.error('Error applying allocation:', error);
      showError('Failed to apply allocation');
    }
  };

  // Update invoice status (adapted from Workshop page)
  const updateInvoiceStatus = async (orderId, newStatus) => {
    try {
      setUpdatingStatus(orderId);
      
      // Find the order and new status
      const order = orders.find(o => o.id === orderId);
      const newStatusObj = invoiceStatuses.find(s => s.value === newStatus);
      
      if (!order || !newStatusObj) {
        showError('Order or status not found');
        return;
      }

      // Determine which collection to update based on order type and source
      let collectionName;
      if (order.source === 'taxedInvoices') {
        collectionName = 'taxedInvoices';
      } else if (order.orderType === 'corporate') {
        collectionName = 'corporate-orders';
      } else {
        collectionName = 'orders';
      }
      
      const orderRef = doc(db, collectionName, orderId);
      await updateDoc(orderRef, {
        invoiceStatus: newStatus,
        statusUpdatedAt: new Date()
      });
      
      // Update local state
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId 
            ? { ...order, invoiceStatus: newStatus, statusUpdatedAt: new Date() }
            : order
        )
      );
      
      // Update filtered orders as well
      setFilteredOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId 
            ? { ...order, invoiceStatus: newStatus, statusUpdatedAt: new Date() }
            : order
        )
      );
      
      showSuccess('Invoice status updated successfully');
      setStatusDialogOpen(false);
      setEditingStatus(null);
      setSelectedOrderForStatus(null);
    } catch (error) {
      console.error('Error updating invoice status:', error);
      showError('Failed to update invoice status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  // Normalize order structure for calculations (handles both regular and corporate orders)
  const normalizeOrderForCalculations = (order) => {
    // T-invoices (customer-invoices) - use revenue from calculations.total, costs from attached order data
    if (order.isTInvoice) {
      return {
        ...order,
        // Keep calculations.total for revenue calculation
        // Keep furnitureData/furnitureGroups and extraExpenses from original order for cost calculation
        furnitureData: order.furnitureData || { groups: [] },
        paymentData: {
          amountPaid: order.paidAmount || 0,
          ...order.paymentData
        }
      };
    }
    
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
    
    // Handle payment data for both regular and corporate orders, and T-invoices
    let orderPaidAmount = 0;
    if (order.isTInvoice) {
      orderPaidAmount = order.paidAmount || order.calculations?.paidAmount || 0;
    } else if (order.orderType === 'corporate') {
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
        const invoiceNumber = order.invoiceNumber || order.orderDetails?.billInvoice || '';
        const invoiceMatch = invoiceNumber.toLowerCase().includes(searchLower);
        
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

  // Calculate totals for filtered orders
  const calculateTotals = () => {
    let totalRevenue = 0;
    let totalCost = 0;
    let totalProfit = 0;
    let totalPaid = 0;
    let totalBalance = 0;

    filteredOrders.forEach(order => {
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
      
      totalRevenue += partialAmounts.revenue || 0;
      totalCost += partialAmounts.cost || 0;
      totalProfit += partialAmounts.profit || 0;
      totalPaid += partialAmounts.paidAmount || 0;
      totalBalance += partialAmounts.balance || 0;
    });

    return {
      revenue: totalRevenue,
      cost: totalCost,
      profit: totalProfit,
      paid: totalPaid,
      balance: totalBalance
    };
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
    // General expenses come from 'generalExpenses' collection
    if (expenses && expenses.general && Array.isArray(expenses.general)) {
      expenses.general.forEach(expense => {
        try {
          // Prioritize 'date' field (user-set) over 'createdAt'
          const expenseDate = expense.date || expense.createdAt;
          if (!expenseDate) {
            console.warn('General expense missing date:', expense.id);
            return;
          }
          
          const expenseYear = getYearFromDate(expenseDate);
          if (expenseYear === currentYear) {
            // Use total field directly (should already be calculated)
            const expenseTotal = parseFloat(expense.total || 0);
            generalExpensesTotal += expenseTotal;
          }
        } catch (error) {
          console.error('Error processing general expense:', error, expense);
        }
      });
    }
    
    // Calculate business expenses for current year
    // Business expenses come from 'businessExpenses' collection where type !== 'home'
    if (expenses && expenses.business && Array.isArray(expenses.business)) {
      expenses.business.forEach(expense => {
        try {
          // Prioritize 'date' field (user-set) over 'createdAt'
          const expenseDate = expense.date || expense.createdAt;
          if (!expenseDate) {
            console.warn('Business expense missing date:', expense.id);
            return;
          }
          
          const expenseYear = getYearFromDate(expenseDate);
          if (expenseYear === currentYear) {
            // Use total field directly (should already be calculated)
            const expenseTotal = parseFloat(expense.total || 0);
            businessExpensesTotal += expenseTotal;
          }
        } catch (error) {
          console.error('Error processing business expense:', error, expense);
        }
      });
    }
    
    // Calculate home expenses for current year
    // Home expenses come from 'businessExpenses' collection where type === 'home'
    if (expenses && expenses.home && Array.isArray(expenses.home)) {
      expenses.home.forEach(expense => {
        try {
          // Prioritize 'date' field (user-set) over 'createdAt'
          const expenseDate = expense.date || expense.createdAt;
          if (!expenseDate) {
            console.warn('Home expense missing date:', expense.id);
            return;
          }
          
          const expenseYear = getYearFromDate(expenseDate);
          if (expenseYear === currentYear) {
            // Use total field directly (should already be calculated)
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
      // General expenses come from 'generalExpenses' collection, filtered by selected month/year
      if (expenses && expenses.general && Array.isArray(expenses.general)) {
        expenses.general.forEach(expense => {
          try {
            // Prioritize 'date' field (user-set) over 'createdAt'
            const expenseDate = expense.date || expense.createdAt;
            if (!expenseDate) {
              console.warn('General expense missing date:', expense.id);
              return;
            }
            
            const dateInfo = getYearMonthFromDate(expenseDate);
            if (dateInfo && dateInfo.year === year && dateInfo.month === month) {
              // Use total field directly (should already be calculated)
              const expenseTotal = parseFloat(expense.total || 0);
              generalExpensesTotal += expenseTotal;
            }
          } catch (error) {
            console.error('Error processing general expense:', error, expense);
          }
        });
      }
      
      // Calculate business expenses for this month
      // Business expenses come from 'businessExpenses' collection where type !== 'home', filtered by selected month/year
      if (expenses && expenses.business && Array.isArray(expenses.business)) {
        expenses.business.forEach(expense => {
          try {
            // Prioritize 'date' field (user-set) over 'createdAt'
            const expenseDate = expense.date || expense.createdAt;
            if (!expenseDate) {
              console.warn('Business expense missing date:', expense.id);
              return;
            }
            
            const dateInfo = getYearMonthFromDate(expenseDate);
            if (dateInfo && dateInfo.year === year && dateInfo.month === month) {
              // Use total field directly (should already be calculated)
              const expenseTotal = parseFloat(expense.total || 0);
              businessExpensesTotal += expenseTotal;
            }
          } catch (error) {
            console.error('Error processing business expense:', error, expense);
          }
        });
      }
      
      // Calculate home expenses for this month
      // Home expenses come from 'businessExpenses' collection where type === 'home', filtered by selected month/year
      if (expenses && expenses.home && Array.isArray(expenses.home)) {
        expenses.home.forEach(expense => {
          try {
            // Prioritize 'date' field (user-set) over 'createdAt'
            const expenseDate = expense.date || expense.createdAt;
            if (!expenseDate) {
              console.warn('Home expense missing date:', expense.id);
              return;
            }
            
            const dateInfo = getYearMonthFromDate(expenseDate);
            if (dateInfo && dateInfo.year === year && dateInfo.month === month) {
              // Use total field directly (should already be calculated)
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const monthlySummaries = calculateMonthlySummaries();
  const currentYearSummary = calculateCurrentYearSummary();

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3, color: '#b98f33', fontWeight: 'bold' }}>
        Finance Overview
      </Typography>

      {/* Current Year Summary Card and Monthly Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Current Year Summary Card */}
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
            ].map(({ key, data, label }) => {
              const isSelected = selectedYear === data.year && selectedMonth === data.month;
              return (
                <Grid item xs={12} sm={4} key={key}>
                  <Card 
                    onClick={() => {
                      setSelectedYear(data.year);
                      setSelectedMonth(data.month);
                    }}
                    sx={{ 
                      backgroundColor: isSelected ? '#3a3a3a' : '#2a2a2a', 
                      border: isSelected ? '2px solid #b98f33' : '1px solid #333333', 
                      height: '100%',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        backgroundColor: isSelected ? '#4a4a4a' : '#333333',
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
              );
            })}
          </Grid>
        </Grid>

        {/* Year/Month Filter */}
        <Grid item xs={12} md={4}>
          {(() => {
            const { years, monthsByYear } = getAvailableYearsAndMonths();
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            
            return (
              <Paper sx={{ p: 2, height: '100%', backgroundColor: '#2a2a2a', border: '1px solid #333333' }}>
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
                      sx={buttonStyles.cancelButton}
                    >
                      Clear Filter
                    </Button>
                  </Box>
                )}
              </Paper>
            );
          })()}
        </Grid>
      </Grid>

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
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ cursor: 'help', fontWeight: 'bold' }}>
                              {order.invoiceNumber || order.orderDetails?.billInvoice || 'N/A'}
                            </Box>
                            {order.isTInvoice && order.originalOrderId && (
                              <Tooltip title={`View original order: ${order.originalOrderNumber || order.originalOrderId}`} arrow>
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/admin/orders/${order.originalOrderId}`);
                                  }}
                                  sx={{
                                    color: '#b98f33',
                                    '&:hover': {
                                      backgroundColor: 'rgba(185, 143, 51, 0.1)',
                                      color: '#d4af5a',
                                    },
                                  }}
                                >
                                  <LinkIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ color: '#ffffff' }}>
                        {startDate ? formatDateOnly(startDate) : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={statusInfo.label}
                          size="small"
                          onClick={() => {
                            setSelectedOrderForStatus(order);
                            setEditingStatus(order.invoiceStatus);
                            setStatusDialogOpen(true);
                          }}
                          sx={{
                            backgroundColor: statusInfo.color,
                            color: '#ffffff',
                            fontWeight: 'bold',
                            fontSize: '0.75rem',
                            height: '24px',
                            cursor: 'pointer',
                            '& .MuiChip-label': {
                              px: 1,
                            },
                            '&:hover': {
                              opacity: 0.8,
                              transform: 'scale(1.05)',
                            },
                          }}
                        />
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
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
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
                            <Box>
                              {hasAllocation ? (
                                <CheckCircleIcon sx={{ color: '#4caf50', fontSize: 20 }} />
                              ) : (
                                <CancelIcon sx={{ color: '#f44336', fontSize: 20 }} />
                              )}
                            </Box>
                          </Tooltip>
                          <Tooltip title="Edit Allocation" arrow>
                            <IconButton
                              size="small"
                              onClick={() => handleAllocationDialog(order)}
                              sx={{
                                color: '#b98f33',
                                '&:hover': {
                                  backgroundColor: 'rgba(185, 143, 51, 0.1)',
                                  color: '#d4af5a',
                                },
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
              
              {/* Totals Row */}
              {filteredOrders.length > 0 && (() => {
                const totals = calculateTotals();
                return (
                  <TableRow sx={{ 
                    backgroundColor: '#1a1a1a',
                    borderTop: '2px solid #b98f33',
                    '& .MuiTableCell-root': {
                      borderTop: '2px solid #b98f33',
                    }
                  }}>
                    <TableCell colSpan={3} sx={{ color: '#b98f33', fontWeight: 'bold', fontSize: '1rem' }}>
                      TOTALS
                    </TableCell>
                    <TableCell sx={{ color: '#ffffff', fontWeight: 'bold', fontSize: '1rem' }}>
                      {formatCurrency(totals.revenue)}
                    </TableCell>
                    <TableCell sx={{ color: '#ffffff', fontWeight: 'bold', fontSize: '1rem' }}>
                      {formatCurrency(totals.cost)}
                    </TableCell>
                    <TableCell sx={{ 
                      color: totals.profit >= 0 ? '#4caf50' : '#f44336', 
                      fontWeight: 'bold',
                      fontSize: '1rem'
                    }}>
                      {formatCurrency(totals.profit)}
                    </TableCell>
                    <TableCell sx={{ color: '#ffffff', fontWeight: 'bold', fontSize: '1rem' }}>
                      {formatCurrency(totals.paid)}
                    </TableCell>
                    <TableCell sx={{ 
                      color: totals.balance > 0 ? '#f44336' : '#4caf50', 
                      fontWeight: 'bold',
                      fontSize: '1rem'
                    }}>
                      {formatCurrency(totals.balance)}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                );
              })()}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Status Dialog */}
      <Dialog 
        open={statusDialogOpen} 
        onClose={() => {
          setStatusDialogOpen(false);
          setEditingStatus(null);
          setSelectedOrderForStatus(null);
        }} 
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
          gap: 2,
          fontWeight: 'bold'
        }}>
          <AssignmentIcon />
          Update Invoice Status
        </DialogTitle>

        <DialogContent sx={{ p: 3, backgroundColor: '#3a3a3a' }}>
          {/* Current Status Display */}
          {selectedOrderForStatus && (
            <Box sx={{ mb: 3, p: 2, backgroundColor: '#2a2a2a', borderRadius: 1, border: '1px solid #333333' }}>
              <Typography variant="subtitle2" sx={{ color: '#b98f33', mb: 1, fontWeight: 'bold' }}>
                Invoice: {selectedOrderForStatus.invoiceNumber || selectedOrderForStatus.orderDetails?.billInvoice || 'N/A'}
              </Typography>
              <Typography variant="subtitle2" sx={{ color: '#b98f33', mb: 1, fontWeight: 'bold' }}>
                Current Status
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    backgroundColor: getStatusInfo(selectedOrderForStatus.invoiceStatus)?.color || '#607d8b'
                  }}
                />
                <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#ffffff' }}>
                  {getStatusInfo(selectedOrderForStatus.invoiceStatus)?.label || selectedOrderForStatus.invoiceStatus || 'Unknown Status'}
                </Typography>
              </Box>
            </Box>
          )}

          {/* Status Dropdown */}
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel sx={{ color: '#b98f33' }}>Select New Status</InputLabel>
            <Select
              value={editingStatus || ''}
              onChange={(e) => setEditingStatus(e.target.value)}
              label="Select New Status"
              sx={{
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#333333',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#b98f33',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#b98f33',
                },
                '& .MuiSelect-icon': {
                  color: '#b98f33',
                },
                '& .MuiInputBase-input': {
                  color: '#ffffff',
                },
              }}
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
                        <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#ffffff' }}>
                          {status.label}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#b98f33' }}>
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
            <Box sx={{ p: 2, backgroundColor: '#2a2a2a', borderRadius: 1, border: '1px solid #333333' }}>
              <Typography variant="body2" sx={{ color: '#b98f33', fontWeight: 'bold' }}>
                <strong>Selected:</strong> {getStatusInfo(editingStatus)?.label || editingStatus}
              </Typography>
              <Typography variant="caption" sx={{ color: '#ffffff', display: 'block', mt: 1 }}>
                {getStatusInfo(editingStatus)?.description || 'Status will be updated for this order.'}
              </Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, gap: 1, backgroundColor: '#3a3a3a' }}>
          <Button 
            onClick={() => {
              setStatusDialogOpen(false);
              setEditingStatus(null);
              setSelectedOrderForStatus(null);
            }}
            variant="outlined"
            size="small"
            sx={buttonStyles.cancelButton}
          >
            Cancel
          </Button>
          <Button 
            onClick={() => {
              if (selectedOrderForStatus && editingStatus) {
                updateInvoiceStatus(selectedOrderForStatus.id, editingStatus);
              }
            }}
            variant="contained"
            disabled={!editingStatus || updatingStatus === selectedOrderForStatus?.id}
            size="small"
            sx={{
              backgroundColor: '#b98f33',
              color: '#000000',
              border: '2px solid #8b6b1f',
              boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
              background: 'linear-gradient(135deg, #b98f33 0%, #d4af5a 100%)',
              '&:hover': {
                backgroundColor: '#d4af5a',
                transform: 'translateY(-1px)',
                boxShadow: '0 6px 12px rgba(0,0,0,0.4)',
              },
              '&:disabled': {
                backgroundColor: '#666666',
                color: '#999999',
                border: '2px solid #444444',
              },
            }}
          >
            {updatingStatus === selectedOrderForStatus?.id ? 'Updating...' : 'Update Status'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Allocation Dialog */}
      <Dialog 
        open={allocationDialogOpen} 
        onClose={() => {
          setAllocationDialogOpen(false);
          setSelectedOrderForAllocation(null);
          setMonthlyAllocations([]);
          setShowAllocationTable(false);
        }} 
        maxWidth="lg" 
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
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: 2
        }}>
          <AssignmentIcon />
          Financial Allocation
        </DialogTitle>
        
        <DialogContent sx={{ backgroundColor: '#3a3a3a', p: 3 }}>
          {/* Order Summary */}
          {selectedOrderForAllocation && (
            <Box sx={{ mb: 3, p: 2, backgroundColor: '#2a2a2a', borderRadius: 1, border: '1px solid #333333' }}>
              <Typography variant="h6" sx={{ mb: 1, color: '#b98f33', fontWeight: 'bold' }}>Order Summary</Typography>
              <Typography variant="body2" sx={{ color: '#ffffff', mb: 0.5 }}>
                <strong>Invoice #:</strong> {selectedOrderForAllocation.invoiceNumber || selectedOrderForAllocation.orderDetails?.billInvoice || 'N/A'}
              </Typography>
              <Typography variant="body2" sx={{ color: '#ffffff', mb: 0.5 }}>
                <strong>Total Revenue:</strong> {formatCurrency(totalRevenue)}
              </Typography>
              <Typography variant="body2" sx={{ color: '#ffffff', mb: 0.5 }}>
                <strong>Total Cost:</strong> {formatCurrency(totalCost)}
              </Typography>
              <Typography variant="body2" sx={{ color: '#ffffff' }}>
                <strong>Total Profit:</strong> {formatCurrency(totalRevenue - totalCost)}
              </Typography>
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
                  value={startDate && startDate instanceof Date && !isNaN(startDate) 
                    ? `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}` 
                    : ''}
                  onChange={(e) => {
                    const dateValue = e.target.value;
                    if (dateValue) {
                      // Parse as local date to avoid timezone issues
                      const [year, month, day] = dateValue.split('-').map(Number);
                      const date = new Date(year, month - 1, day);
                      if (!isNaN(date.getTime())) {
                        setStartDate(date);
                      }
                    }
                  }}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
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
                    '& .MuiInputLabel-root': {
                      color: '#b98f33',
                    },
                  }}
                />
              </Grid>
              <Grid item xs={5}>
                <TextField
                  label="End Date"
                  type="date"
                  value={endDate && endDate instanceof Date && !isNaN(endDate) 
                    ? `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}` 
                    : ''}
                  onChange={(e) => {
                    const dateValue = e.target.value;
                    if (dateValue) {
                      // Parse as local date to avoid timezone issues
                      const [year, month, day] = dateValue.split('-').map(Number);
                      const date = new Date(year, month - 1, day);
                      if (!isNaN(date.getTime())) {
                        setEndDate(date);
                      }
                    }
                  }}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
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
                    '& .MuiInputLabel-root': {
                      color: '#b98f33',
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
                    backgroundColor: '#b98f33',
                    color: '#000000',
                    '&:hover': { 
                      backgroundColor: '#d4af5a',
                    }
                  }}
                >
                  Save Dates
                </Button>
              </Grid>
            </Grid>
            <Typography variant="body2" sx={{ mt: 1, color: '#b98f33', fontStyle: 'italic' }}>
              Click "Save Dates" to update the allocation table with months between your selected dates
            </Typography>
          </Box>

          {/* Financial Allocation Table */}
          {showAllocationTable && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, color: '#b98f33', fontWeight: 'bold' }}>Monthly Financial Allocation</Typography>
              <Typography variant="body2" sx={{ mb: 2, color: '#ffffff' }}>
                Distribute the order's revenue and costs across the months between your selected dates. Total percentage must equal 100%.
              </Typography>
            
              <TableContainer component={Paper} sx={{ maxHeight: 400, backgroundColor: '#2a2a2a' }}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', color: '#b98f33', backgroundColor: '#1a1a1a' }}>Month</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#b98f33', backgroundColor: '#1a1a1a' }}>Percentage (%)</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#b98f33', backgroundColor: '#1a1a1a' }}>Revenue ($)</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#b98f33', backgroundColor: '#1a1a1a' }}>Cost ($)</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#b98f33', backgroundColor: '#1a1a1a' }}>Profit ($)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {monthlyAllocations.map((allocation, index) => {
                      const revenue = (totalRevenue * allocation.percentage / 100);
                      const cost = (totalCost * allocation.percentage / 100);
                      const profit = revenue - cost;
                      
                      return (
                        <TableRow key={index} sx={{ '&:hover': { backgroundColor: '#333333' } }}>
                          <TableCell sx={{ color: '#ffffff' }}>{allocation.label}</TableCell>
                          <TableCell>
                            <TextField
                              type="number"
                              value={allocation.percentage}
                              onChange={(e) => updateAllocationPercentage(index, e.target.value)}
                              size="small"
                              sx={{ width: 80 }}
                              inputProps={{ 
                                min: 0, 
                                max: 100, 
                                step: 0.1 
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ fontWeight: 'bold', color: '#4caf50' }}>
                            {formatCurrency(revenue)}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 'bold', color: '#f44336' }}>
                            {formatCurrency(cost)}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 'bold', color: profit >= 0 ? '#4caf50' : '#f44336' }}>
                            {formatCurrency(profit)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {/* Totals Row */}
                    <TableRow sx={{ backgroundColor: '#1a1a1a', borderTop: '2px solid #b98f33' }}>
                      <TableCell sx={{ fontWeight: 'bold', color: '#b98f33' }}>TOTAL</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#ffffff' }}>
                        {calculateAllocationTotals(monthlyAllocations).totalPercentage.toFixed(1)}%
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#4caf50' }}>
                        {formatCurrency(calculateAllocationTotals(monthlyAllocations).totalRevenue)}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#f44336' }}>
                        {formatCurrency(calculateAllocationTotals(monthlyAllocations).totalCost)}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#4caf50' }}>
                        {formatCurrency(calculateAllocationTotals(monthlyAllocations).totalProfit)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
              
              {/* Allocation Status */}
              {showAllocationTable && (
                <Box sx={{ mt: 2 }}>
                  {(() => {
                    const status = getAllocationStatus();
                    return (
                      <Alert 
                        severity={status.status === 'valid' ? 'success' : status.status === 'over' ? 'error' : 'warning'} 
                        sx={{ 
                          backgroundColor: status.status === 'valid' ? '#1b5e20' : status.status === 'over' ? '#b71c1c' : '#e65100',
                          color: '#ffffff',
                          '& .MuiAlert-message': { 
                            color: '#ffffff',
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
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, gap: 1, backgroundColor: '#3a3a3a' }}>
          <Button 
            onClick={() => {
              setAllocationDialogOpen(false);
              setSelectedOrderForAllocation(null);
              setMonthlyAllocations([]);
              setShowAllocationTable(false);
            }}
            variant="outlined"
            size="small"
            sx={buttonStyles.cancelButton}
          >
            Cancel
          </Button>
          <Button 
            onClick={applyAllocation}
            variant="contained"
            disabled={!showAllocationTable || Math.abs(calculateAllocationTotals(monthlyAllocations).totalPercentage - 100) > 0.01}
            size="small"
            sx={{
              backgroundColor: '#b98f33',
              color: '#000000',
              border: '2px solid #8b6b1f',
              boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
              background: 'linear-gradient(135deg, #b98f33 0%, #d4af5a 100%)',
              '&:hover': {
                backgroundColor: '#d4af5a',
                transform: 'translateY(-1px)',
                boxShadow: '0 6px 12px rgba(0,0,0,0.4)',
              },
              '&:disabled': {
                backgroundColor: '#666666',
                color: '#999999',
                border: '2px solid #444444',
              },
            }}
          >
            Apply Allocation
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FinancePage;

