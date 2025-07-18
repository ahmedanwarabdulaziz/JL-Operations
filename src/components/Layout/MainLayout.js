import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { Box } from '@mui/material';
import { useAuth } from '../Auth/AuthContext';

const MainLayout = ({ children }) => {
  const { user } = useAuth();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [sidebarPinned, setSidebarPinned] = useState(false);

  // Only render layout if user is authenticated
  if (!user) {
    return null;
  }

  const handleSidebarToggle = (expanded) => {
    setSidebarExpanded(expanded);
  };

  const handleSidebarPin = (pinned) => {
    setSidebarPinned(pinned);
    if (pinned) {
      setSidebarExpanded(true);
    }
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar onToggle={handleSidebarToggle} onPin={handleSidebarPin} />
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          flexGrow: 1,
          marginLeft: sidebarExpanded ? '280px' : '80px',
          transition: 'margin-left 0.3s ease',
        }}
      >
        <Header />
        <Box 
          component="main" 
          sx={{ 
            flexGrow: 1, 
            p: 3,
            backgroundColor: '#f5f5f5',
            overflow: 'auto', // Allow scrolling
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default MainLayout; 