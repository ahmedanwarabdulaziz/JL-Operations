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
  IconButton,
  Collapse,
  ListItemIcon
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
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ConstructionIcon from '@mui/icons-material/Construction';
import FlashOnIcon from '@mui/icons-material/FlashOn';

import { useFirebaseStatus } from '../../contexts/FirebaseContext';

const menuItems = [
  { text: 'Dashboard', path: '/admin', icon: <DashboardIcon /> },
  { text: 'Customers', path: '/admin/customers', icon: <PeopleIcon /> },
  { text: 'Orders', path: '/admin/orders', icon: <ReceiptIcon /> },
  { text: 'Workshop', path: '/admin/workshop', icon: <BuildIcon /> },
  { text: 'Invoices', path: '/admin/invoices', icon: <DescriptionIcon /> },
  { text: 'Flash Invoices', path: '/admin/flash-invoices', icon: <FlashOnIcon /> },
  { text: 'Finance', path: '/admin/finance', icon: <AccountBalanceIcon /> },
  { text: 'P&L Statement', path: '/admin/pl', icon: <TrendingUpIcon /> },
  { text: 'Completed Orders', path: '/admin/end-done', icon: <CheckCircleIcon /> },
  { text: 'Cancelled Orders', path: '/admin/end-cancelled', icon: <CancelIcon /> },
];

const settingsItems = [
  { text: 'Treatment', path: '/admin/treatment', icon: <ScienceIcon /> },
  { text: 'Material Companies', path: '/admin/material-companies', icon: <BusinessIcon /> },
  { text: 'Platforms', path: '/admin/platforms', icon: <PublicIcon /> },
  { text: 'Status Management', path: '/admin/status-management', icon: <ManageAccountsIcon /> },
];

const underConstructionItems = [
  { text: 'Lead Form', path: '/admin/lead-form', icon: <WebIcon /> },
  { text: 'Leads Management', path: '/admin/leads', icon: <GroupIcon /> },
  { text: 'Email Settings', path: '/admin/email-settings', icon: <EmailIcon /> },
  { text: 'Email Test', path: '/admin/test', icon: <EmailIcon /> },
  { text: 'Completion Email Test', path: '/admin/email-test', icon: <EmailIcon /> },
  { text: 'Data Management', path: '/admin/data-management', icon: <SettingsIcon /> },
  { text: 'Testing Financial', path: '/admin/testing-financial', icon: <TrendingUpIcon /> },
];

