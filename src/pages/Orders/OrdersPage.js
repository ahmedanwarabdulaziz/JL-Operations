import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  Avatar,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Person as PersonIcon,
  Receipt as ReceiptIcon,
  CalendarToday as CalendarIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  FlashOn as FlashOnIcon,
  Business as BusinessIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../../components/Common/NotificationSystem';
import { collection, getDocs, deleteDoc, doc, query, orderBy, addDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import Step5Review from './steps/Step5Review';
import FastOrderModal from '../../components/FastOrder/FastOrderModal';
import { calculateOrderTotal, formatFurnitureDetails, isRapidOrder } from '../../utils/orderCalculations';
import { buttonStyles } from '../../styles/buttonStyles';
import { formatDate } from '../../utils/dateUtils';

const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [fastOrderModalOpen, setFastOrderModalOpen] = useState(false);
  const [orderFilter, setOrderFilter] = useState('all'); // 'all', 'individual', 'corporate'

  const { showSuccess, showError, showConfirm } = useNotification();
  const navigate = useNavigate();

  // Sort orders by bill number (highest to lowest)
  const sortOrdersByBillNumber = (ordersList) => {
    return ordersList.sort((a, b) => {
      const billA = parseInt(a.orderDetails?.billInvoice || '0', 10);
      const billB = parseInt(b.orderDetails?.billInvoice || '0', 10);
      return billB - billA; // Descending order (highest first)
    });
  };

  // Fetch customers from Firebase
  const fetchCustomers = useCallback(async () => {
    try {
      const customersRef = collection(db, 'customers');
      const customersSnapshot = await getDocs(customersRef);
      const customersData = customersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCustomers(customersData);
    } catch (error) {
      console.error('Error fetching customers:', error);
      showError('Failed to fetch customers');
    }
  }, [showError]);

  // Fetch orders from Firebase
  const fetchOrders = useCallback(async () => {
    try {
      console.log('Starting to fetch orders...');
      setLoading(true);
      
      // Add a timeout to prevent infinite loading
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 10000)
      );
      
      // Fetch regular orders
      const ordersCollection = collection(db, 'orders');
      const ordersQuery = query(ordersCollection, orderBy('orderDetails.billInvoice', 'desc'));
      const ordersDataPromise = getDocs(ordersQuery);
      
      // Fetch corporate orders
      const corporateOrdersCollection = collection(db, 'corporate-orders');
      const corporateOrdersQuery = query(corporateOrdersCollection, orderBy('orderDetails.billInvoice', 'desc'));
      const corporateOrdersDataPromise = getDocs(corporateOrdersQuery);
      
      const [ordersSnapshot, corporateOrdersSnapshot] = await Promise.race([
        Promise.all([ordersDataPromise, corporateOrdersDataPromise]),
        timeoutPromise
      ]);
      
      const ordersData = ordersSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        orderType: 'regular'
      }));
      
      const corporateOrdersData = corporateOrdersSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        orderType: 'corporate'
      }));
      
      // Combine and sort all orders by bill invoice number
      const allOrdersData = [...ordersData, ...corporateOrdersData];
      
      console.log('All orders data received:', allOrdersData);
      
      // Get invoice statuses to identify end states
      const statusesRef = collection(db, 'invoiceStatuses');
      const statusesSnapshot = await getDocs(statusesRef);
      const statusesData = statusesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Filter out orders with end state statuses
      const endStateStatuses = statusesData.filter(status => 
        status.isEndState
      );
      const endStateValues = endStateStatuses.map(status => status.value);

      const activeOrders = allOrdersData.filter(order => 
        !endStateValues.includes(order.invoiceStatus)
      );
      
      console.log('Filtered active orders:', activeOrders);
      
      // Sort by bill number (highest to lowest)
      const sortedOrders = sortOrdersByBillNumber(activeOrders);
      console.log('Sorted active orders:', sortedOrders);
      
      setOrders(sortedOrders);
      const filtered = applyFiltersAndSearch(sortedOrders, searchTerm, orderFilter);
      setFilteredOrders(filtered);
    } catch (error) {
      console.error('Error fetching orders:', error);
      showError(`Failed to fetch orders: ${error.message}`);
      // Set empty arrays to prevent infinite loading
      setOrders([]);
      setFilteredOrders([]);
    } finally {
      console.log('Setting loading to false');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchCustomers();
  }, [fetchOrders, fetchCustomers]);

  // Apply filters and search
  const applyFiltersAndSearch = (ordersList, searchValue, filterType) => {
    let filtered = [...ordersList];

    // Apply order type filter
    if (filterType === 'individual') {
      filtered = filtered.filter(order => order.orderType !== 'corporate');
    } else if (filterType === 'corporate') {
      filtered = filtered.filter(order => order.orderType === 'corporate');
    }

    // Apply search filter
    if (searchValue.trim()) {
    const searchLower = searchValue.toLowerCase();
      filtered = filtered.filter(order => {
        // Search in bill number
      const orderDetails = order.orderDetails || {};
      if (orderDetails.billInvoice?.toLowerCase().includes(searchLower)) {
        return true;
      }

        // Search in customer info (different for corporate vs individual)
        if (order.orderType === 'corporate') {
          const corporateCustomer = order.corporateCustomer || {};
          if (
            corporateCustomer.corporateName?.toLowerCase().includes(searchLower) ||
            corporateCustomer.email?.toLowerCase().includes(searchLower) ||
            corporateCustomer.phone?.toLowerCase().includes(searchLower) ||
            corporateCustomer.address?.toLowerCase().includes(searchLower)
          ) {
            return true;
          }
        } else {
      const personalInfo = order.personalInfo || {};
      if (
        personalInfo.customerName?.toLowerCase().includes(searchLower) ||
        personalInfo.email?.toLowerCase().includes(searchLower) ||
        personalInfo.phone?.toLowerCase().includes(searchLower) ||
        personalInfo.address?.toLowerCase().includes(searchLower)
      ) {
        return true;
      }
        }

        // Search in payment data
        const paymentData = order.paymentData || order.paymentDetails || {};
        if (paymentData.notes?.toLowerCase().includes(searchLower)) {
        return true;
      }

        // Search in furniture data
        const furnitureData = order.furnitureData || order.furnitureGroups || {};
      if (furnitureData.groups) {
        return furnitureData.groups.some(group => 
          group.furnitureType?.toLowerCase().includes(searchLower) ||
          group.materialCompany?.toLowerCase().includes(searchLower) ||
          group.materialCode?.toLowerCase().includes(searchLower) ||
          group.labourNote?.toLowerCase().includes(searchLower) ||
          group.foamNote?.toLowerCase().includes(searchLower) ||
          group.customerNote?.toLowerCase().includes(searchLower)
        );
      }

      return false;
    });
    }

    return sortOrdersByBillNumber(filtered);
  };

  // Global search function
  const handleSearch = (searchValue) => {
    setSearchTerm(searchValue);
    const filtered = applyFiltersAndSearch(orders, searchValue, orderFilter);
    setFilteredOrders(filtered);
  };

  // Handle filter change
  const handleFilterChange = (filterType) => {
    setOrderFilter(filterType);
    const filtered = applyFiltersAndSearch(orders, searchTerm, filterType);
    setFilteredOrders(filtered);
  };

  // Handle order deletion
  const handleDeleteOrder = async () => {
    if (!orderToDelete) return;

    try {
      setDeleting(true);
      const ordersCollection = collection(db, 'orders');
      await deleteDoc(doc(ordersCollection, orderToDelete.id));
      
      setOrders(prev => prev.filter(order => order.id !== orderToDelete.id));
      setFilteredOrders(prev => prev.filter(order => order.id !== orderToDelete.id));
      
      showSuccess('Order deleted successfully');
      setDeleteDialogOpen(false);
      setOrderToDelete(null);
    } catch (error) {
      console.error('Error deleting order:', error);
      showError('Failed to delete order');
    } finally {
      setDeleting(false);
    }
  };

  // Using shared calculateOrderTotal utility for consistency

  // Handle fast order submission
  const handleFastOrderSubmit = async (orderData) => {
    try {
      // Check if this is a new customer (not using existing customer)
      const { personalInfo } = orderData;
      const isNewCustomer = !customers.some(customer => 
        customer.name === personalInfo.customerName && 
        customer.email === personalInfo.email
      );

      // If this is a new customer, save to customers collection
      if (isNewCustomer) {
        const customerData = {
          name: personalInfo.customerName,
          phone: personalInfo.phone || '',
          email: personalInfo.email,
          address: personalInfo.address || '',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        await addDoc(collection(db, 'customers'), customerData);
        showSuccess('New customer created and fast order saved successfully!');
      } else {
        showSuccess('Fast order created successfully!');
      }
      
      // Ensure orderData has proper createdAt field
      const orderDataWithTimestamp = {
        ...orderData,
        createdAt: orderData.createdAt || new Date(),
        updatedAt: orderData.updatedAt || new Date()
      };
      
      console.log('Fast order data being saved:', orderDataWithTimestamp);
      
      // Add the order to Firebase
      const docRef = await addDoc(collection(db, 'orders'), orderDataWithTimestamp);
      
      // Refresh both orders and customers lists
      await fetchOrders();
      await fetchCustomers();
      
      setFastOrderModalOpen(false);
    } catch (error) {
      console.error('Error creating fast order:', error);
      showError('Failed to create fast order. Please try again.');
      throw error; // Re-throw to let the modal handle it
    }
  };

  // Get status chip color
  const getStatusColor = (order) => {
    const requiredDeposit = parseFloat(order.paymentData?.deposit) || 0;
    const amountPaid = parseFloat(order.paymentData?.amountPaid) || 0;
    const depositReceived = order.paymentData?.depositReceived;
    
    // If deposit is received or amount paid >= required deposit, show green
    if (depositReceived || (amountPaid >= requiredDeposit && requiredDeposit > 0)) {
      return 'success';
    }
    // If some payment made but not enough, show orange
    if (amountPaid > 0) {
      return 'warning';
    }
    // If no payment made, show red
    return 'error';
  };

  // Get status text
  const getStatusText = (order) => {
    const requiredDeposit = parseFloat(order.paymentData?.deposit) || 0;
    const amountPaid = parseFloat(order.paymentData?.amountPaid) || 0;
    const depositReceived = order.paymentData?.depositReceived;
    
    // Match the same logic as getStatusColor
    if (depositReceived || (amountPaid >= requiredDeposit && requiredDeposit > 0)) {
      return 'Deposit Received';
    }
    if (amountPaid > 0) {
      return 'Partial';
    }
    return 'Not Paid';
  };

  if (loading) {
    console.log('Orders page is in loading state');
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 3,
        flexWrap: 'wrap',
        gap: 2
      }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
            Orders Management
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Manage and review all customer orders • Click column headers to sort
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<FlashOnIcon />}
            onClick={() => setFastOrderModalOpen(true)}
            sx={{
              ...buttonStyles.primaryButton,
              minWidth: 150,
              px: 3,
              flexShrink: 0,
              fontWeight: 'bold'
            }}
          >
            Fast Order
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/admin/orders/new')}
            sx={{
              ...buttonStyles.primaryButton,
              minWidth: 150,
              px: 3,
              flexShrink: 0,
              fontWeight: 'bold'
            }}
          >
            Add Order
          </Button>
          <Button
            variant="contained"
            startIcon={<BusinessIcon />}
            onClick={() => navigate('/admin/orders/corporate')}
            sx={{
              ...buttonStyles.primaryButton,
              minWidth: 150,
              px: 3,
              flexShrink: 0,
              fontWeight: 'bold',
              backgroundColor: '#1976d2',
              '&:hover': {
                backgroundColor: '#1565c0'
              }
            }}
          >
            Corporate Order
          </Button>
        </Box>
      </Box>

      {/* Search and Stats */}
      <Grid container spacing={3} sx={{ mb: 3, flexShrink: 0 }}>
        <Grid xs={12} md={8}>
          <TextField
            fullWidth
            placeholder="Search by bill number, name, email, phone, address, or any field..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
              endAdornment: searchTerm && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => handleSearch('')}>
                    <RefreshIcon />
                  </IconButton>
                </InputAdornment>
              )
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                backgroundColor: 'background.paper',
                '&:hover': {
                  backgroundColor: 'action.hover'
                }
              }
            }}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <Card 
            sx={{ 
              background: orderFilter === 'all' 
                ? 'linear-gradient(135deg, #b98f33 0%, #8b6b1f 100%)'
                : 'linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%)',
              color: orderFilter === 'all' ? '#000000' : '#666666',
              border: orderFilter === 'all' ? '2px solid #b98f33' : '2px solid #e0e0e0',
              borderRadius: 2,
              boxShadow: orderFilter === 'all' 
                ? '0 4px 20px rgba(185, 143, 51, 0.3)'
                : '0 2px 8px rgba(0,0,0,0.1)',
              position: 'relative',
              cursor: 'pointer',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: orderFilter === 'all' 
                  ? '0 6px 25px rgba(185, 143, 51, 0.4)'
                  : '0 4px 15px rgba(0,0,0,0.15)'
              },
              transition: 'all 0.3s ease-in-out',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '50%',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
                borderRadius: '2px 2px 0 0',
                pointerEvents: 'none'
              }
            }}
            onClick={() => handleFilterChange('all')}
          >
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: orderFilter === 'all' ? '#000000' : '#666666' }}>
                {orders.length}
              </Typography>
              <Typography variant="body2" sx={{ color: orderFilter === 'all' ? '#000000' : '#666666' }}>
                Total Orders
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card 
            sx={{ 
              background: orderFilter === 'individual' 
                ? 'linear-gradient(135deg, #274290 0%, #1a2f5c 100%)'
                : 'linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%)',
              color: orderFilter === 'individual' ? '#ffffff' : '#666666',
              border: orderFilter === 'individual' ? '2px solid #274290' : '2px solid #e0e0e0',
              borderRadius: 2,
              boxShadow: orderFilter === 'individual' 
                ? '0 4px 20px rgba(39, 66, 144, 0.3)'
                : '0 2px 8px rgba(0,0,0,0.1)',
              position: 'relative',
              cursor: 'pointer',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: orderFilter === 'individual' 
                  ? '0 6px 25px rgba(39, 66, 144, 0.4)'
                  : '0 4px 15px rgba(0,0,0,0.15)'
              },
              transition: 'all 0.3s ease-in-out',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '50%',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
                borderRadius: '2px 2px 0 0',
                pointerEvents: 'none'
              }
            }}
            onClick={() => handleFilterChange('individual')}
          >
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: orderFilter === 'individual' ? '#ffffff' : '#666666' }}>
                {orders.filter(order => order.orderType !== 'corporate').length}
              </Typography>
              <Typography variant="body2" sx={{ color: orderFilter === 'individual' ? '#ffffff' : '#666666' }}>
                Individual Orders
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card 
            sx={{ 
              background: orderFilter === 'corporate' 
                ? 'linear-gradient(135deg, #f27921 0%, #d65a00 100%)'
                : 'linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%)',
              color: orderFilter === 'corporate' ? '#ffffff' : '#666666',
              border: orderFilter === 'corporate' ? '2px solid #f27921' : '2px solid #e0e0e0',
            borderRadius: 2,
              boxShadow: orderFilter === 'corporate' 
                ? '0 4px 20px rgba(242, 121, 33, 0.3)'
                : '0 2px 8px rgba(0,0,0,0.1)',
            position: 'relative',
              cursor: 'pointer',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: orderFilter === 'corporate' 
                  ? '0 6px 25px rgba(242, 121, 33, 0.4)'
                  : '0 4px 15px rgba(0,0,0,0.15)'
              },
              transition: 'all 0.3s ease-in-out',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '50%',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
              borderRadius: '2px 2px 0 0',
              pointerEvents: 'none'
            }
            }}
            onClick={() => handleFilterChange('corporate')}
          >
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: orderFilter === 'corporate' ? '#ffffff' : '#666666' }}>
                {orders.filter(order => order.orderType === 'corporate').length}
              </Typography>
              <Typography variant="body2" sx={{ color: orderFilter === 'corporate' ? '#ffffff' : '#666666' }}>
                Corporate Orders
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>


      {/* Orders Table */}
      <TableContainer component={Paper} sx={{ boxShadow: 2 }}>
        <Table>
          <TableHead sx={{ backgroundColor: '#274290' }}>
            <TableRow>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', textAlign: 'center', verticalAlign: 'middle' }}>Invoice</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', textAlign: 'center', verticalAlign: 'middle' }}>Customer</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', textAlign: 'center', verticalAlign: 'middle' }}>Total Invoice</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', textAlign: 'center', verticalAlign: 'middle' }}>Deposit Required</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', textAlign: 'center', verticalAlign: 'middle' }}>Total Paid</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', textAlign: 'center', verticalAlign: 'middle' }}>Status</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', textAlign: 'center', verticalAlign: 'middle' }}>Date</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', textAlign: 'center', verticalAlign: 'middle' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="h6" color="text.secondary">
                      {searchTerm ? 'No orders found matching your search' : 'No orders found'}
                    </Typography>
                    {!searchTerm && (
                      <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => navigate('/admin/orders/new')}
                        sx={{
                          ...buttonStyles.primaryButton,
                          mt: 2,
                          minWidth: 180,
                          px: 4,
                          py: 1.5,
                          fontSize: '1.1rem',
                          fontWeight: 'bold'
                        }}
                      >
                        Create First Order
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <TableRow key={order.id} hover sx={{ '&:hover': { backgroundColor: 'action.hover' } }}>
                    <TableCell sx={{ textAlign: 'center', verticalAlign: 'middle' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ReceiptIcon sx={{ mr: 1, color: '#b98f33', fontSize: 24 }} />
                        <Typography variant="h5" sx={{ 
                          fontWeight: 'bold', 
                          color: '#b98f33',
                          fontSize: '1.5rem',
                          textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                        }}>
                          {order.orderDetails?.billInvoice || 'N/A'}
                        </Typography>
                        </Box>
                        {order.orderType === 'corporate' && (
                          <Chip 
                            label="Corporate" 
                            size="small" 
                            sx={{ 
                              mt: 0.5,
                              backgroundColor: '#1976d2',
                              color: 'white',
                              fontWeight: 'bold',
                              fontSize: '0.75rem'
                            }} 
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center', verticalAlign: 'middle' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Avatar sx={{ mr: 2, bgcolor: order.orderType === 'corporate' ? 'secondary.main' : 'primary.main' }}>
                          {order.orderType === 'corporate' ? <BusinessIcon /> : <PersonIcon />}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                            {order.orderType === 'corporate' 
                              ? order.corporateCustomer?.corporateName || 'N/A'
                              : order.personalInfo?.customerName || 'N/A'
                            }
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {order.orderType === 'corporate' 
                              ? order.corporateCustomer?.email || 'No email'
                              : order.personalInfo?.email || 'No email'
                            }
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {order.orderType === 'corporate' 
                              ? order.corporateCustomer?.phone || 'No phone'
                              : order.personalInfo?.phone || 'No phone'
                            }
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center', verticalAlign: 'middle' }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#f27921' }}>
                        ${order.orderType === 'corporate' 
                          ? (parseFloat(order.paymentDetails?.total) || 0).toFixed(2)
                          : calculateOrderTotal(order).toFixed(2)
                        }
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center', verticalAlign: 'middle' }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                        ${order.orderType === 'corporate' 
                          ? (parseFloat(order.paymentDetails?.deposit) || 0).toFixed(2)
                          : (parseFloat(order.paymentData?.deposit) || 0).toFixed(2)
                        }
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center', verticalAlign: 'middle' }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                        ${order.orderType === 'corporate' 
                          ? (parseFloat(order.paymentDetails?.amountPaid) || 0).toFixed(2)
                          : (parseFloat(order.paymentData?.amountPaid) || 0).toFixed(2)
                        }
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center', verticalAlign: 'middle' }}>
                      {order.orderDetails?.financialStatus || (order.orderType === 'corporate' && parseFloat(order.paymentDetails?.deposit) > 0) ? (
                        <Chip
                          label={order.orderDetails?.financialStatus || 
                            (order.orderType === 'corporate' && parseFloat(order.paymentDetails?.amountPaid) >= parseFloat(order.paymentDetails?.deposit) ? 'Deposit Paid' : 'Deposit Not Paid')
                          }
                          size="small"
                          sx={{
                            backgroundColor: (order.orderDetails?.financialStatus || 
                              (order.orderType === 'corporate' && parseFloat(order.paymentDetails?.amountPaid) >= parseFloat(order.paymentDetails?.deposit) ? 'Deposit Paid' : 'Deposit Not Paid')
                            ) === 'Deposit Paid' ? '#4CAF50' : '#F44336',
                            color: 'white',
                            fontWeight: 'bold',
                            border: 'none',
                            outline: 'none'
                          }}
                        />
                      ) : (
                        <Chip
                          label={getStatusText(order)}
                          size="small"
                          sx={{
                            backgroundColor: getStatusColor(order) === 'success' ? '#4CAF50' : 
                                           getStatusColor(order) === 'warning' ? '#FF9800' : 
                                           getStatusColor(order) === 'error' ? '#F44336' : '#757575',
                            color: 'white',
                            fontWeight: 'bold',
                            border: 'none',
                            outline: 'none'
                          }}
                        />
                      )}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center', verticalAlign: 'middle' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CalendarIcon sx={{ mr: 1, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          {formatDate(order.createdAt)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center', verticalAlign: 'middle' }}>
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => {
                              setSelectedOrder(order);
                              setViewDialogOpen(true);
                            }}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit Order">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => {
                              // Navigate to edit order page with order data and go directly to review step
                              navigate('/admin/orders/new', { 
                                state: { 
                                  editMode: true, 
                                  orderData: order,
                                  activeStep: 4 // Go directly to review step (Step 5)
                                } 
                              });
                            }}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Order">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => {
                              setOrderToDelete(order);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

      {/* View Order Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <ReceiptIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">Order Details</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedOrder && (
            <Box sx={{ mt: 2 }}>
              <Step5Review
                personalInfo={selectedOrder.personalInfo || {}}
                orderDetails={selectedOrder.orderDetails || {}}
                furnitureGroups={selectedOrder.furnitureData?.groups || []}
                paymentDetails={selectedOrder.paymentData || {}}
                onEditStep={(stepIndex) => {
                  setViewDialogOpen(false);
                  // Navigate to edit order page with order data and specific step
                  navigate('/admin/orders/new', { 
                    state: { 
                      editMode: true, 
                      orderData: selectedOrder,
                      activeStep: 4 // Go directly to review step
                    } 
                  });
                }}
                showEditButtons={false}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)} sx={buttonStyles.cancelButton}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This action cannot be undone. The order will be permanently deleted.
          </Alert>
          <Typography>
            Are you sure you want to delete the order for{' '}
            <strong>{orderToDelete?.personalInfo?.customerName}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} sx={buttonStyles.cancelButton}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleDeleteOrder}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : <DeleteIcon />}
            sx={buttonStyles.dangerButton}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Fast Order Modal */}
      <FastOrderModal
        open={fastOrderModalOpen}
        onClose={() => setFastOrderModalOpen(false)}
        onSubmit={handleFastOrderSubmit}
        customers={customers}
      />
    </Box>
  );
};

export default OrdersPage; 