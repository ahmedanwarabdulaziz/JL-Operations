import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  FormControlLabel,
  Switch,
  Alert,
  CircularProgress,
  InputAdornment
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useNotification } from '../../../shared/components/Common/NotificationSystem';
import { addDoc, collection, getDocs, query, orderBy, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { buttonStyles } from '../../../styles/buttonStyles';
import { formatDate } from '../../../utils/dateUtils';
import { calculatePickupDeliveryCost } from '../../../utils/orderCalculations';
import { getNextCorporateInvoiceNumber, validateCorporateInvoiceNumber } from '../../../utils/invoiceNumberUtils';

const CreateInvoicePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError } = useNotification();
  
  const [loading, setLoading] = useState(false);
  const [orderData, setOrderData] = useState(null);
  const [originalPaidAmount, setOriginalPaidAmount] = useState(0); // Store original paid amount from order
  
  // Invoice header settings
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [taxPercentage, setTaxPercentage] = useState(13);
  const [creditCardFeeEnabled, setCreditCardFeeEnabled] = useState(false);
  const [creditCardFeePercentage, setCreditCardFeePercentage] = useState(2.5);
  const [paidAmount, setPaidAmount] = useState(0);
  const [showRemainingAmountAlert, setShowRemainingAmountAlert] = useState(false);
  
  // Invoice data (copied from order but editable)
  const [customerInfo, setCustomerInfo] = useState({
    customerName: '',
    email: '',
    phone: '',
    address: ''
  });
  
  const [items, setItems] = useState([]);

  useEffect(() => {
    const loadOrderData = async () => {
      if (location.state?.orderData) {
        const order = location.state.orderData;
        setOrderData(order);
        
        // Keep existing invoice number or let the default be set by useEffect
        
        // Copy customer info from order
        setCustomerInfo({
          customerName: order.personalInfo?.customerName || '',
          email: order.personalInfo?.email || '',
          phone: order.personalInfo?.phone || '',
          address: order.personalInfo?.address || ''
        });
        
        // Extract paid amount from order - check multiple possible locations
        // Priority: top-level amountPaid > paymentData.amountPaid > paymentDetails.amountPaid
        let orderPaidAmount = 0;
        
        if (order.amountPaid !== undefined && order.amountPaid !== null) {
          // Top-level amountPaid field (from Firebase orders collection)
          orderPaidAmount = parseFloat(order.amountPaid) || 0;
        } else if (order.orderType === 'corporate') {
          // Corporate orders: paymentDetails.amountPaid
          orderPaidAmount = parseFloat(order.paymentDetails?.amountPaid || 0);
        } else {
          // Regular orders: paymentData.amountPaid
          orderPaidAmount = parseFloat(order.paymentData?.amountPaid || 0);
        }
        
        // If still not found and we have order ID, fetch fresh from Firebase
        if (orderPaidAmount === 0 && order.id) {
          try {
            const orderDoc = await getDoc(doc(db, 'orders', order.id));
            if (orderDoc.exists()) {
              const orderData = orderDoc.data();
              // Check all possible locations in fresh data
              if (orderData.amountPaid !== undefined && orderData.amountPaid !== null) {
                orderPaidAmount = parseFloat(orderData.amountPaid) || 0;
              } else if (orderData.orderType === 'corporate') {
                orderPaidAmount = parseFloat(orderData.paymentDetails?.amountPaid || 0);
              } else {
                orderPaidAmount = parseFloat(orderData.paymentData?.amountPaid || 0);
              }
            }
          } catch (error) {
            console.error('Error fetching order from Firebase:', error);
          }
        }
        
        setPaidAmount(orderPaidAmount);
        setOriginalPaidAmount(orderPaidAmount); // Store original paid amount
      
      // Convert furniture groups to invoice items with proper details
      const invoiceItems = [];
      if (order.furnitureData?.groups) {
        order.furnitureData.groups.forEach((group, index) => {
          // Add furniture group as a separate editable item
          if (group.furnitureType) {
            invoiceItems.push({
              id: `group-${index}`,
              name: group.furnitureType,
              quantity: 1,
              price: 0,
              type: 'group',
              isGroup: true
            });
          }
          
          // Add material item if it exists
          if (group.materialCompany || group.materialPrice || group.materialQuantity) {
            // Create material name with company and code
            let materialName = 'Material';
            if (group.materialCompany) {
              materialName += ` - ${group.materialCompany}`;
            }
            if (group.materialCode) {
              materialName += ` (${group.materialCode})`;
            }
            
            invoiceItems.push({
              id: `item-${index}-material`,
              name: materialName,
              quantity: parseFloat(group.materialQnty || group.materialQuantity) || 1,
              price: parseFloat(group.materialPrice) || 0,
              type: 'material',
              isGroup: false
            });
          }
          
          // Add labour item if it exists
          if (group.labourPrice || group.labourQuantity || group.labourNote || group.labourWork) {
            invoiceItems.push({
              id: `item-${index}-labour`,
              name: 'Labour',
              quantity: parseFloat(group.labourQnty || group.labourQuantity) || 1,
              price: parseFloat(group.labourPrice || group.labourWork) || 0,
              type: 'labour',
              isGroup: false
            });
          }
          
          // Add foam item if it exists
          if (group.foamPrice || group.foamQuantity || group.foamNote || group.foamEnabled) {
            invoiceItems.push({
              id: `item-${index}-foam`,
              name: 'Foam',
              quantity: parseFloat(group.foamQnty || group.foamQuantity) || 1,
              price: parseFloat(group.foamPrice) || 0,
              type: 'foam',
              isGroup: false
            });
          }
          
          // Add painting item if it exists
          if (group.paintingLabour || group.paintingQuantity || group.paintingEnabled) {
            invoiceItems.push({
              id: `item-${index}-painting`,
              name: 'Painting',
              quantity: parseFloat(group.paintingQnty || group.paintingQuantity) || 1,
              price: parseFloat(group.paintingLabour) || 0,
              type: 'painting',
              isGroup: false
            });
          }
          
          // Add pickup & delivery if enabled
          if (order.paymentData?.pickupDeliveryEnabled && index === 0) { // Only add once per order
            const baseCost = parseFloat(order.paymentData.pickupDeliveryCost) || 0;
            const serviceType = order.paymentData.pickupDeliveryServiceType || 'both';
            const calculatedCost = calculatePickupDeliveryCost(baseCost, serviceType);
            
            invoiceItems.push({
              id: 'pickup-delivery',
              name: 'Pickup & Delivery',
              quantity: 1,
              price: calculatedCost,
              type: 'service',
              isGroup: false
            });
          }
          
          // Add customer note as a separate item if it exists and no other items were added
          if (group.customerNote && invoiceItems.filter(item => item.id.startsWith(`item-${index}`)).length === 0) {
            invoiceItems.push({
              id: `item-${index}-note`,
              name: 'Custom Item',
              quantity: 1,
              price: 0,
              type: 'custom',
              isGroup: false
            });
          }
        });
      }
      
      // If no items from furniture groups, create a default item
      if (invoiceItems.length === 0) {
        invoiceItems.push({
          id: 'item-default',
          name: 'Furniture Item',
          quantity: 1,
          price: 0,
          type: 'furniture',
          isGroup: false
        });
      }
      
      setItems(invoiceItems);
    } else {
      // Redirect back if no order data
      navigate('/admin/customer-invoices');
    }
    };
    
    loadOrderData();
  }, [location.state, navigate]);

  // Watch for total changes and show remaining amount alert
  useEffect(() => {
    if (!orderData) return;
    
    // Calculate new total
    const subtotal = items.filter(item => !item.isGroup).reduce((sum, item) => {
      return sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0);
    }, 0);
    
    const taxAmount = (subtotal * taxPercentage) / 100;
    const creditCardFee = creditCardFeeEnabled ? (subtotal * creditCardFeePercentage) / 100 : 0;
    const newTotal = subtotal + taxAmount + creditCardFee;
    
    const remainingAmount = newTotal - originalPaidAmount;
    
    // Show alert if there's a remaining amount and paid amount hasn't been updated to match new total
    if (remainingAmount > 0.01 && Math.abs(paidAmount - newTotal) > 0.01) {
      setShowRemainingAmountAlert(true);
    } else {
      setShowRemainingAmountAlert(false);
    }
  }, [items, taxPercentage, creditCardFeeEnabled, creditCardFeePercentage, orderData, originalPaidAmount, paidAmount]);

  // Get next invoice number (T- format)
  const getNextInvoiceNumber = async () => {
    try {
      return await getNextCorporateInvoiceNumber();
    } catch (error) {
      console.error('Error getting next invoice number:', error);
      return 'T-100001';
    }
  };

  // Handle invoice number change (only number part, T- prefix is locked)
  const handleInvoiceNumberChange = async (newValue) => {
    // Remove any T- prefix if user tries to type it
    let numberPart = newValue.replace(/^T-?/i, '');
    
    // Only allow digits
    numberPart = numberPart.replace(/\D/g, '');
    
    // Limit to 6 digits maximum
    if (numberPart.length > 6) {
      numberPart = numberPart.substring(0, 6);
    }
    
    // Don't auto-pad - let user type freely
    const fullNumber = numberPart ? `T-${numberPart}` : 'T-';
    
    // Update the value immediately for responsive editing
    setInvoiceNumber(fullNumber);
    
    // Only validate for duplicates when we have a complete 6-digit number
    if (numberPart.length === 6) {
      const isValid = await validateCorporateInvoiceNumber(fullNumber);
      if (!isValid && fullNumber !== invoiceNumber) {
        showError(`Invoice number ${fullNumber} is already in use. Please choose a different number.`);
        // Don't prevent setting - just warn the user
      }
    }
  };

  // Set default invoice number when component mounts
  useEffect(() => {
    const setDefaultInvoiceNumber = async () => {
      // Only set default if invoice number is empty or just whitespace
      if (!invoiceNumber || !invoiceNumber.trim()) {
          const orderInvoiceNumber = orderData?.orderDetails?.billInvoice;
          if (orderInvoiceNumber) {
            // Check if it's already T- format, if not, use new T- format
            if (String(orderInvoiceNumber).startsWith('T-')) {
              setInvoiceNumber(String(orderInvoiceNumber));
            } else {
              // Old format - generate new T- number
              const nextNumber = await getNextInvoiceNumber();
              setInvoiceNumber(nextNumber);
            }
          } else {
            const nextNumber = await getNextInvoiceNumber();
            setInvoiceNumber(nextNumber);
          }
      }
    };
    setDefaultInvoiceNumber();
  }, []);

  // Add new item
  const addItem = () => {
    // Find the last furniture group index to assign the new item to it
    const furnitureGroups = items.filter(item => item.isGroup);
    const lastGroupIndex = furnitureGroups.length > 0 ? furnitureGroups.length - 1 : 0;
    
    const newItem = {
      id: `item-${lastGroupIndex}-${Date.now()}`,
      name: 'New Item',
      quantity: 1,
      price: 0,
      type: 'material',
      isGroup: false
    };
    setItems([...items, newItem]);
  };

  // Add new furniture group
  const addFurnitureGroup = () => {
    const newGroup = {
      id: `group-${Date.now()}`,
      name: '',
      quantity: 1,
      price: 0,
      type: 'group',
      isGroup: true
    };
    setItems([...items, newGroup]);
  };

  // Add item to specific group
  const addItemToGroup = (groupIndex) => {
    const newItem = {
      id: `item-${groupIndex}-${Date.now()}`,
      name: 'New Item',
      quantity: 1,
      price: 0,
      type: 'material',
      isGroup: false
    };
    
    // Find the position to insert the item (after the group and its existing items)
    let insertIndex = -1;
    let groupFound = false;
    
    for (let i = 0; i < items.length; i++) {
      if (items[i].isGroup && items[i].id === `group-${groupIndex}`) {
        groupFound = true;
        insertIndex = i + 1;
      } else if (groupFound && items[i].isGroup) {
        // Found the next group, stop here
        break;
      } else if (groupFound && !items[i].isGroup) {
        // This is an item in the current group, move insert index
        insertIndex = i + 1;
      }
    }
    
    if (insertIndex === -1) {
      // Group not found, just add at the end
      setItems([...items, newItem]);
    } else {
      // Insert at the correct position
      const newItems = [...items];
      newItems.splice(insertIndex, 0, newItem);
      setItems(newItems);
    }
  };

  // Update item
  const updateItem = (id, field, value) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  // Delete item
  const deleteItem = (id) => {
    setItems(items.filter(item => item.id !== id));
  };

  // Calculate totals (exclude group items)
  const calculateSubtotal = () => {
    return items.reduce((sum, item) => {
      if (item.isGroup) return sum; // Skip group items in calculation
      const quantity = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.price) || 0;
      return sum + (quantity * price);
    }, 0);
  };

  const calculateTax = () => {
    const subtotal = calculateSubtotal();
    return (subtotal * taxPercentage) / 100;
  };

  const calculateCreditCardFee = () => {
    if (!creditCardFeeEnabled) return 0;
    const subtotal = calculateSubtotal();
    return (subtotal * creditCardFeePercentage) / 100;
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax() + calculateCreditCardFee();
  };

  const calculateBalance = () => {
    return calculateTotal() - paidAmount;
  };

  // Validate form
  const validateForm = async () => {
    if (!invoiceNumber.trim()) {
      showError('Invoice number is required');
      return false;
    }
    
    // Validate T- format
    if (!invoiceNumber.startsWith('T-')) {
      showError('Invoice number must be in T-XXXXXX format');
      return false;
    }

    const numberPart = invoiceNumber.substring(2);
    
    // Ensure it's exactly 6 digits - pad if needed
    let finalNumberPart = numberPart;
    if (numberPart.length > 0 && numberPart.length < 6) {
      finalNumberPart = numberPart.padStart(6, '0');
      const updatedInvoiceNumber = `T-${finalNumberPart}`;
      setInvoiceNumber(updatedInvoiceNumber);
    }
    
    if (finalNumberPart.length !== 6 || isNaN(parseInt(finalNumberPart))) {
      showError('Invoice number must be 6 digits (e.g., T-100001)');
      return false;
    }

    const finalInvoiceNumber = `T-${finalNumberPart}`;
    
    // Check for duplicates in both corporate-orders and customer-invoices
    const isValid = await validateCorporateInvoiceNumber(finalInvoiceNumber);
    if (!isValid) {
      showError(`Invoice number ${finalInvoiceNumber} already exists in corporate orders or customer invoices. Please choose a different number.`);
      return false;
    }
    
    if (!customerInfo.customerName.trim()) {
      showError('Customer name is required');
      return false;
    }
    
    if (items.length === 0) {
      showError('At least one item is required');
      return false;
    }
    
    // Only validate non-group items
    const validItems = items.filter(item => !item.isGroup);
    for (const item of validItems) {
      if (!item.name.trim()) {
        showError('Item name is required for all items');
        return false;
      }
      if (parseFloat(item.quantity) <= 0) {
        showError('Item quantity must be greater than 0');
        return false;
      }
      if (parseFloat(item.price) < 0) {
        showError('Item price cannot be negative');
        return false;
      }
    }
    
    return true;
  };

  // Save invoice
  const handleSave = async () => {
    const isValid = await validateForm();
    if (!isValid) return;
    
    // Check if paid amount matches new total (required for T-invoices from Done orders)
    const newTotal = calculateTotal();
    const balance = Math.abs(newTotal - paidAmount);
    
    // Prevent saving if paid amount doesn't match total
    if (balance > 0.01) {
      const confirmed = window.confirm(
        `The T-invoice total is $${newTotal.toFixed(2)}, but paid amount is $${paidAmount.toFixed(2)}. ` +
        `The difference is $${balance.toFixed(2)}. ` +
        `\n\nFor Done orders, the paid amount MUST equal the new total. ` +
        `Would you like to set paid amount to $${newTotal.toFixed(2)} before saving?`
      );
      
      if (confirmed) {
        setPaidAmount(newTotal); // Update state for UI
        // Continue with save after updating paid amount
      } else {
        // User chose not to update - prevent saving
        showError(`Cannot save: Paid amount ($${paidAmount.toFixed(2)}) must equal the total ($${newTotal.toFixed(2)}). Please update the paid amount to match the total.`);
        return; // Block save
      }
    }
    
    // Double-check after potential update
    const finalTotal = calculateTotal();
    const finalBalance = Math.abs(finalTotal - paidAmount);
    if (finalBalance > 0.01) {
      showError(`Cannot save: Paid amount ($${paidAmount.toFixed(2)}) must equal the total ($${finalTotal.toFixed(2)}). Please update the paid amount to match the total.`);
      return; // Block save
    }
    
    try {
      setLoading(true);
      
      // Ensure invoice number is properly formatted
      const numberPart = invoiceNumber.substring(2);
      const finalNumberPart = numberPart.length === 6 ? numberPart : numberPart.padStart(6, '0');
      const finalInvoiceNumber = `T-${finalNumberPart}`;
      
      // Fetch fresh order data to ensure we have the latest allocation
      let freshOrderData = orderData;
      if (orderData.id) {
        try {
          const orderCollectionName = orderData.orderType === 'corporate' ? 'corporate-orders' : 'orders';
          const orderDoc = await getDoc(doc(db, orderCollectionName, orderData.id));
          if (orderDoc.exists()) {
            freshOrderData = { id: orderDoc.id, ...orderDoc.data() };
          }
        } catch (error) {
          console.error('Error fetching fresh order data:', error);
          // Continue with existing orderData if fetch fails
        }
      }
      
      const invoiceData = {
        invoiceNumber: finalInvoiceNumber,
        originalOrderId: freshOrderData.id,
        originalOrderNumber: freshOrderData.orderDetails?.billInvoice || 'N/A',
        originalCustomerInfo: {
          customerName: freshOrderData.personalInfo?.customerName || '',
          email: freshOrderData.personalInfo?.email || '',
          phone: freshOrderData.personalInfo?.phone || '',
          address: freshOrderData.personalInfo?.address || ''
        },
        headerSettings: {
          taxPercentage,
          creditCardFeeEnabled,
          creditCardFeePercentage
        },
        customerInfo,
        paidAmount: parseFloat(paidAmount) || 0,
        items: items.filter(item => !item.isGroup).map(item => ({
          ...item,
          quantity: parseFloat(item.quantity),
          price: parseFloat(item.price)
        })),
        furnitureGroups: items.filter(item => item.isGroup).map(item => ({
          name: item.name
        })),
        calculations: {
          subtotal: calculateSubtotal(),
          taxAmount: calculateTax(),
          creditCardFeeAmount: calculateCreditCardFee(),
          total: calculateTotal(),
          paidAmount: parseFloat(paidAmount) || 0,
          balance: calculateTotal() - parseFloat(paidAmount)
        },
        // Copy allocation data from original order if it exists
        ...(freshOrderData.allocation && { allocation: freshOrderData.allocation }),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Save the T-invoice
      const invoiceRef = await addDoc(collection(db, 'customer-invoices'), invoiceData);
      
      // Mark the original order with hasTInvoice flag
      const orderCollectionName = orderData.orderType === 'corporate' ? 'corporate-orders' : 'orders';
      const orderRef = doc(db, orderCollectionName, orderData.id);
      await updateDoc(orderRef, {
        hasTInvoice: true,
        tInvoiceId: invoiceRef.id
      });
      
      showSuccess('T-invoice created successfully!');
      navigate('/admin/customer-invoices');
    } catch (error) {
      console.error('Error creating invoice:', error);
      showError('Failed to create invoice. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!orderData) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 3,
        flexWrap: 'wrap',
        gap: 2
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton 
            onClick={() => navigate('/admin/customer-invoices')}
            sx={{ color: 'primary.main' }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
              Create Customer Invoice
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Creating invoice from Order #{orderData.orderDetails?.billInvoice || orderData.id}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/admin/customer-invoices')}
            sx={buttonStyles.cancelButton}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={16} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={loading}
            sx={buttonStyles.primaryButton}
          >
            {loading ? 'Saving...' : 'Save Invoice'}
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Left Column - Header Settings */}
        <Grid item xs={12} lg={3}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#274290' }}>
                Invoice Settings
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold', color: '#274290' }}>
                  Invoice Number
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                  <Typography 
                    variant="body1" 
                    sx={{ 
                      fontWeight: 'bold', 
                      color: '#b98f33',
                      px: 1.5,
                      border: '1px solid',
                      borderColor: '#555555',
                      borderRight: 'none',
                      borderTopLeftRadius: 1,
                      borderBottomLeftRadius: 1,
                      backgroundColor: '#2a2a2a',
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      minWidth: '40px',
                      justifyContent: 'center'
                    }}
                  >
                    T-
                  </Typography>
                  <TextField
                    value={invoiceNumber.startsWith('T-') ? invoiceNumber.substring(2) : invoiceNumber}
                    onChange={(e) => handleInvoiceNumberChange(e.target.value)}
                    placeholder="100001"
                    size="small"
                    sx={{
                      flex: 1,
                      '& .MuiOutlinedInput-root': {
                        borderTopLeftRadius: 0,
                        borderBottomLeftRadius: 0,
                        backgroundColor: '#2a2a2a',
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
                      '& .MuiInputBase-input': {
                        color: '#ffffff',
                        '&::placeholder': {
                          color: '#cccccc',
                          opacity: 1
                        }
                      }
                    }}
                    inputProps={{
                      maxLength: 6,
                      inputMode: 'numeric',
                      pattern: '[0-9]*'
                    }}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Customize the invoice number (T- prefix is permanent)
                </Typography>
              </Box>
              
              <TextField
                fullWidth
                label="Tax Percentage (%)"
                type="number"
                value={taxPercentage}
                onChange={(e) => setTaxPercentage(parseFloat(e.target.value) || 0)}
                onFocus={(e) => e.target.select()}
                inputProps={{ min: 0, max: 100, step: 0.1 }}
                sx={{ mb: 2 }}
                helperText="Tax rate applied to subtotal"
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={creditCardFeeEnabled}
                    onChange={(e) => setCreditCardFeeEnabled(e.target.checked)}
                    color="primary"
                  />
                }
                label="Enable Credit Card Fee"
                sx={{ mb: 2 }}
              />
              
              <TextField
                fullWidth
                label="Credit Card Fee (%)"
                type="number"
                value={creditCardFeePercentage}
                onChange={(e) => setCreditCardFeePercentage(parseFloat(e.target.value) || 0)}
                onFocus={(e) => e.target.select()}
                inputProps={{ min: 0, max: 100, step: 0.1 }}
                disabled={!creditCardFeeEnabled}
                helperText="Credit card processing fee percentage"
                sx={{ mb: 2 }}
              />
              
              {(() => {
                const currentTotal = calculateTotal();
                const remainingAmount = currentTotal - originalPaidAmount;
                const needsUpdate = remainingAmount > 0.01 && Math.abs(paidAmount - currentTotal) > 0.01;
                
                return (
                  <>
                    {showRemainingAmountAlert && needsUpdate && (
                      <Alert 
                        severity="warning" 
                        sx={{ mb: 2 }}
                        action={
                          <Button
                            size="small"
                            onClick={() => {
                              setPaidAmount(currentTotal);
                              setShowRemainingAmountAlert(false);
                            }}
                            sx={{ color: '#f27921', fontWeight: 'bold' }}
                          >
                            Set to New Total
                          </Button>
                        }
                      >
                        <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                          New Remaining Amount: ${remainingAmount.toFixed(2)}
                        </Typography>
                        <Typography variant="body2">
                          The T-invoice total is ${currentTotal.toFixed(2)}. Original paid amount was ${originalPaidAmount.toFixed(2)}. 
                          Please set the paid amount to ${currentTotal.toFixed(2)} to ensure the order is fully paid.
                        </Typography>
                      </Alert>
                    )}
                    <TextField
                      fullWidth
                      label="Paid Amount ($)"
                      type="number"
                      value={paidAmount}
                      onChange={(e) => {
                        const newPaidAmount = parseFloat(e.target.value) || 0;
                        setPaidAmount(newPaidAmount);
                        // Hide alert when user manually updates paid amount to match total
                        if (Math.abs(newPaidAmount - currentTotal) < 0.01) {
                          setShowRemainingAmountAlert(false);
                        }
                      }}
                      onFocus={(e) => e.target.select()}
                      inputProps={{ min: 0, step: 0.01 }}
                      helperText={showRemainingAmountAlert && needsUpdate
                        ? `Original paid: $${originalPaidAmount.toFixed(2)} | New total: $${currentTotal.toFixed(2)} | Remaining: $${remainingAmount.toFixed(2)}`
                        : "Amount already paid by customer"}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                      }}
                      sx={{ 
                        mb: 2,
                        '& .MuiOutlinedInput-root': {
                          backgroundColor: needsUpdate ? '#fff3cd' : '#2a2a2a',
                          '& fieldset': {
                            borderColor: needsUpdate ? '#f27921' : '#333333',
                          },
                          '&:hover fieldset': {
                            borderColor: needsUpdate ? '#f27921' : '#b98f33',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: needsUpdate ? '#f27921' : '#b98f33',
                          },
                        },
                        '& .MuiInputLabel-root': {
                          color: '#b98f33',
                          '&.Mui-focused': {
                            color: '#b98f33',
                          },
                        },
                        '& .MuiInputBase-input': {
                          color: needsUpdate ? '#000000' : '#ffffff',
                        },
                        '& .MuiInputAdornment-root': {
                          color: needsUpdate ? '#000000' : '#b98f33',
                        },
                        '& .MuiFormHelperText-root': {
                          color: showRemainingAmountAlert && needsUpdate ? '#f27921' : undefined,
                          fontWeight: showRemainingAmountAlert && needsUpdate ? 'bold' : undefined,
                        }
                      }}
                    />
                  </>
                );
              })()}
            </CardContent>
          </Card>

          {/* Customer Information */}
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#274290' }}>
                Customer Information
              </Typography>
              
              <TextField
                fullWidth
                label="Customer Name"
                value={customerInfo.customerName}
                onChange={(e) => setCustomerInfo({...customerInfo, customerName: e.target.value})}
                onFocus={(e) => e.target.select()}
                sx={{ mb: 2 }}
                required
              />
              
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={customerInfo.email}
                onChange={(e) => setCustomerInfo({...customerInfo, email: e.target.value})}
                onFocus={(e) => e.target.select()}
                sx={{ mb: 2 }}
              />
              
              <TextField
                fullWidth
                label="Phone"
                value={customerInfo.phone}
                onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                onFocus={(e) => e.target.select()}
                sx={{ mb: 2 }}
              />
              
              <TextField
                fullWidth
                label="Address"
                multiline
                rows={3}
                value={customerInfo.address}
                onChange={(e) => setCustomerInfo({...customerInfo, address: e.target.value})}
                onFocus={(e) => e.target.select()}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column - Items and Calculations */}
        <Grid item xs={12} lg={9}>
          {/* Items Table */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#274290' }}>
                  Invoice Items
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={addFurnitureGroup}
                  sx={buttonStyles.secondaryButton}
                  size="small"
                >
                  Add Group
                </Button>
              </Box>
              
              <TableContainer component={Paper} sx={{ maxHeight: 500, width: '100%' }}>
                <Table stickyHeader sx={{ minWidth: 800 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: '50%', minWidth: 300 }}>Item Name</TableCell>
                      <TableCell align="center" sx={{ width: '10%', minWidth: 80 }}>Quantity</TableCell>
                      <TableCell align="center" sx={{ width: '15%', minWidth: 100 }}>Price</TableCell>
                      <TableCell align="center" sx={{ width: '15%', minWidth: 100 }}>Total</TableCell>
                      <TableCell align="center" sx={{ width: '10%', minWidth: 80 }}>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id} sx={{ 
                        backgroundColor: item.isGroup ? '#f5f5f5' : 'inherit',
                        '& .MuiTableCell-root': {
                          fontWeight: item.isGroup ? 'bold' : 'normal',
                          color: item.isGroup ? '#274290' : 'inherit'
                        }
                      }}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <TextField
                              fullWidth
                              size="small"
                              value={item.name}
                              onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                              onFocus={(e) => e.target.select()}
                              placeholder={item.isGroup ? "Furniture Group Name (e.g., Sofa)" : "Item name"}
                              required
                              sx={{
                                '& .MuiInputBase-input': {
                                  fontWeight: item.isGroup ? 'bold' : 'normal'
                                }
                              }}
                            />
                            {item.isGroup && (
                              <Button
                                size="small"
                                variant="contained"
                                startIcon={<AddIcon />}
                                onClick={() => {
                                  const groupIndex = parseInt(item.id.replace('group-', ''));
                                  addItemToGroup(groupIndex);
                                }}
                                sx={{ 
                                  ...buttonStyles.secondaryButton,
                                  minWidth: 'auto', 
                                  px: 2,
                                  py: 0.5,
                                  fontSize: '0.75rem',
                                  fontWeight: 'bold'
                                }}
                              >
                                Add Item
                              </Button>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell align="center" sx={{ display: item.isGroup ? 'none' : 'table-cell' }}>
                          <TextField
                            size="small"
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            inputProps={{ min: 0.01, step: 0.01 }}
                            sx={{ width: { xs: '100%', sm: 80 }, minWidth: 60 }}
                          />
                        </TableCell>
                        <TableCell align="center" sx={{ display: item.isGroup ? 'none' : 'table-cell' }}>
                          <TextField
                            size="small"
                            type="number"
                            value={item.price}
                            onChange={(e) => updateItem(item.id, 'price', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            inputProps={{ min: 0, step: 0.01 }}
                            sx={{ width: { xs: '100%', sm: 100 }, minWidth: 80 }}
                          />
                        </TableCell>
                        <TableCell align="center" sx={{ display: item.isGroup ? 'none' : 'table-cell' }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            ${((parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0)).toFixed(2)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center" colSpan={item.isGroup ? 3 : 1}>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => deleteItem(item.id)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          {/* Calculations */}
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#274290' }}>
                Invoice Calculations
              </Typography>
              
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 4 }}>
                <Box sx={{ minWidth: 300 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body1">Subtotal:</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                      ${calculateSubtotal().toFixed(2)}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body1">
                      Tax ({taxPercentage}%):
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                      ${calculateTax().toFixed(2)}
                    </Typography>
                  </Box>
                  
                  {creditCardFeeEnabled && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body1">
                        Credit Card Fee ({creditCardFeePercentage}%):
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                        ${calculateCreditCardFee().toFixed(2)}
                      </Typography>
                    </Box>
                  )}
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#274290' }}>
                      Total:
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#f27921' }}>
                      ${calculateTotal().toFixed(2)}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body1">
                      Paid Amount:
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#4CAF50' }}>
                      ${paidAmount.toFixed(2)}
                    </Typography>
                  </Box>
                  
                  <Divider sx={{ my: 1 }} />
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: calculateBalance() >= 0 ? '#f27921' : '#4CAF50' }}>
                      Balance:
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: calculateBalance() >= 0 ? '#f27921' : '#4CAF50' }}>
                      ${calculateBalance().toFixed(2)}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default CreateInvoicePage;
