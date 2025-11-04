import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../shared/firebase/config';
import { calculatePickupDeliveryCost } from '../shared/utils/orderCalculations';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stepper,
  Step,
  StepLabel,
  Box,
  Typography,
  IconButton,
  Alert,
  List,
  ListItem,
  ListItemText,
  Divider
} from '@mui/material';
import { 
  Close as CloseIcon, 
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  FlashOn as FlashOnIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import FastOrderStep1 from './FastOrderStep1';
import FastOrderStep2 from './FastOrderStep2';
import { buttonStyles } from '../shared/styles/buttonStyles';

const FastOrderModal = ({ open, onClose, onSubmit, customers = [] }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [orderData, setOrderData] = useState({
    // Step 1: Customer Info
    personalInfo: {
      customerName: '',
      phone: '',
      email: '',
      address: ''
    },
    // Step 2: Configurable Fields with toggles
    orderDetails: {
      billInvoice: '',
      description: '',
      platform: '',
      startDate: new Date().toISOString().split('T')[0], // Today's date as default
      timeline: '',
      deadline: ''
    },
    furnitureData: { 
      groups: [{ 
        furnitureType: '',
        materialCompany: '',
        materialCode: '',
        materialQnty: '',
        materialPrice: '',
        labourPrice: '',
        labourNote: '',
        labourQnty: '',
        foamEnabled: false,
        foamPrice: '',
        foamQnty: 1,
        foamNote: '',
        paintingEnabled: false,
        paintingLabour: '',
        paintingNote: '',
        paintingQnty: 1,
        customerNote: ''
      }] 
    },
              paymentData: {
            deposit: 0, // Required deposit amount
            amountPaid: 0, // Actual amount paid by customer
            amountPaidEnabled: false, // Toggle for amount paid field
            pickupDeliveryEnabled: false,
            pickupDeliveryCost: '',
            pickupDeliveryServiceType: 'both', // Default to both for backward compatibility
            notes: ''
          }
  });
  
  // Toggle states for Step 2
  const [toggles, setToggles] = useState({
    orderDetails: false,
    materials: false,
    labour: false,
    foam: false,
    painting: false,
    customerNote: false,
    pickupDelivery: false
  });
  
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateCustomers, setDuplicateCustomers] = useState([]);

  const steps = ['Customer Information', 'Order Details'];

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

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      setActiveStep(0);
      
      // Set default values including bill number
      const initializeForm = async () => {
        const nextBillNumber = await getNextBillNumber();
        setOrderData({
          personalInfo: { customerName: '', phone: '', email: '', address: '' },
          orderDetails: {
            billInvoice: nextBillNumber,
            description: '',
            platform: '',
            startDate: new Date().toISOString().split('T')[0], // Today's date as default
            timeline: '',
            deadline: ''
          },
          furnitureData: { 
            groups: [{ 
              furnitureType: '',
              materialCompany: '',
              materialCode: '',
              materialQnty: '',
              materialPrice: '',
              labourPrice: '',
              labourNote: '',
              labourQnty: '',
              foamEnabled: false,
              foamPrice: '',
              foamQnty: 1,
              foamNote: '',
              customerNote: ''
            }] 
          },
          paymentData: {
            deposit: 0, // Required deposit amount
            amountPaid: 0, // Actual amount paid by customer
            amountPaidEnabled: false, // Toggle for amount paid field
            pickupDeliveryEnabled: false,
            pickupDeliveryCost: '',
            pickupDeliveryServiceType: 'both', // Default to both for backward compatibility
            notes: ''
          }
        });
      };
      
      initializeForm();
      
      setToggles({
        orderDetails: false,
        materials: false,
        labour: false,
        foam: false,
        customerNote: false,
        pickupDelivery: false
      });
      setErrors({});
    }
  }, [open]);

  // Handle data updates from steps
  const handleDataUpdate = (stepData) => {
    setOrderData(prev => ({ ...prev, ...stepData }));
    setErrors({}); // Clear errors when user makes changes
    
    // Sync pickup & delivery toggle with payment data
    if (stepData.paymentData?.pickupDeliveryEnabled !== undefined) {
      setToggles(prev => ({ ...prev, pickupDelivery: stepData.paymentData.pickupDeliveryEnabled }));
    }
  };

  // Handle using existing customer
  const handleUseExistingCustomer = (customer) => {
    setOrderData(prev => ({
      ...prev,
      personalInfo: {
        customerName: customer.name,
        phone: customer.phone || '',
        email: customer.email,
        address: customer.address || ''
      }
    }));
    setErrors({});
    setDuplicateDialogOpen(false);
    setDuplicateCustomers([]);
  };

  // Handle toggle changes
  const handleToggleChange = (toggleName, value) => {
    setToggles(prev => ({ ...prev, [toggleName]: value }));
    
    // Sync pickup & delivery toggle with payment data
    if (toggleName === 'pickupDelivery') {
      setOrderData(prev => ({
        ...prev,
        paymentData: {
          ...prev.paymentData,
          pickupDeliveryEnabled: value
        }
      }));
    }
  };

  // Check for duplicate customers
  const checkForDuplicates = () => {
    const { customerName, phone, email } = orderData.personalInfo;
    
    // Only check for duplicates if we have meaningful data
    const hasName = customerName && customerName.trim().length > 0;
    const hasPhone = phone && phone.trim().length > 0;
    const hasEmail = email && email.trim().length > 0;
    
    // Need at least name to check for duplicates (email is optional)
    if (!hasName) {
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

  // Validate current step
  const validateStep = (stepIndex) => {
    const newErrors = {};

    if (stepIndex === 0) {
      // Validate customer info
      if (!orderData.personalInfo.customerName.trim()) {
        newErrors.customerName = 'Customer name is required';
      }
      // Email is now optional - no validation required
    } else if (stepIndex === 1) {
      // Validate bill invoice (always required)
      if (!orderData.orderDetails.billInvoice?.trim()) {
        newErrors.billInvoice = 'Bill Invoice is required';
      }
      
      // Validate enabled fields based on toggles
      if (toggles.orderDetails) {
        if (!orderData.orderDetails.platform?.trim()) {
          newErrors.platform = 'Platform is required when Order Details is enabled';
        }
        if (!orderData.orderDetails.startDate?.trim()) {
          newErrors.startDate = 'Start Date is required when Order Details is enabled';
        }
      }
      
      if (toggles.materials) {
        if (!orderData.furnitureData.groups[0]?.materialCompany?.trim()) {
          newErrors.materialCompany = 'Material Company is required when Materials is enabled';
        }
        if (!orderData.furnitureData.groups[0]?.materialCode?.trim()) {
          newErrors.materialCode = 'Material Code is required when Materials is enabled';
        }
        if (!orderData.furnitureData.groups[0]?.materialQnty) {
          newErrors.materialQnty = 'Material Quantity is required when Materials is enabled';
        }
        if (!orderData.furnitureData.groups[0]?.materialPrice) {
          newErrors.materialPrice = 'Material Price is required when Materials is enabled';
        }
      }
      
      if (toggles.labour) {
        if (!orderData.furnitureData.groups[0]?.labourPrice) {
          newErrors.labourPrice = 'Labour Price is required when Labour is enabled';
        }
        if (!orderData.furnitureData.groups[0]?.labourQnty) {
          newErrors.labourQnty = 'Labour Quantity is required when Labour is enabled';
        }
      }
      
      if (toggles.foam) {
        if (!orderData.furnitureData.groups[0]?.foamPrice) {
          newErrors.foamPrice = 'Foam Price is required when Foam is enabled';
        }
        if (!orderData.furnitureData.groups[0]?.foamQnty) {
          newErrors.foamQnty = 'Foam Quantity is required when Foam is enabled';
        }
      }
      
      if (toggles.pickupDelivery) {
        if (!orderData.paymentData.pickupDeliveryCost) {
          newErrors.pickupDeliveryCost = 'Pickup & Delivery Cost is required when Pickup & Delivery is enabled';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle next step
  const handleNext = () => {
    if (activeStep === 0) {
      // For Step 1, check for duplicates before proceeding
      if (validateStep(activeStep)) {
        const hasDuplicates = checkForDuplicates();
        if (hasDuplicates) {
          return; // Don't proceed if duplicates found
        }
        setActiveStep(prev => prev + 1);
      }
    } else {
      if (validateStep(activeStep)) {
        setActiveStep(prev => prev + 1);
      }
    }
  };

  // Handle previous step
  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateStep(activeStep)) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Get default invoice status from database (same as normal order)
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

      // Prepare final order data - match normal order structure exactly
      const finalOrderData = {
        personalInfo: orderData.personalInfo,
        orderDetails: orderData.orderDetails,
        furnitureData: orderData.furnitureData,
        paymentData: orderData.paymentData,
        toggles, // Include toggle states for fast orders
        workflowStatus: 'Inprogress', // Match normal order workflow status
        invoiceStatus: defaultInvoiceStatus, // Use dynamic default invoice status
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'pending',
        isFastOrder: true, // Flag to identify fast orders
        totalAmount: calculateTotal()
      };

      // Call the submit handler passed from parent
      await onSubmit(finalOrderData);
      
      // Close modal on success
      onClose();
    } catch (error) {
      console.error('Error submitting fast order:', error);
      setErrors({ submit: 'Failed to create order. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate total amount
  const calculateTotal = () => {
    const furniture = orderData.furnitureData.groups[0] || {};
    
    const materialTotal = (furniture.materialQnty || 0) * (furniture.materialPrice || 0);
    const labourTotal = (furniture.labourQnty || 0) * (furniture.labourPrice || 0);
    const foamTotal = (furniture.foamQnty || 0) * (furniture.foamPrice || 0);
    
    // Calculate pickup & delivery cost based on service type
    let pickupDeliveryTotal = 0;
    if (orderData.paymentData.pickupDeliveryEnabled) {
      const baseCost = parseFloat(orderData.paymentData.pickupDeliveryCost) || 0;
      const serviceType = orderData.paymentData.pickupDeliveryServiceType || 'both';
      pickupDeliveryTotal = calculatePickupDeliveryCost(baseCost, serviceType);
    }
    
    return materialTotal + labourTotal + foamTotal + pickupDeliveryTotal;
  };

  // Handle modal close
  const handleClose = () => {
    if (isSubmitting) return; // Prevent closing while submitting
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { 
          borderRadius: 2,
          minHeight: '70vh'
        }
      }}
    >
      {/* Dialog Header */}
      <DialogTitle sx={{ 
        background: 'linear-gradient(135deg, #b98f33 0%, #8b6b1f 100%)',
        color: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        py: 2,
        fontWeight: 'bold'
      }}>
        <Box display="flex" alignItems="center">
          <FlashOnIcon sx={{ mr: 1, color: '#000000' }} />
          <Typography variant="h6" sx={{ color: '#000000', fontWeight: 'bold' }}>Fast Order Creation</Typography>
        </Box>
        <IconButton onClick={handleClose} sx={{ color: '#000000' }} disabled={isSubmitting}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* Stepper */}
      <Box sx={{ px: 3, pt: 3, backgroundColor: '#3a3a3a' }}>
        <Stepper activeStep={activeStep} alternativeLabel>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel sx={{ color: '#b98f33' }}>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      {/* Dialog Content */}
      <DialogContent sx={{ px: 3, py: 2, flex: 1, backgroundColor: '#3a3a3a' }}>
        {errors.submit && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errors.submit}
          </Alert>
        )}

        {/* Step Content */}
        {activeStep === 0 && (
          <FastOrderStep1
            data={orderData.personalInfo}
            onUpdate={(personalInfo) => handleDataUpdate({ personalInfo })}
            customers={customers}
            onUseExistingCustomer={handleUseExistingCustomer}
            errors={errors}
          />
        )}

        {activeStep === 1 && (
          <FastOrderStep2
            data={orderData}
            onUpdate={handleDataUpdate}
            toggles={toggles}
            onToggleChange={handleToggleChange}
            errors={errors}
          />
        )}
      </DialogContent>

      {/* Dialog Actions */}
      <DialogActions sx={{ px: 3, pb: 3, pt: 1, backgroundColor: '#3a3a3a' }}>
        <Button 
          onClick={handleClose} 
          disabled={isSubmitting}
          sx={buttonStyles.cancelButton}
        >
          Cancel
        </Button>
        
        {activeStep > 0 && (
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={handleBack}
            disabled={isSubmitting}
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
            Back
          </Button>
        )}

        {activeStep < steps.length - 1 ? (
          <Button
            variant="contained"
            endIcon={<ArrowForwardIcon />}
            onClick={handleNext}
            disabled={isSubmitting}
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
            Next
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={isSubmitting}
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
            {isSubmitting ? 'Creating Order...' : 'Save Order'}
          </Button>
        )}
      </DialogActions>

      {/* Duplicate Customer Dialog */}
      <Dialog 
        open={duplicateDialogOpen} 
        onClose={() => setDuplicateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{
          background: 'linear-gradient(135deg, #b98f33 0%, #8b6b1f 100%)',
          color: '#000000',
          fontWeight: 'bold'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <WarningIcon sx={{ mr: 1, color: '#000000' }} />
            <Typography variant="h6" sx={{ color: '#000000', fontWeight: 'bold' }}>
              {duplicateCustomers.length === 1 ? 'Existing Customer Found' : 'Multiple Customers Found'}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#3a3a3a' }}>
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
                     variant="contained"
                     size="small"
                     onClick={() => handleUseExistingCustomer(customer)}
                     sx={buttonStyles.primaryButton}
                   >
                     Use This Customer
                   </Button>
                </ListItem>
                {index < duplicateCustomers.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#3a3a3a' }}>
          <Button 
            onClick={() => {
              setDuplicateDialogOpen(false);
              setDuplicateCustomers([]);
              // Allow proceeding to next step when creating new customer
              setActiveStep(prev => prev + 1);
            }} 
            variant="contained"
            sx={{ 
              backgroundColor: '#b98f33',
              color: '#000000',
              border: '2px solid #8b6b1f',
              boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
              background: 'linear-gradient(135deg, #b98f33 0%, #d4af5a 100%)',
              '&:hover': {
                backgroundColor: '#d4af5a',
                transform: 'translateY(-1px)',
                boxShadow: '0 6px 12px rgba(0,0,0,0.4)'
              },
              '&:disabled': {
                backgroundColor: '#666666',
                color: '#999999',
                border: '2px solid #555555'
              }
            }}
          >
            Create New Customer
          </Button>
          <Button 
            onClick={() => setDuplicateDialogOpen(false)}
            sx={buttonStyles.cancelButton}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default FastOrderModal; 
