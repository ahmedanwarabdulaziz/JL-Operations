import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Tooltip,
  Divider,
  Stack,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Badge,
  LinearProgress,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  MenuItem as SelectMenuItem,
  Tabs,
  Tab,
  AppBar
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  MoreVert as MoreVertIcon,
  Search as SearchIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  DragIndicator as DragIndicatorIcon,
  FilterList as FilterListIcon,
  Category as CategoryIcon,
  PhotoLibrary as PhotoLibraryIcon,
  Transform as TransformIcon,
  Build as BuildIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import {
  getFurniturePiecesWithCounts,
  getFurniturePieceById,
  updateFurniturePiece,
  deleteFurniturePiece,
  searchFurniturePieces,
  validateFurniturePiece,
  generateFurnitureId
} from '../../../services/furniturePieceService';
import { useAuth } from '../../../components/Auth/AuthContext';
import { buttonStyles } from '../../../styles/buttonStyles';

const FurniturePieceManagementPage = () => {
  const [furniturePieces, setFurniturePieces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingPiece, setEditingPiece] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, piece: null });
  const [anchorEl, setAnchorEl] = useState(null);
  const [contextMenuPiece, setContextMenuPiece] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { user } = useAuth();

  // Form states
  const [pieceDescription, setPieceDescription] = useState('');
  const [pieceFurnitureId, setPieceFurnitureId] = useState('');
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    loadFurniturePieces();
  }, []);

  const loadFurniturePieces = async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedPieces = await getFurniturePiecesWithCounts();
      setFurniturePieces(fetchedPieces);
    } catch (err) {
      console.error('Error loading furniture pieces:', err);
      setError(`Failed to load furniture pieces: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePiece = () => {
    setEditingPiece(null);
    setPieceDescription('');
    setPieceFurnitureId('');
    setFormErrors({});
    setShowCreateDialog(true);
  };

  const handleEditPiece = (piece) => {
    setEditingPiece(piece);
    setPieceDescription(piece.description);
    setPieceFurnitureId(piece.furnitureId || '');
    setFormErrors({});
    setShowCreateDialog(true);
    setAnchorEl(null);
  };

  const handleDeletePiece = (piece) => {
    setDeleteDialog({ open: true, piece });
    setAnchorEl(null);
  };

  const confirmDelete = async () => {
    try {
      setError(null);
      if (deleteDialog.piece) {
        await deleteFurniturePiece(deleteDialog.piece.id);
        setDeleteDialog({ open: false, piece: null });
        await loadFurniturePieces();
      }
    } catch (err) {
      console.error('Error deleting furniture piece:', err);
      setError(`Failed to delete furniture piece: ${err.message}`);
    }
  };

  const handleSavePiece = async () => {
    // Validation
    const pieceData = {
      description: pieceDescription.trim(),
      furnitureId: pieceFurnitureId.trim() || await generateFurnitureId(pieceDescription)
    };

    const validationErrors = validateFurniturePiece(pieceData);
    if (validationErrors.length > 0) {
      setFormErrors({ general: validationErrors.join(', ') });
      return;
    }

    // Check for duplicate furniture IDs
    const isDuplicate = furniturePieces.some(piece => 
      piece.furnitureId?.toLowerCase() === pieceFurnitureId.toLowerCase() && 
      piece.id !== editingPiece?.id
    );
    
    if (isDuplicate) {
      setFormErrors({ furnitureId: 'Furniture ID already exists' });
      return;
    }

    try {
      setError(null);
      
      if (editingPiece) {
        await updateFurniturePiece(editingPiece.id, pieceData);
      } else {
        // This would be handled by the image tagging system
        // For now, we'll just show a message
        setError('Furniture pieces are created automatically when tagging images. Use the image tagging system to create new pieces.');
        return;
      }

      setShowCreateDialog(false);
      setEditingPiece(null);
      await loadFurniturePieces();
    } catch (err) {
      console.error('Error saving furniture piece:', err);
      setError(`Failed to save furniture piece: ${err.message}`);
    }
  };

  const handleContextMenu = (event, piece) => {
    event.preventDefault();
    setContextMenuPiece(piece);
    setAnchorEl(event.currentTarget);
  };

  const handleSearch = async () => {
    try {
      if (searchTerm.trim()) {
        const searchResults = await searchFurniturePieces(searchTerm);
        setFurniturePieces(searchResults);
      } else {
        await loadFurniturePieces();
      }
    } catch (err) {
      console.error('Error searching furniture pieces:', err);
      setError(`Failed to search furniture pieces: ${err.message}`);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Complete': return '#10B981';
      case 'In Progress': return '#F59E0B';
      case 'Before Only': return '#6B7280';
      case 'After Only': return '#8B5CF6';
      default: return '#6B7280';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Complete': return <CheckCircleIcon />;
      case 'In Progress': return <BuildIcon />;
      case 'Before Only': return <PhotoLibraryIcon />;
      case 'After Only': return <TransformIcon />;
      default: return <CategoryIcon />;
    }
  };

  if (loading) {
    return (
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 400,
        gap: 2,
        backgroundColor: '#1a1a1a',
        minHeight: '100vh',
        p: 3
      }}>
        <CircularProgress size={40} sx={{ color: '#b98f33' }} />
        <Typography variant="body2" sx={{ color: '#ffffff' }}>
          Loading furniture pieces...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ backgroundColor: '#1a1a1a', minHeight: '100vh', p: 3 }}>
      {/* Header */}
      <Paper sx={{ mb: 3, p: 3, backgroundColor: '#2a2a2a', border: '1px solid #333333' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 600, color: '#b98f33', mb: 1 }}>
              Furniture Piece Management
            </Typography>
            <Typography variant="body1" sx={{ color: '#ffffff' }}>
              Manage Before/After furniture transformations and track progress
            </Typography>
          </Box>
          <Button
            startIcon={<AddIcon />}
            onClick={handleCreatePiece}
            sx={buttonStyles.primaryButton}
          >
            Create Piece
          </Button>
        </Box>
      </Paper>

      {error && (
        <Alert
          severity="error"
          sx={{
            mb: 3,
            borderRadius: 2,
            '& .MuiAlert-message': { width: '100%' }
          }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {/* Search and Filter */}
      <Paper sx={{ p: 3, mb: 3, backgroundColor: '#2a2a2a', border: '1px solid #333333' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Search Furniture Pieces"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: '#b98f33' }} />
              }}
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel sx={{ color: '#b98f33' }}>Filter by Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Filter by Status"
                sx={{ color: '#ffffff' }}
              >
                <SelectMenuItem value="all">All Statuses</SelectMenuItem>
                <SelectMenuItem value="Complete">Complete</SelectMenuItem>
                <SelectMenuItem value="In Progress">In Progress</SelectMenuItem>
                <SelectMenuItem value="Before Only">Before Only</SelectMenuItem>
                <SelectMenuItem value="After Only">After Only</SelectMenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              fullWidth
              onClick={handleSearch}
              startIcon={<SearchIcon />}
              sx={buttonStyles.secondaryButton}
            >
              Search
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Furniture Pieces Grid */}
      <Grid container spacing={3}>
        {furniturePieces
          .filter(piece => statusFilter === 'all' || piece.status === statusFilter)
          .map((piece) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={piece.id}>
            <Card
              sx={{
                position: 'relative',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4
                },
                backgroundColor: '#2a2a2a',
                border: '1px solid #333333'
              }}
              onContextMenu={(e) => handleContextMenu(e, piece)}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{
                    bgcolor: getStatusColor(piece.status),
                    mr: 2,
                    width: 40,
                    height: 40
                  }}>
                    {getStatusIcon(piece.status)}
                  </Avatar>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#ffffff', fontSize: '1rem' }}>
                      {piece.description}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#b98f33', fontSize: '0.8rem' }}>
                      ID: {piece.furnitureId}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleContextMenu(e, piece);
                    }}
                    sx={{ color: '#b98f33' }}
                  >
                    <MoreVertIcon />
                  </IconButton>
                </Box>

                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                  <Chip
                    label={piece.status}
                    size="small"
                    sx={{
                      backgroundColor: getStatusColor(piece.status),
                      color: 'white',
                      fontWeight: 'bold',
                      fontSize: '0.7rem'
                    }}
                  />
                </Stack>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="caption" sx={{ color: '#b98f33' }}>
                    Before: {piece.beforeCount}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#b98f33' }}>
                    After: {piece.afterCount}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#b98f33' }}>
                    Progress: {piece.inProgressCount}
                  </Typography>
                </Box>

                <LinearProgress
                  variant="determinate"
                  value={piece.status === 'Complete' ? 100 : piece.status === 'In Progress' ? 50 : 25}
                  sx={{
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: '#333333',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: getStatusColor(piece.status)
                    }
                  }}
                />
              </CardContent>

              <CardActions sx={{ p: 2, pt: 0 }}>
                <Button
                  size="small"
                  onClick={() => handleEditPiece(piece)}
                  sx={{
                    color: getStatusColor(piece.status),
                    borderColor: getStatusColor(piece.status),
                    '&:hover': {
                      backgroundColor: `${getStatusColor(piece.status)}15`,
                      borderColor: getStatusColor(piece.status)
                    }
                  }}
                  variant="outlined"
                >
                  Edit
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Empty State */}
      {furniturePieces.length === 0 && (
        <Paper sx={{
          p: 8,
          textAlign: 'center',
          backgroundColor: '#2a2a2a',
          border: '1px solid #333333'
        }}>
          <Avatar sx={{
            bgcolor: '#b98f33',
            width: 80,
            height: 80,
            mx: 'auto',
            mb: 3
          }}>
            <TransformIcon sx={{ fontSize: 40 }} />
          </Avatar>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: '#b98f33' }}>
            No Furniture Pieces Yet
          </Typography>
          <Typography variant="body1" sx={{ color: '#ffffff', mb: 4, maxWidth: 400, mx: 'auto' }}>
            Furniture pieces are created automatically when you tag images with Before/After categories. Start tagging your transformation images to see them here.
          </Typography>
        </Paper>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => {
          handleEditPiece(contextMenuPiece);
          setAnchorEl(null);
        }}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit Piece</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleDeletePiece(contextMenuPiece)} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon color="error" />
          </ListItemIcon>
          <ListItemText>Delete Piece</ListItemText>
        </MenuItem>
      </Menu>

      {/* Create/Edit Dialog */}
      <Dialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#2a2a2a',
            border: '1px solid #333333'
          }
        }}
      >
        <DialogTitle sx={{ color: '#b98f33' }}>
          {editingPiece ? 'Edit Furniture Piece' : 'Create Furniture Piece'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Furniture Description"
              value={pieceDescription}
              onChange={(e) => setPieceDescription(e.target.value)}
              margin="normal"
              error={!!formErrors.description}
              helperText={formErrors.description}
              variant="outlined"
            />
            <TextField
              fullWidth
              label="Furniture ID (Optional)"
              value={pieceFurnitureId}
              onChange={(e) => setPieceFurnitureId(e.target.value)}
              margin="normal"
              error={!!formErrors.furnitureId}
              helperText={formErrors.furnitureId || 'Leave empty to auto-generate'}
              variant="outlined"
            />
            
            {formErrors.general && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {formErrors.general}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateDialog(false)} sx={buttonStyles.cancelButton}>
            Cancel
          </Button>
          <Button
            onClick={handleSavePiece}
            sx={buttonStyles.primaryButton}
          >
            {editingPiece ? 'Update Piece' : 'Create Piece'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, piece: null })}
        PaperProps={{
          sx: {
            backgroundColor: '#2a2a2a',
            border: '1px solid #333333'
          }
        }}
      >
        <DialogTitle sx={{ color: '#b98f33' }}>Delete Furniture Piece</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#ffffff' }}>
            Are you sure you want to delete the furniture piece "{deleteDialog.piece?.description}"? 
            This action cannot be undone and may affect existing images.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, piece: null })} sx={buttonStyles.cancelButton}>
            Cancel
          </Button>
          <Button
            onClick={confirmDelete}
            sx={buttonStyles.dangerButton}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FurniturePieceManagementPage;
