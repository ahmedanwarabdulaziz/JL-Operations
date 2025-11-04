// Reusable button styles for the application
export const buttonStyles = {
  // Professional glossy cancel button style
  cancelButton: {
    borderRadius: 2,
    backgroundColor: '#e6e7e8',
    color: '#000000',
    border: '3px solid #c0c0c0',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.3)',
    position: 'relative',
    '&:hover': {
      backgroundColor: '#d0d1d2',
      border: '3px solid #a0a0a0',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.3), 0 6px 12px rgba(0,0,0,0.4)'
    },
    '&:disabled': {
      backgroundColor: '#a0a0a0',
      border: '3px solid #666666',
      color: '#666666',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.2)'
    },
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '50%',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
      borderRadius: '6px 6px 0 0',
      pointerEvents: 'none'
    }
  },

  // Professional glossy primary button style (like Add Customer)
  primaryButton: {
    borderRadius: 2,
    background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
    color: '#000000',
    border: '3px solid #4CAF50',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.3)',
    position: 'relative',
    '&:hover': {
      background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
      border: '3px solid #45a049',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.3), 0 6px 12px rgba(0,0,0,0.4)'
    },
    '&:disabled': {
      background: 'linear-gradient(145deg, #a0a0a0 0%, #808080 50%, #606060 100%)',
      border: '3px solid #666666',
      color: '#666666',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.2)'
    },
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '50%',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
      borderRadius: '6px 6px 0 0',
      pointerEvents: 'none'
    }
  },

  // Professional glossy danger button style (for delete actions)
  dangerButton: {
    borderRadius: 2,
    background: 'linear-gradient(145deg, #f44336 0%, #d32f2f 50%, #b71c1c 100%)',
    color: '#ffffff',
    border: '3px solid #d32f2f',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.3)',
    position: 'relative',
    '&:hover': {
      background: 'linear-gradient(145deg, #ff5252 0%, #f44336 50%, #d32f2f 100%)',
      border: '3px solid #c62828',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.3), 0 6px 12px rgba(0,0,0,0.4)'
    },
    '&:disabled': {
      background: 'linear-gradient(145deg, #a0a0a0 0%, #808080 50%, #606060 100%)',
      border: '3px solid #666666',
      color: '#666666',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.2)'
    },
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '50%',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
      borderRadius: '6px 6px 0 0',
      pointerEvents: 'none'
    }
  },

  // Luxury glossy button style with premium effects
  luxuryButton: {
    borderRadius: 3,
    background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 25%, #FF8C00 50%, #FF6B35 75%, #FF4500 100%)',
    color: '#000000',
    border: '3px solid #FF8C00',
    boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.4), inset 0 -2px 0 rgba(0,0,0,0.3), 0 8px 16px rgba(255,140,0,0.4), 0 4px 8px rgba(0,0,0,0.3)',
    position: 'relative',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontSize: '0.95rem',
    padding: '12px 24px',
    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    '&:hover': {
      background: 'linear-gradient(135deg, #FFED4E 0%, #FFB84D 25%, #FFA500 50%, #FF7F50 75%, #FF6347 100%)',
      border: '3px solid #FFA500',
      boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.5), inset 0 -2px 0 rgba(0,0,0,0.4), 0 12px 24px rgba(255,140,0,0.6), 0 6px 12px rgba(0,0,0,0.4), 0 0 20px rgba(255,215,0,0.3)',
      transform: 'translateY(-2px) scale(1.02)',
    },
    '&:active': {
      transform: 'translateY(1px) scale(0.98)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2), 0 4px 8px rgba(255,140,0,0.3), 0 2px 4px rgba(0,0,0,0.2)',
    },
    '&:disabled': {
      background: 'linear-gradient(135deg, #a0a0a0 0%, #808080 25%, #606060 50%, #404040 75%, #202020 100%)',
      border: '3px solid #666666',
      color: '#666666',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.2)',
      transform: 'none',
    },
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '50%',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.1) 50%, transparent 100%)',
      borderRadius: '12px 12px 0 0',
      pointerEvents: 'none',
      zIndex: 1
    },
    '&::after': {
      content: '""',
      position: 'absolute',
      top: '2px',
      left: '2px',
      right: '2px',
      height: 'calc(50% - 2px)',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
      borderRadius: '10px 10px 0 0',
      pointerEvents: 'none',
      zIndex: 2
    }
  },

  // Professional glossy secondary button style (for edit actions)
  secondaryButton: {
    borderRadius: 2,
    background: 'linear-gradient(145deg, #2196f3 0%, #1976d2 50%, #0d47a1 100%)',
    color: '#ffffff',
    border: '3px solid #1976d2',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.3)',
    position: 'relative',
    '&:hover': {
      background: 'linear-gradient(145deg, #42a5f5 0%, #2196f3 50%, #1976d2 100%)',
      border: '3px solid #1565c0',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.3), 0 6px 12px rgba(0,0,0,0.4)'
    },
    '&:disabled': {
      background: 'linear-gradient(145deg, #a0a0a0 0%, #808080 50%, #606060 100%)',
      border: '3px solid #666666',
      color: '#666666',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.2)'
    },
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '50%',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
      borderRadius: '6px 6px 0 0',
      pointerEvents: 'none'
    }
  },

  // Professional homepage gold button style
  homePageButton: {
    borderRadius: 3,
    background: 'linear-gradient(135deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
    color: '#000000',
    border: '3px solid #b98f33',
    boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.4), inset 0 -2px 0 rgba(0,0,0,0.3), 0 8px 16px rgba(185, 143, 51, 0.4), 0 4px 8px rgba(0,0,0,0.3)',
    position: 'relative',
    fontWeight: 700,
    textTransform: 'none',
    letterSpacing: '0.5px',
    fontSize: '1rem',
    padding: '14px 32px',
    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    minWidth: '180px',
    '&:hover': {
      background: 'linear-gradient(135deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
      border: '3px solid #d4af5a',
      boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.5), inset 0 -2px 0 rgba(0,0,0,0.4), 0 12px 24px rgba(185, 143, 51, 0.6), 0 6px 12px rgba(0,0,0,0.4), 0 0 20px rgba(212, 175, 90, 0.3)',
      transform: 'translateY(-3px) scale(1.03)',
    },
    '&:active': {
      transform: 'translateY(1px) scale(0.98)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2), 0 4px 8px rgba(185, 143, 51, 0.3), 0 2px 4px rgba(0,0,0,0.2)',
    },
    '&:disabled': {
      background: 'linear-gradient(135deg, #a0a0a0 0%, #808080 50%, #606060 100%)',
      border: '3px solid #666666',
      color: '#666666',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.2)',
      transform: 'none',
    },
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '50%',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.1) 50%, transparent 100%)',
      borderRadius: '12px 12px 0 0',
      pointerEvents: 'none',
      zIndex: 1
    },
    '&::after': {
      content: '""',
      position: 'absolute',
      top: '2px',
      left: '2px',
      right: '2px',
      height: 'calc(50% - 2px)',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
      borderRadius: '10px 10px 0 0',
      pointerEvents: 'none',
      zIndex: 2
    }
  },

  // Professional homepage outline button style (for Contact Us button)
  homePageOutlineButton: {
    borderRadius: 3,
    background: 'linear-gradient(135deg, rgba(212, 175, 90, 0.15) 0%, rgba(185, 143, 51, 0.1) 50%, rgba(139, 107, 31, 0.05) 100%)',
    color: '#ffffff',
    border: '3px solid #d4af5a',
    boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.2), inset 0 -2px 0 rgba(0,0,0,0.2), 0 8px 16px rgba(212, 175, 90, 0.3), 0 4px 8px rgba(0,0,0,0.2)',
    position: 'relative',
    fontWeight: 700,
    textTransform: 'none',
    letterSpacing: '0.5px',
    fontSize: '1rem',
    padding: '14px 32px',
    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    minWidth: '180px',
    backdropFilter: 'blur(10px)',
    '&:hover': {
      background: 'linear-gradient(135deg, rgba(230, 196, 122, 0.3) 0%, rgba(212, 175, 90, 0.2) 50%, rgba(185, 143, 51, 0.15) 100%)',
      border: '3px solid #e6c47a',
      boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.3), inset 0 -2px 0 rgba(0,0,0,0.3), 0 12px 24px rgba(212, 175, 90, 0.5), 0 6px 12px rgba(0,0,0,0.3), 0 0 20px rgba(212, 175, 90, 0.4)',
      transform: 'translateY(-3px) scale(1.03)',
      color: '#ffffff',
    },
    '&:active': {
      transform: 'translateY(1px) scale(0.98)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.2), 0 4px 8px rgba(212, 175, 90, 0.3), 0 2px 4px rgba(0,0,0,0.2)',
    },
    '&:disabled': {
      background: 'linear-gradient(135deg, rgba(160, 160, 160, 0.2) 0%, rgba(128, 128, 128, 0.15) 50%, rgba(96, 96, 96, 0.1) 100%)',
      border: '3px solid #666666',
      color: '#999999',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.2)',
      transform: 'none',
    },
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '50%',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 50%, transparent 100%)',
      borderRadius: '12px 12px 0 0',
      pointerEvents: 'none',
      zIndex: 1
    }
  }
};

// Usage examples:
// import { buttonStyles } from '../styles/buttonStyles';
// 
// <Button sx={buttonStyles.cancelButton}>Cancel</Button>
// <Button sx={buttonStyles.primaryButton}>Add Customer</Button>
// <Button sx={buttonStyles.dangerButton}>Delete</Button>
// <Button sx={buttonStyles.secondaryButton}>Edit</Button>
