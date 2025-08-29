import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Tooltip,
  useTheme
} from '@mui/material';
import {
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  Person as PersonIcon,
  Weekend as WeekendIcon,
  Payment as PaymentIcon
} from '@mui/icons-material';
import { formatDate, formatDateOnly } from '../../../utils/dateUtils';

// Utility function to check if a field has a meaningful value
const hasValue = (value) => {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (typeof value === 'string' && (value === '-' || value === 'N/A' || value === 'Not specified' || value === '0')) return false;
  if (typeof value === 'number' && value === 0) return false;
  // Convert string numbers to actual numbers for comparison
  if (typeof value === 'string' && !isNaN(value) && parseFloat(value) === 0) return false;
  return true;
};

// Component to conditionally render a field with its label
const ReviewField = ({ label, value, sx = {}, isDate = false }) => {
  const hasValidValue = hasValue(value);
  
  if (!hasValidValue) {
    // Return empty space to preserve layout
    return <Box sx={{ height: 48, mb: 1 }} />;
  }
  
  // Format the value based on type
  let displayValue = value;
  if (isDate) {
    try {
      displayValue = formatDateOnly(value);
    } catch (error) {
      console.error('Error formatting date:', error, 'Date value:', value);
      displayValue = 'Invalid Date';
    }
  } else if (typeof value === 'number' && value > 0) {
    displayValue = `$${value}`;
  }
  
  return (
    <Box sx={{ mb: 1 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography 
        variant="body1" 
        sx={{ 
          color: '#ffffff',
          ...sx
        }}
      >
        {displayValue}
      </Typography>
    </Box>
  );
};



const SectionHeader = ({ icon, label }) => (
  <Box sx={{
    display: 'flex',
    alignItems: 'center',
    background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
    color: '#000000',
    px: 2, py: 1.5, borderRadius: 2, mb: 2
  }}>
    {React.cloneElement(icon, { sx: { color: '#000000' } })}
    <Typography variant="h6" sx={{ fontWeight: 700, ml: 1, color: '#000000' }}>{label}</Typography>
  </Box>
);

const Step5Review = ({ 
  personalInfo, 
  orderDetails, 
  furnitureGroups, 
  paymentDetails,
  onEditStep,
  showEditButtons = true
}) => {
  const theme = useTheme();
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <CheckCircleIcon color="primary" sx={{ mr: 1 }} />
        <Typography variant="h5" gutterBottom>
          Review & Confirm Order
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Please review all the information before submitting the order. You can edit any section by clicking the edit button.
      </Typography>

      {/* First Row - Personal Info and Order Details */}
      <Box sx={{ display: 'flex', gap: 3, mb: 4 }}>
        {/* Personal Info Card */}
        <Card sx={{ boxShadow: 4, flex: 1 }}>
          <CardContent>
            <SectionHeader icon={<PersonIcon color="primary" />} label="Personal Information" />
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Chip label="Step 1" color="primary" size="small" />
                {showEditButtons && (
                  <Tooltip title="Edit Personal Information">
                    <IconButton onClick={() => onEditStep(0)} color="primary" size="small">
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
              <Divider sx={{ mb: 1 }} />
              <ReviewField label="Name" value={personalInfo.customerName} />
              <ReviewField label="Phone" value={personalInfo.phone} />
              <ReviewField label="Email" value={personalInfo.email} />
              <ReviewField label="Address" value={personalInfo.address} />
            </Box>
          </CardContent>
        </Card>

        {/* Order Details Card */}
        <Card sx={{ boxShadow: 4, flex: 1 }}>
          <CardContent>
            <SectionHeader icon={<PersonIcon color="primary" />} label="Order Details" />
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Chip label="Step 2" color="primary" size="small" />
                {showEditButtons && (
                  <Tooltip title="Edit Order Details">
                    <IconButton onClick={() => onEditStep(1)} color="primary" size="small">
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
              <Divider sx={{ mb: 1 }} />
              <ReviewField label="Description" value={orderDetails.description} />
              <ReviewField label="Bill Invoice" value={orderDetails.billInvoice} />
              <ReviewField label="Platform" value={orderDetails.platform} />
              <ReviewField label="Start Date" value={orderDetails.startDate} isDate={true} />
              <ReviewField label="Timeline" value={orderDetails.timeline} />
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Furniture Details Card */}
      <Card sx={{ boxShadow: 4, width: '100%', mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <SectionHeader icon={<WeekendIcon color="primary" />} label="Furniture Details" />
            {showEditButtons && (
              <Tooltip title="Edit Furniture Details">
                <IconButton onClick={() => onEditStep(2)} color="primary" size="small">
                  <EditIcon />
                </IconButton>
              </Tooltip>
            )}
          </Box>
          <Box sx={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: 4,
            width: '100%'
          }}>
            {furnitureGroups.map((group, index) => (
              <Box key={index} sx={{
                width: '100%',
                minWidth: '300px',
                maxWidth: '100%',
                mb: 3
              }}>
                <Box sx={{
                  width: '100%',
                  border: '2px solid #333333',
                  boxShadow: 2,
                  borderRadius: 2,
                  p: 0,
                  backgroundColor: 'background.paper',
                  overflow: 'hidden'
                }}>
                  <Box sx={{
                    backgroundColor: 'primary.main',
                    color: '#000000',
                    p: 2,
                    borderTopLeftRadius: 8,
                    borderTopRightRadius: 8,
                    mb: 0,
                    textAlign: 'left',
                    fontFamily: 'Enta Sans Serif, Arial, sans-serif'
                  }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: 1, color: '#000000' }}>
                      {group.furnitureType || `Furniture Group ${index + 1}`}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 3 }}>
                    {/* Material Row - all fields in one row */}
                    <Box sx={{ display: 'flex', alignItems: 'center', py: 1, borderBottom: '1px solid #f0f0f0', gap: 3, flexWrap: 'wrap' }}>
                      {hasValue(group.materialCompany) && (
                        <>
                          <Typography variant="caption" sx={{ color: '#b98f33', fontWeight: 700, textTransform: 'uppercase', fontSize: 13 }}>Material Company:</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 600, color: '#ffffff', fontSize: 15, minWidth: 80, textAlign: 'left' }}>{group.materialCompany}</Typography>
                        </>
                      )}
                      {hasValue(group.materialCode) && (
                        <>
                          <Typography variant="caption" sx={{ color: '#b98f33', fontWeight: 700, textTransform: 'uppercase', fontSize: 13 }}>Material Code:</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 600, color: '#ffffff', fontSize: 15, minWidth: 60, textAlign: 'left' }}>{group.materialCode}</Typography>
                        </>
                      )}
                      {hasValue(group.materialQnty || group.materialQuantity) && (
                        <>
                          <Typography variant="caption" sx={{ color: '#b98f33', fontWeight: 700, textTransform: 'uppercase', fontSize: 13 }}>Material Quantity:</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 600, color: '#ffffff', fontSize: 15, minWidth: 40, textAlign: 'left' }}>{group.materialQnty || group.materialQuantity}</Typography>
                        </>
                      )}
                      {hasValue(group.materialPrice) && (
                        <>
                          <Typography variant="caption" sx={{ color: '#b98f33', fontWeight: 700, textTransform: 'uppercase', fontSize: 13 }}>Material Price:</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 700, color: '#ffffff', fontSize: 15, minWidth: 60, textAlign: 'left' }}>${group.materialPrice}</Typography>
                        </>
                      )}
                    </Box>
                    {/* Labour Row - all fields in one row */}
                    <Box sx={{ display: 'flex', alignItems: 'center', py: 1, borderBottom: '1px solid #f0f0f0', gap: 3, flexWrap: 'wrap', mt: 2 }}>
                      {hasValue(group.labourPrice) && (
                        <>
                          <Typography variant="caption" sx={{ color: '#b98f33', fontWeight: 700, textTransform: 'uppercase', fontSize: 13 }}>Labour Price:</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 700, color: '#ffffff', fontSize: 15, minWidth: 60, textAlign: 'left' }}>${group.labourPrice}</Typography>
                        </>
                      )}
                      {hasValue(group.labourNote) && (
                        <>
                          <Typography variant="caption" sx={{ color: '#b98f33', fontWeight: 700, textTransform: 'uppercase', fontSize: 13 }}>Labour Note:</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 600, color: '#ffffff', fontSize: 15, minWidth: 100, textAlign: 'left' }}>{group.labourNote}</Typography>
                        </>
                      )}

                    </Box>
                    {/* Foam Row - all fields in one row, only if foam price has value */}
                    {hasValue(group.foamPrice) && parseFloat(group.foamPrice) > 0 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', py: 1, borderBottom: '1px solid #f0f0f0', gap: 3, flexWrap: 'wrap', mt: 2 }}>
                        {hasValue(group.foamPrice) && (
                          <>
                            <Typography variant="caption" sx={{ color: '#b98f33', fontWeight: 700, textTransform: 'uppercase', fontSize: 13 }}>Foam Price:</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 700, color: '#ffffff', fontSize: 15, minWidth: 60, textAlign: 'left' }}>${group.foamPrice}</Typography>
                          </>
                        )}
                        {hasValue(group.foamThickness) && (
                          <>
                            <Typography variant="caption" sx={{ color: '#b98f33', fontWeight: 700, textTransform: 'uppercase', fontSize: 13 }}>Foam Thickness:</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600, color: '#ffffff', fontSize: 15, minWidth: 40, textAlign: 'left' }}>{group.foamThickness}</Typography>
                          </>
                        )}
                        {hasValue(group.foamNote) && (
                          <>
                            <Typography variant="caption" sx={{ color: '#b98f33', fontWeight: 700, textTransform: 'uppercase', fontSize: 13 }}>Foam Note:</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600, color: '#ffffff', fontSize: 15, minWidth: 100, textAlign: 'left' }}>{group.foamNote}</Typography>
                          </>
                        )}

                      </Box>
                    )}
                    {/* Painting Row - all fields in one row, only if painting labour has value */}
                    {hasValue(group.paintingLabour) && parseFloat(group.paintingLabour) > 0 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', py: 1, borderBottom: '1px solid #f0f0f0', gap: 3, flexWrap: 'wrap', mt: 2 }}>
                        {hasValue(group.paintingLabour) && (
                          <>
                            <Typography variant="caption" sx={{ color: '#b98f33', fontWeight: 700, textTransform: 'uppercase', fontSize: 13 }}>Painting Labour:</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 700, color: '#ffffff', fontSize: 15, minWidth: 60, textAlign: 'left' }}>${group.paintingLabour}</Typography>
                          </>
                        )}
                        {hasValue(group.paintingNote) && (
                          <>
                            <Typography variant="caption" sx={{ color: '#b98f33', fontWeight: 700, textTransform: 'uppercase', fontSize: 13 }}>Painting Note:</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600, color: '#ffffff', fontSize: 15, minWidth: 100, textAlign: 'left' }}>{group.paintingNote}</Typography>
                          </>
                        )}

                      </Box>
                    )}
                    {/* Customer Note - only if has value */}
                    {hasValue(group.customerNote) && (
                      <Box sx={{ mt: 3, pt: 2, borderTop: '2px solid #e3f2fd', width: '100%' }}>
                        <Typography variant="caption" sx={{ color: '#b98f33', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, mb: 1, textAlign: 'left', fontSize: 13 }}>Customer Note</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500, fontStyle: 'italic', color: '#ffffff', mt: 0.5, textAlign: 'left', fontSize: 15 }}>{group.customerNote}</Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* Payment & Notes Card */}
      <Card sx={{ boxShadow: 4, width: '100%', mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <SectionHeader icon={<PaymentIcon color="primary" />} label="Payment & Notes" />
            {showEditButtons && (
              <Tooltip title="Edit Payment & Notes">
                <IconButton onClick={() => onEditStep(3)} color="primary" size="small">
                  <EditIcon />
                </IconButton>
              </Tooltip>
            )}
          </Box>
          <Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">Required Deposit Amount</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#b98f33' }}>${paymentDetails.deposit}</Typography>
            </Box>
            {hasValue(paymentDetails.amountPaid) && parseFloat(paymentDetails.amountPaid) > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Amount Paid by Customer</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: paymentDetails.amountPaid >= paymentDetails.deposit ? '#4caf50' : '#ff9800' }}>
                  ${paymentDetails.amountPaid}
                </Typography>
              </Box>
            )}
            {paymentDetails.pickupDeliveryEnabled && hasValue(paymentDetails.pickupDeliveryCost) && (
              <Box>
                <Typography variant="body2" color="text.secondary">Pickup & Delivery Cost</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#b98f33' }}>${paymentDetails.pickupDeliveryCost}</Typography>
              </Box>
            )}
            {hasValue(paymentDetails.notes) && (
              <Box>
                <Typography variant="body2" color="text.secondary">Additional Notes</Typography>
                <Typography variant="body1" sx={{ fontStyle: 'italic', color: '#ffffff' }}>{paymentDetails.notes}</Typography>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Step5Review; 