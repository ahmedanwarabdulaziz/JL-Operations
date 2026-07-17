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
  Collapse,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Tooltip,
  Alert,
  Snackbar,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
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
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  PersonAdd as PersonAddIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Receipt as ReceiptIcon,
} from '@mui/icons-material';
import { collection, getDocs, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useNavigate } from 'react-router-dom';
import CorporateCustomerDialog from '../../components/CorporateCustomers/CorporateCustomerDialog';

const CorporateCustomersPage = () => {
  const navigate = useNavigate();
  const [corporateCustomers, setCorporateCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [contactPersonDialogOpen, setContactPersonDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editingContactPerson, setEditingContactPerson] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });
  const [expandedRows, setExpandedRows] = useState({});

  const toggleRowExpanded = (customerId) => {
    setExpandedRows((prev) => ({ ...prev, [customerId]: !prev[customerId] }));
  };

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
        <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 2 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: 'rgba(212, 175, 90, 0.08)' }}>
                <TableCell sx={{ width: 48 }} />
                <TableCell sx={{ fontWeight: 'bold', color: '#b98f33' }}>Company</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: '#b98f33' }}>Primary Contact</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: '#b98f33' }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: '#b98f33' }}>Phone</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: '#b98f33' }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {corporateCustomers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: '#999999', fontStyle: 'italic' }}>
                    No corporate customers yet
                  </TableCell>
                </TableRow>
              )}
              {corporateCustomers.map((customer) => {
                const contactPersons = customer.contactPersons || [];
                const primaryContact = contactPersons.find(cp => cp.isPrimary) || contactPersons[0] || null;
                const otherContacts = contactPersons.filter(cp => cp.id !== primaryContact?.id);
                const isExpanded = Boolean(expandedRows[customer.id]);
                const hasExpandableContent = otherContacts.length > 0 || Boolean(customer.address);

                return (
                  <React.Fragment key={customer.id}>
                    <TableRow
                      hover
                      sx={{ '& > *': { borderBottom: isExpanded ? 'unset' : undefined } }}
                    >
                      <TableCell>
                        {hasExpandableContent && (
                          <IconButton size="small" onClick={() => toggleRowExpanded(customer.id)}>
                            {isExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                          </IconButton>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                          {customer.corporateName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {primaryContact ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <PersonIcon sx={{ fontSize: 16, color: '#d4af5a' }} />
                            <Typography variant="body2">{primaryContact.name}</Typography>
                            {primaryContact.isPrimary && (
                              <Chip
                                label="Primary"
                                size="small"
                                sx={{
                                  backgroundColor: '#d4af5a',
                                  color: '#000000',
                                  fontSize: '0.7rem',
                                  height: '20px',
                                  fontWeight: 'bold'
                                }}
                              />
                            )}
                          </Box>
                        ) : (
                          <Typography variant="body2" sx={{ color: '#999999', fontStyle: 'italic' }}>
                            No contact person
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {primaryContact?.email || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {primaryContact?.phone || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                          <Tooltip title="View Invoices">
                            <IconButton
                              size="small"
                              onClick={() => navigate(`/admin/corporate-customers/${customer.id}/invoices`)}
                              sx={{ color: '#d4af5a' }}
                            >
                              <ReceiptIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Add Contact Person">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenContactPersonDialog(customer)}
                              sx={{ color: '#d4af5a' }}
                            >
                              <PersonAddIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <IconButton
                            size="small"
                            onClick={(e) => handleMenuClick(e, customer)}
                            sx={{ color: '#d4af5a' }}
                          >
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                    {hasExpandableContent && (
                      <TableRow>
                        <TableCell sx={{ py: 0 }} colSpan={6}>
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            <Box sx={{ py: 2, px: 2 }}>
                              {customer.address && (
                                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: otherContacts.length > 0 ? 2 : 0 }}>
                                  <LocationIcon sx={{ fontSize: 16, color: 'text.secondary', mt: 0.3 }} />
                                  <Typography variant="body2" color="text.secondary">
                                    {customer.address}
                                  </Typography>
                                </Box>
                              )}
                              {otherContacts.length > 0 && (
                                <>
                                  <Typography variant="body2" sx={{ color: '#d4af5a', fontWeight: 'bold', mb: 1 }}>
                                    Other Contacts ({otherContacts.length})
                                  </Typography>
                                  <List dense sx={{ py: 0 }}>
                                    {otherContacts.map((contactPerson) => (
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
                                </>
                              )}
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
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
