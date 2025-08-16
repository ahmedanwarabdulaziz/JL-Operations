import React from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Button,
  useTheme,
  useMediaQuery,
  Paper
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import BusinessIcon from '@mui/icons-material/Business';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import SupportIcon from '@mui/icons-material/Support';
import EngineeringIcon from '@mui/icons-material/Engineering';
import InventoryIcon from '@mui/icons-material/Inventory';
import AssignmentIcon from '@mui/icons-material/Assignment';

const ServicesPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const services = [
    {
      icon: <BusinessIcon sx={{ fontSize: 50, color: theme.palette.primary.main }} />,
      title: 'Operations Management',
      description: 'Comprehensive business operations management to streamline your processes and improve efficiency.',
      features: ['Process Optimization', 'Workflow Automation', 'Performance Monitoring', 'Resource Management']
    },
    {
      icon: <EngineeringIcon sx={{ fontSize: 50, color: theme.palette.primary.main }} />,
      title: 'Workshop Management',
      description: 'Specialized workshop and manufacturing management solutions for production environments.',
      features: ['Production Planning', 'Quality Control', 'Equipment Management', 'Safety Compliance']
    },
    {
      icon: <InventoryIcon sx={{ fontSize: 50, color: theme.palette.primary.main }} />,
      title: 'Inventory & Materials',
      description: 'Complete inventory and material management system to track and optimize your stock levels.',
      features: ['Stock Tracking', 'Supplier Management', 'Cost Analysis', 'Reorder Automation']
    },
    {
      icon: <AnalyticsIcon sx={{ fontSize: 50, color: theme.palette.primary.main }} />,
      title: 'Data Analytics',
      description: 'Advanced analytics and reporting tools to make informed business decisions.',
      features: ['Real-time Dashboards', 'Custom Reports', 'Performance Metrics', 'Trend Analysis']
    },
    {
      icon: <AssignmentIcon sx={{ fontSize: 50, color: theme.palette.primary.main }} />,
      title: 'Order Management',
      description: 'End-to-end order processing and customer management system.',
      features: ['Order Tracking', 'Customer Portal', 'Invoice Generation', 'Payment Processing']
    },
    {
      icon: <SupportIcon sx={{ fontSize: 50, color: theme.palette.primary.main }} />,
      title: '24/7 Support',
      description: 'Round-the-clock professional support to ensure your operations run smoothly.',
      features: ['Technical Support', 'Training Programs', 'System Maintenance', 'Emergency Response']
    }
  ];

  return (
    <Box>
      {/* Hero Section */}
      <Box
        sx={{
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          color: 'white',
          py: { xs: 6, md: 8 },
          textAlign: 'center'
        }}
      >
        <Container maxWidth="lg">
          <Typography
            variant={isMobile ? 'h3' : 'h2'}
            component="h1"
            gutterBottom
            sx={{
              fontWeight: 'bold',
              mb: 3
            }}
          >
            Our Services
          </Typography>
          <Typography
            variant="h6"
            sx={{
              opacity: 0.9,
              maxWidth: 800,
              mx: 'auto'
            }}
          >
            Comprehensive business solutions designed to optimize your operations, 
            improve efficiency, and drive growth across all aspects of your business.
          </Typography>
        </Container>
      </Box>

      {/* Services Grid */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
        <Grid container spacing={4}>
          {services.map((service, index) => (
            <Grid item xs={12} md={6} lg={4} key={index}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: theme.shadows[8]
                  }
                }}
              >
                <CardContent sx={{ flexGrow: 1, p: 3 }}>
                  <Box sx={{ textAlign: 'center', mb: 3 }}>
                    {service.icon}
                  </Box>
                  <Typography
                    variant="h5"
                    component="h3"
                    gutterBottom
                    sx={{
                      fontWeight: 600,
                      textAlign: 'center',
                      mb: 2
                    }}
                  >
                    {service.title}
                  </Typography>
                  <Typography
                    variant="body1"
                    color="text.secondary"
                    paragraph
                    sx={{ mb: 3, textAlign: 'center' }}
                  >
                    {service.description}
                  </Typography>
                  <Box>
                    {service.features.map((feature, featureIndex) => (
                      <Typography
                        key={featureIndex}
                        variant="body2"
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          mb: 1,
                          '&::before': {
                            content: '""',
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            backgroundColor: theme.palette.primary.main,
                            mr: 1.5,
                            flexShrink: 0
                          }
                        }}
                      >
                        {feature}
                      </Typography>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* CTA Section */}
      <Box
        sx={{
          backgroundColor: '#f5f5f5',
          py: { xs: 6, md: 8 }
        }}
      >
        <Container maxWidth="lg">
          <Paper
            elevation={0}
            sx={{
              p: { xs: 4, md: 6 },
              textAlign: 'center',
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              color: 'white'
            }}
          >
            <Typography
              variant={isMobile ? 'h4' : 'h3'}
              component="h2"
              gutterBottom
              sx={{ fontWeight: 'bold', mb: 3 }}
            >
              Ready to Transform Your Operations?
            </Typography>
            <Typography
              variant="h6"
              paragraph
              sx={{ mb: 4, opacity: 0.9 }}
            >
              Get started today and discover how our comprehensive solutions can 
              streamline your business processes and drive growth.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                component={RouterLink}
                to="/contact"
                variant="contained"
                size="large"
                sx={{
                  backgroundColor: 'white',
                  color: theme.palette.primary.main,
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 4,
                  py: 1.5,
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.9)'
                  }
                }}
              >
                Contact Us
              </Button>
              <Button
                component={RouterLink}
                to="/lead-form"
                variant="outlined"
                size="large"
                sx={{
                  borderColor: 'white',
                  color: 'white',
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 4,
                  py: 1.5,
                  '&:hover': {
                    borderColor: 'white',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)'
                  }
                }}
              >
                Get Quote
              </Button>
            </Box>
          </Paper>
        </Container>
      </Box>
    </Box>
  );
};

export default ServicesPage;
