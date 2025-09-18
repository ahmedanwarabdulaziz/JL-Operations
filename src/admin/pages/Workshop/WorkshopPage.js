import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  InputAdornment,
  Avatar,
  Tooltip,
  Switch,
  FormControlLabel,
  Radio,
  RadioGroup,
  FormLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox
} from '@mui/material';
import { Grid } from '@mui/material';

import {
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
  Chair as ChairIcon,
  LocalShipping as ShippingIcon,
  Edit as EditIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  CalendarToday as CalendarIcon,
  Save as SaveIcon,
  Send as SendIcon,
  Google as GoogleIcon,
  Check as CheckIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { useNotification } from '../shared/components/Common/NotificationSystem';
import { sendEmailWithConfig, sendDepositEmailWithConfig, sendCompletionEmailWithGmail, ensureGmailAuthorized } from '../shared/services/emailService';

import useMaterialCompanies from '../shared/hooks/useMaterialCompanies';
import { usePlatforms } from '../shared/hooks/usePlatforms';
import { useTreatments } from '../shared/hooks/useTreatments';
import { collection, getDocs, updateDoc, doc, query, orderBy, where } from 'firebase/firestore';
import { db } from '../shared/firebase/config';
import { calculateOrderTotal, calculateOrderCost, calculateOrderProfit, calculateOrderTax, calculatePickupDeliveryCost, normalizePaymentData, validatePaymentData, getOrderCostBreakdown } from '../shared/utils/orderCalculations';
import { fetchMaterialCompanyTaxRates } from '../shared/utils/materialTaxRates';
import { calculateTimeBasedAllocation, formatCurrency, formatPercentage } from '../shared/utils/plCalculations';
import { formatDate, formatDateOnly, formatDateRange } from '../../../utils/dateUtils';
import { useAutoSelect } from '../shared/hooks/useAutoSelect';

const WorkshopPage = () => {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editPersonalDialog, setEditPersonalDialog] = useState(false);
  const [editOrderDialog, setEditOrderDialog] = useState(false);
  const [editPersonalData, setEditPersonalData] = useState({});
  const [editOrderData, setEditOrderData] = useState({});
  const [editPaymentDialog, setEditPaymentDialog] = useState(false);
  const [editPaymentData, setEditPaymentData] = useState({});
  const [editFurnitureDialog, setEditFurnitureDialog] = useState(false);
  const [editFurnitureData, setEditFurnitureData] = useState({});
  const [editingFurnitureData, setEditingFurnitureData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [processingDeposit, setProcessingDeposit] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    paymentAmount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentNotes: ''
  });
  
  // State for collapsible sections
  const [personalInfoExpanded, setPersonalInfoExpanded] = useState(false);
  const [orderDetailsExpanded, setOrderDetailsExpanded] = useState(false);
  
  // State for status functionality
  const [invoiceStatuses, setInvoiceStatuses] = useState([]);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState(null);
  
  // Enhanced validation dialog state (from Finance page)
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [validationError, setValidationError] = useState({ 
    type: '', 
    message: '', 
    order: null, 
    newStatus: null,
    pendingAmount: 0,
    currentAmount: 0
  });
  
  // Enhanced allocation popup state
  const [allocationDialogOpen, setAllocationDialogOpen] = useState(false);
  const [allocationDialogHidden, setAllocationDialogHidden] = useState(false);
  const [selectedOrderForAllocation, setSelectedOrderForAllocation] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [monthlyAllocations, setMonthlyAllocations] = useState([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [showAllocationTable, setShowAllocationTable] = useState(false);
  
  // Email completion state variables
  const [includeReviewRequest, setIncludeReviewRequest] = useState(true);
  const [sendingCompletionEmail, setSendingCompletionEmail] = useState(false);

  // Enhanced confirmation dialog with email options
  const [enhancedConfirmDialog, setEnhancedConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    hasEmail: false,
    defaultIncludeReview: true,
    resolve: null
  });

  const showEnhancedConfirm = (title, message, hasEmail, defaultIncludeReview) => {
    return new Promise((resolve) => {
      setEnhancedConfirmDialog({
        open: true,
        title,
        message,
        hasEmail,
        defaultIncludeReview,
        resolve
      });
    });
  };

  const handleEnhancedConfirm = (sendEmail, includeReview) => {
    if (enhancedConfirmDialog.resolve) {
      enhancedConfirmDialog.resolve({ 
        confirmed: true, 
        sendEmail, 
        includeReviewRequest: includeReview 
      });
    }
    setEnhancedConfirmDialog({
      open: false,
      title: '',
      message: '',
      hasEmail: false,
      defaultIncludeReview: true,
      resolve: null
    });
  };

  const handleEnhancedCancel = () => {
    if (enhancedConfirmDialog.resolve) {
      enhancedConfirmDialog.resolve({ 
        confirmed: false, 
        sendEmail: false, 
        includeReviewRequest: false 
      });
    }
    setEnhancedConfirmDialog({
      open: false,
      title: '',
      message: '',
      hasEmail: false,
      defaultIncludeReview: true,
      resolve: null
    });
  };

  // State for enhanced confirmation dialog checkboxes
  const [sendEmailChecked, setSendEmailChecked] = useState(true);
  const [includeReviewChecked, setIncludeReviewChecked] = useState(true);
  
  const { showError, showSuccess, showConfirm, confirmDialogOpen } = useNotification();

  const { companies: materialCompanies, loading: companiesLoading } = useMaterialCompanies();
  const { platforms, loading: platformsLoading } = usePlatforms();
  const { treatments, loading: treatmentsLoading } = useTreatments();
  const { onFocus: handleAutoSelect } = useAutoSelect();
  const [materialTaxRates, setMaterialTaxRates] = useState({});

  // Fetch invoice statuses
  const fetchInvoiceStatuses = async () => {
    try {
      const statusesRef = collection(db, 'invoiceStatuses');
      const statusesSnapshot = await getDocs(statusesRef);
      const statusesData = statusesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setInvoiceStatuses(statusesData);
    } catch (error) {
      console.error('Error fetching invoice statuses:', error);
      // Fallback to default statuses if fetch fails
      setInvoiceStatuses([
        { value: 'in_progress', label: 'In Progress', color: '#1976d2' },
        { value: 'pending_payment', label: 'Pending Payment', color: '#f57c00' },
        { value: 'completed', label: 'Completed', color: '#388e3c' },
        { value: 'cancelled', label: 'Cancelled', color: '#d32f2f' }
      ]);
    }
  };

  // Get status info
  const getStatusInfo = (status) => {
    return invoiceStatuses.find(s => s.value === status) || 
           { value: status, label: status, color: '#757575' };
  };

  // Enhanced validation and allocation functions (from Finance page)
  const checkIfCrossMonth = (order, customStartDate = null, customEndDate = null) => {
    const start = customStartDate || order.orderDetails?.startDate?.toDate?.() || new Date(order.orderDetails?.startDate);
    const end = customEndDate || order.orderDetails?.endDate?.toDate?.() || new Date(order.orderDetails?.endDate);
    
    if (!start || !end) return false;
    
    const startMonth = start.getMonth();
    const startYear = start.getFullYear();
    const endMonth = end.getMonth();
    const endYear = end.getFullYear();
    
    return startMonth !== endMonth || startYear !== endYear;
  };

  const calculateAllocation = (order, startDate, endDate) => {
    const start = startDate.toDate ? startDate.toDate() : new Date(startDate);
    const end = endDate.toDate ? endDate.toDate() : new Date(endDate);
    
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const startMonth = start.getMonth();
    const startYear = start.getFullYear();
    const endMonth = end.getMonth();
    const endYear = end.getFullYear();
    
    if (startMonth === endMonth && startYear === endYear) {
      return [{ month: startMonth, year: startYear, percentage: 100 }];
    }
    
    const allocations = [];
    let currentDate = new Date(start);
    
    while (currentDate <= end) {
      const month = currentDate.getMonth();
      const year = currentDate.getFullYear();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const daysInOrder = Math.min(
        daysInMonth - currentDate.getDate() + 1,
        end.getDate() - currentDate.getDate() + 1
      );
      
      const percentage = (daysInOrder / totalDays) * 100;
      allocations.push({ month, year, percentage });
      
      currentDate = new Date(year, month + 1, 1);
    }
    
    return allocations;
  };

  // Generate months between start and end dates
  const generateMonthsBetweenDates = (startDate, endDate) => {
    if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return [];
    }
    
    const months = [];
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    
    while (current <= end) {
      months.push({
        month: current.getMonth(),
        year: current.getFullYear(),
        label: current.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        percentage: months.length === 0 ? 100 : 0 // Default 100% to first month
      });
      
      current.setMonth(current.getMonth() + 1);
    }
    
    return months;
  };

  // Generate 5-month allocation table (current ± 2 months) - fallback
  const generateMonthlyAllocations = (order) => {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    const months = [];
    for (let i = -2; i <= 2; i++) {
      const month = (currentMonth + i + 12) % 12;
      const year = currentYear + Math.floor((currentMonth + i) / 12);
      months.push({
        month,
        year,
        label: new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        percentage: i === 0 ? 100 : 0 // Default 100% to current month
      });
    }
    
    return months;
  };

  // Calculate financial breakdown for each month
  const calculateFinancialBreakdown = (allocations, revenue, cost) => {
    return allocations.map(allocation => ({
      ...allocation,
      revenue: (revenue * allocation.percentage / 100),
      cost: (cost * allocation.percentage / 100),
      profit: (revenue * allocation.percentage / 100) - (cost * allocation.percentage / 100)
    }));
  };

  // Update allocation percentage
  const updateAllocationPercentage = (index, percentage) => {
    const newAllocations = [...monthlyAllocations];
    const newPercentage = parseFloat(percentage) || 0;
    newAllocations[index].percentage = newPercentage;
    newAllocations[index].lastUpdated = new Date();
    setMonthlyAllocations(newAllocations);
    
    // Calculate and show totals
    const totals = calculateTotals(newAllocations);
    const remainingPercentage = 100 - totals.totalPercentage;
    
    // Show warning if total is not 100%
    if (Math.abs(remainingPercentage) > 0.01) {
      console.log(`Allocation updated. Total: ${totals.totalPercentage.toFixed(1)}%, Remaining: ${remainingPercentage.toFixed(1)}%`);
    }
  };

  // Save dates and update table
  const handleSaveDates = async () => {
    if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      showError('Please enter valid start and end dates');
      return;
    }

    if (startDate > endDate) {
      showError('Start date cannot be after end date');
      return;
    }

    if (!selectedOrderForAllocation) {
      showError('No order selected for allocation');
      return;
    }

    // Generate new allocations based on date range
    const newAllocations = generateMonthsBetweenDates(startDate, endDate);
    
    if (newAllocations.length === 0) {
      showError('No valid months found between the selected dates');
      return;
    }

    try {
      // Update order dates in database
      const orderRef = doc(db, 'orders', selectedOrderForAllocation.id);
      await updateDoc(orderRef, {
        'orderDetails.startDate': startDate,
        'orderDetails.endDate': endDate,
        'orderDetails.lastUpdated': new Date()
      });

      // Update local state
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
  const calculateTotals = (allocations) => {
    const totalPercentage = allocations.reduce((sum, item) => sum + item.percentage, 0);
    const calculatedRevenue = allocations.reduce((sum, item) => sum + (totalRevenue * item.percentage / 100), 0);
    const calculatedCost = allocations.reduce((sum, item) => sum + (totalCost * item.percentage / 100), 0);
    const calculatedProfit = calculatedRevenue - calculatedCost;
    
    return { totalPercentage, totalRevenue: calculatedRevenue, totalCost: calculatedCost, totalProfit: calculatedProfit };
  };

  // Get allocation status for display
  const getAllocationStatus = () => {
    const totals = calculateTotals(monthlyAllocations);
    const remainingPercentage = 100 - totals.totalPercentage;
    
    if (Math.abs(remainingPercentage) <= 0.01) {
      return { status: 'valid', message: 'Allocation is complete and ready to apply', color: '#4caf50' };
    } else if (totals.totalPercentage > 100) {
      return { status: 'over', message: `Total exceeds 100% by ${Math.abs(remainingPercentage).toFixed(1)}%`, color: '#f44336' };
    } else {
      return { status: 'under', message: `${Math.abs(remainingPercentage).toFixed(1)}% remaining to reach 100%`, color: '#ff9800' };
    }
  };

  const handleAllocationDialog = (order, newStatus) => {
    setSelectedOrderForAllocation({ ...order, newStatus });
    setAllocationDialogOpen(true);
    setShowAllocationTable(false);
    
    // Set default dates with proper validation
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

    // Generate initial allocations
    const initialAllocations = generateMonthlyAllocations(order);
    const profitData = calculateOrderProfit(order);
    const revenue = profitData.revenue;
    const cost = profitData.cost;
    
    setTotalRevenue(revenue);
    setTotalCost(cost);
    setMonthlyAllocations(initialAllocations);
  };

  const applyAllocation = async () => {
    try {
      if (!selectedOrderForAllocation) return;
      
      // Validate total percentage equals 100%
      const totals = calculateTotals(monthlyAllocations);
      if (Math.abs(totals.totalPercentage - 100) > 0.01) {
        showError('Total percentage must equal 100%');
        return;
      }

      // Convert dates to Firestore Timestamps for consistent storage
      const { Timestamp } = await import('firebase/firestore');
      const firestoreStartDate = startDate ? Timestamp.fromDate(startDate) : null;
      const firestoreEndDate = endDate ? Timestamp.fromDate(endDate) : null;
      const firestoreNow = Timestamp.fromDate(new Date());

      // Prepare allocation data with detailed information
      const allocationData = {
        method: 'manual',
        allocations: monthlyAllocations.map(allocation => {
          const revenue = (totalRevenue * allocation.percentage / 100);
          const cost = (totalCost * allocation.percentage / 100);
          const profit = revenue - cost;
          
          return {
            month: allocation.month,
            year: allocation.year,
            percentage: allocation.percentage,
            revenue: revenue,
            cost: cost,
            profit: profit,
            monthKey: `${allocation.year}-${String(allocation.month).padStart(2, '0')}`,
            calculatedAt: firestoreNow
          };
        }),
        appliedAt: firestoreNow,
        originalRevenue: totalRevenue,
        originalCost: totalCost,
        originalProfit: totalRevenue - totalCost,
        dateRange: {
          startDate: firestoreStartDate,
          endDate: firestoreEndDate
        },
        recalculatedAt: firestoreNow
      };

      // Prepare update data
      const updateData = {
        invoiceStatus: selectedOrderForAllocation.newStatus?.value || 'done',
        allocation: allocationData
      };

      // Always update dates if they exist (even if they haven't changed)
      if (startDate && endDate) {
        updateData.orderDetails = {
          ...selectedOrderForAllocation.orderDetails,
          startDate: firestoreStartDate,
          endDate: firestoreEndDate,
          lastUpdated: firestoreNow
        };
      }

      // Force hide allocation dialog and show confirmation
      setAllocationDialogHidden(true);
      setAllocationDialogOpen(false); // Also close it completely
      
      // Longer delay to ensure dialog is completely hidden before showing confirmation
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Show enhanced confirmation dialog with email options
      const allocationSummary = monthlyAllocations.map(allocation => 
        `${allocation.month}/${allocation.year}: ${allocation.percentage.toFixed(1)}%`
      ).join(', ');

      // Check if customer has email
      const customerEmail = selectedOrderForAllocation.personalInfo?.email;
      const hasEmail = customerEmail && customerEmail.trim() !== '';

      const confirmed = await showEnhancedConfirm(
        'Confirm Order Completion & Email',
        '', // Empty message since we display order/customer info directly in dialog
        hasEmail,
        includeReviewRequest
      );

      if (!confirmed.confirmed) {
        // Reopen allocation dialog if user cancels
        setAllocationDialogHidden(false);
        setAllocationDialogOpen(true);
        return; // User cancelled
      }
      
      const orderRef = doc(db, 'orders', selectedOrderForAllocation.id);
      await updateDoc(orderRef, updateData);
      
      // Send completion email if customer has email and user confirmed
      console.log('🔍 Admin Workshop Debug - Email sending conditions:', {
        hasCustomerEmail: !!customerEmail,
        customerEmail: customerEmail,
        confirmedSendEmail: confirmed.sendEmail,
        confirmedIncludeReview: confirmed.includeReviewRequest
      });
      
      if (customerEmail && confirmed.sendEmail) {
        try {
          setSendingCompletionEmail(true);
          
          // Prepare order data for email
          const orderDataForEmail = {
            personalInfo: selectedOrderForAllocation.personalInfo,
            orderDetails: selectedOrderForAllocation.orderDetails,
            furnitureData: {
              groups: selectedOrderForAllocation.furnitureData?.groups || []
            },
            paymentData: selectedOrderForAllocation.paymentData
          };

          console.log('🔍 Admin Workshop Debug - Order data prepared for email:', {
            hasPersonalInfo: !!orderDataForEmail.personalInfo,
            hasOrderDetails: !!orderDataForEmail.orderDetails,
            hasFurnitureData: !!orderDataForEmail.furnitureData,
            furnitureGroupsCount: orderDataForEmail.furnitureData?.groups?.length || 0
          });

          // Progress callback for email sending
          const onEmailProgress = (message) => {
            console.log('🔍 Admin Workshop Debug - Email progress:', message);
            showSuccess(`📧 ${message}`);
          };

          console.log('🔍 Admin Workshop Debug - Calling sendCompletionEmailWithGmail...');
          
          // Send the completion email
          const emailResult = await sendCompletionEmailWithGmail(
            orderDataForEmail, 
            customerEmail, 
            confirmed.includeReviewRequest, 
            onEmailProgress
          );
          
          console.log('🔍 Admin Workshop Debug - Email result:', emailResult);
          
          if (emailResult.success) {
            showSuccess('✅ Completion email sent successfully!');
          } else {
            showError(`❌ Failed to send completion email: ${emailResult.message}`);
          }
        } catch (error) {
          console.error('🔍 Admin Workshop Debug - Error sending completion email:', error);
          showError(`Failed to send completion email: ${error.message}`);
        } finally {
          setSendingCompletionEmail(false);
        }
      } else {
        console.log('🔍 Admin Workshop Debug - Email not sent because:', {
          noCustomerEmail: !customerEmail,
          userDidNotConfirm: !confirmed.sendEmail
        });
      }
      
      showSuccess('Order completed and allocated successfully');
      setAllocationDialogOpen(false);
      setAllocationDialogHidden(false);
      setSelectedOrderForAllocation(null);
      fetchOrders();
    } catch (error) {
      console.error('Error applying allocation:', error);
      showError('Failed to apply allocation');
      setAllocationDialogHidden(false);
    }
  };

  const handleMakeFullyPaid = async () => {
    try {
      if (!validationError.order) return;
      
      const orderRef = doc(db, 'orders', validationError.order.id);
      const totalAmount = calculateOrderProfit(validationError.order).revenue;
      
      await updateDoc(orderRef, {
        'paymentData.amountPaid': totalAmount,
        'paymentData.paymentHistory': [
          ...(validationError.order.paymentData?.paymentHistory || []),
          {
            amount: validationError.pendingAmount,
            date: new Date(),
            notes: 'Auto-paid to complete order'
          }
        ]
      });
      
      // Show allocation dialog for completed order
      handleAllocationDialog(validationError.order, validationError.newStatus);
      setValidationDialogOpen(false);
    } catch (error) {
      console.error('Error making fully paid:', error);
      showError('Failed to update payment');
    }
  };

  const handleSetPaymentToZero = async () => {
    try {
      if (!validationError.order) return;
      
      const orderRef = doc(db, 'orders', validationError.order.id);
      
      await updateDoc(orderRef, {
        'paymentData.amountPaid': 0,
        'paymentData.paymentHistory': [
          ...(validationError.order.paymentData?.paymentHistory || []),
          {
            amount: -validationError.currentAmount,
            date: new Date(),
            notes: 'Refunded to cancel order'
          }
        ]
      });
      
      // Update status directly for cancelled orders
      await updateInvoiceStatus(validationError.order.id, validationError.newStatus?.value);
      setValidationDialogOpen(false);
    } catch (error) {
      console.error('Error setting payment to zero:', error);
      showError('Failed to update payment');
    }
  };



  // Update invoice status with validation (enhanced from Finance page)
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
      
      // Update selected order if it's the one being updated
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, invoiceStatus: newStatus });
      }
      
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

  // Fetch orders from Firebase with debouncing
  const fetchOrders = useCallback(async (forceRefresh = false) => {
          // Prevent excessive calls during email sending
      if (!forceRefresh && (sendingEmail || processingDeposit)) {
        return;
      }

    try {
      setLoading(true);
      
      const ordersRef = collection(db, 'orders');
      const ordersQuery = query(ordersRef, orderBy('orderDetails.billInvoice', 'desc'));
      const ordersSnapshot = await getDocs(ordersQuery);
      const ordersData = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Get invoice statuses to identify end states
      const statusesRef = collection(db, 'invoiceStatuses');
      const statusesSnapshot = await getDocs(statusesRef);
      const statusesData = statusesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Filter out orders with end state statuses
      const endStateStatuses = statusesData.filter(status => 
        status.isEndState
      );
      const endStateValues = endStateStatuses.map(status => status.value);

      const activeOrders = ordersData.filter(order => 
        !endStateValues.includes(order.invoiceStatus)
      );
      
      // Sort by bill number (highest to lowest)
      const sortedOrders = activeOrders.sort((a, b) => {
        const billA = parseInt(a.orderDetails?.billInvoice || '0', 10);
        const billB = parseInt(b.orderDetails?.billInvoice || '0', 10);
        return billB - billA;
      });
      
      setOrders(sortedOrders);
      setFilteredOrders(sortedOrders);
      
      // Select first order by default if available
      if (sortedOrders.length > 0 && !selectedOrder) {
        setSelectedOrder(sortedOrders[0]);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      showError(`Failed to fetch orders: ${error.message}`);
      setOrders([]);
      setFilteredOrders([]);
    } finally {
      setLoading(false);
    }
  }, [showError, sendingEmail, processingDeposit, selectedOrder]);

  useEffect(() => {
    fetchOrders();
    fetchInvoiceStatuses();
    fetchMaterialCompanyTaxRates().then(setMaterialTaxRates);
  }, [fetchOrders]);

  // Add a refresh mechanism when the page gains focus with improved debouncing
  useEffect(() => {
    let focusTimeout;
    let lastRefreshTime = 0;
    
    const handleFocus = () => {
      // Skip refresh if email operations are in progress
      if (sendingEmail || processingDeposit) {
        return;
      }
      
      const now = Date.now();
      // Prevent multiple refreshes within 2 seconds
      if (now - lastRefreshTime < 2000) {
        return;
      }
      
      // Debounce the focus event to prevent excessive calls
      clearTimeout(focusTimeout);
      focusTimeout = setTimeout(() => {
        lastRefreshTime = Date.now();
        fetchOrders(true); // Force refresh on focus
      }, 1000); // 1 second debounce
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      clearTimeout(focusTimeout);
    };
  }, [fetchOrders, sendingEmail, processingDeposit]);

  // Search function
  const handleSearch = (searchValue) => {
    setSearchTerm(searchValue);
    
    if (!searchValue.trim()) {
      setFilteredOrders([...orders]);
      return;
    }

    const searchLower = searchValue.toLowerCase();
    const filtered = orders.filter(order => {
      // Search in bill number
      if (order.orderDetails?.billInvoice?.toLowerCase().includes(searchLower)) {
        return true;
      }

      // Search in personal info
      const personalInfo = order.personalInfo || {};
      if (
        personalInfo.customerName?.toLowerCase().includes(searchLower) ||
        personalInfo.email?.toLowerCase().includes(searchLower) ||
        personalInfo.phone?.toLowerCase().includes(searchLower)
      ) {
        return true;
      }

      // Search in furniture data
      const furnitureData = order.furnitureData || {};
      if (furnitureData.groups) {
        return furnitureData.groups.some(group => 
          group.furnitureType?.toLowerCase().includes(searchLower) ||
          group.materialCompany?.toLowerCase().includes(searchLower) ||
          group.materialCode?.toLowerCase().includes(searchLower)
        );
      }

      return false;
    });

    setFilteredOrders(filtered);
  };

  // Using shared calculateOrderTotal utility for consistency

  // Use consistent calculation functions from orderCalculations
  const calculateInvoiceTotals = (order) => {
    // Calculate individual components properly
    const taxAmount = calculateOrderTax(order);
    const pickupDeliveryCost = order.paymentData?.pickupDeliveryEnabled ? 
      calculatePickupDeliveryCost(
        parseFloat(order.paymentData.pickupDeliveryCost) || 0,
        order.paymentData.pickupDeliveryServiceType || 'both'
      ) : 0;
    
    // Use the existing breakdown function to get accurate totals
    const breakdown = getOrderCostBreakdown(order);
    let itemsSubtotal = breakdown.material + breakdown.labour + breakdown.foam + breakdown.painting;
    
    // Extra expenses should NOT be added to customer-facing items subtotal
    // They are only included in Internal JL Cost Analysis
    
    // Calculate grand total
    const grandTotal = itemsSubtotal + taxAmount + pickupDeliveryCost;
    
    const amountPaid = parseFloat(order.paymentData?.amountPaid) || 0;
    const balanceDue = grandTotal - amountPaid;
    const cost = calculateOrderCost(order, materialTaxRates); // Includes tax with dynamic tax rates

    return {
      itemsSubtotal, // Now correctly shows only materials + labour + foam + painting
      taxAmount, // 13% on materials and foam only
      pickupDeliveryCost, // Separate line item (1x for pickup/delivery, 2x for both)
      grandTotal, // itemsSubtotal + taxAmount + pickupDeliveryCost
      amountPaid,
      balanceDue,
      jlGrandTotal: cost,
      extraExpensesTotal: 0, // Will be calculated separately if needed
      jlSubtotalBeforeTax: cost - taxAmount,
    };
  };

  // Get status color
  const getStatusColor = (order) => {
    const requiredDeposit = parseFloat(order.paymentData?.deposit) || 0;
    const amountPaid = parseFloat(order.paymentData?.amountPaid) || 0;
    
    // If deposit is received or amount paid >= required deposit, show green
    if (order.paymentData?.depositReceived || (amountPaid >= requiredDeposit && requiredDeposit > 0)) {
      return 'success';
    }
    // If some payment made but not enough, show orange
    if (amountPaid > 0) {
      return 'warning';
    }
    // No payment made, show red
    return 'error';
  };

  // Get status text
  const getStatusText = (order) => {
    const requiredDeposit = parseFloat(order.paymentData?.deposit) || 0;
    const amountPaid = parseFloat(order.paymentData?.amountPaid) || 0;
    const depositReceived = order.paymentData?.depositReceived;
    
    // Match the same logic as getStatusColor
    if (depositReceived || (amountPaid >= requiredDeposit && requiredDeposit > 0)) {
      return 'Deposit Received';
    }
    if (amountPaid > 0) {
      return 'Partial';
    }
    return 'Not Paid';
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return 'N/A';
    
    try {
      let dateObj;
      
      if (date && typeof date === 'object' && date.toDate) {
        dateObj = date.toDate();
      } else {
        dateObj = new Date(date);
      }
      
      if (isNaN(dateObj.getTime())) {
        return 'Invalid Date';
      }
      
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error, 'Date value:', date);
      return 'Invalid Date';
    }
  };

  // Calculate deposit status based on amount paid vs required deposit
  const getDepositStatus = (order) => {
    if (!order) return { isReceived: false, status: 'No deposit set' };
    
    const requiredDeposit = parseFloat(order.paymentData?.deposit) || 0;
    const amountPaid = parseFloat(order.paymentData?.amountPaid) || 0;
    
    if (requiredDeposit <= 0) {
      return { isReceived: false, status: 'No deposit required' };
    }
    
    if (amountPaid >= requiredDeposit) {
      return { isReceived: true, status: '✓ Deposit Received' };
    }
    
    if (amountPaid > 0) {
      return { isReceived: false, status: `Partial payment: $${amountPaid.toFixed(2)}` };
    }
    
    return { isReceived: false, status: 'No deposit paid' };
  };

  // Handle edit personal information
  const handleEditPersonal = () => {
    setEditPersonalData({
      customerName: selectedOrder.personalInfo?.customerName || '',
      email: selectedOrder.personalInfo?.email || '',
      phone: selectedOrder.personalInfo?.phone || '',
      address: selectedOrder.personalInfo?.address || ''
    });
    setEditPersonalDialog(true);
  };

  // Handle edit order details
  const handleEditOrder = () => {
    setEditOrderData({
      description: selectedOrder.orderDetails?.description || '',
      platform: selectedOrder.orderDetails?.platform || '',
      startDate: selectedOrder.orderDetails?.startDate || '',
      timeline: selectedOrder.orderDetails?.timeline || ''
    });
    setEditOrderDialog(true);
  };

  // Handle edit payment data
  const handleEditPayment = () => {
    setEditPaymentData({
      deposit: selectedOrder.paymentData?.deposit || '',
      amountPaid: selectedOrder.paymentData?.amountPaid || '',
      pickupDeliveryEnabled: selectedOrder.paymentData?.pickupDeliveryEnabled || false,
      pickupDeliveryCost: selectedOrder.paymentData?.pickupDeliveryCost || '',
      notes: selectedOrder.paymentData?.notes || ''
    });
    setEditPaymentDialog(true);
  };

  // Handle edit furniture data
  const handleEditFurniture = () => {
    setEditFurnitureData(selectedOrder.furnitureData || { groups: [] });
    setEditFurnitureDialog(true);
  };

  // Validation functions
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone) => {
    if (!phone) return true; // Phone is optional
    const phoneRegex = /^[+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-()]/g, ''));
  };

  // Check if email is valid for sending (not empty and contains @)
  const isValidEmailForSending = (email) => {
    return email && email.trim().length > 0 && email.includes('@');
  };

  const validatePersonalInfo = () => {
    const errors = {};

    if (!editPersonalData.customerName?.trim()) {
      errors.customerName = 'Name is required';
    } else if (editPersonalData.customerName.trim().length < 2) {
      errors.customerName = 'Name must be at least 2 characters';
    }

    if (!editPersonalData.email?.trim()) {
      errors.email = 'Email is required';
    } else if (!validateEmail(editPersonalData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (editPersonalData.phone && !validatePhone(editPersonalData.phone)) {
      errors.phone = 'Please enter a valid phone number';
    }

    if (editPersonalData.address && editPersonalData.address.trim().length < 5) {
      errors.address = 'Address must be at least 5 characters';
    }

    return { isValid: Object.keys(errors).length === 0, errors };
  };

  const validateOrderDetails = () => {
    const errors = {};

    if (!editOrderData.startDate) {
      errors.startDate = 'Start date is required';
    }

    return { isValid: Object.keys(errors).length === 0, errors };
  };

  // Save personal information
  const handleSavePersonal = async () => {
    const validation = validatePersonalInfo();
    if (!validation.isValid) {
      const errorMessages = Object.values(validation.errors).join(', ');
      showError(`Please fix the validation errors: ${errorMessages}`);
      return;
    }

    try {
      const updatedOrder = {
        ...selectedOrder,
        personalInfo: editPersonalData
      };
      
      // Update the order in Firebase
      const orderRef = doc(db, 'orders', selectedOrder.id);
      await updateDoc(orderRef, { personalInfo: editPersonalData });
      
      // Update local state
      setSelectedOrder(updatedOrder);
      setOrders(orders.map(order => 
        order.id === selectedOrder.id ? updatedOrder : order
      ));
      setFilteredOrders(filteredOrders.map(order => 
        order.id === selectedOrder.id ? updatedOrder : order
      ));
      
      setEditPersonalDialog(false);
      showSuccess('Personal information updated successfully');
    } catch (error) {
      console.error('Error updating personal information:', error);
      showError('Failed to update personal information');
    }
  };

  // Save order details
  const handleSaveOrder = async () => {
    const validation = validateOrderDetails();
    if (!validation.isValid) {
      const errorMessages = Object.values(validation.errors).join(', ');
      showError(`Please fix the validation errors: ${errorMessages}`);
      return;
    }

    try {
      const updatedOrder = {
        ...selectedOrder,
        orderDetails: {
          ...selectedOrder.orderDetails,
          ...editOrderData
        }
      };
      
      const orderRef = doc(db, 'orders', selectedOrder.id);
      await updateDoc(orderRef, { 
        orderDetails: {
          ...selectedOrder.orderDetails,
          ...editOrderData
        }
      });
      
      // Update local state
      setSelectedOrder(updatedOrder);
      setOrders(orders.map(order => 
        order.id === selectedOrder.id ? updatedOrder : order
      ));
      setFilteredOrders(filteredOrders.map(order => 
        order.id === selectedOrder.id ? updatedOrder : order
      ));
      
      setEditOrderDialog(false);
      showSuccess('Order details updated successfully');
    } catch (error) {
      console.error('Error updating order details:', error);
      showError('Failed to update order details');
    }
  };

  // Save payment data
  const handleSavePayment = async () => {
    try {
      const deposit = parseFloat(editPaymentData.deposit) || 0;
      const amountPaid = parseFloat(editPaymentData.amountPaid) || 0;
      let financialStatus = 'Deposit Not Paid';
      if (amountPaid >= deposit && deposit > 0) {
        financialStatus = 'Deposit Paid';
      }
      const updatedOrder = {
        ...selectedOrder,
        paymentData: editPaymentData,
        orderDetails: {
          ...selectedOrder.orderDetails,
          financialStatus,
        },
      };
      const orderRef = doc(db, 'orders', selectedOrder.id);
      await updateDoc(orderRef, {
        paymentData: editPaymentData,
        orderDetails: {
          ...selectedOrder.orderDetails,
          financialStatus,
        },
      });
      setSelectedOrder(updatedOrder);
      setOrders(orders.map(order => order.id === selectedOrder.id ? updatedOrder : order));
      setFilteredOrders(filteredOrders.map(order => order.id === selectedOrder.id ? updatedOrder : order));
      setEditPaymentDialog(false);
      showSuccess('Payment information updated successfully');
    } catch (error) {
      console.error('Error updating payment information:', error);
      showError('Failed to update payment information');
    }
  };

  // Save furniture data for a specific group
  const handleSaveFurnitureGroup = async (groupIndex) => {
    try {
      // Use the editing data if available, otherwise use the current selectedOrder data
      const furnitureDataToSave = editingFurnitureData || selectedOrder.furnitureData;
      
      const orderRef = doc(db, 'orders', selectedOrder.id);
      await updateDoc(orderRef, { furnitureData: furnitureDataToSave });
      
      // Update local state with the saved data
      const updatedOrder = {
        ...selectedOrder,
        furnitureData: furnitureDataToSave
      };
      
      setSelectedOrder(updatedOrder);
      setOrders(orders.map(order => 
        order.id === selectedOrder.id ? updatedOrder : order
      ));
      setFilteredOrders(filteredOrders.map(order => 
        order.id === selectedOrder.id ? updatedOrder : order
      ));
      
      // Clear the editing state
      setEditingFurnitureData(null);
      
      showSuccess(`Furniture group ${groupIndex + 1} updated successfully`);
    } catch (error) {
      console.error('Error updating furniture group:', error);
      showError('Failed to update furniture group');
    }
  };

  // Update furniture group data in editing state only
  const updateFurnitureGroup = (groupIndex, fieldName, value) => {
    const currentFurnitureData = editingFurnitureData || selectedOrder.furnitureData;
    const updatedGroups = [...currentFurnitureData.groups];
    updatedGroups[groupIndex] = { ...updatedGroups[groupIndex], [fieldName]: value };
    
    const updatedFurnitureData = {
      ...currentFurnitureData,
      groups: updatedGroups
    };
    
    setEditingFurnitureData(updatedFurnitureData);
  };

  // Email sending function
  const handleSendEmail = async () => {
    if (!selectedOrder) {
      showError('No order selected');
      return;
    }

    if (!selectedOrder.personalInfo?.email) {
      showError('No email address found for this customer');
      return;
    }

    try {
      setSendingEmail(true);

      // Prepare order data in the same format as NewOrderPage
      const orderDataForEmail = {
        personalInfo: selectedOrder.personalInfo,
        orderDetails: selectedOrder.orderDetails,
        furnitureData: {
          groups: selectedOrder.furnitureData?.groups || []
        },
        paymentData: selectedOrder.paymentData
      };

      // Progress callback for email sending
      const onEmailProgress = (message) => {
        showSuccess(`📧 ${message}`);
      };

      // Send the email with progress tracking
      const result = await sendEmailWithConfig(orderDataForEmail, selectedOrder.personalInfo.email, onEmailProgress);
      
      if (result.success) {
        showSuccess('✅ Email sent successfully!');
      } else {
        showError(`❌ Failed to send email: ${result.message}`);
      }
    } catch (error) {
      console.error('Error sending email:', error);
      if (error.message.includes('Not signed in')) {
        showError('Please sign in with Gmail first by going to the Test Email page');
      } else {
        showError(`Failed to send email: ${error.message}`);
      }
    } finally {
      // Add a small delay before allowing refreshes
      setTimeout(() => {
        setSendingEmail(false);
      }, 500);
    }
  };

  // Completion Email Dialog State
  const [completionEmailDialog, setCompletionEmailDialog] = useState({
    open: false,
    sendEmail: true,
    includeReview: true
  });

  // Completion Email Functions
  const handleSendCompletionEmail = () => {
    if (!selectedOrder?.personalInfo?.email) {
      showError('No customer email available for this order');
      return;
    }
    
    // Open the completion email dialog
    setCompletionEmailDialog({
      open: true,
      sendEmail: true,
      includeReview: true
    });
  };

  const handleCompletionEmailConfirm = async () => {
    try {
      setSendingCompletionEmail(true);
      setCompletionEmailDialog({ open: false, sendEmail: false, includeReview: false });
      
      // Prepare order data for email
      const orderDataForEmail = {
        personalInfo: selectedOrder.personalInfo,
        orderDetails: selectedOrder.orderDetails,
        furnitureData: {
          groups: selectedOrder.furnitureData?.groups || []
        },
        paymentData: selectedOrder.paymentData
      };

      // Progress callback for email sending
      const onEmailProgress = (message) => {
        console.log('🔍 Admin Workshop Debug - Completion email progress:', message);
        showSuccess(`📧 ${message}`);
      };

      // Send the completion email
      const emailResult = await sendCompletionEmailWithGmail(
        orderDataForEmail, 
        selectedOrder.personalInfo.email, 
        completionEmailDialog.includeReview, // includeReviewRequest
        onEmailProgress
      );
      
      if (emailResult.success) {
        showSuccess('✅ Completion email sent successfully!');
      } else {
        showError(`❌ Failed to send completion email: ${emailResult.message}`);
      }
    } catch (error) {
      console.error('🔍 Admin Workshop Debug - Error sending completion email:', error);
      showError(`Failed to send completion email: ${error.message}`);
    } finally {
      setSendingCompletionEmail(false);
    }
  };

  const handleCompletionEmailCancel = () => {
    setCompletionEmailDialog({ open: false, sendEmail: false, includeReview: false });
  };

  // Handle deposit received
  const handleDepositReceived = async () => {
    if (!selectedOrder) {
      showError('No order selected');
      return;
    }

    // Check if customer has a valid email for sending
    const hasValidEmail = isValidEmailForSending(selectedOrder.personalInfo?.email);

    const requiredDeposit = parseFloat(selectedOrder.paymentData?.deposit) || 0;
    if (requiredDeposit <= 0) {
      showError('No deposit amount set for this order');
      return;
    }

    try {
      setProcessingDeposit(true);
      
      // Auto-check and authorize Gmail if needed
      await ensureGmailAuthorized();

      // Update the order with deposit received
      const orderRef = doc(db, 'orders', selectedOrder.id);
      const updatedPaymentData = {
        ...selectedOrder.paymentData,
        amountPaid: requiredDeposit,
        depositReceived: true,
        depositReceivedDate: new Date().toISOString()
      };

      await updateDoc(orderRef, {
        paymentData: updatedPaymentData,
        orderDetails: {
          ...selectedOrder.orderDetails,
          financialStatus: 'Deposit Paid',
        },
      });

      // Prepare order data for email
      const orderDataForEmail = {
        personalInfo: selectedOrder.personalInfo,
        orderDetails: selectedOrder.orderDetails,
        paymentData: updatedPaymentData
      };

      // Progress callback for deposit email
      const onDepositEmailProgress = (message) => {
        showSuccess(`💰 ${message}`);
      };

      // Try to send deposit confirmation email only if valid email exists
      if (hasValidEmail) {
        try {
          const emailResult = await sendDepositEmailWithConfig(orderDataForEmail, selectedOrder.personalInfo.email, onDepositEmailProgress);
          
          if (emailResult.success) {
            showSuccess('✅ Deposit received and confirmation email sent successfully!');
          } else {
            showSuccess(`✅ Deposit received successfully! Email not sent: ${emailResult.message}`);
          }
        } catch (emailError) {
          console.error('Email sending failed:', emailError);
          showSuccess(`✅ Deposit received successfully! Email not sent: ${emailError.message}`);
        }
      } else {
        // No valid email - just mark deposit as received
        showSuccess('✅ Deposit marked as received. No email sent (no valid email address available)');
      }

      // Immediately update the selectedOrder state with the new data
      const updatedSelectedOrder = {
        ...selectedOrder,
        paymentData: updatedPaymentData,
        orderDetails: {
          ...selectedOrder.orderDetails,
          financialStatus: 'Deposit Paid',
        }
      };
      setSelectedOrder(updatedSelectedOrder);
      
      // Refresh the orders list to ensure consistency
      await fetchOrders();
      
      // Update the selected order again with the fresh data from the database
      const refreshedOrders = await getDocs(query(collection(db, 'orders'), orderBy('orderDetails.billInvoice', 'desc')));
      const refreshedOrdersData = refreshedOrders.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      const finalUpdatedOrder = refreshedOrdersData.find(order => order.id === selectedOrder.id);
      if (finalUpdatedOrder) {
        setSelectedOrder(finalUpdatedOrder);
      }
    } catch (error) {
      console.error('Error processing deposit:', error);
      showError(`Failed to process deposit: ${error.message}`);
    } finally {
      // Add a small delay before allowing refreshes
      setTimeout(() => {
        setProcessingDeposit(false);
      }, 500);
    }
  };

  // Payment dialog handlers
  const handleOpenPaymentDialog = () => {
    setPaymentForm({
      paymentAmount: '',
      paymentDate: new Date().toISOString().split('T')[0],
      paymentNotes: ''
    });
    setPaymentDialog(true);
  };

  // Handle order selection - simplified to avoid double loading
  const handleOrderSelection = (order) => {
    setSelectedOrder(order);
  };

  // Force refresh of selected order data when dialog opens
  const handleOpenPaymentDialogWithRefresh = () => {
    // Find the latest order data from the orders list
    const latestOrderData = orders.find(order => order.id === selectedOrder?.id);
    if (latestOrderData) {
      setSelectedOrder(latestOrderData);
    }
    handleOpenPaymentDialog();
  };

  const handleClosePaymentDialog = () => {
    setPaymentDialog(false);
    setPaymentForm({
      paymentAmount: '',
      paymentDate: new Date().toISOString().split('T')[0],
      paymentNotes: ''
    });
  };

  const handlePaymentInputChange = (e) => {
    const { name, value } = e.target;
    setPaymentForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddNewPayment = async () => {
    if (!selectedOrder) return;

    const paymentAmount = parseFloat(paymentForm.paymentAmount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      showError('Please enter a valid payment amount');
      return;
    }

    try {
      const currentAmountPaid = parseFloat(selectedOrder.paymentData?.amountPaid || 0);
      const newTotalAmountPaid = currentAmountPaid + paymentAmount;

      const orderRef = doc(db, 'orders', selectedOrder.id);
      await updateDoc(orderRef, {
        'paymentData.amountPaid': newTotalAmountPaid,
        'paymentData.payments': [
          ...(selectedOrder.paymentData?.payments || []),
          {
            amount: paymentAmount,
            date: paymentForm.paymentDate,
            notes: paymentForm.paymentNotes,
            timestamp: new Date().toISOString()
          }
        ]
      });

      // Update local state
      setSelectedOrder(prev => ({
        ...prev,
        paymentData: {
          ...prev.paymentData,
          amountPaid: newTotalAmountPaid,
          payments: [
            ...(prev.paymentData?.payments || []),
            {
              amount: paymentAmount,
              date: paymentForm.paymentDate,
              notes: paymentForm.paymentNotes,
              timestamp: new Date().toISOString()
            }
          ]
        }
      }));

      // Update orders list
      setOrders(prev => prev.map(order => 
        order.id === selectedOrder.id 
          ? { 
              ...order, 
              paymentData: { 
                ...order.paymentData, 
                amountPaid: newTotalAmountPaid,
                payments: [
                  ...(order.paymentData?.payments || []),
                  {
                    amount: paymentAmount,
                    date: paymentForm.paymentDate,
                    notes: paymentForm.paymentNotes,
                    timestamp: new Date().toISOString()
                  }
                ]
              } 
            }
          : order
      ));

      setFilteredOrders(prev => prev.map(order => 
        order.id === selectedOrder.id 
          ? { 
              ...order, 
              paymentData: { 
                ...order.paymentData, 
                amountPaid: newTotalAmountPaid,
                payments: [
                  ...(order.paymentData?.payments || []),
                  {
                    amount: paymentAmount,
                    date: paymentForm.paymentDate,
                    notes: paymentForm.paymentNotes,
                    timestamp: new Date().toISOString()
                  }
                ]
              } 
            }
          : order
      ));

      showSuccess(`Payment of $${paymentAmount.toFixed(2)} saved successfully!`);
      
      // Refresh the orders to ensure UI is updated
      await fetchOrders();
      
      handleClosePaymentDialog();
    } catch (error) {
      console.error('Error saving payment:', error);
      showError(`Failed to save payment: ${error.message}`);
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
    <>
      {/* Email Operation Overlay */}
      {(sendingEmail || processingDeposit) && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white'
          }}
        >
          <CircularProgress size={60} sx={{ color: '#DAA520', mb: 2 }} />
          <Typography variant="h6" sx={{ mb: 1 }}>
            {sendingEmail ? 'Sending Email...' : 'Processing Deposit...'}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.8, textAlign: 'center', maxWidth: 400 }}>
            Please wait while we process your request. This may take a few moments.
          </Typography>
        </Box>
      )}
      
      <Box sx={{ 
        height: 'calc(100vh - 100px)', 
        display: 'flex'
      }}>
        {/* Left Sidebar - Orders List */}
      <Paper 
        sx={{ 
          width: 350, 
          height: '100%', 
          overflow: 'auto',
          borderRight: '2px solid #e0e0e0',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <Box sx={{ p: 2, borderBottom: '2px solid #e0e0e0' }}>
          <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 1 }}>
            Workshop Orders
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''} in queue
          </Typography>
          
          {/* Search */}
          <TextField
            fullWidth
            placeholder="Search orders..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
              endAdornment: searchTerm && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => handleSearch('')}>
                    <RefreshIcon />
                  </IconButton>
                </InputAdornment>
              )
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                backgroundColor: 'background.paper'
              }
            }}
          />
        </Box>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Alert severity="info">
              {searchTerm ? 'No orders found matching your search' : 'No orders found. Create some orders first!'}
            </Alert>
          </Box>
        ) : (
          <List sx={{ p: 0, flex: 1 }}>
            {filteredOrders.map((order, index) => (
              <React.Fragment key={order.id}>
                <ListItem disablePadding>
                  <ListItemButton
                    selected={selectedOrder?.id === order.id}
                    onClick={() => handleOrderSelection(order)}
                    sx={{
                      '&.Mui-selected': {
                        backgroundColor: '#e0e0e0',
                        '&:hover': {
                          backgroundColor: '#d0d0d0',
                        },
                      },
                      '&:hover': {
                        backgroundColor: '#f5f5f5',
                      },
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box>
                          {/* Invoice Number and Customer Name */}
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                            <Typography 
                              variant="h5" 
                              sx={{ 
                                fontWeight: 'bold',
                                color: 'primary.main'
                              }}
                            >
                              #{order.orderDetails?.billInvoice || 'N/A'}
                            </Typography>
                            <Typography 
                              variant="body1" 
                              sx={{ 
                                fontWeight: 600,
                                color: 'text.secondary',
                                fontSize: '0.9rem'
                              }}
                            >
                              {order.personalInfo?.customerName || 'No Name'}
                            </Typography>
                          </Box>

                          {/* Status */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                              label={getStatusText(order)}
                              size="small"
                              sx={{
                                backgroundColor: getStatusColor(order) === 'success' ? '#4CAF50' : 
                                                getStatusColor(order) === 'warning' ? '#FF9800' : 
                                                getStatusColor(order) === 'error' ? '#F44336' : '#757575',
                                color: 'white',
                                fontWeight: 'bold',
                                border: 'none',
                                outline: 'none',
                                '& .MuiChip-root': {
                                  border: 'none'
                                }
                              }}
                            />
                          </Box>
                        </Box>
                      }
                    />
                  </ListItemButton>
                </ListItem>
                {index < filteredOrders.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Paper>

      {/* Right Panel - Order Details */}
      <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
        {selectedOrder ? (
          <Box>
            {/* Header */}
            <Box sx={{ mb: 3 }}>
              {/* First Row - Title and Bill Number */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Order Details • <span style={{ color: '#ffffff' }}>{selectedOrder.personalInfo?.customerName}</span>
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                    #{selectedOrder.orderDetails?.billInvoice}
                  </Typography>
                </Box>
              </Box>
              
              {/* Second Row - Email Button and Status Button */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-start', gap: 2 }}>
                <Button
                  variant="contained"
                  size="medium"
                  startIcon={sendingEmail ? <CircularProgress size={16} sx={{ color: '#000000' }} /> : <SendIcon sx={{ color: '#000000' }} />}
                  onClick={handleSendEmail}
                  disabled={sendingEmail || !selectedOrder?.personalInfo?.email}
                  sx={{
                    px: 3,
                    py: 1.5,
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    borderRadius: 2,
                    background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
                    color: '#000000',
                    border: '3px solid #4CAF50',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.3)',
                    position: 'relative',
                    '&:hover': {
                      background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
                      border: '3px solid #45a049',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.3), 0 6px 12px rgba(0,0,0,0.4)',
                      transform: 'translateY(-1px)'
                    },
                    '&:disabled': {
                      background: 'linear-gradient(145deg, #a0a0a0 0%, #808080 50%, #606060 100%)',
                      border: '3px solid #666666',
                      color: '#666666',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.2)'
                    },
                    transition: 'all 0.3s ease',
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
                  {sendingEmail ? 'Sending Email...' : 'Send Order Email'}
                </Button>
                
                {/* Status Button */}
                <Button
                  variant="outlined"
                  size="medium"
                  startIcon={<AssignmentIcon />}
                  onClick={() => {
                    setEditingStatus(selectedOrder.invoiceStatus);
                    setStatusDialogOpen(true);
                  }}
                  sx={{
                    px: 3,
                    py: 1.5,
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    borderRadius: 2,
                    borderWidth: 2,
                    '&:hover': {
                      borderWidth: 2,
                      transform: 'translateY(-1px)'
                    },
                    transition: 'all 0.3s ease',
                    backgroundColor: getStatusInfo(selectedOrder.invoiceStatus).color,
                    color: 'white',
                    borderColor: getStatusInfo(selectedOrder.invoiceStatus).color,
                    '&:hover': {
                      backgroundColor: getStatusInfo(selectedOrder.invoiceStatus).color,
                      borderColor: getStatusInfo(selectedOrder.invoiceStatus).color,
                      opacity: 0.8
                    }
                  }}
                >
                  {getStatusInfo(selectedOrder.invoiceStatus).label}
                </Button>

                {/* Send Completion Email Button */}
                <Button
                  variant="contained"
                  size="medium"
                  startIcon={sendingCompletionEmail ? <CircularProgress size={16} sx={{ color: '#000000' }} /> : <CheckCircleIcon sx={{ color: '#000000' }} />}
                  onClick={handleSendCompletionEmail}
                  disabled={sendingCompletionEmail || !selectedOrder?.personalInfo?.email}
                  sx={{
                    px: 3,
                    py: 1.5,
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    borderRadius: 2,
                    background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
                    color: '#000000',
                    border: '3px solid #4CAF50',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.3)',
                    position: 'relative',
                    '&:hover': {
                      background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
                      border: '3px solid #45a049',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.3), 0 6px 12px rgba(0,0,0,0.4)',
                      transform: 'translateY(-1px)'
                    },
                    '&:disabled': {
                      background: 'linear-gradient(145deg, #a0a0a0 0%, #808080 50%, #606060 100%)',
                      border: '3px solid #666666',
                      color: '#666666',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.2)'
                    },
                    transition: 'all 0.3s ease',
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
                  {sendingCompletionEmail ? 'Sending...' : 'Send Completion Email'}
                </Button>
              </Box>
            </Box>

            {/* First Row - Personal Info and Order Details */}
            <Box sx={{ display: 'flex', gap: 3, mb: 4 }}>
              {/* Personal Info Card */}
              <Card sx={{ boxShadow: 4, flex: 1, border: '2px solid #e3f2fd' }}>
                <CardContent sx={{ p: 0 }}>
                  {/* Header */}
                  <Box sx={{
                    backgroundColor: '#b98f33',
                    color: '#000000',
                    p: 2,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    const newExpanded = !personalInfoExpanded;
                    setPersonalInfoExpanded(newExpanded);
                    setOrderDetailsExpanded(newExpanded);
                  }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <PersonIcon sx={{ mr: 1, color: '#000000' }} />
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#000000' }}>
                        Personal Information
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Tooltip title="Edit Personal Information">
                        <IconButton onClick={(e) => {
                          e.stopPropagation();
                          handleEditPersonal();
                        }} sx={{ color: '#000000' }} size="small">
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <IconButton 
                        onClick={(e) => {
                          e.stopPropagation();
                          const newExpanded = !personalInfoExpanded;
                          setPersonalInfoExpanded(newExpanded);
                          setOrderDetailsExpanded(newExpanded);
                        }} 
                        sx={{ color: '#000000' }} 
                        size="small"
                      >
                        {personalInfoExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </Box>
                  </Box>

                  {/* Content */}
                  {personalInfoExpanded && (
                    <Box sx={{ p: 3 }}>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                        👤 Name
                      </Typography>
                      <Typography variant="body1" sx={{ mb: 2, fontSize: '1.1rem' }}>
                        {selectedOrder.personalInfo?.customerName || 'N/A'}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                        📞 Phone
                      </Typography>
                      <Typography variant="body1" sx={{ mb: 2 }}>
                        {selectedOrder.personalInfo?.phone || 'N/A'}
                      </Typography>
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                        ✉️ Email
                      </Typography>
                      <Typography variant="body1" sx={{ mb: 2 }}>
                        {selectedOrder.personalInfo?.email || 'N/A'}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                        📍 Address
                      </Typography>
                      <Typography variant="body1">
                        {selectedOrder.personalInfo?.address || 'N/A'}
                      </Typography>
                    </Box>
                  </Box>
                  )}
                </CardContent>
              </Card>

              {/* Order Details Card */}
              <Card sx={{ boxShadow: 4, flex: 1, border: '2px solid #e3f2fd' }}>
                <CardContent sx={{ p: 0 }}>
                  {/* Header */}
                  <Box sx={{
                    backgroundColor: '#b98f33',
                    color: '#000000',
                    p: 2,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    const newExpanded = !orderDetailsExpanded;
                    setOrderDetailsExpanded(newExpanded);
                    setPersonalInfoExpanded(newExpanded);
                  }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <ReceiptIcon sx={{ mr: 1, color: '#000000' }} />
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#000000' }}>
                        Order Details
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Tooltip title="Edit Order Details">
                        <IconButton onClick={(e) => {
                          e.stopPropagation();
                          handleEditOrder();
                        }} sx={{ color: '#000000' }} size="small">
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <IconButton 
                        onClick={(e) => {
                          e.stopPropagation();
                          const newExpanded = !orderDetailsExpanded;
                          setOrderDetailsExpanded(newExpanded);
                          setPersonalInfoExpanded(newExpanded);
                        }} 
                        sx={{ color: '#000000' }} 
                        size="small"
                      >
                        {orderDetailsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </Box>
                  </Box>

                  {/* Content */}
                  {orderDetailsExpanded && (
                    <Box sx={{ p: 3 }}>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                        📝 Description
                      </Typography>
                      <Typography variant="body1" sx={{ mb: 2 }}>
                        {selectedOrder.orderDetails?.description || 'N/A'}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                        🧾 Bill Invoice
                      </Typography>
                      <Typography variant="body1" sx={{ mb: 2, fontSize: '1.1rem', fontWeight: 'bold', color: '#f27921' }}>
                        {selectedOrder.orderDetails?.billInvoice || 'N/A'}
                      </Typography>
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                        🌐 Platform
                      </Typography>
                      <Typography variant="body1" sx={{ mb: 2 }}>
                        {selectedOrder.orderDetails?.platform || 'N/A'}
                      </Typography>
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                        📅 Start Date
                      </Typography>
                      <Typography variant="body1" sx={{ mb: 2 }}>
                        {selectedOrder.orderDetails?.startDate || 'N/A'}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                        ⏰ Timeline
                      </Typography>
                      <Typography variant="body1">
                        {selectedOrder.orderDetails?.timeline || 'N/A'}
                      </Typography>
                    </Box>
                  </Box>
                  )}
                </CardContent>
              </Card>
            </Box>

            {/* Payment & Notes Card */}
            <Card sx={{ boxShadow: 4, width: '100%', mb: 4, border: '2px solid #e3f2fd' }}>
              <CardContent sx={{ p: 0 }}>
                {/* Header */}
                <Box sx={{
                  backgroundColor: '#b98f33',
                  color: '#000000',
                  p: 2,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <PaymentIcon sx={{ mr: 1, color: '#000000' }} />
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#000000' }}>
                      Payment & Financial Information
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleOpenPaymentDialogWithRefresh}
                      sx={{
                        color: '#000000',
                        borderColor: '#000000',
                        '&:hover': {
                          borderColor: '#8b6b1f',
                          backgroundColor: 'rgba(139, 107, 31, 0.1)'
                        }
                      }}
                    >
                      Add Payment
                    </Button>
                    {selectedOrder.paymentData?.deposit && parseFloat(selectedOrder.paymentData.deposit) > 0 && !getDepositStatus(selectedOrder).isReceived && (
                      <Button
                        variant="contained"
                        size="small"
                        onClick={handleDepositReceived}
                        disabled={processingDeposit}
                        sx={{
                          background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
                          color: '#000000',
                          border: '3px solid #f27921',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.3)',
                          position: 'relative',
                          '&:hover': {
                            background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
                            border: '3px solid #e65100',
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
                            borderRadius: '4px 4px 0 0',
                            pointerEvents: 'none'
                          }
                        }}
                      >
                        {processingDeposit ? (
                          <>
                            <CircularProgress size={12} sx={{ color: '#000000', mr: 0.5 }} />
                            Processing...
                          </>
                        ) : (
                          'Mark Deposit Received'
                        )}
                      </Button>
                    )}
                    <Tooltip title="Edit Payment Information">
                      <IconButton onClick={handleEditPayment} sx={{ color: '#000000' }} size="small">
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>

                {/* Financial Summary Cards */}
                <Box sx={{ p: 3, pb: 2 }}>
                  {/* Main Row: Deposit & Delivery Info on Left, Financial Summary on Right */}
                  <Grid container spacing={3} sx={{ mb: 2 }}>
                    {/* Left Side: Deposit and Delivery Information */}
                    <Grid item xs={12} lg={5}>
                      <Grid container spacing={2}>
                        {/* Deposit Information - Professional Layout */}
                        <Grid item xs={6}>
                          <Card variant="outlined" sx={{ border: '2px solid #e3f2fd', height: '100%' }}>
                            <CardContent sx={{ p: 2 }}>
                              {/* Top Row: Deposit Label and Amount */}
                              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#d4af5a', mr: 1 }}>
                                  💰 Deposit
                                </Typography>
                                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#d4af5a' }}>
                                  ${selectedOrder.paymentData?.deposit || '0.00'}
                                </Typography>
                              </Box>
                              
                              {/* Bottom Row: Status Indicator and Text */}
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                {getDepositStatus(selectedOrder).isReceived ? (
                                  <Box sx={{ 
                                    width: 12, 
                                    height: 12, 
                                    borderRadius: '50%', 
                                    backgroundColor: '#4caf50',
                                    mr: 1
                                  }} />
                                ) : (
                                  <Box sx={{ 
                                    width: 12, 
                                    height: 12, 
                                    borderRadius: '50%', 
                                    backgroundColor: '#f44336',
                                    mr: 1
                                  }} />
                                )}
                                <Typography 
                                  variant="caption" 
                                  sx={{ 
                                    fontWeight: 'bold',
                                    color: getDepositStatus(selectedOrder).isReceived ? '#4caf50' : '#f44336',
                                    fontSize: '0.7rem'
                                  }}
                                >
                                  {getDepositStatus(selectedOrder).status}
                                </Typography>
                              </Box>
                            </CardContent>
                          </Card>
                        </Grid>

                        {/* Pickup & Delivery - Only Show When Enabled */}
                        {selectedOrder.paymentData?.pickupDeliveryEnabled && (
                          <Grid item xs={6}>
                            <Card variant="outlined" sx={{ border: '2px solid #e3f2fd', height: '100%' }}>
                              <CardContent sx={{ p: 2 }}>
                                {/* Top Row: Service Type and Amount */}
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#d4af5a', mr: 1 }}>
                                    🚚 {selectedOrder.paymentData.pickupDeliveryServiceType === 'pickup' ? 'Pickup' : 
                                         selectedOrder.paymentData.pickupDeliveryServiceType === 'delivery' ? 'Delivery' : 
                                         'Pickup & Delivery'}
                                  </Typography>
                                                                                                   <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#d4af5a' }}>
                                   ${(() => {
                                     const cost = selectedOrder.paymentData.pickupDeliveryCost || 0;
                                     const displayValue = selectedOrder.paymentData.pickupDeliveryServiceType === 'both' 
                                       ? cost * 2 
                                       : cost;
                                     return displayValue % 1 === 0 ? displayValue.toString() : displayValue.toFixed(2);
                                   })()}
                                 </Typography>
                                </Box>
                                
                                {/* Bottom Row: Status Indicator and Text */}
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <Box sx={{ 
                                    width: 12, 
                                    height: 12, 
                                    borderRadius: '50%', 
                                    backgroundColor: '#4caf50',
                                    mr: 1
                                  }} />
                                  <Typography variant="caption" sx={{ 
                                    fontWeight: 'bold',
                                    color: '#4caf50',
                                    fontSize: '0.7rem'
                                  }}>
                                                                          {selectedOrder.paymentData.pickupDeliveryServiceType === 'pickup' ? 'One Way' :
                                       selectedOrder.paymentData.pickupDeliveryServiceType === 'delivery' ? 'One Way' :
                                       'Both Services'}
                                  </Typography>
                                </Box>
                              </CardContent>
                            </Card>
                          </Grid>
                        )}
                      </Grid>
                    </Grid>

                    {/* Right Side: Financial Summary Cards */}
                    <Grid item xs={12} lg={7}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-end', justifyContent: 'flex-end', width: '100%' }}>
                        {/* Total Invoice Amount */}
                        <Card sx={{ 
                          background: 'linear-gradient(145deg, #a0a0a0 0%, #808080 50%, #606060 100%)',
                          color: '#000000',
                          width: '280px',
                          border: '2px solid #4CAF50',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.3)',
                          position: 'relative',
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '50%',
                            background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
                            borderRadius: '4px 4px 0 0',
                            pointerEvents: 'none'
                          }
                        }}>
                          <CardContent sx={{ py: 0.5, px: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#000000' }}>
                                Total Invoice Amount
                              </Typography>
                              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#000000' }}>
                                ${selectedOrder ? calculateInvoiceTotals(selectedOrder).grandTotal.toFixed(2) : '0.00'}
                              </Typography>
                            </Box>
                          </CardContent>
                        </Card>

                        {/* Amount Paid */}
                        <Card sx={{ 
                          background: 'linear-gradient(145deg, #a0a0a0 0%, #808080 50%, #606060 100%)',
                          color: '#000000',
                          width: '280px',
                          border: '2px solid #4CAF50',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.3)',
                          position: 'relative',
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '50%',
                            background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
                            borderRadius: '4px 4px 0 0',
                            pointerEvents: 'none'
                          }
                        }}>
                          <CardContent sx={{ py: 0.5, px: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#000000' }}>
                                Total Paid by Customer
                              </Typography>
                              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#000000' }}>
                                ${selectedOrder.paymentData?.amountPaid || '0.00'}
                              </Typography>
                            </Box>
                          </CardContent>
                        </Card>

                        {/* Remaining Balance */}
                        <Card sx={{ 
                          background: 'linear-gradient(145deg, #a0a0a0 0%, #808080 50%, #606060 100%)',
                          color: '#000000',
                          width: '280px',
                          border: selectedOrder && (calculateInvoiceTotals(selectedOrder).grandTotal - (parseFloat(selectedOrder.paymentData?.amountPaid || 0))) > 0
                            ? '2px solid #f44336'
                            : '2px solid #4CAF50',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.3)',
                          position: 'relative',
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '50%',
                            background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
                            borderRadius: '4px 4px 0 0',
                            pointerEvents: 'none'
                          }
                        }}>
                          <CardContent sx={{ py: 0.5, px: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#000000' }}>
                                Outstanding Balance
                              </Typography>
                              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#000000' }}>
                                ${selectedOrder ? (calculateInvoiceTotals(selectedOrder).grandTotal - (parseFloat(selectedOrder.paymentData?.amountPaid || 0))).toFixed(2) : '0.00'}
                              </Typography>
                            </Box>
                          </CardContent>
                        </Card>
                      </Box>
                    </Grid>
                  </Grid>

                  {/* Notes Section */}
                  {selectedOrder.paymentData?.notes && (
                    <Card variant="outlined" sx={{ border: '2px solid #fff3e0', backgroundColor: '#fafafa' }}>
                      <CardContent>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#f27921', mb: 2 }}>
                          📝 Additional Notes
                        </Typography>
                        <Typography variant="body1" sx={{ 
                          fontStyle: 'italic',
                          backgroundColor: 'white',
                          p: 2,
                          borderRadius: 1,
                          border: '1px solid #e0e0e0'
                        }}>
                          {selectedOrder.paymentData.notes}
                        </Typography>
                      </CardContent>
                    </Card>
                  )}
                  
                  {/* Email Status Indicator - Hidden but functionality preserved */}
                  {/* {selectedOrder.paymentData?.deposit && parseFloat(selectedOrder.paymentData.deposit) > 0 && (
                    <Box sx={{ mt: 3 }}>
                      <Alert 
                        severity="success"
                        icon={<CheckIcon />}
                      >
                        <Typography variant="body2">
                          Ready to send emails using your Google account
                        </Typography>
                      </Alert>
                    </Box>
                  )} */}
                </Box>
              </CardContent>
            </Card>

            {/* Furniture Details Card */}
            <Card sx={{ boxShadow: 4, width: '100%', mb: 4, border: '2px solid #e3f2fd' }}>
              <CardContent sx={{ p: 0 }}>
                {/* Header */}
                <Box sx={{
                  backgroundColor: '#b98f33',
                  color: '#000000',
                  p: 2,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <ChairIcon sx={{ mr: 1, color: '#000000' }} />
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#000000' }}>
                      Furniture Details
                    </Typography>
                  </Box>
                  <Tooltip title="Edit Furniture Details">
                    <IconButton onClick={handleEditFurniture} sx={{ color: '#000000' }} size="small">
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                </Box>

                {/* Content */}
                <Box sx={{ p: 3 }}>
                  {selectedOrder.furnitureData?.groups && selectedOrder.furnitureData.groups.length > 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {selectedOrder.furnitureData.groups.map((group, index) => {
                        // Use editing data if available, otherwise use the original data
                        const currentFurnitureData = editingFurnitureData || selectedOrder.furnitureData;
                        const currentGroup = currentFurnitureData.groups[index] || group;
                        
                        return (
                          <Card key={index} sx={{ p: 2, border: '2px solid #e3f2fd' }}>
                            <Box sx={{ 
                              backgroundColor: '#d4af5a', 
                              color: '#000000', 
                              p: 1.5, 
                              borderRadius: 1, 
                              mb: 2,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}>
                              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', color: '#000000' }}>
                                {currentGroup.furnitureType || 'Furniture Group ' + (index + 1)}
                              </Typography>
                              <Tooltip title={`Save Furniture Group ${index + 1}`}>
                                <IconButton 
                                  onClick={() => handleSaveFurnitureGroup(index)} 
                                  color="inherit" 
                                  size="small"
                                  sx={{ 
                                    '&:hover': { 
                                      backgroundColor: 'rgba(255, 255, 255, 0.1)' 
                                    } 
                                  }}
                                >
                                  <SaveIcon />
                                </IconButton>
                              </Tooltip>
                            </Box>
                            
                            {/* Row 1: Material Company - Material Code - Treatment */}
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 2 }}>
                              <FormControl fullWidth size="small">
                                <InputLabel 
                                  sx={{ 
                                    backgroundColor: '#2a2a2a',
                                    color: '#ffffff',
                                    px: 1,
                                    '&.Mui-focused': {
                                      backgroundColor: '#2a2a2a',
                                      color: '#ffffff'
                                    }
                                  }}
                                >
                                  Material Company
                                </InputLabel>
                                <Select
                                  value={currentGroup.materialCompany || ''}
                                  onChange={(e) => updateFurnitureGroup(index, 'materialCompany', e.target.value)}
                                  displayEmpty
                                  disabled={companiesLoading}
                                  sx={{
                                    '& .MuiOutlinedInput-notchedOutline': {
                                      borderWidth: '2px',
                                      borderColor: 'grey.300',
                                      borderRadius: 2,
                                    },
                                    '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                                      borderColor: 'primary.main',
                                    },
                                    '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                      borderColor: 'primary.main',
                                      borderWidth: '2px',
                                    },
                                  }}
                                >
                                  <MenuItem value="" disabled>
                                    {companiesLoading ? 'Loading companies...' : 'Select Material Company'}
                                  </MenuItem>
                                  {materialCompanies.map((company) => (
                                    <MenuItem key={company.id} value={company.name}>
                                      {company.name}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                              <TextField
                                label="Material Code"
                                value={currentGroup.materialCode || ''}
                                onChange={(e) => updateFurnitureGroup(index, 'materialCode', e.target.value)}
                                size="small"
                                fullWidth
                              />
                              <FormControl fullWidth size="small">
                                <InputLabel 
                                  sx={{ 
                                    backgroundColor: '#2a2a2a',
                                    color: '#ffffff',
                                    px: 1,
                                    '&.Mui-focused': {
                                      backgroundColor: '#2a2a2a',
                                      color: '#ffffff'
                                    }
                                  }}
                                >
                                  Treatment
                                </InputLabel>
                                <Select
                                  value={currentGroup.treatment || ''}
                                  onChange={(e) => updateFurnitureGroup(index, 'treatment', e.target.value)}
                                  displayEmpty
                                  disabled={treatmentsLoading}
                                  renderValue={(value) => {
                                    if (!value) {
                                      return <span style={{ color: '#666' }}>Select Treatment</span>;
                                    }
                                    return value;
                                  }}
                                  sx={{
                                    '& .MuiOutlinedInput-notchedOutline': {
                                      borderWidth: '2px',
                                      borderColor: 'grey.300',
                                      borderRadius: 2,
                                    },
                                    '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                                      borderColor: 'primary.main',
                                    },
                                    '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                      borderColor: 'primary.main',
                                      borderWidth: '2px',
                                    },
                                  }}
                                >
                                  {treatmentsLoading && (
                                    <MenuItem value="" disabled>
                                      Loading treatments...
                                    </MenuItem>
                                  )}
                                  {treatments.map((treatment) => (
                                    <MenuItem key={treatment.id} value={treatment.treatmentKind}>
                                      {treatment.treatmentKind}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </Box>

                            {/* Row 2: Material Qnty - Material JL Qnty - Material Price - Material JL Price */}
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 2 }}>
                              <TextField
                                label="Material Quantity"
                                value={currentGroup.materialQnty || ''}
                                onChange={(e) => updateFurnitureGroup(index, 'materialQnty', e.target.value)}
                                size="small"
                                fullWidth
                              />
                              <TextField
                                label="Material JL Quantity"
                                value={currentGroup.materialJLQnty || ''}
                                onChange={(e) => updateFurnitureGroup(index, 'materialJLQnty', e.target.value)}
                                size="small"
                                fullWidth
                                sx={{
                                  '& .MuiOutlinedInput-root': {
                                    borderColor: '#2a2a2a',
                                    backgroundColor: '#2a2a2a',
                                    color: '#ffffff',
                                    '&:hover': {
                                      borderColor: '#3a3a3a',
                                      backgroundColor: '#3a3a3a'
                                    },
                                    '&.Mui-focused': {
                                      borderColor: '#2a2a2a',
                                      backgroundColor: '#2a2a2a'
                                    }
                                  },
                                  '& .MuiInputLabel-root': {
                                    color: '#ffffff',
                                    '&.Mui-focused': {
                                      color: '#ffffff'
                                    }
                                  },
                                  '& .MuiInputBase-input': {
                                    color: '#ffffff'
                                  }
                                }}
                              />
                              <TextField
                                label="Material Price"
                                type="number"
                                value={currentGroup.materialPrice || ''}
                                onChange={(e) => updateFurnitureGroup(index, 'materialPrice', e.target.value)}
                                size="small"
                                fullWidth
                              />
                              <TextField
                                label="Material JL Price"
                                type="number"
                                value={currentGroup.materialJLPrice || ''}
                                onChange={(e) => updateFurnitureGroup(index, 'materialJLPrice', e.target.value)}
                                size="small"
                                fullWidth
                                sx={{
                                  '& .MuiOutlinedInput-root': {
                                    borderColor: '#2a2a2a',
                                    backgroundColor: '#2a2a2a',
                                    color: '#ffffff',
                                    '&:hover': {
                                      borderColor: '#3a3a3a',
                                      backgroundColor: '#3a3a3a'
                                    },
                                    '&.Mui-focused': {
                                      borderColor: '#2a2a2a',
                                      backgroundColor: '#2a2a2a'
                                    }
                                  },
                                  '& .MuiInputLabel-root': {
                                    color: '#ffffff',
                                    '&.Mui-focused': {
                                      color: '#ffffff'
                                    }
                                  },
                                  '& .MuiInputBase-input': {
                                    color: '#ffffff'
                                  }
                                }}
                              />
                            </Box>

                            {/* Row 3: Labour Price - Labour Note - Labour Quantity */}
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 2 }}>
                              <TextField
                                label="Labour Price"
                                type="number"
                                value={currentGroup.labourPrice || ''}
                                onChange={(e) => updateFurnitureGroup(index, 'labourPrice', e.target.value)}
                                size="small"
                                fullWidth
                              />
                              <TextField
                                label="Labour Note"
                                value={currentGroup.labourNote || ''}
                                onChange={(e) => updateFurnitureGroup(index, 'labourNote', e.target.value)}
                                size="small"
                                fullWidth
                              />
                              <TextField
                                label="Labour Quantity"
                                value={currentGroup.labourQnty || ''}
                                onChange={(e) => updateFurnitureGroup(index, 'labourQnty', e.target.value)}
                                size="small"
                                fullWidth
                              />
                            </Box>

                            {/* Foam Toggle */}
                            <Box sx={{ mb: 2, background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)', borderRadius: 1, border: '2px solid #8b6b1f' }}>
                              <FormControlLabel
                                sx={{ p: 1 }}
                                control={
                                  <Switch
                                    checked={currentGroup.foamEnabled || false}
                                    onChange={(e) => updateFurnitureGroup(index, 'foamEnabled', e.target.checked)}
                                    color="primary"
                                  />
                                }
                                label={
                                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#000000' }}>
                                      🪣 Enable Foam
                                    </Typography>
                                    {currentGroup.foamEnabled && (
                                      <Chip 
                                        label="Enabled" 
                                        size="small" 
                                        color="success" 
                                        sx={{ ml: 1 }}
                                      />
                                    )}
                                  </Box>
                                }
                              />
                            </Box>
                            
                            {currentGroup.foamEnabled && (
                              <>
                                {/* Row 4: Foam Price - Foam JL Price - Foam Thickness - Foam Note - Foam Quantity */}
                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 2, mb: 2 }}>
                                  <TextField
                                    label="Foam Price"
                                    type="number"
                                    value={currentGroup.foamPrice || ''}
                                    onChange={(e) => updateFurnitureGroup(index, 'foamPrice', e.target.value)}
                                    size="small"
                                    fullWidth
                                  />
                                  <TextField
                                    label="Foam JL Price"
                                    type="number"
                                    value={currentGroup.foamJLPrice || ''}
                                    onChange={(e) => updateFurnitureGroup(index, 'foamJLPrice', e.target.value)}
                                    size="small"
                                    fullWidth
                                    sx={{
                                      '& .MuiOutlinedInput-root': {
                                        borderColor: '#2a2a2a',
                                        backgroundColor: '#2a2a2a',
                                        color: '#ffffff',
                                        '&:hover': {
                                          borderColor: '#3a3a3a',
                                          backgroundColor: '#3a3a3a'
                                        },
                                        '&.Mui-focused': {
                                          borderColor: '#2a2a2a',
                                          backgroundColor: '#2a2a2a'
                                        }
                                      },
                                      '& .MuiInputLabel-root': {
                                        color: '#ffffff',
                                        '&.Mui-focused': {
                                          color: '#ffffff'
                                        }
                                      },
                                      '& .MuiInputBase-input': {
                                        color: '#ffffff'
                                      }
                                    }}
                                  />
                                  <TextField
                                    label="Foam Thickness"
                                    value={currentGroup.foamThickness || ''}
                                    onChange={(e) => updateFurnitureGroup(index, 'foamThickness', e.target.value)}
                                    size="small"
                                    fullWidth
                                  />
                                  <TextField
                                    label="Foam Note"
                                    value={currentGroup.foamNote || ''}
                                    onChange={(e) => updateFurnitureGroup(index, 'foamNote', e.target.value)}
                                    size="small"
                                    fullWidth
                                  />
                                  <TextField
                                    label="Foam Quantity"
                                    value={currentGroup.foamQnty || ''}
                                    onChange={(e) => updateFurnitureGroup(index, 'foamQnty', e.target.value)}
                                    size="small"
                                    fullWidth
                                  />
                                </Box>
                              </>
                            )}
                            
                            {/* Painting Section */}
                            <Box sx={{ mb: 2, background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)', borderRadius: 1, border: '2px solid #8b6b1f' }}>
                              <FormControlLabel
                                sx={{ p: 1 }}
                                control={
                                  <Switch
                                    checked={currentGroup.paintingEnabled || false}
                                    onChange={(e) => updateFurnitureGroup(index, 'paintingEnabled', e.target.checked)}
                                    color="primary"
                                  />
                                }
                                label={
                                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#000000' }}>
                                      🎨 Enable Painting
                                    </Typography>
                                    {currentGroup.paintingEnabled && (
                                      <Chip 
                                        label="Enabled" 
                                        size="small" 
                                        color="success" 
                                        sx={{ ml: 1 }}
                                      />
                                    )}
                                  </Box>
                                }
                              />
                            </Box>
                            
                            {currentGroup.paintingEnabled && (
                              <>
                                {/* Row 5: Painting Labour - Painting Note - Painting Quantity */}
                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 2 }}>
                                  <TextField
                                    label="Painting Labour"
                                    type="number"
                                    value={currentGroup.paintingLabour || ''}
                                    onChange={(e) => updateFurnitureGroup(index, 'paintingLabour', e.target.value)}
                                    size="small"
                                    fullWidth
                                  />
                                  <TextField
                                    label="Painting Note"
                                    value={currentGroup.paintingNote || ''}
                                    onChange={(e) => updateFurnitureGroup(index, 'paintingNote', e.target.value)}
                                    size="small"
                                    fullWidth
                                  />
                                  <TextField
                                    label="Painting Quantity"
                                    value={currentGroup.paintingQnty || ''}
                                    onChange={(e) => updateFurnitureGroup(index, 'paintingQnty', e.target.value)}
                                    size="small"
                                    fullWidth
                                  />
                                </Box>
                              </>
                            )}
                            
                            {currentGroup.customerNote && (
                              <Box sx={{ mb: 2 }}>
                                <TextField
                                  label="Customer Note"
                                  multiline
                                  rows={2}
                                  value={currentGroup.customerNote || ''}
                                  onChange={(e) => updateFurnitureGroup(index, 'customerNote', e.target.value)}
                                  fullWidth
                                  sx={{ width: '100%' }}
                                />
                              </Box>
                            )}
                          </Card>
                        );
                      })}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No furniture items added
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Typography variant="h6" color="text.secondary">
              Select an order from the left panel to view details
            </Typography>
          </Box>
        )}
      </Box>

      {/* Edit Personal Information Dialog */}
      <Dialog open={editPersonalDialog} onClose={() => setEditPersonalDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Personal Information</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Name"
              value={editPersonalData.customerName || ''}
              onChange={(e) => setEditPersonalData({ ...editPersonalData, customerName: e.target.value })}
              onFocus={handleAutoSelect}
              required
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={editPersonalData.email || ''}
              onChange={(e) => setEditPersonalData({ ...editPersonalData, email: e.target.value })}
              onFocus={handleAutoSelect}
              required
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Phone"
              value={editPersonalData.phone || ''}
              onChange={(e) => setEditPersonalData({ ...editPersonalData, phone: e.target.value })}
              onFocus={handleAutoSelect}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Address"
              multiline
              rows={3}
              value={editPersonalData.address || ''}
              onChange={(e) => setEditPersonalData({ ...editPersonalData, address: e.target.value })}
              onFocus={handleAutoSelect}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditPersonalDialog(false)}>Cancel</Button>
          <Button onClick={handleSavePersonal} variant="contained" sx={{
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
          }}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Order Details Dialog */}
      <Dialog open={editOrderDialog} onClose={() => setEditOrderDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Order Details</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Order Description"
              value={editOrderData.description || ''}
              onChange={(e) => setEditOrderData({ ...editOrderData, description: e.target.value })}
              onFocus={handleAutoSelect}
              sx={{ mb: 2 }}
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <Select
                value={editOrderData.platform || ''}
                onChange={(e) => setEditOrderData({ ...editOrderData, platform: e.target.value })}
                displayEmpty
              >
                <MenuItem value="" disabled>
                  {platformsLoading ? 'Loading platforms...' : 'Select Platform'}
                </MenuItem>
                {platforms.map((platform) => (
                  <MenuItem key={platform.id} value={platform.name}>
                    {platform.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Start Date"
              type="date"
              value={editOrderData.startDate || ''}
              onChange={(e) => setEditOrderData({ ...editOrderData, startDate: e.target.value })}
              onFocus={handleAutoSelect}
              InputLabelProps={{
                shrink: true,
              }}
              required
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Timeline"
              value={editOrderData.timeline || ''}
              onChange={(e) => setEditOrderData({ ...editOrderData, timeline: e.target.value })}
              onFocus={handleAutoSelect}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOrderDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveOrder} variant="contained" sx={{
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
          }}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Payment Dialog */}
      <Dialog open={editPaymentDialog} onClose={() => setEditPaymentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Payment Information</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Deposit Amount"
              type="number"
              value={editPaymentData.deposit || ''}
              onChange={(e) => setEditPaymentData({ ...editPaymentData, deposit: e.target.value })}
              onFocus={handleAutoSelect}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Amount Paid"
              type="number"
              value={editPaymentData.amountPaid || ''}
              onChange={(e) => setEditPaymentData({ ...editPaymentData, amountPaid: e.target.value })}
              onFocus={handleAutoSelect}
              sx={{ mb: 2 }}
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <Select
                value={editPaymentData.pickupDeliveryEnabled ? 'Yes' : 'No'}
                onChange={(e) => setEditPaymentData({ ...editPaymentData, pickupDeliveryEnabled: e.target.value === 'Yes' })}
                displayEmpty
              >
                <MenuItem value="" disabled>
                  Pickup & Delivery Enabled
                </MenuItem>
                <MenuItem value="Yes">Yes</MenuItem>
                <MenuItem value="No">No</MenuItem>
              </Select>
            </FormControl>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <Select
                    value={editPaymentData.pickupDeliveryServiceType || 'both'}
                    onChange={(e) => setEditPaymentData({ ...editPaymentData, pickupDeliveryServiceType: e.target.value })}
                    displayEmpty
                    sx={{
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderWidth: '2px',
                        borderColor: 'grey.300',
                        borderRadius: 2,
                      },
                      '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'primary.main',
                      },
                      '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'primary.main',
                        borderWidth: '2px',
                      },
                    }}
                  >
                    <MenuItem value="pickup">🚚 Pickup Only</MenuItem>
                    <MenuItem value="delivery">🚚 Delivery Only</MenuItem>
                    <MenuItem value="both">🚚 Pickup & Delivery</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Service Cost"
                  type="number"
                  value={editPaymentData.pickupDeliveryCost || 0}
                  onChange={(e) => {
                    setEditPaymentData({ 
                      ...editPaymentData, 
                      pickupDeliveryCost: parseFloat(e.target.value) || 0
                    });
                  }}
                  onFocus={handleAutoSelect}
                  helperText={`Total: $${(editPaymentData.pickupDeliveryCost || 0) * (editPaymentData.pickupDeliveryServiceType === 'both' ? 2 : 1)} (${editPaymentData.pickupDeliveryServiceType === 'both' ? '2x service' : '1x service'})`}
                  inputProps={{ min: 0, step: 0.01 }}
                  placeholder="Enter service cost"
                />
              </Grid>
            </Grid>
            <TextField
              fullWidth
              label="Additional Notes"
              multiline
              rows={3}
              value={editPaymentData.notes || ''}
              onChange={(e) => setEditPaymentData({ ...editPaymentData, notes: e.target.value })}
              onFocus={handleAutoSelect}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditPaymentDialog(false)}>Cancel</Button>
          <Button onClick={handleSavePayment} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Furniture Dialog */}
      <Dialog open={editFurnitureDialog} onClose={() => setEditFurnitureDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Edit Furniture Details</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {editFurnitureData.groups && editFurnitureData.groups.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {editFurnitureData.groups.map((group, index) => (
                  <Card key={index} sx={{ p: 2, border: '2px solid #e3f2fd' }}>
                    <Box sx={{ 
                      backgroundColor: '#1976d2', 
                      color: 'white', 
                      p: 1.5, 
                      borderRadius: 1, 
                      mb: 2,
                      textAlign: 'center'
                    }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                        {group.furnitureType || 'Furniture Group ' + (index + 1)}
                      </Typography>
                    </Box>
                    
                    {/* Row 1: Material Company - Material Code - Treatment */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 2 }}>
                      <FormControl fullWidth size="small">
                        <InputLabel 
                          sx={{ 
                            backgroundColor: 'white',
                            px: 1,
                            '&.Mui-focused': {
                              backgroundColor: 'white'
                            }
                          }}
                        >
                          Material Company
                        </InputLabel>
                        <Select
                          value={group.materialCompany || ''}
                          onChange={(e) => updateFurnitureGroup(index, 'materialCompany', e.target.value)}
                          displayEmpty
                          disabled={companiesLoading}
                          sx={{
                            '& .MuiOutlinedInput-notchedOutline': {
                              borderWidth: '2px',
                              borderColor: 'grey.300',
                              borderRadius: 2,
                            },
                            '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                              borderColor: 'primary.main',
                            },
                            '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                              borderColor: 'primary.main',
                              borderWidth: '2px',
                            },
                          }}
                        >
                          <MenuItem value="" disabled>
                            {companiesLoading ? 'Loading companies...' : 'Select Material Company'}
                          </MenuItem>
                          {materialCompanies.map((company) => (
                            <MenuItem key={company.id} value={company.name}>
                              {company.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <TextField
                        label="Material Code"
                        value={group.materialCode || ''}
                        onChange={(e) => updateFurnitureGroup(index, 'materialCode', e.target.value)}
                        size="small"
                        fullWidth
                      />
                      <FormControl fullWidth size="small">
                        <InputLabel 
                          sx={{ 
                            backgroundColor: 'white',
                            px: 1,
                            '&.Mui-focused': {
                              backgroundColor: 'white'
                            }
                          }}
                        >
                          Treatment
                        </InputLabel>
                        <Select
                          value={group.treatment || ''}
                          onChange={(e) => updateFurnitureGroup(index, 'treatment', e.target.value)}
                          displayEmpty
                          disabled={treatmentsLoading}
                          renderValue={(value) => {
                            if (!value) {
                              return <span style={{ color: '#666' }}>Select Treatment</span>;
                            }
                            return value;
                          }}
                          sx={{
                            '& .MuiOutlinedInput-notchedOutline': {
                              borderWidth: '2px',
                              borderColor: 'grey.300',
                              borderRadius: 2,
                            },
                            '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                              borderColor: 'primary.main',
                            },
                            '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                              borderColor: 'primary.main',
                              borderWidth: '2px',
                            },
                          }}
                        >
                          {treatmentsLoading && (
                            <MenuItem value="" disabled>
                              Loading treatments...
                            </MenuItem>
                          )}
                          {treatments.map((treatment) => (
                            <MenuItem key={treatment.id} value={treatment.treatmentKind}>
                              {treatment.treatmentKind}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>

                    {/* Row 2: Material Qnty - Material JL Qnty - Material Price - Material JL Price */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 2 }}>
                      <TextField
                        label="Material Quantity"
                        value={group.materialQnty || ''}
                        onChange={(e) => updateFurnitureGroup(index, 'materialQnty', e.target.value)}
                        size="small"
                        fullWidth
                      />
                      <TextField
                        label="Material JL Quantity"
                        value={group.materialJLQnty || ''}
                        onChange={(e) => updateFurnitureGroup(index, 'materialJLQnty', e.target.value)}
                        size="small"
                        fullWidth
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderColor: '#1976d2',
                            backgroundColor: '#f3f8ff',
                            '&:hover': {
                              borderColor: '#1565c0',
                              backgroundColor: '#e3f2fd'
                            },
                            '&.Mui-focused': {
                              borderColor: '#1976d2',
                              backgroundColor: '#e3f2fd'
                            }
                          }
                        }}
                      />
                      <TextField
                        label="Material Price"
                        type="number"
                        value={group.materialPrice || ''}
                        onChange={(e) => updateFurnitureGroup(index, 'materialPrice', e.target.value)}
                        size="small"
                        fullWidth
                      />
                      <TextField
                        label="Material JL Price"
                        type="number"
                        value={group.materialJLPrice || ''}
                        onChange={(e) => updateFurnitureGroup(index, 'materialJLPrice', e.target.value)}
                        size="small"
                        fullWidth
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderColor: '#1976d2',
                            backgroundColor: '#f3f8ff',
                            '&:hover': {
                              borderColor: '#1565c0',
                              backgroundColor: '#e3f2fd'
                            },
                            '&.Mui-focused': {
                              borderColor: '#1976d2',
                              backgroundColor: '#e3f2fd'
                            }
                          }
                        }}
                      />
                    </Box>

                    {/* Row 3: Labour Price - Labour Note - Labour Quantity */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 2 }}>
                      <TextField
                        label="Labour Price"
                        type="number"
                        value={group.labourPrice || ''}
                        onChange={(e) => updateFurnitureGroup(index, 'labourPrice', e.target.value)}
                        size="small"
                        fullWidth
                      />
                      <TextField
                        label="Labour Note"
                        value={group.labourNote || ''}
                        onChange={(e) => updateFurnitureGroup(index, 'labourNote', e.target.value)}
                        size="small"
                        fullWidth
                      />
                      <TextField
                        label="Labour Quantity"
                        value={group.labourQnty || ''}
                        onChange={(e) => updateFurnitureGroup(index, 'labourQnty', e.target.value)}
                        size="small"
                        fullWidth
                      />
                    </Box>

                    {/* Foam Toggle */}
                    <Box sx={{ mb: 2, backgroundColor: '#f8f9fa', borderRadius: 1, border: '1px solid #e0e0e0' }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={group.foamEnabled || false}
                            onChange={(e) => updateFurnitureGroup(index, 'foamEnabled', e.target.checked)}
                            color="primary"
                          />
                        }
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#274290' }}>
                              🪣 Enable Foam
                            </Typography>
                            {group.foamEnabled && (
                              <Chip 
                                label="Enabled" 
                                size="small" 
                                color="success" 
                                sx={{ ml: 1 }}
                              />
                            )}
                          </Box>
                        }
                      />
                    </Box>
                    
                    {group.foamEnabled && (
                      <>
                        {/* Row 4: Foam Price - Foam JL Price - Foam Thickness - Foam Note - Foam Quantity */}
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 2, mb: 2 }}>
                          <TextField
                            label="Foam Price"
                            type="number"
                            value={group.foamPrice || ''}
                            onChange={(e) => updateFurnitureGroup(index, 'foamPrice', e.target.value)}
                            size="small"
                            fullWidth
                          />
                          <TextField
                            label="Foam JL Price"
                            type="number"
                            value={group.foamJLPrice || ''}
                            onChange={(e) => updateFurnitureGroup(index, 'foamJLPrice', e.target.value)}
                            size="small"
                            fullWidth
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                borderColor: '#1976d2',
                                backgroundColor: '#f3f8ff',
                                '&:hover': {
                                  borderColor: '#1565c0',
                                  backgroundColor: '#e3f2fd'
                                },
                                '&.Mui-focused': {
                                  borderColor: '#1976d2',
                                  backgroundColor: '#e3f2fd'
                                }
                              }
                            }}
                          />
                          <TextField
                            label="Foam Thickness"
                            value={group.foamThickness || ''}
                            onChange={(e) => updateFurnitureGroup(index, 'foamThickness', e.target.value)}
                            size="small"
                            fullWidth
                          />
                          <TextField
                            label="Foam Note"
                            value={group.foamNote || ''}
                            onChange={(e) => updateFurnitureGroup(index, 'foamNote', e.target.value)}
                            size="small"
                            fullWidth
                          />
                          <TextField
                            label="Foam Quantity"
                            value={group.foamQnty || ''}
                            onChange={(e) => updateFurnitureGroup(index, 'foamQnty', e.target.value)}
                            size="small"
                            fullWidth
                          />
                        </Box>
                      </>
                    )}
                    
                    {group.customerNote && (
                      <Box sx={{ mb: 2 }}>
                        <TextField
                          label="Customer Note"
                          multiline
                          rows={2}
                          value={group.customerNote || ''}
                          onChange={(e) => updateFurnitureGroup(index, 'customerNote', e.target.value)}
                          fullWidth
                          sx={{ width: '100%' }}
                        />
                      </Box>
                    )}
                  </Card>
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No furniture items added
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditFurnitureDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveFurnitureGroup} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog 
        open={paymentDialog} 
        onClose={handleClosePaymentDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#1a1a1a',
            color: '#ffffff',
            borderRadius: 2,
            border: '2px solid #333333'
          }
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #f27921 0%, #e67e22 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderBottom: '2px solid #333333',
          fontWeight: 'bold'
        }}>
          <PaymentIcon />
          Payment Details
        </DialogTitle>
        <DialogContent sx={{ pt: 3, backgroundColor: '#1a1a1a' }}>
          {selectedOrder && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Invoice Information (Read-only) */}
              <Box sx={{ 
                backgroundColor: '#2a2a2a', 
                p: 3, 
                borderRadius: 2,
                border: '2px solid #333333',
                boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
              }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#b98f33' }}>
                  Invoice Information
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 3 }}>
                  <Box>
                    <Typography variant="body2" sx={{ color: '#b98f33', fontWeight: 600, mb: 1 }}>Invoice Number</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: '#ffffff' }}>
                      #{selectedOrder.orderDetails?.billInvoice || 'N/A'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ color: '#b98f33', fontWeight: 600, mb: 1 }}>Customer Name</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: '#ffffff' }}>
                      {selectedOrder.personalInfo?.customerName || 'N/A'}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Payment Summary (Read-only) */}
              <Box sx={{ 
                backgroundColor: '#2a2a2a', 
                p: 3, 
                borderRadius: 2,
                border: '2px solid #333333',
                boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
              }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#b98f33' }}>
                  Payment Summary
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
                  <Box>
                    <Typography variant="body2" sx={{ color: '#b98f33', fontWeight: 600, mb: 1 }}>Total Invoice Amount</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#f27921' }}>
                      ${calculateInvoiceTotals(selectedOrder).grandTotal.toFixed(2)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ color: '#b98f33', fontWeight: 600, mb: 1 }}>Amount Paid</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#4caf50' }}>
                      ${selectedOrder.paymentData?.amountPaid || '0.00'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ color: '#b98f33', fontWeight: 600, mb: 1 }}>Remaining Balance</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#ff9800' }}>
                      ${(calculateInvoiceTotals(selectedOrder).grandTotal - (parseFloat(selectedOrder.paymentData?.amountPaid || 0))).toFixed(2)}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* New Payment Form */}
              <Box sx={{ 
                backgroundColor: '#2a2a2a', 
                p: 3, 
                borderRadius: 2,
                border: '2px solid #333333',
                boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
              }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#b98f33' }}>
                  Add New Payment
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <TextField
                    label="Payment Amount"
                    type="number"
                    name="paymentAmount"
                    value={paymentForm.paymentAmount}
                    onChange={handlePaymentInputChange}
                    onFocus={handleAutoSelect}
                    fullWidth
                    required
                    InputProps={{
                      startAdornment: <InputAdornment position="start">$</InputAdornment>,
                    }}
                    sx={{
                      backgroundColor: '#1a1a1a',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderWidth: '2px',
                        borderColor: '#333333',
                        borderRadius: 2,
                      },
                      '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#b98f33',
                      },
                      '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#b98f33',
                        borderWidth: '2px',
                      },
                      '& .MuiInputLabel-root': {
                        color: '#b98f33',
                      },
                      '& .MuiInputBase-input': {
                        color: '#ffffff',
                      },
                    }}
                  />
                  <TextField
                    label="Payment Date"
                    type="date"
                    name="paymentDate"
                    value={paymentForm.paymentDate}
                    onChange={handlePaymentInputChange}
                    onFocus={handleAutoSelect}
                    fullWidth
                    required
                    InputLabelProps={{
                      shrink: true,
                    }}
                    sx={{
                      backgroundColor: '#1a1a1a',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderWidth: '2px',
                        borderColor: '#333333',
                        borderRadius: 2,
                      },
                      '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#b98f33',
                      },
                      '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#b98f33',
                        borderWidth: '2px',
                      },
                      '& .MuiInputLabel-root': {
                        color: '#b98f33',
                      },
                      '& .MuiInputBase-input': {
                        color: '#ffffff',
                      },
                    }}
                  />
                  <TextField
                    label="Payment Notes (Optional)"
                    name="paymentNotes"
                    value={paymentForm.paymentNotes}
                    onChange={handlePaymentInputChange}
                    onFocus={handleAutoSelect}
                    fullWidth
                    multiline
                    rows={2}
                    placeholder="Enter any notes about this payment..."
                    sx={{
                      backgroundColor: '#1a1a1a',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderWidth: '2px',
                        borderColor: '#333333',
                        borderRadius: 2,
                      },
                      '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#b98f33',
                      },
                      '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#b98f33',
                        borderWidth: '2px',
                      },
                      '& .MuiInputLabel-root': {
                        color: '#b98f33',
                      },
                      '& .MuiInputBase-input': {
                        color: '#ffffff',
                      },
                    }}
                  />
                </Box>
              </Box>

              {/* Payment History */}
              {selectedOrder.paymentData?.payments && selectedOrder.paymentData.payments.length > 0 && (
                <Box sx={{ 
                  backgroundColor: '#2a2a2a', 
                  p: 3, 
                  borderRadius: 2,
                  border: '2px solid #333333',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
                }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#b98f33' }}>
                    Payment History
                  </Typography>
                  <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                    {selectedOrder.paymentData.payments.map((payment, index) => (
                      <Box key={index} sx={{ 
                        p: 2, 
                        mb: 1, 
                        backgroundColor: '#1a1a1a', 
                        borderRadius: 1,
                        border: '1px solid #333333'
                      }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#ffffff' }}>
                            ${payment.amount.toFixed(2)}
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#b98f33' }}>
                            {(() => {
                              try {
                                if (payment.date?.toDate) {
                                  return payment.date.toDate().toLocaleDateString();
                                } else if (payment.date?.seconds) {
                                  return new Date(payment.date.seconds * 1000).toLocaleDateString();
                                } else if (payment.date) {
                                  return new Date(payment.date).toLocaleDateString();
                                }
                                return '-';
                              } catch (error) {
                                console.error('Error formatting payment date:', error);
                                return '-';
                              }
                            })()}
                          </Typography>
                        </Box>
                        {payment.notes && (
                          <Typography variant="body2" sx={{ color: '#b98f33', mt: 0.5, fontStyle: 'italic' }}>
                            {payment.notes}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 2, backgroundColor: '#1a1a1a', borderTop: '2px solid #333333' }}>
          <Button onClick={handleClosePaymentDialog} sx={buttonStyles.cancelButton}>
            Cancel
          </Button>
          <Button 
            onClick={handleAddNewPayment} 
            variant="contained"
            disabled={!paymentForm.paymentAmount || parseFloat(paymentForm.paymentAmount) <= 0}
            sx={buttonStyles.primaryButton}
          >
            Save Payment
          </Button>
        </DialogActions>
      </Dialog>

      {/* Simple Dropdown Status Dialog */}
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
          gap: 2,
          fontWeight: 'bold'
        }}>
          <AssignmentIcon />
          Update Invoice Status
        </DialogTitle>

        <DialogContent sx={{ p: 3, backgroundColor: '#3a3a3a' }}>
          {/* Current Status Display */}
          <Box sx={{ mb: 3, p: 2, backgroundColor: '#2a2a2a', borderRadius: 1, border: '1px solid #333333' }}>
            <Typography variant="subtitle2" sx={{ color: '#b98f33', mb: 1, fontWeight: 'bold' }}>
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
              <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#ffffff' }}>
                {getStatusInfo(editingStatus)?.label || editingStatus || 'Unknown Status'}
              </Typography>
            </Box>
          </Box>

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
            onClick={() => setStatusDialogOpen(false)}
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
            onClick={() => updateInvoiceStatus(selectedOrder.id, editingStatus)}
            variant="contained"
            disabled={!editingStatus}
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
            Update Status
          </Button>
        </DialogActions>
      </Dialog>

      {/* Enhanced Validation Dialog (from Finance page) */}
      <Dialog 
        open={validationDialogOpen} 
        onClose={() => setValidationDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            zIndex: 9999
          },
          '& .MuiBackdrop-root': {
            zIndex: 9998
          }
        }}
      >
        <DialogTitle>Payment Validation Required</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 3 }}>
            {validationError.message}
          </Typography>
          
          {validationError.type === 'done' && (
            <Button 
              variant="contained" 
              color="success"
              onClick={handleMakeFullyPaid}
              fullWidth
              sx={{ mb: 2 }}
              startIcon={<CheckCircleIcon />}
            >
              Make ${validationError.pendingAmount.toFixed(2)} as Paid
            </Button>
          )}
          
          {validationError.type === 'cancelled' && (
            <Button 
              variant="contained" 
              color="error"
              onClick={handleSetPaymentToZero}
              fullWidth
              sx={{ mb: 2 }}
              startIcon={<CancelIcon />}
            >
              Refund ${validationError.currentAmount.toFixed(2)} and Cancel
            </Button>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setValidationDialogOpen(false)}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Enhanced Allocation Dialog */}
      <Dialog 
        open={allocationDialogOpen && !validationDialogOpen && !confirmDialogOpen && !allocationDialogHidden} 
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
          background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 2
        }}>
          <AssignmentIcon />
          Order Completion & Financial Allocation
        </DialogTitle>
        
        <DialogContent sx={{ p: 3 }}>
          {/* Order Summary */}
          {selectedOrderForAllocation && (
            <Box sx={{ mb: 3, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>Order Summary</Typography>
              <Typography variant="body2">
                <strong>Order #:</strong> {selectedOrderForAllocation.orderDetails?.billInvoice}
              </Typography>
              <Typography variant="body2">
                <strong>Customer:</strong> {selectedOrderForAllocation.personalInfo?.customerName}
              </Typography>
              <Typography variant="body2">
                <strong>Total Revenue:</strong> ${totalRevenue.toFixed(2)}
              </Typography>
              <Typography variant="body2">
                <strong>Total Cost:</strong> ${totalCost.toFixed(2)}
              </Typography>
              <Typography variant="body2">
                <strong>Total Profit:</strong> ${(totalRevenue - totalCost).toFixed(2)}
              </Typography>
            </Box>
          )}

          {/* Editable Dates */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Order Dates</Typography>
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
                />
              </Grid>
              <Grid item xs={2}>
                <Button
                  variant="contained"
                  onClick={handleSaveDates}
                  fullWidth
                  sx={{ 
                    height: '56px',
                    backgroundColor: '#2e7d32',
                    '&:hover': { backgroundColor: '#1b5e20' }
                  }}
                >
                  Save & Confirm
                </Button>
              </Grid>
            </Grid>
            <Typography variant="body2" sx={{ mt: 1, color: '#666', fontStyle: 'italic' }}>
              Click "Save & Confirm" to update the allocation table with months between your selected dates
            </Typography>
          </Box>

          {/* Financial Allocation Table */}
          {showAllocationTable && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Monthly Financial Allocation</Typography>
              <Typography variant="body2" sx={{ mb: 2, color: '#666' }}>
                Distribute the order's revenue and costs across the months between your selected dates. Total percentage must equal 100%.
              </Typography>
            
            <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Month</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Percentage (%)</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Revenue ($)</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Cost ($)</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Profit ($)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {monthlyAllocations.map((allocation, index) => {
                    const revenue = (totalRevenue * allocation.percentage / 100);
                    const cost = (totalCost * allocation.percentage / 100);
                    const profit = revenue - cost;
                    
                    return (
                      <TableRow key={index}>
                        <TableCell>{allocation.label}</TableCell>
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
                        <TableCell sx={{ fontWeight: 'bold', color: '#2e7d32' }}>
                          ${revenue.toFixed(2)}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: '#d32f2f' }}>
                          ${cost.toFixed(2)}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: profit >= 0 ? '#2e7d32' : '#d32f2f' }}>
                          ${profit.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {/* Totals Row */}
                  <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>TOTAL</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>
                      {calculateTotals(monthlyAllocations).totalPercentage.toFixed(1)}%
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#2e7d32' }}>
                      ${calculateTotals(monthlyAllocations).totalRevenue.toFixed(2)}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#d32f2f' }}>
                      ${calculateTotals(monthlyAllocations).totalCost.toFixed(2)}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#2e7d32' }}>
                      ${calculateTotals(monthlyAllocations).totalProfit.toFixed(2)}
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
              <Box sx={{ mt: 3, p: 2, backgroundColor: '#e8f5e8', borderRadius: 1, border: '1px solid #4caf50' }}>
                <Typography variant="h6" sx={{ mb: 1, color: '#2e7d32' }}>Allocation Summary</Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Order:</strong> {selectedOrderForAllocation?.orderDetails?.billInvoice || selectedOrderForAllocation?.id}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Date Range:</strong> {(() => {
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
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Total Revenue:</strong> {formatCurrency(totalRevenue)}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Total Cost:</strong> {formatCurrency(totalCost)}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Total Profit:</strong> {formatCurrency(totalRevenue - totalCost)}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Allocation Breakdown:</strong>
                </Typography>
                <Box sx={{ ml: 2 }}>
                  {monthlyAllocations.map((allocation, index) => (
                    <Typography key={index} variant="body2" sx={{ fontSize: '0.875rem' }}>
                      • {allocation.label}: {allocation.percentage.toFixed(1)}% ({formatCurrency(totalRevenue * allocation.percentage / 100)})
                    </Typography>
                  ))}
                </Box>
                <Typography variant="body2" sx={{ mt: 1, fontSize: '0.75rem', color: '#666', fontStyle: 'italic' }}>
                  Last recalculated: {new Date().toLocaleString()}
                </Typography>
              </Box>
            )}
          </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={() => setAllocationDialogOpen(false)}
            variant="outlined"
            size="small"
          >
            Cancel
          </Button>
          <Button 
            onClick={applyAllocation}
            variant="contained"
            disabled={Math.abs(calculateTotals(monthlyAllocations).totalPercentage - 100) > 0.01}
            size="small"
            sx={{ 
              backgroundColor: '#f27921',
              '&:hover': { backgroundColor: '#e66a1a' }
            }}
          >
            {(() => {
              const status = getAllocationStatus();
              if (status.status === 'valid') {
                return 'Complete Order & Apply Allocation';
              } else if (status.status === 'over') {
                return 'Total Exceeds 100% - Cannot Apply';
              } else {
                return `${Math.abs(100 - calculateTotals(monthlyAllocations).totalPercentage).toFixed(1)}% Remaining`;
              }
            })()}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Enhanced Confirmation Dialog */}
      <Dialog 
        open={enhancedConfirmDialog.open} 
        onClose={handleEnhancedCancel}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#3a3a3a',
            border: '2px solid #b98f33',
            borderRadius: '10px',
            color: '#ffffff'
          }
        }}
      >
        <DialogTitle sx={{ 
          color: '#b98f33', 
          borderBottom: '1px solid #b98f33',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <span style={{ fontSize: '24px' }}>✨</span>
          {enhancedConfirmDialog.title}
        </DialogTitle>
        
        <DialogContent sx={{ mt: 2 }}>
          {/* Order and Customer Info in Big Font */}
          <Box sx={{ 
            p: 3, 
            backgroundColor: '#2a2a2a', 
            borderRadius: 1, 
            borderLeft: '4px solid #b98f33',
            mb: 3,
            textAlign: 'center'
          }}>
            <Typography variant="h4" sx={{ 
              color: '#b98f33', 
              mb: 2, 
              fontWeight: 'bold',
              fontSize: '2rem'
            }}>
              Order: {selectedOrderForAllocation?.orderDetails?.billInvoice || selectedOrderForAllocation?.id || 'N/A'}
            </Typography>
            <Typography variant="h4" sx={{ 
              color: '#ffffff', 
              fontWeight: 'bold',
              fontSize: '2rem'
            }}>
              Customer: {selectedOrderForAllocation?.personalInfo?.customerName || 'N/A'}
            </Typography>
          </Box>

          {enhancedConfirmDialog.hasEmail ? (
            <Box sx={{ 
              p: 2, 
              backgroundColor: '#2a2a2a', 
              borderRadius: 1, 
              borderLeft: '4px solid #b98f33',
              mb: 2
            }}>
              <Typography variant="h6" sx={{ color: '#b98f33', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                📧 Email Notification
              </Typography>
              
              <FormControlLabel
                control={
                  <Checkbox
                    checked={sendEmailChecked}
                    onChange={(e) => setSendEmailChecked(e.target.checked)}
                    sx={{
                      color: '#b98f33',
                      '&.Mui-checked': {
                        color: '#b98f33',
                      },
                    }}
                  />
                }
                label="Send completion email to customer"
                sx={{ 
                  color: '#ffffff',
                  mb: 1,
                  '& .MuiFormControlLabel-label': {
                    fontWeight: 500
                  }
                }}
              />
              
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeReviewChecked}
                    onChange={(e) => setIncludeReviewChecked(e.target.checked)}
                    sx={{
                      color: '#b98f33',
                      '&.Mui-checked': {
                        color: '#b98f33',
                      },
                    }}
                  />
                }
                label="Include Google review request"
                sx={{ 
                  color: '#ffffff',
                  '& .MuiFormControlLabel-label': {
                    fontWeight: 500
                  }
                }}
              />
              
              <Typography variant="body2" sx={{ 
                mt: 1, 
                color: '#cccccc', 
                fontStyle: 'italic',
                fontSize: '13px'
              }}>
                The email will include a warm thank you message, treatment care instructions, and a review request.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ 
              p: 2, 
              backgroundColor: '#2a2a2a', 
              borderRadius: 1, 
              borderLeft: '4px solid #f27921',
              mb: 2
            }}>
              <Typography variant="h6" sx={{ color: '#f27921', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                ⚠️ No Email Available
              </Typography>
              <Typography variant="body2" sx={{ color: '#cccccc' }}>
                Customer email not found. Order will be completed without email notification.
              </Typography>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={handleEnhancedCancel}
            variant="outlined"
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
            onClick={() => handleEnhancedConfirm(sendEmailChecked, includeReviewChecked)}
            variant="contained"
            sx={{
              background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
              color: '#000000',
              border: '2px solid #8b6b1f',
              fontWeight: 'bold',
              '&:hover': {
                background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
              },
            }}
          >
            Complete Order
          </Button>
        </DialogActions>
      </Dialog>

      {/* Completion Email Dialog */}
      <Dialog
        open={completionEmailDialog.open}
        onClose={handleCompletionEmailCancel}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#3a3a3a',
            borderRadius: 2,
            border: '2px solid #b98f33',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
          }
        }}
      >
        <DialogTitle sx={{ 
          backgroundColor: '#2a2a2a', 
          color: '#ffffff',
          borderBottom: '2px solid #b98f33',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <span style={{ fontSize: '24px' }}>📧</span>
          Send Completion Email
        </DialogTitle>
        
        <DialogContent sx={{ mt: 2 }}>
          {/* Order and Customer Info in Big Font */}
          <Box sx={{ 
            p: 3, 
            backgroundColor: '#2a2a2a', 
            borderRadius: 1, 
            borderLeft: '4px solid #b98f33',
            mb: 3,
            textAlign: 'center'
          }}>
            <Typography variant="h4" sx={{ 
              color: '#b98f33', 
              mb: 2, 
              fontWeight: 'bold',
              fontSize: '2rem'
            }}>
              Order: {selectedOrder?.orderDetails?.billInvoice || selectedOrder?.id || 'N/A'}
            </Typography>
            <Typography variant="h4" sx={{ 
              color: '#ffffff', 
              fontWeight: 'bold',
              fontSize: '2rem'
            }}>
              Customer: {selectedOrder?.personalInfo?.customerName || 'N/A'}
            </Typography>
          </Box>

          {/* Email Options */}
          <Box sx={{ 
            p: 2, 
            backgroundColor: '#2a2a2a', 
            borderRadius: 1, 
            borderLeft: '4px solid #b98f33',
            mb: 2
          }}>
            <Typography variant="h6" sx={{ color: '#b98f33', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              📧 Email Options
            </Typography>
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={completionEmailDialog.sendEmail}
                  onChange={(e) => setCompletionEmailDialog(prev => ({ ...prev, sendEmail: e.target.checked }))}
                  sx={{
                    color: '#b98f33',
                    '&.Mui-checked': {
                      color: '#b98f33',
                    },
                  }}
                />
              }
              label="Send completion email to customer"
              sx={{ 
                color: '#ffffff',
                mb: 1,
                '& .MuiFormControlLabel-label': {
                  fontWeight: 500
                }
              }}
            />
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={completionEmailDialog.includeReview}
                  onChange={(e) => setCompletionEmailDialog(prev => ({ ...prev, includeReview: e.target.checked }))}
                  sx={{
                    color: '#b98f33',
                    '&.Mui-checked': {
                      color: '#b98f33',
                    },
                  }}
                />
              }
              label="Include Google review request"
              sx={{ 
                color: '#ffffff',
                '& .MuiFormControlLabel-label': {
                  fontWeight: 500
                }
              }}
            />
            
            <Typography variant="body2" sx={{ 
              mt: 1, 
              color: '#cccccc', 
              fontStyle: 'italic',
              fontSize: '13px'
            }}>
              The email will include a warm thank you message, treatment care instructions, and a review request.
            </Typography>
          </Box>
        </DialogContent>
        
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={handleCompletionEmailCancel}
            variant="outlined"
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
            onClick={handleCompletionEmailConfirm}
            disabled={!completionEmailDialog.sendEmail}
            variant="contained"
            sx={{
              background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
              color: '#000000',
              border: '2px solid #8b6b1f',
              fontWeight: 'bold',
              '&:hover': {
                background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
              },
            }}
          >
            Send Email
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </>
  );
};

export default WorkshopPage;
