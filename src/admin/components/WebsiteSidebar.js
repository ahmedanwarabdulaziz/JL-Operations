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
  ListItemIcon
} from '@mui/material';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import WebIcon from '@mui/icons-material/Web';
import SettingsIcon from '@mui/icons-material/Settings';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import EditIcon from '@mui/icons-material/Edit';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import LabelIcon from '@mui/icons-material/Label';
import TransformIcon from '@mui/icons-material/Transform';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';

const WebsiteSidebar = ({ onToggle, onPin }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isPinned, setIsPinned] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const websiteMenuItems = [
    {
      text: 'Media Gallery',
      path: '/admin/website',
      icon: <PhotoLibraryIcon />,
      description: 'Upload and manage images'
    },
    {
      text: 'Categories',
      path: '/admin/website/categories',
      icon: <LabelIcon />,
      description: 'Manage tag categories'
    },
    {
      text: 'Tags',
      path: '/admin/website/tags',
      icon: <LabelIcon />,
      description: 'Manage tags within categories'
    },
    {
      text: 'Furniture Pieces',
      path: '/admin/website/furniture-pieces',
      icon: <TransformIcon />,
      description: 'Manage Before/After furniture transformations'
    },
    { 
      text: 'Content Management', 
      path: '/admin/website/content', 
      icon: <EditIcon />,
      description: 'Edit website text and content',
      status: 'coming-soon'
    },
    { 
      text: 'SEO Settings', 
      path: '/admin/website/seo', 
      icon: <AnalyticsIcon />,
      description: 'Optimize for search engines',
      status: 'coming-soon'
    },
    { 
      text: 'Website Settings', 
      path: '/admin/website/settings', 
      icon: <SettingsIcon />,
      description: 'Configure website preferences',
      status: 'coming-soon'
    },
    { 
      text: 'Back to Admin', 
      path: '/admin', 
      icon: <WebIcon />,
      description: 'Return to main admin panel'
    }
  ];

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
        position: 'fixed',
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          backgroundColor: '#274290', // Blue background for website section
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
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#ffffff' }}>
                Website Panel
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Tooltip title={isPinned ? 'Unpin sidebar' : 'Pin sidebar'}>
                  <IconButton onClick={togglePin} size="small" sx={{ color: '#ffffff' }}>
                    {isPinned ? <PushPinIcon /> : <PushPinOutlinedIcon />}
                  </IconButton>
                </Tooltip>
                <IconButton onClick={toggleSidebar} size="small" sx={{ color: '#ffffff' }}>
                  <ChevronLeftIcon />
                </IconButton>
              </Box>
            </>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#ffffff', fontSize: '1.2rem' }}>
                WP
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
      
      <List sx={{ pt: 1 }}>
        {websiteMenuItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ mb: 1 }}>
            <ListItemButton
              onClick={() => handleNavigation(item.path)}
              selected={location.pathname === item.path || (item.path === '/admin/website' && location.pathname === '/admin/website')}
              disabled={item.status === 'coming-soon'}
              sx={{
                mx: 1,
                borderRadius: 1,
                minHeight: 48,
                justifyContent: isExpanded ? 'flex-start' : 'center',
                color: '#ffffff',
                opacity: item.status === 'coming-soon' ? 0.5 : 1,
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.15)',
                },
                '&.Mui-selected': {
                  backgroundColor: 'rgba(255,255,255,0.25)',
                  color: '#ffffff',
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.25)',
                  },
                },
                '&.Mui-disabled': {
                  color: 'rgba(255,255,255,0.3)',
                },
              }}
            >
              <Box sx={{ 
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: isExpanded ? 'flex-start' : 'center',
                width: '100%'
              }}>
                {item.icon}
                {isExpanded && (
                  <Box sx={{ ml: 2, flexGrow: 1 }}>
                    <ListItemText 
                      primary={item.text}
                      secondary={item.description}
                      sx={{
                        color: '#ffffff',
                        '& .MuiListItemText-primary': {
                          fontWeight: 500,
                          color: '#ffffff',
                          fontSize: '0.9rem',
                        },
                        '& .MuiListItemText-secondary': {
                          color: 'rgba(255,255,255,0.7)',
                          fontSize: '0.75rem',
                        },
                      }}
                    />
                    {item.status === 'coming-soon' && (
                      <Typography variant="caption" sx={{ 
                        color: '#f27921',
                        fontSize: '0.7rem',
                        fontWeight: 'bold'
                      }}>
                        Coming Soon
                      </Typography>
                    )}
                  </Box>
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
            <IconButton onClick={toggleSidebar} size="small" sx={{ color: '#ffffff' }}>
              <ChevronRightIcon />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Drawer>
  );
};

export default WebsiteSidebar;
