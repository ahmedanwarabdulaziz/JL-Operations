import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  TextField,
  Button,
  Paper,
  useTheme,
  useMediaQuery,
  Alert,
  Snackbar
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import BusinessIcon from '@mui/icons-material/Business';

const ContactPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    message: ''
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Here you would typically send the form data to your backend
    console.log('Contact form submitted:', formData);
    
    // Show success message
    setSnackbar({
      open: true,
      message: 'Thank you for your message! We\'ll get back to you soon.',
      severity: 'success'
    });
    
    // Reset form
    setFormData({
      name: '',
      email: '',
      phone: '',
      company: '',
      message: ''
    });
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  const contactInfo = [
    {
      icon: <EmailIcon sx={{ fontSize: 30, color: theme.palette.primary.main }} />,
      title: 'Email',
      content: 'info@jloperations.com',
      link: 'mailto:info@jloperations.com'
    },
    {
      icon: <PhoneIcon sx={{ fontSize: 30, color: theme.palette.primary.main }} />,
      title: 'Phone',
      content: '+1 (555) 123-4567',
      link: 'tel:+15551234567'
    },
    {
      icon: <LocationOnIcon sx={{ fontSize: 30, color: theme.palette.primary.main }} />,
      title: 'Address',
      content: '123 Business Street, Suite 100, City, State 12345',
      link: '#'
    },
    {
      icon: <BusinessIcon sx={{ fontSize: 30, color: theme.palette.primary.main }} />,
      title: 'Business Hours',
      content: 'Monday - Friday: 8:00 AM - 6:00 PM',
      link: '#'
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
            Contact Us
          </Typography>
          <Typography
            variant="h6"
            sx={{
              opacity: 0.9,
              maxWidth: 800,
              mx: 'auto'
            }}
          >
            Get in touch with our team to discuss how we can help optimize your business operations 
            and drive growth for your organization.
          </Typography>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
        <Grid container spacing={6}>
          {/* Contact Form */}
          <Grid item xs={12} lg={7}>
            <Paper elevation={2} sx={{ p: { xs: 3, md: 4 } }}>
              <Typography
                variant="h4"
                component="h2"
                gutterBottom
                sx={{ fontWeight: 600, mb: 3 }}
              >
                Send us a Message
              </Typography>
              <form onSubmit={handleSubmit}>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Full Name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      variant="outlined"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Email Address"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      variant="outlined"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Phone Number"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      variant="outlined"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Company"
                      name="company"
                      value={formData.company}
                      onChange={handleInputChange}
                      variant="outlined"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Message"
                      name="message"
                      value={formData.message}
                      onChange={handleInputChange}
                      required
                      multiline
                      rows={6}
                      variant="outlined"
                      placeholder="Tell us about your business needs and how we can help..."
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      sx={{
                        textTransform: 'none',
                        fontWeight: 600,
                        px: 4,
                        py: 1.5
                      }}
                    >
                      Send Message
                    </Button>
                  </Grid>
                </Grid>
              </form>
            </Paper>
          </Grid>

          {/* Contact Information */}
          <Grid item xs={12} lg={5}>
            <Box>
              <Typography
                variant="h4"
                component="h2"
                gutterBottom
                sx={{ fontWeight: 600, mb: 4 }}
              >
                Get in Touch
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {contactInfo.map((info, index) => (
                  <Box
                    key={index}
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 2,
                      p: 2,
                      borderRadius: 2,
                      backgroundColor: '#f8f9fa',
                      transition: 'background-color 0.2s ease-in-out',
                      '&:hover': {
                        backgroundColor: '#e9ecef'
                      }
                    }}
                  >
                    <Box sx={{ mt: 0.5 }}>
                      {info.icon}
                    </Box>
                    <Box>
                      <Typography
                        variant="h6"
                        component="h3"
                        sx={{ fontWeight: 600, mb: 1 }}
                      >
                        {info.title}
                      </Typography>
                      <Typography
                        variant="body1"
                        color="text.secondary"
                        component={info.link !== '#' ? 'a' : 'span'}
                        href={info.link !== '#' ? info.link : undefined}
                        sx={{
                          textDecoration: 'none',
                          color: 'inherit',
                          '&:hover': {
                            color: theme.palette.primary.main
                          }
                        }}
                      >
                        {info.content}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>

              {/* Quick Actions */}
              <Box sx={{ mt: 6 }}>
                <Typography
                  variant="h5"
                  component="h3"
                  gutterBottom
                  sx={{ fontWeight: 600, mb: 3 }}
                >
                  Quick Actions
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Button
                    component={RouterLink}
                    to="/lead-form"
                    variant="contained"
                    fullWidth
                    sx={{
                      textTransform: 'none',
                      fontWeight: 600,
                      py: 1.5
                    }}
                  >
                    Request a Quote
                  </Button>
                  <Button
                    component={RouterLink}
                    to="/services"
                    variant="outlined"
                    fullWidth
                    sx={{
                      textTransform: 'none',
                      fontWeight: 600,
                      py: 1.5
                    }}
                  >
                    View Our Services
                  </Button>
                </Box>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Container>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ContactPage;
