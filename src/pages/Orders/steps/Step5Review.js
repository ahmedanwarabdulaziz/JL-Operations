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

const SectionHeader = ({ icon, label }) => (
  <Box sx={{
    display: 'flex',
    alignItems: 'center',
    background: (theme) => theme.palette.grey[100],
    px: 2, py: 1.5, borderRadius: 2, mb: 2
  }}>
    {icon}
    <Typography variant="h6" sx={{ fontWeight: 700, ml: 1 }}>{label}</Typography>
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
              <Typography variant="body2" color="text.secondary">Name</Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>{personalInfo.customerName}</Typography>
              <Typography variant="body2" color="text.secondary">Phone</Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>{personalInfo.phone}</Typography>
              <Typography variant="body2" color="text.secondary">Email</Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>{personalInfo.email}</Typography>
              <Typography variant="body2" color="text.secondary">Address</Typography>
              <Typography variant="body1">{personalInfo.address}</Typography>
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
              <Typography variant="body2" color="text.secondary">Description</Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>{orderDetails.description}</Typography>
              <Typography variant="body2" color="text.secondary">Bill Invoice</Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>{orderDetails.billInvoice}</Typography>
              <Typography variant="body2" color="text.secondary">Platform</Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>{orderDetails.platform}</Typography>
              <Typography variant="body2" color="text.secondary">Start Date</Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>{orderDetails.startDate}</Typography>
              <Typography variant="body2" color="text.secondary">Timeline</Typography>
              <Typography variant="body1">{orderDetails.timeline}</Typography>
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
                  border: '2px solid #e3f2fd',
                  boxShadow: 2,
                  borderRadius: 2,
                  p: 0,
                  backgroundColor: '#fff',
                  overflow: 'hidden'
                }}>
                  <Box sx={{
                    backgroundColor: '#1976d2',
                    color: 'white',
                    p: 2,
                    borderTopLeftRadius: 8,
                    borderTopRightRadius: 8,
                    mb: 0,
                    textAlign: 'left',
                    fontFamily: 'Enta Sans Serif, Arial, sans-serif'
                  }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: 1 }}>
                      {group.furnitureType || `Furniture Group ${index + 1}`}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 3 }}>
                    {/* Material Row - all fields in one row */}
                    <Box sx={{ display: 'flex', alignItems: 'center', py: 1, borderBottom: '1px solid #f0f0f0', gap: 3, flexWrap: 'wrap' }}>
                      <Typography variant="caption" sx={{ color: 'grey.700', fontWeight: 700, textTransform: 'uppercase', fontSize: 13 }}>Material Company:</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600, color: 'grey.900', fontSize: 15, minWidth: 80, textAlign: 'left' }}>{group.materialCompany || '-'}</Typography>
                      <Typography variant="caption" sx={{ color: 'grey.700', fontWeight: 700, textTransform: 'uppercase', fontSize: 13 }}>Material Code:</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600, color: 'grey.900', fontSize: 15, minWidth: 60, textAlign: 'left' }}>{group.materialCode || '-'}</Typography>
                      <Typography variant="caption" sx={{ color: 'grey.700', fontWeight: 700, textTransform: 'uppercase', fontSize: 13 }}>Material Quantity:</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600, color: 'grey.900', fontSize: 15, minWidth: 40, textAlign: 'left' }}>{group.materialQnty || group.materialQuantity || '-'}</Typography>
                      <Typography variant="caption" sx={{ color: 'grey.700', fontWeight: 700, textTransform: 'uppercase', fontSize: 13 }}>Material Price:</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 700, color: '#1976d2', fontSize: 15, minWidth: 60, textAlign: 'left' }}>{group.materialPrice ? `$${group.materialPrice}` : '-'}</Typography>
                    </Box>
                    {/* Labour Row - all fields in one row */}
                    <Box sx={{ display: 'flex', alignItems: 'center', py: 1, borderBottom: '1px solid #f0f0f0', gap: 3, flexWrap: 'wrap', mt: 2 }}>
                      <Typography variant="caption" sx={{ color: 'grey.700', fontWeight: 700, textTransform: 'uppercase', fontSize: 13 }}>Labour Price:</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 700, color: '#1976d2', fontSize: 15, minWidth: 60, textAlign: 'left' }}>{group.labourPrice ? `$${group.labourPrice}` : '-'}</Typography>
                      <Typography variant="caption" sx={{ color: 'grey.700', fontWeight: 700, textTransform: 'uppercase', fontSize: 13 }}>Labour Note:</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600, color: 'grey.900', fontSize: 15, minWidth: 100, textAlign: 'left' }}>{group.labourNote || '-'}</Typography>
                      <Typography variant="caption" sx={{ color: 'grey.700', fontWeight: 700, textTransform: 'uppercase', fontSize: 13 }}>Labour Quantity:</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600, color: 'grey.900', fontSize: 15, minWidth: 40, textAlign: 'left' }}>{group.labourQnty || group.qntyLabour || '-'}</Typography>
                    </Box>
                    {/* Foam Row - all fields in one row, if has foam data */}
                    {(group.foamEnabled || group.foamPrice || group.foamQnty) && (
                      <Box sx={{ display: 'flex', alignItems: 'center', py: 1, borderBottom: '1px solid #f0f0f0', gap: 3, flexWrap: 'wrap', mt: 2 }}>
                        <Typography variant="caption" sx={{ color: 'grey.700', fontWeight: 700, textTransform: 'uppercase', fontSize: 13 }}>Foam Price:</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 700, color: '#1976d2', fontSize: 15, minWidth: 60, textAlign: 'left' }}>{group.foamPrice ? `$${group.foamPrice}` : '-'}</Typography>
                        <Typography variant="caption" sx={{ color: 'grey.700', fontWeight: 700, textTransform: 'uppercase', fontSize: 13 }}>Foam Thickness:</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 600, color: 'grey.900', fontSize: 15, minWidth: 40, textAlign: 'left' }}>{group.foamThickness || '-'}</Typography>
                        <Typography variant="caption" sx={{ color: 'grey.700', fontWeight: 700, textTransform: 'uppercase', fontSize: 13 }}>Foam Note:</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 600, color: 'grey.900', fontSize: 15, minWidth: 100, textAlign: 'left' }}>{group.foamNote || '-'}</Typography>
                        <Typography variant="caption" sx={{ color: 'grey.700', fontWeight: 700, textTransform: 'uppercase', fontSize: 13 }}>Foam Quantity:</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 600, color: 'grey.900', fontSize: 15, minWidth: 40, textAlign: 'left' }}>{group.foamQnty || group.qntyFoam || '-'}</Typography>
                      </Box>
                    )}
                    {/* Customer Note */}
                    <Box sx={{ mt: 3, pt: 2, borderTop: '2px solid #e3f2fd', width: '100%' }}>
                      <Typography variant="caption" color="grey.700" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, mb: 1, textAlign: 'left', fontSize: 13 }}>Customer Note</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500, fontStyle: 'italic', color: 'grey.900', mt: 0.5, textAlign: 'left', fontSize: 15 }}>{group.customerNote || '-'}</Typography>
                    </Box>
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
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#1976d2' }}>${paymentDetails.deposit}</Typography>
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">Amount Paid by Customer</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: paymentDetails.amountPaid >= paymentDetails.deposit ? '#4caf50' : '#ff9800' }}>
                ${paymentDetails.amountPaid}
              </Typography>
            </Box>
            {paymentDetails.pickupDeliveryEnabled && (
              <Box>
                <Typography variant="body2" color="text.secondary">Pickup & Delivery Cost</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#1976d2' }}>${paymentDetails.pickupDeliveryCost}</Typography>
              </Box>
            )}
            {paymentDetails.notes && (
              <Box>
                <Typography variant="body2" color="text.secondary">Additional Notes</Typography>
                <Typography variant="body1" sx={{ fontStyle: 'italic' }}>{paymentDetails.notes}</Typography>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Step5Review; 