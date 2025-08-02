import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Drawer, 
  List, 
  ListItem, 
  ListItemText, 
  ListItemButton, 
  Typography, 
  Box, 
  Tooltip,
  IconButton
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import EmailIcon from '@mui/icons-material/Email';
import PeopleIcon from '@mui/icons-material/People';
import ReceiptIcon from '@mui/icons-material/Receipt';
import BuildIcon from '@mui/icons-material/Build';
import ScienceIcon from '@mui/icons-material/Science';
import BusinessIcon from '@mui/icons-material/Business';
import PublicIcon from '@mui/icons-material/Public';
import DescriptionIcon from '@mui/icons-material/Description';
import SettingsIcon from '@mui/icons-material/Settings';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import StorageIcon from '@mui/icons-material/Storage';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import WebIcon from '@mui/icons-material/Web';
import GroupIcon from '@mui/icons-material/Group';

import { useFirebaseStatus } from '../../contexts/FirebaseContext';

const menuItems = [
  { text: 'Dashboard', path: '/', icon: <DashboardIcon /> },
  { text: 'Customers', path: '/customers', icon: <PeopleIcon /> },
  { text: 'Orders', path: '/orders', icon: <ReceiptIcon /> },
  { text: 'Workshop', path: '/workshop', icon: <BuildIcon /> },
  { text: 'Treatment', path: '/treatment', icon: <ScienceIcon /> },
  { text: 'Material Companies', path: '/material-companies', icon: <BusinessIcon /> },
  { text: 'Platforms', path: '/platforms', icon: <PublicIcon /> },
  { text: 'Invoices', path: '/invoices', icon: <DescriptionIcon /> },
  { text: 'Finance', path: '/finance', icon: <AccountBalanceIcon /> },
  { text: 'P&L Statement', path: '/pl', icon: <TrendingUpIcon /> },
  { text: 'Status Management', path: '/status-management', icon: <ManageAccountsIcon /> },
  { text: 'Completed Orders', path: '/end-done', icon: <CheckCircleIcon /> },
  { text: 'Cancelled Orders', path: '/end-cancelled', icon: <CancelIcon /> },
  { text: 'Lead Form', path: '/lead-form', icon: <WebIcon /> },
  { text: 'Leads Management', path: '/leads', icon: <GroupIcon /> },
  { text: 'Email Settings', path: '/email-settings', icon: <EmailIcon /> },
  { text: 'Email Test', path: '/test', icon: <EmailIcon /> },
  { text: 'Rapid Invoice Settings', path: '/rapid-invoice-settings', icon: <FlashOnIcon /> },
  { text: 'Data Management', path: '/data-management', icon: <SettingsIcon /> },
];

