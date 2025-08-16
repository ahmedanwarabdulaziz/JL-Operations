import React from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Link,
  Divider,
  useTheme,
  IconButton
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import FacebookIcon from '@mui/icons-material/Facebook';
import InstagramIcon from '@mui/icons-material/Instagram';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import LocationOnIcon from '@mui/icons-material/LocationOn';

const WebsiteFooter = () => {
  const theme = useTheme();
  const currentYear = new Date().getFullYear();

  return (
    <Box
      component="footer"
      sx={{
        background: 'linear-gradient(135deg, #2c2c2c 0%, #1a1a1a 50%, #333333 100%)',
        color: '#ffffff',
        py: { xs: 4, md: 5 },
        mt: 'auto',
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: 'linear-gradient(90deg, #b98f33 0%, #d4af5a 25%, #b98f33 50%, #d4af5a 75%, #b98f33 100%)'
        }
      }}
    >
      <Container maxWidth="lg">
        {/* Main Footer Content */}
        <Grid container spacing={3}>
          {/* Company Info */}
          <Grid item xs={12} md={4}>
            <Typography 
              variant="h5" 
              sx={{ 
                color: '#b98f33', 
                fontWeight: 900,
                fontFamily: '"Playfair Display", "Times New Roman", serif',
                mb: 2,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                fontSize: '1.5rem'
              }}
            >
              JL Upholstery
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                color: '#cccccc',
                lineHeight: 1.6,
                fontSize: '0.95rem',
                mb: 2
              }}
            >
              Since 1993, bringing furniture value through expert craftsmanship and premium materials.
            </Typography>
            
            {/* Social Media Links */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <IconButton
                size="small"
                sx={{
                  backgroundColor: 'rgba(185, 143, 51, 0.1)',
                  color: '#b98f33',
                  border: '1px solid #b98f33',
                  width: '32px',
                  height: '32px',
                  '&:hover': {
                    backgroundColor: '#b98f33',
                    color: '#ffffff',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 2px 8px rgba(185, 143, 51, 0.3)'
                  },
                  transition: 'all 0.3s ease-in-out'
                }}
              >
                <FacebookIcon sx={{ fontSize: '1rem' }} />
              </IconButton>
              <IconButton
                size="small"
                sx={{
                  backgroundColor: 'rgba(185, 143, 51, 0.1)',
                  color: '#b98f33',
                  border: '1px solid #b98f33',
                  width: '32px',
                  height: '32px',
                  '&:hover': {
                    backgroundColor: '#b98f33',
                    color: '#ffffff',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 2px 8px rgba(185, 143, 51, 0.3)'
                  },
                  transition: 'all 0.3s ease-in-out'
                }}
              >
                <InstagramIcon sx={{ fontSize: '1rem' }} />
              </IconButton>
              <IconButton
                size="small"
                sx={{
                  backgroundColor: 'rgba(185, 143, 51, 0.1)',
                  color: '#b98f33',
                  border: '1px solid #b98f33',
                  width: '32px',
                  height: '32px',
                  '&:hover': {
                    backgroundColor: '#b98f33',
                    color: '#ffffff',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 2px 8px rgba(185, 143, 51, 0.3)'
                  },
                  transition: 'all 0.3s ease-in-out'
                }}
              >
                <LinkedInIcon sx={{ fontSize: '1rem' }} />
              </IconButton>
            </Box>
          </Grid>
          
          {/* Quick Links */}
          <Grid item xs={12} md={2}>
            <Typography 
              variant="h6" 
              sx={{ 
                color: '#b98f33', 
                fontWeight: 700,
                fontFamily: '"Playfair Display", "Times New Roman", serif',
                mb: 2,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                fontSize: '1rem'
              }}
            >
              Services
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Link 
                component={RouterLink} 
                to="/services" 
                sx={{ 
                  color: '#cccccc',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  fontWeight: 400,
                  transition: 'all 0.3s ease-in-out',
                  '&:hover': {
                    color: '#b98f33',
                    transform: 'translateX(3px)'
                  }
                }}
              >
                Indoor Upholstery
              </Link>
              <Link 
                component={RouterLink} 
                to="/services" 
                sx={{ 
                  color: '#cccccc',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  fontWeight: 400,
                  transition: 'all 0.3s ease-in-out',
                  '&:hover': {
                    color: '#b98f33',
                    transform: 'translateX(3px)'
                  }
                }}
              >
                Commercial Upholstery
              </Link>
              <Link 
                component={RouterLink} 
                to="/services" 
                sx={{ 
                  color: '#cccccc',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  fontWeight: 400,
                  transition: 'all 0.3s ease-in-out',
                  '&:hover': {
                    color: '#b98f33',
                    transform: 'translateX(3px)'
                  }
                }}
              >
                Outdoor Upholstery
              </Link>
            </Box>
          </Grid>
          
          {/* Company Links */}
          <Grid item xs={12} md={2}>
            <Typography 
              variant="h6" 
              sx={{ 
                color: '#b98f33', 
                fontWeight: 700,
                fontFamily: '"Playfair Display", "Times New Roman", serif',
                mb: 2,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                fontSize: '1rem'
              }}
            >
              Company
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Link 
                component={RouterLink} 
                to="/about" 
                sx={{ 
                  color: '#cccccc',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  fontWeight: 400,
                  transition: 'all 0.3s ease-in-out',
                  '&:hover': {
                    color: '#b98f33',
                    transform: 'translateX(3px)'
                  }
                }}
              >
                About Us
              </Link>
              <Link 
                component={RouterLink} 
                to="/contact" 
                sx={{ 
                  color: '#cccccc',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  fontWeight: 400,
                  transition: 'all 0.3s ease-in-out',
                  '&:hover': {
                    color: '#b98f33',
                    transform: 'translateX(3px)'
                  }
                }}
              >
                Contact
              </Link>
              <Link 
                component={RouterLink} 
                to="/gallery" 
                sx={{ 
                  color: '#cccccc',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  fontWeight: 400,
                  transition: 'all 0.3s ease-in-out',
                  '&:hover': {
                    color: '#b98f33',
                    transform: 'translateX(3px)'
                  }
                }}
              >
                Gallery
              </Link>
            </Box>
          </Grid>
          
          {/* Contact Info */}
          <Grid item xs={12} md={4}>
            <Typography 
              variant="h6" 
              sx={{ 
                color: '#b98f33', 
                fontWeight: 700,
                fontFamily: '"Playfair Display", "Times New Roman", serif',
                mb: 2,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                fontSize: '1rem'
              }}
            >
              Contact Info
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <LocationOnIcon sx={{ color: '#b98f33', fontSize: '1.2rem' }} />
                <Typography variant="body2" sx={{ color: '#cccccc', fontSize: '0.9rem' }}>
                  123 Upholstery Lane, Milton, ON
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <PhoneIcon sx={{ color: '#b98f33', fontSize: '1.2rem' }} />
                <Typography variant="body2" sx={{ color: '#cccccc', fontSize: '0.9rem' }}>
                  +1 (905) 555-0123
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <EmailIcon sx={{ color: '#b98f33', fontSize: '1.2rem' }} />
                <Typography variant="body2" sx={{ color: '#cccccc', fontSize: '0.9rem' }}>
                  info@jlupholstery.com
                </Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>
        
        {/* Divider */}
        <Divider sx={{ 
          my: 3, 
          borderColor: 'rgba(185, 143, 51, 0.3)',
          borderWidth: '1px'
        }} />
        
        {/* Bottom Footer */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap',
          gap: 2
        }}>
          <Typography 
            variant="body2" 
            sx={{ 
              color: '#cccccc',
              fontSize: '0.85rem'
            }}
          >
            © {currentYear} JL Upholstery. All rights reserved. | Since 1993
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Link 
              href="#" 
              sx={{ 
                color: '#cccccc',
                textDecoration: 'none',
                fontSize: '0.85rem',
                transition: 'all 0.3s ease-in-out',
                '&:hover': {
                  color: '#b98f33'
                }
              }}
            >
              Privacy Policy
            </Link>
            <Link 
              href="#" 
              sx={{ 
                color: '#cccccc',
                textDecoration: 'none',
                fontSize: '0.85rem',
                transition: 'all 0.3s ease-in-out',
                '&:hover': {
                  color: '#b98f33'
                }
              }}
            >
              Terms of Service
            </Link>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default WebsiteFooter;
