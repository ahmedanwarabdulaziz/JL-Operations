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
  Business as BusinessIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { collection, getDocs, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../../shared/components/Common/NotificationSystem';
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [materialCompanies, setMaterialCompanies] = useState([]);
  
  // Business expenses dialog state
  const [businessExpenseDialogOpen, setBusinessExpenseDialogOpen] = useState(false);
  const [businessExpenseForm, setBusinessExpenseForm] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    quantity: '',
    price: '',
    taxType: 'percent',
    tax: '',
    total: 0
  });
  const [savingBusinessExpense, setSavingBusinessExpense] = useState(false);
  
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
      
      // Fetch orders, corporate orders, done orders, general expenses, business expenses, and material companies
      const [ordersSnapshot, corporateOrdersSnapshot, doneOrdersSnapshot, generalExpensesSnapshot, businessExpensesSnapshot, companiesSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'corporate-orders'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'done-orders'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'generalExpenses'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'businessExpenses'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'materialCompanies'), orderBy('createdAt', 'asc')))
      ]);
      
      const ordersData = [];
      const allExpenses = [];
      
      // Extract order-based extra expenses from regular orders
      ordersSnapshot.forEach((doc) => {
        const orderData = { id: doc.id, ...doc.data(), orderType: 'regular' };
        ordersData.push(orderData);
        
        // Extract extra expenses with order context
        if (orderData.extraExpenses && Array.isArray(orderData.extraExpenses)) {
          orderData.extraExpenses.forEach((expense, index) => {
            allExpenses.push({
              id: `${orderData.id}_${index}`,
              orderId: orderData.id,
              orderBillNumber: orderData.orderDetails?.billInvoice || 'N/A',
              customerName: orderData.personalInfo?.customerName || orderData.personalInfo?.name || 'Unknown',
              customerEmail: orderData.personalInfo?.email || '',
              orderDate: orderData.createdAt || orderData.orderDetails?.orderDate || '',
              orderStatus: orderData.invoiceStatus || 'Unknown',
              description: expense.description || 'Extra Expense',
              price: parseFloat(expense.price) || 0,
              unit: expense.unit || '',
              tax: parseFloat(expense.tax) || 0,
              taxType: expense.taxType || 'fixed',
              total: parseFloat(expense.total) || 0,
              originalExpense: expense,
              expenseType: 'order-specific',
              orderType: 'regular'
            });
          });
        }
      });
      
      // Extract order-based extra expenses from corporate orders
      corporateOrdersSnapshot.forEach((doc) => {
        const orderData = { id: doc.id, ...doc.data(), orderType: 'corporate' };
        ordersData.push(orderData);
        
          // Extract extra expenses with order context
          if (orderData.extraExpenses && Array.isArray(orderData.extraExpenses)) {
            orderData.extraExpenses.forEach((expense, index) => {
              const price = parseFloat(expense.price) || 0;
              const quantity = parseFloat(expense.quantity) || parseFloat(expense.unit) || 1;
              const tax = parseFloat(expense.tax) || 0;
              const taxType = expense.taxType || 'fixed';
              
              // Calculate tax amount based on tax type
              let taxAmount = 0;
              if (taxType === 'percent') {
                taxAmount = (price * quantity * tax) / 100;
              } else {
                taxAmount = tax;
              }
              
              const total = (price * quantity) + taxAmount;
              
              allExpenses.push({
                id: `corporate_${orderData.id}_${index}`,
                orderId: orderData.id,
                orderBillNumber: orderData.orderDetails?.billInvoice || 'N/A',
                customerName: orderData.corporateCustomer?.corporateName || 'Corporate Customer',
                customerEmail: orderData.contactPerson?.email || orderData.corporateCustomer?.email || '',
                orderDate: orderData.createdAt || orderData.orderDetails?.orderDate || '',
                orderStatus: orderData.invoiceStatus || 'Unknown',
                description: expense.description || 'Extra Expense',
                price: price,
                unit: expense.unit || '',
                tax: tax,
                taxType: taxType,
                total: total,
                originalExpense: expense,
                expenseType: 'order-specific',
                orderType: 'corporate'
              });
            });
          }
      });
      
      // Extract order-based extra expenses from done orders (closed corporate orders)
      doneOrdersSnapshot.forEach((doc) => {
        const orderData = { id: doc.id, ...doc.data() };
        ordersData.push(orderData);
        
        // Only process corporate orders from done-orders
        if (orderData.orderType === 'corporate') {
          // Extract extra expenses with order context
          if (orderData.extraExpenses && Array.isArray(orderData.extraExpenses)) {
            orderData.extraExpenses.forEach((expense, index) => {
              const price = parseFloat(expense.price) || 0;
              const quantity = parseFloat(expense.quantity) || parseFloat(expense.unit) || 1;
              const tax = parseFloat(expense.tax) || 0;
              const taxType = expense.taxType || 'fixed';
              
              // Calculate tax amount based on tax type
              let taxAmount = 0;
              if (taxType === 'percent') {
                taxAmount = (price * quantity * tax) / 100;
              } else {
                taxAmount = tax;
              }
              
              const total = (price * quantity) + taxAmount;
              
              allExpenses.push({
                id: `done_corporate_${orderData.id}_${index}`,
                orderId: orderData.id,
                orderBillNumber: orderData.orderDetails?.billInvoice || 'N/A',
                customerName: orderData.corporateCustomer?.corporateName || 'Corporate Customer',
                customerEmail: orderData.contactPerson?.email || orderData.corporateCustomer?.email || '',
                orderDate: orderData.createdAt || orderData.orderDetails?.orderDate || '',
                orderStatus: 'Completed',
                description: expense.description || 'Extra Expense',
                price: price,
                unit: expense.unit || '',
                tax: tax,
                taxType: taxType,
                total: total,
                category: expense.category || 'Other',
                date: expense.date || orderData.createdAt || '',
                originalExpense: expense,
                expenseType: 'order-specific',
                orderType: 'corporate'
              });
            });
          }
        }
      });
      
      // Extract general expenses
      generalExpensesSnapshot.forEach((doc) => {
        const generalExpense = { id: doc.id, ...doc.data() };
        allExpenses.push({
          id: `general_${generalExpense.id}`,
          orderId: 'general',
          orderBillNumber: 'GENERAL',
          customerName: 'General Expense',
          customerEmail: '',
          orderDate: generalExpense.createdAt || generalExpense.date || '',
          orderStatus: 'General',
          description: generalExpense.description || `${generalExpense.materialCode} - ${generalExpense.materialCompany}`,
          price: parseFloat(generalExpense.price) || 0,
          unit: `${generalExpense.quantity}`,
          tax: parseFloat(generalExpense.tax) || 0,
          taxType: generalExpense.taxType || 'percent',
          total: parseFloat(generalExpense.total) || 0,
          originalExpense: generalExpense,
          expenseType: 'general',
          materialCompany: generalExpense.materialCompany,
          materialCode: generalExpense.materialCode,
          quantity: generalExpense.quantity,
          // Include all fields needed for editing
          date: generalExpense.date,
          createdAt: generalExpense.createdAt,
          updatedAt: generalExpense.updatedAt
        });
      });
      
      // Extract business expenses
      businessExpensesSnapshot.forEach((doc) => {
        const businessExpense = { id: doc.id, ...doc.data() };
        allExpenses.push({
          id: `business_${businessExpense.id}`,
          orderId: 'business',
          orderBillNumber: 'BUSINESS',
          customerName: 'Business Expense',
          customerEmail: '',
          orderDate: businessExpense.createdAt || businessExpense.date || '',
          orderStatus: 'Business',
          description: businessExpense.description || 'Business Expense',
          price: parseFloat(businessExpense.price) || 0,
          unit: `${businessExpense.quantity}`,
          tax: parseFloat(businessExpense.tax) || 0,
          taxType: businessExpense.taxType || 'percent',
          total: parseFloat(businessExpense.total) || 0,
          originalExpense: businessExpense,
          expenseType: 'business',
          quantity: businessExpense.quantity,
          // Include all fields needed for editing
          date: businessExpense.date,
          createdAt: businessExpense.createdAt,
          updatedAt: businessExpense.updatedAt
        });
      });
      
      // Process material companies
      const companiesData = companiesSnapshot.docs.map((doc, index) => ({
        id: doc.id,
        order: doc.data().order ?? index,
        ...doc.data()
      }));
      
      // Sort companies by order field
      companiesData.sort((a, b) => a.order - b.order);
      setMaterialCompanies(companiesData);
      
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
        expense.customerEmail.toLowerCase().includes(searchLower) ||
        (expense.orderType === 'corporate' ? 'corporate' : 'regular').includes(searchLower)
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
    
    // Expense type filter
    if (expenseTypeFilter !== 'all') {
      if (expenseTypeFilter === 'general') {
        filtered = filtered.filter(expense => expense.expenseType === 'general');
      } else if (expenseTypeFilter === 'business') {
        filtered = filtered.filter(expense => expense.expenseType === 'business');
      } else if (expenseTypeFilter === 'order-specific') {
        filtered = filtered.filter(expense => expense.expenseType === 'order-specific');
      } else if (expenseTypeFilter === 'taxed') {
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

  // Fetch material companies when edit dialog opens
  useEffect(() => {
    if (editDialogOpen && materialCompanies.length === 0) {
      const fetchMaterialCompanies = async () => {
        try {
          const companiesSnapshot = await getDocs(query(collection(db, 'materialCompanies'), orderBy('createdAt', 'asc')));
          const companiesData = companiesSnapshot.docs.map((doc, index) => ({
            id: doc.id,
            order: doc.data().order ?? index,
            ...doc.data()
          }));
          companiesData.sort((a, b) => a.order - b.order);
          setMaterialCompanies(companiesData);
          console.log('Fetched material companies:', companiesData);
        } catch (error) {
          console.error('Error fetching material companies:', error);
        }
      };
      fetchMaterialCompanies();
    }
  }, [editDialogOpen, materialCompanies.length]);

  const handleViewOrder = (orderId, orderType) => {
    if (orderId === 'general') {
      navigate('/material-request');
    } else if (orderId === 'business') {
      // Business expenses don't have a separate page, do nothing or show a message
      showError('Business expenses can only be managed from this page');
    } else {
      navigate(`/workshop`);
      // Could add logic to select the specific order
    }
  };

  const openDeleteDialog = (expense) => {
    setExpenseToDelete(expense);
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setExpenseToDelete(null);
  };

  const deleteExpense = async () => {
    if (!expenseToDelete) return;
    
    try {
      setDeleting(true);
      
      if (expenseToDelete.expenseType === 'general') {
        // Delete from generalExpenses collection
        const expenseRef = doc(db, 'generalExpenses', expenseToDelete.id.replace('general_', ''));
        await deleteDoc(expenseRef);
        showSuccess('General expense deleted successfully');
      } else if (expenseToDelete.expenseType === 'business') {
        // Delete from businessExpenses collection
        const expenseRef = doc(db, 'businessExpenses', expenseToDelete.id.replace('business_', ''));
        await deleteDoc(expenseRef);
        showSuccess('Business expense deleted successfully');
      } else {
        // For order-specific expenses, we would need to update the order
        // For now, just show a message that this needs to be done from the order page
        showError('Order-specific expenses must be deleted from the order page');
        return;
      }
      
      closeDeleteDialog();
      
      // Refresh expenses
      fetchOrders();
      
    } catch (error) {
      console.error('Error deleting expense:', error);
      showError('Failed to delete expense');
    } finally {
      setDeleting(false);
    }
  };

  // Edit functionality
  const openEditDialog = (expense) => {
    if (expense.expenseType === 'general' || expense.expenseType === 'business') {
      const firebaseId = expense.id.replace(`${expense.expenseType}_`, '');
      console.log('Opening edit dialog for expense:', expense);
      console.log('Firebase ID:', firebaseId);
      console.log('Material companies available:', materialCompanies);
      console.log('Current material company:', expense.materialCompany);
      
      setExpenseToEdit({
        ...expense,
        firebaseId: firebaseId
      });
      setEditDialogOpen(true);
    } else {
      showError('Order-specific expenses must be edited from the order page');
    }
  };

  const closeEditDialog = () => {
    setEditDialogOpen(false);
    setExpenseToEdit(null);
  };

  const handleEditInputChange = (field, value) => {
    if (!expenseToEdit) return;
    
    const updatedExpense = { ...expenseToEdit, [field]: value };
    
    // Calculate total when price, quantity, or tax changes
    if (field === 'price' || field === 'quantity' || field === 'tax' || field === 'taxType') {
      const price = parseFloat(updatedExpense.price) || 0;
      const quantity = parseFloat(updatedExpense.quantity) || 0;
      const taxValue = parseFloat(updatedExpense.tax) || 0;
      
      let taxAmount = 0;
      if (updatedExpense.taxType === 'percent') {
        taxAmount = (price * quantity * taxValue) / 100;
      } else {
        taxAmount = taxValue;
      }
      
      updatedExpense.total = (price * quantity + taxAmount).toFixed(2);
    }
    
    setExpenseToEdit(updatedExpense);
  };

  const validateEditForm = () => {
    if (!expenseToEdit) return false;
    
    const { materialCompany, materialCode, quantity, price, tax } = expenseToEdit;
    
    if (!materialCompany || !materialCode || !quantity || !price || !tax) {
      showError('All fields except description are required');
      return false;
    }
    
    if (parseFloat(quantity) <= 0 || parseFloat(price) <= 0 || parseFloat(tax) < 0) {
      showError('Quantity and price must be greater than 0, tax cannot be negative');
      return false;
    }
    
    return true;
  };

  const saveEditExpense = async () => {
    if (!validateEditForm()) {
      console.log('Validation failed');
      return;
    }
    
    if (!expenseToEdit || !expenseToEdit.firebaseId) {
      console.error('Missing expenseToEdit or firebaseId:', expenseToEdit);
      showError('Invalid expense data');
      return;
    }
    
    try {
      setSaving(true);
      
      // Ensure all fields have valid values
      const expenseData = {
        description: expenseToEdit.description || '',
        materialCompany: expenseToEdit.materialCompany || '',
        materialCode: expenseToEdit.materialCode || '',
        quantity: parseFloat(expenseToEdit.quantity) || 0,
        price: parseFloat(expenseToEdit.price) || 0,
        taxType: expenseToEdit.taxType || 'percent',
        tax: parseFloat(expenseToEdit.tax) || 0,
        total: parseFloat(expenseToEdit.total) || 0,
        date: expenseToEdit.date || new Date().toISOString().split('T')[0],
        updatedAt: new Date()
      };
      
      // Remove any undefined values
      Object.keys(expenseData).forEach(key => {
        if (expenseData[key] === undefined) {
          delete expenseData[key];
        }
      });
      
      console.log('Updating expense with data:', expenseData);
      console.log('Firebase ID:', expenseToEdit.firebaseId);
      
      const collectionName = expenseToEdit.expenseType === 'business' ? 'businessExpenses' : 'generalExpenses';
      const expenseRef = doc(db, collectionName, expenseToEdit.firebaseId);
      await updateDoc(expenseRef, expenseData);
      
      console.log('Expense updated successfully');
      showSuccess(`${expenseToEdit.expenseType === 'business' ? 'Business' : 'General'} expense updated successfully`);
      closeEditDialog();
      
      // Refresh expenses
      fetchOrders();
      
    } catch (error) {
      console.error('Error updating expense:', error);
      showError(`Failed to update expense: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Business expense handlers
  const openBusinessExpenseDialog = () => {
    setBusinessExpenseForm({
      date: new Date().toISOString().split('T')[0],
      description: '',
      quantity: '',
      price: '',
      taxType: 'percent',
      tax: '',
      total: 0
    });
    setBusinessExpenseDialogOpen(true);
  };

  const closeBusinessExpenseDialog = () => {
    setBusinessExpenseDialogOpen(false);
    setBusinessExpenseForm({
      date: new Date().toISOString().split('T')[0],
      description: '',
      quantity: '',
      price: '',
      taxType: 'percent',
      tax: '',
      total: 0
    });
  };

  const handleBusinessExpenseInputChange = (field, value) => {
    const newForm = { ...businessExpenseForm, [field]: value };
    
    // Calculate total when price, quantity, or tax changes
    if (field === 'price' || field === 'quantity' || field === 'tax' || field === 'taxType') {
      const price = parseFloat(field === 'price' ? value : newForm.price) || 0;
      const quantity = parseFloat(field === 'quantity' ? value : newForm.quantity) || 0;
      const tax = parseFloat(field === 'tax' ? value : newForm.tax) || 0;
      const taxType = field === 'taxType' ? value : newForm.taxType;
      
      let taxAmount = 0;
      if (taxType === 'percent') {
        taxAmount = (price * quantity * tax) / 100;
      } else {
        taxAmount = tax;
      }
      
      newForm.total = (price * quantity) + taxAmount;
    }
    
    setBusinessExpenseForm(newForm);
  };

  const validateBusinessExpenseForm = () => {
    const { date, quantity, price, tax } = businessExpenseForm;
    
    if (!date || !quantity || !price || !tax) {
      showError('All fields except description are required');
      return false;
    }
    
    if (parseFloat(quantity) <= 0 || parseFloat(price) <= 0 || parseFloat(tax) < 0) {
      showError('Quantity and price must be greater than 0, tax cannot be negative');
      return false;
    }
    
    return true;
  };

  const saveBusinessExpense = async () => {
    if (!validateBusinessExpenseForm()) return;
    
    try {
      setSavingBusinessExpense(true);
      
      const businessExpenseData = {
        ...businessExpenseForm,
        quantity: parseFloat(businessExpenseForm.quantity),
        price: parseFloat(businessExpenseForm.price),
        tax: parseFloat(businessExpenseForm.tax),
        total: parseFloat(businessExpenseForm.total),
        type: 'business',
        createdAt: new Date()
      };
      
      await addDoc(collection(db, 'businessExpenses'), businessExpenseData);
      
      showSuccess('Business expense added successfully');
      closeBusinessExpenseDialog();
      
      // Refresh expenses to show the new business expense
      fetchOrders();
    } catch (error) {
      console.error('Error saving business expense:', error);
      showError('Failed to save business expense');
    } finally {
      setSavingBusinessExpense(false);
    }
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

      {/* Filters and Actions */}
      <Paper sx={{ p: 3, mb: 3, backgroundColor: '#2a2a2a', border: '1px solid #444444' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ color: '#d4af5a', display: 'flex', alignItems: 'center', gap: 1 }}>
            <FilterListIcon />
            Filters
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openBusinessExpenseDialog}
            sx={{
              backgroundColor: '#f27921',
              '&:hover': {
                backgroundColor: '#e67e22'
              },
              color: '#000000',
              fontWeight: 'bold'
            }}
          >
            Business Expenses
          </Button>
        </Box>
        
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
                <MenuItem value="general">General</MenuItem>
                <MenuItem value="business">Business</MenuItem>
                <MenuItem value="order-specific">Order-Specific</MenuItem>
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
                <TableCell sx={{ color: '#d4af5a', fontWeight: 'bold' }}>Type</TableCell>
                <TableCell sx={{ color: '#d4af5a', fontWeight: 'bold' }}>Order Type</TableCell>
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
                  <TableCell colSpan={12} sx={{ textAlign: 'center', py: 4 }}>
                    <CircularProgress sx={{ color: '#d4af5a' }} />
                    <Typography variant="body2" sx={{ color: '#ffffff', mt: 2 }}>
                      Loading expenses...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : filteredExpenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} sx={{ textAlign: 'center', py: 4 }}>
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
                      {expense.expenseType === 'general' && (
                        <Typography variant="caption" sx={{ color: '#d4af5a', fontSize: '0.7rem' }}>
                          {expense.materialCompany} • {expense.quantity} units
                        </Typography>
                      )}
                    </TableCell>
                    
                    <TableCell>
                      <Chip 
                        label={
                          expense.expenseType === 'general' ? 'General' : 
                          expense.expenseType === 'business' ? 'Business' : 
                          'Order-Specific'
                        }
                        size="small"
                        sx={{ 
                          backgroundColor: 
                            expense.expenseType === 'general' ? '#f27921' : 
                            expense.expenseType === 'business' ? '#9c27b0' : 
                            '#2196f3',
                          color: '#ffffff',
                          fontWeight: 'medium',
                          fontSize: '0.7rem'
                        }}
                      />
                    </TableCell>
                    
                    <TableCell>
                      {expense.orderType && (
                        <Chip 
                          label={expense.orderType === 'corporate' ? 'Corporate' : 'Individual'}
                          size="small"
                          sx={{ 
                            backgroundColor: expense.orderType === 'corporate' ? '#f27921' : '#274290',
                            color: '#ffffff',
                            fontWeight: 'medium',
                            fontSize: '0.7rem'
                          }}
                        />
                      )}
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
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="View Order">
                          <IconButton
                            size="small"
                            onClick={() => handleViewOrder(expense.orderId, expense.orderType)}
                            sx={{ color: '#d4af5a' }}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        {(expense.expenseType === 'general' || expense.expenseType === 'business') && (
                          <>
                            <Tooltip title="Edit Expense">
                              <IconButton
                                size="small"
                                onClick={() => openEditDialog(expense)}
                                sx={{ color: '#2196f3' }}
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Expense">
                              <IconButton
                                size="small"
                                onClick={() => openDeleteDialog(expense)}
                                sx={{ color: '#f44336' }}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={closeDeleteDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{
          background: 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <DeleteIcon />
          Delete Expense
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Are you sure you want to delete this expense?
          </Typography>
          {expenseToDelete && (
            <Box sx={{ p: 2, backgroundColor: '#f5f5f5', borderRadius: 1, border: '1px solid #ddd' }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                {expenseToDelete.description}
              </Typography>
              <Typography variant="caption" sx={{ color: '#666' }}>
                {expenseToDelete.expenseType === 'general' ? 'General Expense' : 'Order-Specific'} • 
                {expenseToDelete.materialCompany && ` ${expenseToDelete.materialCompany} •`}
                {expenseToDelete.quantity && ` ${expenseToDelete.quantity} •`}
                {formatCurrency(expenseToDelete.total)}
              </Typography>
            </Box>
          )}
          <Alert severity="warning" sx={{ mt: 2 }}>
            This action cannot be undone. The expense will be permanently removed from the system.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 2 }}>
          <Button
            onClick={closeDeleteDialog}
            sx={buttonStyles.cancelButton}
          >
            Cancel
          </Button>
          <Button
            onClick={deleteExpense}
            variant="contained"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} sx={{ color: '#000000' }} /> : <DeleteIcon sx={{ color: '#000000' }} />}
            sx={{
              backgroundColor: '#f44336',
              '&:hover': {
                backgroundColor: '#d32f2f'
              },
              '&:disabled': {
                backgroundColor: '#a0a0a0'
              }
            }}
          >
            {deleting ? 'Deleting...' : 'Delete Expense'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Expense Dialog */}
      <Dialog open={editDialogOpen} onClose={closeEditDialog} maxWidth="md" fullWidth>
        <DialogTitle sx={{
          background: 'linear-gradient(135deg, #f27921 0%, #e67e22 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <EditIcon />
          Edit General Expense
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {expenseToEdit && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Description Field */}
              <TextField
                fullWidth
                label="Description"
                value={expenseToEdit.description || ''}
                onChange={(e) => handleEditInputChange('description', e.target.value)}
                placeholder="Enter expense description (optional)"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#8b6b1f' },
                    '&:hover fieldset': { borderColor: '#b98f33' },
                    '&.Mui-focused fieldset': { borderColor: '#b98f33' }
                  }
                }}
              />

              {/* Date Field */}
              <TextField
                fullWidth
                label="Date"
                type="date"
                value={expenseToEdit.date || new Date().toISOString().split('T')[0]}
                onChange={(e) => handleEditInputChange('date', e.target.value)}
                InputLabelProps={{ shrink: true }}
                required
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#8b6b1f' },
                    '&:hover fieldset': { borderColor: '#b98f33' },
                    '&.Mui-focused fieldset': { borderColor: '#b98f33' }
                  }
                }}
              />

              {/* Material Company and Material Code - Only for General Expenses */}
              {expenseToEdit.expenseType === 'general' && (
                <>
                  {/* Date and Material Company Row */}
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <FormControl fullWidth required>
                      <InputLabel>Material Company</InputLabel>
                      <Select
                        value={expenseToEdit.materialCompany || ''}
                        onChange={(e) => handleEditInputChange('materialCompany', e.target.value)}
                        label="Material Company"
                        displayEmpty
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            '& fieldset': { borderColor: '#8b6b1f' },
                            '&:hover fieldset': { borderColor: '#b98f33' },
                            '&.Mui-focused fieldset': { borderColor: '#b98f33' }
                          }
                        }}
                      >
                        <MenuItem value="" disabled>
                          {materialCompanies.length === 0 ? 'Loading companies...' : 'Select Material Company'}
                        </MenuItem>
                        {materialCompanies.map((company) => (
                          <MenuItem key={company.id} value={company.name}>
                            {company.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>

                  {/* Material Code Field */}
                  <TextField
                    fullWidth
                    label="Material Code"
                    value={expenseToEdit.materialCode || ''}
                    onChange={(e) => handleEditInputChange('materialCode', e.target.value)}
                    placeholder="Enter material code"
                    required
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': { borderColor: '#8b6b1f' },
                        '&:hover fieldset': { borderColor: '#b98f33' },
                        '&.Mui-focused fieldset': { borderColor: '#b98f33' }
                      }
                    }}
                  />
                </>
              )}

              {/* Quantity Field */}
              <TextField
                fullWidth
                label="Quantity"
                type="number"
                value={expenseToEdit.quantity || ''}
                onChange={(e) => handleEditInputChange('quantity', e.target.value)}
                placeholder="0"
                required
                inputProps={{ min: 0, step: 0.1 }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#8b6b1f' },
                    '&:hover fieldset': { borderColor: '#b98f33' },
                    '&.Mui-focused fieldset': { borderColor: '#b98f33' }
                  }
                }}
              />

              {/* Price Row */}
              <TextField
                fullWidth
                label="Price"
                type="number"
                value={expenseToEdit.price || ''}
                onChange={(e) => handleEditInputChange('price', e.target.value)}
                placeholder="0.00"
                required
                inputProps={{ min: 0, step: 0.01 }}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#8b6b1f' },
                    '&:hover fieldset': { borderColor: '#b98f33' },
                    '&.Mui-focused fieldset': { borderColor: '#b98f33' }
                  }
                }}
              />

              {/* Tax Type and Tax Amount Row */}
              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Tax Type</InputLabel>
                  <Select
                    value={expenseToEdit.taxType || 'percent'}
                    onChange={(e) => handleEditInputChange('taxType', e.target.value)}
                    label="Tax Type"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': { borderColor: '#8b6b1f' },
                        '&:hover fieldset': { borderColor: '#b98f33' },
                        '&.Mui-focused fieldset': { borderColor: '#b98f33' }
                      }
                    }}
                  >
                    <MenuItem value="percent">Percentage (%)</MenuItem>
                    <MenuItem value="fixed">Fixed Amount ($)</MenuItem>
                  </Select>
                </FormControl>
                
                <TextField
                  fullWidth
                  label={expenseToEdit.taxType === 'percent' ? 'Tax Percentage' : 'Tax Amount'}
                  type="number"
                  value={expenseToEdit.tax || ''}
                  onChange={(e) => handleEditInputChange('tax', e.target.value)}
                  placeholder="0"
                  required
                  inputProps={{ min: 0, step: 0.01 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        {expenseToEdit.taxType === 'percent' ? '%' : '$'}
                      </InputAdornment>
                    )
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: '#8b6b1f' },
                      '&:hover fieldset': { borderColor: '#b98f33' },
                      '&.Mui-focused fieldset': { borderColor: '#b98f33' }
                    }
                  }}
                />
              </Box>
              
              {/* Total Calculation Display */}
              <Alert severity="info" sx={{ mt: 1 }}>
                <Typography variant="body2">
                  <strong>Total: ${expenseToEdit.total || 0}</strong>
                  <br />
                  Calculation: (${expenseToEdit.price || 0} × {expenseToEdit.quantity || 0}) + Tax
                </Typography>
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 2 }}>
          <Button
            onClick={closeEditDialog}
            sx={buttonStyles.cancelButton}
          >
            Cancel
          </Button>
          <Button
            onClick={saveEditExpense}
            variant="contained"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} sx={{ color: '#000000' }} /> : <SaveIcon sx={{ color: '#000000' }} />}
            sx={buttonStyles.primaryButton}
          >
            {saving ? 'Saving...' : 'Update Expense'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Business Expenses Dialog */}
      <Dialog open={businessExpenseDialogOpen} onClose={closeBusinessExpenseDialog} maxWidth="md" fullWidth>
        <DialogTitle sx={{
          background: 'linear-gradient(135deg, #f27921 0%, #e67e22 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <AddIcon />
          Add Business Expense
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Description Field */}
            <TextField
              fullWidth
              label="Description"
              value={businessExpenseForm.description}
              onChange={(e) => handleBusinessExpenseInputChange('description', e.target.value)}
              placeholder="Enter expense description (optional)"
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: '#8b6b1f' },
                  '&:hover fieldset': { borderColor: '#b98f33' },
                  '&.Mui-focused fieldset': { borderColor: '#b98f33' }
                }
              }}
            />

            {/* Date Field */}
            <TextField
              fullWidth
              label="Date"
              type="date"
              value={businessExpenseForm.date}
              onChange={(e) => handleBusinessExpenseInputChange('date', e.target.value)}
              InputLabelProps={{ shrink: true }}
              required
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: '#8b6b1f' },
                  '&:hover fieldset': { borderColor: '#b98f33' },
                  '&.Mui-focused fieldset': { borderColor: '#b98f33' }
                }
              }}
            />

            {/* Quantity and Price Row */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Quantity"
                type="number"
                value={businessExpenseForm.quantity}
                onChange={(e) => handleBusinessExpenseInputChange('quantity', e.target.value)}
                placeholder="0"
                required
                inputProps={{ min: 0, step: 0.1 }}
                sx={{
                  minWidth: '120px',
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#8b6b1f' },
                    '&:hover fieldset': { borderColor: '#b98f33' },
                    '&.Mui-focused fieldset': { borderColor: '#b98f33' }
                  }
                }}
              />
              
              <TextField
                fullWidth
                label="Price"
                type="number"
                value={businessExpenseForm.price}
                onChange={(e) => handleBusinessExpenseInputChange('price', e.target.value)}
                placeholder="0.00"
                required
                inputProps={{ min: 0, step: 0.01 }}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#8b6b1f' },
                    '&:hover fieldset': { borderColor: '#b98f33' },
                    '&.Mui-focused fieldset': { borderColor: '#b98f33' }
                  }
                }}
              />
            </Box>

            {/* Tax Type and Tax Amount Row */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Tax Type</InputLabel>
                <Select
                  value={businessExpenseForm.taxType}
                  onChange={(e) => handleBusinessExpenseInputChange('taxType', e.target.value)}
                  label="Tax Type"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: '#8b6b1f' },
                      '&:hover fieldset': { borderColor: '#b98f33' },
                      '&.Mui-focused fieldset': { borderColor: '#b98f33' }
                    }
                  }}
                >
                  <MenuItem value="percent">Percentage (%)</MenuItem>
                  <MenuItem value="fixed">Fixed Amount ($)</MenuItem>
                </Select>
              </FormControl>
              
              <TextField
                fullWidth
                label={businessExpenseForm.taxType === 'percent' ? 'Tax Percentage' : 'Tax Amount'}
                type="number"
                value={businessExpenseForm.tax}
                onChange={(e) => handleBusinessExpenseInputChange('tax', e.target.value)}
                placeholder="0"
                required
                inputProps={{ min: 0, step: 0.01 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      {businessExpenseForm.taxType === 'percent' ? '%' : '$'}
                    </InputAdornment>
                  )
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#8b6b1f' },
                    '&:hover fieldset': { borderColor: '#b98f33' },
                    '&.Mui-focused fieldset': { borderColor: '#b98f33' }
                  }
                }}
              />
            </Box>
            
            {/* Total Calculation Display */}
            <Alert severity="info" sx={{ mt: 1 }}>
              <Typography variant="body2">
                <strong>Total: ${businessExpenseForm.total}</strong>
                <br />
                Calculation: (${businessExpenseForm.price || 0} × {businessExpenseForm.quantity || 0}) + Tax
              </Typography>
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 2 }}>
          <Button
            onClick={closeBusinessExpenseDialog}
            sx={buttonStyles.cancelButton}
          >
            Cancel
          </Button>
          <Button
            onClick={saveBusinessExpense}
            variant="contained"
            disabled={savingBusinessExpense}
            startIcon={savingBusinessExpense ? <CircularProgress size={16} sx={{ color: '#000000' }} /> : <SaveIcon sx={{ color: '#000000' }} />}
            sx={buttonStyles.primaryButton}
          >
            {savingBusinessExpense ? 'Saving...' : 'Save Business Expense'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ExtraExpensesPage;
