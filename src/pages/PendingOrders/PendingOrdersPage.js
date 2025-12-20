import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Tooltip,
  Card,
  CardContent,
  Grid,
  InputAdornment,
  Divider
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  PlayArrow as PlayArrowIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  CalendarToday as CalendarIcon,
  Notes as NotesIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  updateDoc, 
  doc,
  where 
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNotification } from '../../shared/components/Common/NotificationSystem';
import { formatDate, formatDateOnly } from '../../utils/dateUtils';
import { buttonStyles } from '../../styles/buttonStyles';

const PendingOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statuses, setStatuses] = useState([]);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedReturnStatus, setSelectedReturnStatus] = useState('');
  const [returning, setReturning] = useState(false);
  const [filterOverdue, setFilterOverdue] = useState('all'); // 'all', 'overdue', 'upcoming'

  const { showSuccess, showError } = useNotification();

  // Fetch pending orders
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get all invoice statuses to identify pending end states
      const statusesRef = collection(db, 'invoiceStatuses');
      const statusesSnapshot = await getDocs(statusesRef);
      const statusesData = statusesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setStatuses(statusesData);

      // Get all orders
      const ordersRef = collection(db, 'orders');
      const ordersQuery = query(ordersRef, orderBy('orderDetails.billInvoice', 'desc'));
      const ordersSnapshot = await getDocs(ordersQuery);
      const ordersData = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Filter for orders with pending end state status
      const pendingStatuses = statusesData.filter(status => 
        status.isEndState && status.endStateType === 'pending'
      );
      const pendingStatusValues = pendingStatuses.map(status => status.value);

      const pendingOrders = ordersData.filter(order => 
        pendingStatusValues.includes(order.invoiceStatus)
      );

      // Sort by expected resume date (overdue first, then by date)
      const sortedOrders = pendingOrders.sort((a, b) => {
        const dateA = new Date(a.expectedResumeDate || '9999-12-31');
        const dateB = new Date(b.expectedResumeDate || '9999-12-31');
        const now = new Date();
        
        const aOverdue = dateA < now;
        const bOverdue = dateB < now;
        
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;
        
        return dateA - dateB;
      });
      
      setOrders(sortedOrders);
      setFilteredOrders(sortedOrders);
    } catch (error) {
      console.error('Error fetching pending orders:', error);
      showError('Failed to fetch pending orders');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Filter orders based on search term and overdue filter
  useEffect(() => {
    let filtered = orders;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(order => {
        const searchLower = searchTerm.toLowerCase();
        return (
          order.personalInfo?.customerName?.toLowerCase().includes(searchLower) ||
          order.personalInfo?.name?.toLowerCase().includes(searchLower) ||
          order.personalInfo?.email?.toLowerCase().includes(searchLower) ||
          order.personalInfo?.phone?.toLowerCase().includes(searchLower) ||
          order.orderDetails?.billInvoice?.toLowerCase().includes(searchLower) ||
          order.pendingNotes?.toLowerCase().includes(searchLower)
        );
      });
    }

    // Apply overdue filter
    if (filterOverdue !== 'all') {
      const now = new Date();
      filtered = filtered.filter(order => {
        const expectedDate = new Date(order.expectedResumeDate);
        if (filterOverdue === 'overdue') {
          return expectedDate < now;
        } else if (filterOverdue === 'upcoming') {
          return expectedDate >= now;
        }
        return true;
      });
    }

    setFilteredOrders(filtered);
  }, [orders, searchTerm, filterOverdue]);

  const handleReturnToActive = async () => {
    if (!selectedOrder || !selectedReturnStatus) {
      showError('Please select a status to return the order to');
      return;
    }

    try {
      setReturning(true);
      const orderRef = doc(db, 'orders', selectedOrder.id);
      
      await updateDoc(orderRef, {
        invoiceStatus: selectedReturnStatus,
        statusUpdatedAt: new Date(),
        // Clear pending-specific fields
        expectedResumeDate: null,
        pendingNotes: null,
        pendingAt: null
      });

      showSuccess('Order returned to active status successfully');
      setReturnDialogOpen(false);
      setSelectedOrder(null);
      setSelectedReturnStatus('');
      fetchOrders();
    } catch (error) {
      console.error('Error returning order to active:', error);
      showError('Failed to return order to active status');
    } finally {
      setReturning(false);
    }
  };

  const isOverdue = (expectedDate) => {
    if (!expectedDate) return false;
    return new Date(expectedDate) < new Date();
  };

  const getOverdueDays = (expectedDate) => {
    if (!expectedDate) return 0;
    const now = new Date();
    const expected = new Date(expectedDate);
    const diffTime = now - expected;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getStatusColor = (statusValue) => {
    const status = statuses.find(s => s.value === statusValue);
    return status?.color || '#757575';
  };

  const getStatusLabel = (statusValue) => {
    const status = statuses.find(s => s.value === statusValue);
    return status?.label || statusValue;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 1 }}>
          Pending Orders
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Orders that have been postponed by customers. {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''} pending.
        </Typography>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Filter by Date</InputLabel>
                <Select
                  value={filterOverdue}
                  onChange={(e) => setFilterOverdue(e.target.value)}
                  label="Filter by Date"
                >
                  <MenuItem value="all">All Orders</MenuItem>
                  <MenuItem value="overdue">Overdue</MenuItem>
                  <MenuItem value="upcoming">Upcoming</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={fetchOrders}
                sx={buttonStyles.secondaryButton}
              >
                Refresh
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: 'primary.light' }}>
              <TableCell sx={{ fontWeight: 'bold', color: 'white' }}>Invoice #</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: 'white' }}>Customer</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: 'white' }}>Contact</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: 'white' }}>Start Date</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: 'white' }}>Expected Resume Date</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: 'white' }}>Notes</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: 'white' }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: 'white' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} sx={{ textAlign: 'center', py: 4 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <AccessTimeIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary">
                      No pending orders found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {searchTerm || filterOverdue !== 'all' 
                        ? 'Try adjusting your search or filters'
                        : 'All orders are currently active or completed'
                      }
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => {
                const overdue = isOverdue(order.expectedResumeDate);
                const overdueDays = getOverdueDays(order.expectedResumeDate);
                const isSelected = selectedOrder?.id === order.id;
                
                return (
                  <TableRow 
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    sx={{ 
                      cursor: 'pointer',
                      backgroundColor: isSelected 
                        ? 'rgba(0, 0, 0, 0.08)'
                        : 'transparent',
                      borderLeft: overdue ? '4px solid #d32f2f' : '4px solid transparent',
                      '&:hover': { 
                        backgroundColor: isSelected
                          ? 'rgba(0, 0, 0, 0.12)'
                          : 'rgba(0, 0, 0, 0.04)',
                      },
                      transition: 'background-color 0.2s ease'
                    }}
                  >
                    <TableCell>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                        #{order.orderDetails?.billInvoice || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                          {order.personalInfo?.customerName || order.personalInfo?.name || 'No Name'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {order.personalInfo?.email || 'No Email'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {order.personalInfo?.phone || 'No Phone'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <CalendarIcon sx={{ mr: 1, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          {order.orderDetails?.startDate ? formatDateOnly(order.orderDetails.startDate) : 'Not Set'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <CalendarIcon sx={{ mr: 1, color: 'text.secondary' }} />
                        <Box>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontWeight: overdue ? 'bold' : 'normal',
                              color: overdue ? 'error.main' : 'text.primary'
                            }}
                          >
                            {order.expectedResumeDate ? formatDateOnly(order.expectedResumeDate) : 'Not Set'}
                          </Typography>
                          {overdue && (
                            <Typography variant="caption" color="error.main">
                              {overdueDays} day{overdueDays !== 1 ? 's' : ''} overdue
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ maxWidth: 200 }}>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          title={order.pendingNotes}
                        >
                          {order.pendingNotes || 'No notes'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusLabel(order.invoiceStatus)}
                        size="small"
                        sx={{
                          backgroundColor: getStatusColor(order.invoiceStatus),
                          color: 'white',
                          fontWeight: 'bold'
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Return to Active Status">
                        <IconButton
                          color="primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrder(order);
                            setReturnDialogOpen(true);
                          }}
                        >
                          <PlayArrowIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Return to Active Dialog */}
      <Dialog open={returnDialogOpen} onClose={() => setReturnDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <PlayArrowIcon sx={{ mr: 1, color: 'primary.main' }} />
            Return Order to Active Status
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedOrder && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Order #{selectedOrder.orderDetails?.billInvoice}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Customer: {selectedOrder.personalInfo?.customerName || selectedOrder.personalInfo?.name}
              </Typography>
              
              <Alert severity="info" sx={{ mb: 2 }}>
                This will clear the expected resume date and pending notes, and return the order to active workflow.
              </Alert>

              <FormControl fullWidth>
                <InputLabel>Select Status</InputLabel>
                <Select
                  value={selectedReturnStatus}
                  onChange={(e) => setSelectedReturnStatus(e.target.value)}
                  label="Select Status"
                >
                  {statuses
                    .filter(status => !status.isEndState)
                    .map((status) => (
                      <MenuItem key={status.id} value={status.value}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Box
                            sx={{
                              width: 12,
                              height: 12,
                              backgroundColor: status.color,
                              borderRadius: '50%',
                              mr: 1
                            }}
                          />
                          {status.label}
                        </Box>
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setReturnDialogOpen(false)}
            sx={buttonStyles.cancelButton}
          >
            Cancel
          </Button>
          <Button
            onClick={handleReturnToActive}
            variant="contained"
            disabled={!selectedReturnStatus || returning}
            startIcon={returning ? <CircularProgress size={20} /> : <CheckCircleIcon />}
            sx={buttonStyles.primaryButton}
          >
            {returning ? 'Returning...' : 'Return to Active'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PendingOrdersPage;

