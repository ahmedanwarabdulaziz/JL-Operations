import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Alert,
  Card,
  CardContent,
  Grid,
  Switch,
  FormControlLabel,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tooltip,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  Flag as FlagIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  MonetizationOn as MonetizationOnIcon
} from '@mui/icons-material';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNotification } from '../../components/Common/NotificationSystem';

const StatusManagementPage = () => {
  const [statuses, setStatuses] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState(null);
  const [defaultStatusId, setDefaultStatusId] = useState('');
  const [businessRulesDialogOpen, setBusinessRulesDialogOpen] = useState(false);
  const [selectedOrderForStatusChange, setSelectedOrderForStatusChange] = useState(null);
  const [statusChangeDialogOpen, setStatusChangeDialogOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');

  const [statusForm, setStatusForm] = useState({
    label: '',
    value: '',
    color: '#2196f3',
    description: '',
    isEndState: false,
    endStateType: '', // 'done' or 'cancelled'
    isDefault: false,
    sortOrder: 1
  });

  const { showSuccess, showError, showConfirm } = useNotification();

  // Predefined colors for status selection
  const statusColors = [
    { name: 'Blue', value: '#2196f3' },
    { name: 'Green', value: '#4caf50' },
    { name: 'Orange', value: '#ff9800' },
    { name: 'Red', value: '#f44336' },
    { name: 'Purple', value: '#9c27b0' },
    { name: 'Teal', value: '#009688' },
    { name: 'Deep Orange', value: '#ff5722' },
    { name: 'Indigo', value: '#3f51b5' },
    { name: 'Brown', value: '#795548' },
    { name: 'Grey', value: '#607d8b' }
  ];

  // Load statuses and orders
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchStatuses(), fetchOrders()]);
    } catch (error) {
      console.error('Error fetching data:', error);
      showError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchStatuses = async () => {
    try {
      const statusesRef = collection(db, 'invoiceStatuses');
      const querySnapshot = await getDocs(statusesRef);
      const statusesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort by sortOrder
      statusesData.sort((a, b) => (a.sortOrder || 1) - (b.sortOrder || 1));
      setStatuses(statusesData);

      // Find default status
      const defaultStatus = statusesData.find(status => status.isDefault);
      if (defaultStatus) {
        setDefaultStatusId(defaultStatus.id);
      }
    } catch (error) {
      console.error('Error fetching statuses:', error);
      showError('Failed to fetch statuses');
    }
  };

  const fetchOrders = async () => {
    try {
      const ordersRef = collection(db, 'orders');
      const querySnapshot = await getDocs(ordersRef);
      const ordersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setOrders(ordersData);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const handleCreateStatus = () => {
    setEditingStatus(null);
    setStatusForm({
      label: '',
      value: '',
      color: '#2196f3',
      description: '',
      isEndState: false,
      endStateType: '',
      isDefault: false,
      sortOrder: statuses.length + 1
    });
    setDialogOpen(true);
  };

  const handleEditStatus = (status) => {
    setEditingStatus(status);
    setStatusForm({
      label: status.label,
      value: status.value,
      color: status.color,
      description: status.description || '',
      isEndState: status.isEndState || false,
      endStateType: status.endStateType || '',
      isDefault: status.isDefault || false,
      sortOrder: status.sortOrder || 1
    });
    setDialogOpen(true);
  };

  const handleSaveStatus = async () => {
    try {
      // Validation
      if (!statusForm.label || !statusForm.value) {
        showError('Label and value are required');
        return;
      }

      // Check for duplicate values
      const existingStatus = statuses.find(s => 
        s.value === statusForm.value && s.id !== editingStatus?.id
      );
      if (existingStatus) {
        showError('Status value must be unique');
        return;
      }

      // Validate end state type
      if (statusForm.isEndState && !statusForm.endStateType) {
        showError('End state type is required for end states');
        return;
      }

      const statusData = {
        ...statusForm,
        updatedAt: new Date()
      };

      if (editingStatus) {
        // Update existing status
        const statusRef = doc(db, 'invoiceStatuses', editingStatus.id);
        await updateDoc(statusRef, statusData);
        showSuccess('Status updated successfully');
      } else {
        // Create new status
        statusData.createdAt = new Date();
        await addDoc(collection(db, 'invoiceStatuses'), statusData);
        showSuccess('Status created successfully');
      }

      // If this is set as default, update other statuses
      if (statusForm.isDefault) {
        await setDefaultStatus(editingStatus?.id);
      }

      setDialogOpen(false);
      fetchStatuses();
    } catch (error) {
      console.error('Error saving status:', error);
      showError('Failed to save status');
    }
  };

  const setDefaultStatus = async (currentStatusId) => {
    try {
      const batch = writeBatch(db);
      
      // Remove default from all statuses
      statuses.forEach(status => {
        if (status.isDefault) {
          const statusRef = doc(db, 'invoiceStatuses', status.id);
          batch.update(statusRef, { isDefault: false });
        }
      });

      // Set new default (only if not editing current status)
      if (currentStatusId) {
        const statusRef = doc(db, 'invoiceStatuses', currentStatusId);
        batch.update(statusRef, { isDefault: true });
      }

      await batch.commit();
    } catch (error) {
      console.error('Error setting default status:', error);
    }
  };

  const handleDeleteStatus = async (status) => {
    try {
      // Check if status is in use
      const ordersUsingStatus = orders.filter(order => order.invoiceStatus === status.value);
      
      if (ordersUsingStatus.length > 0) {
        showError(`Cannot delete status. It's currently used by ${ordersUsingStatus.length} orders.`);
        return;
      }

      const confirmed = await showConfirm(
        'Delete Status',
        `Are you sure you want to delete the status "${status.label}"?`
      );

      if (confirmed) {
        await deleteDoc(doc(db, 'invoiceStatuses', status.id));
        showSuccess('Status deleted successfully');
        fetchStatuses();
      }
    } catch (error) {
      console.error('Error deleting status:', error);
      showError('Failed to delete status');
    }
  };

  const handleStatusChange = async (order, newStatusValue) => {
    const newStatus = statuses.find(s => s.value === newStatusValue);
    if (!newStatus) return;

    setSelectedOrderForStatusChange({ order, newStatus });
    
    // If changing to cancellation end state, ask for reason
    if (newStatus.isEndState && newStatus.endStateType === 'cancelled') {
      setCancellationReason('');
      setStatusChangeDialogOpen(true);
    } else {
      // Apply status change immediately
      await applyStatusChange(order, newStatus, '');
    }
  };

  const applyStatusChange = async (order, newStatus, reason = '') => {
    try {
      const orderRef = doc(db, 'orders', order.id);
      const updateData = {
        invoiceStatus: newStatus.value,
        statusUpdatedAt: new Date()
      };

      // Apply business rules
      if (newStatus.isEndState) {
        if (newStatus.endStateType === 'cancelled') {
          // Cancelled orders: set paid amount to 0
          updateData['paymentData.amountPaid'] = 0;
          if (reason) {
            updateData.cancellationReason = reason;
            updateData.cancelledAt = new Date();
          }
        } else if (newStatus.endStateType === 'done') {
          // Done orders: set as fully paid
          const totalAmount = calculateOrderTotal(order);
          updateData['paymentData.amountPaid'] = totalAmount;
          updateData.completedAt = new Date();
        }
      }

      await updateDoc(orderRef, updateData);
      
      showSuccess(`Order status updated to "${newStatus.label}"`);
      setStatusChangeDialogOpen(false);
      fetchOrders();
    } catch (error) {
      console.error('Error updating order status:', error);
      showError('Failed to update order status');
    }
  };

  const calculateOrderTotal = (order) => {
    let total = 0;
    if (order.furnitureData?.groups) {
      order.furnitureData.groups.forEach(group => {
        total += (parseFloat(group.materialPrice) || 0) * (parseInt(group.materialQnty) || 0);
        total += (parseFloat(group.labourPrice) || 0) * (parseInt(group.labourQnty) || 0);
        if (group.foamEnabled || group.foamPrice > 0) {
          total += (parseFloat(group.foamPrice) || 0) * (parseInt(group.foamQnty) || 0);
        }
      });
    }
    if (order.paymentData?.pickupDeliveryEnabled) {
      total += parseFloat(order.paymentData.pickupDeliveryCost) || 0;
    }
    return total;
  };

  const getStatusStats = () => {
    const stats = {};
    orders.forEach(order => {
      const status = order.invoiceStatus || 'in_progress';
      stats[status] = (stats[status] || 0) + 1;
    });
    return stats;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  const statusStats = getStatusStats();

  return (
    <Box sx={{ p: 3, backgroundColor: '#e6e7e8', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <SettingsIcon sx={{ fontSize: 32, color: '#274290', mr: 2 }} />
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#274290' }}>
            Status Management
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchData}
            sx={{ 
              color: '#274290',
              borderColor: '#274290',
              '&:hover': { borderColor: '#274290', backgroundColor: '#f5f8ff' }
            }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateStatus}
            sx={{ 
              backgroundColor: '#f27921',
              '&:hover': { backgroundColor: '#e66a1a' }
            }}
          >
            Add Status
          </Button>
        </Box>
      </Box>

      {/* Business Rules Info */}
      <Alert 
        severity="info" 
        sx={{ mb: 3 }}
        action={
          <Button 
            size="small" 
            onClick={() => setBusinessRulesDialogOpen(true)}
            sx={{ color: '#274290' }}
          >
            View Rules
          </Button>
        }
      >
        <strong>Business Rules Active:</strong> Cancelled orders auto-set paid=0 | Done orders auto-set fully paid
      </Alert>

      <Grid container spacing={3}>
        {/* Status List */}
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 3, color: '#274290', fontWeight: 'bold' }}>
              Invoice Statuses
            </Typography>
            
            <TableContainer>
              <Table>
                <TableHead sx={{ backgroundColor: '#274290' }}>
                  <TableRow>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Description</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Type</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Usage</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Default</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {statuses.map((status) => (
                    <TableRow key={status.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Chip
                            label={status.label}
                            sx={{
                              backgroundColor: status.color,
                              color: 'white',
                              fontWeight: 'bold',
                              mr: 1
                            }}
                          />
                          {status.isEndState && (
                            <Tooltip title={`End State: ${status.endStateType}`}>
                              {status.endStateType === 'done' ? 
                                <CheckCircleIcon sx={{ color: '#4caf50', fontSize: 16 }} /> :
                                <CancelIcon sx={{ color: '#f44336', fontSize: 16 }} />
                              }
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {status.description || 'No description'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {status.isEndState ? (
                          <Chip 
                            label={`END: ${status.endStateType}`}
                            size="small"
                            color={status.endStateType === 'done' ? 'success' : 'error'}
                          />
                        ) : (
                          <Chip 
                            label="ACTIVE" 
                            size="small" 
                            sx={{ backgroundColor: '#2196f3', color: 'white' }}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {statusStats[status.value] || 0} orders
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {status.isDefault && (
                          <Chip 
                            label="DEFAULT" 
                            size="small" 
                            sx={{ backgroundColor: '#f27921', color: 'white' }}
                          />
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <IconButton 
                          size="small" 
                          onClick={() => handleEditStatus(status)}
                          sx={{ color: '#274290' }}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          onClick={() => handleDeleteStatus(status)}
                          sx={{ color: '#f44336' }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Statistics Panel */}
        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, color: '#274290', fontWeight: 'bold' }}>
              Status Statistics
            </Typography>
            
            <List dense>
              {statuses.map(status => (
                <ListItem key={status.id} sx={{ px: 0 }}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <Box
                      sx={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        backgroundColor: status.color
                      }}
                    />
                  </ListItemIcon>
                  <ListItemText 
                    primary={status.label}
                    secondary={`${statusStats[status.value] || 0} orders`}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, color: '#274290', fontWeight: 'bold' }}>
              Quick Actions
            </Typography>
            
            <Button
              fullWidth
              variant="outlined"
              startIcon={<FlagIcon />}
              onClick={() => setBusinessRulesDialogOpen(true)}
              sx={{ 
                mb: 2,
                color: '#274290',
                borderColor: '#274290',
                '&:hover': { borderColor: '#274290', backgroundColor: '#f5f8ff' }
              }}
            >
              View Business Rules
            </Button>
            
            <Button
              fullWidth
              variant="outlined"
              startIcon={<MonetizationOnIcon />}
              onClick={() => window.open('/finance', '_blank')}
              sx={{ 
                color: '#f27921',
                borderColor: '#f27921',
                '&:hover': { borderColor: '#f27921', backgroundColor: '#fff8f5' }
              }}
            >
              Open Finance Page
            </Button>
          </Paper>
        </Grid>
      </Grid>

      {/* Status Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingStatus ? 'Edit Status' : 'Create New Status'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Status Label"
                value={statusForm.label}
                onChange={(e) => setStatusForm({ ...statusForm, label: e.target.value })}
                placeholder="e.g., In Progress"
                required
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Status Value"
                value={statusForm.value}
                onChange={(e) => setStatusForm({ ...statusForm, value: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                placeholder="e.g., in_progress"
                required
                helperText="Auto-generated from label"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Color</InputLabel>
                <Select
                  value={statusForm.color}
                  onChange={(e) => setStatusForm({ ...statusForm, color: e.target.value })}
                  label="Color"
                >
                  {statusColors.map(color => (
                    <MenuItem key={color.value} value={color.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box
                          sx={{
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            backgroundColor: color.value,
                            mr: 2
                          }}
                        />
                        {color.name}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Sort Order"
                value={statusForm.sortOrder}
                onChange={(e) => setStatusForm({ ...statusForm, sortOrder: parseInt(e.target.value) || 1 })}
                inputProps={{ min: 1 }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Description"
                value={statusForm.description}
                onChange={(e) => setStatusForm({ ...statusForm, description: e.target.value })}
                placeholder="Describe when this status should be used..."
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={statusForm.isEndState}
                    onChange={(e) => setStatusForm({ 
                      ...statusForm, 
                      isEndState: e.target.checked,
                      endStateType: e.target.checked ? statusForm.endStateType : ''
                    })}
                  />
                }
                label="This is an end state (final status)"
              />
            </Grid>

            {statusForm.isEndState && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>End State Type</InputLabel>
                  <Select
                    value={statusForm.endStateType}
                    onChange={(e) => setStatusForm({ ...statusForm, endStateType: e.target.value })}
                    label="End State Type"
                    required
                  >
                    <MenuItem value="done">
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <CheckCircleIcon sx={{ color: '#4caf50', mr: 1 }} />
                        Done (Auto-set fully paid)
                      </Box>
                    </MenuItem>
                    <MenuItem value="cancelled">
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <CancelIcon sx={{ color: '#f44336', mr: 1 }} />
                        Cancelled (Auto-set paid=0)
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            )}

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={statusForm.isDefault}
                    onChange={(e) => setStatusForm({ ...statusForm, isDefault: e.target.checked })}
                  />
                }
                label="Set as default status for new orders"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSaveStatus}
            variant="contained"
            sx={{ 
              backgroundColor: '#f27921',
              '&:hover': { backgroundColor: '#e66a1a' }
            }}
          >
            {editingStatus ? 'Update' : 'Create'} Status
          </Button>
        </DialogActions>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog open={statusChangeDialogOpen} onClose={() => setStatusChangeDialogOpen(false)}>
        <DialogTitle>Cancellation Reason Required</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Please provide a reason for cancelling this order:
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Cancellation Reason"
            value={cancellationReason}
            onChange={(e) => setCancellationReason(e.target.value)}
            placeholder="e.g., Customer requested cancellation due to..."
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusChangeDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => {
              if (cancellationReason.trim()) {
                applyStatusChange(
                  selectedOrderForStatusChange.order, 
                  selectedOrderForStatusChange.newStatus, 
                  cancellationReason
                );
              }
            }}
            variant="contained"
            color="error"
            disabled={!cancellationReason.trim()}
          >
            Confirm Cancellation
          </Button>
        </DialogActions>
      </Dialog>

      {/* Business Rules Dialog */}
      <Dialog open={businessRulesDialogOpen} onClose={() => setBusinessRulesDialogOpen(false)} maxWidth="md">
        <DialogTitle>Business Rules & Automation</DialogTitle>
        <DialogContent>
          <Typography variant="h6" sx={{ mb: 2, color: '#274290' }}>
            Automatic Payment Updates
          </Typography>
          
          <List>
            <ListItem>
              <ListItemIcon>
                <CancelIcon sx={{ color: '#f44336' }} />
              </ListItemIcon>
              <ListItemText 
                primary="Cancelled Orders"
                secondary="When an order is marked as cancelled, the paid amount is automatically set to $0.00 and a cancellation reason is required."
              />
            </ListItem>
            
            <ListItem>
              <ListItemIcon>
                <CheckCircleIcon sx={{ color: '#4caf50' }} />
              </ListItemIcon>
              <ListItemText 
                primary="Completed Orders"
                secondary="When an order is marked as done, the paid amount is automatically set to the full order total, marking it as fully paid."
              />
            </ListItem>
            
            <ListItem>
              <ListItemIcon>
                <FlagIcon sx={{ color: '#f27921' }} />
              </ListItemIcon>
              <ListItemText 
                primary="Default Status"
                secondary="New orders automatically receive the default status. Only one status can be set as default."
              />
            </ListItem>
          </List>

          <Divider sx={{ my: 2 }} />
          
          <Typography variant="h6" sx={{ mb: 2, color: '#274290' }}>
            Status Types
          </Typography>
          
          <List>
            <ListItem>
              <ListItemIcon>
                <PlayArrowIcon sx={{ color: '#2196f3' }} />
              </ListItemIcon>
              <ListItemText 
                primary="Active Status"
                secondary="Regular status that can be changed to other statuses. Used for workflow steps."
              />
            </ListItem>
            
            <ListItem>
              <ListItemIcon>
                <StopIcon sx={{ color: '#9e9e9e' }} />
              </ListItemIcon>
              <ListItemText 
                primary="End State"
                secondary="Final status that cannot be changed. Either 'Done' (successful completion) or 'Cancelled' (terminated)."
              />
            </ListItem>
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBusinessRulesDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StatusManagementPage; 