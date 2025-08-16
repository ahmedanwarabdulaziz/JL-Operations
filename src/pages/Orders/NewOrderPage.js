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
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  List,
  ListItem,
  ListItemText,
  Divider
} from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useNotification } from '../../components/Common/NotificationSystem';
import { collection, getDocs, addDoc, query, orderBy, doc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { sendEmailWithConfig, ensureGmailAuthorized } from '../../services/emailService';
import Step1PersonalInfo from './steps/Step1PersonalInfo';
import Step2OrderDetails from './steps/Step2OrderDetails';
import Step3Furniture from './steps/Step3Furniture';
import Step4PaymentNotes from './steps/Step4PaymentNotes';
import Step5Review from './steps/Step5Review';
import Step6Submit from './steps/Step6Submit';
import { useAutoSelect } from '../../hooks/useAutoSelect';

const steps = [
  'Personal Info',
  'Order Details',
  'Furniture',
  'Payment & Notes',
  'Review',
  'Submit'
];

const NewOrderPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError } = useNotification();
  const { onFocus: handleAutoSelect } = useAutoSelect();
  
  // Check if we're in edit mode
  const isEditMode = location.state?.editMode || false;
  const orderToEdit = location.state?.orderData || null;
  const initialActiveStep = location.state?.activeStep || 0;
  
  const [activeStep, setActiveStep] = useState(initialActiveStep);
  const [loading, setLoading] = useState(false);
  const [editingFromReview, setEditingFromReview] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [existingCustomerDialog, setExistingCustomerDialog] = useState(false);
  const [matchedCustomer, setMatchedCustomer] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateCustomers, setDuplicateCustomers] = useState([]);
  const [isUsingExistingCustomer, setIsUsingExistingCustomer] = useState(false);
  const [selectedExistingCustomer, setSelectedExistingCustomer] = useState(null);
  const [sendEmail, setSendEmail] = useState(true);
  
  // Form data state
  const [personalInfo, setPersonalInfo] = useState({
    customerName: '',
    phone: '',
    email: '',
    address: ''
  });
  
  const [orderDetails, setOrderDetails] = useState({
    billInvoice: '',
    description: '',
    platform: '',
    startDate: new Date().toISOString().split('T')[0],
    timeline: ''
  });
  
  const [furnitureGroups, setFurnitureGroups] = useState([
    {
      furnitureType: '',
      materialCompany: '',
      materialCode: '',
      materialQnty: '',
      materialPrice: '',
      labourPrice: '',
      labourQnty: 1,
      labourNote: '',
      foamEnabled: false,
      foamPrice: '',
      foamQnty: 1,
      foamNote: '',
      customerNote: ''
    }
  ]);
  
  const [paymentDetails, setPaymentDetails] = useState({
    deposit: 0, // Required deposit amount
    amountPaid: 0, // Actual amount paid by customer
    amountPaidEnabled: false, // Toggle for amount paid field
    pickupDeliveryEnabled: false,
    pickupDeliveryCost: '',
    pickupDeliveryServiceType: 'both', // Default to both for backward compatibility
    notes: ''
  });

  // Get next bill number function
  const getNextBillNumber = async () => {
    try {
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, orderBy('orderDetails.billInvoice', 'desc'));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return '100001';
      }
      
      const orders = querySnapshot.docs.map(doc => doc.data());
      const billNumbers = orders
        .map(order => order.orderDetails?.billInvoice)
        .filter(bill => bill && !isNaN(parseInt(bill)))
        .map(bill => parseInt(bill));
      
      const maxBillNumber = Math.max(...billNumbers, 100000);
      const nextNumber = maxBillNumber + 1;
      
      // Ensure it's 6 digits by padding with zeros if needed
      return nextNumber.toString().padStart(6, '0');
    } catch (error) {
      console.error('Error getting next bill number:', error);
      return '100001';
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

        // If in edit mode, populate form with existing data
        if (isEditMode && orderToEdit) {
          setPersonalInfo(orderToEdit.personalInfo || {});
          setOrderDetails(orderToEdit.orderDetails || {});
          setFurnitureGroups(orderToEdit.furnitureData?.groups || []);
          setPaymentDetails(orderToEdit.paymentData || {});
          
          // Check if the customer from the order exists in customers collection
          const orderCustomer = orderToEdit.personalInfo;
          if (orderCustomer) {
            const existingCustomer = customersData.find(customer => {
              let hasMatch = false;
              
              // Check name match only if both have names
              if (customer.name && orderCustomer.customerName) {
                const nameMatch = customer.name.toLowerCase().trim() === orderCustomer.customerName.toLowerCase().trim();
                if (nameMatch) hasMatch = true;
              }
              
              // Check phone match only if BOTH have a non-empty value and are equal
              const phoneMatch =
                customer.phone && customer.phone.trim().length > 0 &&
                orderCustomer.phone && orderCustomer.phone.trim().length > 0 &&
                customer.phone.trim() === orderCustomer.phone.trim();
              if (phoneMatch) hasMatch = true;
              
              // Check email match only if both have emails
              if (customer.email && orderCustomer.email) {
                const emailMatch = customer.email.toLowerCase().trim() === orderCustomer.email.toLowerCase().trim();
                if (emailMatch) hasMatch = true;
              }
              
              return hasMatch;
            });
            
            if (existingCustomer) {
              setIsUsingExistingCustomer(true);
              setSelectedExistingCustomer(existingCustomer);
            }
          }
          
          // Set active step if specified in location state
          if (location.state?.activeStep !== undefined) {
            setActiveStep(location.state.activeStep);
          }
        } else {
          // Get and set next bill number for new orders
          const nextBillNumber = await getNextBillNumber();
          setOrderDetails(prev => ({
            ...prev,
            billInvoice: nextBillNumber
          }));
        }
      } catch (error) {
        console.error('Error loading initial data:', error);
        showError('Failed to load initial data');
      }
    };

    loadInitialData();
  }, [showError, isEditMode, orderToEdit]);

  // Validation functions
  const validatePersonalInfo = () => {
    const errors = {};

    if (!personalInfo.customerName.trim()) {
      errors.customerName = 'Customer name is required';
    } else if (personalInfo.customerName.trim().length < 2) {
      errors.customerName = 'Customer name must be at least 2 characters';
    }

    if (!personalInfo.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalInfo.email)) {
      errors.email = 'Please enter a valid email address';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateOrderDetails = () => {
    const errors = {};

    if (!orderDetails.billInvoice.trim()) {
      errors.billInvoice = 'Bill number is required';
    } else if (!/^\d{6}$/.test(orderDetails.billInvoice)) {
      errors.billInvoice = 'Bill number must be exactly 6 digits';
    }

    if (!orderDetails.startDate) {
      errors.startDate = 'Start date is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateFurniture = () => {
    const errors = {};
    
    furnitureGroups.forEach((group, index) => {
      if (!group.furnitureType.trim()) {
        errors[`furniture_${index}_type`] = 'Furniture type is required';
      }
    });

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validatePayment = () => {
    const errors = {};

    if (paymentDetails.pickupDeliveryEnabled && (!paymentDetails.pickupDeliveryCost || paymentDetails.pickupDeliveryCost <= 0)) {
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
        if (isValid) {
          // Check for duplicates before proceeding
          const hasDuplicates = checkForDuplicates();
          if (hasDuplicates) {
            return; // Don't proceed if duplicates found
          }
        }
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
      case 4:
        // Step 5 (Review) - no validation needed, just advance
        isValid = true;
        break;
      case 5:
        // Step 6 (Submit) - submit the order
        handleSubmit();
        return;
      default:
        isValid = true;
    }

    if (isValid) {
      // If we're editing from review, go directly to review step (step 4)
      if (editingFromReview) {
        setActiveStep(4); // Go to review step
        setEditingFromReview(false);
      } else {
        setActiveStep((prevActiveStep) => prevActiveStep + 1);
      }
      setFormErrors({});
    }
  };

  const handleProceedToNextStep = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
    setFormErrors({});
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
    setFormErrors({});
  };

  const checkForDuplicates = () => {
    const { customerName, phone, email } = personalInfo;
    
    // Only check for duplicates if we have meaningful data
    const hasName = customerName && customerName.trim().length > 0;
    const hasPhone = phone && phone.trim().length > 0;
    const hasEmail = email && email.trim().length > 0;
    
    // Need at least name and email to check for duplicates
    if (!hasName || !hasEmail) {
      return false;
    }

    const duplicates = customers.filter(customer => {
      let hasMatch = false;
      
      // Check name match only if we have a name
      if (hasName && customer.name) {
        const nameMatch = customer.name.toLowerCase().trim() === customerName.toLowerCase().trim();
        if (nameMatch) hasMatch = true;
      }
      
      // Check phone match only if BOTH have a non-empty value and are equal
      const phoneMatch =
        phone && phone.trim().length > 0 &&
        customer.phone && customer.phone.trim().length > 0 &&
        customer.phone.trim() === phone.trim();
      if (phoneMatch) hasMatch = true;
      
      // Check email match only if we have an email
      if (hasEmail && customer.email) {
        const emailMatch = customer.email.toLowerCase().trim() === email.toLowerCase().trim();
        if (emailMatch) hasMatch = true;
      }
      
      return hasMatch;
    });

    if (duplicates.length > 0) {
      // Show dialog with duplicates
      setDuplicateCustomers(duplicates);
      setDuplicateDialogOpen(true);
      return true;
    }

    return false;
  };

  const handleUseExistingCustomer = (customer) => {
    setPersonalInfo({
      customerName: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || ''
    });
    setExistingCustomerDialog(false);
    setMatchedCustomer(null);
    setIsUsingExistingCustomer(true);
    setSelectedExistingCustomer(customer);
    showSuccess('Customer information loaded successfully');
  };

  const handleCreateNewCustomer = () => {
    setExistingCustomerDialog(false);
    setMatchedCustomer(null);
    setIsUsingExistingCustomer(false);
    setSelectedExistingCustomer(null);
  };

  // Check if current customer data matches any existing customer
  const checkIfCustomerExists = () => {
    const { customerName, phone, email } = personalInfo;
    
    // Only check for matches if we have meaningful data
    const hasName = customerName && customerName.trim().length > 0;
    const hasPhone = phone && phone.trim().length > 0;
    const hasEmail = email && email.trim().length > 0;
    
    // Need at least name and email to check for matches
    if (!hasName || !hasEmail) {
      return false;
    }

    const existingCustomer = customers.find(customer => {
      let hasMatch = false;
      
      // Check name match only if we have a name
      if (hasName && customer.name) {
        const nameMatch = customer.name.toLowerCase().trim() === customerName.toLowerCase().trim();
        if (nameMatch) hasMatch = true;
      }
      
      // Check phone match only if BOTH have a non-empty value and are equal
      const phoneMatch =
        phone && phone.trim().length > 0 &&
        customer.phone && customer.phone.trim().length > 0 &&
        customer.phone.trim() === phone.trim();
      if (phoneMatch) hasMatch = true;
      
      // Check email match only if we have an email
      if (hasEmail && customer.email) {
        const emailMatch = customer.email.toLowerCase().trim() === email.toLowerCase().trim();
        if (emailMatch) hasMatch = true;
      }
      
      return hasMatch;
    });

    if (existingCustomer) {
      setIsUsingExistingCustomer(true);
      setSelectedExistingCustomer(existingCustomer);
      return true;
    }

    return false;
  };

  // Find customer record by matching customer data
  const findCustomerRecord = () => {
    const { customerName, phone, email } = personalInfo;
    
    // Only check for matches if we have meaningful data
    const hasName = customerName && customerName.trim().length > 0;
    const hasPhone = phone && phone.trim().length > 0;
    const hasEmail = email && email.trim().length > 0;
    
    // Need at least name and email to check for matches
    if (!hasName || !hasEmail) {
      return null;
    }

    return customers.find(customer => {
      let hasMatch = false;
      
      // Check name match only if we have a name
      if (hasName && customer.name) {
        const nameMatch = customer.name.toLowerCase().trim() === customerName.toLowerCase().trim();
        if (nameMatch) hasMatch = true;
      }
      
      // Check phone match only if BOTH have a non-empty value and are equal
      const phoneMatch =
        phone && phone.trim().length > 0 &&
        customer.phone && customer.phone.trim().length > 0 &&
        customer.phone.trim() === phone.trim();
      if (phoneMatch) hasMatch = true;
      
      // Check email match only if we have an email
      if (hasEmail && customer.email) {
        const emailMatch = customer.email.toLowerCase().trim() === email.toLowerCase().trim();
        if (emailMatch) hasMatch = true;
      }
      
      return hasMatch;
    });
  };

  // Find all orders for a specific customer
  const findCustomerOrders = async (customerData) => {
    try {
      const ordersRef = collection(db, 'orders');
      
      // Find orders by matching customer data
      const orders = [];
      const querySnapshot = await getDocs(ordersRef);
      
      querySnapshot.forEach(doc => {
        const orderData = doc.data();
        const orderCustomer = orderData.personalInfo;
        
        if (orderCustomer) {
          let hasMatch = false;
          
          // Check name match only if we have meaningful data
          if (orderCustomer.customerName && customerData.customerName) {
            const nameMatch = orderCustomer.customerName.toLowerCase().trim() === customerData.customerName.toLowerCase().trim();
            if (nameMatch) hasMatch = true;
          }
          
          // Check phone match only if BOTH have a non-empty value and are equal
          const phoneMatch =
            orderCustomer.phone && orderCustomer.phone.trim().length > 0 &&
            customerData.phone && customerData.phone.trim().length > 0 &&
            orderCustomer.phone.trim() === customerData.phone.trim();
          if (phoneMatch) hasMatch = true;
          
          // Check email match only if we have meaningful data
          if (orderCustomer.email && customerData.email) {
            const emailMatch = orderCustomer.email.toLowerCase().trim() === customerData.email.toLowerCase().trim();
            if (emailMatch) hasMatch = true;
          }
          
          if (hasMatch) {
            orders.push({ id: doc.id, ...orderData });
          }
        }
      });
      
      return orders;
    } catch (error) {
      console.error('Error finding customer orders:', error);
      return [];
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      if (isEditMode && orderToEdit) {
        // For edit mode, preserve the original bill number and create time
        const orderData = {
          personalInfo,
          orderDetails: {
            ...orderDetails,
            billInvoice: orderToEdit.orderDetails?.billInvoice || orderDetails.billInvoice // Preserve original bill number
          },
          furnitureData: {
            groups: furnitureGroups
          },
          paymentData: paymentDetails,
          invoiceStatus: orderToEdit.invoiceStatus || 'in_progress', // Preserve invoice status
          updatedAt: new Date()
        };
        
        // Update existing order
        const orderRef = doc(db, 'orders', orderToEdit.id);
        await updateDoc(orderRef, orderData);
        
        // If customer information was changed, update ALL related records
        let customerToUpdate = selectedExistingCustomer;
        
        // If selectedExistingCustomer is not set, try to find the customer record
        if (!customerToUpdate) {
          customerToUpdate = findCustomerRecord();
        }
        
        if (customerToUpdate) {
          // Create a batch to update multiple documents atomically
          const batch = writeBatch(db);
          
          // 1. Update customer record in customers collection
          const customerRef = doc(db, 'customers', customerToUpdate.id);
          const customerUpdateData = {
            name: personalInfo.customerName,
            phone: personalInfo.phone,
            email: personalInfo.email,
            address: personalInfo.address,
            updatedAt: new Date()
          };
          batch.update(customerRef, customerUpdateData);
          
          // 2. Find and update ALL orders for this customer
          const customerOrders = await findCustomerOrders(orderToEdit.personalInfo);
          
          customerOrders.forEach(order => {
            const orderRef = doc(db, 'orders', order.id);
            const updatedOrderData = {
              ...order,
              personalInfo: {
                customerName: personalInfo.customerName,
                phone: personalInfo.phone,
                email: personalInfo.email,
                address: personalInfo.address
              },
              updatedAt: new Date()
            };
            batch.update(orderRef, updatedOrderData);
          });
          
          // Execute all updates atomically
          await batch.commit();
          
          const orderCount = customerOrders.length;
          showSuccess(`Order and customer information updated successfully! Updated ${orderCount} order${orderCount > 1 ? 's' : ''} for this customer.`);
        } else {
          showSuccess('Order updated successfully!');
        }
      } else {
        // Get default invoice status from database
        let defaultInvoiceStatus = 'in_progress';
        try {
          const statusesRef = collection(db, 'invoiceStatuses');
          const statusesSnapshot = await getDocs(statusesRef);
          const defaultStatus = statusesSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .find(status => status.isDefault);
          
          if (defaultStatus) {
            defaultInvoiceStatus = defaultStatus.value;
          }
        } catch (error) {
          console.warn('Could not fetch default status, using fallback');
        }

        // Create new order
        const orderData = {
          personalInfo,
          orderDetails,
          furnitureData: {
            groups: furnitureGroups
          },
          paymentData: paymentDetails,
          workflowStatus: 'Inprogress', // Add workflowStatus
          invoiceStatus: defaultInvoiceStatus, // Use dynamic default invoice status
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        // Check if customer data matches any existing customer
        const customerExistsCheck = checkIfCustomerExists();
        
        // If this is a new customer (not using existing customer dropdown), save to customers collection
        if (!isUsingExistingCustomer) {
          const customerData = {
            name: personalInfo.customerName,
            phone: personalInfo.phone,
            email: personalInfo.email,
            address: personalInfo.address,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          await addDoc(collection(db, 'customers'), customerData);
          showSuccess('New customer created and order saved successfully!');
        } else {
          showSuccess('Order created successfully!');
        }
        
        await addDoc(collection(db, 'orders'), orderData);
      }
      
      // Send email if enabled (for both new and edit modes)
      if (sendEmail && personalInfo.email) {
        try {
          const orderDataForEmail = {
            personalInfo,
            orderDetails,
            furnitureData: {
              groups: furnitureGroups
            },
            paymentData: paymentDetails
          };
          
          // Auto-check and authorize Gmail if needed
          await ensureGmailAuthorized();
          const emailResult = await sendEmailWithConfig(orderDataForEmail, personalInfo.email);
          if (emailResult.success) {
            const action = isEditMode ? 'updated' : 'created';
            showSuccess(`Order ${action} and email sent successfully!`);
          } else {
            const action = isEditMode ? 'updated' : 'created';
            showError(`Order ${action} but failed to send email: ` + emailResult.message);
          }
        } catch (emailError) {
          console.error('Error sending email:', emailError);
          if (emailError.message.includes('Not signed in')) {
            const action = isEditMode ? 'updated' : 'created';
            showError(`Order ${action} but email not sent: Please sign in with Gmail first`);
          } else {
            const action = isEditMode ? 'updated' : 'created';
            showError(`Order ${action} but failed to send email`);
          }
        }
      }
      
      navigate('/admin/orders');
    } catch (error) {
      console.error('Error saving order:', error);
      showError(`Failed to ${isEditMode ? 'update' : 'create'} order`);
    } finally {
      setLoading(false);
    }
  };

  const handlePersonalInfoChange = (field, value) => {
    setPersonalInfo(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Only reset customer tracking when user manually changes customer info in new order mode
    // In edit mode, we want to maintain the existing customer relationship
    if (!isEditMode && ['customerName', 'phone', 'email'].includes(field)) {
      setIsUsingExistingCustomer(false);
      setSelectedExistingCustomer(null);
    }
  };

  const handleOrderDetailsChange = (field, value) => {
    // Prevent bill number changes in edit mode
    if (isEditMode && field === 'billInvoice') {
      return; // Don't allow bill number changes in edit mode
    }
    
    setOrderDetails(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFurnitureChange = (newFurnitureGroups) => {
    setFurnitureGroups(newFurnitureGroups);
  };

  const handlePaymentChange = (field, value) => {
    setPaymentDetails(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSendEmailChange = (value) => {
    setSendEmail(value);
  };

  const handleEditStep = (stepIndex) => {
    setActiveStep(stepIndex);
    setEditingFromReview(true);
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
            onDuplicateCheck={checkForDuplicates}
          />
        );
      case 1:
        return (
          <Step2OrderDetails
            orderDetails={orderDetails}
            onOrderDetailsChange={handleOrderDetailsChange}
            formErrors={formErrors}
            onRefreshBillNumber={getNextBillNumber}
            isEditMode={isEditMode}
          />
        );
      case 2:
        return (
          <Step3Furniture
            furnitureGroups={furnitureGroups}
            onFurnitureChange={handleFurnitureChange}
            formErrors={formErrors}
            setFormErrors={setFormErrors}
          />
        );
      case 3:
        return (
          <Step4PaymentNotes
            paymentDetails={paymentDetails}
            onPaymentChange={handlePaymentChange}
            formErrors={formErrors}
            setFormErrors={setFormErrors}
          />
        );
      case 4:
        return (
          <Step5Review
            personalInfo={personalInfo}
            orderDetails={orderDetails}
            furnitureGroups={furnitureGroups}
            paymentDetails={paymentDetails}
            onEditStep={handleEditStep}
          />
        );
      case 5:
        return (
          <Step6Submit
            sendEmail={sendEmail}
            onSendEmailChange={handleSendEmailChange}
            personalInfo={personalInfo}
            isEditMode={isEditMode}
          />
        );
      default:
        return 'Unknown step';
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
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
          {isEditMode ? 'Edit Order' : 'Create New Order'}
        </Typography>

        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Box sx={{ mt: 4 }}>
          {getStepContent(activeStep)}
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
          <Button
            disabled={activeStep === 0}
            onClick={handleBack}
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
          <Box>
            <Button
              variant="outlined"
              onClick={() => navigate('/admin/orders')}
              sx={{ 
                mr: 1,
                borderColor: '#e0e0e0',
                color: '#666',
                '&:hover': {
                  borderColor: '#bdbdbd',
                  backgroundColor: '#f5f5f5'
                }
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={loading}
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
              {activeStep === steps.length - 1 ? (isEditMode ? 'Update Order' : 'Create Order') : 'Next'}
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Duplicate Customer Dialog */}
      <Dialog 
        open={duplicateDialogOpen} 
        onClose={() => setDuplicateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <WarningIcon color="warning" sx={{ mr: 1 }} />
            <Typography variant="h6">
              {duplicateCustomers.length === 1 ? 'Existing Customer Found' : 'Multiple Customers Found'}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {duplicateCustomers.length === 1 
              ? 'A customer with similar information already exists. You can use the existing customer or create a new one.'
              : `${duplicateCustomers.length} customers with similar information found. Please choose one or create a new customer.`
            }
          </Alert>
          
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>
            Existing Customers:
          </Typography>
          
          <List>
            {duplicateCustomers.map((customer, index) => (
              <React.Fragment key={customer.id}>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                          {customer.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Email: {customer.email}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Phone: {customer.phone}
                        </Typography>
                        {customer.address && (
                          <Typography variant="body2" color="text.secondary">
                            Address: {customer.address}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      handleUseExistingCustomer(customer);
                      setDuplicateDialogOpen(false);
                      handleProceedToNextStep();
                    }}
                    sx={{
                      borderColor: '#e0e0e0',
                      color: '#666',
                      '&:hover': {
                        borderColor: '#bdbdbd',
                        backgroundColor: '#f5f5f5'
                      }
                    }}
                  >
                    Use This Customer
                  </Button>
                </ListItem>
                {index < duplicateCustomers.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDuplicateDialogOpen(false);
            handleProceedToNextStep();
          }} 
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
          }}>
            Create New Customer
          </Button>
          <Button onClick={() => setDuplicateDialogOpen(false)}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default NewOrderPage; 