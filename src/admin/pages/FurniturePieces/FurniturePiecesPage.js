import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Paper,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Alert,
  CircularProgress,
  Fab,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Tooltip,
  FormControl,
  InputLabel,
  Select
} from '@mui/material';
import TransformIcon from '@mui/icons-material/Transform';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import SearchIcon from '@mui/icons-material/Search';
import { useAuth } from '../../../components/Auth/AuthContext';
import { getImages } from '../../../services/imageService';
import { getBeforeAfterCategories } from '../../../services/categoryService';
import { getTagsByCategory } from '../../../services/tagService';
import { getFurniturePieces, updateFurniturePiece, deleteFurniturePiece } from '../../../services/furniturePieceService';
import { getCategories } from '../../../services/categoryService';
import { getTags } from '../../../services/tagService';
import EnhancedImageTaggingDialog from '../../components/EnhancedImageTaggingDialog';

const FurniturePiecesPage = () => {
  const { user } = useAuth();
  const [furniturePieces, setFurniturePieces] = useState([]);
  const [beforeAfterImages, setBeforeAfterImages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [taggingDialogOpen, setTaggingDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [contextMenuImage, setContextMenuImage] = useState(null);

  // Filter states
  const [selectedFilters, setSelectedFilters] = useState({
    status: '', // before, after, inprogress, or ''
    searchTerm: ''
  });

  // Create piece dialog states
  const [createPieceDialogOpen, setCreatePieceDialogOpen] = useState(false);
  const [furniturePieceName, setFurniturePieceName] = useState('');
  const [selectedImagesForPiece, setSelectedImagesForPiece] = useState({}); // {imageId: 'before'|'after'|'inprogress'}

  // Edit piece dialog states
  const [editPieceDialogOpen, setEditPieceDialogOpen] = useState(false);
  const [editingPiece, setEditingPiece] = useState(null);

  // Tag management states
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [pieceForTagging, setPieceForTagging] = useState(null);
  const [allCategories, setAllCategories] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState({});
  const [selectedTagFilters, setSelectedTagFilters] = useState({}); // {categoryId: [tagIds]}

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [pieces, images, categoriesData, allCategoriesData, allTagsData] = await Promise.all([
        getFurniturePieces({ isActive: true }),
        getImages({ isActive: true }),
        getBeforeAfterCategories(),
        getCategories(),
        getTags()
      ]);

      // Filter images that have before/after/inprogress tags
      const filteredImages = images.filter(image => {
        return categoriesData.some(category => image.tags && image.tags[category.id]);
      });

      setFurniturePieces(pieces);
      setBeforeAfterImages(filteredImages);
      setCategories(categoriesData);
        setAllCategories(allCategoriesData);
        setAllTags(allTagsData);
        

      // Load tags for each category
      const tagsData = {};
      for (const category of categoriesData) {
        try {
          const categoryTags = await getTagsByCategory(category.id);
          tagsData[category.id] = categoryTags;
        } catch (error) {
          console.error(`Error loading tags for category ${category.id}:`, error);
          tagsData[category.id] = [];
        }
      }
      setTags(tagsData);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load furniture pieces');
    } finally {
      setLoading(false);
    }
  };

  const handleEditTags = (image) => {
    setSelectedImage(image);
    setTaggingDialogOpen(true);
  };

  const handleTaggingComplete = () => {
    setTaggingDialogOpen(false);
    setSelectedImage(null);
    loadData(); // Reload to get updated tags
  };

  const handleContextMenu = (event, image) => {
    event.preventDefault();
    setAnchorEl(event.currentTarget);
    setContextMenuImage(image);
  };

  const handleCloseContextMenu = () => {
    setAnchorEl(null);
    setContextMenuImage(null);
  };

  const handleEditPiece = (piece) => {
    setEditingPiece(piece);
    setFurniturePieceName(piece.name || '');
    
    // Pre-populate selected images with current piece images
    const currentImages = {};
    if (piece.images && piece.images.length > 0) {
      piece.images.forEach(img => {
        currentImages[img.imageId] = img.status;
      });
    }
    setSelectedImagesForPiece(currentImages);
    setEditPieceDialogOpen(true);
  };

  const handleDeletePiece = async (piece) => {
    if (window.confirm(`Are you sure you want to delete "${piece.name || 'this furniture piece'}"?`)) {
      try {
        await deleteFurniturePiece(piece.id);
        setError(null);
        await loadData(); // Reload data
      } catch (error) {
        console.error('Error deleting furniture piece:', error);
        setError('Failed to delete furniture piece');
      }
    }
  };

  const handleCloseEditPieceDialog = () => {
    setEditPieceDialogOpen(false);
    setEditingPiece(null);
    setFurniturePieceName('');
    setSelectedImagesForPiece({});
  };

  const handleSaveEditPiece = async () => {
    if (!furniturePieceName.trim()) {
      setError('Please enter a furniture piece name');
      return;
    }

    try {
      const updateData = {
        name: furniturePieceName.trim(),
        description: `Furniture piece created from before/after images`,
        updatedAt: new Date(),
        images: Object.entries(selectedImagesForPiece).map(([imageId, status]) => ({
          imageId: imageId,
          status: status,
          assignedAt: new Date()
        }))
      };

      await updateFurniturePiece(editingPiece.id, updateData);
      setError(null);
      handleCloseEditPieceDialog();
      await loadData(); // Reload data
    } catch (error) {
      console.error('Error updating furniture piece:', error);
      setError('Failed to update furniture piece');
    }
  };

  const handleEditPieceTags = (piece) => {
    console.log('Opening tag dialog for piece:', piece.name);
    console.log('Piece tags:', piece.tags);
    
    setPieceForTagging(piece);
    
    // Pre-populate selected tags with current piece tags, excluding before-after categories
    const currentTags = {};
    if (piece.tags) {
      Object.entries(piece.tags).forEach(([categoryId, tagIds]) => {
        // Skip before-after categories as they're represented by actual images
        const category = allCategories.find(cat => cat.id === categoryId);
        const isBeforeAfter = category && (
          category.categoryType === 'before-after' || 
          category.name?.toLowerCase().includes('before') ||
          category.name?.toLowerCase().includes('after')
        );
        
        if (isBeforeAfter) {
          return; // Skip this category
        }
        
        currentTags[categoryId] = Array.isArray(tagIds) ? tagIds : [tagIds];
      });
    }
    
    console.log('Pre-populated tags:', currentTags);
    setSelectedTags(currentTags);
    setTagDialogOpen(true);
  };

  const handleCloseTagDialog = () => {
    setTagDialogOpen(false);
    setPieceForTagging(null);
    setSelectedTags({});
  };

  const handleTagToggle = (categoryId, tagId) => {
    setSelectedTags(prev => {
      const newTags = { ...prev };
      
      // Initialize category array if it doesn't exist
      if (!newTags[categoryId]) {
        newTags[categoryId] = [];
      }
      
      // Check if tag is already selected
      const isSelected = newTags[categoryId].includes(tagId);
      
      if (isSelected) {
        // Remove tag
        newTags[categoryId] = newTags[categoryId].filter(id => id !== tagId);
        // Remove category if empty
        if (newTags[categoryId].length === 0) {
          delete newTags[categoryId];
        }
      } else {
        // Add tag
        newTags[categoryId] = [...newTags[categoryId], tagId];
      }
      
      return newTags;
    });
  };

  const handleSaveTags = async () => {
    if (!pieceForTagging) return;

    try {
      // Convert selectedTags to the format expected by the furniture piece
      const tagsToSave = {};
      Object.entries(selectedTags).forEach(([categoryId, tagIds]) => {
        // Skip before-after categories as they're represented by actual images
        const category = allCategories.find(cat => cat.id === categoryId);
        const isBeforeAfter = category && (
          category.categoryType === 'before-after' || 
          category.name?.toLowerCase().includes('before') ||
          category.name?.toLowerCase().includes('after')
        );
        
        if (isBeforeAfter) {
          return; // Skip this category
        }
        
        if (tagIds.length > 0) {
          tagsToSave[categoryId] = tagIds.length === 1 ? tagIds[0] : tagIds;
        }
      });

      // Preserve existing before-after tags if they exist
      if (pieceForTagging.tags) {
        Object.entries(pieceForTagging.tags).forEach(([categoryId, tagData]) => {
          const category = allCategories.find(cat => cat.id === categoryId);
          const isBeforeAfter = category && (
            category.categoryType === 'before-after' || 
            category.name?.toLowerCase().includes('before') ||
            category.name?.toLowerCase().includes('after')
          );
          
          if (isBeforeAfter) {
            tagsToSave[categoryId] = tagData; // Keep existing before-after tags
          }
        });
      }

      const updateData = {
        tags: tagsToSave,
        updatedAt: new Date()
      };

      console.log('Saving tags for piece:', pieceForTagging.name);
      console.log('Tags to save:', tagsToSave);
      
      await updateFurniturePiece(pieceForTagging.id, updateData);
      setError(null);
      handleCloseTagDialog();
      await loadData(); // Reload data
    } catch (error) {
      console.error('Error updating furniture piece tags:', error);
      setError('Failed to update furniture piece tags');
    }
  };

  const handleSetDefaultImage = async (piece, imageId, status) => {
    try {
      // Update the furniture piece to set this image as default for its status
      const updatedImages = piece.images.map(img => ({
        ...img,
        isDefault: img.imageId === imageId && img.status === status
      }));

      const updateData = {
        images: updatedImages,
        updatedAt: new Date()
      };

      await updateFurniturePiece(piece.id, updateData);
      await loadData(); // Reload data
    } catch (error) {
      console.error('Error setting default image:', error);
      setError('Failed to set default image');
    }
  };

  const handleCreatePiece = () => {
    setFurniturePieceName('');
    setSelectedImagesForPiece({});
    setCreatePieceDialogOpen(true);
  };

  const handleCloseCreatePieceDialog = () => {
    setCreatePieceDialogOpen(false);
    setFurniturePieceName('');
    setSelectedImagesForPiece({});
  };

  const handleImageAssignment = (imageId, status) => {
    setSelectedImagesForPiece(prev => {
      const newSelection = { ...prev };
      if (newSelection[imageId] === status) {
        // If same status is clicked, remove it
        delete newSelection[imageId];
      } else {
        // Otherwise, set the new status
        newSelection[imageId] = status;
      }
      return newSelection;
    });
  };

  const handleSaveFurniturePiece = async () => {
    if (!furniturePieceName.trim()) {
      setError('Please enter a furniture piece name');
      return;
    }

    if (Object.keys(selectedImagesForPiece).length === 0) {
      setError('Please select at least one image for the furniture piece');
      return;
    }

    try {
      // Group images by status and set first image as default for each status
      const imagesByStatus = {};
      Object.entries(selectedImagesForPiece).forEach(([imageId, status]) => {
        if (!imagesByStatus[status]) {
          imagesByStatus[status] = [];
        }
        imagesByStatus[status].push(imageId);
      });

      // Create furniture piece with assigned images
      const furniturePieceData = {
        name: furniturePieceName.trim(),
        description: `Furniture piece created from before/after images`,
        furnitureType: 'custom',
        createdBy: user?.email || 'unknown',
        images: Object.entries(selectedImagesForPiece).map(([imageId, status]) => ({
          imageId: imageId,
          status: status,
          assignedAt: new Date(),
          isDefault: imagesByStatus[status][0] === imageId // Set first image as default for each status
        }))
      };

      // Import the createFurniturePiece function
      const { createFurniturePiece } = await import('../../../services/furniturePieceService');
      await createFurniturePiece(furniturePieceData);

      setError(null);
      handleCloseCreatePieceDialog();
      await loadData(); // Reload data
    } catch (error) {
      console.error('Error creating furniture piece:', error);
      setError('Failed to create furniture piece');
    }
  };

  const handleFilterChange = (filterType, value) => {
    setSelectedFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const handleTagFilterToggle = (categoryId, tagId) => {
    setSelectedTagFilters(prev => {
      const newFilters = { ...prev };
      
      // Initialize category array if it doesn't exist
      if (!newFilters[categoryId]) {
        newFilters[categoryId] = [];
      }
      
      // Check if tag is already selected
      const isSelected = newFilters[categoryId].includes(tagId);
      
      if (isSelected) {
        // Remove tag
        newFilters[categoryId] = newFilters[categoryId].filter(id => id !== tagId);
        // Remove category if empty
        if (newFilters[categoryId].length === 0) {
          delete newFilters[categoryId];
        }
      } else {
        // Add tag
        newFilters[categoryId] = [...newFilters[categoryId], tagId];
      }
      
      return newFilters;
    });
  };

  const handleClearTagFilters = () => {
    setSelectedTagFilters({});
  };

  const getImageStatus = (image) => {
    for (const category of categories) {
      if (image.tags && image.tags[category.id]) {
        const tagId = image.tags[category.id];
        const tag = tags[category.id]?.find(t => t.id === tagId);
        if (tag) {
          return tag.name.toLowerCase();
        }
      }
    }
    return 'unknown';
  };

  const getFilteredFurniturePieces = () => {
    let filtered = furniturePieces;

    // Filter by search term
    if (selectedFilters.searchTerm) {
      const searchLower = selectedFilters.searchTerm.toLowerCase();
      filtered = filtered.filter(piece =>
        piece.name?.toLowerCase().includes(searchLower) ||
        piece.description?.toLowerCase().includes(searchLower) ||
        piece.furnitureType?.toLowerCase().includes(searchLower)
      );
    }

    // Filter by tags
    if (Object.keys(selectedTagFilters).length > 0) {
      filtered = filtered.filter(piece => {
        // Check if piece has any of the selected tags
        return Object.entries(selectedTagFilters).some(([categoryId, selectedTagIds]) => {
          if (!selectedTagIds || selectedTagIds.length === 0) return true; // No filter for this category
          
          // Check if piece has any of the selected tags in this category
          if (piece.tags && piece.tags[categoryId]) {
            const pieceTagIds = Array.isArray(piece.tags[categoryId]) 
              ? piece.tags[categoryId] 
              : [piece.tags[categoryId]];
            
            return selectedTagIds.some(tagId => pieceTagIds.includes(tagId));
          }
          
          return false;
        });
      });
    }

    return filtered;
  };

  const getUnassignedBeforeAfterImages = () => {
    // Get all image IDs that are already assigned to furniture pieces
    const assignedImageIds = new Set();
    furniturePieces.forEach(piece => {
      if (piece.images && piece.images.length > 0) {
        piece.images.forEach(img => {
          assignedImageIds.add(img.imageId);
        });
      }
    });

    // Filter before/after images to only show unassigned ones
    return beforeAfterImages.filter(image => !assignedImageIds.has(image.id));
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'before':
        return '#ff9800'; // Orange
      case 'after':
        return '#4caf50'; // Green
      case 'in progress':
        return '#2196f3'; // Blue
      default:
        return '#9e9e9e'; // Gray
    }
  };

  const renderImageTags = (image) => {
    const imageTags = [];
    
    Object.entries(image.tags || {}).forEach(([categoryId, tagId]) => {
      const category = categories.find(c => c.id === categoryId);
      const tag = tags[categoryId]?.find(t => t.id === tagId);
      
      if (category && tag) {
        // For before-after categories, show a single combined chip
        if (category.categoryType === 'before-after') {
          imageTags.push(
            <Chip
              key={`${categoryId}-combined`}
              label="Before & In Progress & After"
              size="small"
              sx={{
                backgroundColor: '#8b5cf6',
                color: 'white',
                fontSize: '0.75rem',
                height: '24px'
              }}
            />
          );
        } else {
          // For normal categories, show individual tags
          imageTags.push(
            <Chip
              key={`${categoryId}-${tagId}`}
              label={tag.name}
              size="small"
              sx={{
                backgroundColor: getStatusColor(tag.name),
                color: 'white',
                fontSize: '0.75rem',
                height: '24px',
                margin: '2px'
              }}
            />
          );
        }
      }
    });

    return imageTags;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress sx={{ color: '#b98f33' }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  const filteredFurniturePieces = getFilteredFurniturePieces();

  return (
    <Box sx={{ backgroundColor: '#1a1a1a', minHeight: '100vh', p: 3 }}>
      {/* Header */}
      <Paper sx={{ mb: 3, p: 3, backgroundColor: '#2a2a2a', border: '1px solid #333333' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <TransformIcon sx={{ fontSize: '2rem', color: '#b98f33' }} />
            <Box>
              <Typography variant="h4" component="h1" sx={{ 
                color: '#b98f33',
                fontWeight: 600,
                mb: 1
              }}>
                Furniture Pieces
              </Typography>
              <Typography variant="body1" sx={{ color: '#ffffff' }}>
                Manage furniture pieces with Before, In Progress, and After images
              </Typography>
            </Box>
          </Box>
          <Button
            variant="contained"
            startIcon={<TransformIcon />}
            onClick={handleCreatePiece}
            sx={{
              backgroundColor: '#b98f33',
              color: '#000000',
              '&:hover': { backgroundColor: '#d4af5a' }
            }}
          >
            Create Piece
          </Button>
        </Box>
      </Paper>

      {/* Search and Filter */}
      <Paper sx={{ p: 3, mb: 3, backgroundColor: '#2a2a2a', border: '1px solid #333333' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Search furniture pieces..."
              placeholder="Search furniture pieces..."
              value={selectedFilters.searchTerm}
              onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: '#b98f33' }} />
              }}
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  setSelectedFilters({ status: '', searchTerm: '' });
                  handleClearTagFilters();
                }}
                sx={{
                  borderColor: '#666666',
                  color: '#666666',
                  '&:hover': { 
                    backgroundColor: '#66666615',
                    borderColor: '#666666'
                  }
                }}
              >
                Clear Filters
              </Button>
              <Typography variant="body2" sx={{ color: '#b98f33', fontWeight: 600 }}>
                {filteredFurniturePieces.length} pieces
              </Typography>
            </Box>
          </Grid>
        </Grid>
        
        {/* Tag Filters */}
        {allCategories.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ color: '#b98f33', mb: 1, fontWeight: 600 }}>
              Filter by Tags:
            </Typography>
            <Grid container spacing={1}>
              {allCategories
                .filter(category => {
                  // Hide before-after categories by checking name or type
                  const isBeforeAfter = category.categoryType === 'before-after' || 
                                       category.name?.toLowerCase().includes('before') ||
                                       category.name?.toLowerCase().includes('after');
                  return !isBeforeAfter;
                })
                .map((category) => {
                  const categoryTags = allTags.filter(tag => tag.categoryId === category.id);
                  if (categoryTags.length === 0) return null;
                  
                  return (
                    <Grid item xs={12} sm={6} md={4} key={category.id}>
                      <Box sx={{ p: 2, border: '1px solid #333333', borderRadius: 1 }}>
                        <Typography variant="body2" sx={{ color: '#ffffff', mb: 1, fontWeight: 500 }}>
                          {category.name}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {categoryTags.map((tag) => {
                            const isSelected = selectedTagFilters[category.id]?.includes(tag.id) || false;
                            return (
                              <Chip
                                key={tag.id}
                                label={tag.name}
                                size="small"
                                onClick={() => handleTagFilterToggle(category.id, tag.id)}
                                sx={{
                                  backgroundColor: isSelected ? (category.color || '#b98f33') : 'transparent',
                                  color: isSelected ? '#000000' : (category.color || '#b98f33'),
                                  border: `1px solid ${category.color || '#b98f33'}`,
                                  cursor: 'pointer',
                                  '&:hover': {
                                    backgroundColor: isSelected ? (category.color || '#b98f33') : `${category.color || '#b98f33'}15`,
                                  }
                                }}
                              />
                            );
                          })}
                        </Box>
                      </Box>
                    </Grid>
                  );
                })}
            </Grid>
          </Box>
        )}
      </Paper>

      {/* Furniture Pieces Grid */}
      <Grid container spacing={3}>
        {getFilteredFurniturePieces().length === 0 ? (
          <Grid item xs={12}>
            <Paper sx={{ p: 4, textAlign: 'center', backgroundColor: '#2a2a2a', border: '1px solid #333333' }}>
              <TransformIcon sx={{ fontSize: 64, color: '#666', mb: 2 }} />
              <Typography variant="h6" sx={{ color: '#ffffff', mb: 1 }}>
                No Furniture Pieces Found
              </Typography>
              <Typography variant="body2" sx={{ color: '#b98f33' }}>
                {selectedFilters.searchTerm || Object.keys(selectedTagFilters).length > 0
                  ? 'Try adjusting your search or tag filters to see more furniture pieces'
                  : 'Furniture pieces created from before/after images will appear here'}
              </Typography>
            </Paper>
          </Grid>
        ) : (
          getFilteredFurniturePieces().map((piece) => {
            const beforeImages = piece.images?.filter(img => img.status === 'before') || [];
            const afterImages = piece.images?.filter(img => img.status === 'after') || [];
            const inProgressImages = piece.images?.filter(img => img.status === 'inprogress') || [];
            
            return (
              <Grid item xs={12} sm={6} md={4} lg={3} key={piece.id}>
                <Card
                  sx={{
                    width: 320,
                    height: 400,
                    display: 'flex',
                    flexDirection: 'column',
                    margin: '0 auto',
                    backgroundColor: '#2a2a2a',
                    border: '1px solid #333333',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
                      borderColor: '#b98f33'
                    }
                  }}
                >
                  {/* Piece Header */}
                  <Box sx={{ p: 2, borderBottom: '1px solid #333333' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Typography
                        variant="h6"
                        sx={{
                          fontSize: '1.1rem',
                          fontWeight: 'bold',
                          color: '#b98f33',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1
                        }}
                      >
                        {piece.name || `Furniture Piece ${piece.id?.slice(-6) || 'Unknown'}`}
                      </Typography>
                      
                      {/* Action Icons */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <IconButton
                          size="small"
                          onClick={() => handleEditPieceTags(piece)}
                          sx={{ 
                            color: '#b98f33',
                            padding: '4px',
                            minWidth: 'auto',
                            '&:hover': { 
                              backgroundColor: 'rgba(185, 143, 51, 0.15)',
                              transform: 'scale(1.15)',
                              boxShadow: '0 2px 8px rgba(185, 143, 51, 0.3)'
                            },
                            transition: 'all 0.2s ease',
                            borderRadius: '6px'
                          }}
                          title="Edit Tags"
                        >
                          <LocalOfferIcon sx={{ fontSize: '18px' }} />
                        </IconButton>
                        
                        <IconButton
                          size="small"
                          onClick={() => handleEditPiece(piece)}
                          sx={{ 
                            color: '#2196f3',
                            padding: '4px',
                            minWidth: 'auto',
                            '&:hover': { 
                              backgroundColor: 'rgba(33, 150, 243, 0.15)',
                              transform: 'scale(1.15)',
                              boxShadow: '0 2px 8px rgba(33, 150, 243, 0.3)'
                            },
                            transition: 'all 0.2s ease',
                            borderRadius: '6px'
                          }}
                          title="Edit Piece"
                        >
                          <EditIcon sx={{ fontSize: '18px' }} />
                        </IconButton>
                        
                        <IconButton
                          size="small"
                          onClick={() => handleDeletePiece(piece)}
                          sx={{ 
                            color: '#f44336',
                            padding: '4px',
                            minWidth: 'auto',
                            '&:hover': { 
                              backgroundColor: 'rgba(244, 67, 54, 0.15)',
                              transform: 'scale(1.15)',
                              boxShadow: '0 2px 8px rgba(244, 67, 54, 0.3)'
                            },
                            transition: 'all 0.2s ease',
                            borderRadius: '6px'
                          }}
                          title="Delete Piece"
                        >
                          <DeleteIcon sx={{ fontSize: '18px' }} />
                        </IconButton>
                      </Box>
                    </Box>
                    
                    {/* Tags Section */}
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {piece.tags && Object.keys(piece.tags).length > 0 ? (
                          Object.entries(piece.tags).map(([categoryId, tagIds]) => {
                            const category = allCategories.find(c => c.id === categoryId);
                            if (!category) return null;
                            
                            const tagsArray = Array.isArray(tagIds) ? tagIds : [tagIds];
                            return tagsArray.map(tagId => {
                              const tag = allTags.find(t => t.id === tagId);
                              if (!tag) return null;
                              
                              return (
                                <Chip
                                  key={`${categoryId}-${tagId}`}
                                  label={tag.name}
                                  size="small"
                                  sx={{
                                    backgroundColor: category.color || '#b98f33',
                                    color: 'white',
                                    fontSize: '0.7rem',
                                    height: '20px'
                                  }}
                                />
                              );
                            });
                          })
                        ) : (
                          <Typography variant="caption" sx={{ color: '#999', fontStyle: 'italic' }}>
                            No tags assigned
                          </Typography>
                        )}
                      </Box>
                    </Box>
                    
                    {piece.description && piece.description !== 'Furniture piece created from before/after images' && (
                      <Typography
                        variant="body2"
                        sx={{ color: '#666', mb: 1 }}
                      >
                        {piece.description}
                      </Typography>
                    )}

                  </Box>

                  <CardContent sx={{ flexGrow: 1, p: 2 }}>
                    {/* Image Counts with Thumbnails */}
                    <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                      {/* Before Section */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, flex: 1 }}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h6" sx={{ color: '#ff9800', fontWeight: 'bold' }}>
                            {beforeImages.length}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#666' }}>
                            Before
                          </Typography>
                        </Box>
                        {/* Before Thumbnails */}
                        {beforeImages.length > 0 && (
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                            {beforeImages.slice(0, 4).map((img, index) => {
                              const actualImage = beforeAfterImages.find(baImg => baImg.id === img.imageId);
                              if (!actualImage) return null;
                              
                              const isDefault = img.isDefault;
                              
                              return (
                                <Box
                                  key={`before-${index}`}
                                  sx={{
                                    position: 'relative',
                                    width: 32,
                                    height: 32,
                                    borderRadius: 0.5,
                                    overflow: 'hidden',
                                    border: isDefault ? `3px solid #ff9800` : `2px solid #ff9800`,
                                    cursor: 'pointer',
                                    boxShadow: isDefault ? '0 0 8px rgba(255, 152, 0, 0.5)' : 'none'
                                  }}
                                  title={`${actualImage.name} - Before${isDefault ? ' (Default)' : ''}${beforeImages.length > 1 ? ' - Click to set as default' : ''}`}
                                  onClick={() => beforeImages.length > 1 && handleSetDefaultImage(piece, img.imageId, 'before')}
                                >
                                  <img
                                    src={actualImage.cloudinaryUrl}
                                    alt={actualImage.name || 'Image'}
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      objectFit: 'cover'
                                    }}
                                  />
                                  {/* Default indicator */}
                                  {isDefault && (
                                    <Box
                                      sx={{
                                        position: 'absolute',
                                        top: -2,
                                        right: -2,
                                        width: 12,
                                        height: 12,
                                        backgroundColor: '#ff9800',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.5rem',
                                        color: 'white',
                                        fontWeight: 'bold',
                                        border: '1px solid white'
                                      }}
                                    >
                                      ★
                                    </Box>
                                  )}
                                </Box>
                              );
                            })}
                            {beforeImages.length > 4 && (
                              <Box
                                sx={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 0.5,
                                  backgroundColor: '#fff3e0',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.6rem',
                                  fontWeight: 'bold',
                                  color: '#ff9800',
                                  border: '2px solid #ff9800'
                                }}
                              >
                                +{beforeImages.length - 4}
                              </Box>
                            )}
                          </Box>
                        )}
                      </Box>

                      {/* In Progress Section */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, flex: 1 }}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h6" sx={{ color: '#2196f3', fontWeight: 'bold' }}>
                            {inProgressImages.length}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#666' }}>
                            In Progress
                          </Typography>
                        </Box>
                        {/* In Progress Thumbnails */}
                        {inProgressImages.length > 0 && (
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                            {inProgressImages.slice(0, 4).map((img, index) => {
                              const actualImage = beforeAfterImages.find(baImg => baImg.id === img.imageId);
                              if (!actualImage) return null;
                              
                              const isDefault = img.isDefault;
                              
                              return (
                                <Box
                                  key={`inprogress-${index}`}
                                  sx={{
                                    position: 'relative',
                                    width: 32,
                                    height: 32,
                                    borderRadius: 0.5,
                                    overflow: 'hidden',
                                    border: isDefault ? `3px solid #2196f3` : `2px solid #2196f3`,
                                    cursor: 'pointer',
                                    boxShadow: isDefault ? '0 0 8px rgba(33, 150, 243, 0.5)' : 'none'
                                  }}
                                  title={`${actualImage.name} - In Progress${isDefault ? ' (Default)' : ''}${inProgressImages.length > 1 ? ' - Click to set as default' : ''}`}
                                  onClick={() => inProgressImages.length > 1 && handleSetDefaultImage(piece, img.imageId, 'inprogress')}
                                >
                                  <img
                                    src={actualImage.cloudinaryUrl}
                                    alt={actualImage.name || 'Image'}
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      objectFit: 'cover'
                                    }}
                                  />
                                  {/* Default indicator */}
                                  {isDefault && (
                                    <Box
                                      sx={{
                                        position: 'absolute',
                                        top: -2,
                                        right: -2,
                                        width: 12,
                                        height: 12,
                                        backgroundColor: '#2196f3',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.5rem',
                                        color: 'white',
                                        fontWeight: 'bold',
                                        border: '1px solid white'
                                      }}
                                    >
                                      ★
                                    </Box>
                                  )}
                                </Box>
                              );
                            })}
                            {inProgressImages.length > 4 && (
                              <Box
                                sx={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 0.5,
                                  backgroundColor: '#e3f2fd',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.6rem',
                                  fontWeight: 'bold',
                                  color: '#2196f3',
                                  border: '2px solid #2196f3'
                                }}
                              >
                                +{inProgressImages.length - 4}
                              </Box>
                            )}
                          </Box>
                        )}
                      </Box>

                      {/* After Section */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, flex: 1 }}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h6" sx={{ color: '#4caf50', fontWeight: 'bold' }}>
                            {afterImages.length}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#666' }}>
                            After
                          </Typography>
                        </Box>
                        {/* After Thumbnails */}
                        {afterImages.length > 0 && (
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                            {afterImages.slice(0, 4).map((img, index) => {
                              const actualImage = beforeAfterImages.find(baImg => baImg.id === img.imageId);
                              if (!actualImage) return null;
                              
                              const isDefault = img.isDefault;
                              
                              return (
                                <Box
                                  key={`after-${index}`}
                                  sx={{
                                    position: 'relative',
                                    width: 32,
                                    height: 32,
                                    borderRadius: 0.5,
                                    overflow: 'hidden',
                                    border: isDefault ? `3px solid #4caf50` : `2px solid #4caf50`,
                                    cursor: 'pointer',
                                    boxShadow: isDefault ? '0 0 8px rgba(76, 175, 80, 0.5)' : 'none'
                                  }}
                                  title={`${actualImage.name} - After${isDefault ? ' (Default)' : ''}${afterImages.length > 1 ? ' - Click to set as default' : ''}`}
                                  onClick={() => afterImages.length > 1 && handleSetDefaultImage(piece, img.imageId, 'after')}
                                >
                                  <img
                                    src={actualImage.cloudinaryUrl}
                                    alt={actualImage.name || 'Image'}
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      objectFit: 'cover'
                                    }}
                                  />
                                  {/* Default indicator */}
                                  {isDefault && (
                                    <Box
                                      sx={{
                                        position: 'absolute',
                                        top: -2,
                                        right: -2,
                                        width: 12,
                                        height: 12,
                                        backgroundColor: '#4caf50',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.5rem',
                                        color: 'white',
                                        fontWeight: 'bold',
                                        border: '1px solid white'
                                      }}
                                    >
                                      ★
                                    </Box>
                                  )}
                                </Box>
                              );
                            })}
                            {afterImages.length > 4 && (
                              <Box
                                sx={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 0.5,
                                  backgroundColor: '#e8f5e8',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.6rem',
                                  fontWeight: 'bold',
                                  color: '#4caf50',
                                  border: '2px solid #4caf50'
                                }}
                              >
                                +{afterImages.length - 4}
                              </Box>
                            )}
                          </Box>
                        )}
                      </Box>
                    </Stack>


                    {/* Created Info */}
                    <Typography
                      variant="caption"
                      sx={{ color: '#999', fontSize: '0.7rem' }}
                    >
                      Created: {piece.createdAt ? new Date(piece.createdAt.seconds * 1000).toLocaleDateString() : 'Unknown'}
                    </Typography>
                  </CardContent>

                </Card>
              </Grid>
            );
          })
        )}
      </Grid>


      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseContextMenu}
      >
        <MenuItem onClick={() => {
          handleEditTags(contextMenuImage);
          handleCloseContextMenu();
        }}>
          <ListItemIcon>
            <LocalOfferIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit Tags</ListItemText>
        </MenuItem>
      </Menu>

      {/* Enhanced Tagging Dialog */}
      <EnhancedImageTaggingDialog
        open={taggingDialogOpen}
        onClose={() => setTaggingDialogOpen(false)}
        image={selectedImage}
        onTagged={handleTaggingComplete}
      />

      {/* Tag Management Dialog */}
      <Dialog
        open={tagDialogOpen}
        onClose={handleCloseTagDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ 
          backgroundColor: '#b98f33', 
          color: 'white', 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          fontWeight: 'bold',
          fontSize: '1.2rem'
        }}>
          <LocalOfferIcon />
          Manage Tags for "{pieceForTagging?.name || 'Furniture Piece'}"
        </DialogTitle>
        
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" sx={{ mb: 2, color: '#b98f33' }}>
              Select Tags
            </Typography>
            
            <Typography variant="body2" sx={{ mb: 3, color: '#666' }}>
              Click tags to assign them to this furniture piece. Tags can be selected from multiple categories.
            </Typography>
            <Typography variant="body2" sx={{ mb: 3, color: '#b98f33', fontStyle: 'italic', fontSize: '0.9rem' }}>
              Note: Before/After/In Progress tags are not shown here as they are represented by the actual images attached to this furniture piece.
            </Typography>
            

            <Grid container spacing={2}>
              {allCategories
                .filter(category => {
                  // Hide before-after categories by checking name or type
                  const isBeforeAfter = category.categoryType === 'before-after' || 
                                       category.name?.toLowerCase().includes('before') ||
                                       category.name?.toLowerCase().includes('after');
                  return !isBeforeAfter;
                })
                .map((category) => {
                  const categoryTags = allTags.filter(tag => tag.categoryId === category.id);
                  if (categoryTags.length === 0) return null;
                  
                  return (
                    <Grid item xs={12} sm={6} md={4} key={category.id}>
                      <Paper sx={{ p: 2, backgroundColor: '#f8f9fa' }}>
                        <Typography variant="subtitle2" sx={{ mb: 2, color: category.color || '#b98f33', fontWeight: 'bold' }}>
                          {category.name}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {categoryTags.map((tag) => {
                            const isSelected = selectedTags[category.id]?.includes(tag.id) || false;
                            console.log(`Tag ${tag.name} (${tag.id}) in category ${category.name} (${category.id}): isSelected = ${isSelected}`);
                            console.log('selectedTags for this category:', selectedTags[category.id]);
                            return (
                              <Chip
                                key={tag.id}
                                label={tag.name}
                                size="small"
                                onClick={(e) => {
                                  console.log('Chip clicked!', tag.name, tag.id, category.id);
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleTagToggle(category.id, tag.id);
                                }}
                                sx={{
                                  backgroundColor: isSelected ? (category.color || '#b98f33') : 'white',
                                  color: isSelected ? 'white' : (category.color || '#b98f33'),
                                  border: `2px solid ${category.color || '#b98f33'}`,
                                  cursor: 'pointer',
                                  fontWeight: isSelected ? 'bold' : 'normal',
                                  transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                                  transition: 'all 0.2s ease',
                                  '&:hover': {
                                    backgroundColor: isSelected ? (category.color || '#b98f33') : `${category.color || '#b98f33'}20`,
                                    transform: isSelected ? 'scale(1.05)' : 'scale(1.02)'
                                  }
                                }}
                              />
                            );
                          })}
                        </Box>
                      </Paper>
                    </Grid>
                  );
                })}
            </Grid>

            {/* Selected Tags Summary */}
            <Box sx={{ mt: 3, p: 2, backgroundColor: '#f0f0f0', borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: '#b98f33' }}>
                Selected Tags:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {Object.entries(selectedTags).map(([categoryId, tagIds]) => {
                  const category = allCategories.find(c => c.id === categoryId);
                  if (!category) return null;
                  
                  return tagIds.map(tagId => {
                    const tag = allTags.find(t => t.id === tagId);
                    if (!tag) return null;
                    
                    return (
                      <Chip
                        key={`${categoryId}-${tagId}`}
                        label={`${category.name}: ${tag.name}`}
                        size="small"
                        sx={{
                          backgroundColor: category.color || '#b98f33',
                          color: 'white',
                          fontSize: '0.7rem'
                        }}
                      />
                    );
                  });
                })}
                {Object.keys(selectedTags).length === 0 && (
                  <Typography variant="caption" sx={{ color: '#999', fontStyle: 'italic' }}>
                    No tags selected
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>
        </DialogContent>
        
        <DialogActions sx={{ p: 3, backgroundColor: '#f5f5f5' }}>
          <Button 
            onClick={handleCloseTagDialog} 
            sx={{ 
              color: '#666',
              textTransform: 'none',
              fontWeight: '500'
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveTags}
            variant="contained"
            sx={{
              backgroundColor: '#b98f33',
              color: 'white',
              '&:hover': { 
                backgroundColor: '#a67c00',
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 12px rgba(185, 143, 51, 0.3)'
              },
              px: 3,
              py: 1,
              borderRadius: 2,
              fontWeight: 'bold',
              textTransform: 'none',
              transition: 'all 0.2s ease'
            }}
          >
            Save Tags
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Piece Dialog */}
      <Dialog
        open={editPieceDialogOpen}
        onClose={handleCloseEditPieceDialog}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ 
          backgroundColor: '#b98f33', 
          color: 'white', 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          fontWeight: 'bold',
          fontSize: '1.2rem'
        }}>
          <EditIcon />
          Edit Furniture Piece
        </DialogTitle>
        
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              label="Furniture Piece Name"
              variant="outlined"
              fullWidth
              value={furniturePieceName}
              onChange={(e) => setFurniturePieceName(e.target.value)}
              placeholder="Enter furniture piece name..."
              sx={{ mb: 3 }}
            />
            
            <Typography variant="h6" sx={{ mb: 2, color: '#b98f33' }}>
              Manage Images
            </Typography>
            
            <Typography variant="body2" sx={{ mb: 3, color: '#666' }}>
              Click the Before, In Progress, or After buttons for each image to assign them to this furniture piece.
            </Typography>

            <Grid container spacing={2}>
              {beforeAfterImages.map((image) => (
                <Grid item xs={12} sm={6} md={4} key={image.id}>
                  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ position: 'relative', height: 200, overflow: 'hidden' }}>
                      <img
                        src={image.cloudinaryUrl}
                        alt={image.alt || image.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                      
                      {/* Assignment Status Indicator */}
                      {selectedImagesForPiece[image.id] && (
                        <Chip
                          label={selectedImagesForPiece[image.id].charAt(0).toUpperCase() + selectedImagesForPiece[image.id].slice(1)}
                          size="small"
                          sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            backgroundColor: getStatusColor(selectedImagesForPiece[image.id]),
                            color: 'white',
                            fontWeight: 'bold'
                          }}
                        />
                      )}
                    </Box>
                    
                    <CardContent sx={{ flexGrow: 1, p: 2 }}>
                      <Typography
                        variant="subtitle1"
                        sx={{
                          fontWeight: 'bold',
                          mb: 2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {image.name || 'Untitled'}
                      </Typography>
                      
                      {/* Assignment Buttons */}
                      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                        <Button
                          size="small"
                          variant={selectedImagesForPiece[image.id] === 'before' ? 'contained' : 'outlined'}
                          onClick={() => handleImageAssignment(image.id, 'before')}
                          sx={{
                            backgroundColor: selectedImagesForPiece[image.id] === 'before' ? '#ff9800' : 'transparent',
                            borderColor: '#ff9800',
                            color: selectedImagesForPiece[image.id] === 'before' ? 'white' : '#ff9800',
                            '&:hover': {
                              backgroundColor: selectedImagesForPiece[image.id] === 'before' ? '#f57c00' : '#fff3e0',
                              borderColor: '#f57c00'
                            },
                            flex: 1
                          }}
                        >
                          Before
                        </Button>
                        <Button
                          size="small"
                          variant={selectedImagesForPiece[image.id] === 'inprogress' ? 'contained' : 'outlined'}
                          onClick={() => handleImageAssignment(image.id, 'inprogress')}
                          sx={{
                            backgroundColor: selectedImagesForPiece[image.id] === 'inprogress' ? '#2196f3' : 'transparent',
                            borderColor: '#2196f3',
                            color: selectedImagesForPiece[image.id] === 'inprogress' ? 'white' : '#2196f3',
                            '&:hover': {
                              backgroundColor: selectedImagesForPiece[image.id] === 'inprogress' ? '#1976d2' : '#e3f2fd',
                              borderColor: '#1976d2'
                            },
                            flex: 1
                          }}
                        >
                          In Progress
                        </Button>
                        <Button
                          size="small"
                          variant={selectedImagesForPiece[image.id] === 'after' ? 'contained' : 'outlined'}
                          onClick={() => handleImageAssignment(image.id, 'after')}
                          sx={{
                            backgroundColor: selectedImagesForPiece[image.id] === 'after' ? '#4caf50' : 'transparent',
                            borderColor: '#4caf50',
                            color: selectedImagesForPiece[image.id] === 'after' ? 'white' : '#4caf50',
                            '&:hover': {
                              backgroundColor: selectedImagesForPiece[image.id] === 'after' ? '#388e3c' : '#e8f5e8',
                              borderColor: '#388e3c'
                            },
                            flex: 1
                          }}
                        >
                          After
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        </DialogContent>
        
        <DialogActions sx={{ p: 3, backgroundColor: '#f5f5f5' }}>
          <Button 
            onClick={handleCloseEditPieceDialog} 
            sx={{ 
              color: '#666',
              textTransform: 'none',
              fontWeight: '500'
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveEditPiece}
            variant="contained"
            sx={{
              backgroundColor: '#b98f33',
              color: 'white',
              '&:hover': { 
                backgroundColor: '#a67c00',
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 12px rgba(185, 143, 51, 0.3)'
              },
              px: 3,
              py: 1,
              borderRadius: 2,
              fontWeight: 'bold',
              textTransform: 'none',
              transition: 'all 0.2s ease'
            }}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Piece Dialog */}
      <Dialog
        open={createPieceDialogOpen}
        onClose={handleCloseCreatePieceDialog}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ 
          backgroundColor: '#b98f33', 
          color: 'white', 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          fontWeight: 'bold',
          fontSize: '1.2rem'
        }}>
          <TransformIcon />
          Create New Furniture Piece
        </DialogTitle>
        
        <DialogContent>
          <Box sx={{ mb: 3 }}>
            <TextField
              label="Furniture Piece Name"
              variant="outlined"
              fullWidth
              value={furniturePieceName}
              onChange={(e) => setFurniturePieceName(e.target.value)}
              sx={{ mb: 2 }}
              placeholder="Enter furniture piece name..."
            />
            
            <Typography variant="h6" sx={{ mb: 2, color: '#b98f33' }}>
              Select Images and Assign Status ({getUnassignedBeforeAfterImages().length} unassigned images available)
            </Typography>
            
            <Typography variant="body2" sx={{ mb: 3, color: '#666' }}>
              Click the Before, In Progress, or After buttons for each image to assign them to this furniture piece.
              Only unassigned before/after images are shown.
            </Typography>

            <Grid container spacing={2}>
              {getUnassignedBeforeAfterImages().map((image) => (
                <Grid item xs={12} sm={6} md={4} key={image.id}>
                  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ position: 'relative', height: 200, overflow: 'hidden' }}>
                      <img
                        src={image.cloudinaryUrl}
                        alt={image.alt || image.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                      
                      {/* Assignment Status Indicator */}
                      {selectedImagesForPiece[image.id] && (
                        <Chip
                          label={selectedImagesForPiece[image.id].charAt(0).toUpperCase() + selectedImagesForPiece[image.id].slice(1)}
                          size="small"
                          sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            backgroundColor: getStatusColor(selectedImagesForPiece[image.id]),
                            color: 'white',
                            fontWeight: 'bold'
                          }}
                        />
                      )}
                    </Box>
                    
                    <CardContent sx={{ flexGrow: 1, p: 2 }}>
                      <Typography
                        variant="subtitle1"
                        sx={{
                          fontWeight: 'bold',
                          mb: 2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {image.name || 'Untitled'}
                      </Typography>
                      
                      {/* Assignment Buttons */}
                      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                        <Button
                          size="small"
                          variant={selectedImagesForPiece[image.id] === 'before' ? 'contained' : 'outlined'}
                          onClick={() => handleImageAssignment(image.id, 'before')}
                          sx={{
                            backgroundColor: selectedImagesForPiece[image.id] === 'before' ? '#ff9800' : 'transparent',
                            borderColor: '#ff9800',
                            color: selectedImagesForPiece[image.id] === 'before' ? 'white' : '#ff9800',
                            '&:hover': {
                              backgroundColor: selectedImagesForPiece[image.id] === 'before' ? '#f57c00' : '#fff3e0',
                              borderColor: '#f57c00'
                            },
                            flex: 1
                          }}
                        >
                          Before
                        </Button>
                        <Button
                          size="small"
                          variant={selectedImagesForPiece[image.id] === 'inprogress' ? 'contained' : 'outlined'}
                          onClick={() => handleImageAssignment(image.id, 'inprogress')}
                          sx={{
                            backgroundColor: selectedImagesForPiece[image.id] === 'inprogress' ? '#2196f3' : 'transparent',
                            borderColor: '#2196f3',
                            color: selectedImagesForPiece[image.id] === 'inprogress' ? 'white' : '#2196f3',
                            '&:hover': {
                              backgroundColor: selectedImagesForPiece[image.id] === 'inprogress' ? '#1976d2' : '#e3f2fd',
                              borderColor: '#1976d2'
                            },
                            flex: 1
                          }}
                        >
                          In Progress
                        </Button>
                        <Button
                          size="small"
                          variant={selectedImagesForPiece[image.id] === 'after' ? 'contained' : 'outlined'}
                          onClick={() => handleImageAssignment(image.id, 'after')}
                          sx={{
                            backgroundColor: selectedImagesForPiece[image.id] === 'after' ? '#4caf50' : 'transparent',
                            borderColor: '#4caf50',
                            color: selectedImagesForPiece[image.id] === 'after' ? 'white' : '#4caf50',
                            '&:hover': {
                              backgroundColor: selectedImagesForPiece[image.id] === 'after' ? '#388e3c' : '#e8f5e8',
                              borderColor: '#388e3c'
                            },
                            flex: 1
                          }}
                        >
                          After
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        </DialogContent>
        
        <DialogActions sx={{ p: 3, backgroundColor: '#f5f5f5' }}>
          <Button 
            onClick={handleCloseCreatePieceDialog} 
            sx={{ 
              color: '#666',
              textTransform: 'none',
              fontWeight: '500'
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveFurniturePiece}
            variant="contained"
            sx={{
              backgroundColor: '#b98f33',
              color: 'white',
              '&:hover': { 
                backgroundColor: '#a67c00',
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 12px rgba(185, 143, 51, 0.3)'
              },
              px: 3,
              py: 1,
              borderRadius: 2,
              fontWeight: 'bold',
              textTransform: 'none',
              transition: 'all 0.2s ease'
            }}
          >
            Create Furniture Piece
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FurniturePiecesPage;
