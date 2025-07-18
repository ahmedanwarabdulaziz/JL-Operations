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
  Card,
  CardContent,
  InputAdornment,
  Divider,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  Public as PlatformIcon,
  Description as DescriptionIcon
} from '@mui/icons-material';
import { useNotification } from '../../components/Common/NotificationSystem';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, query } from 'firebase/firestore';
import { db } from '../../firebase/config';

const PlatformsPage = () => {
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  const [saving, setSaving] = useState(false);
  const { showSuccess, showError } = useNotification();

  // Fetch platforms from Firebase
  const fetchPlatforms = useCallback(async () => {
    try {
      setLoading(true);
      const platformsRef = collection(db, 'platforms');
      const platformsQuery = query(platformsRef, orderBy('createdAt', 'asc'));
      const platformsSnapshot = await getDocs(platformsQuery);
      const platformsData = platformsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPlatforms(platformsData);
    } catch (error) {
      console.error('Error fetching platforms:', error);
      showError(`Failed to fetch platforms: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchPlatforms();
  }, [fetchPlatforms]);

  const handleOpenDialog = (platform = null) => {
    if (platform) {
      setEditingPlatform(platform);
      setFormData({
        name: platform.name || '',
        description: platform.description || ''
      });
    } else {
      setEditingPlatform(null);
      setFormData({
        name: '',
        description: ''
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingPlatform(null);
    setFormData({
      name: '',
      description: ''
    });
  };

  const handleInputChange = (field) => (event) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      showError('Platform name is required');
      return;
    }

    try {
      setSaving(true);
      if (editingPlatform) {
        // Update existing platform
        const platformRef = doc(db, 'platforms', editingPlatform.id);
        await updateDoc(platformRef, {
          name: formData.name.trim(),
          description: formData.description.trim(),
          updatedAt: new Date().toISOString()
        });
        showSuccess('Platform updated successfully!');
      } else {
        // Add new platform
        await addDoc(collection(db, 'platforms'), {
          name: formData.name.trim(),
          description: formData.description.trim(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        showSuccess('Platform added successfully!');
      }
      
      handleCloseDialog();
      fetchPlatforms();
    } catch (error) {
      console.error('Error saving platform:', error);
      showError(`Failed to save platform: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (platform) => {
    if (window.confirm(`Are you sure you want to delete "${platform.name}"?`)) {
      try {
        await deleteDoc(doc(db, 'platforms', platform.id));
        showSuccess('Platform deleted successfully!');
        fetchPlatforms();
      } catch (error) {
        console.error('Error deleting platform:', error);
        showError(`Failed to delete platform: ${error.message}`);
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
          Platform Management
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
          Add Platform
        </Button>
      </Box>

      {platforms.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', backgroundColor: '#f5f5f5' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No platforms found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Get started by adding your first platform
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
            Add First Platform
          </Button>
        </Paper>
      ) : (
        <TableContainer component={Paper} sx={{ boxShadow: 2 }}>
          <Table>
            <TableHead sx={{ backgroundColor: '#274290' }}>
              <TableRow>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Platform Name</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Description</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Date Added</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {platforms.map((platform) => (
                <TableRow key={platform.id} sx={{ '&:hover': { backgroundColor: '#f5f5f5' } }}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PlatformIcon sx={{ color: '#274290', fontSize: 20 }} />
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {platform.name}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {platform.description || 'No description'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {platform.createdAt ? (
                      <Typography variant="body2" color="text.secondary">
                        {new Date(platform.createdAt).toLocaleDateString()}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">-</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="Edit Platform">
                        <IconButton
                          color="primary"
                          onClick={() => handleOpenDialog(platform)}
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
                      <Tooltip title="Delete Platform">
                        <IconButton
                          color="error"
                          onClick={() => handleDelete(platform)}
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
        maxWidth="sm" 
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
            <PlatformIcon />
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              {editingPlatform ? 'Edit Platform' : 'Add New Platform'}
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
              {/* Platform Information Section */}
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
                      <PlatformIcon sx={{ fontSize: 20 }} />
                      Platform Information
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Platform Name"
                          value={formData.name}
                          onChange={handleInputChange('name')}
                          required
                          placeholder="e.g., Facebook, Instagram, Website"
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
                                <PlatformIcon sx={{ color: '#274290' }} />
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Description"
                          value={formData.description}
                          onChange={handleInputChange('description')}
                          placeholder="Optional description for this platform"
                          multiline
                          rows={3}
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
                              <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1 }}>
                                <DescriptionIcon sx={{ color: '#274290' }} />
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>
                    </Grid>
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
            disabled={saving || !formData.name.trim()}
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
            {saving ? 'Saving...' : (editingPlatform ? 'Update Platform' : 'Add Platform')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PlatformsPage; 