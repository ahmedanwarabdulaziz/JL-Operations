import React, { useState } from 'react';
import { Box, AppBar, Toolbar, Typography } from '@mui/material';
import WebsiteSidebar from '../components/WebsiteSidebar';

const AdminWebsiteLayout = ({ children }) => {
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [sidebarPinned, setSidebarPinned] = useState(false);

  const handleSidebarToggle = (expanded) => {
    setSidebarExpanded(expanded);
  };

  const handleSidebarPin = (pinned) => {
    setSidebarPinned(pinned);
  };

  const sidebarWidth = sidebarExpanded ? 280 : 80;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Website Sidebar */}
      <WebsiteSidebar 
        onToggle={handleSidebarToggle}
        onPin={handleSidebarPin}
      />
      
      {/* Main Content Area */}
      <Box 
        component="main" 
        sx={{ 
          flexGrow: 1, 
          ml: `${sidebarWidth}px`,
          transition: 'margin-left 0.3s ease',
          backgroundColor: '#f5f5f5',
          minHeight: '100vh'
        }}
      >
        {/* Top App Bar */}
        <AppBar 
          position="static" 
          elevation={1}
          sx={{ 
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e0e0e0',
            color: '#333333'
          }}
        >
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ 
              flexGrow: 1,
              color: '#274290',
              fontWeight: 'bold'
            }}>
              Website Management Panel
            </Typography>
          </Toolbar>
        </AppBar>
        
        {/* Page Content */}
        <Box sx={{ p: 0 }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default AdminWebsiteLayout;
