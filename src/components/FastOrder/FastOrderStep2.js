import React from 'react';
import {
  Box,
  Typography,
  TextField,
  Grid,
  FormControl,
  Select,
  MenuItem,
  Button,
  IconButton,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  Divider,
  Tooltip
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import useMaterialCompanies from '../../hooks/useMaterialCompanies';
import { usePlatforms } from '../../hooks/usePlatforms';

const FastOrderStep2 = ({ 
  data, 
  onUpdate, 
  toggles, 
  onToggleChange, 
  errors = {} 
}) => {
  const { companies: materialCompanies, loading: companiesLoading } = useMaterialCompanies();
  const { platforms, loading: platformsLoading } = usePlatforms();

  const handleOrderDetailsChange = (field, value) => {
    onUpdate({
      ...data,
      orderDetails: {
        ...data.orderDetails,
        [field]: value
      }
    });
  };

  const handlePaymentChange = (field, value) => {
    onUpdate({
      ...data,
      paymentData: {
        ...data.paymentData,
        [field]: value
      }
    });
  };

  const addFurnitureGroup = () => {
    const newGroup = {
      id: Date.now(),
      furnitureType: '',
      materialCompany: '',
      materialCode: '',
      materialQnty: '',
      materialPrice: '',
      labourPrice: '',
      labourNote: '',
      labourQnty: 1,
      foamEnabled: false,
      foamPrice: '',
      foamQnty: 1,
      foamNote: '',
      customerNote: ''
    };
    
    onUpdate({
      ...data,
      furnitureData: {
        ...data.furnitureData,
        groups: [...data.furnitureData.groups, newGroup]
      }
    });
  };

  const removeFurnitureGroup = (index) => {
    const updatedGroups = data.furnitureData.groups.filter((_, i) => i !== index);
    onUpdate({
      ...data,
      furnitureData: {
        ...data.furnitureData,
        groups: updatedGroups
      }
    });
  };

  const updateFurnitureGroup = (index, field, value) => {
    const updatedGroups = data.furnitureData.groups.map((group, i) => 
      i === index ? { ...group, [field]: value } : group
    );
    onUpdate({
      ...data,
      furnitureData: {
        ...data.furnitureData,
        groups: updatedGroups
      }
    });
  };

  const handleRefreshBillNumber = () => {
    // Generate a new bill number (6 digits)
    const newBillNumber = Math.floor(100000 + Math.random() * 900000).toString();
    handleOrderDetailsChange('billInvoice', newBillNumber);
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Order Details
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure order details with toggles for different sections
      </Typography>

      {/* Bill Invoice - Always shown */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Bill number is automatically generated from the highest existing bill number (6 digits)
          </Typography>
          <Tooltip title="Refresh bill number">
            <Button
              size="small"
              startIcon={<RefreshIcon />}
              onClick={handleRefreshBillNumber}
              variant="outlined"
              sx={{ minWidth: 'auto', px: 1 }}
            >
              Refresh
            </Button>
          </Tooltip>
        </Box>
        <TextField
          fullWidth
          label="Bill Invoice *"
          value={data.orderDetails.billInvoice}
          onChange={(e) => handleOrderDetailsChange('billInvoice', e.target.value)}
          error={!!errors.billInvoice}
          helperText={errors.billInvoice || 'Must be exactly 6 digits'}
          required
          inputProps={{ 
            maxLength: 6,
            pattern: '[0-9]{6}'
          }}
          sx={{
            '& .MuiOutlinedInput-notchedOutline': {
              borderWidth: '2px',
              borderColor: errors.billInvoice ? 'error.main' : 'grey.300',
              borderRadius: 2,
            },
            '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: errors.billInvoice ? 'error.main' : 'primary.main',
            },
            '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: errors.billInvoice ? 'error.main' : 'primary.main',
              borderWidth: '2px',
            },
          }}
        />
      </Box>

      {/* Toggle 1: Order Details */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <FormControlLabel
            control={
              <Switch
                checked={toggles.orderDetails}
                onChange={(e) => onToggleChange('orderDetails', e.target.checked)}
              />
            }
            label="Order Details"
          />
          
          {toggles.orderDetails && (
            <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <TextField
                fullWidth
                label="Order Description"
                value={data.orderDetails.description}
                onChange={(e) => handleOrderDetailsChange('description', e.target.value)}
                placeholder="Describe the order details"
                sx={{
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderWidth: '2px',
                    borderColor: 'grey.300',
                    borderRadius: 2,
                  },
                  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.main',
                  },
                  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.main',
                    borderWidth: '2px',
                  },
                }}
              />

              <FormControl fullWidth error={!!errors.platform}>
                <Select
                  value={data.orderDetails.platform}
                  onChange={(e) => handleOrderDetailsChange('platform', e.target.value)}
                  displayEmpty
                  sx={{
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderWidth: '2px',
                      borderColor: errors.platform ? 'error.main' : 'grey.300',
                      borderRadius: 2,
                    },
                    '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: errors.platform ? 'error.main' : 'primary.main',
                    },
                    '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: errors.platform ? 'error.main' : 'primary.main',
                      borderWidth: '2px',
                    },
                  }}
                >
                  <MenuItem value="" disabled>
                    {platformsLoading ? 'Loading platforms...' : 'Select Platform'}
                  </MenuItem>
                  {platforms.map((platform) => (
                    <MenuItem key={platform.id} value={platform.name}>
                      {platform.name}
                    </MenuItem>
                  ))}
                </Select>
                {errors.platform && (
                  <Typography variant="caption" color="error">
                    {errors.platform}
                  </Typography>
                )}
              </FormControl>

              <TextField
                fullWidth
                label="Start Date *"
                type="date"
                value={data.orderDetails.startDate}
                onChange={(e) => handleOrderDetailsChange('startDate', e.target.value)}
                error={!!errors.startDate}
                helperText={errors.startDate}
                InputLabelProps={{
                  shrink: true,
                }}
                required
                sx={{
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderWidth: '2px',
                    borderColor: errors.startDate ? 'error.main' : 'grey.300',
                    borderRadius: 2,
                  },
                  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: errors.startDate ? 'error.main' : 'primary.main',
                  },
                  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: errors.startDate ? 'error.main' : 'primary.main',
                    borderWidth: '2px',
                  },
                }}
              />

              <TextField
                fullWidth
                label="Timeline"
                value={data.orderDetails.timeline}
                onChange={(e) => handleOrderDetailsChange('timeline', e.target.value)}
                placeholder="e.g., 2 weeks, 1 month, etc."
                sx={{
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderWidth: '2px',
                    borderColor: 'grey.300',
                    borderRadius: 2,
                  },
                  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.main',
                  },
                  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.main',
                    borderWidth: '2px',
                  },
                }}
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Furniture Groups - Furniture Type always shown */}
      {data.furnitureData.groups.map((group, index) => (
        <Card key={group.id || index} sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6">
                Furniture Group {index + 1}
              </Typography>
              <IconButton 
                onClick={() => removeFurnitureGroup(index)}
                color="error"
                size="small"
              >
                <DeleteIcon />
              </IconButton>
            </Box>

            {/* Furniture Type - Always shown */}
            <Box sx={{ mb: 3 }}>
              <TextField
                fullWidth
                label="Furniture Type *"
                value={group.furnitureType}
                onChange={(e) => updateFurnitureGroup(index, 'furnitureType', e.target.value)}
                placeholder="Enter furniture type"
                required
                sx={{
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderWidth: '2px',
                    borderColor: 'grey.300',
                    borderRadius: 2,
                  },
                  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.main',
                  },
                  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.main',
                    borderWidth: '2px',
                  },
                }}
              />
            </Box>

            {/* Toggle 2: Materials */}
            <Card sx={{ mb: 3, p: 2, backgroundColor: '#f8f9fa' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={toggles.materials}
                    onChange={(e) => onToggleChange('materials', e.target.checked)}
                  />
                }
                label="Materials"
              />
              
              {toggles.materials && (
                <Grid container spacing={2} sx={{ mt: 2 }}>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth error={!!errors.materialCompany}>
                      <Select
                        value={group.materialCompany}
                        onChange={(e) => updateFurnitureGroup(index, 'materialCompany', e.target.value)}
                        displayEmpty
                        sx={{
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderWidth: '2px',
                            borderColor: errors.materialCompany ? 'error.main' : 'grey.300',
                            borderRadius: 2,
                          },
                          '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: errors.materialCompany ? 'error.main' : 'primary.main',
                          },
                          '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            borderColor: errors.materialCompany ? 'error.main' : 'primary.main',
                            borderWidth: '2px',
                          },
                        }}
                      >
                        <MenuItem value="" disabled>
                          {companiesLoading ? 'Loading companies...' : 'Material Company'}
                        </MenuItem>
                        {materialCompanies.map((company) => (
                          <MenuItem key={company.id} value={company.name}>
                            {company.name}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors.materialCompany && (
                        <Typography variant="caption" color="error">
                          {errors.materialCompany}
                        </Typography>
                      )}
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={2}>
                    <TextField
                      fullWidth
                      label="Material Code"
                      value={group.materialCode}
                      onChange={(e) => updateFurnitureGroup(index, 'materialCode', e.target.value)}
                      placeholder="Enter material code"
                      error={!!errors.materialCode}
                      helperText={errors.materialCode}
                      sx={{
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderWidth: '2px',
                          borderColor: errors.materialCode ? 'error.main' : 'grey.300',
                          borderRadius: 2,
                        },
                        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: errors.materialCode ? 'error.main' : 'primary.main',
                        },
                        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: errors.materialCode ? 'error.main' : 'primary.main',
                          borderWidth: '2px',
                        },
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={2}>
                    <TextField
                      fullWidth
                      label="Material Quantity"
                      type="number"
                      value={group.materialQnty}
                      onChange={(e) => updateFurnitureGroup(index, 'materialQnty', parseFloat(e.target.value) || 0)}
                      inputProps={{ min: 0, step: 0.1 }}
                      placeholder="Qty"
                      error={!!errors.materialQnty}
                      helperText={errors.materialQnty}
                      sx={{
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderWidth: '2px',
                          borderColor: errors.materialQnty ? 'error.main' : 'grey.300',
                          borderRadius: 2,
                        },
                        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: errors.materialQnty ? 'error.main' : 'primary.main',
                        },
                        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: errors.materialQnty ? 'error.main' : 'primary.main',
                          borderWidth: '2px',
                        },
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={2}>
                    <TextField
                      fullWidth
                      label="Material Price"
                      type="number"
                      value={group.materialPrice}
                      onChange={(e) => updateFurnitureGroup(index, 'materialPrice', parseFloat(e.target.value) || 0)}
                      inputProps={{ min: 0, step: 0.01 }}
                      placeholder="Price"
                      error={!!errors.materialPrice}
                      helperText={errors.materialPrice}
                      sx={{
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderWidth: '2px',
                          borderColor: errors.materialPrice ? 'error.main' : 'grey.300',
                          borderRadius: 2,
                        },
                        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: errors.materialPrice ? 'error.main' : 'primary.main',
                        },
                        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: errors.materialPrice ? 'error.main' : 'primary.main',
                          borderWidth: '2px',
                        },
                      }}
                    />
                  </Grid>
                </Grid>
              )}
            </Card>

            {/* Toggle 3: Labour */}
            <Card sx={{ mb: 3, p: 2, backgroundColor: '#f8f9fa' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={toggles.labour}
                    onChange={(e) => onToggleChange('labour', e.target.checked)}
                  />
                }
                label="Labour"
              />
              
              {toggles.labour && (
                <Grid container spacing={2} sx={{ mt: 2 }}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Labour Work Price"
                      type="number"
                      value={group.labourPrice}
                      onChange={(e) => updateFurnitureGroup(index, 'labourPrice', parseFloat(e.target.value) || 0)}
                      inputProps={{ min: 0, step: 0.01 }}
                      placeholder="Labour price"
                      error={!!errors.labourPrice}
                      helperText={errors.labourPrice}
                      sx={{
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderWidth: '2px',
                          borderColor: errors.labourPrice ? 'error.main' : 'grey.300',
                          borderRadius: 2,
                        },
                        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: errors.labourPrice ? 'error.main' : 'primary.main',
                        },
                        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: errors.labourPrice ? 'error.main' : 'primary.main',
                          borderWidth: '2px',
                        },
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Labour Note"
                      value={group.labourNote}
                      onChange={(e) => updateFurnitureGroup(index, 'labourNote', e.target.value)}
                      placeholder="Labour notes"
                      sx={{
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderWidth: '2px',
                          borderColor: 'grey.300',
                          borderRadius: 2,
                        },
                        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'primary.main',
                        },
                        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'primary.main',
                          borderWidth: '2px',
                        },
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Labour Quantity"
                      type="number"
                      value={group.labourQnty}
                      onChange={(e) => updateFurnitureGroup(index, 'labourQnty', parseFloat(e.target.value) || 0)}
                      inputProps={{ min: 0, step: 0.1 }}
                      placeholder="Qty"
                      error={!!errors.labourQnty}
                      helperText={errors.labourQnty}
                      sx={{
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderWidth: '2px',
                          borderColor: errors.labourQnty ? 'error.main' : 'grey.300',
                          borderRadius: 2,
                        },
                        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: errors.labourQnty ? 'error.main' : 'primary.main',
                        },
                        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: errors.labourQnty ? 'error.main' : 'primary.main',
                          borderWidth: '2px',
                        },
                      }}
                    />
                  </Grid>
                </Grid>
              )}
            </Card>

            {/* Toggle 4: Foam */}
            <Card sx={{ mb: 3, p: 2, backgroundColor: '#f8f9fa' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={toggles.foam}
                    onChange={(e) => onToggleChange('foam', e.target.checked)}
                  />
                }
                label="Foam"
              />
              
              {toggles.foam && (
                <Grid container spacing={2} sx={{ mt: 2 }}>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      label="Foam Price"
                      type="number"
                      value={group.foamPrice}
                      onChange={(e) => updateFurnitureGroup(index, 'foamPrice', parseFloat(e.target.value) || 0)}
                      inputProps={{ min: 0, step: 0.01 }}
                      placeholder="Foam price"
                      error={!!errors.foamPrice}
                      helperText={errors.foamPrice}
                      sx={{
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderWidth: '2px',
                          borderColor: errors.foamPrice ? 'error.main' : 'grey.300',
                          borderRadius: 2,
                        },
                        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: errors.foamPrice ? 'error.main' : 'primary.main',
                        },
                        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: errors.foamPrice ? 'error.main' : 'primary.main',
                          borderWidth: '2px',
                        },
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      label="Foam Thickness"
                      value={group.foamThickness}
                      onChange={(e) => updateFurnitureGroup(index, 'foamThickness', e.target.value)}
                      placeholder="Thickness"
                      sx={{
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderWidth: '2px',
                          borderColor: 'grey.300',
                          borderRadius: 2,
                        },
                        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'primary.main',
                        },
                        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'primary.main',
                          borderWidth: '2px',
                        },
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      label="Foam Note"
                      value={group.foamNote}
                      onChange={(e) => updateFurnitureGroup(index, 'foamNote', e.target.value)}
                      placeholder="Foam notes"
                      sx={{
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderWidth: '2px',
                          borderColor: 'grey.300',
                          borderRadius: 2,
                        },
                        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'primary.main',
                        },
                        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'primary.main',
                          borderWidth: '2px',
                        },
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      label="Foam Quantity"
                      type="number"
                      value={group.foamQnty}
                      onChange={(e) => updateFurnitureGroup(index, 'foamQnty', parseFloat(e.target.value) || 0)}
                      inputProps={{ min: 0, step: 0.1 }}
                      placeholder="Qty"
                      error={!!errors.foamQnty}
                      helperText={errors.foamQnty}
                      sx={{
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderWidth: '2px',
                          borderColor: errors.foamQnty ? 'error.main' : 'grey.300',
                          borderRadius: 2,
                        },
                        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: errors.foamQnty ? 'error.main' : 'primary.main',
                        },
                        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: errors.foamQnty ? 'error.main' : 'primary.main',
                          borderWidth: '2px',
                        },
                      }}
                    />
                  </Grid>
                </Grid>
              )}
            </Card>

            {/* Toggle 4: Customer Note */}
            <Card sx={{ mb: 3, p: 2, backgroundColor: '#f8f9fa' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={toggles.customerNote}
                    onChange={(e) => onToggleChange('customerNote', e.target.checked)}
                  />
                }
                label="Customer Note"
              />
              
              {toggles.customerNote && (
                <TextField
                  fullWidth
                  label="Customer Note"
                  multiline
                  rows={3}
                  value={group.customerNote}
                  onChange={(e) => updateFurnitureGroup(index, 'customerNote', e.target.value)}
                  placeholder="Enter customer notes for this furniture item"
                  sx={{ mt: 2 }}
                  sx={{
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderWidth: '2px',
                      borderColor: 'grey.300',
                      borderRadius: 2,
                    },
                    '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'primary.main',
                    },
                    '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'primary.main',
                      borderWidth: '2px',
                    },
                  }}
                />
              )}
            </Card>

            {index < data.furnitureData.groups.length - 1 && <Divider sx={{ mt: 3 }} />}
          </CardContent>
        </Card>
      ))}

      {/* Add Furniture Group Button */}
      <Box sx={{ mb: 3 }}>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={addFurnitureGroup}
        >
          Add Furniture Group
        </Button>
      </Box>

      {/* Payment Section - Always shown */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Payment Details
          </Typography>
          
          {/* Required Deposit Amount */}
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              label="Required Deposit Amount"
              type="number"
              value={data.paymentData.deposit}
              onChange={(e) => handlePaymentChange('deposit', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
              inputProps={{ min: 0, step: 0.01 }}
              placeholder="Enter required deposit amount"
              helperText="Amount the customer needs to pay"
              sx={{
                '& .MuiOutlinedInput-notchedOutline': {
                  borderWidth: '2px',
                  borderColor: 'grey.300',
                  borderRadius: 2,
                },
                '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                },
                '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                  borderWidth: '2px',
                },
              }}
            />
          </Box>

          {/* Amount Paid */}
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              label="Amount Paid by Customer"
              type="number"
              value={data.paymentData.amountPaid}
              onChange={(e) => handlePaymentChange('amountPaid', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
              inputProps={{ min: 0, step: 0.01 }}
              placeholder="Enter amount actually paid"
              helperText="Amount the customer has actually paid"
              sx={{
                '& .MuiOutlinedInput-notchedOutline': {
                  borderWidth: '2px',
                  borderColor: 'grey.300',
                  borderRadius: 2,
                },
                '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                },
                '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                  borderWidth: '2px',
                },
              }}
            />
          </Box>

          {/* Toggle 5: Pickup & Delivery */}
          <Box sx={{ mb: 3 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={toggles.pickupDelivery}
                  onChange={(e) => onToggleChange('pickupDelivery', e.target.checked)}
                />
              }
              label="Enable Pickup & Delivery"
            />
          </Box>

          {/* Pickup & Delivery Cost */}
          {toggles.pickupDelivery && (
            <Box sx={{ mb: 3 }}>
              <TextField
                fullWidth
                label="Pickup & Delivery Cost"
                type="number"
                value={data.paymentData.pickupDeliveryCost}
                onChange={(e) => handlePaymentChange('pickupDeliveryCost', parseFloat(e.target.value) || 0)}
                error={!!errors.pickupDeliveryCost}
                helperText={errors.pickupDeliveryCost}
                inputProps={{ min: 0, step: 0.01 }}
                placeholder="Enter pickup & delivery cost"
                sx={{
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderWidth: '2px',
                    borderColor: errors.pickupDeliveryCost ? 'error.main' : 'grey.300',
                    borderRadius: 2,
                  },
                  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: errors.pickupDeliveryCost ? 'error.main' : 'primary.main',
                  },
                  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: errors.pickupDeliveryCost ? 'error.main' : 'primary.main',
                    borderWidth: '2px',
                  },
                }}
              />
            </Box>
          )}

          {/* Additional Notes */}
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              label="Additional Notes"
              multiline
              rows={4}
              value={data.paymentData.notes}
              onChange={(e) => handlePaymentChange('notes', e.target.value)}
              placeholder="Enter any additional notes or special instructions"
              sx={{
                '& .MuiOutlinedInput-notchedOutline': {
                  borderWidth: '2px',
                  borderColor: 'grey.300',
                  borderRadius: 2,
                },
                '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                },
                '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                  borderWidth: '2px',
                },
              }}
            />
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default FastOrderStep2; 