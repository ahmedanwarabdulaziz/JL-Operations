import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Card,
  CardContent,
  Chip,
  Tooltip,
  Alert,
  Snackbar,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemButton,
  ListItemText as MuiListItemText,
  ListItemSecondaryAction,
  IconButton as MuiIconButton,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  MoreVert as MoreVertIcon,
  ExpandMore as ExpandMoreIcon,
  PersonAdd as PersonAddIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { collection, getDocs, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import CorporateCustomerDialog from '../../components/CorporateCustomers/CorporateCustomerDialog';

const CorporateCustomersPage = () => {
  const [corporateCustomers, setCorporateCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [contactPersonDialogOpen, setContactPersonDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editingContactPerson, setEditingContactPerson] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });

  // Corporate Customer Form State
  // Contact Person Form State
  const [contactPersonForm, setContactPersonForm] = useState({
    name: '',
    email: '',
    phone: '',
    position: '',
    isPrimary: false
  });

  useEffect(() => {
    fetchCorporateCustomers();
  }, []);

  const fetchCorporateCustomers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'corporateCustomers'), orderBy('corporateName'));
      const querySnapshot = await getDocs(q);
      const customers = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCorporateCustomers(customers);
    } catch (error) {
      console.error('Error fetching corporate customers:', error);
      showNotification('Error fetching corporate customers', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message, severity = 'success') => {
    setNotification({ open: true, message, severity });
  };

  const handleCloseNotification = () => {
    setNotification(prev => ({ ...prev, open: false }));
  };

  const handleOpenDialog = (customer = null) => {
    setEditingCustomer(customer);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCustomer(null);
  };

  const handleCustomerSaved = (savedCustomer, { isUpdate }) => {
    setCorporateCustomers((prev) => {
      if (isUpdate) {
        return prev.map((customer) =>
          customer.id === savedCustomer.id ? { ...customer, ...savedCustomer } : customer
        );
      }
      return [...prev, savedCustomer];
    });
    fetchCorporateCustomers();
  };

  const handleDeleteCustomer = async (customerId) => {
    if (window.confirm('Are you sure you want to delete this corporate customer?')) {
      try {
        await deleteDoc(doc(db, 'corporateCustomers', customerId));
        showNotification('Corporate customer deleted successfully', 'success');
        fetchCorporateCustomers();
      } catch (error) {
        console.error('Error deleting corporate customer:', error);
        showNotification('Error deleting corporate customer', 'error');
      }
    }
  };

  const handleOpenContactPersonDialog = (customer, contactPerson = null) => {
    setSelectedCustomer(customer);
    if (contactPerson) {
      setEditingContactPerson(contactPerson);
      setContactPersonForm({
        name: contactPerson.name || '',
        email: contactPerson.email || '',
        phone: contactPerson.phone || '',
        position: contactPerson.position || '',
        isPrimary: contactPerson.isPrimary || false
      });
    } else {
      setEditingContactPerson(null);
      setContactPersonForm({
        name: '',
        email: '',
        phone: '',
        position: '',
        isPrimary: false
      });
    }
    setContactPersonDialogOpen(true);
  };

  const handleCloseContactPersonDialog = () => {
    setContactPersonDialogOpen(false);
    setSelectedCustomer(null);
    setEditingContactPerson(null);
    setContactPersonForm({
      name: '',
      email: '',
      phone: '',
      position: '',
      isPrimary: false
    });
  };

  const handleSaveContactPerson = async () => {
    if (!contactPersonForm.name.trim()) {
      showNotification('Contact person name is required', 'error');
      return;
    }

    try {
      const customerRef = doc(db, 'corporateCustomers', selectedCustomer.id);
      let updatedContactPersons = [...(selectedCustomer.contactPersons || [])];

      if (editingContactPerson) {
        // Update existing contact person
        const index = updatedContactPersons.findIndex(cp => cp.id === editingContactPerson.id);
        if (index !== -1) {
          updatedContactPersons[index] = {
            ...updatedContactPersons[index],
            ...contactPersonForm,
            id: editingContactPerson.id
          };
        }
      } else {
        // Add new contact person
        const newContactPerson = {
          ...contactPersonForm,
          id: Date.now().toString() // Simple ID generation
        };
        updatedContactPersons.push(newContactPerson);
      }

      await updateDoc(customerRef, {
        contactPersons: updatedContactPersons,
        updatedAt: new Date()
      });

      showNotification(
        editingContactPerson ? 'Contact person updated successfully' : 'Contact person added successfully',
        'success'
      );
      
      handleCloseContactPersonDialog();
      fetchCorporateCustomers();
    } catch (error) {
      console.error('Error saving contact person:', error);
      showNotification('Error saving contact person', 'error');
    }
  };

  const handleDeleteContactPerson = async (customerId, contactPersonId) => {
    if (window.confirm('Are you sure you want to delete this contact person?')) {
      try {
        const customer = corporateCustomers.find(c => c.id === customerId);
        const updatedContactPersons = customer.contactPersons.filter(cp => cp.id !== contactPersonId);
        
        const customerRef = doc(db, 'corporateCustomers', customerId);
        await updateDoc(customerRef, {
          contactPersons: updatedContactPersons,
          updatedAt: new Date()
        });

        showNotification('Contact person deleted successfully', 'success');
        fetchCorporateCustomers();
      } catch (error) {
        console.error('Error deleting contact person:', error);
        showNotification('Error deleting contact person', 'error');
      }
    }
  };

  const handleMenuClick = (event, customer) => {
    setAnchorEl(event.currentTarget);
    setSelectedCustomer(customer);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedCustomer(null);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
          Corporate Customers
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
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
            }
          }}
        >
          Add Corporate Customer
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress sx={{ color: '#d4af5a' }} />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {corporateCustomers.map((customer) => (
            <Grid item xs={12} md={6} lg={4} key={customer.id}>
              <Card sx={{ 
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 2,
                boxShadow: 2,
                '&:hover': {
                  boxShadow: 4
                }
              }}>
                <CardContent sx={{ flexGrow: 1, p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                      {customer.corporateName}
                    </Typography>
                    <IconButton
                      onClick={(e) => handleMenuClick(e, customer)}
                      sx={{ 
                        color: '#d4af5a',
                        backgroundColor: 'rgba(212, 175, 90, 0.1)',
                        border: '2px solid #d4af5a',
                        '&:hover': {
                          backgroundColor: 'rgba(212, 175, 90, 0.2)',
                          borderColor: '#b98f33',
                          boxShadow: '0 2px 4px rgba(212, 175, 90, 0.3)'
                        }
                      }}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <EmailIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="body2" color="text.secondary">
                        {customer.email}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <PhoneIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="body2" color="text.secondary">
                        {customer.phone}
                      </Typography>
                    </Box>
                    {customer.address && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                        <LocationIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                          {customer.address}
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {customer.contactPersons && customer.contactPersons.length > 0 && (
                    <Accordion sx={{ boxShadow: 'none', '&:before': { display: 'none' } }}>
                      <AccordionSummary
                        expandIcon={<ExpandMoreIcon sx={{ color: '#d4af5a' }} />}
                        sx={{ 
                          minHeight: 'auto',
                          '&.Mui-expanded': { minHeight: 'auto' },
                          '& .MuiAccordionSummary-content': { margin: '8px 0' }
                        }}
                      >
                        <Typography variant="body2" sx={{ color: '#d4af5a', fontWeight: 'bold' }}>
                          Contact Persons ({customer.contactPersons.length})
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails sx={{ pt: 0 }}>
                        <List dense>
                          {customer.contactPersons.map((contactPerson) => (
                            <ListItem key={contactPerson.id} sx={{ px: 0 }}>
                              <ListItemButton
                                onClick={() => handleOpenContactPersonDialog(customer, contactPerson)}
                                sx={{ 
                                  borderRadius: 1,
                                  '&:hover': { backgroundColor: '#f5f5f5' }
                                }}
                              >
                                <MuiListItemText
                                  primary={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                        {contactPerson.name}
                                      </Typography>
                                      {contactPerson.isPrimary && (
                                        <Chip 
                                          label="Primary" 
                                          size="small" 
                                          sx={{ 
                                            backgroundColor: '#d4af5a', 
                                            color: '#000000',
                                            fontSize: '0.7rem',
                                            height: '20px'
                                          }} 
                                        />
                                      )}
                                    </Box>
                                  }
                                  secondary={
                                    <Box>
                                      <Typography variant="caption" sx={{ color: '#666666' }}>
                                        {contactPerson.position}
                                      </Typography>
                                      <br />
                                      <Typography variant="caption" sx={{ color: '#666666' }}>
                                        {contactPerson.email} • {contactPerson.phone}
                                      </Typography>
                                    </Box>
                                  }
                                />
                              </ListItemButton>
                              <ListItemSecondaryAction>
                                <MuiIconButton
                                  edge="end"
                                  onClick={() => handleDeleteContactPerson(customer.id, contactPerson.id)}
                                  sx={{ color: '#ff4444' }}
                                  size="small"
                                >
                                  <DeleteIcon fontSize="small" />
                                </MuiIconButton>
                              </ListItemSecondaryAction>
                            </ListItem>
                          ))}
                        </List>
                        <Button
                          startIcon={<PersonAddIcon />}
                          onClick={() => handleOpenContactPersonDialog(customer)}
                          sx={{
                            mt: 1,
                            color: '#d4af5a',
                            borderColor: '#d4af5a',
                            '&:hover': {
                              backgroundColor: '#f5f5f5',
                              borderColor: '#b98f33'
                            }
                          }}
                          variant="outlined"
                          size="small"
                        >
                          Add Contact Person
                        </Button>
                      </AccordionDetails>
                    </Accordion>
                  )}

                  {(!customer.contactPersons || customer.contactPersons.length === 0) && (
                    <Button
                      startIcon={<PersonAddIcon />}
                      onClick={() => handleOpenContactPersonDialog(customer)}
                      sx={{
                        mt: 2,
                        color: '#d4af5a',
                        borderColor: '#d4af5a',
                        '&:hover': {
                          backgroundColor: '#f5f5f5',
                          borderColor: '#b98f33'
                        }
                      }}
                      variant="outlined"
                      size="small"
                      fullWidth
                    >
                      Add Contact Person
                    </Button>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <CorporateCustomerDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        customer={editingCustomer}
        onSaved={handleCustomerSaved}
        onSuccess={(message) => showNotification(message, 'success')}
        onError={(message) => showNotification(message, 'error')}
      />

      {/* Contact Person Dialog */}
      <Dialog open={contactPersonDialogOpen} onClose={handleCloseContactPersonDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ 
          background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
          color: '#000000',
          fontWeight: 'bold'
        }}>
          {editingContactPerson ? 'Edit Contact Person' : 'Add Contact Person'}
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              fullWidth
              label="Name"
              value={contactPersonForm.name}
              onChange={(e) => setContactPersonForm({ ...contactPersonForm, name: e.target.value })}
              required
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#d4af5a'
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#d4af5a',
                    borderWidth: 2
                  }
                },
                '& .MuiInputLabel-root': {
                  '&.Mui-focused': {
                    color: '#d4af5a'
                  }
                }
              }}
            />
            
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={contactPersonForm.email}
              onChange={(e) => setContactPersonForm({ ...contactPersonForm, email: e.target.value })}
              required
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#d4af5a'
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#d4af5a',
                    borderWidth: 2
                  }
                },
                '& .MuiInputLabel-root': {
                  '&.Mui-focused': {
                    color: '#d4af5a'
                  }
                }
              }}
            />
            
            <TextField
              fullWidth
              label="Phone"
              value={contactPersonForm.phone}
              onChange={(e) => setContactPersonForm({ ...contactPersonForm, phone: e.target.value })}
              required
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#d4af5a'
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#d4af5a',
                    borderWidth: 2
                  }
                },
                '& .MuiInputLabel-root': {
                  '&.Mui-focused': {
                    color: '#d4af5a'
                  }
                }
              }}
            />
            
            <TextField
              fullWidth
              label="Position"
              value={contactPersonForm.position}
              onChange={(e) => setContactPersonForm({ ...contactPersonForm, position: e.target.value })}
              placeholder="e.g., Manager, Director, CEO..."
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#d4af5a'
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#d4af5a',
                    borderWidth: 2
                  }
                },
                '& .MuiInputLabel-root': {
                  '&.Mui-focused': {
                    color: '#d4af5a'
                  }
                }
              }}
            />
            
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 2,
              p: 2,
              border: '2px solid #e0e0e0',
              borderRadius: 1,
              backgroundColor: '#f9f9f9',
              '&:hover': {
                borderColor: '#d4af5a',
                backgroundColor: '#f5f5f5'
              }
            }}>
              <input
                type="checkbox"
                checked={contactPersonForm.isPrimary}
                onChange={(e) => setContactPersonForm({ ...contactPersonForm, isPrimary: e.target.checked })}
                style={{
                  width: '18px',
                  height: '18px',
                  accentColor: '#d4af5a'
                }}
              />
              <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#333333' }}>
                Primary Contact Person
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleCloseContactPersonDialog} sx={{ color: '#666666' }}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveContactPerson}
            variant="contained"
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
              }
            }}
          >
            {editingContactPerson ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem 
          onClick={() => { handleOpenDialog(selectedCustomer); handleMenuClose(); }}
          sx={{
            '&:hover': {
              backgroundColor: 'rgba(212, 175, 90, 0.1)',
              '& .MuiListItemIcon-root': {
                color: '#b98f33'
              }
            }
          }}
        >
          <ListItemIcon>
            <EditIcon sx={{ color: '#d4af5a' }} />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem 
          onClick={() => { handleDeleteCustomer(selectedCustomer?.id); handleMenuClose(); }}
          sx={{
            '&:hover': {
              backgroundColor: 'rgba(255, 68, 68, 0.1)',
              '& .MuiListItemIcon-root': {
                color: '#ff2222'
              }
            }
          }}
        >
          <ListItemIcon>
            <DeleteIcon sx={{ color: '#ff4444' }} />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
      >
        <Alert 
          onClose={handleCloseNotification} 
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CorporateCustomersPage;
