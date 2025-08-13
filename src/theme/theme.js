import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#b98f33', // Gold color for titles and accents
      light: '#d4af5a',
      dark: '#8b6b1f',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#dc004e',
      light: '#ff5983',
      dark: '#9a0036',
    },
    background: {
      default: '#1a1a1a', // Light black background for pages
      paper: '#2a2a2a', // Slightly lighter black for cards and fields
    },
    text: {
      primary: '#ffffff', // White for main text
      secondary: '#b98f33', // Gold for secondary text like titles
    },
    divider: '#333333',
  },

  typography: {
    fontFamily: 'Roboto, Arial, sans-serif',
    h1: {
      color: '#b98f33',
      fontWeight: 600,
    },
    h2: {
      color: '#b98f33',
      fontWeight: 600,
    },
    h3: {
      color: '#b98f33',
      fontWeight: 600,
    },
    h4: {
      color: '#b98f33',
      fontWeight: 600,
    },
    h5: {
      color: '#b98f33',
      fontWeight: 600,
    },
    h6: {
      color: '#b98f33',
      fontWeight: 600,
    },
    subtitle1: {
      color: '#b98f33',
    },
    subtitle2: {
      color: '#b98f33',
    },
    body1: {
      color: '#ffffff',
    },
    body2: {
      color: '#ffffff',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          // Custom scrollbar styles
          '&::-webkit-scrollbar': {
            width: '12px',
            height: '12px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#2a2a2a', // Light black background
            borderRadius: '6px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#b98f33', // Gold scrollbar
            borderRadius: '6px',
            '&:hover': {
              background: '#d4af5a', // Lighter gold on hover
            },
          },
          '&::-webkit-scrollbar-corner': {
            background: '#2a2a2a', // Light black for corner
          },
        },
        // Apply scrollbar styles to all scrollable elements
        '*': {
          '&::-webkit-scrollbar': {
            width: '12px',
            height: '12px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#2a2a2a', // Light black background
            borderRadius: '6px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#b98f33', // Gold scrollbar
            borderRadius: '6px',
            '&:hover': {
              background: '#d4af5a', // Lighter gold on hover
            },
          },
          '&::-webkit-scrollbar-corner': {
            background: '#2a2a2a', // Light black for corner
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#2a2a2a',
          borderRight: '1px solid #333333',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#2a2a2a',
          border: '1px solid #333333',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#2a2a2a',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#2a2a2a',
            '& fieldset': {
              borderColor: '#333333',
            },
            '&:hover fieldset': {
              borderColor: '#b98f33',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#b98f33',
            },
          },
          '& .MuiInputLabel-root': {
            color: '#b98f33',
            '&.Mui-focused': {
              color: '#b98f33',
            },
          },
          '& .MuiInputBase-input': {
            color: '#ffffff',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          backgroundColor: '#b98f33',
          color: '#000000',
          '&:hover': {
            backgroundColor: '#d4af5a',
          },
        },
        outlined: {
          borderColor: '#b98f33',
          color: '#b98f33',
          '&:hover': {
            backgroundColor: '#b98f33',
            color: '#000000',
          },
        },
        text: {
          color: '#b98f33',
          '&:hover': {
            backgroundColor: 'rgba(185, 143, 51, 0.1)',
          },
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            backgroundColor: '#2a2a2a',
            color: '#b98f33',
            fontWeight: 600,
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid #333333',
          color: '#ffffff',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: '#3a3a3a',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#2a2a2a',
          color: '#b98f33',
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          backgroundColor: '#2a2a2a',
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: '#3a3a3a',
          },
        },
      },
    },
    MuiListItemText: {
      styleOverrides: {
        primary: {
          color: '#ffffff',
        },
        secondary: {
          color: '#b98f33',
        },
      },
    },
    MuiIcon: {
      styleOverrides: {
        root: {
          color: '#b98f33',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          backgroundColor: '#2a2a2a',
          color: '#ffffff',
          border: '1px solid #333333',
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          backgroundColor: '#2a2a2a',
          color: '#ffffff',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          backgroundColor: '#2a2a2a',
          color: '#ffffff',
          '&:hover': {
            backgroundColor: '#3a3a3a',
          },
          '&.Mui-selected': {
            backgroundColor: '#b98f33',
            color: '#000000',
            '&:hover': {
              backgroundColor: '#d4af5a',
            },
          },
        },
      },
    },
  },
});

export default theme; 