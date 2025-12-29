import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Menu,
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
  Note as NoteIcon,
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
  ArrowDropDown as ArrowDropDownIcon,
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  BarChart as BarChartIcon,
  RestartAlt as RestartAltIcon,
  Inventory as InventoryIcon,
  AccessTime as AccessTimeIcon,
  Business as BusinessIcon
} from '@mui/icons-material';
import { useNotification } from '../../shared/components/Common/NotificationSystem';
import { sendEmailWithConfig, sendDepositEmailWithConfig, sendCompletionEmailWithGmail, ensureGmailAuthorized } from '../../services/emailService';

import useMaterialCompanies from '../../hooks/useMaterialCompanies';
import { usePlatforms } from '../../hooks/usePlatforms';
import { useTreatments } from '../../hooks/useTreatments';
import { collection, getDocs, updateDoc, doc, query, orderBy, where, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { calculateOrderTotal, calculateOrderCost, calculateOrderProfit, calculateOrderTax, calculatePickupDeliveryCost, normalizePaymentData, validatePaymentData, getOrderCostBreakdown } from '../../utils/orderCalculations';
import { fetchMaterialCompanyTaxRates } from '../../utils/materialTaxRates';
import { calculateTimeBasedAllocation, formatCurrency, formatPercentage } from '../../utils/plCalculations';
import { createAllocation, normalizeAllocation } from '../../shared/utils/allocationUtils';
import { useAutoSelect } from '../../hooks/useAutoSelect';
import { useNavigate } from 'react-router-dom';
import { buttonStyles } from '../../styles/buttonStyles';
import { formatDate, formatDateOnly, formatDateRange } from '../../utils/dateUtils';

const WorkshopPage = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const listContainerRef = useRef(null);
  const selectedOrderIdRef = useRef(null);
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
  const [editAdditionalNotesDialog, setEditAdditionalNotesDialog] = useState(false);
  const [editAdditionalNotesData, setEditAdditionalNotesData] = useState({});
  
  // Auto-save and unsaved changes tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [autoSaveTimeout, setAutoSaveTimeout] = useState(null);
  const [lastSavedData, setLastSavedData] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [orderFilter, setOrderFilter] = useState('all'); // 'all', 'individual', 'corporate'
  const [sendingEmail, setSendingEmail] = useState(false);
  const [processingDeposit, setProcessingDeposit] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    paymentAmount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentNotes: ''
  });
  
  // Extra Expense Modal State
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    description: '',
    price: '',
    unit: '',
    tax: '',
    taxType: 'fixed', // 'fixed' or 'percent'
    total: '',
  });
  const [expenseList, setExpenseList] = useState([]);
  
  // Edit Expense Modal State
  const [editExpenseModalOpen, setEditExpenseModalOpen] = useState(false);
  const [editingExpenseIndex, setEditingExpenseIndex] = useState(null);
  const [editExpenseForm, setEditExpenseForm] = useState({
    description: '',
    price: '',
    unit: '',
    tax: '',
    taxType: 'fixed',
    total: '',
  });
  
  // Delete Expense Confirmation State
  const [deleteExpenseDialogOpen, setDeleteExpenseDialogOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  
  // State for collapsible sections
  const [personalInfoExpanded, setPersonalInfoExpanded] = useState(false);
  const [orderDetailsExpanded, setOrderDetailsExpanded] = useState(false);
  
  // State for status functionality
  const [invoiceStatuses, setInvoiceStatuses] = useState([]);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState(null);
  
  // State for invoices menu
  const [invoicesMenuAnchor, setInvoicesMenuAnchor] = useState(null);
  const invoicesMenuOpen = Boolean(invoicesMenuAnchor);
  
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
  
  // Pending dialog state
  const [pendingDialogOpen, setPendingDialogOpen] = useState(false);
  const [selectedOrderForPending, setSelectedOrderForPending] = useState(null);
  const [pendingForm, setPendingForm] = useState({
    expectedResumeDate: '',
    pendingNotes: ''
  });
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [monthlyAllocations, setMonthlyAllocations] = useState([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [showAllocationTable, setShowAllocationTable] = useState(false);
  
  // Standalone allocation state variables
  const [standaloneAllocationDialogOpen, setStandaloneAllocationDialogOpen] = useState(false);
  const [standaloneAllocationDialogHidden, setStandaloneAllocationDialogHidden] = useState(false);
  const [selectedOrderForStandaloneAllocation, setSelectedOrderForStandaloneAllocation] = useState(null);
  const [standaloneStartDate, setStandaloneStartDate] = useState(null);
  const [standaloneEndDate, setStandaloneEndDate] = useState(null);
  const [standaloneMonthlyAllocations, setStandaloneMonthlyAllocations] = useState([]);
  const [standaloneTotalRevenue, setStandaloneTotalRevenue] = useState(0);
  const [standaloneTotalCost, setStandaloneTotalCost] = useState(0);
  const [standaloneShowAllocationTable, setStandaloneShowAllocationTable] = useState(false);
  
  // Email completion state variables
  const [includeReviewRequest, setIncludeReviewRequest] = useState(true);
  const [sendingCompletionEmail, setSendingCompletionEmail] = useState(false);
  
  const { showError, showSuccess, showConfirm, confirmDialogOpen } = useNotification();

  const { companies: materialCompanies, loading: companiesLoading } = useMaterialCompanies();
  const { platforms, loading: platformsLoading } = usePlatforms();
  const { treatments, loading: treatmentsLoading } = useTreatments();
  const { onFocus: handleAutoSelect } = useAutoSelect();
  const [materialTaxRates, setMaterialTaxRates] = useState({});

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
    
    // Convert to 1-indexed months (1-12) for new allocation format
    const startMonth1Indexed = startMonth + 1;
    const endMonth1Indexed = endMonth + 1;
    
    if (startMonth === endMonth && startYear === endYear) {
      return [{ month: startMonth1Indexed, year: startYear, percentage: 100 }];
    }
    
    const allocations = [];
    let currentDate = new Date(start);
    
    while (currentDate <= end) {
      const monthIndex = currentDate.getMonth(); // 0-indexed
      const month = monthIndex + 1; // Convert to 1-indexed (1-12)
      const year = currentDate.getFullYear();
      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
      const daysInOrder = Math.min(
        daysInMonth - currentDate.getDate() + 1,
        end.getDate() - currentDate.getDate() + 1
      );
      
      const percentage = (daysInOrder / totalDays) * 100;
      allocations.push({ month: month, year: year, percentage: percentage });
      
      currentDate = new Date(year, monthIndex + 1, 1);
    }
    
    return allocations;
  };

  // Generate months between start and end dates
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

  // Generate 5-month allocation table (current ± 2 months) - fallback
  const generateMonthlyAllocations = (order) => {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth(); // 0-indexed (0-11)
    const currentYear = currentDate.getFullYear();
    
    const months = [];
    for (let i = -2; i <= 2; i++) {
      const monthIndex = (currentMonth + i + 12) % 12; // 0-indexed
      const year = currentYear + Math.floor((currentMonth + i) / 12);
      const month = monthIndex + 1; // Convert to 1-indexed (1-12)
      
      months.push({
        month: month, // 1-indexed (1-12)
        year: year,
        label: new Date(year, monthIndex).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
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
      console.log(`Percentage capped to ${newPercentage.toFixed(1)}% to prevent exceeding 100%`);
    }
    
    newAllocations[index].percentage = newPercentage;
    setMonthlyAllocations(newAllocations);
    
    // Calculate and show totals
    const totals = calculateTotals(newAllocations);
    const remainingPercentage = 100 - totals.totalPercentage;
    
    // Show warning if total is not 100%
    if (Math.abs(remainingPercentage) > 0.01) {
      // Allocation updated
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
      // Determine collection name based on order type
      const isCorporateOrder = selectedOrderForAllocation.orderType === 'corporate';
      const targetCollection = isCorporateOrder ? 'corporate-orders' : 'orders';
      
      // Update order dates in database
      const orderRef = doc(db, targetCollection, selectedOrderForAllocation.id);
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

  const getOrderCollectionName = (order) => {
    return order?.orderType === 'corporate' ? 'corporate-orders' : 'orders';
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

  // Standalone allocation functions
  const calculateStandaloneTotals = (allocations) => {
    const totalPercentage = allocations.reduce((sum, item) => sum + item.percentage, 0);
    const calculatedRevenue = allocations.reduce((sum, item) => sum + (standaloneTotalRevenue * item.percentage / 100), 0);
    const calculatedCost = allocations.reduce((sum, item) => sum + (standaloneTotalCost * item.percentage / 100), 0);
    const calculatedProfit = calculatedRevenue - calculatedCost;
    
    return { totalPercentage, totalRevenue: calculatedRevenue, totalCost: calculatedCost, totalProfit: calculatedProfit };
  };

  const getStandaloneAllocationStatus = () => {
    const totals = calculateStandaloneTotals(standaloneMonthlyAllocations);
    const remainingPercentage = 100 - totals.totalPercentage;
    
    if (Math.abs(remainingPercentage) <= 0.01) {
      return { status: 'valid', message: 'Allocation is complete and ready to apply', color: '#4caf50' };
    } else if (totals.totalPercentage > 100) {
      return { status: 'over', message: `Total exceeds 100% by ${Math.abs(remainingPercentage).toFixed(1)}%`, color: '#f44336' };
    } else {
      return { status: 'under', message: `${Math.abs(remainingPercentage).toFixed(1)}% remaining to reach 100%`, color: '#ff9800' };
    }
  };

  const handleStandaloneAllocationDialog = (order) => {
    setSelectedOrderForStandaloneAllocation(order);
    setStandaloneAllocationDialogOpen(true);
    setStandaloneShowAllocationTable(false);
    
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
      setStandaloneStartDate(start);
    } else {
      setStandaloneStartDate(new Date()); // Default to today
    }
    
    if (end && !isNaN(end.getTime())) {
      setStandaloneEndDate(end);
    } else {
      setStandaloneEndDate(new Date()); // Default to today
    }

    // Check if order already has allocation data
    if (order.allocation && order.allocation.allocations) {
      // Use existing allocation data - only extract needed properties to avoid Timestamp objects
      setStandaloneMonthlyAllocations(order.allocation.allocations.map(allocation => ({
        month: allocation.month,
        year: allocation.year,
        label: new Date(allocation.year, allocation.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        percentage: allocation.percentage
        // Explicitly exclude calculatedAt, appliedAt, and other Timestamp properties
      })));
      setStandaloneShowAllocationTable(true);
    } else {
      // Generate initial allocations
      const initialAllocations = generateMonthlyAllocations(order);
      setStandaloneMonthlyAllocations(initialAllocations);
    }

    const profitData = calculateOrderProfit(order);
    const revenue = profitData.revenue;
    const cost = profitData.cost;
    
    setStandaloneTotalRevenue(revenue);
    setStandaloneTotalCost(cost);
  };

  const updateStandaloneAllocationPercentage = (index, percentage) => {
    const newAllocations = [...standaloneMonthlyAllocations];
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
      console.log(`Percentage capped to ${newPercentage.toFixed(1)}% to prevent exceeding 100%`);
    }
    
    newAllocations[index].percentage = newPercentage;
    setStandaloneMonthlyAllocations(newAllocations);
    
    // Calculate and show totals
    const totals = calculateStandaloneTotals(newAllocations);
    const remainingPercentage = 100 - totals.totalPercentage;
    
    // Show warning if total is not 100%
    if (Math.abs(remainingPercentage) > 0.01) {
      // Standalone allocation updated
    }
  };

  const handleStandaloneSaveDates = async () => {
    if (!standaloneStartDate || !standaloneEndDate || isNaN(standaloneStartDate.getTime()) || isNaN(standaloneEndDate.getTime())) {
      showError('Please enter valid start and end dates');
      return;
    }

    if (standaloneStartDate > standaloneEndDate) {
      showError('Start date cannot be after end date');
      return;
    }

    if (!selectedOrderForStandaloneAllocation) {
      showError('No order selected for allocation');
      return;
    }

    // Generate new allocations based on date range
    const newAllocations = generateMonthsBetweenDates(standaloneStartDate, standaloneEndDate);
    
    if (newAllocations.length === 0) {
      showError('No valid months found between the selected dates');
      return;
    }

    try {
      // Update order dates in database
      const orderRef = doc(db, getOrderCollectionName(selectedOrderForStandaloneAllocation), selectedOrderForStandaloneAllocation.id);
      await updateDoc(orderRef, {
        'orderDetails.startDate': standaloneStartDate,
        'orderDetails.endDate': standaloneEndDate,
        'orderDetails.lastUpdated': new Date()
      });

      // Update local state
      setSelectedOrderForStandaloneAllocation(prev => ({
        ...prev,
        orderDetails: {
          ...prev.orderDetails,
          startDate: standaloneStartDate,
          endDate: standaloneEndDate,
          lastUpdated: new Date()
        }
      }));

      setStandaloneMonthlyAllocations(newAllocations);
      setStandaloneShowAllocationTable(true);
      showSuccess('Dates saved! Table updated with relevant months.');
    } catch (error) {
      console.error('Error saving dates:', error);
      showError('Failed to save dates to database');
    }
  };

  const resetStandaloneAllocationToDefault = () => {
    if (!selectedOrderForStandaloneAllocation) return;
    
    const initialAllocations = generateMonthlyAllocations(selectedOrderForStandaloneAllocation);
    setStandaloneMonthlyAllocations(initialAllocations);
    setStandaloneShowAllocationTable(false);
    showSuccess('Allocation reset to default values');
  };

  const applyStandaloneAllocation = async () => {
    try {
      if (!selectedOrderForStandaloneAllocation) return;
      
      // Validate total percentage equals 100%
      const totals = calculateStandaloneTotals(standaloneMonthlyAllocations);
      if (Math.abs(totals.totalPercentage - 100) > 0.01) {
        showError('Total percentage must equal 100%');
        return;
      }

      // Calculate profit data for allocation
      const profitData = {
        revenue: standaloneTotalRevenue,
        cost: standaloneTotalCost,
        profit: standaloneTotalRevenue - standaloneTotalCost
      };

      // Create allocation using new simplified format
      const allocationData = createAllocation(standaloneMonthlyAllocations, profitData);

      // Prepare update data (only allocation, no status change)
      const updateData = {
        allocation: allocationData
      };

      // Force hide allocation dialog and show confirmation
      setStandaloneAllocationDialogHidden(true);
      setStandaloneAllocationDialogOpen(false); // Also close it completely
      
      // Longer delay to ensure dialog is completely hidden before showing confirmation
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Show confirmation dialog with allocation summary
      const allocationSummary = standaloneMonthlyAllocations.map(allocation => 
        `${allocation.month}/${allocation.year}: ${allocation.percentage.toFixed(1)}%`
      ).join(', ');

      const confirmed = await showConfirm(
        'Confirm Allocation',
        `Are you sure you want to apply this allocation?\n\n` +
        `Order: ${selectedOrderForStandaloneAllocation.orderDetails?.billInvoice || selectedOrderForStandaloneAllocation.id}\n` +
        `Allocations: ${allocationSummary}\n` +
        `Total Revenue: ${formatCurrency(standaloneTotalRevenue)}\n` +
        `Total Cost: ${formatCurrency(standaloneTotalCost)}\n` +
        `Total Profit: ${formatCurrency(standaloneTotalRevenue - standaloneTotalCost)}`
      );

      if (!confirmed) {
        // Reopen allocation dialog if user cancels
        setStandaloneAllocationDialogHidden(false);
        setStandaloneAllocationDialogOpen(true);
        return; // User cancelled
      }
      
      const orderRef = doc(db, getOrderCollectionName(selectedOrderForStandaloneAllocation), selectedOrderForStandaloneAllocation.id);
      await updateDoc(orderRef, updateData);
      
      // Update local state
      const updatedOrder = {
        ...selectedOrderForStandaloneAllocation,
        ...updateData
      };
      
      setOrders(orders.map(order => 
        order.id === selectedOrderForStandaloneAllocation.id ? updatedOrder : order
      ));
      setFilteredOrders(filteredOrders.map(order => 
        order.id === selectedOrderForStandaloneAllocation.id ? updatedOrder : order
      ));
      
      // Update selected order if it's the same
      if (selectedOrder?.id === selectedOrderForStandaloneAllocation.id) {
        setSelectedOrder(updatedOrder);
      }
      
      showSuccess('Allocation applied successfully');
      setStandaloneAllocationDialogOpen(false);
      setStandaloneAllocationDialogHidden(false);
      setSelectedOrderForStandaloneAllocation(null);
    } catch (error) {
      console.error('Error applying standalone allocation:', error);
      showError('Failed to apply allocation');
      setStandaloneAllocationDialogHidden(false);
    }
  };

  const handleAllocationDialog = (order, newStatus) => {
    setSelectedOrderForAllocation({ ...order, newStatus });
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

    // Calculate profit data first (needed for normalization)
    const profitData = calculateOrderProfit(order);
    const revenue = profitData.revenue;
    const cost = profitData.cost;
    
    setTotalRevenue(revenue);
    setTotalCost(cost);
    
    // Check if order already has allocation data
    if (order.allocation && order.allocation.allocations && order.allocation.allocations.length > 0) {
      // Normalize allocation to ensure structure is correct
      const normalizedAllocation = normalizeAllocation(order.allocation, profitData);
      
      if (normalizedAllocation && normalizedAllocation.allocations) {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                            'July', 'August', 'September', 'October', 'November', 'December'];
        
        // Use existing allocation data - load it for confirmation/update
        const existingAllocations = normalizedAllocation.allocations.map(allocation => {
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
        }).filter(alloc => alloc !== null);
        
        setMonthlyAllocations(existingAllocations);
        setShowAllocationTable(true); // Show table immediately since allocation exists
      } else {
        // If normalization failed, generate initial allocations
        const initialAllocations = generateMonthlyAllocations(order);
        setMonthlyAllocations(initialAllocations);
      }
    } else {
      // Generate initial allocations if no existing allocation
      const initialAllocations = generateMonthlyAllocations(order);
      setMonthlyAllocations(initialAllocations);
    }
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

      // Calculate profit data for allocation
      const profitData = {
        revenue: totalRevenue,
        cost: totalCost,
        profit: totalRevenue - totalCost
      };

      // Create allocation using new simplified format
      const allocationData = createAllocation(monthlyAllocations, profitData);

      // Prepare update data
      const updateData = {
        invoiceStatus: selectedOrderForAllocation.newStatus?.value || 'done',
        allocation: allocationData
      };

      // Force hide allocation dialog and show confirmation
      setAllocationDialogHidden(true);
      setAllocationDialogOpen(false); // Also close it completely
      
      // Longer delay to ensure dialog is completely hidden before showing confirmation
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Show enhanced confirmation dialog with email options
      const allocationSummary = monthlyAllocations.map(allocation => 
        `${allocation.month}/${allocation.year}: ${allocation.percentage.toFixed(1)}%`
      ).join(', ');

      // Determine email + collection handling
      const isCorporateOrder = selectedOrderForAllocation.orderType === 'corporate';
      const rawCustomerEmail = isCorporateOrder
        ? (selectedOrderForAllocation.contactPerson?.email || selectedOrderForAllocation.corporateCustomer?.email || '')
        : (selectedOrderForAllocation.personalInfo?.email || '');
      const customerEmail = rawCustomerEmail.trim();
      const hasEmail = !isCorporateOrder && customerEmail !== '';

      const confirmed = await showEnhancedConfirm(
        'Confirm Order Completion & Email',
        '', // Empty message since we display order/customer info directly in dialog
        hasEmail,
        includeReviewRequest
      );

      if (!confirmed || !confirmed.confirmed) {
        // Reopen allocation dialog if user cancels
        setAllocationDialogHidden(false);
        setAllocationDialogOpen(true);
        return; // User cancelled
      }
      
      const targetCollection = isCorporateOrder ? 'corporate-orders' : 'orders';
      const orderRef = doc(db, targetCollection, selectedOrderForAllocation.id);
      await updateDoc(orderRef, updateData);

      // Preserve existing dates from order or use state dates
      const orderStartDate = selectedOrderForAllocation.orderDetails?.startDate || startDate;
      const orderEndDate = selectedOrderForAllocation.orderDetails?.endDate || endDate;
      
      const sanitizedOrderData = {
        ...selectedOrderForAllocation,
        allocation: allocationData,
        orderDetails: {
          ...selectedOrderForAllocation.orderDetails,
          ...updateData.orderDetails,
          startDate: orderStartDate,
          endDate: orderEndDate
        },
        invoiceStatus: updateData.invoiceStatus
      };
      delete sanitizedOrderData.newStatus;
      
      if (isCorporateOrder) {
        const closedAtDate = new Date();

        const doneOrderData = {
          ...sanitizedOrderData,
          orderType: 'corporate',
          source: 'corporate_order',
          closedAt: closedAtDate,
          status: 'done'
        };

        const taxedInvoiceData = {
          ...sanitizedOrderData,
          orderType: 'corporate',
          source: 'corporate_order',
          closedAt: closedAtDate,
          originalInvoiceId: sanitizedOrderData.id
        };

        // Update invoiceStatus in corporate-orders collection (instead of moving to closed-corporate-orders)
        // Find the "done" end state status
        const doneStatuses = invoiceStatuses.filter(status => 
          status.isEndState && status.endStateType === 'done'
        );
        const doneStatus = doneStatuses.length > 0 ? doneStatuses[0].value : null;
        
        const updateStatusData = {
          closedAt: closedAtDate,
          updatedAt: new Date(),
          ...updateData
        };
        
        // Set invoiceStatus to done status if available
        if (doneStatus) {
          updateStatusData.invoiceStatus = doneStatus;
        }
        
        await updateDoc(orderRef, updateStatusData);

        await addDoc(collection(db, 'done-orders'), doneOrderData);
        await addDoc(collection(db, 'taxedInvoices'), taxedInvoiceData);

        const remainingOrders = orders.filter(order => order.id !== selectedOrderForAllocation.id);
        const remainingFilteredOrders = filteredOrders.filter(order => order.id !== selectedOrderForAllocation.id);

        setOrders(remainingOrders);
        setFilteredOrders(remainingFilteredOrders);
        setSelectedOrder(prev => {
          if (!prev || prev.id !== selectedOrderForAllocation.id) {
            return prev;
          }
          return remainingFilteredOrders[0] || remainingOrders[0] || null;
        });

        showSuccess('Corporate order completed, allocated, and closed successfully');
      } else {
        // Send completion email if customer has email and user confirmed
        console.log('🔍 Workshop Debug - Email sending conditions:', {
          hasCustomerEmail: !!customerEmail,
          customerEmail: customerEmail,
          confirmedSendEmail: Boolean(confirmed.sendEmail),
          confirmedIncludeReview: Boolean(confirmed.includeReviewRequest)
        });
        
        if (customerEmail && confirmed.sendEmail) {
          try {
            setSendingCompletionEmail(true);
            
            // Prepare order data for email
            const orderDataForEmail = {
              personalInfo: sanitizedOrderData.personalInfo,
              orderDetails: sanitizedOrderData.orderDetails,
              furnitureData: {
                groups: sanitizedOrderData.furnitureData?.groups || []
              },
              paymentData: sanitizedOrderData.paymentData
            };

            console.log('🔍 Workshop Debug - Order data prepared for email:', {
              hasPersonalInfo: !!orderDataForEmail.personalInfo,
              hasOrderDetails: !!orderDataForEmail.orderDetails,
              hasFurnitureData: !!orderDataForEmail.furnitureData,
              furnitureGroupsCount: orderDataForEmail.furnitureData?.groups?.length || 0
            });

            // Progress callback for email sending
            const onEmailProgress = (message) => {
              console.log('🔍 Workshop Debug - Email progress:', message);
              showSuccess(`📧 ${message}`);
            };

            console.log('🔍 Workshop Debug - Calling sendCompletionEmailWithGmail...');
            
            // Send the completion email
            const emailResult = await sendCompletionEmailWithGmail(
              orderDataForEmail, 
              customerEmail, 
              Boolean(confirmed.includeReviewRequest), 
              onEmailProgress
            );
            
            console.log('🔍 Workshop Debug - Email result:', emailResult);
            
            if (emailResult.success) {
              showSuccess('✅ Completion email sent successfully!');
            } else {
              showError(`❌ Failed to send completion email: ${emailResult.message}`);
            }
          } catch (error) {
            console.error('🔍 Workshop Debug - Error sending completion email:', error);
            showError(`Failed to send completion email: ${error.message}`);
          } finally {
            setSendingCompletionEmail(false);
          }
        } else {
          console.log('🔍 Workshop Debug - Email not sent because:', {
            noCustomerEmail: !customerEmail,
            userDidNotConfirm: !confirmed.sendEmail
          });
        }
        
        showSuccess('Order completed and allocated successfully');
      }
      
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
      
      const order = validationError.order;
      const isCorporate = order.orderType === 'corporate';
      const orderRef = getOrderRef(order);
      const paymentField = isCorporate ? 'paymentDetails' : 'paymentData';
      const currentPaymentData = isCorporate ? order.paymentDetails : order.paymentData;
      const totalAmount = calculateOrderProfit(order).revenue;
      
      await updateDoc(orderRef, {
        [`${paymentField}.amountPaid`]: totalAmount,
        [`${paymentField}.paymentHistory`]: [
          ...(currentPaymentData?.paymentHistory || []),
          {
            amount: validationError.pendingAmount,
            date: new Date(),
            notes: 'Auto-paid to complete order'
          }
        ]
      });
      
      // Update local state with new payment data
      const updatedOrder = {
        ...order,
        [paymentField]: {
          ...currentPaymentData,
          amountPaid: totalAmount,
          paymentHistory: [
            ...(currentPaymentData?.paymentHistory || []),
            {
              amount: validationError.pendingAmount,
              date: new Date(),
              notes: 'Auto-paid to complete order'
            }
          ]
        }
      };
      
      // Update orders list
      setOrders(orders.map(o => o.id === order.id ? updatedOrder : o));
      setFilteredOrders(filteredOrders.map(o => o.id === order.id ? updatedOrder : o));
      if (selectedOrder?.id === order.id) {
        setSelectedOrder(updatedOrder);
      }
      
      // Show allocation dialog for completed order with updated order data
      handleAllocationDialog(updatedOrder, validationError.newStatus);
      setValidationDialogOpen(false);
    } catch (error) {
      console.error('Error making fully paid:', error);
      showError('Failed to update payment');
    }
  };

  const handleSetPaymentToZero = async () => {
    try {
      if (!validationError.order) return;
      
      const order = validationError.order;
      const isCorporate = order.orderType === 'corporate';
      const orderRef = getOrderRef(order);
      const paymentField = isCorporate ? 'paymentDetails' : 'paymentData';
      const currentPaymentData = isCorporate ? order.paymentDetails : order.paymentData;
      
      await updateDoc(orderRef, {
        [`${paymentField}.amountPaid`]: 0,
        [`${paymentField}.paymentHistory`]: [
          ...(currentPaymentData?.paymentHistory || []),
          {
            amount: -validationError.currentAmount,
            date: new Date(),
            notes: 'Refunded to cancel order'
          }
        ]
      });
      
      // Update local state
      const updatedOrder = {
        ...order,
        [paymentField]: {
          ...currentPaymentData,
          amountPaid: 0,
          paymentHistory: [
            ...(currentPaymentData?.paymentHistory || []),
            {
              amount: -validationError.currentAmount,
              date: new Date(),
              notes: 'Refunded to cancel order'
            }
          ]
        }
      };
      
      // Update orders list
      setOrders(orders.map(o => o.id === order.id ? updatedOrder : o));
      setFilteredOrders(filteredOrders.map(o => o.id === order.id ? updatedOrder : o));
      if (selectedOrder?.id === order.id) {
        setSelectedOrder(updatedOrder);
      }
      
      // Update status directly for cancelled orders
      await updateInvoiceStatus(order.id, validationError.newStatus?.value);
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
        // Handle both corporate and regular orders
        const isCorporate = order.orderType === 'corporate';
        const paymentData = isCorporate ? order.paymentDetails : order.paymentData;
        const normalizedPayment = normalizePaymentData(paymentData);
        
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
          // Showing allocation dialog for completed order
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
        } else if (newStatusObj.endStateType === 'pending') {
          // For "pending" - show pending dialog
          setSelectedOrderForPending(order);
          
          // Set default date to same day next month
          const today = new Date();
          const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
          const defaultDate = nextMonth.toISOString().split('T')[0];
          
          setPendingForm({
            expectedResumeDate: defaultDate,
            pendingNotes: ''
          });
          setPendingDialogOpen(true);
          setStatusDialogOpen(false);
          return;
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

  const handlePendingSubmit = async () => {
    // Validate expected date is not in the past
    const expectedDate = new Date(pendingForm.expectedResumeDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day for comparison
    
    if (expectedDate < today) {
      showError('Expected resume date cannot be in the past');
      return;
    }

    if (!pendingForm.expectedResumeDate) {
      showError('Please select an expected resume date');
      return;
    }

    try {
      const order = selectedOrderForPending;
      const orderRef = doc(db, 'orders', order.id);
      
      await updateDoc(orderRef, {
        invoiceStatus: 'pending',
        statusUpdatedAt: new Date(),
        'paymentData.amountPaid': 0,
        pendingAt: new Date(),
        expectedResumeDate: pendingForm.expectedResumeDate,
        pendingNotes: pendingForm.pendingNotes
      });

      showSuccess('Order set to pending successfully');
      setPendingDialogOpen(false);
      setSelectedOrderForPending(null);
      setPendingForm({
        expectedResumeDate: '',
        pendingNotes: ''
      });
      fetchOrders();
    } catch (error) {
      console.error('Error setting order to pending:', error);
      showError('Failed to set order to pending');
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
      
      // Fetch regular orders
      const ordersRef = collection(db, 'orders');
      const ordersQuery = query(ordersRef, orderBy('orderDetails.billInvoice', 'desc'));
      const ordersSnapshot = await getDocs(ordersQuery);
      const ordersData = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        orderType: 'regular'
      }));
      
      // Fetch corporate orders
      const corporateOrdersRef = collection(db, 'corporate-orders');
      const corporateOrdersQuery = query(corporateOrdersRef, orderBy('orderDetails.billInvoice', 'desc'));
      const corporateOrdersSnapshot = await getDocs(corporateOrdersQuery);
      const corporateOrdersData = corporateOrdersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        orderType: 'corporate'
      }));
      
      // Combine all orders
      const allOrdersData = [...ordersData, ...corporateOrdersData];
      
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

      const activeOrders = allOrdersData.filter(order => {
        // For corporate orders, use invoiceStatus to filter out closed ones
        if (order.orderType === 'corporate') {
          if (order.invoiceStatus) {
            return !endStateValues.includes(order.invoiceStatus);
          }
          // If no invoiceStatus, consider it active
          return true;
        }
        // For regular orders, filter out end state statuses
        return !endStateValues.includes(order.invoiceStatus);
      });
      
      // Sort by bill number (highest to lowest)
      const sortedOrders = activeOrders.sort((a, b) => {
        const billA = parseInt(a.orderDetails?.billInvoice || '0', 10);
        const billB = parseInt(b.orderDetails?.billInvoice || '0', 10);
        return billB - billA;
      });
      
      setOrders(sortedOrders);
      // Apply initial filter - show all orders by default
      setFilteredOrders(sortedOrders);
      
      // Preserve selected order if it still exists, otherwise select first order
      if (selectedOrderIdRef.current) {
        const preservedOrder = sortedOrders.find(order => order.id === selectedOrderIdRef.current);
        if (preservedOrder) {
          setSelectedOrder(preservedOrder);
        } else if (sortedOrders.length > 0) {
          setSelectedOrder(sortedOrders[0]);
          selectedOrderIdRef.current = sortedOrders[0].id;
        }
      } else if (sortedOrders.length > 0 && !selectedOrder) {
        setSelectedOrder(sortedOrders[0]);
        selectedOrderIdRef.current = sortedOrders[0].id;
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      showError(`Failed to fetch orders: ${error.message}`);
      setOrders([]);
      setFilteredOrders([]);
    } finally {
      setLoading(false);
    }
  }, [showError, sendingEmail, processingDeposit]);

  useEffect(() => {
    fetchOrders();
    fetchInvoiceStatuses();
    fetchMaterialCompanyTaxRates().then(setMaterialTaxRates);
  }, []); // Empty dependency array to run only once on mount

  // Handle URL parameter for order selection
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('orderId');
    
    if (orderId && filteredOrders.length > 0) {
      const orderToSelect = filteredOrders.find(order => order.id === orderId);
      if (orderToSelect) {
        setSelectedOrder(orderToSelect);
        selectedOrderIdRef.current = orderToSelect.id;
        // Scroll to the selected order after a short delay to ensure DOM is updated
        setTimeout(() => {
          scrollToSelectedOrder(orderId);
        }, 300);
      }
    }
  }, [filteredOrders]);

  // Effect to restore scroll position when filteredOrders changes
  useEffect(() => {
    if (selectedOrderIdRef.current && filteredOrders.length > 0) {
      // Small delay to ensure DOM is updated
      const timeoutId = setTimeout(() => {
        scrollToSelectedOrder(selectedOrderIdRef.current);
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [filteredOrders]);

  // Auto-save and unsaved changes tracking
  useEffect(() => {
    // Order changed, resetting editing state
    
    // Clear any pending auto-save operations when switching orders
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
      setAutoSaveTimeout(null);
    }
    
    // Reset editing state when switching orders
    // Handle both regular orders (furnitureData) and corporate orders (furnitureGroups)
    let furnitureData;
    if (selectedOrder?.orderType === 'corporate') {
      // Corporate orders have furnitureGroups as an array directly
      furnitureData = selectedOrder.furnitureGroups ? { groups: selectedOrder.furnitureGroups } : null;
    } else {
      // Regular orders have furnitureData with groups property
      furnitureData = selectedOrder?.furnitureData || null;
    }
    
    if (furnitureData) {
      setLastSavedData(JSON.stringify(furnitureData));
      setHasUnsavedChanges(false);
      setEditingFurnitureData(null); // Clear any previous editing state
      setIsAutoSaving(false); // Clear any auto-saving indicator
      // Reset editing state for order
    } else {
      // Clear everything when no order is selected
      setLastSavedData(null);
      setHasUnsavedChanges(false);
      setEditingFurnitureData(null);
      setIsAutoSaving(false);
      // Cleared all editing state - no order selected
    }
  }, [selectedOrder?.id]); // Reset when order changes

  // Apply initial filter when orders are loaded
  useEffect(() => {
    if (orders.length > 0) {
      applyFiltersAndSearch(searchTerm, orderFilter);
    }
  }, [orders, searchTerm, orderFilter]);

  useEffect(() => {
    // Track changes in editingFurnitureData
    // Handle both regular orders (furnitureData) and corporate orders (furnitureGroups)
    let furnitureData;
    if (selectedOrder?.orderType === 'corporate') {
      // Corporate orders have furnitureGroups as an array directly
      furnitureData = selectedOrder.furnitureGroups ? { groups: selectedOrder.furnitureGroups } : null;
    } else {
      // Regular orders have furnitureData with groups property
      furnitureData = selectedOrder?.furnitureData || null;
    }
    
    if (editingFurnitureData && furnitureData) {
      const currentData = JSON.stringify(editingFurnitureData);
      const hasChanges = currentData !== lastSavedData;
      setHasUnsavedChanges(hasChanges);
      
      // Clear any existing timeout since we're not using timer-based auto-save
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
        setAutoSaveTimeout(null);
      }
    }
    
    return () => {
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
      }
    };
  }, [editingFurnitureData, lastSavedData, selectedOrder]);

  // Auto-save on page unload
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges && selectedOrder && editingFurnitureData) {
        console.log('Saving changes before page unload for order:', selectedOrder.id);
        
        // Use synchronous save for beforeunload
        const saveChanges = async () => {
          try {
            const orderRef = doc(db, 'orders', selectedOrder.id);
            await updateDoc(orderRef, {
              furnitureData: editingFurnitureData
            });
            console.log('Successfully saved changes before unload');
          } catch (error) {
            console.error('Error saving changes before unload:', error);
          }
        };
        
        // Save synchronously - this is the only way to ensure it completes
        saveChanges();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges, selectedOrder, editingFurnitureData]);

  // Search function
  const handleSearch = (searchValue) => {
    setSearchTerm(searchValue);
    applyFiltersAndSearch(searchValue, orderFilter);
  };

  const handleFilterChange = (filter) => {
    setOrderFilter(filter);
    applyFiltersAndSearch(searchTerm, filter);
  };

  const applyFiltersAndSearch = (searchValue, filter) => {
    const searchLower = searchValue.toLowerCase();
    
    const filtered = orders.filter(order => {
      // Apply order type filter first
      if (filter === 'individual' && order.orderType === 'corporate') {
        return false;
      }
      if (filter === 'corporate' && order.orderType !== 'corporate') {
        return false;
      }
      
      // If no search term, return all orders that pass the filter
      if (!searchValue.trim()) {
        return true;
      }
      
      // Search in bill number
      if (order.orderDetails?.billInvoice?.toLowerCase().includes(searchLower)) {
        return true;
      }

      // Search in customer info (different for corporate vs regular orders)
      if (order.orderType === 'corporate') {
        // Search in corporate customer info
        const corporateCustomer = order.corporateCustomer || {};
        const contactPerson = order.contactPerson || {};
        if (
          corporateCustomer.corporateName?.toLowerCase().includes(searchLower) ||
          corporateCustomer.email?.toLowerCase().includes(searchLower) ||
          corporateCustomer.phone?.toLowerCase().includes(searchLower) ||
          contactPerson.name?.toLowerCase().includes(searchLower) ||
          contactPerson.email?.toLowerCase().includes(searchLower) ||
          contactPerson.phone?.toLowerCase().includes(searchLower)
        ) {
          return true;
        }
      } else {
        // Search in personal info for regular orders
      const personalInfo = order.personalInfo || {};
      if (
        personalInfo.customerName?.toLowerCase().includes(searchLower) ||
        personalInfo.email?.toLowerCase().includes(searchLower) ||
        personalInfo.phone?.toLowerCase().includes(searchLower)
      ) {
        return true;
      }
      }

      // Search in furniture data - handle both regular orders (furnitureData.groups) and corporate orders (furnitureGroups)
      const furnitureGroups = order.furnitureData?.groups || order.furnitureGroups || [];
      if (furnitureGroups.length > 0) {
        return furnitureGroups.some(group => 
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
    // Get payment data (different field names for corporate vs regular orders)
    const paymentData = order.orderType === 'corporate' ? order.paymentDetails : order.paymentData;
    
    // Corporate orders use different calculation (same as Corporate Invoices page)
    if (order.orderType === 'corporate') {
      // Calculate subtotal from furniture groups
      const furnitureGroups = order.furnitureGroups || [];
      let subtotal = 0;

      furnitureGroups.forEach(group => {
        // Add material cost
        if (group.materialPrice && group.materialQnty && parseFloat(group.materialPrice) > 0) {
          const price = parseFloat(group.materialPrice) || 0;
          const quantity = parseFloat(group.materialQnty) || 0;
          subtotal += price * quantity;
        }
        
        // Add labour cost
        if (group.labourPrice && group.labourQnty && parseFloat(group.labourPrice) > 0) {
          const price = parseFloat(group.labourPrice) || 0;
          const quantity = parseFloat(group.labourQnty) || 0;
          subtotal += price * quantity;
        }
        
        // Add foam cost if enabled
        if (group.foamEnabled && group.foamPrice && group.foamQnty && parseFloat(group.foamPrice) > 0) {
          const price = parseFloat(group.foamPrice) || 0;
          const quantity = parseFloat(group.foamQnty) || 0;
          subtotal += price * quantity;
        }
        
        // Add painting cost if enabled
        if (group.paintingEnabled && group.paintingLabour && group.paintingQnty && parseFloat(group.paintingLabour) > 0) {
          const price = parseFloat(group.paintingLabour) || 0;
          const quantity = parseFloat(group.paintingQnty) || 0;
          subtotal += price * quantity;
        }
      });

      // Add pickup/delivery cost if enabled
      if (paymentData?.pickupDeliveryEnabled) {
        const pickupCost = parseFloat(paymentData.pickupDeliveryCost) || 0;
        const serviceType = paymentData.pickupDeliveryServiceType;
        if (serviceType === 'both') {
          subtotal += pickupCost * 2;
        } else {
          subtotal += pickupCost;
        }
      }

      // Calculate tax (13% on entire subtotal for corporate orders)
      const taxAmount = subtotal * 0.13;

      // Calculate credit card fee (2.5% on subtotal + tax) if enabled
      const creditCardFeeEnabled = paymentData?.creditCardFeeEnabled || order.settings?.creditCardFeeEnabled || false;
      const creditCardFee = creditCardFeeEnabled ? (subtotal + taxAmount) * 0.025 : 0;

      // Calculate grand total
      const grandTotal = subtotal + taxAmount + creditCardFee;
      
      const amountPaid = parseFloat(paymentData?.amountPaid) || 0;
      const balanceDue = grandTotal - amountPaid;
      const cost = calculateOrderCost(order, materialTaxRates);

      return {
        itemsSubtotal: parseFloat(subtotal.toFixed(2)),
        taxAmount: parseFloat(taxAmount.toFixed(2)),
        creditCardFee: parseFloat(creditCardFee.toFixed(2)),
        pickupDeliveryCost: 0, // Already included in subtotal for corporate
        grandTotal: parseFloat(grandTotal.toFixed(2)),
        amountPaid,
        balanceDue,
        jlGrandTotal: cost,
        extraExpensesTotal: 0,
        jlSubtotalBeforeTax: cost - taxAmount,
      };
    }
    
    // Regular orders calculation (tax only on materials and foam)
    // Calculate individual components properly
    const taxAmount = calculateOrderTax(order);
    const pickupDeliveryCost = paymentData?.pickupDeliveryEnabled ? 
      calculatePickupDeliveryCost(
        parseFloat(paymentData.pickupDeliveryCost) || 0,
        paymentData.pickupDeliveryServiceType || 'both'
      ) : 0;
    
    // Use the existing breakdown function to get accurate totals
    const breakdown = getOrderCostBreakdown(order);
    let itemsSubtotal = breakdown.material + breakdown.labour + breakdown.foam + breakdown.painting;
    
    // Extra expenses should NOT be added to customer-facing items subtotal
    // They are only included in Internal JL Cost Analysis
    
    // Calculate grand total
    const grandTotal = itemsSubtotal + taxAmount + pickupDeliveryCost;
    
    const amountPaid = parseFloat(paymentData?.amountPaid) || 0;
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
    const depositReceived = order.paymentData?.depositReceived;
    
    // Debug logging
    console.log('Status Debug:', {
      orderId: order.id,
      requiredDeposit,
      amountPaid,
      depositReceived,
      condition1: depositReceived,
      condition2: (amountPaid >= requiredDeposit && requiredDeposit > 0)
    });
    
    // If deposit is received or amount paid >= required deposit, show green
    if (depositReceived || (amountPaid >= requiredDeposit && requiredDeposit > 0)) {
      console.log('Returning SUCCESS (green)');
      return 'success';
    }
    // If some payment made but not enough, show orange
    if (amountPaid > 0) {
      console.log('Returning WARNING (orange)');
      return 'warning';
    }
    // No payment made, show red
    console.log('Returning ERROR (red)');
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

  // Helper function to get the correct database reference for an order
  const getOrderRef = (order) => {
    const collection = order.orderType === 'corporate' ? 'corporate-orders' : 'orders';
    return doc(db, collection, order.id);
  };

  // Handle edit personal information
  const handleEditPersonal = () => {
    if (selectedOrder.orderType === 'corporate') {
      // For corporate orders, we'll show a message that editing is not available
      showError('Corporate order customer information cannot be edited from the workshop. Please use the Orders Management page.');
      return;
    }
    
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
    // Convert Firestore Timestamp to date string if needed
    const formatDateForInput = (dateValue) => {
      if (!dateValue) return '';
      // If it's a Firestore Timestamp, convert it
      if (dateValue.toDate && typeof dateValue.toDate === 'function') {
        const date = dateValue.toDate();
        return date.toISOString().split('T')[0];
      }
      // If it's already a string in ISO format or date string
      if (typeof dateValue === 'string') {
        // If it's already in YYYY-MM-DD format, return as is
        if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
          return dateValue;
        }
        // Otherwise try to parse and format
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      }
      // If it's a Date object
      if (dateValue instanceof Date) {
        return dateValue.toISOString().split('T')[0];
      }
      return '';
    };

    setEditOrderData({
      description: selectedOrder.orderDetails?.description || '',
      platform: selectedOrder.orderDetails?.platform || '',
      startDate: formatDateForInput(selectedOrder.orderDetails?.startDate),
      endDate: formatDateForInput(selectedOrder.orderDetails?.endDate),
      timeline: selectedOrder.orderDetails?.timeline || ''
    });
    setEditOrderDialog(true);
  };

  // Handle edit payment data
  const handleEditPayment = () => {
    // Check if corporate or regular order to use correct field
    const paymentData = selectedOrder.orderType === 'corporate' ? selectedOrder.paymentDetails : selectedOrder.paymentData;
    
    setEditPaymentData({
      deposit: paymentData?.deposit || '',
      amountPaid: paymentData?.amountPaid || '',
      pickupDeliveryEnabled: paymentData?.pickupDeliveryEnabled || false,
      pickupDeliveryCost: paymentData?.pickupDeliveryCost || '',
      notes: paymentData?.notes || ''
    });
    setEditPaymentDialog(true);
  };

  // Handle edit furniture data
  const handleEditFurniture = () => {
    // Handle both regular orders (furnitureData) and corporate orders (furnitureGroups)
    let furnitureData;
    if (selectedOrder.orderType === 'corporate') {
      // Corporate orders have furnitureGroups as an array directly
      console.log('Loading corporate order furniture:', {
        orderId: selectedOrder.id,
        furnitureGroups: selectedOrder.furnitureGroups,
        furnitureGroupsLength: selectedOrder.furnitureGroups?.length
      });
      furnitureData = { groups: selectedOrder.furnitureGroups || [] };
    } else {
      // Regular orders have furnitureData with groups property
      console.log('Loading regular order furniture:', {
        orderId: selectedOrder.id,
        furnitureData: selectedOrder.furnitureData,
        groupsLength: selectedOrder.furnitureData?.groups?.length
      });
      furnitureData = selectedOrder.furnitureData || { groups: [] };
    }
    
    // Ensure groups array exists
    if (!furnitureData.groups) {
      furnitureData.groups = [];
    }
    
    console.log('Setting edit furniture data:', furnitureData);
    setEditFurnitureData(furnitureData);
    setEditFurnitureDialog(true);
  };

  // Handle edit additional notes
  const handleEditAdditionalNotes = () => {
    // Check if corporate or regular order to use correct field
    const paymentData = selectedOrder.orderType === 'corporate' ? selectedOrder.paymentDetails : selectedOrder.paymentData;
    setEditAdditionalNotesData({
      notes: paymentData?.notes || ''
    });
    setEditAdditionalNotesDialog(true);
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
      const orderRef = getOrderRef(selectedOrder);
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
      
      const orderRef = getOrderRef(selectedOrder);
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
      
      // Check if corporate or regular order to use correct field
      const isCorporate = selectedOrder.orderType === 'corporate';
      const paymentField = isCorporate ? 'paymentDetails' : 'paymentData';
      
      const updatedOrder = {
        ...selectedOrder,
        [paymentField]: editPaymentData,
        orderDetails: {
          ...selectedOrder.orderDetails,
          financialStatus,
        },
      };
      const orderRef = getOrderRef(selectedOrder);
      await updateDoc(orderRef, {
        [paymentField]: editPaymentData,
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

  // Save additional notes
  const handleSaveAdditionalNotes = async () => {
    try {
      // Check if corporate or regular order to use correct field
      const isCorporate = selectedOrder.orderType === 'corporate';
      const paymentField = isCorporate ? 'paymentDetails' : 'paymentData';
      
      const updatedOrder = {
        ...selectedOrder,
        [paymentField]: {
          ...(selectedOrder[paymentField] || {}),
          notes: editAdditionalNotesData.notes
        }
      };

      // Update in Firestore
      const orderRef = getOrderRef(selectedOrder);
      await updateDoc(orderRef, {
        [`${paymentField}.notes`]: editAdditionalNotesData.notes
      });

      setSelectedOrder(updatedOrder);
      setOrders(orders.map(order => order.id === selectedOrder.id ? updatedOrder : order));
      setFilteredOrders(filteredOrders.map(order => order.id === selectedOrder.id ? updatedOrder : order));
      setEditAdditionalNotesDialog(false);
      showSuccess('Additional notes updated successfully');
    } catch (error) {
      console.error('Error updating additional notes:', error);
      showError('Failed to update additional notes');
    }
  };

  // Auto-save function
  const handleAutoSave = async (showIndicator = true) => {
    if (!selectedOrder || !editingFurnitureData || !hasUnsavedChanges) {
      return;
    }

    try {
      if (showIndicator) {
        setIsAutoSaving(true);
      }

      // Auto-saving furniture data
      // Handle both regular orders (furnitureData) and corporate orders (furnitureGroups)
      const orderRef = getOrderRef(selectedOrder);
      const updateData = selectedOrder.orderType === 'corporate' 
        ? { furnitureGroups: editingFurnitureData.groups }
        : { furnitureData: editingFurnitureData };

      await updateDoc(orderRef, updateData);

      // Update local state
      const updatedOrder = { 
        ...selectedOrder, 
        ...(selectedOrder.orderType === 'corporate' 
          ? { furnitureGroups: editingFurnitureData.groups }
          : { furnitureData: editingFurnitureData }
        )
      };
      setSelectedOrder(updatedOrder);
      setOrders(orders.map(order => order.id === selectedOrder.id ? updatedOrder : order));
      setFilteredOrders(filteredOrders.map(order => order.id === selectedOrder.id ? updatedOrder : order));
      
      // Update last saved data and clear unsaved changes flag
      setLastSavedData(JSON.stringify(editingFurnitureData));
      setHasUnsavedChanges(false);
      
      // Show subtle notification only for background auto-save
      if (!showIndicator) {
        showSuccess('Changes auto-saved successfully');
      }
    } catch (error) {
      console.error('Error auto-saving furniture data:', error);
      showError('Failed to auto-save changes');
    } finally {
      if (showIndicator) {
        setIsAutoSaving(false);
      }
    }
  };

  // Save furniture data for a specific group or all groups
  const handleSaveFurnitureGroup = async (groupIndex) => {
    try {
      // Use the editing data if available, otherwise use the current selectedOrder data
      let furnitureDataToSave;
      if (editingFurnitureData) {
        furnitureDataToSave = editingFurnitureData;
      } else if (selectedOrder.orderType === 'corporate') {
        // Corporate orders have furnitureGroups as an array directly
        furnitureDataToSave = { groups: selectedOrder.furnitureGroups || [] };
      } else {
        // Regular orders have furnitureData with groups property
        furnitureDataToSave = selectedOrder.furnitureData || { groups: [] };
      }
      
      // Ensure groups array exists
      if (!furnitureDataToSave.groups) {
        furnitureDataToSave.groups = [];
      }
      
      const orderRef = getOrderRef(selectedOrder);
      // Handle both regular orders (furnitureData) and corporate orders (furnitureGroups)
      const updateData = selectedOrder.orderType === 'corporate' 
        ? { furnitureGroups: furnitureDataToSave.groups }
        : { furnitureData: furnitureDataToSave };
      
      await updateDoc(orderRef, updateData);
      
      // Update local state with the saved data
      const updatedOrder = {
        ...selectedOrder,
        ...(selectedOrder.orderType === 'corporate' 
          ? { furnitureGroups: furnitureDataToSave.groups }
          : { furnitureData: furnitureDataToSave }
        )
      };
      
      setSelectedOrder(updatedOrder);
      setOrders(orders.map(order => 
        order.id === selectedOrder.id ? updatedOrder : order
      ));
      setFilteredOrders(filteredOrders.map(order => 
        order.id === selectedOrder.id ? updatedOrder : order
      ));
      
      // Clear the editing state and update tracking
      setEditingFurnitureData(null);
      setLastSavedData(JSON.stringify(furnitureDataToSave));
      setHasUnsavedChanges(false);
      
      // Close the dialog
      setEditFurnitureDialog(false);
      
      if (groupIndex !== undefined) {
        showSuccess(`Furniture group ${groupIndex + 1} updated successfully`);
      } else {
        showSuccess('All furniture groups updated successfully');
      }
    } catch (error) {
      console.error('Error updating furniture group:', error);
      showError('Failed to update furniture group');
    }
  };

  // Update furniture group data in editing state only
  const updateFurnitureGroup = (groupIndex, fieldName, value) => {
    // Updating furniture group
    let currentFurnitureData;
    if (editingFurnitureData) {
      currentFurnitureData = editingFurnitureData;
    } else if (selectedOrder.orderType === 'corporate') {
      // Corporate orders have furnitureGroups as an array directly
      currentFurnitureData = { groups: selectedOrder.furnitureGroups || [] };
    } else {
      // Regular orders have furnitureData with groups property
      currentFurnitureData = selectedOrder.furnitureData || { groups: [] };
    }
    
    // Ensure groups array exists
    if (!currentFurnitureData.groups) {
      currentFurnitureData.groups = [];
    }
    
    const updatedGroups = [...currentFurnitureData.groups];
    updatedGroups[groupIndex] = { ...updatedGroups[groupIndex], [fieldName]: value };
    
    const updatedFurnitureData = {
      ...currentFurnitureData,
      groups: updatedGroups
    };
    
    setEditingFurnitureData(updatedFurnitureData);
  };

  // Handle navigation with auto-save
  const handleNavigationWithAutoSave = async (navigationFunction) => {
    if (hasUnsavedChanges && selectedOrder && editingFurnitureData) {
      console.log('Auto-saving before navigation');
      setIsAutoSaving(true);
      
      try {
        await handleAutoSave(false); // Save without showing notification
        console.log('Successfully auto-saved before navigation');
      } catch (error) {
        console.error('Error auto-saving before navigation:', error);
        showError('Failed to save changes before navigation');
      } finally {
        setIsAutoSaving(false);
      }
    }
    navigationFunction();
  };

  // Check if a specific furniture group has unsaved changes
  const hasUnsavedChangesInGroup = (groupIndex) => {
    if (!editingFurnitureData) return false;
    
    // Handle both regular orders (furnitureData.groups) and corporate orders (furnitureGroups)
    let originalGroups;
    if (selectedOrder.orderType === 'corporate') {
      // Corporate orders have furnitureGroups as an array directly
      originalGroups = selectedOrder.furnitureGroups || [];
    } else {
      // Regular orders have furnitureData with groups property
      originalGroups = selectedOrder.furnitureData?.groups || [];
    }
    
    const originalGroup = originalGroups[groupIndex];
    const editingGroup = editingFurnitureData.groups?.[groupIndex];
    
    if (!originalGroup || !editingGroup) return false;
    
    // Compare all fields
    const fieldsToCompare = [
      'furnitureType', 'materialCompany', 'materialCode', 'treatment', 'unit', 
      'quantity', 'labourNote', 'foamEnabled', 'foamThickness', 'foamNote', 
      'foamQnty', 'paintingEnabled', 'paintingNote', 'paintingQnty', 'customerNote'
    ];
    
    return fieldsToCompare.some(field => {
      const originalValue = originalGroup[field] || '';
      const editingValue = editingGroup[field] || '';
      return originalValue !== editingValue;
    });
  };

  // Email sending function
  const handleSendEmail = async () => {
    if (!selectedOrder) {
      showError('No order selected');
      return;
    }

    const customerEmail = selectedOrder.orderType === 'corporate' 
      ? selectedOrder.contactPerson?.email || selectedOrder.corporateCustomer?.email
      : selectedOrder.personalInfo?.email;
      
    if (!customerEmail) {
      showError('No email address found for this customer');
      return;
    }

    try {
      setSendingEmail(true);

      // Prepare order data in the same format as NewOrderPage
      const orderDataForEmail = selectedOrder.orderType === 'corporate' ? {
        corporateCustomer: selectedOrder.corporateCustomer,
        contactPerson: selectedOrder.contactPerson,
        orderDetails: selectedOrder.orderDetails,
        furnitureData: {
          groups: selectedOrder.furnitureData?.groups || selectedOrder.furnitureGroups || []
        },
        paymentData: selectedOrder.paymentData
      } : {
        personalInfo: selectedOrder.personalInfo,
        orderDetails: selectedOrder.orderDetails,
        furnitureData: {
          groups: selectedOrder.furnitureData?.groups || selectedOrder.furnitureGroups || []
        },
        paymentData: selectedOrder.paymentData
      };

      // Progress callback for email sending
      const onEmailProgress = (message) => {
        showSuccess(`📧 ${message}`);
      };

      // Send the email with progress tracking
      const result = await sendEmailWithConfig(orderDataForEmail, customerEmail, onEmailProgress);
      
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

  // Handle deposit received
  const handleDepositReceived = async () => {
    if (!selectedOrder) {
      showError('No order selected');
      return;
    }

    // Get customer email
    const customerEmail = selectedOrder.orderType === 'corporate' 
      ? selectedOrder.contactPerson?.email || selectedOrder.corporateCustomer?.email
      : selectedOrder.personalInfo?.email;

    // Check if customer has a valid email for sending
    const hasValidEmail = isValidEmailForSending(customerEmail);

    // Use correct payment field for corporate vs regular orders
    const paymentData = selectedOrder.orderType === 'corporate' ? selectedOrder.paymentDetails : selectedOrder.paymentData;
    const requiredDeposit = parseFloat(paymentData?.deposit) || 0;
    if (requiredDeposit <= 0) {
      showError('No deposit amount set for this order');
      return;
    }

    try {
      setProcessingDeposit(true);
      
      // Auto-check and authorize Gmail if needed
      await ensureGmailAuthorized();

      // Update the order with deposit received
      const orderRef = doc(db, selectedOrder.orderType === 'corporate' ? 'corporate-orders' : 'orders', selectedOrder.id);
      
      // Use correct payment field for corporate vs regular orders
      const paymentField = selectedOrder.orderType === 'corporate' ? 'paymentDetails' : 'paymentData';
      const currentPaymentData = selectedOrder.orderType === 'corporate' ? selectedOrder.paymentDetails : selectedOrder.paymentData;
      
      const updatedPaymentData = {
        ...currentPaymentData,
        amountPaid: requiredDeposit,
        depositReceived: true,
        depositReceivedDate: new Date().toISOString()
      };

      await updateDoc(orderRef, {
        [paymentField]: updatedPaymentData,
        orderDetails: {
          ...selectedOrder.orderDetails,
          financialStatus: 'Deposit Paid',
        },
      });

      // Prepare order data for email
      const orderDataForEmail = selectedOrder.orderType === 'corporate' ? {
        corporateCustomer: selectedOrder.corporateCustomer,
        contactPerson: selectedOrder.contactPerson,
        orderDetails: selectedOrder.orderDetails,
        paymentDetails: updatedPaymentData
      } : {
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
          const emailResult = await sendDepositEmailWithConfig(orderDataForEmail, customerEmail, onDepositEmailProgress);
          
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
        [paymentField]: updatedPaymentData,
        orderDetails: {
          ...selectedOrder.orderDetails,
          financialStatus: 'Deposit Paid',
        }
      };
      setSelectedOrder(updatedSelectedOrder);
      
      // Refresh the orders list to ensure consistency (this will fetch from both collections)
      await fetchOrders();
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

  // Helper function to scroll to selected order
  const scrollToSelectedOrder = (orderId) => {
    console.log('Workshop scrollToSelectedOrder called with orderId:', orderId);
    if (listContainerRef.current && orderId) {
      const selectedElement = listContainerRef.current.querySelector(`[data-order-id="${orderId}"]`);
      console.log('Found element:', selectedElement);
      if (selectedElement) {
        selectedElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
        console.log('Scrolled to element');
      }
    }
  };

  // Handle order selection - simplified to avoid double loading
  const handleOrderSelection = async (order) => {
    // Auto-save any unsaved changes before switching orders
    if (hasUnsavedChanges && selectedOrder && editingFurnitureData) {
      console.log('Auto-saving before switching to order:', order.id);
      setIsAutoSaving(true);
      
      try {
        await handleAutoSave(false); // Save without showing notification
        console.log('Successfully auto-saved before switching orders');
      } catch (error) {
        console.error('Error auto-saving before switching orders:', error);
        showError('Failed to save changes before switching orders');
      } finally {
        setIsAutoSaving(false);
      }
    }
    
    setSelectedOrder(order);
    selectedOrderIdRef.current = order.id;
    
    // Use requestAnimationFrame to ensure DOM has updated before scrolling
    requestAnimationFrame(() => {
      setTimeout(() => {
        scrollToSelectedOrder(order.id);
      }, 150);
    });
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
      // Check if corporate or regular order to use correct field
      const isCorporate = selectedOrder.orderType === 'corporate';
      const paymentField = isCorporate ? 'paymentDetails' : 'paymentData';
      const currentPaymentData = isCorporate ? selectedOrder.paymentDetails : selectedOrder.paymentData;
      
      const currentAmountPaid = parseFloat(currentPaymentData?.amountPaid || 0);
      const newTotalAmountPaid = currentAmountPaid + paymentAmount;

      const orderRef = getOrderRef(selectedOrder);
      await updateDoc(orderRef, {
        [`${paymentField}.amountPaid`]: newTotalAmountPaid,
        [`${paymentField}.payments`]: [
          ...(currentPaymentData?.payments || []),
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
        [paymentField]: {
          ...(prev[paymentField] || {}),
          amountPaid: newTotalAmountPaid,
          payments: [
            ...(prev[paymentField]?.payments || []),
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
              [paymentField]: { 
                ...(order[paymentField] || {}), 
                amountPaid: newTotalAmountPaid,
                payments: [
                  ...(order[paymentField]?.payments || []),
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
              [paymentField]: { 
                ...(order[paymentField] || {}), 
                amountPaid: newTotalAmountPaid,
                payments: [
                  ...(order[paymentField]?.payments || []),
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

  // Extra Expense Modal Functions
  const handleOpenExpenseModal = () => {
    setExpenseModalOpen(true);
    setExpenseForm({ description: '', price: '', unit: '', tax: '', taxType: 'fixed', total: '' });
    setExpenseList([]);
  };

  const handleCloseExpenseModal = () => setExpenseModalOpen(false);

  const handleExpenseInputChange = (e) => {
    const { name, value } = e.target;
    let newForm = { ...expenseForm, [name]: value };
    // Auto-calc tax and total
    const price = parseFloat(newForm.price) || 0;
    const unit = isNaN(Number(newForm.unit)) ? 1 : parseFloat(newForm.unit) || 1;
    let tax = 0;
    if (newForm.taxType === 'percent') {
      const percent = parseFloat(newForm.tax) || 0;
      tax = price * unit * percent / 100;
      newForm.taxValue = tax.toFixed(2);
    } else {
      tax = parseFloat(newForm.tax) || 0;
      newForm.taxValue = tax.toFixed(2);
    }
    newForm.total = (price * unit + tax).toFixed(2);
    setExpenseForm(newForm);
  };

  const handleTaxTypeChange = (e) => {
    const taxType = e.target.value;
    let newForm = { ...expenseForm, taxType };
    // Recalculate tax and total
    const price = parseFloat(newForm.price) || 0;
    const unit = isNaN(Number(newForm.unit)) ? 1 : parseFloat(newForm.unit) || 1;
    let tax = 0;
    if (taxType === 'percent') {
      const percent = parseFloat(newForm.tax) || 0;
      tax = price * unit * percent / 100;
      newForm.taxValue = tax.toFixed(2);
    } else {
      tax = parseFloat(newForm.tax) || 0;
      newForm.taxValue = tax.toFixed(2);
    }
    newForm.total = (price * unit + tax).toFixed(2);
    setExpenseForm(newForm);
  };

  const handleAddExpenseToList = () => {
    if (!expenseForm.description || !expenseForm.price || !expenseForm.unit) return;
    setExpenseList([
      ...expenseList,
      {
        description: expenseForm.description,
        price: parseFloat(expenseForm.price) || 0,
        unit: expenseForm.unit,
        tax: parseFloat(expenseForm.taxValue) || 0,
        taxType: expenseForm.taxType,
        total: parseFloat(expenseForm.total) || 0,
      },
    ]);
    setExpenseForm({ description: '', price: '', unit: '', tax: '', taxType: 'fixed', total: '' });
  };

  const handleDeleteExpense = (idx) => {
    setExpenseList(expenseList.filter((_, i) => i !== idx));
  };

  const handleSaveAllExpenses = async () => {
    if (!selectedOrder) return;
    try {
      const orderRef = getOrderRef(selectedOrder);
      // Merge with existing extraExpenses if any
      const prev = selectedOrder.extraExpenses || [];
      const newExpenses = [...prev, ...expenseList];
      await updateDoc(orderRef, { extraExpenses: newExpenses });
      showSuccess('Extra expenses saved!');
      // Update local state so UI refreshes
      setSelectedOrder({ ...selectedOrder, extraExpenses: newExpenses });
      setOrders(orders.map(o => o.id === selectedOrder.id ? { ...o, extraExpenses: newExpenses } : o));
    } catch (err) {
      showError('Failed to save extra expenses');
    }
    setExpenseModalOpen(false);
  };

  // Edit Expense Handler
  const handleEditExpense = (expense, index) => {
    setEditingExpenseIndex(index);
    setEditExpenseForm({
      description: expense.description || '',
      price: expense.price || '',
      unit: expense.unit || '',
      tax: expense.tax || '',
      taxType: expense.taxType || 'fixed',
      total: expense.total || '',
    });
    setEditExpenseModalOpen(true);
  };

  // Save Edited Expense Handler
  const handleSaveEditedExpense = async () => {
    if (!selectedOrder || editingExpenseIndex === null) return;
    
    try {
      const orderRef = getOrderRef(selectedOrder);
      const updatedExpenses = [...selectedOrder.extraExpenses];
      updatedExpenses[editingExpenseIndex] = { ...editExpenseForm };
      
      await updateDoc(orderRef, { extraExpenses: updatedExpenses });
      showSuccess('Expense updated successfully!');
      
      // Update local state
      setSelectedOrder({ ...selectedOrder, extraExpenses: updatedExpenses });
      setOrders(orders.map(o => o.id === selectedOrder.id ? { ...o, extraExpenses: updatedExpenses } : o));
      
      setEditExpenseModalOpen(false);
      setEditingExpenseIndex(null);
    } catch (err) {
      showError('Failed to update expense');
    }
  };

  // Delete Expense Handler
  const handleDeleteExpenseItem = (expense, index) => {
    setExpenseToDelete({ expense, index });
    setDeleteExpenseDialogOpen(true);
  };

  // Confirm Delete Expense Handler
  const handleConfirmDeleteExpense = async () => {
    if (!selectedOrder || expenseToDelete === null) return;
    
    try {
      const orderRef = getOrderRef(selectedOrder);
      const updatedExpenses = selectedOrder.extraExpenses.filter((_, index) => index !== expenseToDelete.index);
      
      await updateDoc(orderRef, { extraExpenses: updatedExpenses });
      showSuccess('Expense deleted successfully!');
      
      // Update local state
      setSelectedOrder({ ...selectedOrder, extraExpenses: updatedExpenses });
      setOrders(orders.map(o => o.id === selectedOrder.id ? { ...o, extraExpenses: updatedExpenses } : o));
      
      setDeleteExpenseDialogOpen(false);
      setExpenseToDelete(null);
    } catch (err) {
      showError('Failed to delete expense');
    }
  };

  // Edit Expense Input Change Handler
  const handleEditExpenseInputChange = (field, value) => {
    const newForm = { ...editExpenseForm, [field]: value };
    
    if (field === 'price' || field === 'unit' || field === 'tax' || field === 'taxType') {
      const price = parseFloat(newForm.price) || 0;
      const unit = isNaN(Number(newForm.unit)) ? 1 : parseFloat(newForm.unit) || 1;
      let tax = 0;
      
      if (newForm.taxType === 'percent') {
        const percent = parseFloat(newForm.tax) || 0;
        tax = price * unit * percent / 100;
        newForm.taxValue = tax.toFixed(2);
      } else {
        tax = parseFloat(newForm.tax) || 0;
        newForm.taxValue = tax.toFixed(2);
      }
      newForm.total = (price * unit + tax).toFixed(2);
    }
    
    setEditExpenseForm(newForm);
  };

  // Completion Email Dialog State
  const [completionEmailDialog, setCompletionEmailDialog] = useState({
    open: false,
    sendEmail: true,
    includeReview: true
  });

  // Completion Email Functions
  const handleSendCompletionEmail = () => {
    const customerEmail = selectedOrder?.orderType === 'corporate' 
      ? selectedOrder?.contactPerson?.email || selectedOrder?.corporateCustomer?.email
      : selectedOrder?.personalInfo?.email;
      
    if (!customerEmail) {
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
      const orderDataForEmail = selectedOrder.orderType === 'corporate' ? {
        corporateCustomer: selectedOrder.corporateCustomer,
        contactPerson: selectedOrder.contactPerson,
        orderDetails: selectedOrder.orderDetails,
        furnitureData: {
          groups: selectedOrder.furnitureData?.groups || selectedOrder.furnitureGroups || []
        },
        paymentData: selectedOrder.paymentData
      } : {
        personalInfo: selectedOrder.personalInfo,
        orderDetails: selectedOrder.orderDetails,
        furnitureData: {
          groups: selectedOrder.furnitureData?.groups || selectedOrder.furnitureGroups || []
        },
        paymentData: selectedOrder.paymentData
      };

      // Get customer email
      const customerEmail = selectedOrder.orderType === 'corporate' 
        ? selectedOrder.contactPerson?.email || selectedOrder.corporateCustomer?.email
        : selectedOrder.personalInfo?.email;

      // Progress callback for email sending
      const onEmailProgress = (message) => {
        console.log('🔍 Workshop Debug - Completion email progress:', message);
        showSuccess(`📧 ${message}`);
      };

      // Send the completion email
      const emailResult = await sendCompletionEmailWithGmail(
        orderDataForEmail, 
        customerEmail, 
        completionEmailDialog.includeReview, // includeReviewRequest
        onEmailProgress
      );
      
      if (emailResult.success) {
        showSuccess('✅ Completion email sent successfully!');
      } else {
        showError(`❌ Failed to send completion email: ${emailResult.message}`);
      }
    } catch (error) {
      console.error('🔍 Workshop Debug - Error sending completion email:', error);
      showError(`Failed to send completion email: ${error.message}`);
    } finally {
      setSendingCompletionEmail(false);
    }
  };

  const handleCompletionEmailCancel = () => {
    setCompletionEmailDialog({ open: false, sendEmail: false, includeReview: false });
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
          
          {/* Filter Buttons */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Button
              variant={orderFilter === 'all' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => handleFilterChange('all')}
              sx={{
                minWidth: 80,
                fontSize: '0.75rem',
                fontWeight: 'bold',
                ...(orderFilter === 'all' ? {
                  background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
                  color: '#000000',
                  border: '2px solid #f27921',
                  '&:hover': {
                    background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
                    border: '2px solid #e06810'
                  }
                } : {
                  color: '#666666',
                  borderColor: '#e0e0e0',
                  '&:hover': {
                    borderColor: '#b98f33',
                    backgroundColor: 'rgba(185, 143, 51, 0.1)'
                  }
                })
              }}
            >
              All
            </Button>
            <Button
              variant={orderFilter === 'individual' ? 'contained' : 'outlined'}
              size="small"
              startIcon={<PersonIcon />}
              onClick={() => handleFilterChange('individual')}
              sx={{
                minWidth: 100,
                fontSize: '0.75rem',
                fontWeight: 'bold',
                ...(orderFilter === 'individual' ? {
                  background: 'linear-gradient(145deg, #274290 0%, #1a2f5c 100%)',
                  color: '#ffffff',
                  border: '2px solid #274290',
                  '&:hover': {
                    background: 'linear-gradient(145deg, #3a5a9a 0%, #274290 100%)',
                    border: '2px solid #1a2f5c'
                  }
                } : {
                  color: '#666666',
                  borderColor: '#e0e0e0',
                  '&:hover': {
                    borderColor: '#274290',
                    backgroundColor: 'rgba(39, 66, 144, 0.1)'
                  }
                })
              }}
            >
              Individual
            </Button>
            <Button
              variant={orderFilter === 'corporate' ? 'contained' : 'outlined'}
              size="small"
              startIcon={<BusinessIcon />}
              onClick={() => handleFilterChange('corporate')}
              sx={{
                minWidth: 100,
                fontSize: '0.75rem',
                fontWeight: 'bold',
                ...(orderFilter === 'corporate' ? {
                  background: 'linear-gradient(145deg, #f27921 0%, #d65a00 100%)',
                  color: '#ffffff',
                  border: '2px solid #f27921',
                  '&:hover': {
                    background: 'linear-gradient(145deg, #ff8a33 0%, #f27921 100%)',
                    border: '2px solid #d65a00'
                  }
                } : {
                  color: '#666666',
                  borderColor: '#e0e0e0',
                  '&:hover': {
                    borderColor: '#f27921',
                    backgroundColor: 'rgba(242, 121, 33, 0.1)'
                  }
                })
              }}
            >
              Corporate
            </Button>
          </Box>
          
          {/* Material Request Button */}
          <Button
            variant="contained"
            fullWidth
            startIcon={<InventoryIcon />}
            onClick={() => navigate('/admin/material-request')}
            sx={{
              mb: 2,
              background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
              color: '#000000',
              border: '2px solid #f27921',
              fontWeight: 'bold',
              '&:hover': {
                background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
                border: '2px solid #e06810'
              }
            }}
          >
            Material Request Management
          </Button>
          
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
          <List ref={listContainerRef} sx={{ p: 0, flex: 1 }}>
            {filteredOrders.map((order, index) => (
              <React.Fragment key={order.id}>
                <ListItem disablePadding data-order-id={order.id}>
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
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography 
                              variant="h5" 
                              sx={{ 
                                fontWeight: 'bold',
                                  color: order.orderType === 'corporate' ? '#f27921' : 'primary.main'
                              }}
                            >
                              #{order.orderDetails?.billInvoice || 'N/A'}
                            </Typography>
                              {order.orderType === 'corporate' && (
                                <BusinessIcon 
                                  sx={{ 
                                    color: '#f27921', 
                                    fontSize: '1.2rem',
                                    ml: 0.5
                                  }} 
                                />
                              )}
                            </Box>
                            <Typography 
                              variant="body1" 
                              sx={{ 
                                fontWeight: 600,
                                color: 'text.secondary',
                                fontSize: '0.9rem'
                              }}
                            >
                              {order.orderType === 'corporate' 
                                ? (order.corporateCustomer?.corporateName || 'Corporate Customer')
                                : (order.personalInfo?.customerName || 'No Name')
                              }
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
                            {order.allocation && order.allocation.allocations && (
                              <Tooltip title="Has allocation data">
                                <BarChartIcon sx={{ fontSize: 16, color: '#4CAF50' }} />
                              </Tooltip>
                            )}
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
                    Order Details • <span style={{ color: '#ffffff' }}>
                      {selectedOrder.orderType === 'corporate' 
                        ? selectedOrder.corporateCustomer?.corporateName || 'Corporate Customer'
                        : selectedOrder.personalInfo?.customerName || 'Customer'
                      }
                    </span>
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                    #{selectedOrder.orderDetails?.billInvoice}
                  </Typography>
                </Box>
              </Box>
              
              {/* Saving Indicator */}
              {isAutoSaving && (
                <Box sx={{ 
                  mb: 2, 
                  p: 2, 
                  backgroundColor: '#4caf50', 
                  borderRadius: 1, 
                  border: '2px solid #45a049',
                  boxShadow: '0 2px 8px rgba(76, 175, 80, 0.3)'
                }}>
                  <Typography variant="body2" sx={{ 
                    color: '#ffffff', 
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                  }}>
                    <CircularProgress size={16} sx={{ color: '#ffffff' }} />
                    Saving changes...
                  </Typography>
                </Box>
              )}

              {/* Top Buttons - Arranged in a single row */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-start', gap: 3 }}>
                {/* Send Order Email Button */}
                <Button
                  variant="contained"
                  size="medium"
                  startIcon={sendingEmail ? <CircularProgress size={16} sx={{ color: '#000000' }} /> : <SendIcon sx={{ color: '#000000' }} />}
                  onClick={handleSendEmail}
                  disabled={sendingEmail || selectedOrder?.orderType === 'corporate' || !(selectedOrder?.orderType === 'corporate' 
                    ? (selectedOrder?.contactPerson?.email || selectedOrder?.corporateCustomer?.email)
                    : selectedOrder?.personalInfo?.email)}
                  sx={{
                    background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
                    color: '#000000',
                    border: '2px solid #f27921',
                    fontWeight: 'bold',
                    '&:hover': {
                      background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
                      border: '2px solid #e06810'
                    }
                  }}
                >
                  {sendingEmail ? 'Sending Email...' : 'Send Order Email'}
                </Button>
                
                {/* Status Button */}
                <Button
                  variant="contained"
                  size="medium"
                  startIcon={<AssignmentIcon />}
                  onClick={() => {
                    setEditingStatus(selectedOrder.invoiceStatus);
                    setStatusDialogOpen(true);
                  }}
                  sx={{
                    background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
                    color: '#000000',
                    border: '2px solid #f27921',
                    fontWeight: 'bold',
                    '&:hover': {
                      background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
                      border: '2px solid #e06810'
                    }
                  }}
                >
                  {getStatusInfo(selectedOrder.invoiceStatus).label}
                </Button>


                {/* Allocation Button */}
                <Button
                  variant="contained"
                  size="medium"
                  startIcon={<BarChartIcon />}
                  onClick={() => handleStandaloneAllocationDialog(selectedOrder)}
                  sx={{
                    background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
                    color: '#000000',
                    border: '2px solid #f27921',
                    fontWeight: 'bold',
                    '&:hover': {
                      background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
                      border: '2px solid #e06810'
                    }
                  }}
                >
                  {selectedOrder.allocation && selectedOrder.allocation.allocations ? 'Edit Allocation' : 'Allocate'}
                </Button>

                {/* Invoices Button with Menu */}
                <Button
                  variant="contained"
                  size="medium"
                  type="button"
                  aria-controls={invoicesMenuOpen ? 'invoices-menu' : undefined}
                  aria-haspopup="true"
                  aria-expanded={invoicesMenuOpen ? 'true' : undefined}
                  startIcon={<ReceiptIcon sx={{ color: '#000000' }} />}
                  endIcon={<ArrowDropDownIcon sx={{ color: '#000000' }} />}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!selectedOrder) {
                      showError('Please select an order first');
                      return;
                    }
                    setInvoicesMenuAnchor(event.currentTarget);
                  }}
                  sx={{
                    background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
                    color: '#000000',
                    border: '2px solid #f27921',
                    fontWeight: 'bold',
                    '&:hover': {
                      background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
                      border: '2px solid #e06810'
                    }
                  }}
                >
                  Invoices
                </Button>
                <Menu
                  id="invoices-menu"
                  anchorEl={invoicesMenuAnchor}
                  open={invoicesMenuOpen}
                  onClose={() => setInvoicesMenuAnchor(null)}
                  MenuListProps={{
                    'aria-labelledby': 'invoices-button',
                  }}
                  anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                  }}
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                  }}
                  PaperProps={{
                    sx: {
                      mt: 1,
                      minWidth: 200,
                      backgroundColor: '#2a2a2a',
                      border: '1px solid #444',
                      '& .MuiMenuItem-root': {
                        color: '#ffffff',
                        '&:hover': {
                          backgroundColor: '#3a3a3a',
                        },
                      },
                    },
                  }}
                >
                  <MenuItem onClick={() => {
                    setInvoicesMenuAnchor(null);
                    if (selectedOrder) {
                      navigate(`/admin/invoices?orderId=${selectedOrder.id}`);
                    }
                  }}>
                    <ReceiptIcon sx={{ mr: 1, color: '#b98f33' }} />
                    Regular Invoices
                  </MenuItem>
                  <MenuItem onClick={() => {
                    setInvoicesMenuAnchor(null);
                    navigate('/admin/corporate-invoices');
                  }}>
                    <ReceiptIcon sx={{ mr: 1, color: '#b98f33' }} />
                    Corporate Invoices
                  </MenuItem>
                </Menu>

                {/* Send Completion Email Button */}
                <Button
                  variant="contained"
                  size="medium"
                  startIcon={sendingCompletionEmail ? <CircularProgress size={16} sx={{ color: '#000000' }} /> : <CheckCircleIcon sx={{ color: '#000000' }} />}
                  onClick={handleSendCompletionEmail}
                  disabled={sendingCompletionEmail || selectedOrder?.orderType === 'corporate' || !(selectedOrder?.orderType === 'corporate' 
                    ? (selectedOrder?.contactPerson?.email || selectedOrder?.corporateCustomer?.email)
                    : selectedOrder?.personalInfo?.email)}
                  sx={{
                    background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
                    color: '#000000',
                    border: '2px solid #f27921',
                    fontWeight: 'bold',
                    '&:hover': {
                      background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
                      border: '2px solid #e06810'
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
                      {selectedOrder.orderType === 'corporate' ? (
                        <>
                          {/* Corporate Customer Information */}
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                              🏢 Company Name
                            </Typography>
                            <Typography variant="body1" sx={{ mb: 2, fontSize: '1.1rem' }}>
                              {selectedOrder.corporateCustomer?.corporateName || 'N/A'}
                            </Typography>
                          </Box>
                          
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                              📞 Company Phone
                            </Typography>
                            <Typography variant="body1" sx={{ mb: 2 }}>
                              {selectedOrder.corporateCustomer?.phone || 'N/A'}
                            </Typography>
                          </Box>

                          <Box sx={{ mb: 2 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                              ✉️ Company Email
                            </Typography>
                            <Typography variant="body1" sx={{ mb: 2 }}>
                              {selectedOrder.corporateCustomer?.email || 'N/A'}
                            </Typography>
                          </Box>

                          <Box sx={{ mb: 3 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                              📍 Company Address
                            </Typography>
                            <Typography variant="body1" sx={{ mb: 2 }}>
                              {selectedOrder.corporateCustomer?.address || 'N/A'}
                            </Typography>
                          </Box>

                          {/* Contact Person Information */}
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                              👤 Contact Name
                            </Typography>
                            <Typography variant="body1" sx={{ mb: 2, fontSize: '1.1rem' }}>
                              {selectedOrder.contactPerson?.name || 'N/A'}
                            </Typography>
                          </Box>
                          
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                              📞 Contact Phone
                            </Typography>
                            <Typography variant="body1" sx={{ mb: 2 }}>
                              {selectedOrder.contactPerson?.phone || 'N/A'}
                            </Typography>
                          </Box>

                          <Box>
                            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                              ✉️ Contact Email
                            </Typography>
                            <Typography variant="body1">
                              {selectedOrder.contactPerson?.email || 'N/A'}
                            </Typography>
                          </Box>
                        </>
                      ) : (
                        <>
                          {/* Regular Customer Information */}
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
                        </>
                      )}
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
                        {selectedOrder.orderDetails?.startDate ? formatDate(selectedOrder.orderDetails.startDate) : 'N/A'}
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
                    {(selectedOrder.orderType === 'corporate' ? selectedOrder.paymentDetails?.deposit : selectedOrder.paymentData?.deposit) && parseFloat(selectedOrder.orderType === 'corporate' ? selectedOrder.paymentDetails?.deposit : selectedOrder.paymentData?.deposit) > 0 && !getDepositStatus(selectedOrder).isReceived && (
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
                                  ${selectedOrder.orderType === 'corporate' ? (selectedOrder.paymentDetails?.deposit || '0.00') : (selectedOrder.paymentData?.deposit || '0.00')}
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
                        {(selectedOrder.orderType === 'corporate' ? selectedOrder.paymentDetails?.pickupDeliveryEnabled : selectedOrder.paymentData?.pickupDeliveryEnabled) && (
                          <Grid item xs={6}>
                            <Card variant="outlined" sx={{ border: '2px solid #e3f2fd', height: '100%' }}>
                              <CardContent sx={{ p: 2 }}>
                                {/* Top Row: Service Type and Amount */}
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#d4af5a', mr: 1 }}>
                                    🚚 {(selectedOrder.orderType === 'corporate' ? selectedOrder.paymentDetails?.pickupDeliveryServiceType : selectedOrder.paymentData?.pickupDeliveryServiceType) === 'pickup' ? 'Pickup' : 
                                         (selectedOrder.orderType === 'corporate' ? selectedOrder.paymentDetails?.pickupDeliveryServiceType : selectedOrder.paymentData?.pickupDeliveryServiceType) === 'delivery' ? 'Delivery' : 
                                         'Pickup & Delivery'}
                                  </Typography>
                                                                                                   <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#d4af5a' }}>
                                   ${(() => {
                                     const paymentData = selectedOrder.orderType === 'corporate' ? selectedOrder.paymentDetails : selectedOrder.paymentData;
                                     const cost = paymentData?.pickupDeliveryCost || 0;
                                     const displayValue = paymentData?.pickupDeliveryServiceType === 'both' 
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
                                                                          {(selectedOrder.orderType === 'corporate' ? selectedOrder.paymentDetails?.pickupDeliveryServiceType : selectedOrder.paymentData?.pickupDeliveryServiceType) === 'pickup' ? 'One Way' :
                                       (selectedOrder.orderType === 'corporate' ? selectedOrder.paymentDetails?.pickupDeliveryServiceType : selectedOrder.paymentData?.pickupDeliveryServiceType) === 'delivery' ? 'One Way' :
                                       'Both Services'}
                                  </Typography>
                                </Box>
                              </CardContent>
                            </Card>
                          </Grid>
                        )}
                      </Grid>
                    </Grid>

                    {/* Right Side: Financial Summary Text */}
                    <Grid item xs={12} lg={7}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end', justifyContent: 'flex-end', width: '100%' }}>
                        {/* Total Invoice Amount */}
                                                 <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '280px' }}>
                           <Typography variant="caption" sx={{ color: '#FFD700', fontSize: '0.75rem', fontWeight: 'bold' }}>
                             Total Invoice Amount:
                           </Typography>
                           <Typography variant="caption" sx={{ color: '#FFD700', fontSize: '0.75rem', fontWeight: 'bold' }}>
                             ${selectedOrder ? calculateInvoiceTotals(selectedOrder).grandTotal.toFixed(2) : '0.00'}
                           </Typography>
                         </Box>

                        {/* Amount Paid */}
                                                 <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '280px' }}>
                           <Typography variant="caption" sx={{ color: '#FFD700', fontSize: '0.75rem', fontWeight: 'bold' }}>
                             Total Paid by Customer:
                           </Typography>
                           <Typography variant="caption" sx={{ color: '#FFD700', fontSize: '0.75rem', fontWeight: 'bold' }}>
                             ${selectedOrder.orderType === 'corporate' ? (selectedOrder.paymentDetails?.amountPaid || '0.00') : (selectedOrder.paymentData?.amountPaid || '0.00')}
                           </Typography>
                         </Box>

                                                 {/* Outstanding Balance */}
                         <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '280px' }}>
                           <Typography variant="caption" sx={{ color: '#FFD700', fontSize: '0.75rem', fontWeight: 'bold' }}>
                             Outstanding Balance:
                           </Typography>
                           <Typography variant="caption" sx={{ color: '#FFD700', fontSize: '0.75rem', fontWeight: 'bold' }}>
                             ${selectedOrder ? (calculateInvoiceTotals(selectedOrder).grandTotal - (parseFloat(selectedOrder.orderType === 'corporate' ? selectedOrder.paymentDetails?.amountPaid : selectedOrder.paymentData?.amountPaid || 0))).toFixed(2) : '0.00'}
                           </Typography>
                         </Box>
                      </Box>
                    </Grid>
                  </Grid>


                  
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
                  {(() => {
                    // Handle both regular orders (furnitureData.groups) and corporate orders (furnitureGroups)
                    let furnitureGroups;
                    if (selectedOrder.orderType === 'corporate') {
                      // Corporate orders have furnitureGroups as an array directly
                      furnitureGroups = selectedOrder.furnitureGroups || [];
                      console.log('Displaying corporate furniture groups:', {
                        orderId: selectedOrder.id,
                        groupsCount: furnitureGroups.length,
                        groups: furnitureGroups
                      });
                    } else {
                      // Regular orders have furnitureData with groups property
                      furnitureGroups = selectedOrder.furnitureData?.groups || [];
                    }
                    
                    return furnitureGroups.length > 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {furnitureGroups.map((group, index) => {
                        // Use editing data if available, otherwise use the original data
                          let currentFurnitureData;
                          if (editingFurnitureData) {
                            currentFurnitureData = editingFurnitureData;
                          } else if (selectedOrder.orderType === 'corporate') {
                            // Corporate orders have furnitureGroups as an array directly
                            currentFurnitureData = { groups: selectedOrder.furnitureGroups || [] };
                          } else {
                            // Regular orders have furnitureData with groups property
                            currentFurnitureData = selectedOrder.furnitureData || { groups: [] };
                          }
                          
                          const currentGroup = currentFurnitureData.groups?.[index] || group;
                        
                        return (
                          <Card key={index} sx={{ p: 2, border: '2px solid #e3f2fd' }}>
                            <Box sx={{ 
                              backgroundColor: hasUnsavedChangesInGroup(index) ? '#f27921' : '#d4af5a', 
                              color: '#000000', 
                              p: 1.5, 
                              borderRadius: 1, 
                              mb: 2,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              border: hasUnsavedChangesInGroup(index) ? '2px solid #ff9800' : 'none',
                              boxShadow: hasUnsavedChangesInGroup(index) ? '0 2px 8px rgba(242, 121, 33, 0.3)' : 'none'
                            }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', color: '#000000' }}>
                                  {currentGroup.furnitureType || 'Furniture Group ' + (index + 1)}
                                </Typography>
                                {hasUnsavedChangesInGroup(index) && (
                                  <Typography variant="caption" sx={{ 
                                    color: '#000000', 
                                    fontWeight: 'bold',
                                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                                    px: 1,
                                    py: 0.5,
                                    borderRadius: 1,
                                    fontSize: '0.7rem'
                                  }}>
                                    UNSAVED
                                  </Typography>
                                )}
                              </Box>
                              <Tooltip title={hasUnsavedChangesInGroup(index) ? `Save Furniture Group ${index + 1}` : `Furniture Group ${index + 1} saved`}>
                                <IconButton 
                                  onClick={() => handleSaveFurnitureGroup(index)} 
                                  color="inherit" 
                                  size="small"
                                  sx={{ 
                                    '&:hover': { 
                                      backgroundColor: 'rgba(255, 255, 255, 0.1)' 
                                    },
                                    backgroundColor: hasUnsavedChangesInGroup(index) ? 'rgba(255, 255, 255, 0.2)' : 'transparent'
                                  }}
                                >
                                  <SaveIcon />
                                </IconButton>
                              </Tooltip>
                            </Box>
                            
                            {/* Row 1: Material Company - Material Code - Treatment - Unit */}
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 2 }}>
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
                              <FormControl fullWidth size="small">
                                <Select
                                  value={currentGroup.unit || 'Yard'}
                                  onChange={(e) => updateFurnitureGroup(index, 'unit', e.target.value)}
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
                                  <MenuItem value="Yard">Yard</MenuItem>
                                  <MenuItem value="SQF">SQF</MenuItem>
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
                            <Box sx={{ mb: currentGroup.foamEnabled ? 1 : 0.5, p: 2 }}>
                              <FormControlLabel
                                control={
                                  <Switch
                                    checked={currentGroup.foamEnabled || false}
                                    onChange={(e) => updateFurnitureGroup(index, 'foamEnabled', e.target.checked)}
                                    color="primary"
                                  />
                                }
                                label={
                                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#d4af37', fontSize: '1.2rem' }}>
                                      Enable Foam
                                    </Typography>
                                    {(currentGroup.foamEnabled || false) && (
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
                            
                            {(currentGroup.foamEnabled || false) && (
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
                            <Box sx={{ mb: (() => {
                              // Auto-expand if painting has prices
                              if (currentGroup.paintingLabour) {
                                return 1;
                              }
                              // Auto-fold if only quantity 1 with no other data
                              if (currentGroup.paintingQnty === 1 && !currentGroup.paintingLabour && !currentGroup.paintingNote) {
                                return 0.5;
                              }
                              // Use existing enabled state
                              return currentGroup.paintingEnabled ? 1 : 0.5;
                            })(), p: 2 }}>
                              <FormControlLabel
                                control={
                                  <Switch
                                    checked={(() => {
                                      // Auto-expand if painting has prices
                                      if (currentGroup.paintingLabour) {
                                        return true;
                                      }
                                      // Auto-fold if only quantity 1 with no other data
                                      if (currentGroup.paintingQnty === 1 && !currentGroup.paintingLabour && !currentGroup.paintingNote) {
                                        return false;
                                      }
                                      // Use existing enabled state
                                      return currentGroup.paintingEnabled || false;
                                    })()}
                                    onChange={(e) => updateFurnitureGroup(index, 'paintingEnabled', e.target.checked)}
                                    color="primary"
                                  />
                                }
                                label={
                                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#d4af37', fontSize: '1.2rem' }}>
                                      Enable Painting
                                    </Typography>
                                    {(() => {
                                      // Auto-expand if painting has prices
                                      if (currentGroup.paintingLabour) {
                                        return true;
                                      }
                                      // Auto-fold if only quantity 1 with no other data
                                      if (currentGroup.paintingQnty === 1 && !currentGroup.paintingLabour && !currentGroup.paintingNote) {
                                        return false;
                                      }
                                      // Use existing enabled state
                                      return currentGroup.paintingEnabled || false;
                                    })() && (
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
                            
                            {(() => {
                              // Auto-expand if painting has prices
                              if (currentGroup.paintingLabour) {
                                return true;
                              }
                              // Auto-fold if only quantity 1 with no other data
                              if (currentGroup.paintingQnty === 1 && !currentGroup.paintingLabour && !currentGroup.paintingNote) {
                                return false;
                              }
                              // Use existing enabled state
                              return currentGroup.paintingEnabled || false;
                            })() && (
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
                    );
                  })()}
                </Box>
              </CardContent>
            </Card>

            {/* Additional Notes Card */}
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
                    <NoteIcon sx={{ mr: 1, color: '#000000' }} />
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#000000' }}>
                      Additional Notes
                    </Typography>
                  </Box>
                  <Tooltip title="Edit Additional Notes">
                    <IconButton onClick={handleEditAdditionalNotes} sx={{ color: '#000000' }} size="small">
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                </Box>

                {/* Content */}
                <Box sx={{ p: 3 }}>
                  {selectedOrder.paymentData?.notes ? (
                    <Box sx={{ 
                      backgroundColor: '#2a2a2a', 
                      p: 2, 
                      borderRadius: 1, 
                      border: '1px solid #e3f2fd'
                    }}>
                      <Typography variant="body1" sx={{ 
                        color: '#ffffff', 
                        whiteSpace: 'pre-wrap',
                        fontStyle: 'italic'
                      }}>
                        {selectedOrder.paymentData.notes}
                      </Typography>
                    </Box>
                  ) : (
                    <Box sx={{ 
                      backgroundColor: '#2a2a2a', 
                      p: 2, 
                      borderRadius: 1, 
                      border: '1px solid #e3f2fd',
                      textAlign: 'center'
                    }}>
                      <Typography variant="body2" sx={{ 
                        color: '#cccccc', 
                        fontStyle: 'italic'
                      }}>
                        No additional notes available
                      </Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>

            {/* Extra Expenses Card */}
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
                    <BarChartIcon sx={{ mr: 1, color: '#000000' }} />
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#000000' }}>
                      Extra Expenses
                    </Typography>
                    {selectedOrder.extraExpenses && selectedOrder.extraExpenses.length > 0 && (
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#000000', ml: 2 }}>
                        • Total: ${selectedOrder.extraExpenses.reduce((sum, expense) => sum + parseFloat(expense.total || 0), 0).toFixed(2)}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleOpenExpenseModal}
                      sx={{
                        color: '#000000',
                        borderColor: '#000000',
                        '&:hover': {
                          borderColor: '#8b6b1f',
                          backgroundColor: 'rgba(139, 107, 31, 0.1)'
                        }
                      }}
                    >
                      Add Expense
                    </Button>
                  </Box>
                </Box>

                             {/* Content */}
             <Box sx={{ p: 2 }}>
               {selectedOrder.extraExpenses && selectedOrder.extraExpenses.length > 0 ? (
                 <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                   {selectedOrder.extraExpenses.map((expense, index) => (
                     <Card key={index} sx={{ p: 1.5, border: '1px solid #e3f2fd', backgroundColor: '#2a2a2a' }}>
                       <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                           <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#d4af5a', fontSize: '0.9rem', minWidth: '120px' }}>
                             {expense.description}
                           </Typography>
                           <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                             <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>Price:</Typography>
                             <Typography variant="body2" sx={{ color: '#ffffff', fontSize: '0.8rem' }}>
                               ${parseFloat(expense.price || 0).toFixed(2)}
                             </Typography>
                           </Box>
                           <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                             <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>Unit:</Typography>
                             <Typography variant="body2" sx={{ color: '#ffffff', fontSize: '0.8rem' }}>
                               {expense.unit || 'N/A'}
                             </Typography>
                           </Box>
                           <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                             <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>Tax:</Typography>
                             <Typography variant="body2" sx={{ color: '#ffffff', fontSize: '0.8rem' }}>
                               {expense.taxType === 'percent' ? `${expense.tax}%` : `$${parseFloat(expense.tax || 0).toFixed(2)}`}
                             </Typography>
                           </Box>
                         </Box>
                         <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                           <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#d4af5a', fontSize: '0.9rem', mr: 2 }}>
                             ${parseFloat(expense.total || 0).toFixed(2)}
                           </Typography>
                           <Tooltip title="Edit Expense">
                             <IconButton
                               size="small"
                               onClick={() => handleEditExpense(expense, index)}
                               sx={{
                                 color: '#d4af5a',
                                 '&:hover': {
                                   backgroundColor: 'rgba(212, 175, 90, 0.1)',
                                   color: '#e6c47a'
                                 }
                               }}
                             >
                               <EditIcon fontSize="small" />
                             </IconButton>
                           </Tooltip>
                           <Tooltip title="Delete Expense">
                             <IconButton
                               size="small"
                               onClick={() => handleDeleteExpenseItem(expense, index)}
                               sx={{
                                 color: '#ff6b6b',
                                 '&:hover': {
                                   backgroundColor: 'rgba(255, 107, 107, 0.1)',
                                   color: '#ff5252'
                                 }
                               }}
                             >
                               <DeleteIcon fontSize="small" />
                             </IconButton>
                           </Tooltip>
                         </Box>
                       </Box>
                     </Card>
                   ))}
                 </Box>
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 3 }}>
                      <Typography variant="body1" sx={{ color: '#b98f33', mb: 2 }}>
                        No extra expenses added yet
                      </Typography>
                      <Button
                        variant="contained"
                        onClick={handleOpenExpenseModal}
                        sx={{
                          background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
                          color: '#000000',
                          '&:hover': {
                            background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)'
                          }
                        }}
                      >
                        Add First Expense
                      </Button>
                    </Box>
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
          <Button onClick={() => setEditPersonalDialog(false)} sx={buttonStyles.cancelButton}>Cancel</Button>
          <Button onClick={handleSavePersonal} variant="contained" sx={buttonStyles.primaryButton}>Save</Button>
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
              label="End Date"
              type="date"
              value={editOrderData.endDate || ''}
              onChange={(e) => setEditOrderData({ ...editOrderData, endDate: e.target.value })}
              onFocus={handleAutoSelect}
              InputLabelProps={{
                shrink: true,
              }}
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
          <Button onClick={() => setEditOrderDialog(false)} sx={buttonStyles.cancelButton}>Cancel</Button>
          <Button onClick={handleSaveOrder} variant="contained" sx={buttonStyles.primaryButton}>Save</Button>
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
          <Button onClick={() => setEditPaymentDialog(false)} sx={buttonStyles.cancelButton}>Cancel</Button>
          <Button onClick={handleSavePayment} variant="contained" sx={buttonStyles.primaryButton}>Save</Button>
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
                    
                    {/* Row 1: Material Company - Material Code - Treatment - Unit */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 2 }}>
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
                      <FormControl fullWidth size="small">
                        <Select
                          value={group.unit || 'Yard'}
                          onChange={(e) => updateFurnitureGroup(index, 'unit', e.target.value)}
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
                          <MenuItem value="Yard">Yard</MenuItem>
                          <MenuItem value="SQF">SQF</MenuItem>
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
                    <Box sx={{ mb: 2, p: 2, backgroundColor: '#f8f9fa', borderRadius: 1, border: '1px solid #e0e0e0' }}>
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
          <Button onClick={() => setEditFurnitureDialog(false)} sx={buttonStyles.cancelButton}>Cancel</Button>
          <Button onClick={handleSaveFurnitureGroup} variant="contained" sx={buttonStyles.primaryButton}>Save</Button>
        </DialogActions>
      </Dialog>


      {/* Edit Additional Notes Dialog */}
      <Dialog open={editAdditionalNotesDialog} onClose={() => setEditAdditionalNotesDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Additional Notes</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Additional Notes"
              multiline
              rows={6}
              value={editAdditionalNotesData.notes || ''}
              onChange={(e) => setEditAdditionalNotesData({ ...editAdditionalNotesData, notes: e.target.value })}
              onFocus={handleAutoSelect}
              placeholder="Enter any additional notes or special instructions"
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
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditAdditionalNotesDialog(false)} sx={buttonStyles.cancelButton}>Cancel</Button>
          <Button onClick={handleSaveAdditionalNotes} variant="contained" sx={buttonStyles.primaryButton}>Save</Button>
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
                      ${selectedOrder.orderType === 'corporate' ? (selectedOrder.paymentDetails?.amountPaid || '0.00') : (selectedOrder.paymentData?.amountPaid || '0.00')}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ color: '#b98f33', fontWeight: 600, mb: 1 }}>Remaining Balance</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#ff9800' }}>
                      ${(calculateInvoiceTotals(selectedOrder).grandTotal - (parseFloat(selectedOrder.orderType === 'corporate' ? selectedOrder.paymentDetails?.amountPaid : selectedOrder.paymentData?.amountPaid || 0))).toFixed(2)}
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
                            {formatDate(payment.date)}
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
            sx={buttonStyles.cancelButton}
          >
            Cancel
          </Button>
          <Button 
            onClick={() => updateInvoiceStatus(selectedOrder.id, editingStatus)}
            variant="contained"
            disabled={!editingStatus}
            size="small"
            sx={buttonStyles.primaryButton}
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
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #b98f33 0%, #8b6b1f 100%)',
          color: '#000000',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: 2
        }}>
          <AssignmentIcon />
          Payment Validation Required
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#3a3a3a', p: 3 }}>
          <Typography variant="body1" sx={{ mb: 3, color: '#ffffff' }}>
            {validationError.message}
          </Typography>
          
          {validationError.type === 'done' && (
            <Button 
              variant="contained"
              onClick={handleMakeFullyPaid}
              fullWidth
              sx={{ 
                mb: 2,
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
                ...buttonStyles.primaryButton
              }}
              startIcon={<CancelIcon />}
            >
              Refund ${validationError.currentAmount.toFixed(2)} and Cancel
            </Button>
          )}
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#3a3a3a' }}>
          <Button 
            onClick={() => setValidationDialogOpen(false)}
            sx={buttonStyles.cancelButton}
          >
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
          background: 'linear-gradient(135deg, #b98f33 0%, #8b6b1f 100%)',
          color: '#000000',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: 2
        }}>
          <AssignmentIcon />
          Order Completion & Financial Allocation
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
                      {calculateTotals(monthlyAllocations).totalPercentage.toFixed(1)}%
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#000000' }}>
                      ${calculateTotals(monthlyAllocations).totalRevenue.toFixed(2)}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#000000' }}>
                      ${calculateTotals(monthlyAllocations).totalCost.toFixed(2)}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#000000' }}>
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
            sx={buttonStyles.cancelButton}
          >
            Cancel
          </Button>
          <Button 
            onClick={applyAllocation}
            disabled={Math.abs(calculateTotals(monthlyAllocations).totalPercentage - 100) > 0.01}
            sx={buttonStyles.primaryButton}
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

      {/* Standalone Allocation Dialog */}
      <Dialog 
        open={standaloneAllocationDialogOpen && !standaloneAllocationDialogHidden} 
        onClose={() => setStandaloneAllocationDialogOpen(false)} 
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
          {selectedOrderForStandaloneAllocation && (
            <Box sx={{ mb: 3, p: 2, backgroundColor: '#2a2a2a', borderRadius: 1, border: '1px solid #b98f33' }}>
              <Typography variant="h6" sx={{ mb: 1, color: '#b98f33', fontWeight: 'bold' }}>Order Summary</Typography>
              <Typography variant="body2" sx={{ color: '#ffffff' }}>
                <strong style={{ color: '#b98f33' }}>Order #:</strong> {selectedOrderForStandaloneAllocation.orderDetails?.billInvoice}
              </Typography>
              <Typography variant="body2" sx={{ color: '#ffffff' }}>
                <strong style={{ color: '#b98f33' }}>Customer:</strong> {selectedOrderForStandaloneAllocation.personalInfo?.customerName}
              </Typography>
              <Typography variant="body2" sx={{ color: '#ffffff' }}>
                <strong style={{ color: '#b98f33' }}>Total Revenue:</strong> ${standaloneTotalRevenue.toFixed(2)}
              </Typography>
              <Typography variant="body2" sx={{ color: '#ffffff' }}>
                <strong style={{ color: '#b98f33' }}>Total Cost:</strong> ${standaloneTotalCost.toFixed(2)}
              </Typography>
              <Typography variant="body2" sx={{ color: '#ffffff' }}>
                <strong style={{ color: '#b98f33' }}>Total Profit:</strong> ${(standaloneTotalRevenue - standaloneTotalCost).toFixed(2)}
              </Typography>
              {selectedOrderForStandaloneAllocation.allocation && selectedOrderForStandaloneAllocation.allocation.allocations && (
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
                  value={standaloneStartDate && standaloneStartDate instanceof Date && !isNaN(standaloneStartDate) ? standaloneStartDate.toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    const date = new Date(e.target.value);
                    if (!isNaN(date.getTime())) {
                      setStandaloneStartDate(date);
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
                  value={standaloneEndDate && standaloneEndDate instanceof Date && !isNaN(standaloneEndDate) ? standaloneEndDate.toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    const date = new Date(e.target.value);
                    if (!isNaN(date.getTime())) {
                      setStandaloneEndDate(date);
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
                  onClick={handleStandaloneSaveDates}
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
              onClick={resetStandaloneAllocationToDefault}
              sx={buttonStyles.cancelButton}
            >
              Reset to Default
            </Button>
          </Box>

          {/* Financial Allocation Table */}
          {standaloneShowAllocationTable && (
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
                  {standaloneMonthlyAllocations.map((allocation, index) => {
                    const revenue = (standaloneTotalRevenue * allocation.percentage / 100);
                    const cost = (standaloneTotalCost * allocation.percentage / 100);
                    const profit = revenue - cost;
                    
                    return (
                      <TableRow key={index} sx={{ backgroundColor: '#3a3a3a', '&:hover': { backgroundColor: '#4a4a4a' } }}>
                        <TableCell sx={{ color: '#ffffff' }}>{allocation.label}</TableCell>
                        <TableCell>
                          <TextField
                            type="number"
                            value={allocation.percentage}
                            onChange={(e) => updateStandaloneAllocationPercentage(index, e.target.value)}
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
                      {calculateStandaloneTotals(standaloneMonthlyAllocations).totalPercentage.toFixed(1)}%
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#000000' }}>
                      ${calculateStandaloneTotals(standaloneMonthlyAllocations).totalRevenue.toFixed(2)}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#000000' }}>
                      ${calculateStandaloneTotals(standaloneMonthlyAllocations).totalCost.toFixed(2)}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#000000' }}>
                      ${calculateStandaloneTotals(standaloneMonthlyAllocations).totalProfit.toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
            
            {/* Allocation Status */}
            {standaloneShowAllocationTable && (
              <Box sx={{ mt: 2 }}>
                {(() => {
                  const status = getStandaloneAllocationStatus();
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
            {standaloneShowAllocationTable && getStandaloneAllocationStatus().status === 'valid' && (
              <Box sx={{ mt: 3, p: 2, backgroundColor: '#2a2a2a', borderRadius: 1, border: '1px solid #b98f33' }}>
                <Typography variant="h6" sx={{ mb: 1, color: '#b98f33', fontWeight: 'bold' }}>Allocation Summary</Typography>
                <Typography variant="body2" sx={{ mb: 1, color: '#ffffff' }}>
                  <strong style={{ color: '#b98f33' }}>Order:</strong> {selectedOrderForStandaloneAllocation?.orderDetails?.billInvoice || selectedOrderForStandaloneAllocation?.id}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1, color: '#ffffff' }}>
                  <strong style={{ color: '#b98f33' }}>Date Range:</strong> {(() => {
                    try {
                      const startDateStr = standaloneStartDate?.toDate ? standaloneStartDate.toDate().toLocaleDateString() :
                        (standaloneStartDate?.seconds ? new Date(standaloneStartDate.seconds * 1000).toLocaleDateString() :
                        (standaloneStartDate ? new Date(standaloneStartDate).toLocaleDateString() : 'Not set'));
                      const endDateStr = standaloneEndDate?.toDate ? standaloneEndDate.toDate().toLocaleDateString() :
                        (standaloneEndDate?.seconds ? new Date(standaloneEndDate.seconds * 1000).toLocaleDateString() :
                        (standaloneEndDate ? new Date(standaloneEndDate).toLocaleDateString() : 'Not set'));
                      return `${startDateStr} - ${endDateStr}`;
                    } catch (error) {
                      console.error('Error formatting date range:', error);
                      return 'Invalid Date Range';
                    }
                  })()}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1, color: '#ffffff' }}>
                  <strong style={{ color: '#b98f33' }}>Total Revenue:</strong> {formatCurrency(standaloneTotalRevenue)}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1, color: '#ffffff' }}>
                  <strong style={{ color: '#b98f33' }}>Total Cost:</strong> {formatCurrency(standaloneTotalCost)}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1, color: '#ffffff' }}>
                  <strong style={{ color: '#b98f33' }}>Total Profit:</strong> {formatCurrency(standaloneTotalRevenue - standaloneTotalCost)}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1, color: '#ffffff' }}>
                  <strong style={{ color: '#b98f33' }}>Allocation Breakdown:</strong>
                </Typography>
                <Box sx={{ ml: 2 }}>
                  {standaloneMonthlyAllocations.map((allocation, index) => (
                    <Typography key={index} variant="body2" sx={{ fontSize: '0.875rem', color: '#ffffff' }}>
                      • {allocation.label}: {allocation.percentage.toFixed(1)}% ({formatCurrency(standaloneTotalRevenue * allocation.percentage / 100)})
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
            onClick={() => setStandaloneAllocationDialogOpen(false)}
            sx={buttonStyles.cancelButton}
          >
            Cancel
          </Button>
          <Button 
            onClick={applyStandaloneAllocation}
            variant="contained"
            disabled={Math.abs(calculateStandaloneTotals(standaloneMonthlyAllocations).totalPercentage - 100) > 0.01}
            size="small"
            sx={buttonStyles.primaryButton}
          >
            {(() => {
              const status = getStandaloneAllocationStatus();
              if (status.status === 'valid') {
                return 'Apply Allocation';
              } else if (status.status === 'over') {
                return 'Total Exceeds 100% - Cannot Apply';
              } else {
                return `${Math.abs(100 - calculateStandaloneTotals(standaloneMonthlyAllocations).totalPercentage).toFixed(1)}% Remaining`;
              }
            })()}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Extra Expense Modal */}
      <Dialog open={expenseModalOpen} onClose={handleCloseExpenseModal} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #b98f33 0%, #8b6b1f 100%)',
          color: '#000000',
          fontWeight: 'bold'
        }}>
          Add Extra Expense
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#3a3a3a' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Bill No"
              value={selectedOrder?.orderDetails?.billInvoice || ''}
              InputProps={{ readOnly: true }}
              fullWidth
              sx={{ 
                backgroundColor: '#2a2a2a',
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
            <TextField
              label="Expense Description"
              name="description"
              value={expenseForm.description}
              onChange={handleExpenseInputChange}
              fullWidth
              required
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
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Price"
                name="price"
                value={expenseForm.price}
                onChange={handleExpenseInputChange}
                type="number"
                fullWidth
                required
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
              <TextField
                label="Unit"
                name="unit"
                value={expenseForm.unit}
                onChange={handleExpenseInputChange}
                fullWidth
                required
                placeholder="e.g. 1, hour, piece"
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
            </Box>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <TextField
                label={expenseForm.taxType === 'percent' ? 'Tax (%)' : 'Tax (Fixed)'}
                name="tax"
                value={expenseForm.tax}
                onChange={handleExpenseInputChange}
                type="number"
                fullWidth
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
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end" sx={{ p: 0, m: 0 }}>
                      <Select
                        value={expenseForm.taxType}
                        onChange={handleTaxTypeChange}
                        variant="standard"
                        disableUnderline
                        sx={{ 
                          minWidth: 48, 
                          maxWidth: 60, 
                          background: 'transparent', 
                          ml: 0.5, 
                          '& .MuiSelect-select': { 
                            p: 0, 
                            pr: 1, 
                            fontWeight: 'bold', 
                            color: '#b98f33' 
                          } 
                        }}
                        MenuProps={{
                          PaperProps: {
                            sx: { 
                              minWidth: 80,
                              backgroundColor: '#2a2a2a',
                              '& .MuiMenuItem-root': {
                                color: '#ffffff',
                                '&:hover': {
                                  backgroundColor: '#3a3a3a',
                                },
                              },
                            }
                          }
                        }}
                      >
                        <MenuItem value="fixed">$</MenuItem>
                        <MenuItem value="percent">%</MenuItem>
                      </Select>
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="Tax Value"
                name="taxValue"
                value={expenseForm.taxValue || ''}
                InputProps={{ readOnly: true, style: { color: '#b98f33', fontWeight: 'bold' } }}
                fullWidth
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
                }}
              />
              <TextField
                label="Total"
                name="total"
                value={expenseForm.total}
                onChange={handleExpenseInputChange}
                type="number"
                fullWidth
                InputProps={{ style: { fontWeight: 'bold', color: '#b98f33' } }}
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
                }}
              />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Tooltip title="Add to list">
                <span>
                  <IconButton
                    sx={{
                      color: '#b98f33',
                      '&:hover': {
                        backgroundColor: 'rgba(185, 143, 51, 0.1)',
                      },
                    }}
                    onClick={handleAddExpenseToList}
                    disabled={!(expenseForm.description && expenseForm.price && expenseForm.unit)}
                  >
                    <AddIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
            {/* List of added expenses */}
            {expenseList.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#b98f33', mb: 1 }}>
                  Added Expenses
                </Typography>
                {expenseList.map((exp, idx) => (
                  <Box key={idx} sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 2, 
                    mb: 1, 
                    backgroundColor: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)',
                    border: '1px solid #333333',
                    p: 1, 
                    borderRadius: 1,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}>
                    <Typography sx={{ flex: 2, color: '#ffffff' }}>{exp.description}</Typography>
                    <Typography sx={{ flex: 1, color: '#b98f33' }}>{exp.price}</Typography>
                    <Typography sx={{ flex: 1, color: '#ffffff' }}>{exp.unit}</Typography>
                    <Typography sx={{ flex: 1, color: '#b98f33' }}>{exp.taxType === 'percent' ? `${((exp.tax / (exp.price * (isNaN(Number(exp.unit)) ? 1 : parseFloat(exp.unit) || 1))) * 100).toFixed(2)}%` : exp.tax}</Typography>
                    <Typography sx={{ flex: 1, fontWeight: 'bold', color: '#b98f33' }}>{exp.total}</Typography>
                    <IconButton 
                      sx={{
                        color: '#ff6b6b',
                        '&:hover': {
                          backgroundColor: 'rgba(255, 107, 107, 0.1)',
                        },
                      }}
                      onClick={() => handleDeleteExpense(idx)} 
                      size="small"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#3a3a3a' }}>
          <Button 
            onClick={handleCloseExpenseModal}
            sx={buttonStyles.cancelButton}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSaveAllExpenses} 
            disabled={expenseList.length === 0} 
            variant="contained"
            sx={buttonStyles.primaryButton}
          >
            Save All
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Expense Modal */}
      <Dialog open={editExpenseModalOpen} onClose={() => setEditExpenseModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #b98f33 0%, #8b6b1f 100%)',
          color: '#000000',
          fontWeight: 'bold'
        }}>
          Edit Extra Expense
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#3a3a3a' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Expense Description"
              value={editExpenseForm.description}
              onChange={(e) => handleEditExpenseInputChange('description', e.target.value)}
              fullWidth
              required
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
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Price"
                value={editExpenseForm.price}
                onChange={(e) => handleEditExpenseInputChange('price', e.target.value)}
                type="number"
                fullWidth
                required
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
              <TextField
                label="Unit"
                value={editExpenseForm.unit}
                onChange={(e) => handleEditExpenseInputChange('unit', e.target.value)}
                fullWidth
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
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Tax"
                value={editExpenseForm.tax}
                onChange={(e) => handleEditExpenseInputChange('tax', e.target.value)}
                type="number"
                fullWidth
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
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end" sx={{ p: 0, m: 0 }}>
                      <Select
                        value={editExpenseForm.taxType}
                        onChange={(e) => handleEditExpenseInputChange('taxType', e.target.value)}
                        variant="standard"
                        disableUnderline
                        sx={{ 
                          minWidth: 48, 
                          maxWidth: 60, 
                          background: 'transparent', 
                          ml: 0.5, 
                          '& .MuiSelect-select': { 
                            p: 0, 
                            pr: 1, 
                            fontWeight: 'bold', 
                            color: '#b98f33' 
                          } 
                        }}
                        MenuProps={{
                          PaperProps: {
                            sx: { 
                              minWidth: 80,
                              backgroundColor: '#2a2a2a',
                              '& .MuiMenuItem-root': {
                                color: '#ffffff',
                                '&:hover': {
                                  backgroundColor: '#3a3a3a',
                                },
                              },
                            }
                          }
                        }}
                      >
                        <MenuItem value="fixed">$</MenuItem>
                        <MenuItem value="percent">%</MenuItem>
                      </Select>
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="Total"
                value={editExpenseForm.total}
                InputProps={{ readOnly: true }}
                fullWidth
                sx={{
                  backgroundColor: '#2a2a2a',
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
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#3a3a3a' }}>
          <Button 
            onClick={() => setEditExpenseModalOpen(false)}
            sx={buttonStyles.cancelButton}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSaveEditedExpense} 
            variant="contained"
            sx={buttonStyles.primaryButton}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Expense Confirmation Dialog */}
      <Dialog 
        open={deleteExpenseDialogOpen} 
        onClose={() => setDeleteExpenseDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#3a3a3a',
            border: '2px solid #ff6b6b',
            borderRadius: '10px',
            color: '#ffffff'
          }
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #ff6b6b 0%, #ff5252 100%)',
          color: '#ffffff',
          fontWeight: 'bold',
          textAlign: 'center'
        }}>
          <DeleteIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Delete Expense
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="body1" sx={{ color: '#ffffff', textAlign: 'center', mb: 2 }}>
            Are you sure you want to delete this expense?
          </Typography>
          {expenseToDelete && (
            <Box sx={{ 
              backgroundColor: '#2a2a2a', 
              p: 2, 
              borderRadius: '8px', 
              border: '1px solid #ff6b6b',
              mb: 2
            }}>
              <Typography variant="body2" sx={{ color: '#d4af5a', fontWeight: 'bold', mb: 1 }}>
                {expenseToDelete.expense.description}
              </Typography>
              <Typography variant="body2" sx={{ color: '#ffffff' }}>
                Amount: ${parseFloat(expenseToDelete.expense.total || 0).toFixed(2)}
              </Typography>
            </Box>
          )}
          <Typography variant="body2" sx={{ color: '#ffcccb', textAlign: 'center' }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
          <Button 
            onClick={() => setDeleteExpenseDialogOpen(false)}
            sx={{
              backgroundColor: '#666666',
              color: '#ffffff',
              '&:hover': {
                backgroundColor: '#777777'
              },
              mr: 2
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmDeleteExpense}
            variant="contained"
            sx={{
              backgroundColor: '#ff6b6b',
              color: '#ffffff',
              '&:hover': {
                backgroundColor: '#ff5252'
              }
            }}
          >
            Delete Expense
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
            sx={buttonStyles.cancelButton}
          >
            Cancel
          </Button>
          <Button
            onClick={() => handleEnhancedConfirm(sendEmailChecked, includeReviewChecked)}
            sx={buttonStyles.primaryButton}
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
            sx={buttonStyles.cancelButton}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCompletionEmailConfirm}
            disabled={!completionEmailDialog.sendEmail}
            sx={buttonStyles.primaryButton}
          >
            Send Email
          </Button>
        </DialogActions>
      </Dialog>

      {/* Pending Status Dialog */}
      <Dialog open={pendingDialogOpen} onClose={() => setPendingDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <AccessTimeIcon sx={{ mr: 1, color: '#ff9800' }} />
            Set Order to Pending
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedOrderForPending && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Order #{selectedOrderForPending.orderDetails?.billInvoice}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Customer: {selectedOrderForPending.personalInfo?.name}
              </Typography>
              
              <Alert severity="info" sx={{ mb: 2 }}>
                This will set the order to pending status and clear any payment amounts. Please provide the expected resume date and any notes.
              </Alert>

              <TextField
                fullWidth
                label="Expected Resume Date"
                type="date"
                value={pendingForm.expectedResumeDate}
                onChange={(e) => setPendingForm({ ...pendingForm, expectedResumeDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
                required
                sx={{ mb: 2 }}
                inputProps={{
                  min: new Date().toISOString().split('T')[0] // Prevent past dates
                }}
              />

              <TextField
                fullWidth
                label="Pending Notes"
                multiline
                rows={3}
                value={pendingForm.pendingNotes}
                onChange={(e) => setPendingForm({ ...pendingForm, pendingNotes: e.target.value })}
                placeholder="Enter any notes about why the order is being postponed..."
                sx={{ mb: 2 }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setPendingDialogOpen(false)}
            sx={buttonStyles.cancelButton}
          >
            Cancel
          </Button>
          <Button
            onClick={handlePendingSubmit}
            variant="contained"
            startIcon={<AccessTimeIcon />}
            sx={buttonStyles.primaryButton}
          >
            Set to Pending
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </>
  );
};

export default WorkshopPage;
