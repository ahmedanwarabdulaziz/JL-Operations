import React from 'react';
import { Typography, Paper, Box, Grid, Card, CardContent } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import AssignmentIcon from '@mui/icons-material/Assignment';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

const DashboardPage = () => (
  <Box sx={{ width: '100%', maxWidth: '100%' }}>
    <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 3 }}>
      Dashboard
    </Typography>
    
    {/* Stats Cards */}
    <Grid container spacing={3} sx={{ mb: 4 }}>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <DashboardIcon sx={{ color: '#1976d2', mr: 1 }} />
              <Typography variant="h6" component="div">
                Total Projects
              </Typography>
            </Box>
            <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
              24
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <PeopleIcon sx={{ color: '#1976d2', mr: 1 }} />
              <Typography variant="h6" component="div">
                Active Users
              </Typography>
            </Box>
            <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
              156
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <AssignmentIcon sx={{ color: '#1976d2', mr: 1 }} />
              <Typography variant="h6" component="div">
                Pending Tasks
              </Typography>
            </Box>
            <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
              8
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <TrendingUpIcon sx={{ color: '#1976d2', mr: 1 }} />
              <Typography variant="h6" component="div">
                Revenue
              </Typography>
            </Box>
            <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
              $12.5K
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
    
    {/* Welcome Section */}
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Welcome to JL Operation!
      </Typography>
      <Typography variant="body1" sx={{ mb: 2 }}>
        This is your central dashboard where you can monitor all your operations, 
        track performance metrics, and manage your business efficiently.
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Get started by exploring the navigation menu on the left to access different features.
      </Typography>
    </Paper>
  </Box>
);

export default DashboardPage; 