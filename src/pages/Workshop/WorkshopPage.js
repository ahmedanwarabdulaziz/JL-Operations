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
  Grid,
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
  FormControlLabel
} from '@mui/material';
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
  Check as CheckIcon
} from '@mui/icons-material';
import { useNotification } from '../../components/Common/NotificationSystem';
import { useGmailAuth } from '../../contexts/GmailAuthContext';
import { sendOrderEmail, sendDepositEmail } from '../../services/emailService';
import { useTreatments } from '../../hooks/useTreatments';
import useMaterialCompanies from '../../hooks/useMaterialCompanies';
import { usePlatforms } from '../../hooks/usePlatforms';
import { collection, getDocs, updateDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { calculateOrderTotal } from '../../utils/orderCalculations';

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
  const { showError, showSuccess } = useNotification();
  const { gmailSignedIn, signIn } = useGmailAuth();
  const { treatments, loading: treatmentsLoading } = useTreatments();
  const { companies: materialCompanies, loading: companiesLoading } = useMaterialCompanies();
  const { platforms, loading: platformsLoading } = usePlatforms();

  // Fetch orders from Firebase
  const fetchOrders = useCallback(async () => {
    try {
      console.log('Starting to fetch orders for workshop...');
      setLoading(true);
      
      const ordersRef = collection(db, 'orders');
      const ordersQuery = query(ordersRef, orderBy('orderDetails.billInvoice', 'desc'));
      const ordersSnapshot = await getDocs(ordersQuery);
      const ordersData = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('Workshop orders data received:', ordersData);
      
      // Sort by bill number (highest to lowest)
      const sortedOrders = ordersData.sort((a, b) => {
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
  }, [showError]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

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

  // Calculate invoice totals (same as Invoice page)
  const calculateInvoiceTotals = (order) => {
    let itemsSubtotal = 0;
    let taxableAmount = 0;
    let jlGrandTotal = 0;
    let jlSubtotalBeforeTax = 0;

    if (order.furnitureData?.groups) {
      order.furnitureData.groups.forEach(group => {
        const qntyFoam = parseFloat(group.qntyFoam) || 1;
        // Customer-facing calculations
        const labourPrice = parseFloat(group.labourPrice) || 0;
        const labourQnty = parseFloat(group.labourQnty) || 1;
        const labourTotal = labourPrice * labourQnty;
        itemsSubtotal += labourTotal;

        const materialPrice = parseFloat(group.materialPrice) || 0;
        const materialQnty = parseFloat(group.materialQnty) || 1;
        const materialTotal = materialPrice * materialQnty;
        itemsSubtotal += materialTotal;
        taxableAmount += materialTotal; // Materials are taxable

        const foamPrice = parseFloat(group.foamPrice) || 0;
        const foamTotal = foamPrice * qntyFoam;
        itemsSubtotal += foamTotal;
        taxableAmount += foamTotal; // Foam is taxable

        // JL Internal calculations
        const jlMaterialPrice = parseFloat(group.materialPriceJL) || 0;
        const jlQuantity = parseFloat(group.quantityJL) || 0;
        const jlMaterialTotal = jlMaterialPrice * jlQuantity;
        jlSubtotalBeforeTax += jlMaterialTotal;
        
        // Get tax rate from material company (default 13%)
        const materialCompany = group.materialCompany;
        let taxRate = 0.13; // Default tax rate
        if (materialCompany && materialCompany.toLowerCase().includes('charlotte')) {
          taxRate = 0.02; // Special rate for Charlotte
        }
        
        const materialTax = jlMaterialTotal * taxRate;
        const materialLineTotal = jlMaterialTotal + materialTax;
        jlGrandTotal += materialLineTotal;

        const jlFoamPrice = parseFloat(group.foamPriceJL) || 0;
        const jlFoamTotal = jlFoamPrice * qntyFoam;
        jlSubtotalBeforeTax += jlFoamTotal;
        jlGrandTotal += jlFoamTotal;

        const otherExpenses = parseFloat(group.otherExpenses) || 0;
        jlSubtotalBeforeTax += otherExpenses;
        jlGrandTotal += otherExpenses;

        const shipping = parseFloat(group.shipping) || 0;
        jlSubtotalBeforeTax += shipping;
        jlGrandTotal += shipping;
      });
    }

    // Add extraExpenses to JL Subtotal and JL Grand Total
    let extraExpensesTotal = 0;
    let extraExpensesSubtotal = 0;
    if (order.extraExpenses && Array.isArray(order.extraExpenses)) {
      extraExpensesTotal = order.extraExpenses.reduce((sum, exp) => sum + (parseFloat(exp.total) || 0), 0);
      extraExpensesSubtotal = order.extraExpenses.reduce((sum, exp) => {
        const price = parseFloat(exp.price) || 0;
        const unit = isNaN(Number(exp.unit)) ? 1 : parseFloat(exp.unit) || 1;
        return sum + price * unit;
      }, 0);
      jlSubtotalBeforeTax += extraExpensesSubtotal;
      jlGrandTotal += extraExpensesTotal;
    }

    const taxAmount = taxableAmount * 0.13; // 13% tax on materials and foam
    const pickupDeliveryCost = (parseFloat(order.paymentData?.pickupDeliveryCost) || 0) * 2;
    const grandTotal = itemsSubtotal + taxAmount + pickupDeliveryCost;
    const depositPaid = parseFloat(order.paymentData?.deposit) || 0;
    const balanceDue = grandTotal - depositPaid;

    return {
      itemsSubtotal,
      taxAmount,
      pickupDeliveryCost,
      grandTotal,
      depositPaid,
      balanceDue,
      jlGrandTotal,
      extraExpensesTotal,
      jlSubtotalBeforeTax,
    };
  };

  // Get status color
  const getStatusColor = (order) => {
    const requiredDeposit = parseFloat(order.paymentData?.deposit) || 0;
    const amountPaid = parseFloat(order.paymentData?.amountPaid) || 0;
    
    if (order.paymentData?.depositReceived) return 'warning';
    if (amountPaid >= requiredDeposit && requiredDeposit > 0) return 'success';
    if (amountPaid > 0) return 'warning';
    return 'error';
  };

  // Get status text
  const getStatusText = (order) => {
    const requiredDeposit = parseFloat(order.paymentData?.deposit) || 0;
    const amountPaid = parseFloat(order.paymentData?.amountPaid) || 0;
    
    if (order.paymentData?.depositReceived) return 'Deposit Received';
    if (amountPaid >= requiredDeposit && requiredDeposit > 0) return 'Paid';
    if (amountPaid > 0) return 'Partial';
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

      // Send the email directly (same as NewOrderPage)
      const result = await sendOrderEmail(orderDataForEmail, selectedOrder.personalInfo.email);
      
      if (result.success) {
        showSuccess('Email sent successfully!');
      } else {
        showError(`Failed to send email: ${result.message}`);
      }
    } catch (error) {
      console.error('Error sending email:', error);
      if (error.message.includes('Not signed in')) {
        showError('Please sign in with Gmail first by going to the Test Email page');
      } else {
        showError(`Failed to send email: ${error.message}`);
      }
    } finally {
      setSendingEmail(false);
    }
  };

  // Handle deposit received
  const handleDepositReceived = async () => {
    if (!selectedOrder) {
      showError('No order selected');
      return;
    }

    if (!selectedOrder.personalInfo?.email) {
      showError('No email address found for this customer');
      return;
    }

    const requiredDeposit = parseFloat(selectedOrder.paymentData?.deposit) || 0;
    if (requiredDeposit <= 0) {
      showError('No deposit amount set for this order');
      return;
    }

    // Check Gmail authentication before proceeding
    if (!gmailSignedIn) {
      showError('Please sign in to Gmail first to send deposit confirmation emails');
      return;
    }

    try {
      setProcessingDeposit(true);

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

      // Try to send deposit confirmation email
      try {
        const emailResult = await sendDepositEmail(orderDataForEmail, selectedOrder.personalInfo.email);
        
        if (emailResult.success) {
          showSuccess('Deposit received and confirmation email sent successfully!');
        } else {
          showSuccess(`Deposit received successfully! Email not sent: ${emailResult.message}`);
        }
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
        showSuccess(`Deposit received successfully! Email not sent: ${emailError.message}`);
      }

      // Refresh the orders to show updated data
      await fetchOrders();
    } catch (error) {
      console.error('Error processing deposit:', error);
      showError(`Failed to process deposit: ${error.message}`);
    } finally {
      setProcessingDeposit(false);
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
    <Box sx={{ height: 'calc(100vh - 100px)', display: 'flex' }}>
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
                    onClick={() => setSelectedOrder(order)}
                    sx={{
                      '&.Mui-selected': {
                        backgroundColor: 'primary.light',
                        '&:hover': {
                          backgroundColor: 'primary.light',
                        },
                      },
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box>
                          {/* Invoice Number */}
                          <Typography 
                            variant="h5" 
                            sx={{ 
                              fontWeight: 'bold',
                              color: 'primary.main',
                              mb: 1
                            }}
                          >
                            #{order.orderDetails?.billInvoice || 'N/A'}
                          </Typography>
                          
                          {/* Customer Details */}
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                            <PersonIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary">
                              {order.personalInfo?.customerName || 'No Name'}
                            </Typography>
                          </Box>
                          
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                            <EmailIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary">
                              {order.personalInfo?.email || 'No Email'}
                            </Typography>
                          </Box>
                          
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <PhoneIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary">
                              {order.personalInfo?.phone || 'No Phone'}
                            </Typography>
                          </Box>

                          {/* Status and Date */}
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Chip
                              label={getStatusText(order)}
                              color={getStatusColor(order)}
                              size="small"
                            />
                            <Typography variant="caption" color="text.secondary">
                              {formatDate(order.createdAt)}
                            </Typography>
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
                    Order Details
                  </Typography>
                  <Typography variant="h6" color="text.secondary">
                    {selectedOrder.personalInfo?.customerName} • {formatDate(selectedOrder.createdAt)}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                    #{selectedOrder.orderDetails?.billInvoice}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Bill Number
                  </Typography>
                </Box>
              </Box>
              
              {/* Second Row - Email Button */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                <Button
                  variant="contained"
                  size="medium"
                  startIcon={sendingEmail ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                  onClick={handleSendEmail}
                  disabled={sendingEmail || !selectedOrder?.personalInfo?.email}
                  sx={{
                    px: 3,
                    py: 1.5,
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    borderRadius: 2,
                    boxShadow: 2,
                    '&:hover': {
                      boxShadow: 4,
                      transform: 'translateY(-1px)'
                    },
                    transition: 'all 0.3s ease'
                  }}
                >
                  {sendingEmail ? 'Sending Email...' : 'Send Order Email'}
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
                    backgroundColor: '#274290',
                    color: 'white',
                    p: 2,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <PersonIcon sx={{ mr: 1 }} />
                      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        Personal Information
                      </Typography>
                    </Box>
                    <Tooltip title="Edit Personal Information">
                      <IconButton onClick={handleEditPersonal} sx={{ color: 'white' }} size="small">
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  {/* Content */}
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
                </CardContent>
              </Card>

              {/* Order Details Card */}
              <Card sx={{ boxShadow: 4, flex: 1, border: '2px solid #e3f2fd' }}>
                <CardContent sx={{ p: 0 }}>
                  {/* Header */}
                  <Box sx={{
                    backgroundColor: '#274290',
                    color: 'white',
                    p: 2,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <ReceiptIcon sx={{ mr: 1 }} />
                      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        Order Details
                      </Typography>
                    </Box>
                    <Tooltip title="Edit Order Details">
                      <IconButton onClick={handleEditOrder} sx={{ color: 'white' }} size="small">
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  {/* Content */}
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
                </CardContent>
              </Card>
            </Box>

            {/* Payment & Notes Card */}
            <Card sx={{ boxShadow: 4, width: '100%', mb: 4, border: '2px solid #e3f2fd' }}>
              <CardContent sx={{ p: 0 }}>
                {/* Header */}
                <Box sx={{
                  backgroundColor: '#274290',
                  color: 'white',
                  p: 2,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <PaymentIcon sx={{ mr: 1 }} />
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      Payment & Financial Information
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleOpenPaymentDialogWithRefresh}
                      sx={{
                        color: 'white',
                        borderColor: 'white',
                        '&:hover': {
                          borderColor: '#f27921',
                          backgroundColor: 'rgba(242, 121, 33, 0.1)'
                        }
                      }}
                    >
                      Add Payment
                    </Button>
                    {selectedOrder.paymentData?.deposit && parseFloat(selectedOrder.paymentData.deposit) > 0 && (
                      <Button
                        variant="contained"
                        size="small"
                        onClick={handleDepositReceived}
                        disabled={processingDeposit || selectedOrder.paymentData?.depositReceived}
                        sx={{
                          backgroundColor: selectedOrder.paymentData?.depositReceived ? '#4caf50' : '#f27921',
                          color: 'white',
                          '&:hover': {
                            backgroundColor: selectedOrder.paymentData?.depositReceived ? '#45a049' : '#e65100'
                          }
                        }}
                      >
                        {processingDeposit ? (
                          <>
                            <CircularProgress size={12} color="inherit" sx={{ mr: 0.5 }} />
                            Processing...
                          </>
                        ) : selectedOrder.paymentData?.depositReceived ? (
                          'Deposit Received ✓'
                        ) : (
                          'Mark Deposit Received'
                        )}
                      </Button>
                    )}
                    <Tooltip title="Edit Payment Information">
                      <IconButton onClick={handleEditPayment} sx={{ color: 'white' }} size="small">
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>

                {/* Financial Summary Cards */}
                <Box sx={{ p: 3 }}>
                  {/* Main Row: Deposit & Delivery Info on Left, Financial Summary on Right */}
                  <Grid container spacing={3} sx={{ mb: 3 }}>
                    {/* Left Side: Deposit and Delivery Information */}
                    <Grid item xs={12} lg={5}>
                      <Grid container spacing={2} sx={{ height: '100%' }}>
                        <Grid item xs={12}>
                          <Card variant="outlined" sx={{ height: '100%', border: '2px solid #e3f2fd' }}>
                            <CardContent>
                              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#274290', mb: 2 }}>
                                💰 Deposit Information
                              </Typography>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box>
                                  <Typography variant="body2" color="text.secondary">Required Deposit</Typography>
                                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#274290' }}>
                                    ${selectedOrder.paymentData?.deposit || '0.00'}
                                  </Typography>
                                </Box>
                                {selectedOrder.paymentData?.depositReceived && (
                                  <Box sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    width: 40, 
                                    height: 40, 
                                    borderRadius: '50%', 
                                    backgroundColor: '#4caf50',
                                    color: 'white'
                                  }}>
                                    <CheckIcon sx={{ fontSize: 24 }} />
                                  </Box>
                                )}
                              </Box>
                              {selectedOrder.paymentData?.depositReceived && (
                                <Typography variant="body2" sx={{ color: '#4caf50', fontWeight: 'bold', mt: 1 }}>
                                  ✓ Deposit Received
                                </Typography>
                              )}
                            </CardContent>
                          </Card>
                        </Grid>

                        <Grid item xs={12}>
                          <Card variant="outlined" sx={{ height: '100%', border: '2px solid #e3f2fd' }}>
                            <CardContent>
                              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#274290', mb: 2 }}>
                                🚚 Pickup & Delivery
                              </Typography>
                              {selectedOrder.paymentData?.pickupDeliveryEnabled ? (
                                <Box>
                                  <Typography variant="body2" color="text.secondary">Delivery Cost</Typography>
                                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#274290' }}>
                                    ${selectedOrder.paymentData.pickupDeliveryCost || '0.00'}
                                  </Typography>
                                  <Typography variant="body2" sx={{ color: '#4caf50', fontWeight: 'bold', mt: 1 }}>
                                    ✓ Delivery Enabled
                                  </Typography>
                                </Box>
                              ) : (
                                <Box>
                                  <Typography variant="body2" color="text.secondary">Service Status</Typography>
                                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#9e9e9e' }}>
                                    Not Required
                                  </Typography>
                                  <Typography variant="body2" sx={{ color: '#9e9e9e', mt: 1 }}>
                                    Customer pickup only
                                  </Typography>
                                </Box>
                              )}
                            </CardContent>
                          </Card>
                        </Grid>
                      </Grid>
                    </Grid>

                    {/* Right Side: Financial Summary Cards */}
                    <Grid item xs={12} lg={7}>
                      <Grid container spacing={2} sx={{ height: '100%' }}>
                        {/* Total Invoice Amount */}
                        <Grid item xs={12} md={4}>
                          <Card sx={{ 
                            background: 'linear-gradient(135deg, #f27921 0%, #ff9800 100%)', 
                            color: 'white',
                            height: '100%'
                          }}>
                            <CardContent sx={{ textAlign: 'center', py: 2 }}>
                              <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                                Total Invoice Amount
                              </Typography>
                              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                                ${selectedOrder ? calculateInvoiceTotals(selectedOrder).grandTotal.toFixed(2) : '0.00'}
                              </Typography>
                            </CardContent>
                          </Card>
                        </Grid>

                        {/* Amount Paid */}
                        <Grid item xs={12} md={4}>
                          <Card sx={{ 
                            background: 'linear-gradient(135deg, #4caf50 0%, #66bb6a 100%)', 
                            color: 'white',
                            height: '100%'
                          }}>
                            <CardContent sx={{ textAlign: 'center', py: 2 }}>
                              <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                                Total Paid by Customer
                              </Typography>
                              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                                ${selectedOrder.paymentData?.amountPaid || '0.00'}
                              </Typography>
                            </CardContent>
                          </Card>
                        </Grid>

                        {/* Remaining Balance */}
                        <Grid item xs={12} md={4}>
                          <Card sx={{ 
                            background: selectedOrder && (calculateInvoiceTotals(selectedOrder).grandTotal - (parseFloat(selectedOrder.paymentData?.amountPaid || 0))) > 0
                              ? 'linear-gradient(135deg, #f44336 0%, #e57373 100%)'
                              : 'linear-gradient(135deg, #2e7d32 0%, #4caf50 100%)', 
                            color: 'white',
                            height: '100%'
                          }}>
                            <CardContent sx={{ textAlign: 'center', py: 2 }}>
                              <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                                Outstanding Balance
                              </Typography>
                              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                                ${selectedOrder ? (calculateInvoiceTotals(selectedOrder).grandTotal - (parseFloat(selectedOrder.paymentData?.amountPaid || 0))).toFixed(2) : '0.00'}
                              </Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                      </Grid>
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
                  
                  {/* Gmail Sign-in Status */}
                  {selectedOrder.paymentData?.deposit && parseFloat(selectedOrder.paymentData.deposit) > 0 && !gmailSignedIn && (
                    <Box sx={{ mt: 3 }}>
                      <Alert 
                        severity="warning" 
                        action={
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={signIn}
                            startIcon={<GoogleIcon />}
                            sx={{ 
                              borderColor: '#f57c00',
                              color: '#f57c00',
                              '&:hover': {
                                borderColor: '#ef6c00',
                                backgroundColor: 'rgba(245, 124, 0, 0.04)'
                              }
                            }}
                          >
                            Sign in Gmail
                          </Button>
                        }
                      >
                        <Typography variant="body2">
                          Sign in to Gmail to send deposit confirmation emails to customers
                        </Typography>
                      </Alert>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>

            {/* Furniture Details Card */}
            <Card sx={{ boxShadow: 4, width: '100%', mb: 4, border: '2px solid #e3f2fd' }}>
              <CardContent sx={{ p: 0 }}>
                {/* Header */}
                <Box sx={{
                  backgroundColor: '#274290',
                  color: 'white',
                  p: 2,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <ChairIcon sx={{ mr: 1 }} />
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      Furniture Details
                    </Typography>
                  </Box>
                  <Tooltip title="Edit Furniture Details">
                    <IconButton onClick={handleEditFurniture} sx={{ color: 'white' }} size="small">
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
                              backgroundColor: '#1976d2', 
                              color: 'white', 
                              p: 1.5, 
                              borderRadius: 1, 
                              mb: 2,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}>
                              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
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
                                <InputLabel>Treatment</InputLabel>
                                <Select
                                  value={currentGroup.treatment || ''}
                                  onChange={(e) => updateFurnitureGroup(index, 'treatment', e.target.value)}
                                  label="Treatment"
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
                                >
                                  <MenuItem value="">
                                    <em>Select Treatment</em>
                                  </MenuItem>
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
                            <Box sx={{ mb: 2, p: 2, backgroundColor: '#f8f9fa', borderRadius: 1, border: '1px solid #e0e0e0' }}>
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
                                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#274290' }}>
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
              required
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={editPersonalData.email || ''}
              onChange={(e) => setEditPersonalData({ ...editPersonalData, email: e.target.value })}
              required
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Phone"
              value={editPersonalData.phone || ''}
              onChange={(e) => setEditPersonalData({ ...editPersonalData, phone: e.target.value })}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Address"
              multiline
              rows={3}
              value={editPersonalData.address || ''}
              onChange={(e) => setEditPersonalData({ ...editPersonalData, address: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditPersonalDialog(false)}>Cancel</Button>
          <Button onClick={handleSavePersonal} variant="contained">Save</Button>
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
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOrderDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveOrder} variant="contained">Save</Button>
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
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Amount Paid"
              type="number"
              value={editPaymentData.amountPaid || ''}
              onChange={(e) => setEditPaymentData({ ...editPaymentData, amountPaid: e.target.value })}
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
            <TextField
              fullWidth
              label="Pickup & Delivery Cost"
              type="number"
              value={editPaymentData.pickupDeliveryCost || ''}
              onChange={(e) => setEditPaymentData({ ...editPaymentData, pickupDeliveryCost: e.target.value })}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Additional Notes"
              multiline
              rows={3}
              value={editPaymentData.notes || ''}
              onChange={(e) => setEditPaymentData({ ...editPaymentData, notes: e.target.value })}
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
                        <InputLabel>Treatment</InputLabel>
                        <Select
                          value={group.treatment || ''}
                          onChange={(e) => updateFurnitureGroup(index, 'treatment', e.target.value)}
                          label="Treatment"
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
                        >
                          <MenuItem value="">
                            <em>Select Treatment</em>
                          </MenuItem>
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
          <Button onClick={() => setEditFurnitureDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveFurnitureGroup} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog 
        open={paymentDialog} 
        onClose={handleClosePaymentDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ 
          backgroundColor: '#f27921', 
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <PaymentIcon />
          Payment Details
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {selectedOrder && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Invoice Information (Read-only) */}
              <Box sx={{ 
                backgroundColor: '#f5f5f5', 
                p: 2, 
                borderRadius: 2,
                border: '1px solid #e0e0e0'
              }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#1976d2' }}>
                  Invoice Information
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Invoice Number</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      #{selectedOrder.orderDetails?.billInvoice || 'N/A'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Customer Name</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {selectedOrder.personalInfo?.customerName || 'N/A'}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Payment Summary (Read-only) */}
              <Box sx={{ 
                backgroundColor: '#e8f5e8', 
                p: 2, 
                borderRadius: 2,
                border: '1px solid #c8e6c9'
              }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#2e7d32' }}>
                  Payment Summary
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Total Invoice Amount</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#f27921' }}>
                      ${calculateInvoiceTotals(selectedOrder).grandTotal.toFixed(2)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Amount Paid</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#4caf50' }}>
                      ${selectedOrder.paymentData?.amountPaid || '0.00'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Remaining Balance</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#ff9800' }}>
                      ${(calculateInvoiceTotals(selectedOrder).grandTotal - (parseFloat(selectedOrder.paymentData?.amountPaid || 0))).toFixed(2)}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* New Payment Form */}
              <Box sx={{ 
                backgroundColor: '#fff3e0', 
                p: 2, 
                borderRadius: 2,
                border: '1px solid #ffcc02'
              }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#e65100' }}>
                  Add New Payment
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="Payment Amount"
                    type="number"
                    name="paymentAmount"
                    value={paymentForm.paymentAmount}
                    onChange={handlePaymentInputChange}
                    fullWidth
                    required
                    InputProps={{
                      startAdornment: <InputAdornment position="start">$</InputAdornment>,
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '&:hover': {
                          borderColor: '#f27921'
                        },
                        '&.Mui-focused': {
                          borderColor: '#f27921'
                        }
                      }
                    }}
                  />
                  <TextField
                    label="Payment Date"
                    type="date"
                    name="paymentDate"
                    value={paymentForm.paymentDate}
                    onChange={handlePaymentInputChange}
                    fullWidth
                    required
                    InputLabelProps={{
                      shrink: true,
                    }}
                  />
                  <TextField
                    label="Payment Notes (Optional)"
                    name="paymentNotes"
                    value={paymentForm.paymentNotes}
                    onChange={handlePaymentInputChange}
                    fullWidth
                    multiline
                    rows={2}
                    placeholder="Enter any notes about this payment..."
                  />
                </Box>
              </Box>

              {/* Payment History */}
              {selectedOrder.paymentData?.payments && selectedOrder.paymentData.payments.length > 0 && (
                <Box sx={{ 
                  backgroundColor: '#f3e5f5', 
                  p: 2, 
                  borderRadius: 2,
                  border: '1px solid #ce93d8'
                }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#7b1fa2' }}>
                    Payment History
                  </Typography>
                  <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                    {selectedOrder.paymentData.payments.map((payment, index) => (
                      <Box key={index} sx={{ 
                        p: 1.5, 
                        mb: 1, 
                        backgroundColor: 'white', 
                        borderRadius: 1,
                        border: '1px solid #e1bee7'
                      }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            ${payment.amount.toFixed(2)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {new Date(payment.date).toLocaleDateString()}
                          </Typography>
                        </Box>
                        {payment.notes && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontStyle: 'italic' }}>
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
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={handleClosePaymentDialog} variant="outlined">
            Cancel
          </Button>
          <Button 
            onClick={handleAddNewPayment} 
            variant="contained"
            disabled={!paymentForm.paymentAmount || parseFloat(paymentForm.paymentAmount) <= 0}
            sx={{
              backgroundColor: '#f27921',
              '&:hover': {
                backgroundColor: '#e65100'
              }
            }}
          >
            Save Payment
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default WorkshopPage; 