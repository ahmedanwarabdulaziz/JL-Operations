import React, { useState } from 'react';
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

const materialCompanies = [
  'Company A',
  'Company B', 
  'Company C',
  'Company D',
  'Company E',
  'Other'
];

const Step3Furniture = ({ furnitureData, onFurnitureChange }) => {
  const [furnitureGroups, setFurnitureGroups] = useState(furnitureData?.groups || []);

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
      foamThickness: '',
      foamNote: '',
      foamQnty: 1,
      customerNote: ''
    };
    
    const updatedGroups = [...furnitureGroups, newGroup];
    setFurnitureGroups(updatedGroups);
    onFurnitureChange({ groups: updatedGroups });
  };

  const removeFurnitureGroup = (groupId) => {
    const updatedGroups = furnitureGroups.filter(group => group.id !== groupId);
    setFurnitureGroups(updatedGroups);
    onFurnitureChange({ groups: updatedGroups });
  };

  const updateFurnitureGroup = (groupId, field, value) => {
    const updatedGroups = furnitureGroups.map(group => 
      group.id === groupId ? { ...group, [field]: value } : group
    );
    setFurnitureGroups(updatedGroups);
    onFurnitureChange({ groups: updatedGroups });
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Furniture Details
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Add furniture groups with material details, labour work, and optional foam specifications.
      </Typography>

      {/* Furniture Groups */}
      {furnitureGroups.map((group, index) => (
        <Card key={group.id} sx={{ mb: 3, p: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Furniture Group {index + 1}
              </Typography>
              <IconButton 
                onClick={() => removeFurnitureGroup(group.id)}
                color="error"
                size="small"
              >
                <DeleteIcon />
              </IconButton>
            </Box>

            {/* Furniture Type */}
            <Grid container spacing={3} sx={{ mb: 2 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Furniture Type"
                  value={group.furnitureType}
                  onChange={(e) => updateFurnitureGroup(group.id, 'furnitureType', e.target.value)}
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

            {/* Material Details Row */}
            <Grid container spacing={3} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={3}>
                <FormControl fullWidth>
                  <Select
                    value={group.materialCompany}
                    onChange={(e) => updateFurnitureGroup(group.id, 'materialCompany', e.target.value)}
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
                      Material Company
                    </MenuItem>
                    {materialCompanies.map((company) => (
                      <MenuItem key={company} value={company}>
                        {company}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth
                  label="Material Code"
                  value={group.materialCode}
                  onChange={(e) => updateFurnitureGroup(group.id, 'materialCode', e.target.value)}
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
                  label="Material Quantity"
                  type="number"
                  value={group.materialQnty}
                  onChange={(e) => updateFurnitureGroup(group.id, 'materialQnty', parseFloat(e.target.value) || 0)}
                  inputProps={{ min: 0, step: 0.1 }}
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
                  label="Material Price"
                  type="number"
                  value={group.materialPrice}
                  onChange={(e) => updateFurnitureGroup(group.id, 'materialPrice', parseFloat(e.target.value) || 0)}
                  inputProps={{ min: 0, step: 0.01 }}
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
            <Grid container spacing={3} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Labour Work Price"
                  type="number"
                  value={group.labourPrice}
                  onChange={(e) => updateFurnitureGroup(group.id, 'labourPrice', parseFloat(e.target.value) || 0)}
                  inputProps={{ min: 0, step: 0.01 }}
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
                  onChange={(e) => updateFurnitureGroup(group.id, 'labourNote', e.target.value)}
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
                  onChange={(e) => updateFurnitureGroup(group.id, 'labourQnty', parseFloat(e.target.value) || 0)}
                  inputProps={{ min: 0, step: 0.1 }}
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
                    checked={group.foamEnabled}
                    onChange={(e) => updateFurnitureGroup(group.id, 'foamEnabled', e.target.checked)}
                  />
                }
                label="Enable Foam"
              />
            </Box>

            {/* Foam Details Row */}
            {group.foamEnabled && (
              <>
                <Grid container spacing={3} sx={{ mb: 2 }}>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      label="Foam Price"
                      type="number"
                      value={group.foamPrice}
                      onChange={(e) => updateFurnitureGroup(group.id, 'foamPrice', parseFloat(e.target.value) || 0)}
                      inputProps={{ min: 0, step: 0.01 }}
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
                      onChange={(e) => updateFurnitureGroup(group.id, 'foamThickness', e.target.value)}
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
                      onChange={(e) => updateFurnitureGroup(group.id, 'foamNote', e.target.value)}
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
                      onChange={(e) => updateFurnitureGroup(group.id, 'foamQnty', parseFloat(e.target.value) || 0)}
                      inputProps={{ min: 0, step: 0.1 }}
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
              </>
            )}

            {/* Customer Note */}
            <TextField
              fullWidth
              label="Customer Note"
              multiline
              rows={3}
              value={group.customerNote}
              onChange={(e) => updateFurnitureGroup(group.id, 'customerNote', e.target.value)}
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

            {index < furnitureGroups.length - 1 && <Divider sx={{ mt: 2 }} />}
          </CardContent>
        </Card>
      ))}

      {/* Add Furniture Group Button */}
      <Box sx={{ mb: 3 }}>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={addFurnitureGroup}
          fullWidth
        >
          Add Furniture Group
        </Button>
      </Box>
    </Box>
  );
};

export default Step3Furniture; 