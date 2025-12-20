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
  Divider,
  Card,
  CardContent,
  InputAdornment,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Link as LinkIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  Category as CategoryIcon
} from '@mui/icons-material';
import { useNotification } from '../../shared/components/Common/NotificationSystem';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, query } from 'firebase/firestore';
import { db } from '../../firebase/config';


const TreatmentPage = () => {
  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState(null);
  const [formData, setFormData] = useState({
    treatmentKind: '',
    urlPageLink: ''
  });
  const [saving, setSaving] = useState(false);
  const { showSuccess, showError } = useNotification();


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
        urlPageLink: treatment.urlPageLink || ''
      });
    } else {
      setEditingTreatment(null);
      setFormData({
        treatmentKind: '',
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
          urlPageLink: formData.urlPageLink.trim(),
          updatedAt: new Date().toISOString()
        });
        showSuccess('Treatment updated successfully!');
      } else {
        // Add new treatment
        await addDoc(collection(db, 'treatments'), {
          treatmentKind: formData.treatmentKind.trim(),
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
        <CircularProgress size={60} sx={{ color: '#b98f33' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
          Treatment Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon sx={{ color: '#000000' }} />}
          onClick={() => handleOpenDialog()}
          sx={{ 
            px: 3,
            background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
            color: '#000000',
            border: '3px solid #4CAF50',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.3)',
            position: 'relative',
            '&:hover': {
              background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
              border: '3px solid #45a049',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.3), 0 6px 12px rgba(0,0,0,0.4)'
            },
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '50%',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
              borderRadius: '6px 6px 0 0',
              pointerEvents: 'none'
            }
          }}
        >
          Add Treatment
        </Button>
      </Box>

      {treatments.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', backgroundColor: 'background.paper' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No treatments found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Get started by adding your first treatment
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon sx={{ color: '#000000' }} />}
            onClick={() => handleOpenDialog()}
            sx={{
              background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
              color: '#000000',
              border: '3px solid #4CAF50',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.3)',
              position: 'relative',
              '&:hover': {
                background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
                border: '3px solid #45a049',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.3), 0 6px 12px rgba(0,0,0,0.4)'
              },
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '50%',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
                borderRadius: '6px 6px 0 0',
                pointerEvents: 'none'
              }
            }}
          >
            Add First Treatment
          </Button>
        </Paper>
      ) : (
        <TableContainer component={Paper} sx={{ boxShadow: 2 }}>
          <Table>
            <TableHead sx={{ backgroundColor: '#b98f33' }}>
              <TableRow>
                <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Treatment Kind</TableCell>
                <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Website Link</TableCell>
                <TableCell sx={{ color: '#000000', fontWeight: 'bold' }} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {treatments.map((treatment) => (
                <TableRow key={treatment.id} sx={{ '&:hover': { backgroundColor: '#2a2a2a' } }}>
                  <TableCell>
                    <Typography variant="body1" sx={{ fontWeight: 500, color: '#b98f33' }}>
                      {treatment.treatmentKind}
                    </Typography>
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
                            color: '#b98f33',
                            '&:hover': { 
                              backgroundColor: '#2a2a2a' 
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
                            color: '#f44336',
                            '&:hover': { 
                              backgroundColor: '#2a2a2a' 
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
            backgroundColor: '#b98f33',
            color: '#000000',
            py: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CategoryIcon sx={{ color: '#000000' }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#000000' }}>
              {editingTreatment ? 'Edit Treatment' : 'Add New Treatment'}
            </Typography>
          </Box>
          <IconButton 
            onClick={handleCloseDialog}
            sx={{ 
              color: '#000000',
              '&:hover': { 
                backgroundColor: 'rgba(0,0,0,0.1)' 
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
                    border: '2px solid #b98f33',
                    borderRadius: 2
                  }}
                >
                  <CardContent sx={{ pb: '16px !important' }}>
                    <Typography 
                      variant="subtitle1" 
                      sx={{ 
                        mb: 2, 
                        fontWeight: 600,
                        color: '#b98f33',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                      }}
                    >
                      <CategoryIcon sx={{ fontSize: 20, color: '#b98f33' }} />
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
                            borderColor: '#b98f33',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#b98f33',
                          },
                        },
                        '& .MuiInputLabel-root.Mui-focused': {
                          color: '#b98f33',
                        },
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <CategoryIcon sx={{ color: '#b98f33' }} />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </CardContent>
                </Card>
              </Grid>
              

              
              {/* Website Link Section */}
              <Grid item xs={12}>
                <Card 
                  variant="outlined" 
                  sx={{ 
                    border: '2px solid #b98f33',
                    borderRadius: 2
                  }}
                >
                  <CardContent sx={{ pb: '16px !important' }}>
                    <Typography 
                      variant="subtitle1" 
                      sx={{ 
                        mb: 2, 
                        fontWeight: 600,
                        color: '#b98f33',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                      }}
                    >
                      <LinkIcon sx={{ fontSize: 20, color: '#b98f33' }} />
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
                            borderColor: '#b98f33',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#b98f33',
                          },
                        },
                        '& .MuiInputLabel-root.Mui-focused': {
                          color: '#b98f33',
                        },
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LinkIcon sx={{ color: '#b98f33' }} />
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
            backgroundColor: 'background.paper',
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
            startIcon={saving ? <CircularProgress size={16} sx={{ color: '#000000' }} /> : <SaveIcon sx={{ color: '#000000' }} />}
            sx={{
              background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
              color: '#000000',
              border: '3px solid #4CAF50',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.3)',
              position: 'relative',
              px: 4,
              '&:hover': {
                background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
                border: '3px solid #45a049',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.3), 0 6px 12px rgba(0,0,0,0.4)'
              },
              '&:disabled': {
                background: 'linear-gradient(145deg, #a0a0a0 0%, #808080 50%, #606060 100%)',
                border: '3px solid #666666',
                color: '#666666',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.2)'
              },
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '50%',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
                borderRadius: '6px 6px 0 0',
                pointerEvents: 'none'
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