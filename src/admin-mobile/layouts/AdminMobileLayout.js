import React, { useState } from 'react';
import {
  AppBar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Toolbar,
  Typography
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate, useLocation } from 'react-router-dom';

const DRAWER_WIDTH = 280;

const navItems = [
  {
    label: 'Invoices',
    path: '/admin/mobile/invoices'
  },
  // Additional sections can be added here as mobile views come online
];

const AdminMobileLayout = ({ children }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleToggleDrawer = () => {
    setDrawerOpen((prev) => !prev);
  };

  const handleNavigate = (path) => {
    navigate(path);
    setDrawerOpen(false);
  };

  const renderNavItems = () => (
    <Box
      role="presentation"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
        color: '#000000'
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: 2,
          px: 2,
          borderBottom: '1px solid rgba(0,0,0,0.2)'
        }}
      >
        <Typography
          variant="h6"
          sx={{ fontFamily: 'Playfair Display, serif', color: '#000000', fontWeight: 600 }}
        >
          Admin Menu
        </Typography>
        <IconButton
          aria-label="Close menu"
          onClick={handleToggleDrawer}
          sx={{
            bgcolor: 'rgba(0,0,0,0.1)',
            color: '#000000',
            '&:hover': {
              bgcolor: 'rgba(0,0,0,0.2)'
            }
          }}
        >
          <CloseIcon />
        </IconButton>
      </Box>
      <Divider sx={{ borderColor: 'rgba(0,0,0,0.2)' }} />
      <List sx={{ flexGrow: 1, py: 1 }}>
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <ListItemButton
              key={item.path}
              onClick={() => handleNavigate(item.path)}
              sx={{
                mx: 1,
                mb: 1,
                borderRadius: 2,
                minHeight: 48,
                justifyContent: 'flex-start',
                color: '#000000',
                backgroundColor: isActive ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.15)',
                border: isActive ? '2px solid rgba(0,0,0,0.35)' : '2px solid transparent',
                boxShadow: isActive
                  ? 'inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.25)'
                  : 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.15)',
                '&:hover': {
                  backgroundColor: 'rgba(0,0,0,0.25)'
                }
              }}
            >
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontFamily: 'Source Sans Pro, sans-serif',
                  fontWeight: isActive ? 700 : 600,
                  color: '#000000',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#e6ffe6' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          bgcolor: '#274290',
          color: '#ffffff'
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            aria-label="open menu"
            onClick={handleToggleDrawer}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography
            variant="h6"
            sx={{
              flexGrow: 1,
              fontFamily: 'Playfair Display, serif',
              fontWeight: 600
            }}
          >
            JL Admin
          </Typography>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ flexShrink: { sm: 0 } }}>
        <Drawer
          variant="temporary"
          open={drawerOpen}
          onClose={handleToggleDrawer}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
              background: 'linear-gradient(180deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
              color: '#000000'
            }
          }}
        >
          {renderNavItems()}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: '100%',
          pt: 8,
          pb: 2,
          px: 2,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default AdminMobileLayout;

