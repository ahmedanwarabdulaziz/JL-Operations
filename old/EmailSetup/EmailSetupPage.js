import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  Chip,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Email as EmailIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Google as GoogleIcon
} from '@mui/icons-material';
import { useFirebase } from '../../hooks/useFirebase';
import { useNotification } from '../../components/Common/NotificationSystem';

const EmailSetupPage = () => {
  const { getDocuments, addDocument, updateDocument, deleteDocument } = useFirebase();
  const { showSuccess, showError, showConfirm } = useNotification();
  
  const [emailAccounts, setEmailAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    senderName: '',
    isDefault: false
  });

  // Load email accounts from Firebase
  useEffect(() => {
    const loadEmailAccounts = async () => {
      try {
        setLoading(true);
        const accounts = await getDocuments('emailAccounts');
        setEmailAccounts(accounts || []);
      } catch (error) {
        console.error('Error loading email accounts:', error);
        showError('Failed to load email accounts');
      } finally {
        setLoading(false);
      }
    };
    
    loadEmailAccounts();
  }, [getDocuments, showError]);

  // Validation functions
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateGmail = (email) => {
    return email.toLowerCase().endsWith('@gmail.com');
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.name?.trim()) {
      errors.name = 'Account name is required';
    } else if (formData.name.trim().length < 2) {
      errors.name = 'Account name must be at least 2 characters';
    }

    if (!formData.email?.trim()) {
      errors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      errors.email = 'Please enter a valid email address';
    } else if (!validateGmail(formData.email)) {
      errors.email = 'Only Gmail accounts are supported';
    }

    if (!formData.password?.trim()) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    if (!formData.senderName?.trim()) {
      errors.senderName = 'Sender name is required';
    } else if (formData.senderName.trim().length < 2) {
      errors.senderName = 'Sender name must be at least 2 characters';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAdd = () => {
    setEditingAccount(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      senderName: '',
      isDefault: false
    });
    setFormErrors({});
    setShowPassword(false);
    setDialogOpen(true);
  };

  const handleEdit = (account) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      email: account.email,
      password: account.password,
      senderName: account.senderName,
      isDefault: account.isDefault
    });
    setFormErrors({});
    setShowPassword(false);
    setDialogOpen(true);
  };

  const handleDelete = async (account) => {
    showConfirm(
      'Delete Email Account',
      `Are you sure you want to delete the email account "${account.name}"? This action cannot be undone.`,
      async () => {
        try {
          await deleteDocument('emailAccounts', account.id);
          setEmailAccounts(emailAccounts.filter(acc => acc.id !== account.id));
          showSuccess('Email account deleted successfully');
        } catch (error) {
          showError('Failed to delete email account: ' + error.message);
        }
      }
    );
  };

  const handleSetDefault = async (account) => {
    try {
      // Remove default from all accounts
      const updatePromises = emailAccounts.map(acc => 
        updateDocument('emailAccounts', acc.id, { isDefault: false })
      );
      await Promise.all(updatePromises);

      // Set the selected account as default
      await updateDocument('emailAccounts', account.id, { isDefault: true });

      // Update local state
      setEmailAccounts(emailAccounts.map(acc => ({
        ...acc,
        isDefault: acc.id === account.id
      })));

      showSuccess(`${account.name} is now the default email account`);
    } catch (error) {
      showError('Failed to set default account: ' + error.message);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      if (editingAccount) {
        // Update existing account
        await updateDocument('emailAccounts', editingAccount.id, formData);
        setEmailAccounts(emailAccounts.map(account =>
          account.id === editingAccount.id
            ? { ...account, ...formData }
            : account
        ));
        showSuccess('Email account updated successfully');
      } else {
        // Add new account
        const newAccount = await addDocument('emailAccounts', formData);
        setEmailAccounts([...emailAccounts, { id: newAccount.id, ...formData }]);
        showSuccess('Email account added successfully');
      }
      
      setDialogOpen(false);
    } catch (error) {
      showError('Failed to save email account: ' + error.message);
    }
  };

  const handleCancel = () => {
    setDialogOpen(false);
    setEditingAccount(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      senderName: '',
      isDefault: false
    });
    setFormErrors({});
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
          Email Setup
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Configure Gmail accounts for sending emails. You can add accounts via Google OAuth or manually.
        </Typography>
      </Box>

      {/* Add Account Button */}
      <Box sx={{ mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAdd}
          sx={{ mb: 2 }}
        >
          Add Email Account
        </Button>
      </Box>

      {/* Email Accounts List */}
      {emailAccounts.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <EmailIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Email Accounts Configured
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Add your first Gmail account to start sending emails from your application.
          </Typography>
          <Button variant="contained" onClick={handleAdd}>
            Add First Account
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {emailAccounts.map((account) => (
            <Grid item xs={12} md={6} lg={4} key={account.id}>
              <Card 
                sx={{ 
                  height: '100%',
                  border: account.isDefault ? '2px solid #1976d2' : '1px solid #e0e0e0',
                  position: 'relative'
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <EmailIcon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                      {account.name}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {account.isDefault && (
                        <Chip 
                          label="Default" 
                          color="primary" 
                          size="small"
                          icon={<StarIcon />}
                        />
                      )}
                    </Box>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      <strong>Email:</strong> {account.email}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      <strong>Sender Name:</strong> {account.senderName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      <strong>Type:</strong> Manual
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                      size="small"
                      startIcon={account.isDefault ? <StarIcon /> : <StarBorderIcon />}
                      onClick={() => handleSetDefault(account)}
                      variant={account.isDefault ? "contained" : "outlined"}
                      disabled={account.isDefault}
                    >
                      {account.isDefault ? 'Default' : 'Set Default'}
                    </Button>
                    <Button
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => handleEdit(account)}
                      variant="outlined"
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      startIcon={<DeleteIcon />}
                      onClick={() => handleDelete(account)}
                      variant="outlined"
                      color="error"
                    >
                      Delete
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Add/Edit Account Dialog */}
      <Dialog open={dialogOpen} onClose={handleCancel} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingAccount ? 'Edit Email Account' : 'Add Email Account'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Manual Setup
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Add your Gmail account manually using App Password.
            </Typography>

            <TextField
              fullWidth
              label="Account Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={!!formErrors.name}
              helperText={formErrors.name}
              required
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Gmail Address"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              error={!!formErrors.email}
              helperText={formErrors.email || 'Only Gmail accounts are supported'}
              required
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="App Password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              error={!!formErrors.password}
              helperText={formErrors.password || 'Use Gmail App Password (not your regular password)'}
              required
              InputProps={{
                endAdornment: (
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                ),
              }}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Sender Name"
              value={formData.senderName}
              onChange={(e) => setFormData({ ...formData, senderName: e.target.value })}
              error={!!formErrors.senderName}
              helperText={formErrors.senderName}
              required
              sx={{ mb: 2 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                />
              }
              label="Set as default account"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingAccount ? 'Update' : 'Add'} Account
          </Button>
        </DialogActions>
      </Dialog>

      {/* Information Alert */}
      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2">
          <strong>Important:</strong> 
        </Typography>
        <Box component="ul" sx={{ mt: 1, mb: 0 }}>
          <Typography component="li" variant="body2">
            <strong>Manual Setup:</strong> Enable 2-Factor Authentication and generate an App Password
          </Typography>
          <Typography component="li" variant="body2">
            Only Gmail accounts are supported for sending emails
          </Typography>
        </Box>
      </Alert>
    </Box>
  );
};

export default EmailSetupPage; 