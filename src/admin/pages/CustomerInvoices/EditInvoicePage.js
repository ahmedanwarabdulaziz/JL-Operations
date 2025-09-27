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
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { buttonStyles } from '../../../styles/buttonStyles';

const EditInvoicePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError } = useNotification();
  
  const [loading, setLoading] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);
  
  // Invoice header settings
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [taxPercentage, setTaxPercentage] = useState(13);
  const [creditCardFeeEnabled, setCreditCardFeeEnabled] = useState(false);
  const [creditCardFeePercentage, setCreditCardFeePercentage] = useState(2.5);
  
  // Invoice data (editable)
  const [customerInfo, setCustomerInfo] = useState({
    customerName: '',
    email: '',
    phone: '',
    address: ''
  });
  
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (location.state?.invoiceData) {
      const invoice = location.state.invoiceData;
      setInvoiceData(invoice);
      
      // Set form values from invoice data
      setInvoiceNumber(invoice.invoiceNumber || '');
      setTaxPercentage(invoice.headerSettings?.taxPercentage || 13);
      setCreditCardFeeEnabled(invoice.headerSettings?.creditCardFeeEnabled || false);
      setCreditCardFeePercentage(invoice.headerSettings?.creditCardFeePercentage || 2.5);
      
      // Set customer info
      setCustomerInfo({
        customerName: invoice.customerInfo?.customerName || '',
        email: invoice.customerInfo?.email || '',
        phone: invoice.customerInfo?.phone || '',
        address: invoice.customerInfo?.address || ''
      });
      
      // Set items
      setItems(invoice.items || []);
    } else {
      // Redirect back if no invoice data
      navigate('/admin/customer-invoices');
    }
  }, [location.state, navigate]);

  // Add new item
  const addItem = () => {
    const newItem = {
      id: `item-${Date.now()}`,
      name: '',
      description: '',
      quantity: 1,
      price: 0,
      type: 'furniture'
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

  // Calculate totals
  const calculateSubtotal = () => {
    return items.reduce((sum, item) => {
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
    
    for (const item of items) {
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
    if (!validateForm() || !invoiceData) return;
    
    try {
      setLoading(true);
      
      const updatedInvoiceData = {
        invoiceNumber,
        headerSettings: {
          taxPercentage,
          creditCardFeeEnabled,
          creditCardFeePercentage
        },
        customerInfo,
        items: items.map(item => ({
          ...item,
          quantity: parseFloat(item.quantity),
          price: parseFloat(item.price)
        })),
        calculations: {
          subtotal: calculateSubtotal(),
          taxAmount: calculateTax(),
          creditCardFeeAmount: calculateCreditCardFee(),
          total: calculateTotal()
        },
        updatedAt: new Date()
      };
      
      const invoiceRef = doc(db, 'customer-invoices', invoiceData.id);
      await updateDoc(invoiceRef, updatedInvoiceData);
      
      showSuccess('Invoice updated successfully!');
      navigate('/admin/customer-invoices');
    } catch (error) {
      console.error('Error updating invoice:', error);
      showError('Failed to update invoice. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!invoiceData) {
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
              Edit Customer Invoice
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Editing Invoice #{invoiceNumber}
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
            {loading ? 'Saving...' : 'Update Invoice'}
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Left Column - Header Settings */}
        <Grid item xs={12} md={4}>
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
                sx={{ mb: 2 }}
                helperText="Customize the invoice number"
              />
              
              <TextField
                fullWidth
                label="Tax Percentage (%)"
                type="number"
                value={taxPercentage}
                onChange={(e) => setTaxPercentage(parseFloat(e.target.value) || 0)}
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
                sx={{ mb: 2 }}
                required
              />
              
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={customerInfo.email}
                onChange={(e) => setCustomerInfo({...customerInfo, email: e.target.value})}
                sx={{ mb: 2 }}
              />
              
              <TextField
                fullWidth
                label="Phone"
                value={customerInfo.phone}
                onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                sx={{ mb: 2 }}
              />
              
              <TextField
                fullWidth
                label="Address"
                multiline
                rows={3}
                value={customerInfo.address}
                onChange={(e) => setCustomerInfo({...customerInfo, address: e.target.value})}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column - Items and Calculations */}
        <Grid item xs={12} md={8}>
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
              
              <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Item Name</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell align="center">Quantity</TableCell>
                      <TableCell align="center">Price</TableCell>
                      <TableCell align="center">Total</TableCell>
                      <TableCell align="center">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <TextField
                            fullWidth
                            size="small"
                            value={item.name}
                            onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                            placeholder="Item name"
                            required
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            fullWidth
                            size="small"
                            value={item.description}
                            onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                            placeholder="Description"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <TextField
                            size="small"
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                            inputProps={{ min: 0.01, step: 0.01 }}
                            sx={{ width: 80 }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <TextField
                            size="small"
                            type="number"
                            value={item.price}
                            onChange={(e) => updateItem(item.id, 'price', e.target.value)}
                            inputProps={{ min: 0, step: 0.01 }}
                            sx={{ width: 100 }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            ${((parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0)).toFixed(2)}
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
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#f27921' }}>
                  Total:
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#f27921' }}>
                  ${calculateTotal().toFixed(2)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default EditInvoicePage;
