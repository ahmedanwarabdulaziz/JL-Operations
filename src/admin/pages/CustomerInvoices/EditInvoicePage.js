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
import { useNotification } from '../../../components/Common/NotificationSystem';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { buttonStyles } from '../../../styles/buttonStyles';
import { validateCorporateInvoiceNumber } from '../../../utils/invoiceNumberUtils';

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
  const [paidAmount, setPaidAmount] = useState(0);
  
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
      setPaidAmount(invoice.paidAmount || invoice.calculations?.paidAmount || 0);
      
      // Set customer info
      setCustomerInfo({
        customerName: invoice.customerInfo?.customerName || '',
        email: invoice.customerInfo?.email || '',
        phone: invoice.customerInfo?.phone || '',
        address: invoice.customerInfo?.address || ''
      });
      
      // Reconstruct items from saved invoice data
      // Organize items under their furniture groups
      const reconstructedItems = [];
      
      // Group items by their furniture group index
      const itemsByGroup = {};
      if (invoice.items) {
        invoice.items.forEach(item => {
          // Extract group index from item ID (e.g., "item-0-material" -> 0)
          const match = item.id?.match(/item-(\d+)-/);
          const groupIndex = match ? parseInt(match[1]) : -1;
          
          if (groupIndex >= 0) {
            if (!itemsByGroup[groupIndex]) {
              itemsByGroup[groupIndex] = [];
            }
            itemsByGroup[groupIndex].push(item);
          }
        });
      }
      
      // Add furniture groups with their items in order
      if (invoice.furnitureGroups) {
        invoice.furnitureGroups.forEach((group, index) => {
          // Add the furniture group header
          reconstructedItems.push({
            id: `group-${index}`,
            name: group.name,
            quantity: 1,
            price: 0,
            type: 'group',
            isGroup: true
          });
          
          // Add items that belong to this group
          const groupItems = itemsByGroup[index] || [];
          groupItems.forEach(item => {
            reconstructedItems.push({
              ...item,
              isGroup: false
            });
          });
        });
      }
      
      // Add any ungrouped items at the end
      const ungroupedItems = (invoice.items || []).filter(item => {
        const match = item.id?.match(/item-(\d+)-/);
        const groupIndex = match ? parseInt(match[1]) : -1;
        return groupIndex >= (invoice.furnitureGroups || []).length;
      });
      
      ungroupedItems.forEach(item => {
        reconstructedItems.push({
          ...item,
          isGroup: false
        });
      });
      
      setItems(reconstructedItems);
    } else {
      // Redirect back if no invoice data
      navigate('/admin/customer-invoices');
    }
  }, [location.state, navigate]);

  // Add new item
  const addItem = () => {
    // Find the last furniture group index to assign the new item to it
    const furnitureGroups = items.filter(item => item.isGroup);
    const lastGroupIndex = furnitureGroups.length > 0 ? furnitureGroups.length - 1 : 0;
    
    const newItem = {
      id: `item-${lastGroupIndex}-${Date.now()}`,
      name: '',
      description: '',
      quantity: 1,
      price: 0,
      type: 'furniture',
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
      name: '',
      description: '',
      quantity: 1,
      price: 0,
      type: 'furniture',
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

  // Calculate totals
  const calculateSubtotal = () => {
    return items.reduce((sum, item) => {
      // Skip group items in calculations
      if (item.isGroup) return sum;
      
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
      // Don't check against current invoice number (allow keeping same number)
      const currentInvoiceNumber = invoiceData?.invoiceNumber;
      if (!isValid && fullNumber !== currentInvoiceNumber) {
        showError(`Invoice number ${fullNumber} is already in use. Please choose a different number.`);
        // Don't prevent setting - just warn the user
      }
    }
  };

  // Validate form
  const validateForm = async () => {
    if (!invoiceNumber.trim()) {
      showError('Invoice number is required');
      return false;
    }
    
    // If it's T- format, validate it
    if (invoiceNumber.startsWith('T-')) {
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
      
      // Check for duplicates (excluding current invoice)
      const currentInvoiceNumber = invoiceData?.invoiceNumber;
      if (finalInvoiceNumber !== currentInvoiceNumber) {
        const isValid = await validateCorporateInvoiceNumber(finalInvoiceNumber);
        if (!isValid) {
          showError(`Invoice number ${finalInvoiceNumber} already exists in corporate orders or customer invoices. Please choose a different number.`);
          return false;
        }
      }
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
      
      // Skip validation for group items (they don't need quantity/price)
      if (item.isGroup) continue;
      
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
    if (!isValid || !invoiceData) return;
    
    try {
      setLoading(true);
      
      // Ensure invoice number is properly formatted if T- format
      let finalInvoiceNumber = invoiceNumber;
      if (invoiceNumber.startsWith('T-')) {
        const numberPart = invoiceNumber.substring(2);
        const finalNumberPart = numberPart.length === 6 ? numberPart : numberPart.padStart(6, '0');
        finalInvoiceNumber = `T-${finalNumberPart}`;
      }
      
      const updatedInvoiceData = {
        invoiceNumber: finalInvoiceNumber,
        headerSettings: {
          taxPercentage,
          creditCardFeeEnabled,
          creditCardFeePercentage
        },
        customerInfo,
        paidAmount: parseFloat(paidAmount) || 0,
        // Preserve original customer info if it exists
        ...(invoiceData.originalCustomerInfo && { originalCustomerInfo: invoiceData.originalCustomerInfo }),
        items: items.filter(item => !item.isGroup).map(item => ({
          ...item,
          quantity: parseFloat(item.quantity),
          price: parseFloat(item.price)
        })),
        furnitureGroups: items.filter(item => item.isGroup).map((item, index) => ({
          name: item.name
        })),
        calculations: {
          subtotal: calculateSubtotal(),
          taxAmount: calculateTax(),
          creditCardFeeAmount: calculateCreditCardFee(),
          total: calculateTotal(),
          paidAmount: parseFloat(paidAmount) || 0,
          balance: calculateBalance()
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
              
              {invoiceNumber.startsWith('T-') ? (
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
              ) : (
                <TextField
                  fullWidth
                  label="Invoice Number"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  sx={{ mb: 2 }}
                  helperText="Customize the invoice number (old format - will be converted to T- format on save)"
                />
              )}
              
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
                sx={{ mb: 2 }}
              />
              
              <TextField
                fullWidth
                label="Paid Amount ($)"
                type="number"
                value={paidAmount}
                onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                inputProps={{ min: 0, step: 0.01 }}
                helperText="Amount already paid by customer"
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
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
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={addFurnitureGroup}
                  sx={buttonStyles.secondaryButton}
                  size="small"
                >
                  Add Group
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
                      <TableRow 
                        key={item.id} 
                        sx={{ 
                          backgroundColor: item.isGroup ? '#f5f5f5' : 'inherit',
                          '& .MuiTableCell-root': {
                            fontWeight: item.isGroup ? 'bold' : 'normal',
                            color: item.isGroup ? '#274290' : 'inherit',
                            paddingLeft: item.isGroup ? '16px' : '32px' // Indent items under groups
                          }
                        }}
                      >
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <TextField
                              fullWidth
                              size="small"
                              value={item.name}
                              onChange={(e) => updateItem(item.id, 'name', e.target.value)}
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
                        <TableCell sx={{ display: item.isGroup ? 'none' : 'table-cell' }}>
                          <TextField
                            fullWidth
                            size="small"
                            value={item.description || ''}
                            onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                            placeholder="Description"
                          />
                        </TableCell>
                        <TableCell align="center" sx={{ display: item.isGroup ? 'none' : 'table-cell' }}>
                          <TextField
                            size="small"
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                            inputProps={{ min: 0.01, step: 0.01 }}
                            sx={{ width: 80 }}
                          />
                        </TableCell>
                        <TableCell align="center" sx={{ display: item.isGroup ? 'none' : 'table-cell' }}>
                          <TextField
                            size="small"
                            type="number"
                            value={item.price}
                            onChange={(e) => updateItem(item.id, 'price', e.target.value)}
                            inputProps={{ min: 0, step: 0.01 }}
                            sx={{ width: 100 }}
                          />
                        </TableCell>
                        <TableCell align="center" sx={{ display: item.isGroup ? 'none' : 'table-cell' }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            ${((parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0)).toFixed(2)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center" colSpan={item.isGroup ? 4 : 1}>
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
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#f27921' }}>
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
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default EditInvoicePage;

