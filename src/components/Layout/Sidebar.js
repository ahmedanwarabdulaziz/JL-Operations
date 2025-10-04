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
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WebIcon from '@mui/icons-material/Web';
import GroupIcon from '@mui/icons-material/Group';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ConstructionIcon from '@mui/icons-material/Construction';

import InventoryIcon from '@mui/icons-material/Inventory';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';

import { useFirebaseStatus } from '../../contexts/FirebaseContext';

const menuItems = [
  { text: 'Dashboard', path: '/admin', icon: <DashboardIcon /> },
  { text: 'Orders', path: '/admin/orders', icon: <ReceiptIcon /> },
  { text: 'Workshop', path: '/admin/workshop', icon: <BuildIcon /> },
  { text: 'Material Request', path: '/admin/material-request', icon: <InventoryIcon /> },
  { text: 'Invoices', path: '/admin/invoices', icon: <DescriptionIcon /> },
  { text: 'Customer Invoices', path: '/admin/customer-invoices', icon: <DescriptionIcon /> },
  { text: 'Finance', path: '/admin/finance', icon: <AccountBalanceIcon /> },
  { text: 'Extra Expenses', path: '/admin/extra-expenses', icon: <AttachMoneyIcon /> },
  { text: 'Customers', path: '/admin/customers', icon: <PeopleIcon /> },
  { text: 'Completed Orders', path: '/admin/end-done', icon: <CheckCircleIcon /> },
  { text: 'Cancelled Orders', path: '/admin/end-cancelled', icon: <CancelIcon /> },
  { text: 'Pending Orders', path: '/admin/pending-orders', icon: <AccessTimeIcon /> },
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
  { text: 'P&L Statement', path: '/admin/pl', icon: <TrendingUpIcon /> },
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
        height: '100vh',
        zIndex: 1200,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          backgroundColor: '#b98f33', // Gold background as requested
          borderRight: '1px solid #333333',
          boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
          transition: 'width 0.3s ease',
          overflow: 'auto',
          position: 'fixed',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          // iOS Safari specific fixes
          WebkitOverflowScrolling: 'touch',
          // Ensure proper height on mobile devices
          '@media (max-height: 600px)': {
            height: '100vh',
            minHeight: '100vh',
          },
        },
      }}
    >
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%',
        flexShrink: 0
      }}>
        {/* Header */}
        <Box sx={{ 
          p: { xs: 1, sm: 1.5, md: 2 }, 
          borderBottom: '1px solid #333333', 
          minHeight: { xs: 48, sm: 56, md: 64 }, 
          flexShrink: 0 
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {isExpanded ? (
              <>
                              <Typography variant="h6" sx={{ 
                fontWeight: 'bold', 
                color: '#000000',
                fontSize: { xs: '0.9rem', sm: '1rem', md: '1.25rem' }
              }}>
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
                              <Typography variant="h6" sx={{ 
                fontWeight: 'bold', 
                color: '#000000', 
                fontSize: { xs: '0.9rem', sm: '1rem', md: '1.2rem' }
              }}>
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
        
        {/* Scrollable Content */}
        <Box sx={{ 
          flex: 1, 
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch', // Better scrolling on iOS
          msOverflowStyle: 'none', // Hide scrollbar on IE/Edge
          scrollbarWidth: 'none', // Hide scrollbar on Firefox
          '&::-webkit-scrollbar': {
            display: 'none' // Hide scrollbar on Chrome/Safari
          },
          // Ensure content fits in viewport
          maxHeight: 'calc(100vh - 120px)', // Account for header and footer
          '@media (max-height: 600px)': {
            maxHeight: 'calc(100vh - 80px)', // Smaller header/footer on small screens
          }
        }}>
          <List sx={{ 
            pt: { xs: 0.5, sm: 0.75, md: 1 },
            pb: { xs: 0.5, sm: 0.75, md: 1 }
          }}>
        {/* Main Menu Items */}
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ 
            mb: { xs: 0.25, sm: 0.5, md: 1 },
            py: { xs: 0.25, sm: 0.5, md: 0 }
          }}>
            <ListItemButton
              onClick={() => handleNavigation(item.path)}
              selected={location.pathname === item.path}
              sx={{
                mx: { xs: 0.5, sm: 0.75, md: 1 },
                borderRadius: 1,
                minHeight: { xs: 36, sm: 40, md: 48 },
                py: { xs: 0.5, sm: 0.75, md: 1 },
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
                        ml: { xs: 1, sm: 1.5, md: 2 },
                        color: '#000000',
                        '& .MuiListItemText-primary': {
                          fontWeight: 500,
                          color: '#000000',
                          fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' },
                          lineHeight: { xs: 1.2, sm: 1.3, md: 1.4 },
                        },
                      }}
                    />
                )}
              </Box>
            </ListItemButton>
          </ListItem>
        ))}

        {/* Settings Section */}
        <ListItem disablePadding sx={{ 
          mb: { xs: 0.25, sm: 0.5, md: 1 },
          py: { xs: 0.25, sm: 0.5, md: 0 }
        }}>
          <ListItemButton
            onClick={handleSettingsToggle}
            sx={{
              mx: { xs: 0.5, sm: 0.75, md: 1 },
              borderRadius: 1,
              minHeight: { xs: 36, sm: 40, md: 48 },
              py: { xs: 0.5, sm: 0.75, md: 1 },
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
                      ml: { xs: 1, sm: 1.5, md: 2 },
                      color: '#000000',
                      '& .MuiListItemText-primary': {
                        fontWeight: 600,
                        color: '#000000',
                        fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' },
                        lineHeight: { xs: 1.2, sm: 1.3, md: 1.4 },
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
              <ListItem key={item.text} disablePadding sx={{ 
                mb: { xs: 0.125, sm: 0.25, md: 0.5 },
                py: { xs: 0.125, sm: 0.25, md: 0 }
              }}>
                <ListItemButton
                  onClick={() => handleNavigation(item.path)}
                  selected={location.pathname === item.path}
                  sx={{
                    mx: { xs: 0.5, sm: 0.75, md: 1 },
                    ml: { xs: 2, sm: 2.5, md: 3 },
                    borderRadius: 1,
                    minHeight: { xs: 32, sm: 36, md: 40 },
                    py: { xs: 0.25, sm: 0.5, md: 0.75 },
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
                        ml: { xs: 1, sm: 1.5, md: 2 },
                        color: '#000000',
                        '& .MuiListItemText-primary': {
                          fontWeight: 400,
                          fontSize: { xs: '0.65rem', sm: '0.75rem', md: '0.9rem' },
                          lineHeight: { xs: 1.1, sm: 1.2, md: 1.3 },
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
        <ListItem disablePadding sx={{ 
          mb: { xs: 0.25, sm: 0.5, md: 1 },
          py: { xs: 0.25, sm: 0.5, md: 0 }
        }}>
          <ListItemButton
            onClick={handleUnderConstructionToggle}
            sx={{
              mx: { xs: 0.5, sm: 0.75, md: 1 },
              borderRadius: 1,
              minHeight: { xs: 36, sm: 40, md: 48 },
              py: { xs: 0.5, sm: 0.75, md: 1 },
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
                      ml: { xs: 1, sm: 1.5, md: 2 },
                      color: '#000000',
                      '& .MuiListItemText-primary': {
                        fontWeight: 600,
                        color: '#000000',
                        fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' },
                        lineHeight: { xs: 1.2, sm: 1.3, md: 1.4 },
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
              <ListItem key={item.text} disablePadding sx={{ 
                mb: { xs: 0.125, sm: 0.25, md: 0.5 },
                py: { xs: 0.125, sm: 0.25, md: 0 }
              }}>
                <ListItemButton
                  onClick={() => handleNavigation(item.path)}
                  selected={location.pathname === item.path}
                  sx={{
                    mx: { xs: 0.5, sm: 0.75, md: 1 },
                    ml: { xs: 2, sm: 2.5, md: 3 },
                    borderRadius: 1,
                    minHeight: { xs: 32, sm: 36, md: 40 },
                    py: { xs: 0.25, sm: 0.5, md: 0.75 },
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
                        ml: { xs: 1, sm: 1.5, md: 2 },
                        color: '#000000',
                        '& .MuiListItemText-primary': {
                          fontWeight: 400,
                          fontSize: { xs: '0.65rem', sm: '0.75rem', md: '0.9rem' },
                          lineHeight: { xs: 1.1, sm: 1.2, md: 1.3 },
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
        </Box>
        
        {/* Footer */}
        {!isExpanded && (
          <Box sx={{ 
            p: { xs: 1, sm: 1.5, md: 2 },
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'center'
          }}>
            <Tooltip title="Expand sidebar">
              <IconButton onClick={toggleSidebar} size="small" sx={{ color: '#000000' }}>
                <ChevronRightIcon />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>
    </Drawer>
  );
};

export default Sidebar; 