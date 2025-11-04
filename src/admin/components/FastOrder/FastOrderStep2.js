import React, { useCallback } from 'react';
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
import useMaterialCompanies from '../shared/hooks/useMaterialCompanies';
import { usePlatforms } from '../shared/hooks/usePlatforms';

const FastOrderStep2 = ({ 
  data, 
  onUpdate, 
  toggles, 
  onToggleChange, 
  errors = {} 
}) => {
  const { companies: materialCompanies, loading: companiesLoading } = useMaterialCompanies();
  const { platforms, loading: platformsLoading } = usePlatforms();

  // Auto-select functionality
  const handleFocus = useCallback((event) => {
    event.target.select();
  }, []);

  // Calculate pickup & delivery cost based on service type
  const calculatePickupDeliveryCost = (baseCost, serviceType) => {
    const cost = parseFloat(baseCost) || 0;
    switch (serviceType) {
      case 'pickup':
      case 'delivery':
        return cost; // Single service
      case 'both':
        return cost * 2; // Both services
      default:
        return cost;
    }
  };

  // Handle pickup & delivery service type change
  const handleServiceTypeChange = (serviceType) => {
    // Don't change the base cost in the field, just update service type
    handlePaymentChange('pickupDeliveryServiceType', serviceType);
  };

  // Handle pickup & delivery cost change
  const handlePickupDeliveryCostChange = (cost) => {
    // Store the base cost directly
    handlePaymentChange('pickupDeliveryCost', cost);
  };

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
      <Typography variant="h5" gutterBottom sx={{ color: '#b98f33', fontWeight: 'bold' }}>
        Order Details
      </Typography>
      <Typography variant="body2" sx={{ mb: 3, color: '#ffffff' }}>
        Configure order details with toggles for different sections
      </Typography>

      {/* Bill Invoice - Always shown */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="body2" sx={{ color: '#ffffff' }}>
            Bill number is automatically generated from the highest existing bill number (6 digits)
          </Typography>
          <Tooltip title="Refresh bill number">
            <Button
              size="small"
              startIcon={<RefreshIcon />}
              onClick={handleRefreshBillNumber}
              variant="outlined"
              sx={{ 
                minWidth: 'auto', 
                px: 1,
                borderColor: '#b98f33',
                color: '#b98f33',
                '&:hover': {
                  borderColor: '#d4af5a',
                  backgroundColor: 'rgba(185, 143, 51, 0.1)'
                }
              }}
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
            backgroundColor: '#2a2a2a',
            '& .MuiOutlinedInput-notchedOutline': {
              borderWidth: '2px',
              borderColor: errors.billInvoice ? 'error.main' : '#333333',
              borderRadius: 2,
            },
            '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: errors.billInvoice ? 'error.main' : '#b98f33',
            },
            '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: errors.billInvoice ? 'error.main' : '#b98f33',
              borderWidth: '2px',
            },
            '& .MuiInputLabel-root': {
              color: '#b98f33',
            },
            '& .MuiInputBase-input': {
              color: '#ffffff',
            },
          }}
        />
      </Box>

      {/* Toggle 1: Order Details */}
      <Card sx={{ 
        mb: 3, 
        backgroundColor: '#2a2a2a',
        border: '1px solid #333333',
        boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
        background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)'
      }}>
        <CardContent>
          <FormControlLabel
            control={
              <Switch
                checked={toggles.orderDetails}
                onChange={(e) => onToggleChange('orderDetails', e.target.checked)}
              />
            }
            label={<Typography sx={{ color: '#b98f33', fontWeight: 'bold' }}>Order Details</Typography>}
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
                  backgroundColor: '#2a2a2a',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderWidth: '2px',
                    borderColor: '#333333',
                    borderRadius: 2,
                  },
                  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#b98f33',
                  },
                  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#b98f33',
                    borderWidth: '2px',
                  },
                  '& .MuiInputLabel-root': {
                    color: '#b98f33',
                  },
                  '& .MuiInputBase-input': {
                    color: '#ffffff',
                  },
                }}
              />

              <FormControl fullWidth error={!!errors.platform}>
                <Select
                  value={data.orderDetails.platform}
                  onChange={(e) => handleOrderDetailsChange('platform', e.target.value)}
                  displayEmpty
                  sx={{
                    backgroundColor: '#2a2a2a',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderWidth: '2px',
                      borderColor: errors.platform ? 'error.main' : '#333333',
                      borderRadius: 2,
                    },
                    '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: errors.platform ? 'error.main' : '#b98f33',
                    },
                    '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: errors.platform ? 'error.main' : '#b98f33',
                      borderWidth: '2px',
                    },
                    '& .MuiSelect-select': {
                      color: '#ffffff',
                    },
                    '& .MuiSelect-icon': {
                      color: '#b98f33',
                    },
                  }}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        backgroundColor: '#2a2a2a',
                        '& .MuiMenuItem-root': {
                          color: '#ffffff',
                          '&:hover': {
                            backgroundColor: '#3a3a3a',
                          },
                        },
                      },
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
                  backgroundColor: '#2a2a2a',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderWidth: '2px',
                    borderColor: errors.startDate ? 'error.main' : '#333333',
                    borderRadius: 2,
                  },
                  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: errors.startDate ? 'error.main' : '#b98f33',
                  },
                  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: errors.startDate ? 'error.main' : '#b98f33',
                    borderWidth: '2px',
                  },
                  '& .MuiInputLabel-root': {
                    color: '#b98f33',
                  },
                  '& .MuiInputBase-input': {
                    color: '#ffffff',
                  },
                }}
              />

              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  fullWidth
                  label="Timeline"
                  value={data.orderDetails.timeline}
                  onChange={(e) => handleOrderDetailsChange('timeline', e.target.value)}
                  placeholder="e.g., 2 weeks, 1 month, etc."
                  sx={{
                    backgroundColor: '#2a2a2a',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderWidth: '2px',
                      borderColor: '#333333',
                      borderRadius: 2,
                    },
                    '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#b98f33',
                    },
                    '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#b98f33',
                      borderWidth: '2px',
                    },
                    '& .MuiInputLabel-root': {
                      color: '#b98f33',
                    },
                    '& .MuiInputBase-input': {
                      color: '#ffffff',
                    },
                  }}
                />
                <TextField
                  fullWidth
                  label="Deadline"
                  type="date"
                  value={data.orderDetails.deadline}
                  onChange={(e) => handleOrderDetailsChange('deadline', e.target.value)}
                  InputLabelProps={{
                    shrink: true,
                  }}
                  sx={{
                    backgroundColor: '#2a2a2a',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderWidth: '2px',
                      borderColor: '#333333',
                      borderRadius: 2,
                    },
                    '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#b98f33',
                    },
                    '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#b98f33',
                      borderWidth: '2px',
                    },
                    '& .MuiInputLabel-root': {
                      color: '#b98f33',
                    },
                    '& .MuiInputBase-input': {
                      color: '#ffffff',
                    },
                  }}
                />
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Furniture Groups - Furniture Type always shown */}
      {data.furnitureData.groups.map((group, index) => (
        <Card key={group.id || index} sx={{ 
          mb: 3, 
          backgroundColor: '#2a2a2a',
          border: '1px solid #333333',
          boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
          background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)'
        }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" sx={{ color: '#b98f33', fontWeight: 'bold' }}>
                Furniture Group {index + 1}
              </Typography>
              <IconButton 
                onClick={() => removeFurnitureGroup(index)}
                sx={{ color: '#ff6b6b' }}
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
                  backgroundColor: '#2a2a2a',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderWidth: '2px',
                    borderColor: '#333333',
                    borderRadius: 2,
                  },
                  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#b98f33',
                  },
                  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#b98f33',
                    borderWidth: '2px',
                  },
                  '& .MuiInputLabel-root': {
                    color: '#b98f33',
                  },
                  '& .MuiInputBase-input': {
                    color: '#ffffff',
                  },
                }}
              />
            </Box>

            {/* Toggle 2: Materials */}
            <Card sx={{ 
              mb: 3, 
              p: 2, 
              backgroundColor: '#2a2a2a',
              border: '1px solid #333333',
              boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
              background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)'
            }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={toggles.materials}
                    onChange={(e) => onToggleChange('materials', e.target.checked)}
                  />
                }
                label={<Typography sx={{ color: '#b98f33', fontWeight: 'bold' }}>Materials</Typography>}
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
                          backgroundColor: '#2a2a2a',
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderWidth: '2px',
                            borderColor: errors.materialCompany ? 'error.main' : '#333333',
                            borderRadius: 2,
                          },
                          '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: errors.materialCompany ? 'error.main' : '#b98f33',
                          },
                          '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            borderColor: errors.materialCompany ? 'error.main' : '#b98f33',
                            borderWidth: '2px',
                          },
                          '& .MuiSelect-select': {
                            color: '#ffffff',
                          },
                          '& .MuiSelect-icon': {
                            color: '#b98f33',
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
                        backgroundColor: '#2a2a2a',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderWidth: '2px',
                          borderColor: errors.materialCode ? 'error.main' : '#333333',
                          borderRadius: 2,
                        },
                        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: errors.materialCode ? 'error.main' : '#b98f33',
                        },
                        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: errors.materialCode ? 'error.main' : '#b98f33',
                          borderWidth: '2px',
                        },
                        '& .MuiInputLabel-root': {
                          color: '#b98f33',
                        },
                        '& .MuiInputBase-input': {
                          color: '#ffffff',
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
                        backgroundColor: '#2a2a2a',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderWidth: '2px',
                          borderColor: errors.materialQnty ? 'error.main' : '#333333',
                          borderRadius: 2,
                        },
                        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: errors.materialQnty ? 'error.main' : '#b98f33',
                        },
                        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: errors.materialQnty ? 'error.main' : '#b98f33',
                          borderWidth: '2px',
                        },
                        '& .MuiInputLabel-root': {
                          color: '#b98f33',
                        },
                        '& .MuiInputBase-input': {
                          color: '#ffffff',
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
                        backgroundColor: '#2a2a2a',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderWidth: '2px',
                          borderColor: errors.materialPrice ? 'error.main' : '#333333',
                          borderRadius: 2,
                        },
                        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: errors.materialPrice ? 'error.main' : '#b98f33',
                        },
                        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: errors.materialPrice ? 'error.main' : '#b98f33',
                          borderWidth: '2px',
                        },
                        '& .MuiInputLabel-root': {
                          color: '#b98f33',
                        },
                        '& .MuiInputBase-input': {
                          color: '#ffffff',
                        },
                      }}
                    />
                  </Grid>
                </Grid>
              )}
            </Card>

            {/* Toggle 3: Labour */}
            <Card sx={{ 
              mb: 3, 
              p: 2, 
              backgroundColor: '#2a2a2a',
              border: '1px solid #333333',
              boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
              background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)'
            }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={toggles.labour}
                    onChange={(e) => onToggleChange('labour', e.target.checked)}
                  />
                }
                label={<Typography sx={{ color: '#b98f33', fontWeight: 'bold' }}>Labour</Typography>}
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
                        backgroundColor: '#2a2a2a',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderWidth: '2px',
                          borderColor: errors.labourPrice ? 'error.main' : '#333333',
                          borderRadius: 2,
                        },
                        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: errors.labourPrice ? 'error.main' : '#b98f33',
                        },
                        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: errors.labourPrice ? 'error.main' : '#b98f33',
                          borderWidth: '2px',
                        },
                        '& .MuiInputLabel-root': {
                          color: '#b98f33',
                        },
                        '& .MuiInputBase-input': {
                          color: '#ffffff',
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
                        backgroundColor: '#2a2a2a',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderWidth: '2px',
                          borderColor: '#333333',
                          borderRadius: 2,
                        },
                        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#b98f33',
                        },
                        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#b98f33',
                          borderWidth: '2px',
                        },
                        '& .MuiInputLabel-root': {
                          color: '#b98f33',
                        },
                        '& .MuiInputBase-input': {
                          color: '#ffffff',
                        },
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Labour Quantity *"
                      type="number"
                      value={group.labourQnty}
                      onChange={(e) => updateFurnitureGroup(index, 'labourQnty', parseFloat(e.target.value) || 0)}
                      inputProps={{ min: 0, step: 0.1 }}
                      placeholder="Qty"
                      required
                      error={!!errors.labourQnty}
                      helperText={errors.labourQnty}
                      sx={{
                        backgroundColor: '#2a2a2a',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderWidth: '2px',
                          borderColor: errors.labourQnty ? 'error.main' : '#333333',
                          borderRadius: 2,
                        },
                        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: errors.labourQnty ? 'error.main' : '#b98f33',
                        },
                        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: errors.labourQnty ? 'error.main' : '#b98f33',
                          borderWidth: '2px',
                        },
                        '& .MuiInputLabel-root': {
                          color: '#b98f33',
                        },
                        '& .MuiInputBase-input': {
                          color: '#ffffff',
                        },
                      }}
                    />
                  </Grid>
                </Grid>
              )}
            </Card>

            {/* Toggle 4: Foam */}
            <Card sx={{ 
              mb: 3, 
              p: 2, 
              backgroundColor: '#2a2a2a',
              border: '1px solid #333333',
              boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
              background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)'
            }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={toggles.foam}
                    onChange={(e) => onToggleChange('foam', e.target.checked)}
                  />
                }
                label={<Typography sx={{ color: '#b98f33', fontWeight: 'bold' }}>Foam</Typography>}
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
                        backgroundColor: '#2a2a2a',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderWidth: '2px',
                          borderColor: errors.foamPrice ? 'error.main' : '#333333',
                          borderRadius: 2,
                        },
                        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: errors.foamPrice ? 'error.main' : '#b98f33',
                        },
                        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: errors.foamPrice ? 'error.main' : '#b98f33',
                          borderWidth: '2px',
                        },
                        '& .MuiInputLabel-root': {
                          color: '#b98f33',
                        },
                        '& .MuiInputBase-input': {
                          color: '#ffffff',
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
                        backgroundColor: '#2a2a2a',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderWidth: '2px',
                          borderColor: '#333333',
                          borderRadius: 2,
                        },
                        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#b98f33',
                        },
                        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#b98f33',
                          borderWidth: '2px',
                        },
                        '& .MuiInputLabel-root': {
                          color: '#b98f33',
                        },
                        '& .MuiInputBase-input': {
                          color: '#ffffff',
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
                        backgroundColor: '#2a2a2a',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderWidth: '2px',
                          borderColor: '#333333',
                          borderRadius: 2,
                        },
                        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#b98f33',
                        },
                        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#b98f33',
                          borderWidth: '2px',
                        },
                        '& .MuiInputLabel-root': {
                          color: '#b98f33',
                        },
                        '& .MuiInputBase-input': {
                          color: '#ffffff',
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
                        backgroundColor: '#2a2a2a',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderWidth: '2px',
                          borderColor: errors.foamQnty ? 'error.main' : '#333333',
                          borderRadius: 2,
                        },
                        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: errors.foamQnty ? 'error.main' : '#b98f33',
                        },
                        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: errors.foamQnty ? 'error.main' : '#b98f33',
                          borderWidth: '2px',
                        },
                        '& .MuiInputLabel-root': {
                          color: '#b98f33',
                        },
                        '& .MuiInputBase-input': {
                          color: '#ffffff',
                        },
                      }}
                    />
                  </Grid>
                </Grid>
              )}
            </Card>

            {/* Toggle 5: Painting */}
            <Card sx={{ 
              mb: 3, 
              p: 2, 
              backgroundColor: '#2a2a2a',
              border: '1px solid #333333',
              boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
              background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)'
            }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={toggles.painting}
                    onChange={(e) => {
                      const newValue = e.target.checked;
                      onToggleChange('painting', newValue);
                      // Set default painting quantity to 1 when enabled
                      if (newValue && !group.paintingQnty) {
                        updateFurnitureGroup(index, 'paintingQnty', 1);
                      }
                    }}
                  />
                }
                label={<Typography sx={{ color: '#b98f33', fontWeight: 'bold' }}>Painting</Typography>}
              />
              
              {toggles.painting && (
                <Grid container spacing={2} sx={{ mt: 2 }}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Painting Labour"
                      type="number"
                      value={group.paintingLabour}
                      onChange={(e) => updateFurnitureGroup(index, 'paintingLabour', parseFloat(e.target.value) || 0)}
                      inputProps={{ min: 0, step: 0.01 }}
                      placeholder="Labour price"
                      error={!!errors.paintingLabour}
                      helperText={errors.paintingLabour}
                      sx={{
                        backgroundColor: '#2a2a2a',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderWidth: '2px',
                          borderColor: errors.paintingLabour ? 'error.main' : '#333333',
                          borderRadius: 2,
                        },
                        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: errors.paintingLabour ? 'error.main' : '#b98f33',
                        },
                        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: errors.paintingLabour ? 'error.main' : '#b98f33',
                          borderWidth: '2px',
                        },
                        '& .MuiInputLabel-root': {
                          color: '#b98f33',
                        },
                        '& .MuiInputBase-input': {
                          color: '#ffffff',
                        },
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Painting Note"
                      value={group.paintingNote}
                      onChange={(e) => updateFurnitureGroup(index, 'paintingNote', e.target.value)}
                      placeholder="Painting notes"
                      sx={{
                        backgroundColor: '#2a2a2a',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderWidth: '2px',
                          borderColor: '#333333',
                          borderRadius: 2,
                        },
                        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#b98f33',
                        },
                        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#b98f33',
                          borderWidth: '2px',
                        },
                        '& .MuiInputLabel-root': {
                          color: '#b98f33',
                        },
                        '& .MuiInputBase-input': {
                          color: '#ffffff',
                        },
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Painting Quantity"
                      type="number"
                      value={group.paintingQnty}
                      onChange={(e) => updateFurnitureGroup(index, 'paintingQnty', parseFloat(e.target.value) || 0)}
                      inputProps={{ min: 0, step: 0.1 }}
                      placeholder="Qty"
                      error={!!errors.paintingQnty}
                      helperText={errors.paintingQnty}
                      sx={{
                        backgroundColor: '#2a2a2a',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderWidth: '2px',
                          borderColor: errors.paintingQnty ? 'error.main' : '#333333',
                          borderRadius: 2,
                        },
                        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: errors.paintingQnty ? 'error.main' : '#b98f33',
                        },
                        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: errors.paintingQnty ? 'error.main' : '#b98f33',
                          borderWidth: '2px',
                        },
                        '& .MuiInputLabel-root': {
                          color: '#b98f33',
                        },
                        '& .MuiInputBase-input': {
                          color: '#ffffff',
                        },
                      }}
                    />
                  </Grid>
                </Grid>
              )}
            </Card>

            {/* Toggle 6: Customer Note */}
            <Card sx={{ 
              mb: 3, 
              p: 2, 
              backgroundColor: '#2a2a2a',
              border: '1px solid #333333',
              boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
              background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)'
            }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={toggles.customerNote}
                    onChange={(e) => onToggleChange('customerNote', e.target.checked)}
                  />
                }
                label={<Typography sx={{ color: '#b98f33', fontWeight: 'bold' }}>Customer Note</Typography>}
              />
              
              {toggles.customerNote && (
                <TextField
                  fullWidth
                  label="Customer Note"
                  multiline
                  rows={3}
                  value={group.customerNote}
                  onChange={(e) => updateFurnitureGroup(index, 'customerNote', e.target.value)}
                  onFocus={handleFocus}
                  placeholder="Enter customer notes for this furniture item"
                  sx={{
                    mt: 2,
                    backgroundColor: '#2a2a2a',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderWidth: '2px',
                      borderColor: '#333333',
                      borderRadius: 2,
                    },
                    '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#b98f33',
                    },
                    '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#b98f33',
                      borderWidth: '2px',
                    },
                    '& .MuiInputLabel-root': {
                      color: '#b98f33',
                    },
                    '& .MuiInputBase-input': {
                      color: '#ffffff',
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
          variant="contained"
          startIcon={<AddIcon />}
          onClick={addFurnitureGroup}
          sx={{
            backgroundColor: '#b98f33',
            color: '#000000',
            border: '2px solid #8b6b1f',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            background: 'linear-gradient(135deg, #b98f33 0%, #d4af5a 100%)',
            '&:hover': {
              backgroundColor: '#d4af5a',
              transform: 'translateY(-1px)',
              boxShadow: '0 6px 12px rgba(0,0,0,0.4)',
            },
          }}
        >
          Add Furniture Group
        </Button>
      </Box>

      {/* Payment Section - Always shown */}
      <Card sx={{ 
        mb: 3, 
        backgroundColor: '#2a2a2a',
        border: '1px solid #333333',
        boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
        background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)'
      }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ color: '#b98f33', fontWeight: 'bold' }}>
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
              onFocus={handleFocus}
              inputProps={{ min: 0, step: 0.01 }}
              placeholder="Enter required deposit amount"
              helperText="Amount the customer needs to pay"
              sx={{
                backgroundColor: '#2a2a2a',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderWidth: '2px',
                  borderColor: '#333333',
                  borderRadius: 2,
                },
                '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#b98f33',
                },
                '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#b98f33',
                  borderWidth: '2px',
                },
                '& .MuiInputLabel-root': {
                  color: '#b98f33',
                },
                '& .MuiInputBase-input': {
                  color: '#ffffff',
                },
              }}
            />
          </Box>

          {/* Amount Paid Toggle */}
          <Box sx={{ mb: 3 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(data.paymentData.amountPaidEnabled)}
                  onChange={(e) => handlePaymentChange('amountPaidEnabled', e.target.checked)}
                />
              }
              label={<Typography sx={{ color: '#b98f33', fontWeight: 'bold' }}>Enable Amount Paid by Customer</Typography>}
            />
          </Box>

          {/* Amount Paid */}
          {data.paymentData.amountPaidEnabled && (
            <Box sx={{ mb: 3 }}>
              <TextField
                fullWidth
                label="Amount Paid by Customer"
                type="number"
                value={data.paymentData.amountPaid}
                onChange={(e) => handlePaymentChange('amountPaid', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                onFocus={handleFocus}
                inputProps={{ min: 0, step: 0.01 }}
                placeholder="Enter amount actually paid"
                helperText="Amount the customer has actually paid"
                sx={{
                  backgroundColor: '#2a2a2a',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderWidth: '2px',
                    borderColor: '#333333',
                    borderRadius: 2,
                  },
                  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#b98f33',
                  },
                  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#b98f33',
                    borderWidth: '2px',
                  },
                  '& .MuiInputLabel-root': {
                    color: '#b98f33',
                  },
                  '& .MuiInputBase-input': {
                    color: '#ffffff',
                  },
                }}
              />
            </Box>
          )}

          {/* Toggle 5: Pickup & Delivery */}
          <Box sx={{ mb: 3 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={toggles.pickupDelivery}
                  onChange={(e) => {
                    onToggleChange('pickupDelivery', e.target.checked);
                    // Also update the payment data to match the toggle
                    handlePaymentChange('pickupDeliveryEnabled', e.target.checked);
                  }}
                />
              }
              label={<Typography sx={{ color: '#b98f33', fontWeight: 'bold' }}>Enable Pickup & Delivery</Typography>}
            />
          </Box>

          {/* Pickup & Delivery Cost */}
          {toggles.pickupDelivery && (
            <Box sx={{ mb: 3 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <Select
                      value={data.paymentData.pickupDeliveryServiceType || 'both'}
                      onChange={(e) => handleServiceTypeChange(e.target.value)}
                      displayEmpty
                      sx={{
                        backgroundColor: '#2a2a2a',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderWidth: '2px',
                          borderColor: '#333333',
                          borderRadius: 2,
                        },
                        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#b98f33',
                        },
                        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#b98f33',
                          borderWidth: '2px',
                        },
                        '& .MuiSelect-select': {
                          color: '#ffffff',
                        },
                        '& .MuiSelect-icon': {
                          color: '#b98f33',
                        },
                      }}
                    >
                      <MenuItem value="pickup">🚚 Pickup Only</MenuItem>
                      <MenuItem value="delivery">🚚 Delivery Only</MenuItem>
                      <MenuItem value="both">🚚 Pickup & Delivery</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Service Cost"
                    type="number"
                    value={data.paymentData.pickupDeliveryCost || 0}
                    onChange={(e) => handlePickupDeliveryCostChange(parseFloat(e.target.value) || 0)}
                    onFocus={handleFocus}
                    error={!!errors.pickupDeliveryCost}
                    helperText={errors.pickupDeliveryCost || 
                      `Total: $${calculatePickupDeliveryCost(data.paymentData.pickupDeliveryCost || 0, data.paymentData.pickupDeliveryServiceType || 'both')} (${data.paymentData.pickupDeliveryServiceType === 'both' ? '2x service' : '1x service'})`}
                    inputProps={{ min: 0, step: 0.01 }}
                    placeholder="Enter service cost"
                    sx={{
                      backgroundColor: '#2a2a2a',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderWidth: '2px',
                        borderColor: errors.pickupDeliveryCost ? 'error.main' : '#333333',
                        borderRadius: 2,
                      },
                      '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: errors.pickupDeliveryCost ? 'error.main' : '#b98f33',
                      },
                      '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: errors.pickupDeliveryCost ? 'error.main' : '#b98f33',
                        borderWidth: '2px',
                      },
                      '& .MuiInputLabel-root': {
                        color: '#b98f33',
                      },
                      '& .MuiInputBase-input': {
                        color: '#ffffff',
                      },
                    }}
                  />
                </Grid>
              </Grid>
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
                backgroundColor: '#2a2a2a',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderWidth: '2px',
                  borderColor: '#333333',
                  borderRadius: 2,
                },
                '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#b98f33',
                },
                '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#b98f33',
                  borderWidth: '2px',
                },
                '& .MuiInputLabel-root': {
                  color: '#b98f33',
                },
                '& .MuiInputBase-input': {
                  color: '#ffffff',
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
