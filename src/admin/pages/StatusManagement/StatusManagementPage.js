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
  AccessTime as AccessTimeIcon,
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  Flag as FlagIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  MonetizationOn as MonetizationOnIcon,
  DragIndicator as DragIndicatorIcon
} from '@mui/icons-material';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
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
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../shared/firebase/config';
import { useNotification } from '../shared/components/Common/NotificationSystem';

// Sortable Table Row Component
const SortableTableRow = ({ 
  status, 
  statusStats, 
  handleEditStatus, 
  handleDeleteStatus, 
  deleting 
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: status.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow 
      ref={setNodeRef} 
      style={style} 
      hover={!isDragging}
      sx={{ 
        cursor: isDragging ? 'grabbing' : 'default',
        backgroundColor: isDragging ? '#f5f5f5' : 'inherit'
      }}
    >
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton
            {...attributes}
            {...listeners}
            size="small"
            sx={{ 
              cursor: 'grab',
              color: '#666',
              mr: 1,
              '&:active': { cursor: 'grabbing' }
            }}
          >
            <DragIndicatorIcon />
          </IconButton>
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
          sx={{ color: '#b98f33' }}
        >
          <EditIcon />
        </IconButton>
        <IconButton 
          size="small" 
          onClick={() => handleDeleteStatus(status)}
          disabled={deleting === status.id}
          sx={{ 
            color: deleting === status.id ? '#ccc' : '#b98f33',
            '&:disabled': { color: '#ccc' }
          }}
        >
          {deleting === status.id ? (
            <CircularProgress size={16} />
          ) : (
            <DeleteIcon />
          )}
        </IconButton>
      </TableCell>
    </TableRow>
  );
};

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
  const [pendingDialogOpen, setPendingDialogOpen] = useState(false);
  const [pendingForm, setPendingForm] = useState({
    expectedResumeDate: '',
    pendingNotes: ''
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState('');
  
  // Enhanced validation dialog state
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [validationError, setValidationError] = useState({ 
    type: '', 
    message: '', 
    order: null, 
    newStatus: null,
    pendingAmount: 0,
    currentAmount: 0
  });

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

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
    const maxSortOrder = statuses.length > 0 ? Math.max(...statuses.map(s => s.sortOrder || 0)) : 0;
    setStatusForm({
      label: '',
      value: '',
      color: '#2196f3',
      description: '',
      isEndState: false,
      endStateType: '',
      isDefault: false,
      sortOrder: maxSortOrder + 1
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
    if (saving) return; // Prevent double-clicks
    
    try {
      setSaving(true);
      console.log('Save button clicked, form data:', statusForm);
      
      // Validation
      if (!statusForm.label || !statusForm.value) {
        showError('Label and value are required');
        return;
      }

      // Auto-generate value from label if empty
      if (!statusForm.value && statusForm.label) {
        setStatusForm(prev => ({
          ...prev,
          value: prev.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
        }));
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
        label: statusForm.label.trim(),
        value: statusForm.value.trim(),
        color: statusForm.color,
        description: statusForm.description.trim(),
        isEndState: Boolean(statusForm.isEndState),
        endStateType: statusForm.isEndState ? statusForm.endStateType : '',
        isDefault: Boolean(statusForm.isDefault),
        sortOrder: parseInt(statusForm.sortOrder) || 1,
        updatedAt: new Date()
      };

      console.log('Saving status data:', statusData);

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
      showError(`Failed to save status: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const setDefaultStatus = async (currentStatusId) => {
    try {
      const batch = writeBatch(db);
      
      // Remove default from all statuses
      statuses.forEach(status => {
        if (status.isDefault && status.id !== currentStatusId) {
          const statusRef = doc(db, 'invoiceStatuses', status.id);
          batch.update(statusRef, { isDefault: false });
        }
      });

      await batch.commit();
      console.log('Default status updated successfully');
    } catch (error) {
      console.error('Error setting default status:', error);
      throw error; // Re-throw to handle in calling function
    }
  };

  const handleDeleteStatus = async (status) => {
    if (deleting === status.id) return; // Prevent double-clicks
    
    try {
      setDeleting(status.id);
      console.log('Delete status clicked:', status);
      
      // Check if status is in use
      const ordersUsingStatus = orders.filter(order => order.invoiceStatus === status.value);
      console.log('Orders using this status:', ordersUsingStatus.length);
      
      if (ordersUsingStatus.length > 0) {
        showError(`Cannot delete status "${status.label}". It's currently used by ${ordersUsingStatus.length} orders.`);
        return;
      }

      // Check if it's the default status
      if (status.isDefault) {
        showError('Cannot delete the default status. Please set another status as default first.');
        return;
      }

      const confirmed = await showConfirm(
        'Delete Status',
        `Are you sure you want to delete the status "${status.label}"? This action cannot be undone.`
      );

      console.log('User confirmed deletion:', confirmed);

      if (confirmed) {
        console.log('Attempting to delete status with ID:', status.id);
        await deleteDoc(doc(db, 'invoiceStatuses', status.id));
        showSuccess(`Status "${status.label}" deleted successfully`);
        fetchStatuses();
      } else {
        console.log('User cancelled deletion');
      }
    } catch (error) {
      console.error('Error deleting status:', error);
      showError(`Failed to delete status: ${error.message}`);
    } finally {
      setDeleting('');
    }
  };

  const handleStatusChange = async (order, newStatusValue) => {
    const newStatus = statuses.find(s => s.value === newStatusValue);
    if (!newStatus) return;

    setSelectedOrderForStatusChange({ order, newStatus });
    
    // Payment validation for end states
    if (newStatus.isEndState) {
      const totalAmount = calculateOrderTotal(order);
      const amountPaid = parseFloat(order.paymentData?.amountPaid) || 0;
      
      if (newStatus.endStateType === 'done') {
        // For "done" - must be fully paid
        if (amountPaid < totalAmount) {
          const pendingAmount = totalAmount - amountPaid;
                      setValidationError({
              type: 'done',
              message: `Cannot complete order: Payment not fully received. Required: $${totalAmount.toFixed(2)}, Paid: $${amountPaid.toFixed(2)}`,
              order: order,
              newStatus: newStatus,
              pendingAmount: pendingAmount,
              currentAmount: amountPaid
            });
            setValidationDialogOpen(true);
            setStatusChangeDialogOpen(false); // Close the status dialog when validation dialog opens
            return;
        }
      } else if (newStatus.endStateType === 'cancelled') {
        // For "cancelled" - must have $0 payment
        if (amountPaid > 0) {
                      setValidationError({
              type: 'cancelled',
              message: `Cannot cancel order: Payment has been received ($${amountPaid.toFixed(2)}). Please refund the customer first.`,
              order: order,
              newStatus: newStatus,
              pendingAmount: 0,
              currentAmount: amountPaid
            });
            setValidationDialogOpen(true);
            setStatusChangeDialogOpen(false); // Close the status dialog when validation dialog opens
            return;
        }
      }
    }
    
    // If changing to cancellation end state, ask for reason
    if (newStatus.isEndState && newStatus.endStateType === 'cancelled') {
      setCancellationReason('');
      setStatusChangeDialogOpen(true);
    } else if (newStatus.isEndState && newStatus.endStateType === 'pending') {
      // If changing to pending end state, ask for expected date and notes
      // Set default date to same day next month
      const today = new Date();
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
      const defaultDate = nextMonth.toISOString().split('T')[0];
      
      setPendingForm({
        expectedResumeDate: defaultDate,
        pendingNotes: ''
      });
      setPendingDialogOpen(true);
    } else {
      // Apply status change immediately
      await applyStatusChange(order, newStatus, '');
    }
  };

  const applyStatusChange = async (order, newStatus, reason = '', skipPaymentUpdate = false) => {
    try {
      const orderRef = doc(db, 'orders', order.id);
      const updateData = {
        invoiceStatus: newStatus.value,
        statusUpdatedAt: new Date()
      };

      // Apply business rules (skip if payment was already updated)
      if (newStatus.isEndState && !skipPaymentUpdate) {
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
        } else if (newStatus.endStateType === 'pending') {
          // Pending orders: set paid amount to 0
          updateData['paymentData.amountPaid'] = 0;
          updateData.pendingAt = new Date();
          // Add pending-specific fields if provided
          if (reason && typeof reason === 'object') {
            if (reason.expectedResumeDate) {
              updateData.expectedResumeDate = reason.expectedResumeDate;
            }
            if (reason.pendingNotes) {
              updateData.pendingNotes = reason.pendingNotes;
            }
          }
        }
      }

      await updateDoc(orderRef, updateData);
      
      showSuccess(`Order status updated to "${newStatus.label}"`);
      setStatusChangeDialogOpen(false);
      setPendingDialogOpen(false);
      setValidationDialogOpen(false);
      fetchOrders();
    } catch (error) {
      console.error('Error updating order status:', error);
      showError('Failed to update order status');
    }
  };

  // Enhanced payment update functions
  const handleMakeFullyPaid = async () => {
    try {
      const { order, newStatus, pendingAmount } = validationError;
      const orderRef = doc(db, 'orders', order.id);
      
      // Calculate new total paid amount
      const currentAmount = parseFloat(order.paymentData?.amountPaid) || 0;
      const newTotalPaid = currentAmount + pendingAmount;
      
      // Prepare payment history entry
      const paymentEntry = {
        amount: pendingAmount,
        date: new Date(),
        type: 'Status Change - Full Payment',
        method: 'System Adjustment',
        description: `Auto-payment for status change to ${newStatus.label}`
      };
      
      // Update order with new payment data
      const updateData = {
        'paymentData.amountPaid': newTotalPaid,
        'paymentData.paymentHistory': [
          ...(order.paymentData?.paymentHistory || []),
          paymentEntry
        ]
      };
      
      await updateDoc(orderRef, updateData);
      
      // Now update the status directly
      const statusUpdateData = {
        invoiceStatus: newStatus.value,
        statusUpdatedAt: new Date()
      };
      
      await updateDoc(orderRef, statusUpdateData);
      
      showSuccess(`Payment updated and order status changed to "${newStatus.label}"`);
      setValidationDialogOpen(false);
      fetchOrders();
    } catch (error) {
      console.error('Error updating payment:', error);
      showError('Failed to update payment');
    }
  };

  const handleSetPaymentToZero = async () => {
    try {
      const { order, newStatus, currentAmount } = validationError;
      const orderRef = doc(db, 'orders', order.id);
      
      // Prepare payment history entry for refund
      const paymentEntry = {
        amount: -currentAmount, // Negative amount for refund
        date: new Date(),
        type: 'Status Change - Refund',
        method: 'System Adjustment',
        description: `Auto-refund for status change to ${newStatus.label}`
      };
      
      // Update order with zero payment
      const updateData = {
        'paymentData.amountPaid': 0,
        'paymentData.paymentHistory': [
          ...(order.paymentData?.paymentHistory || []),
          paymentEntry
        ]
      };
      
      await updateDoc(orderRef, updateData);
      
      // Now update the status directly
      const statusUpdateData = {
        invoiceStatus: newStatus.value,
        statusUpdatedAt: new Date()
      };
      
      await updateDoc(orderRef, statusUpdateData);
      
      showSuccess(`Payment reset to $0 and order status changed to "${newStatus.label}"`);
      setValidationDialogOpen(false);
      fetchOrders();
    } catch (error) {
      console.error('Error updating payment:', error);
      showError('Failed to update payment');
    }
  };

  const handlePendingSubmit = async () => {
    // Validate expected date is not in the past
    const expectedDate = new Date(pendingForm.expectedResumeDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day for comparison
    
    if (expectedDate < today) {
      showError('Expected resume date cannot be in the past');
      return;
    }

    if (!pendingForm.expectedResumeDate) {
      showError('Please select an expected resume date');
      return;
    }

    try {
      const order = selectedOrderForStatusChange;
      const newStatus = statuses.find(s => s.value === order.newStatus);
      
      await applyStatusChange(order, newStatus, {
        expectedResumeDate: pendingForm.expectedResumeDate,
        pendingNotes: pendingForm.pendingNotes
      });
    } catch (error) {
      console.error('Error setting order to pending:', error);
      showError('Failed to set order to pending');
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = statuses.findIndex((status) => status.id === active.id);
      const newIndex = statuses.findIndex((status) => status.id === over.id);

      const newStatuses = arrayMove(statuses, oldIndex, newIndex);
      
      // Update local state immediately for smooth UI
      setStatuses(newStatuses);

      try {
        // Update sort orders in database
        const batch = writeBatch(db);
        
        newStatuses.forEach((status, index) => {
          const statusRef = doc(db, 'invoiceStatuses', status.id);
          batch.update(statusRef, { sortOrder: index + 1 });
        });

        await batch.commit();
        showSuccess('Status order updated successfully');
      } catch (error) {
        console.error('Error updating status order:', error);
        showError('Failed to update status order');
        // Revert local state if database update fails
        fetchStatuses();
      }
    }
  };

  const calculateOrderTotal = (order) => {
    let total = 0;
    if (order.furnitureData?.groups) {
      order.furnitureData.groups.forEach(group => {
        total += (parseFloat(group.materialPrice) || 0) * (parseFloat(group.materialQnty) || 0);
        total += (parseFloat(group.labourPrice) || 0) * (parseFloat(group.labourQnty) || 0);
        if (group.foamEnabled || group.foamPrice > 0) {
          total += (parseFloat(group.foamPrice) || 0) * (parseFloat(group.foamQnty) || 0);
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
    <Box sx={{ p: 3, backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <SettingsIcon sx={{ fontSize: 32, color: '#b98f33', mr: 2 }} />
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
            Status Management
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={fetchData}
            sx={{ 
              backgroundColor: '#b98f33',
              color: '#000000',
              border: '2px solid #8b6b1f',
              boxShadow: '0 4px 8px rgba(185, 143, 51, 0.3)',
              background: 'linear-gradient(135deg, #b98f33 0%, #d4af5a 100%)',
              '&:hover': { 
                backgroundColor: '#d4af5a',
                boxShadow: '0 6px 12px rgba(185, 143, 51, 0.4)',
                transform: 'translateY(-1px)'
              }
            }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateStatus}
            sx={{ 
              backgroundColor: '#b98f33',
              color: '#000000',
              border: '2px solid #8b6b1f',
              boxShadow: '0 4px 8px rgba(185, 143, 51, 0.3)',
              background: 'linear-gradient(135deg, #b98f33 0%, #d4af5a 100%)',
              '&:hover': { 
                backgroundColor: '#d4af5a',
                boxShadow: '0 6px 12px rgba(185, 143, 51, 0.4)',
                transform: 'translateY(-1px)'
              }
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
            variant="contained"
            onClick={() => setBusinessRulesDialogOpen(true)}
            sx={{ 
              backgroundColor: '#b98f33',
              color: '#000000',
              border: '1px solid #8b6b1f',
              boxShadow: '0 2px 4px rgba(185, 143, 51, 0.3)',
              background: 'linear-gradient(135deg, #b98f33 0%, #d4af5a 100%)',
              '&:hover': { 
                backgroundColor: '#d4af5a',
                boxShadow: '0 4px 8px rgba(185, 143, 51, 0.4)'
              }
            }}
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
          <Paper sx={{ p: 3, backgroundColor: '#2a2a2a', border: '1px solid #333333' }}>
            <Typography variant="h6" sx={{ mb: 2, color: '#b98f33', fontWeight: 'bold' }}>
              Invoice Statuses
            </Typography>
            
            <Alert 
              severity="info" 
              sx={{ mb: 3 }}
              icon={<DragIndicatorIcon />}
            >
              <strong>Drag & Drop:</strong> You can reorder statuses by dragging the 
              <DragIndicatorIcon sx={{ fontSize: 16, mx: 0.5, verticalAlign: 'middle' }} /> 
              handle next to each status name.
            </Alert>
            
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <TableContainer>
                <Table>
                  <TableHead sx={{ backgroundColor: '#b98f33' }}>
                    <TableRow>
                      <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <DragIndicatorIcon sx={{ mr: 1, opacity: 0.7 }} />
                          Status
                        </Box>
                      </TableCell>
                      <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Description</TableCell>
                      <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Type</TableCell>
                      <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Usage</TableCell>
                      <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Default</TableCell>
                      <TableCell sx={{ color: '#000000', fontWeight: 'bold' }} align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <SortableContext 
                    items={statuses.map(status => status.id)} 
                    strategy={verticalListSortingStrategy}
                  >
                    <TableBody>
                      {statuses.map((status) => (
                        <SortableTableRow
                          key={status.id}
                          status={status}
                          statusStats={statusStats}
                          handleEditStatus={handleEditStatus}
                          handleDeleteStatus={handleDeleteStatus}
                          deleting={deleting}
                        />
                      ))}
                    </TableBody>
                  </SortableContext>
                </Table>
              </TableContainer>
            </DndContext>
          </Paper>
        </Grid>

        {/* Statistics Panel */}
        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3, mb: 3, backgroundColor: '#2a2a2a', border: '1px solid #333333' }}>
            <Typography variant="h6" sx={{ mb: 2, color: '#b98f33', fontWeight: 'bold' }}>
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

          <Paper sx={{ p: 3, backgroundColor: '#2a2a2a', border: '1px solid #333333' }}>
            <Typography variant="h6" sx={{ mb: 2, color: '#b98f33', fontWeight: 'bold' }}>
              Quick Actions
            </Typography>
            
            <Button
              fullWidth
              variant="contained"
              startIcon={<FlagIcon />}
              onClick={() => setBusinessRulesDialogOpen(true)}
              sx={{ 
                mb: 2,
                backgroundColor: '#b98f33',
                color: '#000000',
                border: '1px solid #8b6b1f',
                boxShadow: '0 2px 4px rgba(185, 143, 51, 0.3)',
                background: 'linear-gradient(135deg, #b98f33 0%, #d4af5a 100%)',
                '&:hover': { 
                  backgroundColor: '#d4af5a',
                  boxShadow: '0 4px 8px rgba(185, 143, 51, 0.4)'
                }
              }}
            >
              View Business Rules
            </Button>
            
            <Button
              fullWidth
              variant="contained"
              startIcon={<MonetizationOnIcon />}
              onClick={() => window.open('/finance', '_blank')}
              sx={{ 
                backgroundColor: '#b98f33',
                color: '#000000',
                border: '1px solid #8b6b1f',
                boxShadow: '0 2px 4px rgba(185, 143, 51, 0.3)',
                background: 'linear-gradient(135deg, #b98f33 0%, #d4af5a 100%)',
                '&:hover': { 
                  backgroundColor: '#d4af5a',
                  boxShadow: '0 4px 8px rgba(185, 143, 51, 0.4)'
                }
              }}
            >
              Open Finance Page
            </Button>
          </Paper>
        </Grid>
      </Grid>

      {/* Status Create/Edit Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={() => {
          setDialogOpen(false);
          setSaving(false);
        }} 
        maxWidth="md" 
        fullWidth
      >
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
                onChange={(e) => {
                  const label = e.target.value;
                  const autoValue = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                  setStatusForm({ 
                    ...statusForm, 
                    label: label,
                    value: autoValue
                  });
                }}
                placeholder="e.g., In Progress"
                required
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Status Value"
                value={statusForm.value}
                onChange={(e) => setStatusForm({ ...statusForm, value: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') })}
                placeholder="e.g., in_progress"
                required
                helperText="Auto-generated from label (can be edited)"
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
                    <MenuItem value="pending">
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <AccessTimeIcon sx={{ color: '#ff9800', mr: 1 }} />
                        Pending (Auto-set paid=0)
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
          <Button 
            onClick={() => {
              setDialogOpen(false);
              setSaving(false);
            }}
            disabled={saving}
            variant="contained"
            sx={{ 
              backgroundColor: '#b98f33',
              color: '#000000',
              border: '1px solid #8b6b1f',
              boxShadow: '0 2px 4px rgba(185, 143, 51, 0.3)',
              background: 'linear-gradient(135deg, #b98f33 0%, #d4af5a 100%)',
              '&:hover': { 
                backgroundColor: '#d4af5a',
                boxShadow: '0 4px 8px rgba(185, 143, 51, 0.4)'
              }
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSaveStatus}
            variant="contained"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
            sx={{ 
              backgroundColor: '#b98f33',
              color: '#000000',
              border: '2px solid #8b6b1f',
              boxShadow: '0 4px 8px rgba(185, 143, 51, 0.3)',
              background: 'linear-gradient(135deg, #b98f33 0%, #d4af5a 100%)',
              '&:hover': { 
                backgroundColor: '#d4af5a',
                boxShadow: '0 6px 12px rgba(185, 143, 51, 0.4)',
                transform: 'translateY(-1px)'
              },
              '&:disabled': { backgroundColor: '#ccc' }
            }}
          >
            {saving ? 'Saving...' : (editingStatus ? 'Update' : 'Create')} Status
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
          <Button 
            onClick={() => setStatusChangeDialogOpen(false)}
            variant="contained"
            sx={{ 
              backgroundColor: '#b98f33',
              color: '#000000',
              border: '1px solid #8b6b1f',
              boxShadow: '0 2px 4px rgba(185, 143, 51, 0.3)',
              background: 'linear-gradient(135deg, #b98f33 0%, #d4af5a 100%)',
              '&:hover': { 
                backgroundColor: '#d4af5a',
                boxShadow: '0 4px 8px rgba(185, 143, 51, 0.4)'
              }
            }}
          >
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
            disabled={!cancellationReason.trim()}
            sx={{ 
              backgroundColor: '#b98f33',
              color: '#000000',
              border: '2px solid #8b6b1f',
              boxShadow: '0 4px 8px rgba(185, 143, 51, 0.3)',
              background: 'linear-gradient(135deg, #b98f33 0%, #d4af5a 100%)',
              '&:hover': { 
                backgroundColor: '#d4af5a',
                boxShadow: '0 6px 12px rgba(185, 143, 51, 0.4)',
                transform: 'translateY(-1px)'
              }
            }}
          >
            Confirm Cancellation
          </Button>
        </DialogActions>
      </Dialog>

      {/* Enhanced Validation Dialog */}
      <Dialog open={validationDialogOpen} onClose={() => setValidationDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Payment Validation Required</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 3 }}>
            {validationError.message}
          </Typography>
          
          {validationError.type === 'done' && (
            <Button 
              variant="contained" 
              onClick={handleMakeFullyPaid}
              fullWidth
              sx={{ 
                mb: 2,
                backgroundColor: '#b98f33',
                color: '#000000',
                border: '2px solid #8b6b1f',
                boxShadow: '0 4px 8px rgba(185, 143, 51, 0.3)',
                background: 'linear-gradient(135deg, #b98f33 0%, #d4af5a 100%)',
                '&:hover': { 
                  backgroundColor: '#d4af5a',
                  boxShadow: '0 6px 12px rgba(185, 143, 51, 0.4)',
                  transform: 'translateY(-1px)'
                }
              }}
              startIcon={<CheckCircleIcon />}
            >
              Make ${validationError.pendingAmount.toFixed(2)} as Paid
            </Button>
          )}
          
          {validationError.type === 'cancelled' && (
            <Button 
              variant="contained" 
              onClick={handleSetPaymentToZero}
              fullWidth
              sx={{ 
                mb: 2,
                backgroundColor: '#b98f33',
                color: '#000000',
                border: '2px solid #8b6b1f',
                boxShadow: '0 4px 8px rgba(185, 143, 51, 0.3)',
                background: 'linear-gradient(135deg, #b98f33 0%, #d4af5a 100%)',
                '&:hover': { 
                  backgroundColor: '#d4af5a',
                  boxShadow: '0 6px 12px rgba(185, 143, 51, 0.4)',
                  transform: 'translateY(-1px)'
                }
              }}
              startIcon={<CancelIcon />}
            >
              Set Payment Amount to $0.00
            </Button>
          )}
          
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            This action will update the payment history and automatically change the order status.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setValidationDialogOpen(false)}
            variant="contained"
            sx={{ 
              backgroundColor: '#b98f33',
              color: '#000000',
              border: '1px solid #8b6b1f',
              boxShadow: '0 2px 4px rgba(185, 143, 51, 0.3)',
              background: 'linear-gradient(135deg, #b98f33 0%, #d4af5a 100%)',
              '&:hover': { 
                backgroundColor: '#d4af5a',
                boxShadow: '0 4px 8px rgba(185, 143, 51, 0.4)'
              }
            }}
          >
            Cancel
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
          <Button 
            onClick={() => setBusinessRulesDialogOpen(false)}
            variant="contained"
            sx={{ 
              backgroundColor: '#b98f33',
              color: '#000000',
              border: '1px solid #8b6b1f',
              boxShadow: '0 2px 4px rgba(185, 143, 51, 0.3)',
              background: 'linear-gradient(135deg, #b98f33 0%, #d4af5a 100%)',
              '&:hover': { 
                backgroundColor: '#d4af5a',
                boxShadow: '0 4px 8px rgba(185, 143, 51, 0.4)'
              }
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Pending Status Dialog */}
      <Dialog open={pendingDialogOpen} onClose={() => setPendingDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <AccessTimeIcon sx={{ mr: 1, color: '#ff9800' }} />
            Set Order to Pending
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedOrderForStatusChange && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Order #{selectedOrderForStatusChange.orderDetails?.billInvoice}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Customer: {selectedOrderForStatusChange.personalInfo?.name}
              </Typography>
              
              <Alert severity="info" sx={{ mb: 2 }}>
                This will set the order to pending status and clear any payment amounts. Please provide the expected resume date and any notes.
              </Alert>

              <TextField
                fullWidth
                label="Expected Resume Date"
                type="date"
                value={pendingForm.expectedResumeDate}
                onChange={(e) => setPendingForm({ ...pendingForm, expectedResumeDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
                required
                sx={{ mb: 2 }}
                inputProps={{
                  min: new Date().toISOString().split('T')[0] // Prevent past dates
                }}
              />

              <TextField
                fullWidth
                label="Pending Notes"
                multiline
                rows={3}
                value={pendingForm.pendingNotes}
                onChange={(e) => setPendingForm({ ...pendingForm, pendingNotes: e.target.value })}
                placeholder="Enter any notes about why the order is being postponed..."
                sx={{ mb: 2 }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setPendingDialogOpen(false)}
            sx={{
              backgroundColor: '#e6e7e8',
              color: '#000000',
              border: '3px solid #c0c0c0',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.3)',
              position: 'relative',
              '&:hover': {
                backgroundColor: '#d0d1d2',
                border: '3px solid #a0a0a0',
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
            Cancel
          </Button>
          <Button
            onClick={handlePendingSubmit}
            variant="contained"
            startIcon={<AccessTimeIcon />}
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
            Set to Pending
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StatusManagementPage; 
