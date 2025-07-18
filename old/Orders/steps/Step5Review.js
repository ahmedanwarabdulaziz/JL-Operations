import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  Divider,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import Step1PersonalInfo from './Step1PersonalInfo';
import Step2OrderDetails from './Step2OrderDetails';
import Step3Furniture from './Step3Furniture';
import Step4PaymentNotes from './Step4PaymentNotes';

const Step5Review = ({ 
  personalInfo, 
  orderDetails, 
  furnitureData, 
  paymentData,
  onPersonalInfoChange,
  onOrderDetailsChange,
  onFurnitureChange,
  onPaymentChange,
  formErrors = {},
  existingCustomerDialog,
  setExistingCustomerDialog,
  matchedCustomer,
  handleUseExistingCustomer,
  handleCreateNewCustomer,
  showSuccess,
  onSaveOrder,
  onNavigateToStep
}) => {
  const [editingStep, setEditingStep] = useState(null);
  const [tempPersonalInfo, setTempPersonalInfo] = useState(personalInfo);
  const [tempOrderDetails, setTempOrderDetails] = useState(orderDetails);
  const [tempFurnitureData, setTempFurnitureData] = useState(furnitureData);
  const [tempPaymentData, setTempPaymentData] = useState(paymentData);

  const handleEditStep = (step) => {
    // Navigate to the specific step for editing
    onNavigateToStep(step - 1); // Convert to 0-based index
  };

  const handleSaveOrder = () => {
    // Call the save order function
    onSaveOrder();
  };

  const renderEditStep = () => {
    switch (editingStep) {
      case 1:
        return (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Edit Personal Information</Typography>
              <Box>
                <Button onClick={() => handleEditStep(1)} sx={{ mr: 1 }}>Cancel</Button>
                <Button variant="contained" onClick={() => { handleSaveStep(); handleEditStep(1); }}>Save</Button>
              </Box>
            </Box>
            <Step1PersonalInfo
              personalInfo={tempPersonalInfo}
              formErrors={formErrors}
              onPersonalInfoChange={(field, value) => setTempPersonalInfo(prev => ({ ...prev, [field]: value }))}
              existingCustomerDialog={existingCustomerDialog}
              setExistingCustomerDialog={setExistingCustomerDialog}
              matchedCustomer={matchedCustomer}
              handleUseExistingCustomer={handleUseExistingCustomer}
              handleCreateNewCustomer={handleCreateNewCustomer}
              showSuccess={showSuccess}
            />
          </Box>
        );
      case 2:
        return (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Edit Order Details</Typography>
              <Box>
                <Button onClick={() => handleEditStep(2)} sx={{ mr: 1 }}>Cancel</Button>
                <Button variant="contained" onClick={() => { handleSaveStep(); handleEditStep(2); }}>Save</Button>
              </Box>
            </Box>
            <Step2OrderDetails
              orderDetails={tempOrderDetails}
              formErrors={formErrors}
              onOrderDetailsChange={(field, value) => setTempOrderDetails(prev => ({ ...prev, [field]: value }))}
            />
          </Box>
        );
      case 3:
        return (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Edit Furniture Details</Typography>
              <Box>
                <Button onClick={() => handleEditStep(3)} sx={{ mr: 1 }}>Cancel</Button>
                <Button variant="contained" onClick={() => { handleSaveStep(); handleEditStep(3); }}>Save</Button>
              </Box>
            </Box>
            <Step3Furniture
              furnitureData={tempFurnitureData}
              onFurnitureChange={setTempFurnitureData}
            />
          </Box>
        );
      case 4:
        return (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Edit Payment & Notes</Typography>
              <Box>
                <Button onClick={() => handleEditStep(4)} sx={{ mr: 1 }}>Cancel</Button>
                <Button variant="contained" onClick={() => { handleSaveStep(); handleEditStep(4); }}>Save</Button>
              </Box>
            </Box>
            <Step4PaymentNotes
              paymentData={tempPaymentData}
              onPaymentChange={setTempPaymentData}
            />
          </Box>
        );
      default:
        return null;
    }
  };

  const handleSaveStep = () => {
    // Update the actual data based on which step was being edited
    if (editingStep === 1) {
      onPersonalInfoChange(tempPersonalInfo);
    } else if (editingStep === 2) {
      onOrderDetailsChange(tempOrderDetails);
    } else if (editingStep === 3) {
      onFurnitureChange(tempFurnitureData);
    } else if (editingStep === 4) {
      onPaymentChange(tempPaymentData);
    }
    setEditingStep(null);
  };

  if (editingStep) {
    return renderEditStep();
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <CheckCircleIcon color="primary" sx={{ mr: 1 }} />
        <Typography variant="h6">
          Review & Confirm Order
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Please review all the information before submitting the order. You can edit any section by clicking the edit button.
      </Typography>
      
      <Grid container spacing={3}>
        {/* Step 1 & 2: Personal Information and Order Details in same row */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Chip label="Step 1" color="primary" size="small" sx={{ mr: 2 }} />
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      fontWeight: 700,
                      background: 'linear-gradient(45deg, #1976d2, #42a5f5)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}
                  >
                    Personal Information
                  </Typography>
                </Box>
                <Tooltip title="Edit Personal Information">
                  <IconButton 
                    onClick={() => handleEditStep(1)} 
                    color="primary"
                    size="large"
                    sx={{ 
                      border: '2px solid',
                      borderColor: 'primary.main',
                      backgroundColor: 'white',
                      '&:hover': {
                        backgroundColor: 'primary.main',
                        color: 'white'
                      }
                    }}
                  >
                    <EditIcon fontSize="medium" />
                  </IconButton>
                </Tooltip>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography><strong>Name:</strong> {personalInfo.name}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography><strong>Email:</strong> {personalInfo.email}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography><strong>Phone:</strong> {personalInfo.phone || 'Not provided'}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography><strong>Address:</strong> {personalInfo.address || 'Not provided'}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Chip label="Step 2" color="primary" size="small" sx={{ mr: 2 }} />
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      fontWeight: 700,
                      background: 'linear-gradient(45deg, #1976d2, #42a5f5)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}
                  >
                    Order Details
                  </Typography>
                </Box>
                <Tooltip title="Edit Order Details">
                  <IconButton 
                    onClick={() => handleEditStep(2)} 
                    color="primary"
                    size="large"
                    sx={{ 
                      border: '2px solid',
                      borderColor: 'primary.main',
                      backgroundColor: 'white',
                      '&:hover': {
                        backgroundColor: 'primary.main',
                        color: 'white'
                      }
                    }}
                  >
                    <EditIcon fontSize="medium" />
                  </IconButton>
                </Tooltip>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography><strong>Description:</strong> {orderDetails.description || 'Not provided'}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography><strong>Bill Invoice:</strong> {orderDetails.billInvoice}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography><strong>Platform:</strong> {orderDetails.platform || 'Not provided'}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography><strong>Start Date:</strong> {orderDetails.startDate}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography><strong>Timeline:</strong> {orderDetails.timeline || 'Not provided'}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Step 3: Furniture Details */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Chip label="Step 3" color="primary" size="small" sx={{ mr: 2 }} />
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      fontWeight: 700,
                      background: 'linear-gradient(45deg, #1976d2, #42a5f5)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}
                  >
                    Furniture Details
                  </Typography>
                </Box>
                <Tooltip title="Edit Furniture Details">
                  <IconButton 
                    onClick={() => handleEditStep(3)} 
                    color="primary"
                    size="large"
                    sx={{ 
                      border: '2px solid',
                      borderColor: 'primary.main',
                      backgroundColor: 'white',
                      '&:hover': {
                        backgroundColor: 'primary.main',
                        color: 'white'
                      }
                    }}
                  >
                    <EditIcon fontSize="medium" />
                  </IconButton>
                </Tooltip>
              </Box>
              <Divider sx={{ mb: 2 }} />
              {furnitureData?.groups?.length > 0 ? (
                <Grid container spacing={2}>
                  {furnitureData.groups.map((group, index) => (
                    <Grid item xs={12} key={group.id}>
                      <Card 
                        variant="outlined" 
                        sx={{ 
                          border: '2px solid #e3f2fd',
                          backgroundColor: '#f8f9fa',
                          '&:hover': {
                            borderColor: '#1976d2',
                            backgroundColor: '#f3f8ff'
                          }
                        }}
                      >
                        <CardContent>
                                                     <Box sx={{ 
                             display: 'flex', 
                             alignItems: 'center', 
                             mb: 2,
                             p: 1,
                             backgroundColor: 'primary.main',
                             color: 'white',
                             borderRadius: 1,
                             boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                           }}>
                             <Typography 
                               variant="h6" 
                               sx={{ 
                                 fontWeight: 700,
                                 textTransform: 'uppercase',
                                 letterSpacing: '1px',
                                 fontSize: '1rem'
                               }}
                             >
                               {group.furnitureType || 'Furniture Group ' + (index + 1)}
                             </Typography>
                           </Box>
                           <Grid container spacing={2}>
                             {/* Material Details - Vertical Layout */}
                             <Grid item xs={12}>
                               <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.main', mb: 1 }}>
                                 Material Details:
                               </Typography>
                             </Grid>
                             <Grid item xs={12}>
                               <Typography><strong>Material Company:</strong> {group.materialCompany || 'Not specified'}</Typography>
                             </Grid>
                             <Grid item xs={12}>
                               <Typography><strong>Material Code:</strong> {group.materialCode || 'Not specified'}</Typography>
                             </Grid>
                             <Grid item xs={12}>
                               <Typography><strong>Material Qty:</strong> {group.materialQnty || 'Not specified'}</Typography>
                             </Grid>
                             <Grid item xs={12}>
                               <Typography><strong>Material Price:</strong> ${group.materialPrice || 0}</Typography>
                             </Grid>
                             
                             {/* Labour Work - Vertical Layout */}
                             <Grid item xs={12}>
                               <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.main', mb: 1, mt: 2 }}>
                                 Labour Details:
                               </Typography>
                             </Grid>
                             <Grid item xs={12}>
                               <Typography><strong>Labour Price:</strong> ${group.labourPrice || 0}</Typography>
                             </Grid>
                             <Grid item xs={12}>
                               <Typography><strong>Labour Note:</strong> {group.labourNote || 'Not specified'}</Typography>
                             </Grid>
                             <Grid item xs={12}>
                               <Typography><strong>Labour Qty:</strong> {group.labourQnty}</Typography>
                             </Grid>
                             
                             {/* Foam Details - Vertical Layout */}
                             {group.foamEnabled && (
                               <>
                                 <Grid item xs={12}>
                                   <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.main', mb: 1, mt: 2 }}>
                                     Foam Details:
                                   </Typography>
                                 </Grid>
                                 <Grid item xs={12}>
                                   <Typography><strong>Foam Price:</strong> ${group.foamPrice || 0}</Typography>
                                 </Grid>
                                 <Grid item xs={12}>
                                   <Typography><strong>Foam Thickness:</strong> {group.foamThickness || 'Not specified'}</Typography>
                                 </Grid>
                                 <Grid item xs={12}>
                                   <Typography><strong>Foam Note:</strong> {group.foamNote || 'Not specified'}</Typography>
                                 </Grid>
                                 <Grid item xs={12}>
                                   <Typography><strong>Foam Qty:</strong> {group.foamQnty}</Typography>
                                 </Grid>
                               </>
                             )}
                             
                             {/* Customer Note - at the end */}
                             {group.customerNote && (
                               <>
                                 <Grid item xs={12}>
                                   <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.main', mb: 1, mt: 2 }}>
                                     Customer Note:
                                   </Typography>
                                 </Grid>
                                 <Grid item xs={12}>
                                   <Typography>{group.customerNote}</Typography>
                                 </Grid>
                               </>
                             )}
                           </Grid>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Typography color="text.secondary">No furniture groups added</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Step 4: Payment & Notes */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Chip label="Step 4" color="primary" size="small" sx={{ mr: 2 }} />
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      fontWeight: 700,
                      background: 'linear-gradient(45deg, #1976d2, #42a5f5)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}
                  >
                    Payment & Notes
                  </Typography>
                </Box>
                <Tooltip title="Edit Payment Details">
                  <IconButton 
                    onClick={() => handleEditStep(4)} 
                    color="primary"
                    size="large"
                    sx={{ 
                      border: '2px solid',
                      borderColor: 'primary.main',
                      backgroundColor: 'white',
                      '&:hover': {
                        backgroundColor: 'primary.main',
                        color: 'white'
                      }
                    }}
                  >
                    <EditIcon fontSize="medium" />
                  </IconButton>
                </Tooltip>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography><strong>Deposit:</strong> ${paymentData.deposit || 0}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography><strong>Pickup & Delivery:</strong> {paymentData.pickupDeliveryEnabled ? 'Enabled' : 'Disabled'}</Typography>
                </Grid>
                {paymentData.pickupDeliveryEnabled && (
                  <Grid item xs={12}>
                    <Typography><strong>Pickup & Delivery Cost:</strong> ${paymentData.pickupDeliveryCost || 0}</Typography>
                  </Grid>
                )}
                {paymentData.notes && (
                  <Grid item xs={12}>
                    <Typography><strong>Notes:</strong> {paymentData.notes}</Typography>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Save Order Button */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <Button
          variant="contained"
          size="large"
          onClick={handleSaveOrder}
          startIcon={<CheckCircleIcon />}
          sx={{ 
            px: 4, 
            py: 1.5,
            fontSize: '1.1rem',
            fontWeight: 'bold',
            background: 'linear-gradient(45deg, #1976d2, #42a5f5)',
            '&:hover': {
              background: 'linear-gradient(45deg, #1565c0, #1976d2)'
            }
          }}
        >
          Save Order
        </Button>
      </Box>
    </Box>
  );
};

export default Step5Review; 