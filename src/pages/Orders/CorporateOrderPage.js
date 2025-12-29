import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Card,
  CardContent,
  Grid,
  Button,
  CircularProgress,
  Alert,
  Chip,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Divider,
  MenuItem,
  Stepper,
  Step,
  StepLabel,
  Container,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Search as SearchIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Add as AddIcon,
  LocationOn as LocationIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../../shared/components/Common/NotificationSystem';
import { collection, getDocs, query, orderBy, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { getNextCorporateInvoiceNumber, validateCorporateInvoiceNumber } from '../../utils/invoiceNumberUtils';
import CorporateCustomerDialog from '../../admin/components/CorporateCustomers/CorporateCustomerDialog';
import Step3Furniture from './steps/Step3Furniture';
import Step4PaymentNotes from './steps/Step4PaymentNotes';
import Step5Review from './steps/Step5Review';

const steps = [
  'Select Corporate Customer',
  'Furniture Details',
  'Payment & Notes',
  'Review',
  'Submit'
];

const contactPersonInitialState = {
  name: '',
  email: '',
  phone: '',
  position: '',
  isPrimary: false
};

const CorporateOrderPage = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [corporateCustomers, setCorporateCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedContactPerson, setSelectedContactPerson] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceNumberLoading, setInvoiceNumberLoading] = useState(false);
  const [orderNote, setOrderNote] = useState('');
  const [orderNoteCaption, setOrderNoteCaption] = useState('Note');
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [addCorporateDialogOpen, setAddCorporateDialogOpen] = useState(false);
  const [orderData, setOrderData] = useState({
    furnitureGroups: [],
    paymentDetails: {
      deposit: 0,
      amountPaidEnabled: false,
      amountPaid: 0,
      pickupDeliveryEnabled: false,
      pickupDeliveryServiceType: 'both',
      pickupDeliveryCost: 0,
      notes: ''
    },
    formErrors: {}
  });
  const [contactPersonDialogOpen, setContactPersonDialogOpen] = useState(false);
  const [contactPersonSaving, setContactPersonSaving] = useState(false);
  const [contactPersonForm, setContactPersonForm] = useState(contactPersonInitialState);

  const { showSuccess, showError } = useNotification();
  const navigate = useNavigate();

  // Fetch corporate customers
  const fetchCorporateCustomers = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'corporateCustomers'), orderBy('corporateName'));
      const querySnapshot = await getDocs(q);
      const customers = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCorporateCustomers(customers);
      setFilteredCustomers(customers);
    } catch (error) {
      console.error('Error fetching corporate customers:', error);
      showError('Failed to fetch corporate customers');
    } finally {
      setLoading(false);
    }
  };

  // Get next invoice number
  const getNextInvoiceNumber = async () => {
    try {
      setInvoiceNumberLoading(true);
      const nextNumber = await getNextCorporateInvoiceNumber();
      setInvoiceNumber(nextNumber);
    } catch (error) {
      console.error('Error getting next invoice number:', error);
      showError('Failed to get next invoice number');
    } finally {
      setInvoiceNumberLoading(false);
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

  useEffect(() => {
    fetchCorporateCustomers();
    getNextInvoiceNumber();
  }, []);

  // Filter customers based on search
  useEffect(() => {
    if (!searchTerm) {
      setFilteredCustomers(corporateCustomers);
    } else {
      const filtered = corporateCustomers.filter(customer =>
        customer.corporateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone.includes(searchTerm) ||
        (customer.contactPersons && customer.contactPersons.some(cp =>
          cp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          cp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          cp.phone.includes(searchTerm)
        ))
      );
      setFilteredCustomers(filtered);
    }
  }, [searchTerm, corporateCustomers]);

  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    setCustomerDialogOpen(true);
  };

  const handleContactPersonSelect = (contactPerson) => {
    setSelectedContactPerson(contactPerson);
    setContactPersonDialogOpen(false);
    setCustomerDialogOpen(false);
    // Move to next step
    setActiveStep(1);
  };

  const handleCorporateCustomerSaved = (savedCustomer, { isUpdate }) => {
    setCorporateCustomers((prev) => {
      const updatedList = isUpdate
        ? prev.map((customer) =>
            customer.id === savedCustomer.id ? { ...customer, ...savedCustomer } : customer
          )
        : [...prev, savedCustomer];
      return updatedList.sort((a, b) =>
        (a.corporateName || '').localeCompare(b.corporateName || '', undefined, { sensitivity: 'base' })
      );
    });

    if (isUpdate) {
      if (selectedCustomer?.id === savedCustomer.id) {
        setSelectedCustomer((prev) => (prev ? { ...prev, ...savedCustomer } : prev));
      }
    } else {
      setSelectedCustomer(savedCustomer);
      setSelectedContactPerson(null);
    }
  };

  const handleOpenAddContactPerson = () => {
    if (!selectedCustomer) {
      showError('Please select a corporate customer first');
      return;
    }

    setContactPersonForm(contactPersonInitialState);
    setContactPersonDialogOpen(true);
    setCustomerDialogOpen(false);
  };

  const handleCancelContactPersonDialog = () => {
    setContactPersonDialogOpen(false);
    setContactPersonSaving(false);
    setContactPersonForm(contactPersonInitialState);
    setCustomerDialogOpen(true);
  };

  const handleSaveContactPerson = async () => {
    if (!selectedCustomer) {
      showError('Please select a corporate customer first');
      return;
    }

    if (!contactPersonForm.name.trim()) {
      showError('Contact person name is required');
      return;
    }

    try {
      setContactPersonSaving(true);
      const newContactPerson = {
        ...contactPersonForm,
        id: Date.now().toString()
      };
      const updatedContactPersons = [
        ...(selectedCustomer.contactPersons || []),
        newContactPerson
      ];

      const customerRef = doc(db, 'corporateCustomers', selectedCustomer.id);
      await updateDoc(customerRef, {
        contactPersons: updatedContactPersons,
        updatedAt: new Date()
      });

      setCorporateCustomers((prev) =>
        prev.map((customer) =>
          customer.id === selectedCustomer.id
            ? { ...customer, contactPersons: updatedContactPersons }
            : customer
        )
      );

      setSelectedCustomer((prev) =>
        prev ? { ...prev, contactPersons: updatedContactPersons } : prev
      );

      const newlySelected = newContactPerson;
      setSelectedContactPerson(newlySelected);

      showSuccess('Contact person added successfully');
      setContactPersonDialogOpen(false);
      setContactPersonForm(contactPersonInitialState);
      setCustomerDialogOpen(false);
    } catch (error) {
      console.error('Error adding contact person:', error);
      showError('Failed to add contact person');
    } finally {
      setContactPersonSaving(false);
    }
  };

  const validateFurniture = () => {
    const errors = {};
    
    orderData.furnitureGroups.forEach((group, index) => {
      if (!group.furnitureType.trim()) {
        errors[`furniture_${index}_type`] = 'Furniture type is required';
      }
      if (!group.labourQnty && group.labourQnty !== 0) {
        errors[`furniture_${index}_labourQnty`] = 'Labour quantity is required';
      }
    });

    setOrderData(prev => ({
      ...prev,
      formErrors: errors
    }));
    return Object.keys(errors).length === 0;
  };

  const handleNext = async () => {
    if (activeStep === 0 && !selectedCustomer) {
      showError('Please select a corporate customer');
      return;
    }
    if (activeStep === 0 && !selectedContactPerson) {
      showError('Please select a contact person');
      return;
    }
    
    // Validate invoice number before proceeding from step 0
    if (activeStep === 0) {
      if (!invoiceNumber || !invoiceNumber.startsWith('T-')) {
        showError('Invoice number must be in T-XXXXXX format');
        return;
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
        return;
      }

      const finalInvoiceNumber = `T-${finalNumberPart}`;
      
      // Check for duplicates in both corporate-orders and customer-invoices
      const isValid = await validateCorporateInvoiceNumber(finalInvoiceNumber);
      if (!isValid) {
        showError(`Invoice number ${finalInvoiceNumber} already exists in corporate orders or customer invoices. Please choose a different number.`);
        return;
      }
      
      // Update invoice number if it was padded
      if (finalInvoiceNumber !== invoiceNumber) {
        setInvoiceNumber(finalInvoiceNumber);
      }
    }
    
    if (activeStep === 1) {
      // Validate furniture step
      if (!validateFurniture()) {
        return;
      }
    }
    setActiveStep(activeStep + 1);
  };

  const handleBack = () => {
    setActiveStep(activeStep - 1);
  };

  // Furniture step handlers
  const handleFurnitureChange = (furnitureGroups) => {
    setOrderData(prev => ({
      ...prev,
      furnitureGroups
    }));
  };

  // Payment step handlers
  const handlePaymentChange = (field, value) => {
    setOrderData(prev => ({
      ...prev,
      paymentDetails: {
        ...prev.paymentDetails,
        [field]: value
      }
    }));
  };

  const handleFormErrors = (errors) => {
    setOrderData(prev => ({
      ...prev,
      formErrors: errors
    }));
  };

  const handleSubmit = async () => {
    try {
      // Validate invoice number format
      if (!invoiceNumber || !invoiceNumber.startsWith('T-')) {
        showError('Invoice number must be in T-XXXXXX format');
        return;
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
        return;
      }

      const finalInvoiceNumber = `T-${finalNumberPart}`;
      
      // Only check for duplicates - allow manual number assignment
      const isValid = await validateCorporateInvoiceNumber(finalInvoiceNumber);
      if (!isValid) {
        showError(`Invoice number ${finalInvoiceNumber} is already in use. Please choose a different number.`);
        return;
      }

      // Create corporate order data
      const corporateOrderData = {
        // Corporate customer info
        corporateCustomer: {
          id: selectedCustomer.id,
          corporateName: selectedCustomer.corporateName,
          email: selectedCustomer.email,
          phone: selectedCustomer.phone,
          address: selectedCustomer.address
        },
        // Contact person info
        contactPerson: {
          id: selectedContactPerson.id,
          name: selectedContactPerson.name,
          email: selectedContactPerson.email,
          phone: selectedContactPerson.phone,
          position: selectedContactPerson.position || ''
        },
        // Order details
        orderDetails: {
          billInvoice: finalInvoiceNumber,
          orderType: 'corporate',
          note: {
            caption: orderNoteCaption || 'Note',
            value: orderNote || ''
          }
        },
        // invoiceStatus will be set by status management system (no status field needed)
        // Order data (furniture, materials, payment, etc.)
        furnitureGroups: orderData.furnitureGroups,
        paymentDetails: orderData.paymentDetails,
        // Timestamps
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Add to corporate-orders collection
      await addDoc(collection(db, 'corporate-orders'), corporateOrderData);

      showSuccess('Corporate order created successfully!');
      navigate('/admin/orders');
    } catch (error) {
      console.error('Error creating corporate order:', error);
      showError('Failed to create corporate order');
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 3,
                flexWrap: 'wrap',
                gap: 2
              }}
            >
              <Typography variant="h6" sx={{ mb: 0 }}>
                Select Corporate Customer
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setAddCorporateDialogOpen(true)}
                sx={{
                  background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
                  color: '#000000',
                  border: '3px solid #4CAF50',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.3)',
                  position: 'relative',
                  '&:hover': {
                    background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
                    border: '3px solid #45a049',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.3), 0 6px 12px rgba(0,0,0,0.4)'
                  }
                }}
              >
                Add Corporate Customer
              </Button>
            </Box>
            
            {/* Search */}
            <TextField
              fullWidth
              placeholder="Search corporate customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 3 }}
            />

            {/* Customer Cards */}
            <Grid container spacing={2}>
              {filteredCustomers.map((customer) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={customer.id} sx={{ display: 'flex', minWidth: 0 }}>
                  <Card 
                    sx={{ 
                      width: '100%',
                      maxWidth: '100%',
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      borderRadius: 2,
                      boxShadow: 2,
                      boxSizing: 'border-box',
                      cursor: 'pointer',
                      '&:hover': { 
                        boxShadow: 4,
                        transform: 'translateY(-2px)',
                        transition: 'all 0.2s ease-in-out',
                        border: '2px solid #d4af5a'
                      }
                    }}
                    onClick={() => handleCustomerSelect(customer)}
                  >
                    <CardContent sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                        {customer.corporateName}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {filteredCustomers.length === 0 && !loading && (
              <Alert severity="info" sx={{ mt: 3 }}>
                No corporate customers found. Please add corporate customers first.
              </Alert>
            )}
          </Box>
        );

      case 1:
        return (
          <Step3Furniture
            furnitureGroups={orderData.furnitureGroups}
            onFurnitureChange={handleFurnitureChange}
            formErrors={orderData.formErrors}
            setFormErrors={handleFormErrors}
          />
        );

      case 2:
        return (
          <Step4PaymentNotes
            paymentDetails={orderData.paymentDetails}
            onPaymentChange={handlePaymentChange}
            formErrors={orderData.formErrors}
            setFormErrors={handleFormErrors}
          />
        );

      case 3:
        return (
          <Step5Review
            personalInfo={{
              customerName: selectedCustomer?.corporateName || '',
              phone: selectedCustomer?.phone || '',
              email: selectedCustomer?.email || '',
              address: selectedCustomer?.address || ''
            }}
            orderDetails={{
              description: `Corporate Order for ${selectedCustomer?.corporateName}`,
              billInvoice: invoiceNumber,
              platform: 'Corporate',
              startDate: new Date(),
              timeline: 'TBD'
            }}
            furnitureGroups={orderData.furnitureGroups}
            paymentDetails={orderData.paymentDetails}
            onEditStep={(step) => setActiveStep(step)}
            showEditButtons={true}
          />
        );

      default:
        return (
          <Box>
            <Typography variant="h6" sx={{ mb: 3 }}>
              Submit Corporate Order
            </Typography>
            <Alert severity="success">
              Ready to submit the corporate order to the database.
            </Alert>
          </Box>
        );
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
          Corporate Order
        </Typography>

        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Invoice Number Display and Edit */}
        <Box sx={{ mb: 3 }}>
          <Alert severity="info">
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="body2" sx={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                  Invoice Number:
                </Typography>
                {invoiceNumberLoading ? (
                  <CircularProgress size={16} />
                ) : (
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
                      disabled={invoiceNumberLoading}
                      sx={{
                        width: 120,
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
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 300 }}>
                  <TextField
                    value={orderNoteCaption}
                    onChange={(e) => setOrderNoteCaption(e.target.value)}
                    placeholder="Caption"
                    size="small"
                    sx={{
                      width: 120,
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
                      }
                    }}
                  />
                  <Typography variant="body2" sx={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                    :
                  </Typography>
                  <TextField
                    fullWidth
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                    placeholder="Enter order note..."
                    size="small"
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
                      }
                    }}
                  />
                </Box>
              </Box>
              {(selectedCustomer || selectedContactPerson) && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  {selectedCustomer && (
                    <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                      Corporate: {selectedCustomer.corporateName}
                    </Typography>
                  )}
                  {selectedContactPerson && (
                    <Typography variant="body2" sx={{ color: 'secondary.main', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                      Contact: {selectedContactPerson.name}
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          </Alert>
        </Box>

        {/* Selected Customer Info - Only show in Step 1 */}
        {selectedCustomer && activeStep === 0 && (
          <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'grey.300' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Corporate Customer Details:
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              {selectedCustomer.corporateName} • {selectedCustomer.email} • {selectedCustomer.phone}
            </Typography>
            {selectedCustomer.address && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {selectedCustomer.address}
              </Typography>
            )}
            {selectedContactPerson && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Contact: {selectedContactPerson.name} • {selectedContactPerson.email} • {selectedContactPerson.phone}
              </Typography>
            )}
          </Box>
        )}

        {/* Step Content */}
        <Box sx={{ mt: 4 }}>
          {renderStepContent()}
        </Box>

        {/* Navigation */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
          <Button
            onClick={handleBack}
            disabled={activeStep === 0}
            sx={{ 
              mr: 1,
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
                borderRadius: '6px 6px 0 0',
                pointerEvents: 'none'
              }
            }}
          >
            Back
          </Button>
          <Button
            variant="contained"
            onClick={activeStep === steps.length - 1 ? handleSubmit : handleNext}
            disabled={activeStep === 0 && (!selectedCustomer || !selectedContactPerson)}
          >
            {activeStep === steps.length - 1 ? 'Submit Order' : 'Next'}
          </Button>
        </Box>
      </Paper>

      {/* Contact Person Selection Dialog */}
      <Dialog 
        open={customerDialogOpen} 
        onClose={() => setCustomerDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Select Contact Person - {selectedCustomer?.corporateName}
        </DialogTitle>
        <DialogContent>
          {selectedCustomer?.contactPersons && selectedCustomer.contactPersons.length > 0 ? (
            <List>
              {selectedCustomer.contactPersons.map((contactPerson, index) => (
                <React.Fragment key={contactPerson.id || index}>
                  <ListItem>
                    <ListItemButton onClick={() => handleContactPersonSelect(contactPerson)}>
                      <Avatar sx={{ bgcolor: 'secondary.main', mr: 2 }}>
                        <PersonIcon />
                      </Avatar>
                      <ListItemText
                        primary={contactPerson.name}
                        secondary={`${contactPerson.email} • ${contactPerson.phone}`}
                      />
                    </ListItemButton>
                  </ListItem>
                  {index < selectedCustomer.contactPersons.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Alert severity="warning">
                No contact persons available for this corporate customer.
              </Alert>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleOpenAddContactPerson}
                sx={{
                  background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
                  color: '#000000',
                  border: '3px solid #4CAF50',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.3)',
                  position: 'relative',
                  '&:hover': {
                    background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
                    border: '3px solid #45a049',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.3), 0 6px 12px rgba(0,0,0,0.4)'
                  }
                }}
              >
                Add Contact Person
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {selectedCustomer?.contactPersons && selectedCustomer.contactPersons.length > 0 && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenAddContactPerson}
              sx={{
                background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
                color: '#000000',
                border: '3px solid #4CAF50',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.3)',
                position: 'relative',
                '&:hover': {
                  background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
                  border: '3px solid #45a049',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.3), 0 6px 12px rgba(0,0,0,0.4)'
                }
              }}
            >
              Add Contact Person
            </Button>
          )}
          <Button 
            onClick={() => setCustomerDialogOpen(false)}
            sx={{
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
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      <CorporateCustomerDialog
        open={addCorporateDialogOpen}
        onClose={() => setAddCorporateDialogOpen(false)}
        onSaved={handleCorporateCustomerSaved}
        onSuccess={showSuccess}
        onError={showError}
      />

      <Dialog
        open={contactPersonDialogOpen}
        onClose={handleCancelContactPersonDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          sx={{
            background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
            color: '#000000',
            fontWeight: 'bold'
          }}
        >
          Add Contact Person
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              fullWidth
              label="Name"
              value={contactPersonForm.name}
              onChange={(e) => setContactPersonForm({ ...contactPersonForm, name: e.target.value })}
              required
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#d4af5a'
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#d4af5a',
                    borderWidth: 2
                  }
                },
                '& .MuiInputLabel-root': {
                  '&.Mui-focused': {
                    color: '#d4af5a'
                  }
                }
              }}
            />

            <TextField
              fullWidth
              label="Email"
              type="email"
              value={contactPersonForm.email}
              onChange={(e) => setContactPersonForm({ ...contactPersonForm, email: e.target.value })}
              required
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#d4af5a'
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#d4af5a',
                    borderWidth: 2
                  }
                },
                '& .MuiInputLabel-root': {
                  '&.Mui-focused': {
                    color: '#d4af5a'
                  }
                }
              }}
            />

            <TextField
              fullWidth
              label="Phone"
              value={contactPersonForm.phone}
              onChange={(e) => setContactPersonForm({ ...contactPersonForm, phone: e.target.value })}
              required
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#d4af5a'
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#d4af5a',
                    borderWidth: 2
                  }
                },
                '& .MuiInputLabel-root': {
                  '&.Mui-focused': {
                    color: '#d4af5a'
                  }
                }
              }}
            />

            <TextField
              fullWidth
              label="Position"
              value={contactPersonForm.position}
              onChange={(e) => setContactPersonForm({ ...contactPersonForm, position: e.target.value })}
              placeholder="e.g., Manager, Director, CEO..."
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#d4af5a'
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#d4af5a',
                    borderWidth: 2
                  }
                },
                '& .MuiInputLabel-root': {
                  '&.Mui-focused': {
                    color: '#d4af5a'
                  }
                }
              }}
            />

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 2,
                border: '2px solid #e0e0e0',
                borderRadius: 1,
                backgroundColor: '#f9f9f9',
                '&:hover': {
                  borderColor: '#d4af5a',
                  backgroundColor: '#f5f5f5'
                }
              }}
            >
              <input
                type="checkbox"
                checked={contactPersonForm.isPrimary}
                onChange={(e) =>
                  setContactPersonForm({ ...contactPersonForm, isPrimary: e.target.checked })
                }
                style={{
                  width: '18px',
                  height: '18px',
                  accentColor: '#d4af5a'
                }}
              />
              <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#333333' }}>
                Primary Contact Person
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button
            onClick={handleCancelContactPersonDialog}
            sx={{ color: '#666666' }}
            disabled={contactPersonSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveContactPerson}
            variant="contained"
            disabled={contactPersonSaving}
            sx={{
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
              '&.Mui-disabled': {
                background: 'linear-gradient(145deg, rgba(212,175,90,0.5) 0%, rgba(185,143,51,0.5) 50%, rgba(139,107,31,0.5) 100%)',
                borderColor: 'rgba(76,175,80,0.5)',
                color: 'rgba(0,0,0,0.4)'
              }
            }}
          >
            {contactPersonSaving ? 'Saving...' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default CorporateOrderPage;
