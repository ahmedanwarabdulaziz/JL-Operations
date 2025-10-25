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
  MenuItem
} from '@mui/material';
import {
  Search as SearchIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Check as CheckIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../../components/Common/NotificationSystem';
import { collection, getDocs, query, orderBy, addDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { getNextCustomerInvoiceNumber } from '../../utils/invoiceNumberUtils';
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
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [contactPersonDialogOpen, setContactPersonDialogOpen] = useState(false);
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
      const nextNumber = await getNextCustomerInvoiceNumber();
      setInvoiceNumber(nextNumber);
    } catch (error) {
      console.error('Error getting next invoice number:', error);
      showError('Failed to get next invoice number');
    } finally {
      setInvoiceNumberLoading(false);
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

  const handleNext = () => {
    if (activeStep === 0 && !selectedCustomer) {
      showError('Please select a corporate customer');
      return;
    }
    if (activeStep === 0 && !selectedContactPerson) {
      showError('Please select a contact person');
      return;
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
          billInvoice: invoiceNumber,
          orderType: 'corporate',
          status: 'pending'
        },
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
            <Typography variant="h6" sx={{ mb: 3 }}>
              Select Corporate Customer
            </Typography>
            
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
                <Grid item xs={12} md={6} lg={4} key={customer.id}>
                  <Card 
                    sx={{ 
                      cursor: 'pointer',
                      '&:hover': { 
                        boxShadow: 3,
                        transform: 'translateY(-2px)',
                        transition: 'all 0.2s ease-in-out'
                      }
                    }}
                    onClick={() => handleCustomerSelect(customer)}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                          <BusinessIcon />
                        </Avatar>
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                            {customer.corporateName}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {customer.email}
                          </Typography>
                        </Box>
                      </Box>
                      
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <PhoneIcon sx={{ fontSize: 16, mr: 1 }} />
                          {customer.phone}
                        </Typography>
                        <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <EmailIcon sx={{ fontSize: 16, mr: 1 }} />
                          {customer.email}
                        </Typography>
                      </Box>

                      {customer.contactPersons && customer.contactPersons.length > 0 && (
                        <Chip 
                          label={`${customer.contactPersons.length} Contact Person${customer.contactPersons.length > 1 ? 's' : ''}`}
                          size="small"
                          color="primary"
                        />
                      )}
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
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
          Corporate Order
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Create a new corporate order
        </Typography>
        
        {/* Step Indicator */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          {steps.map((step, index) => (
            <React.Fragment key={index}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 2,
                  py: 1,
                  borderRadius: 1,
                  backgroundColor: index <= activeStep ? 'primary.main' : 'grey.200',
                  color: index <= activeStep ? 'white' : 'text.secondary',
                  fontSize: '0.875rem',
                  fontWeight: index === activeStep ? 'bold' : 'normal'
                }}
              >
                <Typography variant="body2">
                  {index + 1}. {step}
                </Typography>
                {index <= activeStep && index < steps.length - 1 && (
                  <CheckIcon sx={{ fontSize: 16 }} />
                )}
              </Box>
              {index < steps.length - 1 && (
                <Box sx={{ width: 20, height: 2, backgroundColor: 'grey.300' }} />
              )}
            </React.Fragment>
          ))}
        </Box>
      </Box>

      {/* Invoice Number Display */}
      <Box sx={{ mb: 3 }}>
        <Alert severity="info">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'nowrap' }}>
            <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
              <strong>Invoice Number:</strong> {invoiceNumberLoading ? 'Loading...' : invoiceNumber}
            </Typography>
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
      <Card sx={{ mb: 3 }}>
        <CardContent>
          {renderStepContent()}
        </CardContent>
      </Card>

      {/* Navigation */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button
          onClick={handleBack}
          disabled={activeStep === 0}
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
            <Alert severity="warning">
              No contact persons available for this corporate customer.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCustomerDialogOpen(false)}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CorporateOrderPage;