const Sidebar = ({ onToggle, onPin }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isConnected, isChecking } = useFirebaseStatus();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleNavigation = (path) => {
    navigate(path);
  };

  const toggleSidebar = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    if (onToggle) {
      onToggle(newExpanded);
    }
  };

  const togglePin = () => {
    const newPinned = !isPinned;
    setIsPinned(newPinned);
    if (onPin) {
      onPin(newPinned);
    }
    if (!isPinned) {
      // If pinning, expand the sidebar
      setIsExpanded(true);
      if (onToggle) {
        onToggle(true);
      }
    }
  };

  const handleMouseEnter = () => {
    if (!isPinned) {
      setIsHovered(true);
      setIsExpanded(true);
      if (onToggle) {
        onToggle(true);
      }
    }
  };

  const handleMouseLeave = () => {
    if (!isPinned) {
      setIsHovered(false);
      setIsExpanded(false);
      if (onToggle) {
        onToggle(false);
      }
    }
  };

  const drawerWidth = isExpanded ? 280 : 80;

  return (
    <Drawer 
      variant="permanent" 
      anchor="left"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          backgroundColor: '#b98f33', // Custom gold background
          borderRight: '1px solid #e0e0e0',
          boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
          transition: 'width 0.3s ease',
          overflow: 'hidden',
        },
      }}
    >
      <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0', minHeight: 64 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {isExpanded ? (
            <>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#000000' }}>
                JL Operation
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Tooltip title={isPinned ? 'Unpin sidebar' : 'Pin sidebar'}>
                  <IconButton onClick={togglePin} size="small" color={isPinned ? 'primary' : 'default'}>
                    {isPinned ? <PushPinIcon /> : <PushPinOutlinedIcon />}
                  </IconButton>
                </Tooltip>
                <IconButton onClick={toggleSidebar} size="small">
                  <ChevronLeftIcon />
                </IconButton>
              </Box>
            </>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#000000', fontSize: '1.2rem' }}>
                JL
              </Typography>
            </Box>
          )}
        </Box>
        
        {!isExpanded && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
            <Tooltip title={isChecking ? 'Checking connection...' : (isConnected ? 'Connected to Firebase' : 'Disconnected from Firebase')}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: isChecking ? '#ff9800' : (isConnected ? '#4caf50' : '#f44336'),
                  border: '1px solid #fff',
                  boxShadow: '0 0 0 1px #e0e0e0',
                  animation: isChecking ? 'pulse 2s infinite' : 'none',
                  '@keyframes pulse': {
                    '0%': { opacity: 1 },
                    '50%': { opacity: 0.5 },
                    '100%': { opacity: 1 }
                  }
                }}
              />
            </Tooltip>
          </Box>
        )}
        
        {isExpanded && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
            <Tooltip title={isChecking ? 'Checking connection...' : (isConnected ? 'Connected to Firebase' : 'Disconnected from Firebase')}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: isChecking ? '#ff9800' : (isConnected ? '#4caf50' : '#f44336'),
                  border: '2px solid #fff',
                  boxShadow: '0 0 0 2px #e0e0e0',
                  animation: isChecking ? 'pulse 2s infinite' : 'none',
                  '@keyframes pulse': {
                    '0%': { opacity: 1 },
                    '50%': { opacity: 0.5 },
                    '100%': { opacity: 1 }
                  }
                }}
              />
            </Tooltip>
          </Box>
        )}
      </Box>
      
      <List sx={{ pt: 1 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ mb: 1 }}>
            <ListItemButton
              onClick={() => handleNavigation(item.path)}
              selected={location.pathname === item.path}
              sx={{
                mx: 1,
                borderRadius: 1,
                minHeight: 48,
                justifyContent: isExpanded ? 'flex-start' : 'center',
                color: '#000000', // Black text
                '&:hover': {
                  backgroundColor: 'rgba(0,0,0,0.1)', // Darker gold on hover
                },
                '&.Mui-selected': {
                  backgroundColor: 'rgba(0,0,0,0.2)', // Even darker for selected
                  color: '#000000',
                  '&:hover': {
                    backgroundColor: 'rgba(0,0,0,0.2)',
                  },
                },
              }}
            >
              <Box sx={{ 
                color: '#000000', // Black color for icons and text
                display: 'flex',
                alignItems: 'center',
                justifyContent: isExpanded ? 'flex-start' : 'center',
                width: '100%'
              }}>
                {item.icon}
                {isExpanded && (
                  <ListItemText 
                    primary={item.text} 
                    sx={{
                      ml: 2,
                      color: '#000000', // Black text
                      '& .MuiListItemText-primary': {
                        fontWeight: 500,
                        color: '#000000', // Ensure text is black
                      },
                    }}
                  />
                )}
              </Box>
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      
      {!isExpanded && (
        <Box sx={{ 
          position: 'absolute', 
          bottom: 16, 
          left: '50%', 
          transform: 'translateX(-50%)' 
        }}>
          <Tooltip title="Expand sidebar">
            <IconButton onClick={toggleSidebar} size="small">
              <ChevronRightIcon />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Drawer>
  );
};

export default Sidebar; 