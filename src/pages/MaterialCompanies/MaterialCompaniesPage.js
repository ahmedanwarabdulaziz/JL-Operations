import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Typography,
  Chip,
  Alert,
  Snackbar,
  CircularProgress,
  Tooltip,
  Fab,
  Grid,
  TableSortLabel,
  Card,
  CardContent,
  InputAdornment,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  DragIndicator as DragIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Web as WebIcon,
  Percent as PercentIcon,
  LocationOn as LocationIcon,
  Notes as NotesIcon
} from '@mui/icons-material';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, orderBy, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase/config';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const MaterialCompaniesPage = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [viewingCompany, setViewingCompany] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'asc' });
  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    website: '',
    taxRate: 13,
    notes: ''
  });

  // Form validation
  const [errors, setErrors] = useState({});

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const companiesRef = collection(db, 'materialCompanies');
      const q = query(companiesRef, orderBy('createdAt', 'asc'));
      const querySnapshot = await getDocs(q);
      const companiesData = querySnapshot.docs.map((doc, index) => ({
        id: doc.id,
        order: doc.data().order ?? index, // Use existing order or fallback to index
        ...doc.data()
      }));
      // Keep companies in chronological order (order they were added)
      setCompanies(companiesData);
    } catch (error) {
      console.error('Error fetching companies:', error);
      showSnackbar('Error fetching companies', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Sorting functions
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedCompanies = () => {
    // If default sorting is applied, maintain the chronological order (order added)
    if (sortConfig.key === 'createdAt' && sortConfig.direction === 'asc') {
      return companies; // Return companies in their current order (chronological order)
    }
    
        const sortedCompanies = [...companies].sort((a, b) => {
      let aValue = a[sortConfig.key] || '';
      let bValue = b[sortConfig.key] || '';
    
      // Handle date fields (createdAt, updatedAt)
      if (sortConfig.key === 'createdAt' || sortConfig.key === 'updatedAt') {
        aValue = aValue.seconds ? new Date(aValue.seconds * 1000) : new Date(aValue);
        bValue = bValue.seconds ? new Date(bValue.seconds * 1000) : new Date(bValue);
      } else if (typeof aValue === 'string') {
        // Convert to lowercase for string comparison
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
    return sortedCompanies;
  };

  // Drag and drop functions
  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = companies.findIndex(company => company.id === active.id);
      const newIndex = companies.findIndex(company => company.id === over.id);
      
      const newCompanies = arrayMove(companies, oldIndex, newIndex);
      
      // Update order numbers for all companies
      const updatedCompanies = newCompanies.map((company, index) => ({
        ...company,
        order: index
      }));
      
      setCompanies(updatedCompanies);
      
      // Update order in Firebase
      try {
        const batch = writeBatch(db);
        updatedCompanies.forEach((company) => {
          const docRef = doc(db, 'materialCompanies', company.id);
          batch.update(docRef, { order: company.order });
        });
        await batch.commit();
        showSnackbar('Order updated successfully!');
      } catch (error) {
        console.error('Error updating order:', error);
        showSnackbar('Error updating order', 'error');
        // Revert to original order if update fails
        fetchCompanies();
      }
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Company name is required';
    }
    
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (formData.phone && !/^[\+]?[1-9][\d]{0,15}$/.test(formData.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleOpenDialog = (company = null) => {
    if (company) {
      setEditingCompany(company);
      setFormData({
        name: company.name || '',
        contactPerson: company.contactPerson || '',
        phone: company.phone || '',
        email: company.email || '',
        address: company.address || '',
        website: company.website || '',
        taxRate: company.taxRate || 13,
        notes: company.notes || ''
      });
    } else {
      setEditingCompany(null);
      setFormData({
        name: '',
        contactPerson: '',
        phone: '',
        email: '',
        address: '',
        website: '',
        taxRate: 13,
        notes: ''
      });
    }
    setErrors({});
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingCompany(null);
    setFormData({
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      website: '',
      taxRate: 13,
      notes: ''
    });
    setErrors({});
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      const companyData = {
        ...formData,
        updatedAt: new Date()
      };

      if (editingCompany) {
        await updateDoc(doc(db, 'materialCompanies', editingCompany.id), companyData);
        showSnackbar('Company updated successfully!');
      } else {
        companyData.createdAt = new Date();
        await addDoc(collection(db, 'materialCompanies'), companyData);
        showSnackbar('Company added successfully!');
      }

      handleCloseDialog();
      fetchCompanies();
    } catch (error) {
      console.error('Error saving company:', error);
      showSnackbar('Error saving company', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (company) => {
    if (window.confirm(`Are you sure you want to delete "${company.name}"?`)) {
      try {
        setLoading(true);
        await deleteDoc(doc(db, 'materialCompanies', company.id));
        showSnackbar('Company deleted successfully!');
        fetchCompanies();
      } catch (error) {
        console.error('Error deleting company:', error);
        showSnackbar('Error deleting company', 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleView = (company) => {
    setViewingCompany(company);
  };

  const handleCloseView = () => {
    setViewingCompany(null);
  };

  // Sortable Row Component
  const SortableTableRow = ({ company, children }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: company.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <TableRow
        ref={setNodeRef}
        style={style}
        hover
        sx={{
          cursor: 'grab',
          '&:active': {
            cursor: 'grabbing'
          }
        }}
      >
        {React.Children.map(children, (child, index) => {
          if (index === 0) {
            return React.cloneElement(child, {
              ...attributes,
              ...listeners,
            });
          }
          return child;
        })}
      </TableRow>
    );
  };

  if (loading && companies.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: '#274290' }}>
            Material Companies
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Click column headers to sort • Drag rows to reorder
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{ 
            minWidth: 150,
            px: 3,
            backgroundColor: '#274290',
            '&:hover': {
              backgroundColor: '#1e2d5a'
            }
          }}
        >
          Add Company
        </Button>
      </Box>

      <Paper elevation={2}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <TableContainer>
            <Table>
              <TableHead sx={{ backgroundColor: '#274290' }}>
                <TableRow>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>
                    <TableSortLabel
                      active={sortConfig.key === 'name'}
                      direction={sortConfig.key === 'name' ? sortConfig.direction : 'asc'}
                      onClick={() => handleSort('name')}
                      sx={{ 
                        color: 'white !important',
                        '& .MuiTableSortLabel-icon': {
                          color: 'white !important'
                        }
                      }}
                    >
                      Company Name
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>
                    <TableSortLabel
                      active={sortConfig.key === 'contactPerson'}
                      direction={sortConfig.key === 'contactPerson' ? sortConfig.direction : 'asc'}
                      onClick={() => handleSort('contactPerson')}
                      sx={{ 
                        color: 'white !important',
                        '& .MuiTableSortLabel-icon': {
                          color: 'white !important'
                        }
                      }}
                    >
                      Contact Person
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>
                    <TableSortLabel
                      active={sortConfig.key === 'phone'}
                      direction={sortConfig.key === 'phone' ? sortConfig.direction : 'asc'}
                      onClick={() => handleSort('phone')}
                      sx={{ 
                        color: 'white !important',
                        '& .MuiTableSortLabel-icon': {
                          color: 'white !important'
                        }
                      }}
                    >
                      Phone
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>
                    <TableSortLabel
                      active={sortConfig.key === 'email'}
                      direction={sortConfig.key === 'email' ? sortConfig.direction : 'asc'}
                      onClick={() => handleSort('email')}
                      sx={{ 
                        color: 'white !important',
                        '& .MuiTableSortLabel-icon': {
                          color: 'white !important'
                        }
                      }}
                    >
                      Email
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>
                    <TableSortLabel
                      active={sortConfig.key === 'website'}
                      direction={sortConfig.key === 'website' ? sortConfig.direction : 'asc'}
                      onClick={() => handleSort('website')}
                      sx={{ 
                        color: 'white !important',
                        '& .MuiTableSortLabel-icon': {
                          color: 'white !important'
                        }
                      }}
                    >
                      Website
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>
                    <TableSortLabel
                      active={sortConfig.key === 'taxRate'}
                      direction={sortConfig.key === 'taxRate' ? sortConfig.direction : 'asc'}
                      onClick={() => handleSort('taxRate')}
                      sx={{ 
                        color: 'white !important',
                        '& .MuiTableSortLabel-icon': {
                          color: 'white !important'
                        }
                      }}
                    >
                      Tax Rate
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>
                    <TableSortLabel
                      active={sortConfig.key === 'createdAt'}
                      direction={sortConfig.key === 'createdAt' ? sortConfig.direction : 'asc'}
                      onClick={() => handleSort('createdAt')}
                      sx={{ 
                        color: 'white !important',
                        '& .MuiTableSortLabel-icon': {
                          color: 'white !important'
                        }
                      }}
                    >
                      Date Added
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <SortableContext
                items={getSortedCompanies().map(company => company.id)}
                strategy={verticalListSortingStrategy}
              >
                <TableBody>
                  {getSortedCompanies().map((company) => (
                    <SortableTableRow key={company.id} company={company}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <DragIcon 
                            sx={{ 
                              color: 'text.secondary', 
                              fontSize: 16,
                              cursor: 'grab',
                              '&:active': { cursor: 'grabbing' }
                            }} 
                          />
                          <Typography variant="subtitle2" fontWeight="medium">
                            {company.name}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>{company.contactPerson || '-'}</TableCell>
                      <TableCell>{company.phone || '-'}</TableCell>
                      <TableCell>{company.email || '-'}</TableCell>
                      <TableCell>
                        {company.website ? (
                          <a href={company.website} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                            {company.website}
                          </a>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={company.taxRate ? `${company.taxRate}%` : '13%'}
                          size="small"
                          color={company.taxRate === 2 ? 'warning' : company.taxRate === 13 ? 'primary' : 'default'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        {company.createdAt ? (
                          <Typography variant="body2" color="text.secondary">
                            {company.createdAt.seconds 
                              ? new Date(company.createdAt.seconds * 1000).toLocaleDateString()
                              : new Date(company.createdAt).toLocaleDateString()
                            }
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">-</Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Box display="flex" gap={1} justifyContent="center">
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={() => handleView(company)}
                              color="primary"
                            >
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenDialog(company)}
                              color="primary"
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              onClick={() => handleDelete(company)}
                              color="error"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </SortableTableRow>
                  ))}
                </TableBody>
              </SortableContext>
            </Table>
          </TableContainer>
        </DndContext>
      </Paper>

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
            <BusinessIcon />
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              {editingCompany ? 'Edit Material Company' : 'Add New Material Company'}
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
              {/* Company Information Section */}
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
                      Company Information
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Company Name"
                          value={formData.name}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          error={!!errors.name}
                          helperText={errors.name}
                          required
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
                                <BusinessIcon sx={{ color: '#274290' }} />
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Tax Rate (%)"
                          type="number"
                          value={formData.taxRate || 13}
                          onChange={(e) => handleInputChange('taxRate', e.target.value)}
                          inputProps={{ min: 0, max: 100, step: 0.01 }}
                          helperText="Default: 13% (Charlotte: 2%)"
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
                                <PercentIcon sx={{ color: '#274290' }} />
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Website"
                          value={formData.website}
                          onChange={(e) => handleInputChange('website', e.target.value)}
                          placeholder="https://company-website.com"
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
                                <WebIcon sx={{ color: '#274290' }} />
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              {/* Contact Information Section */}
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
                      <PersonIcon sx={{ fontSize: 20 }} />
                      Contact Information
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Contact Person"
                          value={formData.contactPerson}
                          onChange={(e) => handleInputChange('contactPerson', e.target.value)}
                          placeholder="John Smith"
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
                                <PersonIcon sx={{ color: '#274290' }} />
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Phone"
                          value={formData.phone}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                          error={!!errors.phone}
                          helperText={errors.phone}
                          placeholder="+1 (555) 123-4567"
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
                                <PhoneIcon sx={{ color: '#274290' }} />
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          error={!!errors.email}
                          helperText={errors.email}
                          placeholder="contact@company.com"
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
                                <EmailIcon sx={{ color: '#274290' }} />
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              {/* Address & Notes Section */}
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
                      <LocationIcon sx={{ fontSize: 20 }} />
                      Address & Additional Information
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Address"
                          value={formData.address}
                          onChange={(e) => handleInputChange('address', e.target.value)}
                          multiline
                          rows={2}
                          placeholder="123 Business Street, City, State, ZIP"
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
                                <LocationIcon sx={{ color: '#274290' }} />
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Notes"
                          value={formData.notes}
                          onChange={(e) => handleInputChange('notes', e.target.value)}
                          multiline
                          rows={3}
                          placeholder="Additional notes about this company..."
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
                                <NotesIcon sx={{ color: '#274290' }} />
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
            disabled={loading || !formData.name.trim()}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
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
            {loading ? 'Saving...' : (editingCompany ? 'Update Company' : 'Add Company')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewingCompany} onClose={handleCloseView} maxWidth="md" fullWidth>
        {viewingCompany && (
          <>
            <DialogTitle>
              <Typography variant="h6">{viewingCompany.name}</Typography>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 2 }}>
                <Box display="grid" gridTemplateColumns="1fr 1fr" gap={3}>
                  <Box>
                    <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                      Contact Person
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {viewingCompany.contactPerson || 'Not specified'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                      Phone
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {viewingCompany.phone || 'Not specified'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                      Email
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {viewingCompany.email || 'Not specified'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                      Website
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {viewingCompany.website ? (
                        <a href={viewingCompany.website} target="_blank" rel="noopener noreferrer">
                          {viewingCompany.website}
                        </a>
                      ) : 'Not specified'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                      Tax Rate
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {viewingCompany.taxRate ? `${viewingCompany.taxRate}%` : '13% (default)'}
                    </Typography>
                  </Box>
                </Box>
                {viewingCompany.address && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                      Address
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {viewingCompany.address}
                    </Typography>
                  </Box>
                )}
                {viewingCompany.notes && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                      Notes
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {viewingCompany.notes}
                    </Typography>
                  </Box>
                )}
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                    Created
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {viewingCompany.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}
                  </Typography>
                </Box>
                {viewingCompany.updatedAt && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                      Last Updated
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {viewingCompany.updatedAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}
                    </Typography>
                  </Box>
                )}
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseView}>Close</Button>
              <Button
                onClick={() => {
                  handleCloseView();
                  handleOpenDialog(viewingCompany);
                }}
                variant="contained"
              >
                Edit
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MaterialCompaniesPage; 