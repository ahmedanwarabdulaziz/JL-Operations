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
import { useNotification } from '../shared/components/Common/NotificationSystem';
import { formatDate, formatDateOnly } from '../../../utils/dateUtils';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, query } from 'firebase/firestore';
import { db } from '../shared/firebase/config';

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
        <CircularProgress size={60} sx={{ color: '#b98f33' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
          Platform Management
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
          Add Platform
        </Button>
      </Box>

      {platforms.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', backgroundColor: 'background.paper' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No platforms found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Get started by adding your first platform
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
            Add First Platform
          </Button>
        </Paper>
      ) : (
        <TableContainer component={Paper} sx={{ boxShadow: 2 }}>
          <Table>
            <TableHead sx={{ backgroundColor: '#b98f33' }}>
              <TableRow>
                <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Platform Name</TableCell>
                <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Description</TableCell>
                <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Date Added</TableCell>
                <TableCell sx={{ color: '#000000', fontWeight: 'bold' }} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {platforms.map((platform) => (
                <TableRow key={platform.id} sx={{ '&:hover': { backgroundColor: '#2a2a2a' } }}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PlatformIcon sx={{ color: '#b98f33', fontSize: 20 }} />
                      <Typography variant="body1" sx={{ fontWeight: 500, color: '#b98f33' }}>
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
                    <Typography variant="body2" color="text.secondary">
                      {formatDateOnly(platform.createdAt)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="Edit Platform">
                        <IconButton
                          color="primary"
                          onClick={() => handleOpenDialog(platform)}
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
                      <Tooltip title="Delete Platform">
                        <IconButton
                          color="error"
                          onClick={() => handleDelete(platform)}
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
            backgroundColor: '#b98f33',
            color: '#000000',
            py: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <PlatformIcon sx={{ color: '#000000' }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#000000' }}>
              {editingPlatform ? 'Edit Platform' : 'Add New Platform'}
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
              {/* Platform Information Section */}
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
                      <PlatformIcon sx={{ fontSize: 20, color: '#b98f33' }} />
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
                                <PlatformIcon sx={{ color: '#b98f33' }} />
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
                              <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1 }}>
                                <DescriptionIcon sx={{ color: '#b98f33' }} />
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
            disabled={saving || !formData.name.trim()}
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
            {saving ? 'Saving...' : (editingPlatform ? 'Update Platform' : 'Add Platform')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PlatformsPage; 