const Sidebar = ({ onToggle, onPin }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isConnected, isChecking } = useFirebaseStatus();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [underConstructionOpen, setUnderConstructionOpen] = useState(false);

  const handleNavigation = (path) => {
    navigate(path);
  };

  const handleSettingsToggle = () => {
    setSettingsOpen(!settingsOpen);
  };

  const handleUnderConstructionToggle = () => {
    setUnderConstructionOpen(!underConstructionOpen);
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
        position: 'fixed',
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          backgroundColor: '#b98f33', // Gold background as requested
          borderRight: '1px solid #333333',
          boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
          transition: 'width 0.3s ease',
          overflow: 'hidden',
          position: 'fixed',
        },
      }}
    >
      <Box sx={{ p: 2, borderBottom: '1px solid #333333', minHeight: 64 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {isExpanded ? (
            <>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#000000' }}>
                JL Operation
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Tooltip title={isPinned ? 'Unpin sidebar' : 'Pin sidebar'}>
                  <IconButton onClick={togglePin} size="small" sx={{ color: '#000000' }}>
                    {isPinned ? <PushPinIcon /> : <PushPinOutlinedIcon />}
                  </IconButton>
                </Tooltip>
                <IconButton onClick={toggleSidebar} size="small" sx={{ color: '#000000' }}>
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
                border: '1px solid #000000',
                boxShadow: '0 0 0 1px #000000',
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
                border: '2px solid #000000',
                boxShadow: '0 0 0 2px #000000',
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
        {/* Main Menu Items */}
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
                color: '#000000',
                '&:hover': {
                  backgroundColor: 'rgba(0,0,0,0.15)',
                },
                '&.Mui-selected': {
                  backgroundColor: 'rgba(0,0,0,0.25)',
                  color: '#000000',
                  '&:hover': {
                    backgroundColor: 'rgba(0,0,0,0.25)',
                  },
                },
              }}
            >
              <Box sx={{ 
                color: '#000000',
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
                      color: '#000000',
                      '& .MuiListItemText-primary': {
                        fontWeight: 500,
                        color: '#000000',
                      },
                    }}
                  />
                )}
              </Box>
            </ListItemButton>
          </ListItem>
        ))}

        {/* Settings Section */}
        <ListItem disablePadding sx={{ mb: 1 }}>
          <ListItemButton
            onClick={handleSettingsToggle}
            sx={{
              mx: 1,
              borderRadius: 1,
              minHeight: 48,
              justifyContent: isExpanded ? 'flex-start' : 'center',
              color: '#000000',
              backgroundColor: 'rgba(0,0,0,0.1)',
              '&:hover': {
                backgroundColor: 'rgba(0,0,0,0.2)',
              },
            }}
          >
            <Box sx={{ 
              color: '#000000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: isExpanded ? 'flex-start' : 'center',
              width: '100%'
            }}>
              <SettingsIcon />
              {isExpanded && (
                <>
                  <ListItemText 
                    primary="Settings" 
                    sx={{
                      ml: 2,
                      color: '#000000',
                      '& .MuiListItemText-primary': {
                        fontWeight: 600,
                        color: '#000000',
                      },
                    }}
                  />
                  {settingsOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </>
              )}
            </Box>
          </ListItemButton>
        </ListItem>

        <Collapse in={settingsOpen && isExpanded} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {settingsItems.map((item) => (
              <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  onClick={() => handleNavigation(item.path)}
                  selected={location.pathname === item.path}
                  sx={{
                    mx: 1,
                    ml: 3,
                    borderRadius: 1,
                    minHeight: 40,
                    color: '#000000',
                    '&:hover': {
                      backgroundColor: 'rgba(0,0,0,0.15)',
                    },
                    '&.Mui-selected': {
                      backgroundColor: 'rgba(0,0,0,0.25)',
                      color: '#000000',
                      '&:hover': {
                        backgroundColor: 'rgba(0,0,0,0.25)',
                      },
                    },
                  }}
                >
                  <Box sx={{ 
                    color: '#000000',
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%'
                  }}>
                    {item.icon}
                    <ListItemText 
                      primary={item.text} 
                      sx={{
                        ml: 2,
                        color: '#000000',
                        '& .MuiListItemText-primary': {
                          fontWeight: 400,
                          fontSize: '0.9rem',
                          color: '#000000',
                        },
                      }}
                    />
                  </Box>
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Collapse>

        {/* Under Construction Section */}
        <ListItem disablePadding sx={{ mb: 1 }}>
          <ListItemButton
            onClick={handleUnderConstructionToggle}
            sx={{
              mx: 1,
              borderRadius: 1,
              minHeight: 48,
              justifyContent: isExpanded ? 'flex-start' : 'center',
              color: '#000000',
              backgroundColor: 'rgba(255,152,0,0.2)',
              '&:hover': {
                backgroundColor: 'rgba(255,152,0,0.3)',
              },
            }}
          >
            <Box sx={{ 
              color: '#000000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: isExpanded ? 'flex-start' : 'center',
              width: '100%'
            }}>
              <ConstructionIcon />
              {isExpanded && (
                <>
                  <ListItemText 
                    primary="Under Construction" 
                    sx={{
                      ml: 2,
                      color: '#000000',
                      '& .MuiListItemText-primary': {
                        fontWeight: 600,
                        color: '#000000',
                      },
                    }}
                  />
                  {underConstructionOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </>
              )}
            </Box>
          </ListItemButton>
        </ListItem>

        <Collapse in={underConstructionOpen && isExpanded} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {underConstructionItems.map((item) => (
              <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  onClick={() => handleNavigation(item.path)}
                  selected={location.pathname === item.path}
                  sx={{
                    mx: 1,
                    ml: 3,
                    borderRadius: 1,
                    minHeight: 40,
                    color: '#000000',
                    '&:hover': {
                      backgroundColor: 'rgba(255,152,0,0.2)',
                    },
                    '&.Mui-selected': {
                      backgroundColor: 'rgba(255,152,0,0.3)',
                      color: '#000000',
                      '&:hover': {
                        backgroundColor: 'rgba(255,152,0,0.3)',
                      },
                    },
                  }}
                >
                  <Box sx={{ 
                    color: '#000000',
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%'
                  }}>
                    {item.icon}
                    <ListItemText 
                      primary={item.text} 
                      sx={{
                        ml: 2,
                        color: '#000000',
                        '& .MuiListItemText-primary': {
                          fontWeight: 400,
                          fontSize: '0.9rem',
                          color: '#000000',
                        },
                      }}
                    />
                  </Box>
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Collapse>
      </List>
      
      {!isExpanded && (
        <Box sx={{ 
          position: 'absolute', 
          bottom: 16, 
          left: '50%', 
          transform: 'translateX(-50%)' 
        }}>
          <Tooltip title="Expand sidebar">
            <IconButton onClick={toggleSidebar} size="small" sx={{ color: '#000000' }}>
              <ChevronRightIcon />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Drawer>
  );
};

export default Sidebar; 