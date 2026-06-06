import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { Box } from '@mui/material';
import { useAuth } from '../../components/Auth/AuthContext';
import { useLocation } from 'react-router-dom';

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

  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isPopup = window.self !== window.top || searchParams.get('popup') === 'true';

  if (isPopup) {
    return (
      <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: 'background.default', width: '100%' }}>
        <Box 
          component="main" 
          sx={{ 
            flexGrow: 1, 
            backgroundColor: 'background.default',
            overflow: 'auto', 
            p: 1,
          }}
        >
          {children}
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: 'background.default' }}>
      <Sidebar onToggle={handleSidebarToggle} onPin={handleSidebarPin} />
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          flexGrow: 1,
          backgroundColor: 'background.default',
          marginLeft: sidebarExpanded ? '280px' : '80px',
          transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          willChange: 'margin-left',
          overflow: 'auto',
          minWidth: 0,
          width: sidebarExpanded ? 'calc(100vw - 280px)' : 'calc(100vw - 80px)',
        }}
      >
        <Header />
        <Box 
          component="main" 
          sx={{ 
            flexGrow: 1, 
            backgroundColor: 'background.default',
            overflow: 'auto', // Allow scrolling
            p: 3, // Professional padding for all pages
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default MainLayout; 
