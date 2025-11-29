import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Tooltip,
  Alert,
  LinearProgress,
  Fab,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Avatar,
  Stack
} from '@mui/material';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AddIcon from '@mui/icons-material/Add';
import FolderIcon from '@mui/icons-material/Folder';
import ImageIcon from '@mui/icons-material/Image';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import TransformIcon from '@mui/icons-material/Transform';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import { useNavigate } from 'react-router-dom';
import { uploadImageToCloudinary, deleteImageFromCloudinary, getCloudinaryImageUrl } from '../../../config/cloudinary';
import { 
  saveImageMetadata, 
  getImages, 
  updateImageMetadata, 
  deleteImageMetadata,
  searchImages 
} from '../../../services/imageService';
import { removeImageFromAllFurniturePieces } from '../../../services/furniturePieceService';
import { useAuth } from '../../../components/Auth/AuthContext';
import EnhancedImageTaggingDialog from '../../components/EnhancedImageTaggingDialog';
import { getCategories, getBeforeAfterCategories } from '../../../services/categoryService';
import { getTagsByCategory } from '../../../services/tagService';

const ImageGalleryPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFiles, setUploadingFiles] = useState([]); // Array of { file, progress, status, error }
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [contextMenuImage, setContextMenuImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [editingAlt, setEditingAlt] = useState('');
  const [enhancedTaggingOpen, setEnhancedTaggingOpen] = useState(false);
  const [selectedImagesForTagging, setSelectedImagesForTagging] = useState([]);
  const [categories, setCategories] = useState([]);
  const [beforeAfterCategories, setBeforeAfterCategories] = useState([]);
  const [tags, setTags] = useState({});
  const [selectedTagFilters, setSelectedTagFilters] = useState({});
  const [showAllImages, setShowAllImages] = useState(false);
  const [showBeforeAfterOnly, setShowBeforeAfterOnly] = useState(false);

  const [images, setImages] = useState([]);

  // Helper function to get thumbnail URL for gallery grid
  const getThumbnailUrl = (image) => {
    // If we have a public ID, use Cloudinary transformations for optimized thumbnails
    if (image.cloudinaryPublicId) {
      return getCloudinaryImageUrl(image.cloudinaryPublicId, {
        w: 400,
        h: 300,
        c: 'fill',
        q: 'auto',
        f: 'auto'
      });
    }
    
    // Fallback: If we have a Cloudinary URL, try to extract public ID and transform it
    if (image.cloudinaryUrl && image.cloudinaryUrl.includes('cloudinary.com')) {
      try {
        // Extract public ID from Cloudinary URL
        // Format: https://res.cloudinary.com/{cloud}/image/upload/{transformations}/{public_id}
        const urlParts = image.cloudinaryUrl.split('/upload/');
        if (urlParts.length > 1) {
          const publicIdWithTransforms = urlParts[1];
          // Remove any existing transformations to get just the public ID
          const publicId = publicIdWithTransforms.split('/').slice(-1)[0];
          return getCloudinaryImageUrl(publicId, {
            w: 400,
            h: 300,
            c: 'fill',
            q: 'auto',
            f: 'auto'
          });
        }
      } catch (e) {
        console.warn('Could not parse Cloudinary URL:', e);
      }
    }
    
    // Final fallback to original URL
    return image.cloudinaryUrl;
  };

  // Load images from Firebase on component mount
  useEffect(() => {
    loadImages();
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const categoriesData = await getCategories({ isActive: true });
      setCategories(categoriesData);
      
      // Load before/after categories separately
      const beforeAfterData = await getBeforeAfterCategories();
      setBeforeAfterCategories(beforeAfterData);
      
      // Load tags for each category
      const tagsData = {};
      for (const category of categoriesData) {
        const categoryTags = await getTagsByCategory(category.id);
        tagsData[category.id] = categoryTags;
      }
      setTags(tagsData);
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };


  const loadImages = async () => {
    try {
      setLoading(true);
      const imagesData = await getImages({ isActive: true });
      setImages(imagesData);
    } catch (error) {
      console.error('Error loading images:', error);
      setError('Failed to load images');
    } finally {
      setLoading(false);
    }
  };


  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (files.length > 0) {
      setUploading(true);
      setUploadProgress(0);
      setError(null);
      
      try {
        const file = files[0];
        
        // Upload to Cloudinary with real progress tracking
        const cloudinaryResult = await uploadImageToCloudinary(
          file,
          {
            folder: 'website-images'
          },
          // Progress callback function
          (progress) => {
            setUploadProgress(progress);
          }
        );
        
        // Prepare metadata for Firebase
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        const imageMetadata = {
          ...cloudinaryResult,
          originalName: file.name,
          name: file.name,
          alt: nameWithoutExt, // Alt text without extension
          uploadedBy: user?.email || 'unknown',
          description: ''
        };
        
        // Save metadata to Firebase
        const savedImage = await saveImageMetadata(imageMetadata);
        
        // Update local state
        setImages(prev => [savedImage, ...prev]);
        
        // Show completion for a moment
        setUploadProgress(100);
        setTimeout(() => {
          setUploading(false);
          setUploadProgress(0);
        }, 1000);
        
      } catch (error) {
        console.error('Upload error:', error);
        setError(`Failed to upload image: ${error.message}`);
        setUploading(false);
        setUploadProgress(0);
      }
    }
  };

  const handleDeleteImage = async (imageId) => {
    try {
      const image = images.find(img => img.id === imageId);
      if (!image) return;
      
      // Show confirmation dialog
      if (!window.confirm(`Are you sure you want to delete "${image.name}"? This action cannot be undone.`)) {
        return;
      }
      
      // Delete from Cloudinary first
      if (image.cloudinaryPublicId) {
        try {
          await deleteImageFromCloudinary(image.cloudinaryPublicId);
          console.log('Successfully deleted from Cloudinary');
        } catch (cloudinaryError) {
          console.error('Failed to delete from Cloudinary:', cloudinaryError);
          // Continue with Firebase deletion even if Cloudinary fails
          setError(`Warning: Image deleted from database but may still exist in Cloudinary. Error: ${cloudinaryError.message}`);
        }
      }
      
      // Remove image from all furniture pieces first
      try {
        await removeImageFromAllFurniturePieces(imageId);
        console.log('Successfully removed image from all furniture pieces');
      } catch (furnitureError) {
        console.error('Failed to remove image from furniture pieces:', furnitureError);
        // Continue with deletion even if furniture piece update fails
        setError(`Warning: Image deleted but may still be referenced in furniture pieces. Error: ${furnitureError.message}`);
      }
      
      // Delete metadata from Firebase (hard delete)
      await deleteImageMetadata(imageId);
      console.log('Successfully deleted from Firebase');
      
      // Update local state
      setImages(prev => prev.filter(img => img.id !== imageId));
      setContextMenuImage(null);
      setAnchorEl(null);
      
      console.log('Successfully deleted image:', image.name);
      
    } catch (error) {
      console.error('Delete error:', error);
      setError(`Failed to delete image: ${error.message}`);
    }
  };

  const handleEditImage = (image) => {
    setSelectedImage(image);
    // Extract name without extension
    const nameWithoutExt = image.name.replace(/\.[^/.]+$/, "");
    setEditingName(nameWithoutExt);
    setEditingAlt(image.alt || '');
    setEditDialogOpen(true);
    setContextMenuImage(null);
    setAnchorEl(null);
  };

  const handlePreviewImage = (image) => {
    setSelectedImage(image);
    setPreviewOpen(true);
  };

  const handleContextMenu = (event, image) => {
    event.preventDefault();
    setContextMenuImage(image);
    setAnchorEl(event.currentTarget);
  };

  const handleEnhancedTagging = (image) => {
    setSelectedImagesForTagging([image]);
    setEnhancedTaggingOpen(true);
    setAnchorEl(null);
  };

  const handleBulkTagging = () => {
    setSelectedImagesForTagging(images);
    setEnhancedTaggingOpen(true);
  };

  const handleTagged = () => {
    loadImages(); // Reload images to show updated tags
  };

  const handleTagSelection = (categoryId, tagId) => {
    setSelectedTagFilters(prev => {
      const currentTags = prev[categoryId] || [];
      const isSelected = currentTags.includes(tagId);
      
      if (isSelected) {
        // Remove tag from selection
        const newTags = currentTags.filter(id => id !== tagId);
        if (newTags.length === 0) {
          // Remove category if no tags selected
          const { [categoryId]: removed, ...rest } = prev;
          return rest;
        }
        return { ...prev, [categoryId]: newTags };
      } else {
        // Add tag to selection
        return { ...prev, [categoryId]: [...currentTags, tagId] };
      }
    });
    setShowAllImages(false); // Disable "Show All" when selecting tags
  };

  const handleShowAllImages = () => {
    setShowAllImages(true);
    setShowBeforeAfterOnly(false);
    setSelectedTagFilters({}); // Clear all tag filters
  };

  const handleShowBeforeAfterOnly = () => {
    setShowBeforeAfterOnly(true);
    setShowAllImages(false);
    setSelectedTagFilters({}); // Clear all tag filters
  };

  const handleClearFilters = () => {
    setShowAllImages(false);
    setShowBeforeAfterOnly(false);
    setSelectedTagFilters({});
    setSearchTerm('');
  };


  const handleSaveImageEdit = async () => {
    if (!selectedImage) return;
    
    try {
      // Get the original file extension
      const originalExt = selectedImage.name.split('.').pop();
      const newName = `${editingName}.${originalExt}`;
      
      await updateImageMetadata(selectedImage.id, {
        name: newName,
        alt: editingAlt
      });
      
      // Update local state
      setImages(prev => prev.map(img => 
        img.id === selectedImage.id 
          ? { ...img, name: newName, alt: editingAlt }
          : img
      ));
      
      setEditDialogOpen(false);
    } catch (error) {
      console.error('Error updating image:', error);
      setError('Failed to update image details');
    }
  };


  const filteredImages = images.filter(image => {
    // Text search
    const matchesSearch = searchTerm === '' || 
      image.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      image.alt.toLowerCase().includes(searchTerm.toLowerCase());
    
    // If "Show All" is enabled, only filter by search term
    if (showAllImages) {
      return matchesSearch;
    }
    
    // Before/After filter - show only images tagged with before/after categories
    if (showBeforeAfterOnly) {
      const hasBeforeAfterTag = beforeAfterCategories.some(category => {
        return image.tags && image.tags[category.id];
      });
      return matchesSearch && hasBeforeAfterTag;
    }
    
    // Tag filtering - check if image has any of the selected tags
    const hasSelectedTags = Object.keys(selectedTagFilters).length === 0 || 
      Object.entries(selectedTagFilters).some(([categoryId, selectedTagIds]) => {
        if (!selectedTagIds || selectedTagIds.length === 0) return true; // No filter for this category
        
        // Check if image has any of the selected tags in this category
        return image.tags && selectedTagIds.includes(image.tags[categoryId]);
      });
    
    return matchesSearch && hasSelectedTags;
  });

  return (
    <Box sx={{ backgroundColor: '#1a1a1a', minHeight: '100vh', p: 3 }}>
      {/* Header */}
      <Paper sx={{ mb: 3, p: 3, backgroundColor: '#2a2a2a', border: '1px solid #333333' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <PhotoLibraryIcon sx={{ fontSize: '2rem', color: '#b98f33' }} />
            <Box>
              <Typography variant="h4" component="h1" sx={{ 
                color: '#b98f33',
                fontWeight: 600,
                mb: 1
              }}>
                Media Gallery
              </Typography>
              <Typography variant="body1" sx={{ color: '#ffffff' }}>
                Upload and manage your website images and media files
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<TransformIcon />}
              onClick={handleBulkTagging}
              sx={{
                borderColor: '#b98f33',
                color: '#b98f33',
                '&:hover': { 
                  backgroundColor: '#b98f3315',
                  borderColor: '#b98f33'
                }
              }}
            >
              Enhanced Tagging
            </Button>
            <Button
              variant="contained"
              startIcon={<CloudUploadIcon />}
              onClick={() => fileInputRef.current?.click()}
              sx={{
                backgroundColor: '#b98f33',
                color: '#000000',
                '&:hover': { backgroundColor: '#d4af5a' }
              }}
            >
              Upload Media
            </Button>
          </Box>
        </Box>

        {/* Search and Filter */}
        <Paper sx={{ p: 3, mb: 3, backgroundColor: '#2a2a2a', border: '1px solid #333333' }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Search images..."
                placeholder="Search images..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: '#b98f33' }} />
                }}
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Button
                  variant={showAllImages ? "contained" : "outlined"}
                  size="small"
                  onClick={handleShowAllImages}
                  sx={{
                    backgroundColor: showAllImages ? '#b98f33' : 'transparent',
                    borderColor: '#b98f33',
                    color: showAllImages ? '#000000' : '#b98f33',
                    '&:hover': { 
                      backgroundColor: showAllImages ? '#d4af5a' : '#b98f3315'
                    }
                  }}
                >
                  Show All
                </Button>
                <Button
                  variant={showBeforeAfterOnly ? "contained" : "outlined"}
                  size="small"
                  onClick={handleShowBeforeAfterOnly}
                  sx={{
                    backgroundColor: showBeforeAfterOnly ? '#f27921' : 'transparent',
                    borderColor: '#f27921',
                    color: showBeforeAfterOnly ? '#000000' : '#f27921',
                    '&:hover': { 
                      backgroundColor: showBeforeAfterOnly ? '#e66a0f' : '#f2792115'
                    }
                  }}
                >
                  Before/After Only
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleClearFilters}
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
                  {filteredImages.length} images
                </Typography>
              </Box>
            </Grid>
          </Grid>
          
          {/* Tag Filters */}
          {categories.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ color: '#b98f33', mb: 1, fontWeight: 600 }}>
                Filter by Tags:
              </Typography>
              <Grid container spacing={1}>
                {categories.map((category) => (
                  <Grid item xs={12} sm={6} md={4} key={category.id}>
                    <Box sx={{ p: 2, border: '1px solid #333333', borderRadius: 1 }}>
                      <Typography variant="body2" sx={{ color: '#ffffff', mb: 1, fontWeight: 500 }}>
                        {category.name}
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {(() => {
                          if (category.categoryType === 'before-after') {
                            // For before/after categories, show combined tag
                            const beforeTag = tags[category.id]?.find(tag => tag.name.toLowerCase() === 'before');
                            const afterTag = tags[category.id]?.find(tag => tag.name.toLowerCase() === 'after');
                            const inProgressTag = tags[category.id]?.find(tag => tag.name.toLowerCase() === 'in progress');
                            
                            const isSelected = selectedTagFilters[category.id]?.includes(beforeTag?.id) ||
                                             selectedTagFilters[category.id]?.includes(afterTag?.id) ||
                                             selectedTagFilters[category.id]?.includes(inProgressTag?.id);
                            
                            return (
                              <Chip
                                key="before-after-inprogress-combined"
                                label="Before & In Progress & After"
                                size="small"
                                onClick={() => {
                                  // Toggle all three tags when clicking the combined tag
                                  if (isSelected) {
                                    // Remove all three
                                    if (beforeTag) handleTagSelection(category.id, beforeTag.id);
                                    if (afterTag) handleTagSelection(category.id, afterTag.id);
                                    if (inProgressTag) handleTagSelection(category.id, inProgressTag.id);
                                  } else {
                                    // Add all three
                                    if (beforeTag) handleTagSelection(category.id, beforeTag.id);
                                    if (afterTag) handleTagSelection(category.id, afterTag.id);
                                    if (inProgressTag) handleTagSelection(category.id, inProgressTag.id);
                                  }
                                }}
                                sx={{
                                  backgroundColor: isSelected ? '#8b5cf6' : '#2a2a2a',
                                  color: isSelected ? 'white' : '#b98f33',
                                  border: isSelected ? 'none' : '1px solid #8b5cf6',
                                  cursor: 'pointer',
                                  fontSize: '0.8rem',
                                  height: 24,
                                  fontWeight: 600,
                                  '&:hover': {
                                    backgroundColor: isSelected ? '#8b5cf6' : '#8b5cf615'
                                  }
                                }}
                              />
                            );
                          } else {
                            // Normal categories - show individual tags
                            return tags[category.id]?.map((tag) => {
                              const isSelected = selectedTagFilters[category.id]?.includes(tag.id) || false;
                              return (
                                <Chip
                                  key={tag.id}
                                  label={tag.name}
                                  size="small"
                                  onClick={() => handleTagSelection(category.id, tag.id)}
                                  sx={{
                                    backgroundColor: isSelected ? category.color : '#2a2a2a',
                                    color: isSelected ? 'white' : '#b98f33',
                                    border: isSelected ? 'none' : `1px solid ${category.color}`,
                                    cursor: 'pointer',
                                    fontSize: '0.7rem',
                                    height: 24,
                                    '&:hover': {
                                      backgroundColor: isSelected ? category.color : `${category.color}15`
                                    }
                                  }}
                                />
                              );
                            });
                          }
                        })()}
                      </Box>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </Paper>


        {/* Upload Progress */}
        {uploading && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Box sx={{ width: '100%' }}>
              <Typography variant="body2" gutterBottom>
                Uploading image... {Math.round(uploadProgress)}%
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={uploadProgress} 
                sx={{ 
                  height: 8, 
                  borderRadius: 4,
                  backgroundColor: 'rgba(0,0,0,0.1)',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 4,
                    backgroundColor: '#f27921'
                  }
                }} 
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {uploadProgress < 100 ? 'Uploading to Cloudinary...' : 'Processing...'}
              </Typography>
            </Box>
          </Alert>
        )}

        {/* Error Display */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Loading State */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Image Grid */}
        <Box sx={{ 
          width: '100%',
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(4, 1fr)',
            lg: 'repeat(6, 1fr)'
          },
          gap: 2
        }}>
          {filteredImages.map((image) => (
            <Box
              key={image.id}
              sx={{ 
                display: 'flex',
                minWidth: 0,
                width: '100%'
              }}
            >
              <Card 
                sx={{ 
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  backgroundColor: '#2a2a2a',
                  border: '1px solid #333333',
                  width: '100%',
                  maxWidth: '100%',
                  minWidth: 0,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                  '& *': {
                    maxWidth: '100%',
                    boxSizing: 'border-box'
                  },
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4
                  }
                }}
                onContextMenu={(e) => handleContextMenu(e, image)}
                onClick={() => handlePreviewImage(image)}
              >
                <Box sx={{ 
                  width: '100%',
                  maxWidth: '100%',
                  minWidth: 0,
                  height: 200,
                  flexShrink: 0,
                  flexGrow: 0,
                  backgroundImage: `url(${getThumbnailUrl(image)})`,
                  backgroundSize: 'cover',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                  boxSizing: 'border-box',
                  contain: 'layout style paint'
                }}>
                  
                  {/* Action Buttons */}
                  <Box sx={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    display: 'flex',
                    gap: 1
                  }}>
                    <Tooltip title="Edit Tags">
                      <IconButton
                        sx={{
                          backgroundColor: 'rgba(0,0,0,0.7)',
                          color: 'white',
                          '&:hover': {
                            backgroundColor: 'rgba(185, 143, 51, 0.9)'
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEnhancedTagging(image);
                        }}
                        size="small"
                      >
                        <LocalOfferIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Edit Name">
                      <IconButton
                        sx={{
                          backgroundColor: 'rgba(0,0,0,0.7)',
                          color: 'white',
                          '&:hover': {
                            backgroundColor: 'rgba(0,0,0,0.9)'
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditImage(image);
                        }}
                        size="small"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    
                    <Tooltip title="Delete Image">
                      <IconButton
                        sx={{
                          backgroundColor: 'rgba(0,0,0,0.7)',
                          color: 'white',
                          '&:hover': {
                            backgroundColor: 'rgba(220, 38, 38, 0.9)'
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteImage(image.id);
                        }}
                        size="small"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  
                  <Box sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                    p: 2,
                    width: '100%',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                    overflow: 'hidden'
                  }}>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: 'white', 
                        fontWeight: 'bold',
                        width: '100%',
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {image.name}
                    </Typography>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        color: 'rgba(255,255,255,0.8)',
                        width: '100%',
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {image.width}x{image.height} • {(image.fileSize / 1024 / 1024).toFixed(1)}MB
                    </Typography>
                  </Box>
                </Box>
                
                <CardContent sx={{ 
                  p: 2, 
                  display: 'flex',
                  flexDirection: 'column',
                  flexGrow: 1,
                  minWidth: 0,
                  maxWidth: '100%',
                  width: '100%',
                  overflow: 'hidden',
                  boxSizing: 'border-box'
                }}>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: '#ffffff', 
                      mb: 1,
                      width: '100%',
                      maxWidth: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {image.alt}
                  </Typography>
                  
                  {/* Tags Display */}
                  {image.tags && Object.keys(image.tags).length > 0 && (
                    <Box sx={{ 
                      mb: 1, 
                      width: '100%',
                      minWidth: 0
                    }}>
                      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                        {Object.entries(image.tags)
                          .filter(([categoryId, tagValue]) => categoryId && tagValue)
                          .flatMap(([categoryId, tagValue]) => {
                            // Handle both old format (single tagId) and new format (array of tagIds)
                            const tagIds = Array.isArray(tagValue) ? tagValue : [tagValue];
                            
                            const category = categories.find(cat => cat.id === categoryId);
                            const beforeAfterCategory = beforeAfterCategories.find(cat => cat.id === categoryId);
                            
                            return tagIds
                              .filter(tagId => tagId) // Filter out null/undefined
                              .map((tagId, index) => {
                                const tag = tags[categoryId]?.find(t => t.id === tagId);
                                
                                // Special handling for before/after categories
                                if (beforeAfterCategory) {
                                  // Check if this image has multiple before/after tags
                                  const beforeTag = tags[categoryId]?.find(t => t.name.toLowerCase() === 'before');
                                  const afterTag = tags[categoryId]?.find(t => t.name.toLowerCase() === 'after');
                                  const inProgressTag = tags[categoryId]?.find(t => t.name.toLowerCase() === 'in progress');
                                  
                                  // Show individual before/after tags
                                  let tagLabel = tag ? tag.name : tagId;
                                  let backgroundColor = '#8b5cf6';
                                  
                                  if (tagId === beforeTag?.id) {
                                    tagLabel = 'Before';
                                    backgroundColor = '#6B7280';
                                  } else if (tagId === afterTag?.id) {
                                    tagLabel = 'After';
                                    backgroundColor = '#10B981';
                                  } else if (tagId === inProgressTag?.id) {
                                    tagLabel = 'In Progress';
                                    backgroundColor = '#F59E0B';
                                  }
                                  
                                  return (
                                    <Chip
                                      key={`${categoryId}-${tagId}-${index}`}
                                      label={tagLabel}
                                      size="small"
                                      sx={{
                                        backgroundColor,
                                        color: 'white',
                                        fontSize: '0.8rem',
                                        height: 24,
                                        fontWeight: 600,
                                        '& .MuiChip-label': {
                                          px: 1.5
                                        }
                                      }}
                                    />
                                  );
                                } else {
                                  // Normal categories - show individual tags
                                  let backgroundColor = category?.color || '#b98f33';
                                  
                                  // If tag not found, try to show tagId or indicate missing tag
                                  const tagLabel = tag ? tag.name : (tagId || 'Unknown Tag');
                                  
                                  return (
                                    <Chip
                                      key={`${categoryId}-${tagId}-${index}`}
                                      label={tagLabel}
                                      size="small"
                                      sx={{
                                        backgroundColor,
                                        color: 'white',
                                        fontSize: '0.7rem',
                                        height: 20,
                                        fontWeight: 400,
                                        '& .MuiChip-label': {
                                          px: 1
                                        }
                                      }}
                                    />
                                  );
                                }
                              });
                          })}
                      </Stack>
                    </Box>
                  )}
                  
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: '#b98f33', 
                      mt: 'auto', 
                      display: 'block',
                      width: '100%',
                      maxWidth: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Uploaded: {image.uploadedAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          ))}
        </Box>
        </Paper>

      {/* Empty State */}
      {filteredImages.length === 0 && (
        <Paper sx={{ 
          p: 8, 
          textAlign: 'center', 
          mt: 4,
          backgroundColor: '#2a2a2a',
          border: '1px solid #333333'
        }}>
          <ImageIcon sx={{ fontSize: 64, color: '#b98f33', mb: 2 }} />
          <Typography variant="h6" sx={{ color: '#b98f33', mb: 2 }}>
            No images found
          </Typography>
          <Typography variant="body2" sx={{ color: '#ffffff', mb: 3 }}>
            {searchTerm 
              ? 'Try adjusting your search criteria'
              : 'Upload your first image to get started'
            }
          </Typography>
          <Button
            variant="contained"
            startIcon={<CloudUploadIcon />}
            onClick={() => fileInputRef.current?.click()}
            sx={{
              backgroundColor: '#b98f33',
              color: '#000000',
              '&:hover': { backgroundColor: '#d4af5a' }
            }}
          >
            Upload Images
          </Button>
        </Paper>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => {
          setAnchorEl(null);
          setContextMenuImage(null);
        }}
      >
        <MenuItem onClick={() => handlePreviewImage(contextMenuImage)}>
          <ListItemIcon>
            <VisibilityIcon />
          </ListItemIcon>
          <ListItemText>Preview</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleEditImage(contextMenuImage)}>
          <ListItemIcon>
            <EditIcon />
          </ListItemIcon>
          <ListItemText>Edit Details</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleEnhancedTagging(contextMenuImage)}>
          <ListItemIcon>
            <TransformIcon />
          </ListItemIcon>
          <ListItemText>Enhanced Tagging</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleDeleteImage(contextMenuImage?.id)} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon color="error" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Image Preview Dialog */}
      <Dialog 
        open={previewOpen} 
        onClose={() => setPreviewOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6">{selectedImage?.name}</Typography>
        </DialogTitle>
        <DialogContent>
          {selectedImage && (
            <Box sx={{ textAlign: 'center' }}>
              <img 
                src={selectedImage.cloudinaryUrl} 
                alt={selectedImage.alt}
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '70vh', 
                  objectFit: 'contain' 
                }}
              />
              <Box sx={{ mt: 2, textAlign: 'left' }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Dimensions:</strong> {selectedImage.width}x{selectedImage.height}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Size:</strong> {(selectedImage.fileSize / 1024 / 1024).toFixed(1)}MB
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Category:</strong> {selectedImage.category}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Alt Text:</strong> {selectedImage.alt}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Format:</strong> {selectedImage.format}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Close</Button>
          <Button 
            variant="contained"
            onClick={() => {
              setPreviewOpen(false);
              handleEditImage(selectedImage);
            }}
            sx={{
              backgroundColor: '#f27921',
              '&:hover': { backgroundColor: '#e66a0f' }
            }}
          >
            Edit Details
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Image Dialog */}
      <Dialog 
        open={editDialogOpen} 
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Image Details</DialogTitle>
        <DialogContent>
          {selectedImage && (
            <Box sx={{ pt: 1 }}>
              <TextField
                fullWidth
                label="Image Name (without extension)"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                margin="normal"
                helperText={`File extension: .${selectedImage.name.split('.').pop()}`}
              />
              <TextField
                fullWidth
                label="Alt Text"
                value={editingAlt}
                onChange={(e) => setEditingAlt(e.target.value)}
                margin="normal"
                multiline
                rows={2}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained"
            onClick={handleSaveImageEdit}
            sx={{
              backgroundColor: '#f27921',
              '&:hover': { backgroundColor: '#e66a0f' }
            }}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Enhanced Tagging Dialog */}
      <EnhancedImageTaggingDialog
        open={enhancedTaggingOpen}
        onClose={() => setEnhancedTaggingOpen(false)}
        selectedImages={selectedImagesForTagging}
        onTagged={handleTagged}
      />

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        multiple
        style={{ display: 'none' }}
      />

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="upload"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          backgroundColor: '#b98f33',
          color: '#000000',
          '&:hover': { backgroundColor: '#d4af5a' }
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <AddIcon />
      </Fab>

    </Box>
  );
};

export default ImageGalleryPage;


