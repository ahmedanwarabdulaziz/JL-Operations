import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Container,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemText,
  useTheme,
  useMediaQuery
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { Link as RouterLink } from 'react-router-dom';

const WebsiteHeader = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const navItems = [
    { text: 'Home', path: '/' },
    { text: 'Services', path: '/services' },
    { text: 'About', path: '/about' },
    { text: 'Contact', path: '/contact' }
  ];

  const drawer = (
    <Box onClick={handleDrawerToggle} sx={{ textAlign: 'center' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 2 }}>
        <img 
          src="/assets/images/logo-001.png" 
          alt="JL Operations Logo" 
          style={{ 
            height: '40px', 
            width: 'auto',
            objectFit: 'contain',
            marginBottom: '8px'
          }}
        />
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
          JL Operations
        </Typography>
      </Box>
             <List>
         {navItems.map((item) => (
           <ListItem key={item.text} component={RouterLink} to={item.path}>
             <ListItemText primary={item.text} />
           </ListItem>
         ))}
       </List>
    </Box>
  );

  return (
    <>
             <AppBar position="sticky" sx={{ 
         background: 'linear-gradient(135deg, #f8f8f8 0%, #e8e8e8 50%, #d8d8d8 100%)',
         color: '#333333',
         boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
         borderBottom: '1px solid #d0d0d0',
         '& .MuiToolbar-root': {
           backgroundColor: 'transparent'
         }
       }}>
        <Container maxWidth="lg">
          <Toolbar sx={{ justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <img 
                src="/assets/images/logo-001.png" 
                alt="JL Operations Logo" 
                style={{ 
                  height: '50px', 
                  width: 'auto',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                }}
              />
              <Typography
                variant="h6"
                component={RouterLink}
                to="/"
                                 sx={{
                   textDecoration: 'none',
                   color: '#333333',
                   fontWeight: 'bold',
                   fontSize: '1.5rem',
                   '&:hover': {
                     color: '#222222'
                   }
                 }}
              >
                JL Operations
              </Typography>
            </Box>

            {isMobile ? (
              <IconButton
                color="inherit"
                aria-label="open drawer"
                edge="start"
                onClick={handleDrawerToggle}
                                 sx={{
                   color: '#333333',
                   background: 'rgba(255,255,255,0.3)',
                   border: '1px solid rgba(255,255,255,0.5)',
                   borderRadius: '6px',
                   boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                   '&:hover': {
                     background: 'rgba(255,255,255,0.5)',
                     border: '1px solid rgba(255,255,255,0.7)',
                     boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                     transform: 'translateY(-1px)'
                   }
                 }}
              >
                <MenuIcon />
              </IconButton>
                         ) : (
               <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                 {navItems.map((item) => (
                   <Typography
                     key={item.text}
                     component={RouterLink}
                     to={item.path}
                     sx={{
                       textDecoration: 'none',
                       color: '#333333',
                       fontWeight: 500,
                       fontSize: '1rem',
                       cursor: 'pointer',
                       transition: 'color 0.2s ease',
                       '&:hover': {
                         color: '#666666'
                       }
                     }}
                   >
                     {item.text}
                   </Typography>
                 ))}
               </Box>
             )}
          </Toolbar>
        </Container>
      </AppBar>

      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true // Better open performance on mobile.
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { 
            boxSizing: 'border-box', 
            width: 240,
            backgroundColor: '#f8f8f8',
            borderRight: '1px solid #e0e0e0'
          }
        }}
      >
        {drawer}
      </Drawer>
    </>
  );
};

export default WebsiteHeader;
