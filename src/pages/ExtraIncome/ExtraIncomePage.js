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
import { collection, getDocs, query, orderBy, deleteDoc, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../../shared/components/Common/NotificationSystem';
import { formatDate, formatDateOnly } from '../../utils/dateUtils';
import { buttonStyles } from '../../styles/buttonStyles';

const ExtraIncomesPage = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  
  const [orders, setOrders] = useState([]);
  const [extraIncome, setExtraIncomes] = useState([]);
  const [filteredIncomes, setFilteredIncomes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [incomeTypeFilter, setIncomeTypeFilter] = useState('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [incomeToDelete, setIncomeToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [incomeToEdit, setIncomeToEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [materialCompanies, setMaterialCompanies] = useState([]);
  
  // Business incomes dialog state
  const [businessIncomeDialogOpen, setBusinessIncomeDialogOpen] = useState(false);
  const [businessIncomeForm, setBusinessIncomeForm] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    quantity: '',
    price: '',
    taxType: 'percent',
    tax: '',
    total: 0
  });
  const [savingBusinessIncome, setSavingBusinessIncome] = useState(false);
  
  // Home incomes dialog state
  const [homeIncomeDialogOpen, setHomeIncomeDialogOpen] = useState(false);
  const [homeIncomeForm, setHomeIncomeForm] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    quantity: '',
    price: '',
    taxType: 'percent',
    tax: '',
    total: 0
  });
  const [savingHomeIncome, setSavingHomeIncome] = useState(false);
  
  // Regular monthly incomes dialog state
  const [regularMonthlyIncomesDialogOpen, setRegularMonthlyIncomesDialogOpen] = useState(false);
  const [regularMonthlyIncomes, setRegularMonthlyIncomes] = useState([]);
  const [loadingRegularMonthlyIncomes, setLoadingRegularMonthlyIncomes] = useState(false);
  const [addRegularMonthlyIncomeDialogOpen, setAddRegularMonthlyIncomeDialogOpen] = useState(false);
  const [regularMonthlyIncomeForm, setRegularMonthlyIncomeForm] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    quantity: '',
    price: '',
    taxType: 'percent',
    tax: '',
    total: 0,
    type: 'business' // 'business' or 'home'
  });
  const [savingRegularMonthlyIncome, setSavingRegularMonthlyIncome] = useState(false);
  const [addingIncomeFromRegular, setAddingIncomeFromRegular] = useState(false);
  const [editingIncomes, setEditingIncomes] = useState({}); // Track edited incomes by id
  
  // Summary statistics
  const [summaryStats, setSummaryStats] = useState({
    totalIncomes: 0,
    totalAmount: 0,
    averageIncome: 0,
    incomeCount: 0,
    ordersWithIncomes: 0,
    totalTaxAmount: 0,
    incomeCategories: {},
    monthlyBreakdown: {}
  });

  // Fetch all orders and extract extra incomes
  const fetchOrders = async () => {
    try {
      setLoading(true);
      
      // Fetch orders, corporate orders, done orders, general incomes, business incomes, regular monthly incomes, and material companies
      const [ordersSnapshot, corporateOrdersSnapshot, doneOrdersSnapshot, generalIncomeSnapshot, businessIncomeSnapshot, regularMonthlyIncomesSnapshot, companiesSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'corporate-orders'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'done-orders'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'generalIncome'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'businessIncome'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'regularMonthlyIncomes'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'materialCompanies'), orderBy('createdAt', 'asc')))
      ]);
      
      const ordersData = [];
      const allIncomes = [];
      
      // Extract order-based extra incomes from regular orders
      ordersSnapshot.forEach((doc) => {
        const orderData = { id: doc.id, ...doc.data(), orderType: 'regular' };
        ordersData.push(orderData);
        
        // Extract extra incomes with order context
        if (orderData.extraIncome && Array.isArray(orderData.extraIncome)) {
          orderData.extraIncome.forEach((income, index) => {
            allIncomes.push({
              id: `${orderData.id}_${index}`,
              orderId: orderData.id,
              orderBillNumber: orderData.orderDetails?.billInvoice || 'N/A',
              customerName: orderData.personalInfo?.customerName || orderData.personalInfo?.name || 'Unknown',
              customerEmail: orderData.personalInfo?.email || '',
              orderDate: orderData.createdAt || orderData.orderDetails?.orderDate || '',
              orderStatus: orderData.invoiceStatus || 'Unknown',
              description: income.description || 'Extra Income',
              price: parseFloat(income.price) || 0,
              unit: income.unit || '',
              tax: parseFloat(income.tax) || 0,
              taxType: income.taxType || 'fixed',
              total: parseFloat(income.total) || 0,
              originalIncome: income,
              incomeType: 'order-specific',
              orderType: 'regular'
            });
          });
        }
      });
      
      // Extract order-based extra incomes from corporate orders
      corporateOrdersSnapshot.forEach((doc) => {
        const orderData = { id: doc.id, ...doc.data(), orderType: 'corporate' };
        ordersData.push(orderData);
        
          // Extract extra incomes with order context
          if (orderData.extraIncome && Array.isArray(orderData.extraIncome)) {
            orderData.extraIncome.forEach((income, index) => {
              const price = parseFloat(income.price) || 0;
              const quantity = parseFloat(income.quantity) || parseFloat(income.unit) || 1;
              const tax = parseFloat(income.tax) || 0;
              const taxType = income.taxType || 'fixed';
              
              // Calculate tax amount based on tax type
              let taxAmount = 0;
              if (taxType === 'percent') {
                taxAmount = (price * quantity * tax) / 100;
              } else {
                taxAmount = tax;
              }
              
              const total = (price * quantity) + taxAmount;
              
              allIncomes.push({
                id: `corporate_${orderData.id}_${index}`,
                orderId: orderData.id,
                orderBillNumber: orderData.orderDetails?.billInvoice || 'N/A',
                customerName: orderData.corporateCustomer?.corporateName || 'Corporate Customer',
                customerEmail: orderData.contactPerson?.email || orderData.corporateCustomer?.email || '',
                orderDate: orderData.createdAt || orderData.orderDetails?.orderDate || '',
                orderStatus: orderData.invoiceStatus || 'Unknown',
                description: income.description || 'Extra Income',
                price: price,
                unit: income.unit || '',
                tax: tax,
                taxType: taxType,
                total: total,
                originalIncome: income,
                incomeType: 'order-specific',
                orderType: 'corporate'
              });
            });
          }
      });
      
      // Extract order-based extra incomes from done orders (closed corporate orders)
      doneOrdersSnapshot.forEach((doc) => {
        const orderData = { id: doc.id, ...doc.data() };
        ordersData.push(orderData);
        
        // Only process corporate orders from done-orders
        if (orderData.orderType === 'corporate') {
          // Extract extra incomes with order context
          if (orderData.extraIncome && Array.isArray(orderData.extraIncome)) {
            orderData.extraIncome.forEach((income, index) => {
              const price = parseFloat(income.price) || 0;
              const quantity = parseFloat(income.quantity) || parseFloat(income.unit) || 1;
              const tax = parseFloat(income.tax) || 0;
              const taxType = income.taxType || 'fixed';
              
              // Calculate tax amount based on tax type
              let taxAmount = 0;
              if (taxType === 'percent') {
                taxAmount = (price * quantity * tax) / 100;
              } else {
                taxAmount = tax;
              }
              
              const total = (price * quantity) + taxAmount;
              
              allIncomes.push({
                id: `done_corporate_${orderData.id}_${index}`,
                orderId: orderData.id,
                orderBillNumber: orderData.orderDetails?.billInvoice || 'N/A',
                customerName: orderData.corporateCustomer?.corporateName || 'Corporate Customer',
                customerEmail: orderData.contactPerson?.email || orderData.corporateCustomer?.email || '',
                orderDate: orderData.createdAt || orderData.orderDetails?.orderDate || '',
                orderStatus: 'Completed',
                description: income.description || 'Extra Income',
                price: price,
                unit: income.unit || '',
                tax: tax,
                taxType: taxType,
                total: total,
                category: income.category || 'Other',
                date: income.date || orderData.createdAt || '',
                originalIncome: income,
                incomeType: 'order-specific',
                orderType: 'corporate'
              });
            });
          }
        }
      });
      
      // Extract general incomes
      generalIncomeSnapshot.forEach((doc) => {
        const generalIncome = { id: doc.id, ...doc.data() };
        allIncomes.push({
          id: `general_${generalIncome.id}`,
          orderId: 'general',
          orderBillNumber: 'GENERAL',
          customerName: 'General Income',
          customerEmail: '',
          orderDate: generalIncome.date || generalIncome.createdAt || '',
          orderStatus: 'General',
          description: generalIncome.description || `${generalIncome.materialCode} - ${generalIncome.materialCompany}`,
          price: parseFloat(generalIncome.price) || 0,
          unit: `${generalIncome.quantity}`,
          tax: parseFloat(generalIncome.tax) || 0,
          taxType: generalIncome.taxType || 'percent',
          total: parseFloat(generalIncome.total) || 0,
          originalIncome: generalIncome,
          incomeType: 'general',
          materialCompany: generalIncome.materialCompany,
          materialCode: generalIncome.materialCode,
          quantity: generalIncome.quantity,
          // Include all fields needed for editing
          date: generalIncome.date,
          createdAt: generalIncome.createdAt,
          updatedAt: generalIncome.updatedAt
        });
      });
      
      // Extract business and home incomes
      businessIncomeSnapshot.forEach((doc) => {
        const income = { id: doc.id, ...doc.data() };
        const incomeType = income.type || 'business'; // Default to 'business' for backward compatibility
        const isHomeIncome = incomeType === 'home';
        
        allIncomes.push({
          id: `${incomeType}_${income.id}`,
          orderId: incomeType,
          orderBillNumber: isHomeIncome ? 'HOME' : 'BUSINESS',
          customerName: isHomeIncome ? 'Home Income' : 'Business Income',
          customerEmail: '',
          orderDate: income.date || income.createdAt || '',
          orderStatus: isHomeIncome ? 'Home' : 'Business',
          description: income.description || (isHomeIncome ? 'Home Income' : 'Business Income'),
          price: parseFloat(income.price) || 0,
          unit: `${income.quantity}`,
          tax: parseFloat(income.tax) || 0,
          taxType: income.taxType || 'percent',
          total: parseFloat(income.total) || 0,
          originalIncome: income,
          incomeType: incomeType,
          quantity: income.quantity,
          // Include all fields needed for editing
          date: income.date,
          createdAt: income.createdAt,
          updatedAt: income.updatedAt
        });
      });
      
      // Process regular monthly incomes
      const regularMonthlyIncomesData = regularMonthlyIncomesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setRegularMonthlyIncomes(regularMonthlyIncomesData);
      
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
      setExtraIncomes(allIncomes);
      setFilteredIncomes(allIncomes);
      
      // Calculate summary statistics
      calculateSummaryStats(allIncomes);
      
    } catch (error) {
      console.error('Error fetching orders:', error);
      showError(`Failed to fetch orders: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const calculateSummaryStats = (incomes) => {
    const totalAmount = incomes.reduce((sum, exp) => sum + exp.total, 0);
    const incomeCount = incomes.length;
    const ordersWithIncomes = new Set(incomes.map(exp => exp.orderId)).size;
    const averageIncome = incomeCount > 0 ? totalAmount / incomeCount : 0;
    const totalTaxAmount = incomes.reduce((sum, exp) => sum + exp.tax, 0);
    
    // Calculate income categories (based on description keywords)
    const categories = {};
    incomes.forEach(exp => {
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
    incomes.forEach(exp => {
      if (exp.orderDate) {
        const date = new Date(exp.orderDate);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyBreakdown[monthKey] = (monthlyBreakdown[monthKey] || 0) + exp.total;
      }
    });
    
    setSummaryStats({
      totalIncomes: totalAmount,
      totalAmount,
      averageIncome,
      incomeCount,
      ordersWithIncomes,
      totalTaxAmount,
      incomeCategories: categories,
      monthlyBreakdown
    });
  };

  // Filter incomes based on search and filters
  const filterIncomes = () => {
    // Exclude Order-Specific incomes - they are already shown in their invoice
    let filtered = extraIncome.filter(income => income.incomeType !== 'order-specific');
    
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(income => 
        income.description.toLowerCase().includes(searchLower) ||
        income.customerName.toLowerCase().includes(searchLower) ||
        income.orderBillNumber.toLowerCase().includes(searchLower) ||
        income.customerEmail.toLowerCase().includes(searchLower) ||
        (income.orderType === 'corporate' ? 'corporate' : 'regular').includes(searchLower)
      );
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(income => income.orderStatus === statusFilter);
    }
    
    // Date range filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filtered = filtered.filter(income => {
        const incomeDate = new Date(income.orderDate);
        return incomeDate >= fromDate;
      });
    }
    
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999); // Include entire end date
      filtered = filtered.filter(income => {
        const incomeDate = new Date(income.orderDate);
        return incomeDate <= toDate;
      });
    }
    
    // Income type filter
    if (incomeTypeFilter !== 'all') {
      if (incomeTypeFilter === 'general') {
        filtered = filtered.filter(income => income.incomeType === 'general');
      } else if (incomeTypeFilter === 'business') {
        filtered = filtered.filter(income => income.incomeType === 'business');
      } else if (incomeTypeFilter === 'home') {
        filtered = filtered.filter(income => income.incomeType === 'home');
      } else if (incomeTypeFilter === 'taxed') {
        filtered = filtered.filter(income => income.tax > 0);
      } else if (incomeTypeFilter === 'no_tax') {
        filtered = filtered.filter(income => income.tax === 0);
      }
    }
    
    // Sort by date: newest first
    filtered.sort((a, b) => {
      const dateA = a.orderDate?.toDate ? a.orderDate.toDate() : new Date(a.orderDate || 0);
      const dateB = b.orderDate?.toDate ? b.orderDate.toDate() : new Date(b.orderDate || 0);
      return dateB - dateA;
    });
    
    setFilteredIncomes(filtered);
    calculateSummaryStats(filtered);
  };

  useEffect(() => {
    filterIncomes();
  }, [searchTerm, statusFilter, dateFrom, dateTo, incomeTypeFilter, extraIncome]);

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
      navigate('/admin/material-track');
    } else if (orderId === 'business') {
      // Business incomes don't have a separate page, do nothing or show a message
      showError('Business incomes can only be managed from this page');
    } else {
      navigate(`/workshop`);
      // Could add logic to select the specific order
    }
  };

  const openDeleteDialog = (income) => {
    setIncomeToDelete(income);
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setIncomeToDelete(null);
  };

  const deleteIncome = async () => {
    if (!incomeToDelete) return;
    
    try {
      setDeleting(true);
      
      if (incomeToDelete.incomeType === 'general') {
        // Delete from generalIncome collection
        const incomeRef = doc(db, 'generalIncome', incomeToDelete.id.replace('general_', ''));
        await deleteDoc(incomeRef);
        showSuccess('General income deleted successfully');
      } else if (incomeToDelete.incomeType === 'business' || incomeToDelete.incomeType === 'home') {
        // Delete from businessIncome collection (both business and home incomes are stored there)
        const incomeId = incomeToDelete.id.replace('business_', '').replace('home_', '');
        const incomeRef = doc(db, 'businessIncome', incomeId);
        await deleteDoc(incomeRef);
        const incomeTypeLabel = incomeToDelete.incomeType === 'home' ? 'Home' : 'Business';
        showSuccess(`${incomeTypeLabel} income deleted successfully`);
      } else {
        // For order-specific incomes, we would need to update the order
        // For now, just show a message that this needs to be done from the order page
        showError('Order-specific incomes must be deleted from the order page');
        return;
      }
      
      closeDeleteDialog();
      
      // Refresh incomes
      fetchOrders();
      
    } catch (error) {
      console.error('Error deleting income:', error);
      showError('Failed to delete income');
    } finally {
      setDeleting(false);
    }
  };

  // Edit functionality
  const openEditDialog = (income) => {
    if (income.incomeType === 'general' || income.incomeType === 'business') {
      const firebaseId = income.id.replace(`${income.incomeType}_`, '');
      console.log('Opening edit dialog for income:', income);
      console.log('Firebase ID:', firebaseId);
      console.log('Material companies available:', materialCompanies);
      console.log('Current material company:', income.materialCompany);
      
      setIncomeToEdit({
        ...income,
        firebaseId: firebaseId
      });
      setEditDialogOpen(true);
    } else {
      showError('Order-specific incomes must be edited from the order page');
    }
  };

  const closeEditDialog = () => {
    setEditDialogOpen(false);
    setIncomeToEdit(null);
  };

  const handleEditInputChange = (field, value) => {
    if (!incomeToEdit) return;
    
    const updatedIncome = { ...incomeToEdit, [field]: value };
    
    // Calculate total when price, quantity, or tax changes
    if (field === 'price' || field === 'quantity' || field === 'tax' || field === 'taxType') {
      const price = parseFloat(updatedIncome.price) || 0;
      const quantity = parseFloat(updatedIncome.quantity) || 0;
      const taxValue = parseFloat(updatedIncome.tax) || 0;
      
      let taxAmount = 0;
      if (updatedIncome.taxType === 'percent') {
        taxAmount = (price * quantity * taxValue) / 100;
      } else {
        taxAmount = taxValue;
      }
      
      updatedIncome.total = (price * quantity + taxAmount).toFixed(2);
    }
    
    setIncomeToEdit(updatedIncome);
  };

  const validateEditForm = () => {
    if (!incomeToEdit) return false;
    
    const { materialCompany, materialCode, quantity, price, tax } = incomeToEdit;
    
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

  const saveEditIncome = async () => {
    if (!validateEditForm()) {
      console.log('Validation failed');
      return;
    }
    
    if (!incomeToEdit || !incomeToEdit.firebaseId) {
      console.error('Missing incomeToEdit or firebaseId:', incomeToEdit);
      showError('Invalid income data');
      return;
    }
    
    try {
      setSaving(true);
      
      // Ensure all fields have valid values
      const incomeData = {
        description: incomeToEdit.description || '',
        materialCompany: incomeToEdit.materialCompany || '',
        materialCode: incomeToEdit.materialCode || '',
        quantity: parseFloat(incomeToEdit.quantity) || 0,
        price: parseFloat(incomeToEdit.price) || 0,
        taxType: incomeToEdit.taxType || 'percent',
        tax: parseFloat(incomeToEdit.tax) || 0,
        total: parseFloat(incomeToEdit.total) || 0,
        date: incomeToEdit.date || new Date().toISOString().split('T')[0],
        updatedAt: new Date()
      };
      
      // Remove any undefined values
      Object.keys(incomeData).forEach(key => {
        if (incomeData[key] === undefined) {
          delete incomeData[key];
        }
      });
      
      console.log('Updating income with data:', incomeData);
      console.log('Firebase ID:', incomeToEdit.firebaseId);
      
      const collectionName = (incomeToEdit.incomeType === 'business' || incomeToEdit.incomeType === 'home') ? 'businessIncome' : 'generalIncome';
      const incomeRef = doc(db, collectionName, incomeToEdit.firebaseId);
      await updateDoc(incomeRef, incomeData);
      
      console.log('Income updated successfully');
      const incomeTypeLabel = incomeToEdit.incomeType === 'business' ? 'Business' : 
                               incomeToEdit.incomeType === 'home' ? 'Home' : 'General';
      showSuccess(`${incomeTypeLabel} income updated successfully`);
      closeEditDialog();
      
      // Refresh incomes
      fetchOrders();
      
    } catch (error) {
      console.error('Error updating income:', error);
      showError(`Failed to update income: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Business income handlers
  const openBusinessIncomeDialog = () => {
    setBusinessIncomeForm({
      date: new Date().toISOString().split('T')[0],
      description: '',
      quantity: '',
      price: '',
      taxType: 'percent',
      tax: '',
      total: 0
    });
    setBusinessIncomeDialogOpen(true);
  };

  const openHomeIncomeDialog = () => {
    setHomeIncomeForm({
      date: new Date().toISOString().split('T')[0],
      description: '',
      quantity: '',
      price: '',
      taxType: 'percent',
      tax: '',
      total: 0
    });
    setHomeIncomeDialogOpen(true);
  };

  const closeBusinessIncomeDialog = () => {
    setBusinessIncomeDialogOpen(false);
    setBusinessIncomeForm({
      date: new Date().toISOString().split('T')[0],
      description: '',
      quantity: '',
      price: '',
      taxType: 'percent',
      tax: '',
      total: 0
    });
  };

  const closeHomeIncomeDialog = () => {
    setHomeIncomeDialogOpen(false);
    setHomeIncomeForm({
      date: new Date().toISOString().split('T')[0],
      description: '',
      quantity: '',
      price: '',
      taxType: 'percent',
      tax: '',
      total: 0
    });
  };

  const handleBusinessIncomeInputChange = (field, value) => {
    const newForm = { ...businessIncomeForm, [field]: value };
    
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
    
    setBusinessIncomeForm(newForm);
  };

  const handleHomeIncomeInputChange = (field, value) => {
    const newForm = { ...homeIncomeForm, [field]: value };
    
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
    
    setHomeIncomeForm(newForm);
  };

  const validateBusinessIncomeForm = () => {
    const { date, quantity, price, tax } = businessIncomeForm;
    
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

  const validateHomeIncomeForm = () => {
    const { date, quantity, price, tax } = homeIncomeForm;
    
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

  const saveBusinessIncome = async () => {
    if (!validateBusinessIncomeForm()) return;
    
    try {
      setSavingBusinessIncome(true);
      
      // Recalculate total to ensure it's correct before saving
      const quantity = parseFloat(businessIncomeForm.quantity) || 0;
      const price = parseFloat(businessIncomeForm.price) || 0;
      const tax = parseFloat(businessIncomeForm.tax) || 0;
      const taxType = businessIncomeForm.taxType || 'percent';
      
      let taxAmount = 0;
      if (taxType === 'percent') {
        taxAmount = (price * quantity * tax) / 100;
      } else {
        taxAmount = tax;
      }
      
      const calculatedTotal = (price * quantity) + taxAmount;
      
      const businessIncomeData = {
        date: businessIncomeForm.date,
        description: businessIncomeForm.description || '',
        quantity: quantity,
        price: price,
        taxType: taxType,
        tax: tax,
        total: calculatedTotal,
        type: 'business',
        createdAt: new Date()
      };
      
      await addDoc(collection(db, 'businessIncome'), businessIncomeData);
      
      showSuccess('Business income added successfully');
      closeBusinessIncomeDialog();
      
      // Refresh incomes to show the new business income
      fetchOrders();
    } catch (error) {
      console.error('Error saving business income:', error);
      showError('Failed to save business income');
    } finally {
      setSavingBusinessIncome(false);
    }
  };

  const saveHomeIncome = async () => {
    if (!validateHomeIncomeForm()) return;
    
    try {
      setSavingHomeIncome(true);
      
      // Recalculate total to ensure it's correct before saving
      const quantity = parseFloat(homeIncomeForm.quantity) || 0;
      const price = parseFloat(homeIncomeForm.price) || 0;
      const tax = parseFloat(homeIncomeForm.tax) || 0;
      const taxType = homeIncomeForm.taxType || 'percent';
      
      let taxAmount = 0;
      if (taxType === 'percent') {
        taxAmount = (price * quantity * tax) / 100;
      } else {
        taxAmount = tax;
      }
      
      const calculatedTotal = (price * quantity) + taxAmount;
      
      const homeIncomeData = {
        date: homeIncomeForm.date,
        description: homeIncomeForm.description || '',
        quantity: quantity,
        price: price,
        taxType: taxType,
        tax: tax,
        total: calculatedTotal,
        type: 'home',
        createdAt: new Date()
      };
      
      await addDoc(collection(db, 'businessIncome'), homeIncomeData);
      
      showSuccess('Home income added successfully');
      closeHomeIncomeDialog();
      
      // Refresh incomes to show the new home income
      fetchOrders();
    } catch (error) {
      console.error('Error saving home income:', error);
      showError('Failed to save home income');
    } finally {
      setSavingHomeIncome(false);
    }
  };

  // Fetch regular monthly incomes
  const fetchRegularMonthlyIncomes = async () => {
    try {
      setLoadingRegularMonthlyIncomes(true);
      const snapshot = await getDocs(query(collection(db, 'regularMonthlyIncomes'), orderBy('createdAt', 'desc')));
      const incomesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setRegularMonthlyIncomes(incomesData);
    } catch (error) {
      console.error('Error fetching regular monthly incomes:', error);
      showError('Failed to fetch regular monthly incomes');
    } finally {
      setLoadingRegularMonthlyIncomes(false);
    }
  };

  // Handle regular monthly income input change
  const handleRegularMonthlyIncomeInputChange = (field, value) => {
    const newForm = { ...regularMonthlyIncomeForm, [field]: value };
    
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
    
    setRegularMonthlyIncomeForm(newForm);
  };

  // Validate regular monthly income form
  const validateRegularMonthlyIncomeForm = () => {
    const { quantity, price, tax } = regularMonthlyIncomeForm;
    
    if (!quantity || !price || !tax) {
      showError('Quantity, price, and tax are required');
      return false;
    }
    
    if (parseFloat(quantity) <= 0 || parseFloat(price) <= 0 || parseFloat(tax) < 0) {
      showError('Quantity and price must be greater than 0, tax cannot be negative');
      return false;
    }
    
    return true;
  };

  // Save regular monthly income
  const saveRegularMonthlyIncome = async () => {
    if (!validateRegularMonthlyIncomeForm()) return;
    
    try {
      setSavingRegularMonthlyIncome(true);
      
      // Recalculate total to ensure it's correct before saving
      const quantity = parseFloat(regularMonthlyIncomeForm.quantity) || 0;
      const price = parseFloat(regularMonthlyIncomeForm.price) || 0;
      const tax = parseFloat(regularMonthlyIncomeForm.tax) || 0;
      const taxType = regularMonthlyIncomeForm.taxType || 'percent';
      
      let taxAmount = 0;
      if (taxType === 'percent') {
        taxAmount = (price * quantity * tax) / 100;
      } else {
        taxAmount = tax;
      }
      
      const calculatedTotal = (price * quantity) + taxAmount;
      
      const regularMonthlyIncomeData = {
        date: regularMonthlyIncomeForm.date || new Date().toISOString().split('T')[0],
        description: regularMonthlyIncomeForm.description || '',
        quantity: quantity,
        price: price,
        taxType: taxType,
        tax: tax,
        total: calculatedTotal,
        type: regularMonthlyIncomeForm.type || 'business', // 'business' or 'home'
        createdAt: new Date()
      };
      
      await addDoc(collection(db, 'regularMonthlyIncomes'), regularMonthlyIncomeData);
      
      showSuccess('Regular monthly income added successfully');
      closeAddRegularMonthlyIncomeDialog();
      fetchRegularMonthlyIncomes();
    } catch (error) {
      console.error('Error saving regular monthly income:', error);
      showError('Failed to save regular monthly income');
    } finally {
      setSavingRegularMonthlyIncome(false);
    }
  };

  // Initialize editing state for an income
  const getEditingIncome = (income) => {
    if (!editingIncomes[income.id]) {
      return {
        ...income,
        date: income.date || new Date().toISOString().split('T')[0],
        quantity: income.quantity?.toString() || '',
        price: income.price?.toString() || '',
        tax: income.tax?.toString() || '',
        total: income.total?.toString() || ''
      };
    }
    return editingIncomes[income.id];
  };

  // Save and add income from regular monthly income to current incomes
  const saveAndAddIncomeFromRegularMonthly = async (incomeId) => {
    try {
      setAddingIncomeFromRegular(true);
      
      // Get the income from editingIncomes first (has latest changes), then fallback to original
      const editedIncome = editingIncomes[incomeId];
      const originalIncome = regularMonthlyIncomes.find(e => e.id === incomeId);
      if (!originalIncome) return;
      
      // Use edited values if they exist, otherwise use original values
      // For date, check if it exists in editedIncome first (even if empty string)
      const quantity = parseFloat(editedIncome?.quantity ?? originalIncome.quantity) || 0;
      const price = parseFloat(editedIncome?.price ?? originalIncome.price) || 0;
      const tax = parseFloat(editedIncome?.tax ?? originalIncome.tax) || 0;
      const taxType = editedIncome?.taxType ?? originalIncome.taxType ?? 'percent';
      // Check if date exists in editedIncome, otherwise use original or today
      // Priority: editedIncome.date > originalIncome.date > today's date
      let date;
      if (editedIncome && editedIncome.date) {
        // Use the edited date if it exists
        date = editedIncome.date;
      } else if (originalIncome.date) {
        // Use original date if it exists
        date = originalIncome.date;
      } else {
        // Fallback to today's date
        date = new Date().toISOString().split('T')[0];
      }
      
      console.log('Save - incomeId:', incomeId, 'editedIncome:', editedIncome, 'date:', date);
      
      console.log('Saving income with date:', date, 'editedIncome:', editedIncome, 'originalIncome.date:', originalIncome.date);
      const description = editedIncome?.description ?? originalIncome.description ?? '';
      const type = editedIncome?.type ?? originalIncome.type ?? 'business';
      
      let taxAmount = 0;
      if (taxType === 'percent') {
        taxAmount = (price * quantity * tax) / 100;
      } else {
        taxAmount = tax;
      }
      
      const calculatedTotal = (price * quantity) + taxAmount;
      
      // First, save the changes to the regular monthly income
      const incomeData = {
        date: date,
        description: description,
        quantity: quantity,
        price: price,
        taxType: taxType,
        tax: tax,
        total: calculatedTotal,
        type: type
      };
      
      const incomeRef = doc(db, 'regularMonthlyIncomes', incomeId);
      await updateDoc(incomeRef, incomeData);
      
      // Then add it to current incomes
      const currentIncomeData = {
        date: date,
        description: description,
        quantity: quantity,
        price: price,
        taxType: taxType,
        tax: tax,
        total: calculatedTotal,
        type: type,
        createdAt: new Date()
      };
      
      await addDoc(collection(db, 'businessIncome'), currentIncomeData);
      
      // Clear editing state for this income
      const newEditingIncomes = { ...editingIncomes };
      delete newEditingIncomes[incomeId];
      setEditingIncomes(newEditingIncomes);
      
      showSuccess(`${type === 'home' ? 'Home' : 'Business'} income saved and added successfully`);
      fetchOrders(); // Refresh incomes list
      fetchRegularMonthlyIncomes(); // Refresh regular monthly incomes
    } catch (error) {
      console.error('Error saving and adding income:', error);
      showError('Failed to save and add income');
    } finally {
      setAddingIncomeFromRegular(false);
    }
  };

  // Handle edit input change for a specific income
  const handleEditRegularIncomeChange = (incomeId, field, value) => {
    const currentIncome = editingIncomes[incomeId] || regularMonthlyIncomes.find(e => e.id === incomeId);
    if (!currentIncome) return;
    
    // Get current values, ensuring strings for input fields
    const currentQuantity = editingIncomes[incomeId]?.quantity?.toString() || currentIncome.quantity?.toString() || '';
    const currentPrice = editingIncomes[incomeId]?.price?.toString() || currentIncome.price?.toString() || '';
    const currentTax = editingIncomes[incomeId]?.tax?.toString() || currentIncome.tax?.toString() || '';
    const currentTaxType = editingIncomes[incomeId]?.taxType || currentIncome.taxType || 'percent';
    const currentDate = editingIncomes[incomeId]?.date || currentIncome.date || new Date().toISOString().split('T')[0];
    const currentDescription = editingIncomes[incomeId]?.description || currentIncome.description || '';
    const currentType = editingIncomes[incomeId]?.type || currentIncome.type || 'business';
    
    // Build updated object with the changed field
    const updated = { 
      ...currentIncome,
      date: field === 'date' ? value : (editingIncomes[incomeId]?.date || currentDate),
      description: field === 'description' ? value : currentDescription,
      type: field === 'type' ? value : currentType,
      quantity: field === 'quantity' ? value : currentQuantity,
      price: field === 'price' ? value : currentPrice,
      tax: field === 'tax' ? value : currentTax,
      taxType: field === 'taxType' ? value : currentTaxType
    };
    
    // Ensure date is always set
    if (!updated.date) {
      updated.date = new Date().toISOString().split('T')[0];
    }
    
    // Recalculate total when price, quantity, or tax changes
    if (field === 'price' || field === 'quantity' || field === 'tax' || field === 'taxType') {
      const price = parseFloat(updated.price) || 0;
      const quantity = parseFloat(updated.quantity) || 0;
      const tax = parseFloat(updated.tax) || 0;
      const taxType = updated.taxType || 'percent';
      
      let taxAmount = 0;
      if (taxType === 'percent') {
        taxAmount = (price * quantity * tax) / 100;
      } else {
        taxAmount = tax;
      }
      
      updated.total = ((price * quantity) + taxAmount).toFixed(2);
    } else {
      // For other fields, preserve the existing total
      updated.total = editingIncomes[incomeId]?.total || currentIncome.total?.toString() || '0';
    }
    
    setEditingIncomes({ ...editingIncomes, [incomeId]: updated });
  };

  // Delete regular monthly income
  const deleteRegularMonthlyIncome = async (incomeId) => {
    if (!window.confirm('Are you sure you want to delete this regular monthly income?')) {
      return;
    }
    
    try {
      const incomeRef = doc(db, 'regularMonthlyIncomes', incomeId);
      await deleteDoc(incomeRef);
      showSuccess('Regular monthly income deleted successfully');
      fetchRegularMonthlyIncomes();
    } catch (error) {
      console.error('Error deleting regular monthly income:', error);
      showError('Failed to delete regular monthly income');
    }
  };

  // Close dialogs
  const closeRegularMonthlyIncomesDialog = () => {
    setRegularMonthlyIncomesDialogOpen(false);
  };

  const closeAddRegularMonthlyIncomeDialog = () => {
    setAddRegularMonthlyIncomeDialogOpen(false);
    setRegularMonthlyIncomeForm({
      description: '',
      quantity: '',
      price: '',
      taxType: 'percent',
      tax: '',
      total: 0,
      type: 'business'
    });
  };

  // Open regular monthly incomes dialog
  const openRegularMonthlyIncomesDialog = async () => {
    setRegularMonthlyIncomesDialogOpen(true);
    await fetchRegularMonthlyIncomes();
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
          Extra Incomes Management
        </Typography>
        <Typography variant="body1" sx={{ color: '#ffffff', opacity: 0.8 }}>
          Track and analyze all extra incomes across orders
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
                Total Incomes
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
                {summaryStats.incomeCount}
              </Typography>
              <Typography variant="body2" sx={{ color: '#ffffff', opacity: 0.8 }}>
                Income Items
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
                {formatCurrency(summaryStats.averageIncome)}
              </Typography>
              <Typography variant="body2" sx={{ color: '#ffffff', opacity: 0.8 }}>
                Average Income
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
                {summaryStats.ordersWithIncomes}
              </Typography>
              <Typography variant="body2" sx={{ color: '#ffffff', opacity: 0.8 }}>
                Orders with Incomes
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

      {/* Income Categories and Monthly Breakdown */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, backgroundColor: '#2a2a2a', border: '1px solid #444444' }}>
            <Typography variant="h6" sx={{ color: '#d4af5a', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <CategoryIcon />
              Income Categories
            </Typography>
            {Object.keys(summaryStats.incomeCategories).length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {Object.entries(summaryStats.incomeCategories)
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
                No categorized incomes found
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
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openBusinessIncomeDialog}
              sx={{
                backgroundColor: '#f27921',
                '&:hover': {
                  backgroundColor: '#e67e22'
                },
                color: '#000000',
                fontWeight: 'bold'
              }}
            >
              Business Incomes
            </Button>
            <Button
              onClick={openHomeIncomeDialog}
              variant="contained"
              startIcon={<BusinessIcon />}
              sx={{
                backgroundColor: '#274290',
                '&:hover': {
                  backgroundColor: '#1e3269'
                },
                color: '#ffffff',
                fontWeight: 'bold'
              }}
            >
              Home Incomes
            </Button>
            <Button
              onClick={openRegularMonthlyIncomesDialog}
              variant="contained"
              startIcon={<CalendarIcon />}
              sx={{
                backgroundColor: '#2e7d32',
                '&:hover': {
                  backgroundColor: '#1b5e20'
                },
                color: '#ffffff',
                fontWeight: 'bold'
              }}
            >
              Regular Monthly Incomes
            </Button>
          </Box>
        </Box>
        
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search incomes..."
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
              <InputLabel sx={{ color: '#d4af5a' }}>Income Type</InputLabel>
              <Select
                value={incomeTypeFilter}
                onChange={(e) => setIncomeTypeFilter(e.target.value)}
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
                <MenuItem value="home">Home</MenuItem>
                <MenuItem value="taxed">With Tax</MenuItem>
                <MenuItem value="no_tax">No Tax</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Incomes Table */}
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
                      Loading incomes...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : filteredIncomes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} sx={{ textAlign: 'center', py: 4 }}>
                    <ReceiptIcon sx={{ fontSize: '3rem', color: '#666666', mb: 2 }} />
                    <Typography variant="h6" sx={{ color: '#ffffff', mb: 1 }}>
                      No incomes found
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', opacity: 0.7 }}>
                      {extraIncome.length === 0 
                        ? 'No extra incomes have been added to any orders yet.'
                        : 'Try adjusting your search filters to find incomes.'
                      }
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredIncomes.map((income) => (
                  <TableRow 
                    key={income.id}
                    sx={{ 
                      '&:hover': { backgroundColor: '#333333' },
                      borderBottom: '1px solid #444444'
                    }}
                  >
                    <TableCell sx={{ color: '#ffffff' }}>
                      <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        {income.description}
                      </Typography>
                      {income.incomeType === 'general' && (
                        <Typography variant="caption" sx={{ color: '#d4af5a', fontSize: '0.7rem' }}>
                          {income.materialCompany} • {income.quantity} units
                        </Typography>
                      )}
                    </TableCell>
                    
                    <TableCell>
                      <Chip 
                        label={
                          income.incomeType === 'general' ? 'General' : 
                          income.incomeType === 'business' ? 'Business' : 
                          income.incomeType === 'home' ? 'Home' :
                          'Order-Specific'
                        }
                        size="small"
                        sx={{ 
                          backgroundColor: 
                            income.incomeType === 'general' ? '#f27921' : 
                            income.incomeType === 'business' ? '#9c27b0' : 
                            income.incomeType === 'home' ? '#274290' :
                            '#2196f3',
                          color: '#ffffff',
                          fontWeight: 'medium',
                          fontSize: '0.7rem'
                        }}
                      />
                    </TableCell>
                    
                    <TableCell>
                      {income.orderType && (
                        <Chip 
                          label={income.orderType === 'corporate' ? 'Corporate' : 'Individual'}
                          size="small"
                          sx={{ 
                            backgroundColor: income.orderType === 'corporate' ? '#f27921' : '#274290',
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
                          {income.customerName}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#ffffff', opacity: 0.7 }}>
                          {income.customerEmail}
                        </Typography>
                      </Box>
                    </TableCell>
                    
                    <TableCell sx={{ color: '#ffffff' }}>
                      <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        {income.orderBillNumber}
                      </Typography>
                    </TableCell>
                    
                    <TableCell sx={{ color: '#ffffff' }}>
                      <Typography variant="body2">
                        {income.orderDate ? formatDateOnly(income.orderDate) : 'N/A'}
                      </Typography>
                    </TableCell>
                    
                    <TableCell>
                      <Chip 
                        label={income.orderStatus}
                        size="small"
                        color={getStatusColor(income.orderStatus)}
                        sx={{ 
                          backgroundColor: getStatusColor(income.orderStatus) === 'warning' ? '#ff9800' :
                                          getStatusColor(income.orderStatus) === 'info' ? '#2196f3' :
                                          getStatusColor(income.orderStatus) === 'success' ? '#4caf50' :
                                          getStatusColor(income.orderStatus) === 'error' ? '#f44336' : '#666666',
                          color: '#ffffff',
                          fontWeight: 'medium'
                        }}
                      />
                    </TableCell>
                    
                    <TableCell sx={{ color: '#ffffff', textAlign: 'right' }}>
                      {formatCurrency(income.price)}
                    </TableCell>
                    
                    <TableCell sx={{ color: '#ffffff', textAlign: 'center' }}>
                      {income.unit || 'N/A'}
                    </TableCell>
                    
                    <TableCell sx={{ color: '#ffffff', textAlign: 'right' }}>
                      {income.taxType === 'percent' 
                        ? `${income.tax}%`
                        : formatCurrency(income.tax)
                      }
                    </TableCell>
                    
                    <TableCell sx={{ color: '#d4af5a', textAlign: 'right', fontWeight: 'bold' }}>
                      {formatCurrency(income.total)}
                    </TableCell>
                    
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="View Order">
                          <IconButton
                            size="small"
                            onClick={() => handleViewOrder(income.orderId, income.orderType)}
                            sx={{ color: '#d4af5a' }}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        {(income.incomeType === 'general' || income.incomeType === 'business' || income.incomeType === 'home') && (
                          <>
                            <Tooltip title="Edit Income">
                              <IconButton
                                size="small"
                                onClick={() => openEditDialog(income)}
                                sx={{ color: '#2196f3' }}
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Income">
                              <IconButton
                                size="small"
                                onClick={() => openDeleteDialog(income)}
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
          Delete Income
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Are you sure you want to delete this income?
          </Typography>
          {incomeToDelete && (
            <Box sx={{ p: 2, backgroundColor: '#f5f5f5', borderRadius: 1, border: '1px solid #ddd' }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                {incomeToDelete.description}
              </Typography>
              <Typography variant="caption" sx={{ color: '#666' }}>
                {incomeToDelete.incomeType === 'general' ? 'General Income' : 'Order-Specific'} • 
                {incomeToDelete.materialCompany && ` ${incomeToDelete.materialCompany} •`}
                {incomeToDelete.quantity && ` ${incomeToDelete.quantity} •`}
                {formatCurrency(incomeToDelete.total)}
              </Typography>
            </Box>
          )}
          <Alert severity="warning" sx={{ mt: 2 }}>
            This action cannot be undone. The income will be permanently removed from the system.
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
            onClick={deleteIncome}
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
            {deleting ? 'Deleting...' : 'Delete Income'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Income Dialog */}
      <Dialog open={editDialogOpen} onClose={closeEditDialog} maxWidth="md" fullWidth>
        <DialogTitle sx={{
          background: 'linear-gradient(135deg, #f27921 0%, #e67e22 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <EditIcon />
          Edit General Income
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {incomeToEdit && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Description Field */}
              <TextField
                fullWidth
                label="Description"
                value={incomeToEdit.description || ''}
                onChange={(e) => handleEditInputChange('description', e.target.value)}
                placeholder="Enter income description (optional)"
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
                value={incomeToEdit.date || new Date().toISOString().split('T')[0]}
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

              {/* Material Company and Material Code - Only for General Incomes */}
              {incomeToEdit.incomeType === 'general' && (
                <>
                  {/* Date and Material Company Row */}
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <FormControl fullWidth required>
                      <InputLabel>Material Company</InputLabel>
                      <Select
                        value={incomeToEdit.materialCompany || ''}
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
                    value={incomeToEdit.materialCode || ''}
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
                value={incomeToEdit.quantity || ''}
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
                value={incomeToEdit.price || ''}
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
                    value={incomeToEdit.taxType || 'percent'}
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
                  label={incomeToEdit.taxType === 'percent' ? 'Tax Percentage' : 'Tax Amount'}
                  type="number"
                  value={incomeToEdit.tax || ''}
                  onChange={(e) => handleEditInputChange('tax', e.target.value)}
                  placeholder="0"
                  required
                  inputProps={{ min: 0, step: 0.01 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        {incomeToEdit.taxType === 'percent' ? '%' : '$'}
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
                  <strong>Total: ${incomeToEdit.total || 0}</strong>
                  <br />
                  Calculation: (${incomeToEdit.price || 0} × {incomeToEdit.quantity || 0}) + Tax
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
            onClick={saveEditIncome}
            variant="contained"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} sx={{ color: '#000000' }} /> : <SaveIcon sx={{ color: '#000000' }} />}
            sx={buttonStyles.primaryButton}
          >
            {saving ? 'Saving...' : 'Update Income'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Business Incomes Dialog */}
      <Dialog open={businessIncomeDialogOpen} onClose={closeBusinessIncomeDialog} maxWidth="md" fullWidth>
        <DialogTitle sx={{
          background: 'linear-gradient(135deg, #f27921 0%, #e67e22 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <AddIcon />
          Add Business Income
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Description Field */}
            <TextField
              fullWidth
              label="Description"
              value={businessIncomeForm.description}
              onChange={(e) => handleBusinessIncomeInputChange('description', e.target.value)}
              placeholder="Enter income description (optional)"
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
              value={businessIncomeForm.date}
              onChange={(e) => handleBusinessIncomeInputChange('date', e.target.value)}
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
                value={businessIncomeForm.quantity}
                onChange={(e) => handleBusinessIncomeInputChange('quantity', e.target.value)}
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
                value={businessIncomeForm.price}
                onChange={(e) => handleBusinessIncomeInputChange('price', e.target.value)}
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
                  value={businessIncomeForm.taxType}
                  onChange={(e) => handleBusinessIncomeInputChange('taxType', e.target.value)}
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
                label={businessIncomeForm.taxType === 'percent' ? 'Tax Percentage' : 'Tax Amount'}
                type="number"
                value={businessIncomeForm.tax}
                onChange={(e) => handleBusinessIncomeInputChange('tax', e.target.value)}
                placeholder="0"
                required
                inputProps={{ min: 0, step: 0.01 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      {businessIncomeForm.taxType === 'percent' ? '%' : '$'}
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
                <strong>Total: ${businessIncomeForm.total}</strong>
                <br />
                Calculation: (${businessIncomeForm.price || 0} × {businessIncomeForm.quantity || 0}) + Tax
              </Typography>
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 2 }}>
          <Button
            onClick={closeBusinessIncomeDialog}
            sx={buttonStyles.cancelButton}
          >
            Cancel
          </Button>
          <Button
            onClick={saveBusinessIncome}
            variant="contained"
            disabled={savingBusinessIncome}
            startIcon={savingBusinessIncome ? <CircularProgress size={16} sx={{ color: '#000000' }} /> : <SaveIcon sx={{ color: '#000000' }} />}
            sx={buttonStyles.primaryButton}
          >
            {savingBusinessIncome ? 'Saving...' : 'Save Business Income'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Home Incomes Dialog */}
      <Dialog open={homeIncomeDialogOpen} onClose={closeHomeIncomeDialog} maxWidth="md" fullWidth>
        <DialogTitle sx={{
          background: 'linear-gradient(135deg, #274290 0%, #1e3269 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <AddIcon />
          Add Home Income
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Description Field */}
            <TextField
              fullWidth
              label="Description"
              value={homeIncomeForm.description}
              onChange={(e) => handleHomeIncomeInputChange('description', e.target.value)}
              placeholder="Enter income description (optional)"
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
              value={homeIncomeForm.date}
              onChange={(e) => handleHomeIncomeInputChange('date', e.target.value)}
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
                value={homeIncomeForm.quantity}
                onChange={(e) => handleHomeIncomeInputChange('quantity', e.target.value)}
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
                value={homeIncomeForm.price}
                onChange={(e) => handleHomeIncomeInputChange('price', e.target.value)}
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
                  value={homeIncomeForm.taxType}
                  onChange={(e) => handleHomeIncomeInputChange('taxType', e.target.value)}
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
                label={homeIncomeForm.taxType === 'percent' ? 'Tax Percentage' : 'Tax Amount'}
                type="number"
                value={homeIncomeForm.tax}
                onChange={(e) => handleHomeIncomeInputChange('tax', e.target.value)}
                placeholder="0"
                required
                inputProps={{ min: 0, step: 0.01 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      {homeIncomeForm.taxType === 'percent' ? '%' : '$'}
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
                <strong>Total: ${homeIncomeForm.total}</strong>
                <br />
                Calculation: (${homeIncomeForm.price || 0} × {homeIncomeForm.quantity || 0}) + Tax
              </Typography>
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 2 }}>
          <Button
            onClick={closeHomeIncomeDialog}
            sx={buttonStyles.cancelButton}
          >
            Cancel
          </Button>
          <Button
            onClick={saveHomeIncome}
            variant="contained"
            disabled={savingHomeIncome}
            startIcon={savingHomeIncome ? <CircularProgress size={16} sx={{ color: '#000000' }} /> : <SaveIcon sx={{ color: '#000000' }} />}
            sx={buttonStyles.primaryButton}
          >
            {savingHomeIncome ? 'Saving...' : 'Save Home Income'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Regular Monthly Incomes Dialog */}
      <Dialog 
        open={regularMonthlyIncomesDialogOpen} 
        onClose={closeRegularMonthlyIncomesDialog} 
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            width: '95vw',
            maxWidth: '95vw',
            height: '95vh',
            maxHeight: '95vh',
            margin: '2.5vh'
          }
        }}
      >
        <DialogTitle sx={{
          background: 'linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarIcon />
            Regular Monthly Incomes
          </Box>
          <Button
            onClick={() => setAddRegularMonthlyIncomeDialogOpen(true)}
            variant="contained"
            startIcon={<AddIcon />}
            sx={{
              backgroundColor: '#ffffff',
              color: '#2e7d32',
              '&:hover': {
                backgroundColor: '#f5f5f5'
              },
              fontWeight: 'bold'
            }}
          >
            Add New
          </Button>
        </DialogTitle>
        <DialogContent sx={{ pt: 3, height: 'calc(95vh - 200px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {loadingRegularMonthlyIncomes ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : regularMonthlyIncomes.length === 0 ? (
            <Box sx={{ textAlign: 'center', p: 4 }}>
              <Typography variant="body1" sx={{ color: '#ffffff', mb: 2 }}>
                No regular monthly incomes found. Click "Add New" to create one.
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} sx={{ backgroundColor: '#2a2a2a', flex: 1, overflow: 'auto' }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', color: '#d4af5a', backgroundColor: '#1a1a1a' }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#d4af5a', backgroundColor: '#1a1a1a' }}>Description</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#d4af5a', backgroundColor: '#1a1a1a' }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#d4af5a', backgroundColor: '#1a1a1a' }}>Quantity</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#d4af5a', backgroundColor: '#1a1a1a' }}>Price</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#d4af5a', backgroundColor: '#1a1a1a' }}>Tax</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#d4af5a', backgroundColor: '#1a1a1a' }}>Total</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#d4af5a', backgroundColor: '#1a1a1a' }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {regularMonthlyIncomes.map((income) => {
                    const displayIncome = getEditingIncome(income);
                    
                    return (
                      <TableRow key={income.id} sx={{ '&:hover': { backgroundColor: '#333333' } }}>
                        <TableCell>
                          <TextField
                            size="small"
                            type="date"
                            value={displayIncome.date || new Date().toISOString().split('T')[0]}
                            onChange={(e) => handleEditRegularIncomeChange(income.id, 'date', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            sx={{
                              width: 150,
                              '& .MuiOutlinedInput-root': {
                                '& fieldset': { borderColor: '#8b6b1f' },
                                '&:hover fieldset': { borderColor: '#b98f33' },
                                '&.Mui-focused fieldset': { borderColor: '#b98f33' }
                              },
                              '& .MuiInputBase-input': { color: '#ffffff' }
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={displayIncome.description || ''}
                            onChange={(e) => handleEditRegularIncomeChange(income.id, 'description', e.target.value)}
                            sx={{
                              minWidth: 150,
                              '& .MuiOutlinedInput-root': {
                                '& fieldset': { borderColor: '#8b6b1f' },
                                '&:hover fieldset': { borderColor: '#b98f33' },
                                '&.Mui-focused fieldset': { borderColor: '#b98f33' }
                              },
                              '& .MuiInputBase-input': { color: '#ffffff' }
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <FormControl size="small" sx={{ minWidth: 120 }}>
                            <Select
                              value={displayIncome.type || 'business'}
                              onChange={(e) => handleEditRegularIncomeChange(income.id, 'type', e.target.value)}
                              sx={{
                                color: '#ffffff',
                                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#8b6b1f' },
                                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#b98f33' },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#b98f33' }
                              }}
                            >
                              <MenuItem value="business">Business</MenuItem>
                              <MenuItem value="home">Home</MenuItem>
                            </Select>
                          </FormControl>
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="number"
                            value={displayIncome.quantity || ''}
                            onChange={(e) => handleEditRegularIncomeChange(income.id, 'quantity', e.target.value)}
                            inputProps={{ min: 0, step: 0.1 }}
                            sx={{
                              width: 100,
                              '& .MuiOutlinedInput-root': {
                                '& fieldset': { borderColor: '#8b6b1f' },
                                '&:hover fieldset': { borderColor: '#b98f33' },
                                '&.Mui-focused fieldset': { borderColor: '#b98f33' }
                              },
                              '& .MuiInputBase-input': { color: '#ffffff' }
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="number"
                            value={displayIncome.price || ''}
                            onChange={(e) => handleEditRegularIncomeChange(income.id, 'price', e.target.value)}
                            inputProps={{ min: 0, step: 0.01 }}
                            InputProps={{
                              startAdornment: <InputAdornment position="start">$</InputAdornment>
                            }}
                            sx={{
                              width: 120,
                              '& .MuiOutlinedInput-root': {
                                '& fieldset': { borderColor: '#8b6b1f' },
                                '&:hover fieldset': { borderColor: '#b98f33' },
                                '&.Mui-focused fieldset': { borderColor: '#b98f33' }
                              },
                              '& .MuiInputBase-input': { color: '#ffffff' }
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <FormControl size="small" sx={{ minWidth: 80 }}>
                              <Select
                                value={displayIncome.taxType || 'percent'}
                                onChange={(e) => handleEditRegularIncomeChange(income.id, 'taxType', e.target.value)}
                                sx={{
                                  color: '#ffffff',
                                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#8b6b1f' },
                                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#b98f33' },
                                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#b98f33' }
                                }}
                              >
                                <MenuItem value="percent">%</MenuItem>
                                <MenuItem value="fixed">$</MenuItem>
                              </Select>
                            </FormControl>
                            <TextField
                              size="small"
                              type="number"
                              value={displayIncome.tax || ''}
                              onChange={(e) => handleEditRegularIncomeChange(income.id, 'tax', e.target.value)}
                              inputProps={{ min: 0, step: 0.01 }}
                              sx={{
                                width: 80,
                                '& .MuiOutlinedInput-root': {
                                  '& fieldset': { borderColor: '#8b6b1f' },
                                  '&:hover fieldset': { borderColor: '#b98f33' },
                                  '&.Mui-focused fieldset': { borderColor: '#b98f33' }
                                },
                                '& .MuiInputBase-input': { color: '#ffffff' }
                              }}
                            />
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ color: '#d4af5a', fontWeight: 'bold' }}>
                            ${displayIncome.total || '0.00'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                              onClick={() => saveAndAddIncomeFromRegularMonthly(income.id)}
                              variant="contained"
                              size="small"
                              disabled={addingIncomeFromRegular}
                              startIcon={addingIncomeFromRegular ? <CircularProgress size={16} /> : <SaveIcon />}
                              sx={{
                                backgroundColor: '#2e7d32',
                                '&:hover': { backgroundColor: '#1b5e20' },
                                color: '#ffffff'
                              }}
                            >
                              {addingIncomeFromRegular ? 'Saving...' : 'Save and Add'}
                            </Button>
                            <IconButton
                              onClick={() => deleteRegularMonthlyIncome(income.id)}
                              size="small"
                              sx={{
                                color: '#f44336',
                                '&:hover': { backgroundColor: '#ffebee' }
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button
            onClick={closeRegularMonthlyIncomesDialog}
            sx={buttonStyles.cancelButton}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Regular Monthly Income Dialog */}
      <Dialog open={addRegularMonthlyIncomeDialogOpen} onClose={closeAddRegularMonthlyIncomeDialog} maxWidth="md" fullWidth>
        <DialogTitle sx={{
          background: 'linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <AddIcon />
          Add Regular Monthly Income
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Date Field */}
            <TextField
              fullWidth
              label="Date"
              type="date"
              value={regularMonthlyIncomeForm.date}
              onChange={(e) => handleRegularMonthlyIncomeInputChange('date', e.target.value)}
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

            {/* Type Selection */}
            <FormControl fullWidth>
              <InputLabel>Income Type</InputLabel>
              <Select
                value={regularMonthlyIncomeForm.type}
                onChange={(e) => handleRegularMonthlyIncomeInputChange('type', e.target.value)}
                label="Income Type"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#8b6b1f' },
                    '&:hover fieldset': { borderColor: '#b98f33' },
                    '&.Mui-focused fieldset': { borderColor: '#b98f33' }
                  }
                }}
              >
                <MenuItem value="business">Business</MenuItem>
                <MenuItem value="home">Home</MenuItem>
              </Select>
            </FormControl>

            {/* Description Field */}
            <TextField
              fullWidth
              label="Description"
              value={regularMonthlyIncomeForm.description}
              onChange={(e) => handleRegularMonthlyIncomeInputChange('description', e.target.value)}
              placeholder="Enter income description (optional)"
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
                value={regularMonthlyIncomeForm.quantity}
                onChange={(e) => handleRegularMonthlyIncomeInputChange('quantity', e.target.value)}
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
                value={regularMonthlyIncomeForm.price}
                onChange={(e) => handleRegularMonthlyIncomeInputChange('price', e.target.value)}
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
                  value={regularMonthlyIncomeForm.taxType}
                  onChange={(e) => handleRegularMonthlyIncomeInputChange('taxType', e.target.value)}
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
                label={regularMonthlyIncomeForm.taxType === 'percent' ? 'Tax Percentage' : 'Tax Amount'}
                type="number"
                value={regularMonthlyIncomeForm.tax}
                onChange={(e) => handleRegularMonthlyIncomeInputChange('tax', e.target.value)}
                placeholder="0"
                required
                inputProps={{ min: 0, step: 0.01 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      {regularMonthlyIncomeForm.taxType === 'percent' ? '%' : '$'}
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
                <strong>Total: ${regularMonthlyIncomeForm.total}</strong>
                <br />
                Calculation: (${regularMonthlyIncomeForm.price || 0} × {regularMonthlyIncomeForm.quantity || 0}) + Tax
              </Typography>
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 2 }}>
          <Button
            onClick={closeAddRegularMonthlyIncomeDialog}
            sx={buttonStyles.cancelButton}
          >
            Cancel
          </Button>
          <Button
            onClick={saveRegularMonthlyIncome}
            variant="contained"
            disabled={savingRegularMonthlyIncome}
            startIcon={savingRegularMonthlyIncome ? <CircularProgress size={16} sx={{ color: '#000000' }} /> : <SaveIcon sx={{ color: '#000000' }} />}
            sx={buttonStyles.primaryButton}
          >
            {savingRegularMonthlyIncome ? 'Saving...' : 'Save Regular Monthly Income'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ExtraIncomesPage;
