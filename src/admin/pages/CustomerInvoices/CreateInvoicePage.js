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
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useNotification } from '../../../components/Common/NotificationSystem';
import { addDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { buttonStyles } from '../../../styles/buttonStyles';
import { formatDate } from '../../../utils/dateUtils';
import { calculatePickupDeliveryCost } from '../../../utils/orderCalculations';

const CreateInvoicePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError } = useNotification();
  
  const [loading, setLoading] = useState(false);
  const [orderData, setOrderData] = useState(null);
  
  // Invoice header settings
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [taxPercentage, setTaxPercentage] = useState(13);
  const [creditCardFeeEnabled, setCreditCardFeeEnabled] = useState(false);
  const [creditCardFeePercentage, setCreditCardFeePercentage] = useState(2.5);
  
  // Invoice data (copied from order but editable)
  const [customerInfo, setCustomerInfo] = useState({
    customerName: '',
    email: '',
    phone: '',
    address: ''
  });
  
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (location.state?.orderData) {
      const order = location.state.orderData;
      setOrderData(order);
      
      // Set default invoice number (sequential)
      setInvoiceNumber('');
      
      // Copy customer info from order
      setCustomerInfo({
        customerName: order.personalInfo?.customerName || '',
        email: order.personalInfo?.email || '',
        phone: order.personalInfo?.phone || '',
        address: order.personalInfo?.address || ''
      });
      
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
            invoiceItems.push({
              id: `item-${index}-material`,
              name: 'Material',
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
  }, [location.state, navigate]);

  // Get next invoice number
  const getNextInvoiceNumber = async () => {
    try {
      const invoicesRef = collection(db, 'customer-invoices');
      const invoicesQuery = query(invoicesRef, orderBy('invoiceNumber', 'desc'));
      const invoicesSnapshot = await getDocs(invoicesQuery);
      
      if (invoicesSnapshot.empty) {
        return 'INV-001';
      }
      
      const lastInvoice = invoicesSnapshot.docs[0].data();
      const lastNumber = parseInt(lastInvoice.invoiceNumber?.replace('INV-', '') || '0');
      const nextNumber = lastNumber + 1;
      return `INV-${nextNumber.toString().padStart(3, '0')}`;
    } catch (error) {
      console.error('Error getting next invoice number:', error);
      return 'INV-001';
    }
  };

  // Set default invoice number when component mounts
  useEffect(() => {
    const setDefaultInvoiceNumber = async () => {
      if (!invoiceNumber) {
        const nextNumber = await getNextInvoiceNumber();
        setInvoiceNumber(nextNumber);
      }
    };
    setDefaultInvoiceNumber();
  }, []);

  // Add new item
  const addItem = () => {
    const newItem = {
      id: `item-${Date.now()}`,
      name: 'New Item',
      quantity: 1,
      price: 0,
      type: 'material',
      isGroup: false
    };
    setItems([...items, newItem]);
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

  // Validate form
  const validateForm = () => {
    if (!invoiceNumber.trim()) {
      showError('Invoice number is required');
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
    if (!validateForm()) return;
    
    try {
      setLoading(true);
      
      const invoiceData = {
        invoiceNumber,
        originalOrderId: orderData.id,
        originalOrderNumber: orderData.orderDetails?.billInvoice || 'N/A',
        headerSettings: {
          taxPercentage,
          creditCardFeeEnabled,
          creditCardFeePercentage
        },
        customerInfo,
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
          total: calculateTotal()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await addDoc(collection(db, 'customer-invoices'), invoiceData);
      
      showSuccess('Invoice created successfully!');
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
              
              <TextField
                fullWidth
                label="Invoice Number"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                onFocus={(e) => e.target.select()}
                sx={{ mb: 2 }}
                helperText="Customize the invoice number"
              />
              
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
              />
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
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={addItem}
                  sx={buttonStyles.primaryButton}
                  size="small"
                >
                  Add Item
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
                          <TextField
                            fullWidth
                            size="small"
                            value={item.name}
                            onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            placeholder={item.isGroup ? "Furniture name (e.g., Sofa)" : "Item name"}
                            required
                            sx={{
                              '& .MuiInputBase-input': {
                                fontWeight: item.isGroup ? 'bold' : 'normal'
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <TextField
                            size="small"
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            inputProps={{ min: 0.01, step: 0.01 }}
                            sx={{ width: { xs: '100%', sm: 80 }, minWidth: 60 }}
                            disabled={item.isGroup} // Groups don't need quantity
                          />
                        </TableCell>
                        <TableCell align="center">
                          <TextField
                            size="small"
                            type="number"
                            value={item.price}
                            onChange={(e) => updateItem(item.id, 'price', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            inputProps={{ min: 0, step: 0.01 }}
                            sx={{ width: { xs: '100%', sm: 100 }, minWidth: 80 }}
                            disabled={item.isGroup} // Groups don't need price
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {item.isGroup ? '—' : `$${((parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0)).toFixed(2)}`}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
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
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#274290' }}>
                      Total:
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#f27921' }}>
                      ${calculateTotal().toFixed(2)}
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
