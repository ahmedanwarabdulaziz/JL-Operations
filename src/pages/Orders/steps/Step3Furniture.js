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
  Divider
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import useMaterialCompanies from '../../../hooks/useMaterialCompanies';

const Step3Furniture = ({ 
  furnitureGroups, 
  onFurnitureChange, 
  formErrors = {}, 
  setFormErrors 
}) => {
  const { companies: materialCompanies, loading: companiesLoading } = useMaterialCompanies();

  // Auto-select functionality
  const handleFocus = useCallback((event) => {
    event.target.select();
  }, []);
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
      paintingEnabled: false,
      paintingLabour: '',
      paintingNote: '',
      paintingQnty: 1,
      customerNote: ''
    };
    
    onFurnitureChange([...furnitureGroups, newGroup]);
  };

  const removeFurnitureGroup = (index) => {
    const updatedGroups = furnitureGroups.filter((_, i) => i !== index);
    onFurnitureChange(updatedGroups);
  };

  const updateFurnitureGroup = (index, field, value) => {
    const updatedGroups = furnitureGroups.map((group, i) => 
      i === index ? { ...group, [field]: value } : group
    );
    onFurnitureChange(updatedGroups);
    
    // Clear error when user starts typing
    if (formErrors[`furniture_${index}_type`]) {
      setFormErrors(prev => ({ ...prev, [`furniture_${index}_type`]: '' }));
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Furniture Details
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Add furniture groups with material details, labour work, and optional foam specifications.
      </Typography>

      {/* Furniture Groups */}
      {furnitureGroups.map((group, index) => (
        <Card key={group.id || index} sx={{ mb: 3, p: 2 }}>
          <CardContent sx={{ p: 0 }}>
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

            {/* Furniture Type */}
            <Box sx={{ mb: 3 }}>
              <TextField
                fullWidth
                label="Furniture Type *"
                value={group.furnitureType}
                onChange={(e) => updateFurnitureGroup(index, 'furnitureType', e.target.value)}
                onFocus={handleFocus}
                error={!!formErrors[`furniture_${index}_type`]}
                helperText={formErrors[`furniture_${index}_type`]}
                placeholder="Enter furniture type"
                required
                sx={{
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderWidth: '2px',
                    borderColor: formErrors[`furniture_${index}_type`] ? 'error.main' : 'grey.300',
                    borderRadius: 2,
                  },
                  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: formErrors[`furniture_${index}_type`] ? 'error.main' : 'primary.main',
                  },
                  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: formErrors[`furniture_${index}_type`] ? 'error.main' : 'primary.main',
                    borderWidth: '2px',
                  },
                }}
              />
            </Box>

            {/* Material Details Row */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <Select
                    value={group.materialCompany}
                    onChange={(e) => updateFurnitureGroup(index, 'materialCompany', e.target.value)}
                    displayEmpty
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
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={2}>
                <TextField
                  fullWidth
                  label="Material Code"
                  value={group.materialCode}
                  onChange={(e) => updateFurnitureGroup(index, 'materialCode', e.target.value)}
                  onFocus={handleFocus}
                  placeholder="Enter material code"
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
              <Grid item xs={12} sm={2}>
                <TextField
                  fullWidth
                  label="Material Quantity"
                  type="number"
                  value={group.materialQnty}
                  onChange={(e) => updateFurnitureGroup(index, 'materialQnty', parseFloat(e.target.value) || 0)}
                  onFocus={handleFocus}
                  inputProps={{ min: 0, step: 0.1 }}
                  placeholder="Qty"
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
              <Grid item xs={12} sm={2}>
                <TextField
                  fullWidth
                  label="Material Price"
                  type="number"
                  value={group.materialPrice}
                  onChange={(e) => updateFurnitureGroup(index, 'materialPrice', parseFloat(e.target.value) || 0)}
                  onFocus={handleFocus}
                  inputProps={{ min: 0, step: 0.01 }}
                  placeholder="Price"
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
            </Grid>

            {/* Labour Work Row */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Labour Work Price"
                  type="number"
                  value={group.labourPrice}
                  onChange={(e) => updateFurnitureGroup(index, 'labourPrice', parseFloat(e.target.value) || 0)}
                  onFocus={handleFocus}
                  inputProps={{ min: 0, step: 0.01 }}
                  placeholder="Labour price"
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
                  label="Labour Note"
                  value={group.labourNote}
                  onChange={(e) => updateFurnitureGroup(index, 'labourNote', e.target.value)}
                  onFocus={handleFocus}
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
                  onFocus={handleFocus}
                  inputProps={{ min: 0, step: 0.1 }}
                  placeholder="Qty"
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
            </Grid>

            {/* Foam Toggle */}
            <Box sx={{ mb: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(group.foamEnabled)}
                    onChange={(e) => {
                      const newValue = e.target.checked;
                      updateFurnitureGroup(index, 'foamEnabled', newValue);
                      // Set default foam quantity to 1 when enabled
                      if (newValue && (!group.foamQnty || group.foamQnty === 0)) {
                        updateFurnitureGroup(index, 'foamQnty', 1);
                      }
                    }}
                  />
                }
                label="Enable Foam"
              />
            </Box>

            {/* Foam Details Row */}
            {group.foamEnabled && (
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    label="Foam Price"
                    type="number"
                    value={group.foamPrice}
                    onChange={(e) => updateFurnitureGroup(index, 'foamPrice', parseFloat(e.target.value) || 0)}
                    onFocus={handleFocus}
                    inputProps={{ min: 0, step: 0.01 }}
                    placeholder="Foam price"
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
                    label="Foam Thickness"
                    value={group.foamThickness}
                    onChange={(e) => updateFurnitureGroup(index, 'foamThickness', e.target.value)}
                    onFocus={handleFocus}
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
                    onFocus={handleFocus}
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
                    onFocus={handleFocus}
                    inputProps={{ min: 0, step: 0.1 }}
                    placeholder="Qty"
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
              </Grid>
            )}

            {/* Painting Toggle */}
            <Box sx={{ mb: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(group.paintingEnabled)}
                    onChange={(e) => {
                      const newValue = e.target.checked;
                      updateFurnitureGroup(index, 'paintingEnabled', newValue);
                      // Set default painting quantity to 1 when enabled
                      if (newValue && (!group.paintingQnty || group.paintingQnty === 0)) {
                        updateFurnitureGroup(index, 'paintingQnty', 1);
                      }
                    }}
                  />
                }
                label="Enable Painting"
              />
            </Box>

            {/* Painting Details Row */}
            {group.paintingEnabled && (
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    label="Painting Labour"
                    type="number"
                    value={group.paintingLabour}
                    onChange={(e) => updateFurnitureGroup(index, 'paintingLabour', parseFloat(e.target.value) || 0)}
                    onFocus={handleFocus}
                    inputProps={{ min: 0, step: 0.01 }}
                    placeholder="Labour price"
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
                    label="Painting Note"
                    value={group.paintingNote}
                    onChange={(e) => updateFurnitureGroup(index, 'paintingNote', e.target.value)}
                    onFocus={handleFocus}
                    placeholder="Painting notes"
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
                    label="Painting Quantity"
                    type="number"
                    value={group.paintingQnty}
                    onChange={(e) => updateFurnitureGroup(index, 'paintingQnty', parseFloat(e.target.value) || 0)}
                    onFocus={handleFocus}
                    inputProps={{ min: 0, step: 0.1 }}
                    placeholder="Qty"
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
              </Grid>
            )}

            {/* Customer Note */}
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

            {index < furnitureGroups.length - 1 && <Divider sx={{ mt: 3 }} />}
          </CardContent>
        </Card>
      ))}

      {/* Add Furniture Group Button */}
      <Box sx={{ mb: 3 }}>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={addFurnitureGroup}
          sx={{
            borderColor: '#e0e0e0',
            color: '#666',
            '&:hover': {
              borderColor: '#bdbdbd',
              backgroundColor: '#f5f5f5'
            }
          }}
        >
          Add Furniture Group
        </Button>
      </Box>
    </Box>
  );
};

export default Step3Furniture; 