import React, { useState, useEffect } from 'react';
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
  Alert
} from '@mui/material';
import { 
  Close as CloseIcon, 
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  FlashOn as FlashOnIcon
} from '@mui/icons-material';
import FastOrderStep1 from './FastOrderStep1';
import FastOrderStep2 from './FastOrderStep2';

const FastOrderModal = ({ open, onClose, onSubmit }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [orderData, setOrderData] = useState({
    // Step 1: Customer Info
    personalInfo: {
      customerName: '',
      phone: '',
      email: '',
      address: ''
    },
    // Step 2: Configurable Fields (based on settings)
    orderDetails: {},
    furnitureData: { groups: [{ furnitureType: '', materialCompany: '', quantity: 1, labourWork: 0 }] },
    paymentData: {}
  });
  const [fieldSettings, setFieldSettings] = useState({});
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const steps = ['Customer Information', 'Order Details'];

  // Load field settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('rapidInvoiceSettings');
    if (savedSettings) {
      setFieldSettings(JSON.parse(savedSettings));
    }
  }, []);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      setActiveStep(0);
      setOrderData({
        personalInfo: { customerName: '', phone: '', email: '', address: '' },
        orderDetails: {},
        furnitureData: { groups: [{ furnitureType: '', materialCompany: '', quantity: 1, labourWork: 0 }] },
        paymentData: {}
      });
      setErrors({});
    }
  }, [open]);

  // Handle data updates from steps
  const handleDataUpdate = (stepData) => {
    setOrderData(prev => ({ ...prev, ...stepData }));
    setErrors({}); // Clear errors when user makes changes
  };

  // Validate current step
  const validateStep = (stepIndex) => {
    const newErrors = {};

    if (stepIndex === 0) {
      // Validate customer info
      if (!orderData.personalInfo.customerName.trim()) {
        newErrors.customerName = 'Customer name is required';
      }
      if (!orderData.personalInfo.phone.trim()) {
        newErrors.phone = 'Phone number is required';
      }
    } else if (stepIndex === 1) {
      // Validate enabled fields based on settings
      Object.entries(fieldSettings).forEach(([fieldKey, field]) => {
        if (field.enabled) {
          // Add validation logic for each field type
          if (fieldKey === 'billInvoice' && !orderData.orderDetails.billInvoice?.trim()) {
            newErrors.billInvoice = 'Bill Invoice is required';
          }
          if (fieldKey === 'furnitureType' && !orderData.furnitureData.groups[0]?.furnitureType?.trim()) {
            newErrors.furnitureType = 'Furniture Type is required';
          }
          if (fieldKey === 'quantity' && (!orderData.furnitureData.groups[0]?.quantity || orderData.furnitureData.groups[0]?.quantity < 1)) {
            newErrors.quantity = 'Quantity must be at least 1';
          }
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle next step
  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep(prev => prev + 1);
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
      // Prepare final order data
      const finalOrderData = {
        ...orderData,
        createdAt: new Date(),
        status: 'pending',
        isRapidOrder: true, // Flag to identify fast orders
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

  // Calculate total amount (basic calculation)
  const calculateTotal = () => {
    const labourWork = orderData.furnitureData.groups[0]?.labourWork || 0;
    const quantity = orderData.furnitureData.groups[0]?.quantity || 1;
    return labourWork * quantity;
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
        bgcolor: '#274290', 
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        py: 2
      }}>
        <Box display="flex" alignItems="center">
          <FlashOnIcon sx={{ mr: 1 }} />
          <Typography variant="h6">Fast Order Creation</Typography>
        </Box>
        <IconButton onClick={handleClose} sx={{ color: 'white' }} disabled={isSubmitting}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* Stepper */}
      <Box sx={{ px: 3, pt: 3 }}>
        <Stepper activeStep={activeStep} alternativeLabel>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      {/* Dialog Content */}
      <DialogContent sx={{ px: 3, py: 2, flex: 1 }}>
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
            errors={errors}
          />
        )}

        {activeStep === 1 && (
          <FastOrderStep2
            data={orderData}
            onUpdate={handleDataUpdate}
            fieldSettings={fieldSettings}
            errors={errors}
          />
        )}
      </DialogContent>

      {/* Dialog Actions */}
      <DialogActions sx={{ px: 3, pb: 3, pt: 1 }}>
        <Button 
          onClick={handleClose} 
          disabled={isSubmitting}
          sx={{ color: '#666' }}
        >
          Cancel
        </Button>
        
        {activeStep > 0 && (
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={handleBack}
            disabled={isSubmitting}
            sx={{ color: '#274290' }}
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
              backgroundColor: '#f27921',
              '&:hover': { backgroundColor: '#e06810' }
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
              backgroundColor: '#f27921',
              '&:hover': { backgroundColor: '#e06810' }
            }}
          >
            {isSubmitting ? 'Creating Order...' : 'Create Fast Order'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default FastOrderModal; 