import React, { useState, useEffect } from 'react';
import { Typography, Box, Card, CardContent, CircularProgress, List, ListItem, ListItemText, Chip, Grid } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import WarningIcon from '@mui/icons-material/Warning';
import EventIcon from '@mui/icons-material/Event';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../../shared/firebase/config';
import { formatDateOnly, toDateObject } from '../../../utils/dateUtils';

const DashboardPage = () => {
  const [upcomingOrders, setUpcomingOrders] = useState([]);
  const [allDeadlineOrders, setAllDeadlineOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deadlineLoading, setDeadlineLoading] = useState(true);

  useEffect(() => {
    fetchUpcomingOrders();
    fetchAllDeadlineOrders();
  }, []);

  const fetchUpcomingOrders = async () => {
    try {
      setLoading(true);
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, orderBy('orderDetails.deadline', 'desc'));
      const querySnapshot = await getDocs(q);

      const today = new Date();
      const eightDaysFromNow = new Date(today);
      eightDaysFromNow.setDate(today.getDate() + 8);
      eightDaysFromNow.setHours(23, 59, 59, 999);

      const upcoming = [];
      
      querySnapshot.docs.forEach(doc => {
        const order = { id: doc.id, ...doc.data() };
        const deadline = order.orderDetails?.deadline;
        
        if (deadline) {
          // Use toDateObject utility for consistent date handling
          const deadlineDate = toDateObject(deadline);
          
          if (deadlineDate && deadlineDate >= today && deadlineDate <= eightDaysFromNow) {
            const daysLeft = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));
            upcoming.push({
              ...order,
              daysLeft,
              deadlineDate
            });
          }
        }
      });

      // Sort by days left (ascending - closest deadline first)
      upcoming.sort((a, b) => a.daysLeft - b.daysLeft);
      setUpcomingOrders(upcoming);
    } catch (err) {
      console.error('Error fetching upcoming orders:', err);
    } finally {
      setLoading(false);
    }
  };


  const fetchAllDeadlineOrders = async () => {
    try {
      setDeadlineLoading(true);
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, orderBy('orderDetails.deadline', 'desc'));
      const querySnapshot = await getDocs(q);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const allDeadlines = [];
      
      querySnapshot.docs.forEach(doc => {
        const order = { id: doc.id, ...doc.data() };
        const deadline = order.orderDetails?.deadline;
        
        if (deadline) {
          // Use toDateObject utility for consistent date handling
          const deadlineDate = toDateObject(deadline);
          
          if (deadlineDate) {
            const daysLeft = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));
            allDeadlines.push({
              ...order,
              daysLeft,
              deadlineDate
            });
          }
        }
      });

      // Sort by deadline date (ascending - closest deadline first)
      allDeadlines.sort((a, b) => {
        if (!a.deadlineDate || !b.deadlineDate) return 0;
        return a.deadlineDate - b.deadlineDate;
      });
      
      setAllDeadlineOrders(allDeadlines);
    } catch (err) {
      console.error('Error fetching all deadline orders:', err);
    } finally {
      setDeadlineLoading(false);
    }
  };

  const getDaysLeftColor = (daysLeft) => {
    if (daysLeft < 0) return '#9e9e9e'; // Gray for past deadlines
    if (daysLeft <= 2) return '#f44336'; // Red for urgent
    if (daysLeft <= 4) return '#ff9800'; // Orange for soon
    return '#2196f3'; // Blue for normal
  };

  return (
    <Box sx={{ width: '100%', maxWidth: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <DashboardIcon sx={{ fontSize: 32, color: '#b98f33', mr: 2 }} />
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
            Dashboard
          </Typography>
        </Box>
      </Box>

      {/* Cards Grid */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Upcoming Orders Card */}
        <Grid item xs={12} md={6}>
          <Card sx={{ 
            width: '100%',
            backgroundColor: '#2a2a2a',
            border: '1px solid #333333',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            height: '100%'
          }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <WarningIcon sx={{ fontSize: 28, color: '#b98f33', mr: 1 }} />
            <Typography variant="h6" sx={{ color: '#b98f33', fontWeight: 'bold' }}>
              Upcoming Deadlines (Within 8 Days)
            </Typography>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
              <CircularProgress size={40} sx={{ color: '#b98f33' }} />
            </Box>
          ) : upcomingOrders.length === 0 ? (
            <Typography variant="body1" sx={{ color: '#ffffff', textAlign: 'center', py: 4 }}>
              No orders with upcoming deadlines in the next 8 days
            </Typography>
          ) : (
            <List sx={{ maxHeight: '500px', overflow: 'auto' }}>
              {upcomingOrders.map((order, index) => (
                <ListItem
                  key={order.id}
                  sx={{
                    backgroundColor: index % 2 === 0 ? '#1a1a1a' : '#2a2a2a',
                    borderRadius: 1,
                    mb: 1,
                    border: '1px solid #333333',
                    '&:hover': {
                      backgroundColor: '#3a3a3a',
                      borderColor: '#b98f33'
                    }
                  }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="body1" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                          Order #{order.orderDetails?.billInvoice || 'N/A'}
                        </Typography>
                        <Chip
                          label={`${order.daysLeft} day${order.daysLeft !== 1 ? 's' : ''} left`}
                          size="small"
                          sx={{
                            backgroundColor: getDaysLeftColor(order.daysLeft),
                            color: '#ffffff',
                            fontWeight: 'bold'
                          }}
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" sx={{ color: '#cccccc', mt: 0.5 }}>
                          {order.personalInfo?.customerName || 'Unknown Customer'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#b98f33', display: 'block', mt: 0.5 }}>
                          Deadline: {formatDateOnly(order.deadlineDate)}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
        </Grid>

        {/* All Invoices with Deadlines Card */}
        <Grid item xs={12} md={6}>
          <Card sx={{ 
            width: '100%',
            backgroundColor: '#2a2a2a',
            border: '1px solid #333333',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            height: '100%'
          }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <EventIcon sx={{ fontSize: 28, color: '#b98f33', mr: 1 }} />
            <Typography variant="h6" sx={{ color: '#b98f33', fontWeight: 'bold' }}>
              All Invoices with Deadlines
            </Typography>
          </Box>

          {deadlineLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
              <CircularProgress size={40} sx={{ color: '#b98f33' }} />
            </Box>
          ) : allDeadlineOrders.length === 0 ? (
            <Typography variant="body1" sx={{ color: '#ffffff', textAlign: 'center', py: 4 }}>
              No invoices with deadlines found
            </Typography>
          ) : (
            <List sx={{ maxHeight: '500px', overflow: 'auto' }}>
              {allDeadlineOrders.map((order, index) => {
                const isPast = order.daysLeft < 0;
                return (
                  <ListItem
                    key={order.id}
                    sx={{
                      backgroundColor: index % 2 === 0 ? '#1a1a1a' : '#2a2a2a',
                      borderRadius: 1,
                      mb: 1,
                      border: '1px solid #333333',
                      opacity: isPast ? 0.7 : 1,
                      '&:hover': {
                        backgroundColor: '#3a3a3a',
                        borderColor: '#b98f33'
                      }
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography variant="body1" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
                            Invoice #{order.orderDetails?.billInvoice || 'N/A'}
                          </Typography>
                          <Chip
                            label={isPast 
                              ? `${Math.abs(order.daysLeft)} day${Math.abs(order.daysLeft) !== 1 ? 's' : ''} overdue`
                              : `${order.daysLeft} day${order.daysLeft !== 1 ? 's' : ''} left`}
                            size="small"
                            sx={{
                              backgroundColor: getDaysLeftColor(order.daysLeft),
                              color: '#ffffff',
                              fontWeight: 'bold'
                            }}
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" sx={{ color: '#cccccc', mt: 0.5 }}>
                            {order.personalInfo?.customerName || 'Unknown Customer'}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#b98f33', display: 'block', mt: 0.5 }}>
                            Deadline: {formatDateOnly(order.deadlineDate)}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                );
              })}
            </List>
          )}
        </CardContent>
      </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardPage; 
