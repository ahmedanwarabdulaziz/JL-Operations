import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Paper,
  useTheme
} from '@mui/material';
import {
  People,
  Assignment,
  Receipt,
  TrendingUp
} from '@mui/icons-material';

const StatCard = ({ title, value, icon, color }) => {
  
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box
            sx={{
              backgroundColor: color,
              borderRadius: '50%',
              p: 1,
              mr: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {icon}
          </Box>
          <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
            {value}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
      </CardContent>
    </Card>
  );
};

const DashboardPage = () => {
  const theme = useTheme();

  const stats = [
    {
      title: 'Total Customers',
      value: '1,234',
      icon: <People sx={{ color: 'white' }} />,
      color: theme.palette.primary.main
    },
    {
      title: 'Active Orders',
      value: '56',
      icon: <Assignment sx={{ color: 'white' }} />,
      color: theme.palette.secondary.main
    },
    {
      title: 'Completed Orders',
      value: '892',
      icon: <Receipt sx={{ color: 'white' }} />,
      color: '#4caf50'
    },
    {
      title: 'Revenue',
      value: '$45,678',
      icon: <TrendingUp sx={{ color: 'white' }} />,
      color: '#ff9800'
    }
  ];

  return (
    <Box>
      {/* Welcome Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Welcome to Business Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Here&apos;s an overview of your business performance and key metrics.
        </Typography>
      </Paper>

      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <StatCard {...stat} />
          </Grid>
        ))}
      </Grid>

      {/* Quick Actions */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Quick Actions
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Add new customers, create orders, or view reports to manage your business efficiently.
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Recent Activity
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Track your recent orders, customer interactions, and business updates.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardPage; 