import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Card,
  CardContent,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Avatar,
} from '@mui/material';
import {
  Search as SearchIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  CorporateFare as CorporateFareIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { collection, getDocs, query, orderBy, addDoc } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useNotification } from '../../../shared/components/Common/NotificationSystem';
import { buttonStyles } from '../../../styles/buttonStyles';

const emptyContactPerson = { name: '', email: '', phone: '', position: '' };
const emptyTempCustomer = { corporateName: '', email: '', phone: '', address: '', contactPersons: [] };

const QuoteStep1Customer = ({
  quoteNumber,
  onQuoteNumberChange,
  selectedCustomer,
  isTemporaryCustomer,
  selectedContactPerson,
  onCustomerSelect,
  onContactPersonSelect,
}) => {
  const { showSuccess, showError } = useNotification();

  const [corporateCustomers, setCorporateCustomers] = useState([]);
  const [quoteCustomers, setQuoteCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState(0); // 0=Corporate, 1=Quote Customers

  // Contact person dialog
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [dialogCustomer, setDialogCustomer] = useState(null);
  const [dialogIsTemp, setDialogIsTemp] = useState(false);

  // Add new temp customer dialog
  const [newCustomerDialogOpen, setNewCustomerDialogOpen] = useState(false);
  const [tempCustomerForm, setTempCustomerForm] = useState(emptyTempCustomer);
  const [savingTempCustomer, setSavingTempCustomer] = useState(false);
  const [newContactForm, setNewContactForm] = useState(emptyContactPerson);

  // Add contact to existing customer (in contact dialog)
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [addContactForm, setAddContactForm] = useState(emptyContactPerson);

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoadingCustomers(true);
        const [corpSnap, quoteSnap] = await Promise.all([
          getDocs(query(collection(db, 'corporateCustomers'), orderBy('corporateName'))),
          getDocs(query(collection(db, 'quote-customers'), orderBy('corporateName'))),
        ]);
        setCorporateCustomers(corpSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setQuoteCustomers(quoteSnap.docs.map(d => ({ id: d.id, ...d.data(), _isQuoteCustomer: true })));
      } catch (e) {
        console.error(e);
        showError('Failed to load customers');
      } finally {
        setLoadingCustomers(false);
      }
    };
    fetch();
  }, []);

  const filtered = (list) => {
    if (!searchTerm.trim()) return list;
    const s = searchTerm.toLowerCase();
    return list.filter(c =>
      c.corporateName?.toLowerCase().includes(s) ||
      c.email?.toLowerCase().includes(s) ||
      c.phone?.includes(s)
    );
  };

  const handleCardClick = (customer, isTemp) => {
    setDialogCustomer(customer);
    setDialogIsTemp(isTemp || false);
    setContactDialogOpen(true);
  };

  const handleSelectContact = (contact) => {
    onCustomerSelect(dialogCustomer, dialogIsTemp);
    onContactPersonSelect(contact);
    setContactDialogOpen(false);
  };

  // ---- Temp customer form ----
  const handleTempFieldChange = (field, value) => {
    setTempCustomerForm(prev => ({ ...prev, [field]: value }));
  };

  const handleAddContactToTemp = () => {
    if (!newContactForm.name.trim()) {
      showError('Contact person name is required');
      return;
    }
    setTempCustomerForm(prev => ({
      ...prev,
      contactPersons: [...prev.contactPersons, { ...newContactForm, id: Date.now().toString() }],
    }));
    setNewContactForm(emptyContactPerson);
  };

  const handleRemoveContactFromTemp = (id) => {
    setTempCustomerForm(prev => ({
      ...prev,
      contactPersons: prev.contactPersons.filter(c => c.id !== id),
    }));
  };

  const handleSaveTempCustomer = async () => {
    if (!tempCustomerForm.corporateName.trim()) {
      showError('Corporate name is required');
      return;
    }
    if (tempCustomerForm.contactPersons.length === 0) {
      showError('Please add at least one contact person');
      return;
    }
    try {
      setSavingTempCustomer(true);
      const docRef = await addDoc(collection(db, 'quote-customers'), {
        ...tempCustomerForm,
        createdAt: new Date(),
      });
      const saved = { id: docRef.id, ...tempCustomerForm, _isQuoteCustomer: true };
      setQuoteCustomers(prev => [...prev, saved]);
      setNewCustomerDialogOpen(false);
      setTempCustomerForm(emptyTempCustomer);
      showSuccess('Quote customer saved');
      // open contact dialog immediately
      setDialogCustomer(saved);
      setDialogIsTemp(true);
      setContactDialogOpen(true);
    } catch (e) {
      console.error(e);
      showError('Failed to save customer');
    } finally {
      setSavingTempCustomer(false);
    }
  };

  const quoteNumberPart = quoteNumber.startsWith('CQ-') ? quoteNumber.substring(3) : quoteNumber;

  const cardSx = (isSelected) => ({
    width: '100%',
    height: '100%',
    cursor: 'pointer',
    borderRadius: 2,
    border: isSelected ? '2px solid #b98f33' : '1px solid rgba(0,0,0,0.12)',
    boxShadow: isSelected ? '0 4px 16px rgba(185,143,51,0.25)' : 1,
    '&:hover': { boxShadow: 4, transform: 'translateY(-2px)', transition: 'all 0.2s' },
    transition: 'all 0.2s',
  });

  return (
    <Box>
      {/* Quote Number */}
      <Box sx={{ mb: 4, p: 2.5, bgcolor: 'rgba(185,143,51,0.08)', borderRadius: 2, border: '1px solid rgba(185,143,51,0.3)' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1.5 }}>Quote Number</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <Typography sx={{
            fontWeight: 'bold', color: '#b98f33', px: 1.5,
            border: '1px solid #555', borderRight: 'none',
            borderTopLeftRadius: 4, borderBottomLeftRadius: 4,
            bgcolor: '#1a1a1a', height: 40, display: 'flex', alignItems: 'center',
            minWidth: 44, justifyContent: 'center', fontSize: '0.95rem',
          }}>
            CQ-
          </Typography>
          <TextField
            value={quoteNumberPart}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 6);
              onQuoteNumberChange(v ? `CQ-${v}` : 'CQ-');
            }}
            placeholder="000001"
            size="small"
            sx={{
              width: 130,
              '& .MuiOutlinedInput-root': {
                borderTopLeftRadius: 0, borderBottomLeftRadius: 0,
                '& fieldset': { borderColor: '#555' },
                '&:hover fieldset': { borderColor: '#b98f33' },
                '&.Mui-focused fieldset': { borderColor: '#b98f33' },
              },
            }}
            inputProps={{ maxLength: 6, inputMode: 'numeric' }}
          />
        </Box>
      </Box>

      {/* Selected customer banner */}
      {selectedCustomer && selectedContactPerson && (
        <Alert severity="success" sx={{ mb: 3 }}>
          <strong>{selectedCustomer.corporateName}</strong>
          {isTemporaryCustomer && <Chip label="Quote Customer" size="small" sx={{ ml: 1, bgcolor: '#f27921', color: 'white', fontWeight: 'bold' }} />}
          {' '}— Contact: <strong>{selectedContactPerson.name}</strong>
          {selectedContactPerson.position && ` (${selectedContactPerson.position})`}
        </Alert>
      )}

      {/* Tabs + search + add */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{ '& .MuiTab-root': { fontWeight: 'bold', color: '#666' }, '& .Mui-selected': { color: '#b98f33' }, '& .MuiTabs-indicator': { bgcolor: '#b98f33' } }}
        >
          <Tab label={`Corporate Customers (${corporateCustomers.length})`} />
          <Tab label={`Quote Customers (${quoteCustomers.length})`} />
        </Tabs>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            size="small"
            placeholder="Search customers..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            sx={{ width: 220 }}
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => { setTempCustomerForm(emptyTempCustomer); setNewCustomerDialogOpen(true); }}
            sx={buttonStyles.primaryButton}
          >
            New Customer
          </Button>
        </Box>
      </Box>

      {/* Customer list */}
      {loadingCustomers ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress sx={{ color: '#b98f33' }} />
        </Box>
      ) : (
        <>
          {activeTab === 0 && (
            <Grid container spacing={2}>
              {filtered(corporateCustomers).length === 0 ? (
                <Grid item xs={12}><Alert severity="info">No corporate customers found.</Alert></Grid>
              ) : filtered(corporateCustomers).map(c => {
                const isSelected = selectedCustomer?.id === c.id && !isTemporaryCustomer;
                return (
                  <Grid item xs={12} sm={6} md={4} key={c.id} sx={{ display: 'flex' }}>
                    <Card sx={{ ...cardSx(isSelected), width: '100%', display: 'flex', flexDirection: 'column' }} onClick={() => handleCardClick(c, false)}>
                      <CardContent sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Avatar sx={{ bgcolor: '#274290', width: 32, height: 32, flexShrink: 0 }}><CorporateFareIcon sx={{ fontSize: 18 }} /></Avatar>
                            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#b98f33', lineHeight: 1.3 }}>{c.corporateName}</Typography>
                          </Box>
                          <Typography variant="body2" color="text.secondary" sx={{ minHeight: 20 }}>{c.email || '\u00A0'}</Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ minHeight: 20 }}>{c.phone || '\u00A0'}</Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                          {c.contactPersons?.length > 0 ? `${c.contactPersons.length} contact${c.contactPersons.length > 1 ? 's' : ''}` : 'No contacts'}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}
          {activeTab === 1 && (
            <Grid container spacing={2}>
              {filtered(quoteCustomers).length === 0 ? (
                <Grid item xs={12}><Alert severity="info">No quote customers yet. Use "New Customer" to add one.</Alert></Grid>
              ) : filtered(quoteCustomers).map(c => {
                const isSelected = selectedCustomer?.id === c.id && isTemporaryCustomer;
                return (
                  <Grid item xs={12} sm={6} md={4} key={c.id} sx={{ display: 'flex' }}>
                    <Card sx={{ ...cardSx(isSelected), width: '100%', display: 'flex', flexDirection: 'column' }} onClick={() => handleCardClick(c, true)}>
                      <CardContent sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Avatar sx={{ bgcolor: '#f27921', width: 32, height: 32, flexShrink: 0 }}><BusinessIcon sx={{ fontSize: 18 }} /></Avatar>
                            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#b98f33', lineHeight: 1.3 }}>{c.corporateName}</Typography>
                          </Box>
                          <Typography variant="body2" color="text.secondary" sx={{ minHeight: 20 }}>{c.email || '\u00A0'}</Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ minHeight: 20 }}>{c.phone || '\u00A0'}</Typography>
                        </Box>
                        <Chip label="Quote Customer" size="small" sx={{ mt: 1, bgcolor: '#f27921', color: 'white', fontSize: '0.7rem', alignSelf: 'flex-start' }} />
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </>
      )}

      {/* Contact Person Dialog */}
      <Dialog
        open={contactDialogOpen}
        onClose={() => setContactDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, border: '1px solid #333' } }}
      >
        {/* Header */}
        <DialogTitle sx={{ borderBottom: '1px solid #333', pb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: '#274290', width: 38, height: 38 }}>
              <CorporateFareIcon sx={{ color: '#d4af5a', fontSize: 20 }} />
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                {dialogCustomer?.corporateName}
              </Typography>
              <Typography variant="caption" sx={{ color: '#888' }}>
                Select a contact person to proceed
              </Typography>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 2.5 }}>
          {(!dialogCustomer?.contactPersons || dialogCustomer.contactPersons.length === 0) ? (
            <Alert severity="warning" sx={{ mb: 2 }}>No contact persons found. Add one below.</Alert>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
              {dialogCustomer.contactPersons.map((cp, i) => (
                <Box
                  key={cp.id || i}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 2,
                    borderRadius: 1.5,
                    border: '1px solid #333',
                    bgcolor: '#2a2a2a',
                    transition: 'border-color 0.2s',
                    '&:hover': { borderColor: '#b98f33', bgcolor: '#333' },
                  }}
                >
                  <Avatar sx={{ bgcolor: '#274290', width: 38, height: 38, flexShrink: 0 }}>
                    <PersonIcon sx={{ fontSize: 20, color: '#fff' }} />
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 'bold', color: '#fff', fontSize: '0.95rem' }}>
                      {cp.name}
                    </Typography>
                    {cp.position && (
                      <Typography variant="caption" sx={{ color: '#b98f33', fontWeight: 600, display: 'block' }}>
                        {cp.position}
                      </Typography>
                    )}
                    <Typography variant="caption" sx={{ color: '#888' }}>
                      {[cp.email, cp.phone].filter(Boolean).join('  ·  ')}
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => handleSelectContact(cp)}
                    sx={{ ...buttonStyles.primaryButton, px: 2.5, flexShrink: 0 }}
                  >
                    Select
                  </Button>
                </Box>
              ))}
            </Box>
          )}

          {/* Add contact inline */}
          {addContactOpen ? (
            <Box sx={{ p: 2, bgcolor: '#1e1e1e', borderRadius: 1.5, border: '1px dashed #b98f33', mt: 1 }}>
              <Typography sx={{ mb: 1.5, fontWeight: 'bold', color: '#b98f33', fontSize: '0.9rem' }}>
                New Contact Person
              </Typography>
              <Grid container spacing={2}>
                {[['name', 'Name *'], ['position', 'Position'], ['email', 'Email'], ['phone', 'Phone']].map(([field, label]) => (
                  <Grid item xs={12} sm={6} key={field}>
                    <TextField
                      fullWidth size="small" label={label}
                      value={addContactForm[field]}
                      onChange={e => setAddContactForm(p => ({ ...p, [field]: e.target.value }))}
                    />
                  </Grid>
                ))}
              </Grid>
              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Button
                  size="small"
                  onClick={() => { setAddContactOpen(false); setAddContactForm(emptyContactPerson); }}
                  sx={buttonStyles.cancelButton}
                >
                  Cancel
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    if (!addContactForm.name.trim()) { showError('Name is required'); return; }
                    const newCp = { ...addContactForm, id: Date.now().toString() };
                    setDialogCustomer(prev => ({ ...prev, contactPersons: [...(prev.contactPersons || []), newCp] }));
                    setAddContactOpen(false);
                    setAddContactForm(emptyContactPerson);
                  }}
                  sx={buttonStyles.primaryButton}
                >
                  Add Contact
                </Button>
              </Box>
            </Box>
          ) : (
            <Button
              startIcon={<AddIcon />}
              size="small"
              onClick={() => setAddContactOpen(true)}
              sx={{
                bgcolor: 'transparent',
                color: '#b98f33',
                fontWeight: 'bold',
                border: '1px dashed #555',
                px: 2,
                borderRadius: 1.5,
                mt: 0.5,
                '&:hover': {
                  bgcolor: 'rgba(185,143,51,0.08)',
                  borderColor: '#b98f33',
                },
              }}
            >
              Add Contact Person
            </Button>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 2.5, pb: 2, borderTop: '1px solid #333', pt: 1.5 }}>
          <Button
            onClick={() => setContactDialogOpen(false)}
            sx={buttonStyles.cancelButton}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* New Temp Customer Dialog */}
      <Dialog open={newCustomerDialogOpen} onClose={() => setNewCustomerDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AddIcon sx={{ color: '#b98f33' }} />
            <Typography variant="h6">Add New Quote Customer</Typography>
            <Chip label="Temp" size="small" sx={{ bgcolor: '#f27921', color: 'white' }} />
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>This customer will be saved to the Quote Customers list for reuse in future quotes, but will NOT be added to your Corporate Customers directory.</Alert>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Corporate Name *" size="small"
                value={tempCustomerForm.corporateName}
                onChange={e => handleTempFieldChange('corporateName', e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Email" size="small"
                value={tempCustomerForm.email}
                onChange={e => handleTempFieldChange('email', e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Phone" size="small"
                value={tempCustomerForm.phone}
                onChange={e => handleTempFieldChange('phone', e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Address" size="small"
                value={tempCustomerForm.address}
                onChange={e => handleTempFieldChange('address', e.target.value)} />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>Contact Persons *</Typography>
          {tempCustomerForm.contactPersons.length > 0 && (
            <List disablePadding sx={{ mb: 2 }}>
              {tempCustomerForm.contactPersons.map((cp, i) => (
                <React.Fragment key={cp.id}>
                  <ListItem
                    secondaryAction={
                      <IconButton size="small" color="error" onClick={() => handleRemoveContactFromTemp(cp.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    }
                  >
                    <ListItemText
                      primary={<Typography fontWeight="bold">{cp.name}{cp.position ? ` — ${cp.position}` : ''}</Typography>}
                      secondary={[cp.email, cp.phone].filter(Boolean).join(' · ')}
                    />
                  </ListItem>
                  {i < tempCustomerForm.contactPersons.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
          <Box sx={{ p: 2, bgcolor: '#1e1e1e', borderRadius: 1.5, border: '1px dashed #b98f33', mt: 2 }}>
            <Typography sx={{ mb: 1.5, fontWeight: 'bold', color: '#b98f33', fontSize: '0.9rem' }}>Add Contact Person</Typography>
            <Grid container spacing={2}>
              {[['name', 'Name *'], ['position', 'Position'], ['email', 'Email'], ['phone', 'Phone']].map(([field, label]) => (
                <Grid item xs={12} sm={6} key={field}>
                  <TextField fullWidth size="small" label={label}
                    value={newContactForm[field]}
                    onChange={e => setNewContactForm(p => ({ ...p, [field]: e.target.value }))} />
                </Grid>
              ))}
            </Grid>
            <Button 
              variant="contained" 
              startIcon={<AddIcon />} 
              sx={{ ...buttonStyles.primaryButton, mt: 2, px: 3 }} 
              onClick={handleAddContactToTemp}
            >
              Add to List
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewCustomerDialogOpen(false)} sx={buttonStyles.cancelButton}>Cancel</Button>
          <Button
            variant="contained"
            disabled={savingTempCustomer}
            onClick={handleSaveTempCustomer}
            sx={buttonStyles.primaryButton}
          >
            {savingTempCustomer ? <CircularProgress size={20} /> : 'Save Customer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default QuoteStep1Customer;
