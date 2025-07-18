import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  CircularProgress,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Divider,
  Card,
  CardContent,
  InputAdornment,
  Tooltip,
  Fade
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Link as LinkIcon,
  Business as BusinessIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  Category as CategoryIcon
} from '@mui/icons-material';
import { useNotification } from '../../components/Common/NotificationSystem';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, query } from 'firebase/firestore';
import { db } from '../../firebase/config';
import useMaterialCompanies from '../../hooks/useMaterialCompanies';

const TreatmentPage = () => {
  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState(null);
  const [formData, setFormData] = useState({
    treatmentKind: '',
    materialCompanies: [],
    urlPageLink: ''
  });
  const [saving, setSaving] = useState(false);
  const { showSuccess, showError } = useNotification();
  const { companies: materialCompanies, loading: companiesLoading } = useMaterialCompanies();

  // Fetch treatments from Firebase
  const fetchTreatments = useCallback(async () => {
    try {
      setLoading(true);
      const treatmentsRef = collection(db, 'treatments');
      const treatmentsQuery = query(treatmentsRef, orderBy('treatmentKind'));
      const treatmentsSnapshot = await getDocs(treatmentsQuery);
      const treatmentsData = treatmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTreatments(treatmentsData);
    } catch (error) {
      console.error('Error fetching treatments:', error);
      showError(`Failed to fetch treatments: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchTreatments();
  }, [fetchTreatments]);

  const handleOpenDialog = (treatment = null) => {
    if (treatment) {
      setEditingTreatment(treatment);
      setFormData({
        treatmentKind: treatment.treatmentKind || '',
        materialCompanies: treatment.materialCompanies || [],
        urlPageLink: treatment.urlPageLink || ''
      });
    } else {
      setEditingTreatment(null);
      setFormData({
        treatmentKind: '',
        materialCompanies: [],
        urlPageLink: ''
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingTreatment(null);
    setFormData({
      treatmentKind: '',
      materialCompanies: [],
      urlPageLink: ''
    });
  };

  const handleInputChange = (field) => (event) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handleRemoveMaterialCompany = (company) => {
    setFormData(prev => ({
      ...prev,
      materialCompanies: prev.materialCompanies.filter(c => c !== company)
    }));
  };

  const handleSubmit = async () => {
    if (!formData.treatmentKind.trim()) {
      showError('Treatment kind is required');
      return;
    }

    try {
      setSaving(true);
      if (editingTreatment) {
        // Update existing treatment
        const treatmentRef = doc(db, 'treatments', editingTreatment.id);
        await updateDoc(treatmentRef, {
          treatmentKind: formData.treatmentKind.trim(),
          materialCompanies: formData.materialCompanies,
          urlPageLink: formData.urlPageLink.trim(),
          updatedAt: new Date().toISOString()
        });
        showSuccess('Treatment updated successfully!');
      } else {
        // Add new treatment
        await addDoc(collection(db, 'treatments'), {
          treatmentKind: formData.treatmentKind.trim(),
          materialCompanies: formData.materialCompanies,
          urlPageLink: formData.urlPageLink.trim(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        showSuccess('Treatment added successfully!');
      }
      
      handleCloseDialog();
      fetchTreatments();
    } catch (error) {
      console.error('Error saving treatment:', error);
      showError(`Failed to save treatment: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (treatment) => {
    if (window.confirm(`Are you sure you want to delete "${treatment.treatmentKind}"?`)) {
      try {
        await deleteDoc(doc(db, 'treatments', treatment.id));
        showSuccess('Treatment deleted successfully!');
        fetchTreatments();
      } catch (error) {
        console.error('Error deleting treatment:', error);
        showError(`Failed to delete treatment: ${error.message}`);
      }
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={60} sx={{ color: '#274290' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: '#274290' }}>
          Treatment Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{ 
            px: 3,
            backgroundColor: '#274290',
            '&:hover': {
              backgroundColor: '#1e2d5a'
            }
          }}
        >
          Add Treatment
        </Button>
      </Box>

      {treatments.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', backgroundColor: '#f5f5f5' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No treatments found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Get started by adding your first treatment
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            sx={{
              backgroundColor: '#274290',
              '&:hover': {
                backgroundColor: '#1e2d5a'
              }
            }}
          >
            Add First Treatment
          </Button>
        </Paper>
      ) : (
        <TableContainer component={Paper} sx={{ boxShadow: 2 }}>
          <Table>
            <TableHead sx={{ backgroundColor: '#274290' }}>
              <TableRow>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Treatment Kind</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Material Companies</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Website Link</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {treatments.map((treatment) => (
                <TableRow key={treatment.id} sx={{ '&:hover': { backgroundColor: '#f5f5f5' } }}>
                  <TableCell>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {treatment.treatmentKind}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {treatment.materialCompanies?.length > 0 ? (
                        treatment.materialCompanies.map((company, index) => (
                          <Chip
                            key={index}
                            label={company}
                            size="small"
                            sx={{
                              backgroundColor: '#e3f2fd',
                              color: '#274290',
                              border: '1px solid #bbdefb'
                            }}
                          />
                        ))
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No companies assigned
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {treatment.urlPageLink ? (
                      <Tooltip title="Open website">
                        <IconButton
                          href={treatment.urlPageLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ color: '#f27921' }}
                        >
                          <LinkIcon />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No link
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="Edit Treatment">
                        <IconButton
                          color="primary"
                          onClick={() => handleOpenDialog(treatment)}
                          size="small"
                          sx={{ 
                            '&:hover': { 
                              backgroundColor: '#e3f2fd' 
                            } 
                          }}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Treatment">
                        <IconButton
                          color="error"
                          onClick={() => handleDelete(treatment)}
                          size="small"
                          sx={{ 
                            '&:hover': { 
                              backgroundColor: '#ffebee' 
                            } 
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Enhanced Add/Edit Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={handleCloseDialog} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)'
          }
        }}
      >
        <DialogTitle 
          sx={{ 
            backgroundColor: '#274290',
            color: 'white',
            py: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CategoryIcon />
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              {editingTreatment ? 'Edit Treatment' : 'Add New Treatment'}
            </Typography>
          </Box>
          <IconButton 
            onClick={handleCloseDialog}
            sx={{ 
              color: 'white',
              '&:hover': { 
                backgroundColor: 'rgba(255,255,255,0.1)' 
              } 
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 0 }}>
          <Box sx={{ p: 3 }}>
            <Grid container spacing={3}>
              {/* Treatment Kind Section */}
              <Grid item xs={12}>
                <Card 
                  variant="outlined" 
                  sx={{ 
                    border: '2px solid #e3f2fd',
                    borderRadius: 2
                  }}
                >
                  <CardContent sx={{ pb: '16px !important' }}>
                    <Typography 
                      variant="subtitle1" 
                      sx={{ 
                        mb: 2, 
                        fontWeight: 600,
                        color: '#274290',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                      }}
                    >
                      <CategoryIcon sx={{ fontSize: 20 }} />
                      Treatment Information
                    </Typography>
                    <TextField
                      fullWidth
                      label="Treatment Kind"
                      value={formData.treatmentKind}
                      onChange={handleInputChange('treatmentKind')}
                      required
                      placeholder="e.g., Stain Protection, Water Repellent, Scotchgard"
                      variant="outlined"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          '&:hover fieldset': {
                            borderColor: '#274290',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#274290',
                          },
                        },
                        '& .MuiInputLabel-root.Mui-focused': {
                          color: '#274290',
                        },
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <CategoryIcon sx={{ color: '#274290' }} />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </CardContent>
                </Card>
              </Grid>
              
              {/* Material Companies Section */}
              <Grid item xs={12}>
                <Card 
                  variant="outlined" 
                  sx={{ 
                    border: '2px solid #e3f2fd',
                    borderRadius: 2
                  }}
                >
                  <CardContent sx={{ pb: '16px !important' }}>
                    <Typography 
                      variant="subtitle1" 
                      sx={{ 
                        mb: 2, 
                        fontWeight: 600,
                        color: '#274290',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                      }}
                    >
                      <BusinessIcon sx={{ fontSize: 20 }} />
                      Associated Material Companies
                    </Typography>
                    
                    <Box sx={{ mb: 2 }}>
                      <FormControl 
                        fullWidth
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            '&:hover fieldset': {
                              borderColor: '#274290',
                            },
                            '&.Mui-focused fieldset': {
                              borderColor: '#274290',
                            },
                          },
                          '& .MuiInputLabel-root.Mui-focused': {
                            color: '#274290',
                          },
                        }}
                      >
                        <InputLabel>Select Material Company</InputLabel>
                        <Select
                          value=""
                          onChange={(e) => {
                            const selectedCompany = e.target.value;
                            if (selectedCompany && !formData.materialCompanies.includes(selectedCompany)) {
                              setFormData(prev => ({
                                ...prev,
                                materialCompanies: [...prev.materialCompanies, selectedCompany]
                              }));
                            }
                          }}
                          label="Select Material Company"
                          disabled={companiesLoading}
                          startAdornment={
                            <InputAdornment position="start">
                              <BusinessIcon sx={{ color: '#274290' }} />
                            </InputAdornment>
                          }
                        >
                          {companiesLoading && (
                            <MenuItem value="" disabled>
                              Loading companies...
                            </MenuItem>
                          )}
                          {materialCompanies
                            .filter(company => !formData.materialCompanies.includes(company.name))
                            .map((company) => (
                              <MenuItem key={company.id} value={company.name}>
                                {company.name}
                              </MenuItem>
                            ))}
                        </Select>
                      </FormControl>
                    </Box>

                    {/* Selected Companies */}
                    {formData.materialCompanies.length > 0 ? (
                      <Box>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            mb: 1, 
                            fontWeight: 500,
                            color: '#274290'
                          }}
                        >
                          Selected Companies:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {formData.materialCompanies.map((company, index) => (
                            <Fade in={true} key={index}>
                              <Chip
                                label={company}
                                onDelete={() => handleRemoveMaterialCompany(company)}
                                sx={{
                                  backgroundColor: '#f27921',
                                  color: 'white',
                                  '& .MuiChip-deleteIcon': {
                                    color: 'white',
                                    '&:hover': {
                                      color: '#ffccbc'
                                    }
                                  }
                                }}
                              />
                            </Fade>
                          ))}
                        </Box>
                      </Box>
                    ) : (
                      <Box 
                        sx={{ 
                          p: 2, 
                          backgroundColor: '#f5f5f5', 
                          borderRadius: 1,
                          textAlign: 'center'
                        }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          No companies selected yet
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
              
              {/* Website Link Section */}
              <Grid item xs={12}>
                <Card 
                  variant="outlined" 
                  sx={{ 
                    border: '2px solid #e3f2fd',
                    borderRadius: 2
                  }}
                >
                  <CardContent sx={{ pb: '16px !important' }}>
                    <Typography 
                      variant="subtitle1" 
                      sx={{ 
                        mb: 2, 
                        fontWeight: 600,
                        color: '#274290',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                      }}
                    >
                      <LinkIcon sx={{ fontSize: 20 }} />
                      Website Information
                    </Typography>
                    <TextField
                      fullWidth
                      label="URL Page Link"
                      value={formData.urlPageLink}
                      onChange={handleInputChange('urlPageLink')}
                      placeholder="https://example.com/treatment-page"
                      helperText="Optional: Link to treatment information or product page"
                      variant="outlined"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          '&:hover fieldset': {
                            borderColor: '#274290',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#274290',
                          },
                        },
                        '& .MuiInputLabel-root.Mui-focused': {
                          color: '#274290',
                        },
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LinkIcon sx={{ color: '#274290' }} />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>

        <Divider />

        <DialogActions 
          sx={{ 
            p: 3, 
            backgroundColor: '#f8f9fa',
            gap: 2
          }}
        >
          <Button 
            onClick={handleCloseDialog}
            variant="outlined"
            sx={{
              borderColor: '#e0e0e0',
              color: '#666',
              '&:hover': {
                borderColor: '#bdbdbd',
                backgroundColor: '#f5f5f5'
              }
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained"
            disabled={saving || !formData.treatmentKind.trim()}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            sx={{
              backgroundColor: '#274290',
              px: 4,
              '&:hover': {
                backgroundColor: '#1e2d5a'
              },
              '&:disabled': {
                backgroundColor: '#e0e0e0'
              }
            }}
          >
            {saving ? 'Saving...' : (editingTreatment ? 'Update Treatment' : 'Add Treatment')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TreatmentPage; 