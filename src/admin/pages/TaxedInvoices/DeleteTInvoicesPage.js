import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Divider
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { deleteAllTInvoices } from '../../../utils/deleteTInvoices';
import { useNotification } from '../../../components/Common/NotificationSystem';

const DeleteTInvoicesPage = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [result, setResult] = useState(null);

  const handleDelete = async () => {
    setLoading(true);
    setConfirmDialogOpen(false);
    
    try {
      const result = await deleteAllTInvoices();
      
      if (result.success) {
        setResult(result);
        showSuccess(`Successfully deleted ${result.total} T- format invoices`);
      } else {
        showError(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error:', error);
      showError('Failed to delete T- invoices');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#274290', mb: 2 }}>
          Delete All T- Format Invoices
        </Typography>
        
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 1 }}>
            Warning: This action cannot be undone!
          </Typography>
          <Typography variant="body2">
            This will permanently delete all invoices with T- format numbers (T-100001, T-100002, etc.) from:
          </Typography>
          <List dense sx={{ mt: 1, mb: 1 }}>
            <ListItem>
              <ListItemText primary="• Corporate Orders" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• Customer Invoices" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• Taxed Invoices" />
            </ListItem>
          </List>
          <Typography variant="body2" sx={{ mt: 1, fontWeight: 'bold' }}>
            Make sure you have a backup if needed before proceeding.
          </Typography>
        </Alert>

        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
            <CircularProgress size={60} sx={{ mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              Deleting T- format invoices...
            </Typography>
          </Box>
        ) : result ? (
          <Box>
            <Alert severity="success" sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Deletion Complete!
              </Typography>
              <Typography variant="body1">
                Total invoices deleted: <strong>{result.total}</strong>
              </Typography>
            </Alert>

            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, color: '#274290' }}>
                Deletion Summary:
              </Typography>
              
              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  <strong>Corporate Orders:</strong> {result.deleted.corporateOrders.length}
                </Typography>
                {result.deleted.corporateOrders.length > 0 && (
                  <List dense>
                    {result.deleted.corporateOrders.map((item, idx) => (
                      <ListItem key={idx}>
                        <ListItemText 
                          primary={item.invoiceNumber}
                          secondary={`ID: ${item.id}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Paper>

              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  <strong>Customer Invoices:</strong> {result.deleted.customerInvoices.length}
                </Typography>
                {result.deleted.customerInvoices.length > 0 && (
                  <List dense>
                    {result.deleted.customerInvoices.map((item, idx) => (
                      <ListItem key={idx}>
                        <ListItemText 
                          primary={item.invoiceNumber}
                          secondary={`ID: ${item.id}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Paper>

              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  <strong>Taxed Invoices:</strong> {result.deleted.taxedInvoices.length}
                </Typography>
                {result.deleted.taxedInvoices.length > 0 && (
                  <List dense>
                    {result.deleted.taxedInvoices.map((item, idx) => (
                      <ListItem key={idx}>
                        <ListItemText 
                          primary={item.invoiceNumber}
                          secondary={`ID: ${item.id}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Paper>
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                onClick={() => navigate('/admin/taxed-invoices')}
                sx={{
                  backgroundColor: '#b98f33',
                  color: '#000',
                  '&:hover': {
                    backgroundColor: '#d4af5a'
                  }
                }}
              >
                Back to T- Invoices
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  setResult(null);
                  setConfirmDialogOpen(false);
                }}
              >
                Delete More
              </Button>
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              color="error"
              onClick={() => setConfirmDialogOpen(true)}
              sx={{
                backgroundColor: '#d32f2f',
                '&:hover': {
                  backgroundColor: '#c62828'
                }
              }}
            >
              Delete All T- Invoices
            </Button>
            <Button
              variant="outlined"
              onClick={() => navigate('/admin/taxed-invoices')}
            >
              Cancel
            </Button>
          </Box>
        )}
      </Paper>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
      >
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you absolutely sure you want to delete ALL T- format invoices? 
            This action cannot be undone and will permanently remove all invoices 
            with T- format numbers from corporate orders, customer invoices, and taxed invoices.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleDelete} 
            color="error"
            variant="contained"
          >
            Yes, Delete All
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DeleteTInvoicesPage;




