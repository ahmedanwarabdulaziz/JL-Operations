import React from 'react';
import {
  Box,
  TextField,
  Typography,
  Grid,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText
} from '@mui/material';
import { 
  Assignment as AssignmentIcon,
  Warning as WarningIcon 
} from '@mui/icons-material';
import useMaterialCompanies from '../../hooks/useMaterialCompanies';

const FastOrderStep2 = ({ data, onUpdate, fieldSettings, errors }) => {
  const { materialCompanies } = useMaterialCompanies();

  // Handle order details changes
  const handleOrderDetailsChange = (field) => (event) => {
    onUpdate({
      orderDetails: {
        ...data.orderDetails,
        [field]: event.target.value
      }
    });
  };

  // Handle furniture data changes
  const handleFurnitureChange = (field) => (event) => {
    const newValue = ['materialQnty', 'materialPrice', 'labourQnty', 'labourPrice', 'foamQnty', 'foamPrice'].includes(field)
      ? Number(event.target.value) || 0 
      : event.target.value;

    onUpdate({
      furnitureData: {
        ...data.furnitureData,
        groups: [{
          ...data.furnitureData.groups[0],
          [field]: newValue
        }]
      }
    });
  };

  // Handle payment data changes
  const handlePaymentChange = (field) => (event) => {
    const value = field === 'deposit' ? Number(event.target.value) || 0 : event.target.value;
    
    onUpdate({
      paymentData: {
        ...data.paymentData,
        [field]: value
      }
    });
  };

  // Check if any fields are enabled
  const hasEnabledFields = Object.values(fieldSettings).some(field => field.enabled);

  if (!hasEnabledFields) {
    return (
      <Box textAlign="center" py={4}>
        <WarningIcon sx={{ fontSize: 48, color: '#f27921', mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          No Fields Configured
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Please go to Rapid Invoice Settings to enable fields for fast order creation.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 3, backgroundColor: '#f8f9fa' }}>
        <Box display="flex" alignItems="center">
          <AssignmentIcon sx={{ color: '#274290', mr: 1 }} />
          <Typography variant="h6" color="#274290">
            Order Details
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" mt={1}>
          Fill in the enabled fields based on your rapid invoice settings.
        </Typography>
      </Paper>

      {/* Dynamic Fields */}
      <Grid container spacing={3}>
        
        {/* Order Details Section */}
        {fieldSettings.billInvoice?.enabled && (
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Bill Invoice"
              value={data.orderDetails.billInvoice || ''}
              onChange={handleOrderDetailsChange('billInvoice')}
              error={!!errors.billInvoice}
              helperText={errors.billInvoice}
              required
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': { borderColor: '#f27921' },
                  '&.Mui-focused fieldset': { borderColor: '#274290' },
                },
              }}
            />
          </Grid>
        )}

        {fieldSettings.description?.enabled && (
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Description"
              value={data.orderDetails.description || ''}
              onChange={handleOrderDetailsChange('description')}
              error={!!errors.description}
              helperText={errors.description}
              variant="outlined"
              multiline
              rows={2}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': { borderColor: '#f27921' },
                  '&.Mui-focused fieldset': { borderColor: '#274290' },
                },
              }}
            />
          </Grid>
        )}

        {fieldSettings.platform?.enabled && (
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Platform"
              value={data.orderDetails.platform || ''}
              onChange={handleOrderDetailsChange('platform')}
              error={!!errors.platform}
              helperText={errors.platform}
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': { borderColor: '#f27921' },
                  '&.Mui-focused fieldset': { borderColor: '#274290' },
                },
              }}
            />
          </Grid>
        )}

        {fieldSettings.startDate?.enabled && (
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Start Date"
              type="date"
              value={data.orderDetails.startDate || ''}
              onChange={handleOrderDetailsChange('startDate')}
              error={!!errors.startDate}
              helperText={errors.startDate}
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': { borderColor: '#f27921' },
                  '&.Mui-focused fieldset': { borderColor: '#274290' },
                },
              }}
            />
          </Grid>
        )}

        {fieldSettings.timeline?.enabled && (
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Timeline"
              value={data.orderDetails.timeline || ''}
              onChange={handleOrderDetailsChange('timeline')}
              error={!!errors.timeline}
              helperText={errors.timeline}
              variant="outlined"
              placeholder="e.g., 2 weeks"
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': { borderColor: '#f27921' },
                  '&.Mui-focused fieldset': { borderColor: '#274290' },
                },
              }}
            />
          </Grid>
        )}

        {/* Furniture Section */}
        {fieldSettings.furnitureType?.enabled && (
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Furniture Type"
              value={data.furnitureData.groups[0]?.furnitureType || ''}
              onChange={handleFurnitureChange('furnitureType')}
              error={!!errors.furnitureType}
              helperText={errors.furnitureType}
              required={fieldSettings.furnitureType?.enabled}
              variant="outlined"
              placeholder="e.g., Sofa, Chair, etc."
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': { borderColor: '#f27921' },
                  '&.Mui-focused fieldset': { borderColor: '#274290' },
                },
              }}
            />
          </Grid>
        )}

        {/* Material Group */}
        {fieldSettings.materialGroup?.enabled && (
          <>
            {fieldSettings.materialCompany?.enabled && (
              <Grid item xs={12} md={6}>
                <FormControl 
                  fullWidth 
                  variant="outlined"
                  error={!!errors.materialCompany}
                >
                  <InputLabel>Material Company</InputLabel>
                  <Select
                    value={data.furnitureData.groups[0]?.materialCompany || ''}
                    onChange={handleFurnitureChange('materialCompany')}
                    label="Material Company"
                    sx={{
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#f27921' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#274290' },
                    }}
                  >
                    <MenuItem value="">
                      <em>Select Material Company</em>
                    </MenuItem>
                    {materialCompanies.map((company) => (
                      <MenuItem key={company.id} value={company.name}>
                        {company.name}
                      </MenuItem>
                    ))}
                  </Select>
                  {errors.materialCompany && (
                    <FormHelperText>{errors.materialCompany}</FormHelperText>
                  )}
                </FormControl>
              </Grid>
            )}

            {fieldSettings.materialCode?.enabled && (
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Material Code"
                  value={data.furnitureData.groups[0]?.materialCode || ''}
                  onChange={handleFurnitureChange('materialCode')}
                  error={!!errors.materialCode}
                  helperText={errors.materialCode}
                  variant="outlined"
                  placeholder="e.g., MTL001"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '&:hover fieldset': { borderColor: '#f27921' },
                      '&.Mui-focused fieldset': { borderColor: '#274290' },
                    },
                  }}
                />
              </Grid>
            )}

            {fieldSettings.materialQnty?.enabled && (
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Material Quantity"
                  type="number"
                  value={data.furnitureData.groups[0]?.materialQnty || 1}
                  onChange={handleFurnitureChange('materialQnty')}
                  error={!!errors.materialQnty}
                  helperText={errors.materialQnty}
                  variant="outlined"
                  inputProps={{ min: 1 }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '&:hover fieldset': { borderColor: '#f27921' },
                      '&.Mui-focused fieldset': { borderColor: '#274290' },
                    },
                  }}
                />
              </Grid>
            )}

            {fieldSettings.materialPrice?.enabled && (
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Material Price ($)"
                  type="number"
                  value={data.furnitureData.groups[0]?.materialPrice || 0}
                  onChange={handleFurnitureChange('materialPrice')}
                  error={!!errors.materialPrice}
                  helperText={errors.materialPrice}
                  variant="outlined"
                  inputProps={{ min: 0, step: 0.01 }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '&:hover fieldset': { borderColor: '#f27921' },
                      '&.Mui-focused fieldset': { borderColor: '#274290' },
                    },
                  }}
                />
              </Grid>
            )}
          </>
        )}

        {/* Labour Group */}
        {fieldSettings.labourGroup?.enabled && (
          <>
            {fieldSettings.labourPrice?.enabled && (
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Labour Price ($)"
                  type="number"
                  value={data.furnitureData.groups[0]?.labourPrice || 0}
                  onChange={handleFurnitureChange('labourPrice')}
                  error={!!errors.labourPrice}
                  helperText={errors.labourPrice}
                  variant="outlined"
                  inputProps={{ min: 0, step: 0.01 }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '&:hover fieldset': { borderColor: '#f27921' },
                      '&.Mui-focused fieldset': { borderColor: '#274290' },
                    },
                  }}
                />
              </Grid>
            )}

            {fieldSettings.labourNote?.enabled && (
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Labour Note"
                  value={data.furnitureData.groups[0]?.labourNote || ''}
                  onChange={handleFurnitureChange('labourNote')}
                  error={!!errors.labourNote}
                  helperText={errors.labourNote}
                  variant="outlined"
                  placeholder="Labour details..."
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '&:hover fieldset': { borderColor: '#f27921' },
                      '&.Mui-focused fieldset': { borderColor: '#274290' },
                    },
                  }}
                />
              </Grid>
            )}

            {fieldSettings.labourQnty?.enabled && (
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Labour Quantity"
                  type="number"
                  value={data.furnitureData.groups[0]?.labourQnty || 1}
                  onChange={handleFurnitureChange('labourQnty')}
                  error={!!errors.labourQnty}
                  helperText={errors.labourQnty}
                  variant="outlined"
                  inputProps={{ min: 1 }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '&:hover fieldset': { borderColor: '#f27921' },
                      '&.Mui-focused fieldset': { borderColor: '#274290' },
                    },
                  }}
                />
              </Grid>
            )}
          </>
        )}

        {/* Foam Group */}
        {fieldSettings.foamGroup?.enabled && (
          <>
            {fieldSettings.foamPrice?.enabled && (
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Foam Price ($)"
                  type="number"
                  value={data.furnitureData.groups[0]?.foamPrice || 0}
                  onChange={handleFurnitureChange('foamPrice')}
                  error={!!errors.foamPrice}
                  helperText={errors.foamPrice}
                  variant="outlined"
                  inputProps={{ min: 0, step: 0.01 }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '&:hover fieldset': { borderColor: '#f27921' },
                      '&.Mui-focused fieldset': { borderColor: '#274290' },
                    },
                  }}
                />
              </Grid>
            )}

            {fieldSettings.foamQnty?.enabled && (
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Foam Quantity"
                  type="number"
                  value={data.furnitureData.groups[0]?.foamQnty || 1}
                  onChange={handleFurnitureChange('foamQnty')}
                  error={!!errors.foamQnty}
                  helperText={errors.foamQnty}
                  variant="outlined"
                  inputProps={{ min: 1 }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '&:hover fieldset': { borderColor: '#f27921' },
                      '&.Mui-focused fieldset': { borderColor: '#274290' },
                    },
                  }}
                />
              </Grid>
            )}
          </>
        )}

        {/* Payment Section */}
        {fieldSettings.deposit?.enabled && (
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Deposit Amount ($)"
              type="number"
              value={data.paymentData.deposit || 0}
              onChange={handlePaymentChange('deposit')}
              error={!!errors.deposit}
              helperText={errors.deposit}
              variant="outlined"
              inputProps={{ min: 0, step: 0.01 }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': { borderColor: '#f27921' },
                  '&.Mui-focused fieldset': { borderColor: '#274290' },
                },
              }}
            />
          </Grid>
        )}

        {fieldSettings.notes?.enabled && (
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Notes"
              value={data.paymentData.notes || ''}
              onChange={handlePaymentChange('notes')}
              error={!!errors.notes}
              helperText={errors.notes}
              variant="outlined"
              multiline
              rows={3}
              placeholder="Additional notes or special instructions..."
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': { borderColor: '#f27921' },
                  '&.Mui-focused fieldset': { borderColor: '#274290' },
                },
              }}
            />
          </Grid>
        )}
      </Grid>

      {/* Quick Summary */}
      {(fieldSettings.materialGroup?.enabled || fieldSettings.labourGroup?.enabled || fieldSettings.foamGroup?.enabled) && (
        <Box mt={3}>
          <Paper sx={{ p: 2, backgroundColor: '#e8f5e8' }}>
            <Typography variant="h6" gutterBottom color="#274290">
              💰 Order Summary
            </Typography>
            {fieldSettings.materialGroup?.enabled && (
              <Typography variant="body2" color="text.secondary">
                <strong>Material:</strong> {data.furnitureData.groups[0]?.materialQnty || 0} × ${data.furnitureData.groups[0]?.materialPrice || 0} = ${((data.furnitureData.groups[0]?.materialQnty || 0) * (data.furnitureData.groups[0]?.materialPrice || 0)).toFixed(2)}
              </Typography>
            )}
            {fieldSettings.labourGroup?.enabled && (
              <Typography variant="body2" color="text.secondary">
                <strong>Labour:</strong> {data.furnitureData.groups[0]?.labourQnty || 0} × ${data.furnitureData.groups[0]?.labourPrice || 0} = ${((data.furnitureData.groups[0]?.labourQnty || 0) * (data.furnitureData.groups[0]?.labourPrice || 0)).toFixed(2)}
              </Typography>
            )}
            {fieldSettings.foamGroup?.enabled && (
              <Typography variant="body2" color="text.secondary">
                <strong>Foam:</strong> {data.furnitureData.groups[0]?.foamQnty || 0} × ${data.furnitureData.groups[0]?.foamPrice || 0} = ${((data.furnitureData.groups[0]?.foamQnty || 0) * (data.furnitureData.groups[0]?.foamPrice || 0)).toFixed(2)}
              </Typography>
            )}
            <Box sx={{ borderTop: '1px solid #ddd', mt: 1, pt: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                <strong>Total: ${(
                  ((data.furnitureData.groups[0]?.materialQnty || 0) * (data.furnitureData.groups[0]?.materialPrice || 0)) +
                  ((data.furnitureData.groups[0]?.labourQnty || 0) * (data.furnitureData.groups[0]?.labourPrice || 0)) +
                  ((data.furnitureData.groups[0]?.foamQnty || 0) * (data.furnitureData.groups[0]?.foamPrice || 0))
                ).toFixed(2)}</strong>
              </Typography>
            </Box>
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default FastOrderStep2; 