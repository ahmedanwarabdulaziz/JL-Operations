import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Stepper,
  Step,
  StepLabel,
  Paper,
  Container,
  CircularProgress
} from '@mui/material';
import { useNotification } from '../../components/Common/NotificationSystem';
import { db } from '../../firebase/config';
import { collection, getDocs, addDoc, query, orderBy } from 'firebase/firestore';
import Step1PersonalInfo from './steps/Step1PersonalInfo';
import Step2OrderDetails from './steps/Step2OrderDetails';
import Step3Furniture from './steps/Step3Furniture';
import Step4PaymentNotes from './steps/Step4PaymentNotes';
import Step5Review from './steps/Step5Review';

const steps = [
  'Personal Info',
  'Order Details',
  'Furniture',
  'Payment & Notes',
  'Review'
];

const NewOrderPage = () => {
  const { showSuccess, showError } = useNotification();
  
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [editingFromReview, setEditingFromReview] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [existingCustomerDialog, setExistingCustomerDialog] = useState(false);
  const [matchedCustomer, setMatchedCustomer] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  
  // Form data state
  const [personalInfo, setPersonalInfo] = useState({
    customerName: '',
    phone: '',
    email: '',
    address: ''
  });
  
  const [orderDetails, setOrderDetails] = useState({
    billInvoice: '',
    orderDate: new Date().toISOString().split('T')[0],
    deliveryDate: '',
    orderType: 'New',
    priority: 'Normal'
  });
  
  const [furnitureGroups, setFurnitureGroups] = useState([
    {
      type: '',
      material: '',
      materialQuantity: '',
      labour: '',
      labourQuantity: '',
      foam: '',
      foamQuantity: '',
      customerNotes: ''
    }
  ]);
  
  const [paymentDetails, setPaymentDetails] = useState({
    deposit: '',
    pickupDelivery: false,
    pickupDeliveryCost: ''
  });

  // Get next bill number function
  const getNextBillNumber = async () => {
    try {
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, orderBy('billInvoice', 'desc'));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return '1001';
      }
      
      const orders = querySnapshot.docs.map(doc => doc.data());
      const billNumbers = orders
        .map(order => order.billInvoice)
        .filter(bill => bill && !isNaN(parseInt(bill)))
        .map(bill => parseInt(bill));
      
      const maxBillNumber = Math.max(...billNumbers, 1000);
      return (maxBillNumber + 1).toString();
    } catch (error) {
      console.error('Error getting next bill number:', error);
      return '1001';
    }
  };

  // Load customers and set next bill number
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Load customers
        const customersRef = collection(db, 'customers');
        const customersSnapshot = await getDocs(customersRef);
        const customersData = customersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setCustomers(customersData);

        // Get and set next bill number
        const nextBillNumber = await getNextBillNumber();
        setOrderDetails(prev => ({
          ...prev,
          billInvoice: nextBillNumber
        }));
      } catch (error) {
        console.error('Error loading initial data:', error);
        showError('Failed to load initial data');
      }
    };

    loadInitialData();
  }, [showError]);

  // Validation functions
  const validatePersonalInfo = () => {
    const errors = {};

    if (!personalInfo.customerName.trim()) {
      errors.customerName = 'Customer name is required';
    } else if (personalInfo.customerName.trim().length < 2) {
      errors.customerName = 'Customer name must be at least 2 characters';
    }

    if (!personalInfo.phone.trim()) {
      errors.phone = 'Phone number is required';
    }

    if (!personalInfo.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalInfo.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!personalInfo.address.trim()) {
      errors.address = 'Address is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateOrderDetails = () => {
    const errors = {};

    if (!orderDetails.billInvoice.trim()) {
      errors.billInvoice = 'Bill number is required';
    }

    if (!orderDetails.orderDate) {
      errors.orderDate = 'Order date is required';
    }

    if (!orderDetails.deliveryDate) {
      errors.deliveryDate = 'Delivery date is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateFurniture = () => {
    const errors = {};
    
    furnitureGroups.forEach((group, index) => {
      if (!group.type.trim()) {
        errors[`furniture_${index}_type`] = 'Furniture type is required';
      }
    });

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validatePayment = () => {
    const errors = {};

    if (paymentDetails.pickupDelivery && !paymentDetails.pickupDeliveryCost.trim()) {
      errors.pickupDeliveryCost = 'Pickup & delivery cost is required when enabled';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    let isValid = false;

    switch (activeStep) {
      case 0:
        isValid = validatePersonalInfo();
        break;
      case 1:
        isValid = validateOrderDetails();
        break;
      case 2:
        isValid = validateFurniture();
        break;
      case 3:
        isValid = validatePayment();
        break;
      default:
        isValid = true;
    }

    if (isValid) {
      // If we're editing from review step, go back to review
      if (editingFromReview) {
        setActiveStep(4); // Go back to review step
        setEditingFromReview(false); // Reset the flag
      } else if (activeStep < 4) {
        setActiveStep((prevActiveStep) => prevActiveStep + 1);
      }
    }
  };

  const handleBack = () => {
    // If we're editing from review and going back, go to review
    if (editingFromReview) {
      setActiveStep(4);
      setEditingFromReview(false);
    } else {
      setActiveStep((prevActiveStep) => prevActiveStep - 1);
    }
  };

  const handleUseExistingCustomer = () => {
    setPersonalInfo({
      customerName: matchedCustomer.customerName,
      email: matchedCustomer.email,
      phone: matchedCustomer.phone,
      address: matchedCustomer.address
    });
    setExistingCustomerDialog(false);
    setMatchedCustomer(null);
  };

  const handleCreateNewCustomer = () => {
    setExistingCustomerDialog(false);
    setMatchedCustomer(null);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Check if customer exists, if not save to customers collection
      const existingCustomer = customers.find(customer => 
        customer.customerName === personalInfo.customerName ||
        customer.email === personalInfo.email ||
        customer.phone === personalInfo.phone
      );

      if (!existingCustomer) {
        // Save customer data
        const customerData = {
          customerName: personalInfo.customerName,
          email: personalInfo.email,
          phone: personalInfo.phone || '',
          address: personalInfo.address,
          createdAt: new Date().toISOString()
        };
        await addDoc(collection(db, 'customers'), customerData);
      }

      // Save order data
      const orderData = {
        personalInfo,
        orderDetails,
        furnitureGroups,
        paymentDetails,
        createdAt: new Date().toISOString(),
        status: 'pending'
      };

      await addDoc(collection(db, 'orders'), orderData);
      
      showSuccess('Order saved successfully!');
      
      // Reset form data
      setPersonalInfo({
        customerName: '',
        email: '',
        phone: '',
        address: ''
      });
      
      const newBillNumber = await getNextBillNumber();
      setOrderDetails({
        billInvoice: newBillNumber,
        orderDate: new Date().toISOString().split('T')[0],
        deliveryDate: '',
        orderType: 'New',
        priority: 'Normal'
      });
      setFurnitureGroups([
        {
          type: '',
          material: '',
          materialQuantity: '',
          labour: '',
          labourQuantity: '',
          foam: '',
          foamQuantity: '',
          customerNotes: ''
        }
      ]);
      setPaymentDetails({
        deposit: '',
        pickupDelivery: false,
        pickupDeliveryCost: ''
      });
      setActiveStep(0);
      setFormErrors({});
      
    } catch (error) {
      console.error('Error saving order:', error);
      showError('Failed to save order: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePersonalInfoChange = (field, value) => {
    setPersonalInfo(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleEditStep = (stepIndex) => {
    setActiveStep(stepIndex);
    // If we're navigating from step 5 (review) to any other step, we're editing
    if (activeStep === 4) {
      setEditingFromReview(true);
    }
  };

  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Step1PersonalInfo
            personalInfo={personalInfo}
            onPersonalInfoChange={handlePersonalInfoChange}
            customers={customers}
            onUseExistingCustomer={handleUseExistingCustomer}
            formErrors={formErrors}
            setFormErrors={setFormErrors}
            existingCustomerDialog={existingCustomerDialog}
            setExistingCustomerDialog={setExistingCustomerDialog}
            matchedCustomer={matchedCustomer}
            handleCreateNewCustomer={handleCreateNewCustomer}
          />
        );

      case 1:
        return (
          <Step2OrderDetails
            orderDetails={orderDetails}
            onOrderDetailsChange={(field, value) => setOrderDetails(prev => ({ ...prev, [field]: value }))}
            formErrors={formErrors}
            setFormErrors={setFormErrors}
          />
        );

      case 2:
        return (
          <Step3Furniture
            furnitureGroups={furnitureGroups}
            onFurnitureChange={setFurnitureGroups}
          />
        );

      case 3:
        return (
          <Step4PaymentNotes
            paymentDetails={paymentDetails}
            onPaymentChange={setPaymentDetails}
          />
        );

      case 4:
        return (
          <Step5Review
            personalInfo={personalInfo}
            orderDetails={orderDetails}
            furnitureGroups={furnitureGroups}
            paymentDetails={paymentDetails}
            onPersonalInfoChange={(field, value) => handlePersonalInfoChange(field, value)}
            onOrderDetailsChange={(field, value) => setOrderDetails(prev => ({ ...prev, [field]: value }))}
            onFurnitureChange={setFurnitureGroups}
            onPaymentChange={setPaymentDetails}
            formErrors={formErrors}
            setFormErrors={setFormErrors}
            onEditStep={handleEditStep}
          />
        );

      default:
        return 'Unknown step';
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom align="center">
        New Order
      </Typography>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Box>
          {getStepContent(activeStep)}
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
            <Button
              disabled={activeStep === 0}
              onClick={handleBack}
              sx={{ mr: 1 }}
            >
              Back
            </Button>
            
            <Box>
              {activeStep === steps.length - 1 ? (
                <Button
                  variant="contained"
                  onClick={handleSubmit}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : null}
                >
                  {loading ? 'Saving...' : 'Save Order'}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={handleNext}
                >
                  Next
                </Button>
              )}
            </Box>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default NewOrderPage; 