import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem as SelectMenuItem,
  RadioGroup,
  FormControlLabel,
  Radio,
  Chip,
  Alert,
  Divider,
  Stack,
  Grid,
  IconButton,
  Tooltip,
  CircularProgress,
  Paper
} from '@mui/material';
import {
  Close as CloseIcon,
  Transform as TransformIcon,
  PhotoLibrary as PhotoLibraryIcon,
  Build as BuildIcon,
  CheckCircle as CheckCircleIcon,
  Add as AddIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import {
  getCategories,
  getBeforeAfterCategories
} from '../../services/categoryService';
import {
  getTagsByCategory,
  getBeforeAfterTags
} from '../../services/tagService';
import {
  getFurniturePiecesWithCounts,
  createFurniturePiece,
  addImageToFurniturePiece,
  generateFurnitureId
} from '../../services/furniturePieceService';
import {
  updateImageTags,
  getImagesByTags
} from '../../services/imageService';
import { buttonStyles } from '../../styles/buttonStyles';

const EnhancedImageTaggingDialog = ({ 
  open, 
  onClose, 
  selectedImages = [], 
  onTagged 
}) => {
  const [categories, setCategories] = useState([]);
  const [beforeAfterCategories, setBeforeAfterCategories] = useState([]);
  const [normalCategories, setNormalCategories] = useState([]);
  const [tags, setTags] = useState({});
  const [furniturePieces, setFurniturePieces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form states
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [beforeAfterStatus, setBeforeAfterStatus] = useState('before');
  const [furnitureDescription, setFurnitureDescription] = useState('');
  const [furnitureId, setFurnitureId] = useState('');
  const [selectedFurniturePiece, setSelectedFurniturePiece] = useState('');
  const [allSelectedTags, setAllSelectedTags] = useState({}); // Object with categoryId as key and array of tagIds as value
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (open) {
      // Reset all form state when dialog opens
      setAllSelectedTags({});
      setSelectedCategory('');
      setSelectedTag('');
      setBeforeAfterStatus('before');
      setFurnitureDescription('');
      setFurnitureId('');
      setSelectedFurniturePiece('');
      setSearchTerm('');
      setError(null);
      
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [categoriesData, furniturePiecesData] = await Promise.all([
        getCategories({ isActive: true }),
        getFurniturePiecesWithCounts()
      ]);
      
      setCategories(categoriesData);
      
      // Filter before-after categories using more robust logic
      const beforeAfterCats = categoriesData.filter(cat => {
        const isBeforeAfter = cat.categoryType === 'before-after' || 
                             cat.name?.toLowerCase().includes('before') ||
                             cat.name?.toLowerCase().includes('after');
        return isBeforeAfter;
      });
      
      setBeforeAfterCategories(beforeAfterCats);
      setNormalCategories(categoriesData.filter(cat => {
        const isBeforeAfter = cat.categoryType === 'before-after' || 
                             cat.name?.toLowerCase().includes('before') ||
                             cat.name?.toLowerCase().includes('after');
        return !isBeforeAfter;
      }));
      setFurniturePieces(furniturePiecesData);
      
      // Load tags for all categories
      const tagsData = {};
      for (const category of categoriesData) {
        const categoryTags = await getTagsByCategory(category.id);
        tagsData[category.id] = categoryTags;
      }
      setTags(tagsData);
      
    } catch (err) {
      console.error('Error loading data:', err);
      setError(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (categoryId) => {
    setSelectedCategory(categoryId);
    setSelectedTag('');
    
    // Reset Before/After specific fields
    const category = categories.find(cat => cat.id === categoryId);
    const isBeforeAfter = category && (
      category.categoryType === 'before-after' || 
      category.name?.toLowerCase().includes('before') ||
      category.name?.toLowerCase().includes('after')
    );
    
    if (categoryId && isBeforeAfter) {
      setBeforeAfterStatus('before');
      setFurnitureDescription('');
      setFurnitureId('');
      setSelectedFurniturePiece('');
    }
  };

  const handleTagChange = (tagId) => {
    setSelectedTag(tagId);
  };

  const handleTagToggle = (categoryId, tagId) => {
    setAllSelectedTags(prev => {
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
  };

  const handleFurniturePieceChange = (pieceId) => {
    setSelectedFurniturePiece(pieceId);
    if (pieceId) {
      const piece = furniturePieces.find(p => p.id === pieceId);
      if (piece) {
        setFurnitureDescription(piece.description);
        setFurnitureId(piece.furnitureId);
      }
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);

      // Convert array-based selections to single tag per category for image tags
      const imageTags = {};
      Object.entries(allSelectedTags).forEach(([categoryId, tagIds]) => {
        if (tagIds && tagIds.length > 0) {
          // For now, just take the first selected tag from each category
          // This maintains compatibility with the existing image tagging system
          imageTags[categoryId] = tagIds[0];
        }
      });

      // Update image tags
      for (const image of selectedImages) {
        await updateImageTags(image.id, imageTags);
      }

      onTagged && onTagged();
      onClose();
      
      // Reset state after closing
      setTimeout(() => {
        setAllSelectedTags({});
        setSelectedCategory('');
        setSelectedTag('');
        setBeforeAfterStatus('before');
        setFurnitureDescription('');
        setFurnitureId('');
        setSelectedFurniturePiece('');
        setSearchTerm('');
        setError(null);
      }, 100);
      
    } catch (err) {
      console.error('Error saving tags:', err);
      setError(`Failed to save tags: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'before': return <PhotoLibraryIcon />;
      case 'after': return <TransformIcon />;
      case 'in-progress': return <BuildIcon />;
      default: return <PhotoLibraryIcon />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'before': return '#6B7280';
      case 'after': return '#10B981';
      case 'in-progress': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogContent sx={{ p: 4, textAlign: 'center' }}>
          <CircularProgress size={40} sx={{ color: '#b98f33', mb: 2 }} />
          <Typography variant="body1" sx={{ color: '#ffffff' }}>
            Loading tagging interface...
          </Typography>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#2a2a2a',
          border: '1px solid #333333'
        }
      }}
    >
      <DialogTitle sx={{ color: '#b98f33', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TransformIcon />
          Enhanced Image Tagging
        </Box>
        <IconButton onClick={() => {
          onClose();
          // Reset state when closing via X button
          setTimeout(() => {
            setAllSelectedTags({});
            setSelectedCategory('');
            setSelectedTag('');
            setBeforeAfterStatus('before');
            setFurnitureDescription('');
            setFurnitureId('');
            setSelectedFurniturePiece('');
            setSearchTerm('');
            setError(null);
          }, 100);
        }} sx={{ color: '#b98f33' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ pt: 1 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Typography variant="h6" sx={{ color: '#ffffff', mb: 2 }}>
            Tagging {selectedImages.length} image{selectedImages.length !== 1 ? 's' : ''}
          </Typography>

          {/* Search */}
          <TextField
            fullWidth
            label="Search categories or tags..."
            placeholder="Search categories or tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: '#b98f33' }} />
            }}
            sx={{ mb: 3 }}
          />

          {/* All Categories and Tags */}
          <Grid container spacing={2}>
            {categories
              .filter(category => 
                !searchTerm || 
                category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (tags[category.id] && tags[category.id].some(tag => 
                  tag.name.toLowerCase().includes(searchTerm.toLowerCase())
                ))
              )
              .map((category) => (
                <Grid item xs={12} sm={6} md={4} key={category.id}>
                  <Paper sx={{ 
                    p: 2, 
                    border: '1px solid #333333', 
                    borderRadius: 1,
                    backgroundColor: '#1a1a1a'
                  }}>
                    {/* Category Header */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: category.color
                        }}
                      />
                      <Typography variant="body1" sx={{ color: '#ffffff', fontWeight: 600, flex: 1 }}>
                        {category.name}
                      </Typography>
                      {(() => {
                        const isBeforeAfter = category.categoryType === 'before-after' || 
                                             category.name?.toLowerCase().includes('before') ||
                                             category.name?.toLowerCase().includes('after');
                        return isBeforeAfter;
                      })() && (
                        <Chip
                          label="Before/After"
                          size="small"
                          sx={{
                            backgroundColor: '#FF6B35',
                            color: 'white',
                            fontSize: '0.7rem',
                            height: 20
                          }}
                        />
                      )}
                    </Box>

                    {/* Tags */}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(() => {
                        const isBeforeAfter = category.categoryType === 'before-after' || 
                                             category.name?.toLowerCase().includes('before') ||
                                             category.name?.toLowerCase().includes('after');
                        
                        if (isBeforeAfter) {
                          // For before/after categories, show a single combined tag
                          // Debug: Log available tags
                          console.log('Before/After Category:', category.name, 'Tags:', tags[category.id]);
                          
                          const beforeTag = tags[category.id]?.find(tag => 
                            tag.name.toLowerCase() === 'before' || 
                            tag.name.toLowerCase().includes('before')
                          );
                          const afterTag = tags[category.id]?.find(tag => 
                            tag.name.toLowerCase() === 'after' || 
                            tag.name.toLowerCase().includes('after')
                          );
                          const inProgressTag = tags[category.id]?.find(tag => 
                            tag.name.toLowerCase() === 'in progress' || 
                            tag.name.toLowerCase() === 'inprogress' ||
                            tag.name.toLowerCase().includes('progress')
                          );
                          
                          return (
                            <>
                              {/* Single Combined Tag for Before, In Progress & After */}
                              {(beforeTag || afterTag || inProgressTag) ? (
                                <Chip
                                  key="before-after-inprogress-combined"
                                  label="Before & In Progress & After"
                                  size="small"
                                  onClick={() => {
                                    // Select all three tags when clicking the combined tag
                                    const beforeId = beforeTag?.id;
                                    const afterId = afterTag?.id;
                                    const inProgressId = inProgressTag?.id;
                                    
                                    const currentTags = allSelectedTags[category.id] || [];
                                    const hasAll = beforeId && afterId && inProgressId &&
                                      currentTags.includes(beforeId) && 
                                      currentTags.includes(afterId) && 
                                      currentTags.includes(inProgressId);
                                    
                                    if (hasAll) {
                                      // Remove all three
                                      if (beforeId) handleTagToggle(category.id, beforeId);
                                      if (afterId) handleTagToggle(category.id, afterId);
                                      if (inProgressId) handleTagToggle(category.id, inProgressId);
                                    } else {
                                      // Add all three
                                      if (beforeId && !currentTags.includes(beforeId)) {
                                        handleTagToggle(category.id, beforeId);
                                      }
                                      if (afterId && !currentTags.includes(afterId)) {
                                        handleTagToggle(category.id, afterId);
                                      }
                                      if (inProgressId && !currentTags.includes(inProgressId)) {
                                        handleTagToggle(category.id, inProgressId);
                                      }
                                    }
                                  }}
                                  sx={{
                                    backgroundColor: (() => {
                                      const currentTags = allSelectedTags[category.id] || [];
                                      const hasAll = beforeTag && afterTag && inProgressTag &&
                                        currentTags.includes(beforeTag.id) && 
                                        currentTags.includes(afterTag.id) && 
                                        currentTags.includes(inProgressTag.id);
                                      return hasAll ? '#8b5cf6' : '#2a2a2a'; // Purple for combined selection
                                    })(),
                                    color: (() => {
                                      const currentTags = allSelectedTags[category.id] || [];
                                      const hasAll = beforeTag && afterTag && inProgressTag &&
                                        currentTags.includes(beforeTag.id) && 
                                        currentTags.includes(afterTag.id) && 
                                        currentTags.includes(inProgressTag.id);
                                      return hasAll ? 'white' : '#b98f33';
                                    })(),
                                    border: (() => {
                                      const currentTags = allSelectedTags[category.id] || [];
                                      const hasAll = beforeTag && afterTag && inProgressTag &&
                                        currentTags.includes(beforeTag.id) && 
                                        currentTags.includes(afterTag.id) && 
                                        currentTags.includes(inProgressTag.id);
                                      return hasAll ? 'none' : '1px solid #8b5cf6';
                                    })(),
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    height: 24,
                                    fontWeight: 600,
                                    '&:hover': {
                                      backgroundColor: (() => {
                                        const currentTags = allSelectedTags[category.id] || [];
                                        const hasAll = beforeTag && afterTag && inProgressTag &&
                                          currentTags.includes(beforeTag.id) && 
                                          currentTags.includes(afterTag.id) && 
                                          currentTags.includes(inProgressTag.id);
                                        return hasAll ? '#8b5cf6' : '#8b5cf615';
                                      })()
                                    }
                                  }}
                                />
                              ) : (
                                // Fallback: Show individual tags if combined tag logic fails
                                <>
                                  <Typography variant="caption" sx={{ color: '#666', mb: 1, display: 'block' }}>
                                    Available tags:
                                  </Typography>
                                  {tags[category.id]?.map((tag) => {
                                    const isSelected = allSelectedTags[category.id]?.includes(tag.id) || false;
                                    return (
                                      <Chip
                                        key={tag.id}
                                        label={tag.name}
                                        size="small"
                                        onClick={() => handleTagToggle(category.id, tag.id)}
                                        sx={{
                                          backgroundColor: isSelected ? '#8b5cf6' : 'transparent',
                                          color: isSelected ? 'white' : '#8b5cf6',
                                          border: `1px solid #8b5cf6`,
                                          margin: '2px',
                                          '&:hover': {
                                            backgroundColor: isSelected ? '#8b5cf6' : '#8b5cf620'
                                          }
                                        }}
                                      />
                                    );
                                  })}
                                </>
                              )}
                            </>
                          );
                        } else {
                          // For normal categories, show all tags as usual
                          return tags[category.id]?.map((tag) => {
                            const isSelected = allSelectedTags[category.id]?.includes(tag.id) || false;
                            
                            return (
                              <Chip
                                key={tag.id}
                                label={tag.name}
                                size="small"
                                onClick={() => handleTagToggle(category.id, tag.id)}
                                sx={{
                                  backgroundColor: isSelected ? category.color : '#2a2a2a',
                                  color: isSelected ? 'white' : '#b98f33',
                                  border: isSelected ? 'none' : `1px solid ${category.color}`,
                                  cursor: 'pointer',
                                  fontSize: '0.7rem',
                                  height: 20,
                                  fontWeight: 400,
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

                    {/* Selected Tags Count for this Category */}
                    {allSelectedTags[category.id] && allSelectedTags[category.id].length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" sx={{ color: '#b98f33' }}>
                          {allSelectedTags[category.id].length} tag{allSelectedTags[category.id].length !== 1 ? 's' : ''} selected
                        </Typography>
                      </Box>
                    )}
                  </Paper>
                </Grid>
              ))}
          </Grid>

          {/* Selected Tags Summary */}
          {Object.keys(allSelectedTags).length > 0 && (
            <Box sx={{ mt: 3, p: 2, backgroundColor: '#1a1a1a', borderRadius: 1, border: '1px solid #333333' }}>
              <Typography variant="body2" sx={{ color: '#b98f33', mb: 1, fontWeight: 600 }}>
                Selected Tags:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {Object.entries(allSelectedTags).map(([categoryId, tagIds]) => {
                  if (!tagIds || tagIds.length === 0) return null;
                  const category = categories.find(cat => cat.id === categoryId);
                  if (!category) return null;
                  
                  // Special handling for before/after categories
                  const isBeforeAfter = category.categoryType === 'before-after' || 
                                       category.name?.toLowerCase().includes('before') ||
                                       category.name?.toLowerCase().includes('after');
                  
                  if (isBeforeAfter) {
                    const beforeTag = tags[categoryId]?.find(tag => tag.name.toLowerCase() === 'before');
                    const afterTag = tags[categoryId]?.find(tag => tag.name.toLowerCase() === 'after');
                    const inProgressTag = tags[categoryId]?.find(tag => tag.name.toLowerCase() === 'in progress');
                    
                    const hasBefore = beforeTag && tagIds.includes(beforeTag.id);
                    const hasAfter = afterTag && tagIds.includes(afterTag.id);
                    const hasInProgress = inProgressTag && tagIds.includes(inProgressTag.id);
                    
                    // Show combined tag if all three are selected
                    if (hasBefore && hasAfter && hasInProgress) {
                      return (
                        <Chip
                          key={`${categoryId}-before-after-inprogress`}
                          label={`${category.name}: Before & In Progress & After`}
                          size="small"
                          onDelete={() => {
                            if (beforeTag) handleTagToggle(categoryId, beforeTag.id);
                            if (afterTag) handleTagToggle(categoryId, afterTag.id);
                            if (inProgressTag) handleTagToggle(categoryId, inProgressTag.id);
                          }}
                          sx={{
                            backgroundColor: '#8b5cf6',
                            color: 'white',
                            fontSize: '0.7rem'
                          }}
                        />
                      );
                    }
                    
                    // If not all three are selected, show individual chips
                    return (
                      <>
                        {hasBefore && beforeTag && (
                          <Chip
                            key={`${categoryId}-${beforeTag.id}`}
                            label={`${category.name}: ${beforeTag.name}`}
                            size="small"
                            onDelete={() => handleTagToggle(categoryId, beforeTag.id)}
                            sx={{
                              backgroundColor: '#dc2626',
                              color: 'white',
                              fontSize: '0.7rem'
                            }}
                          />
                        )}
                        
                        {hasAfter && afterTag && (
                          <Chip
                            key={`${categoryId}-${afterTag.id}`}
                            label={`${category.name}: ${afterTag.name}`}
                            size="small"
                            onDelete={() => handleTagToggle(categoryId, afterTag.id)}
                            sx={{
                              backgroundColor: '#16a34a',
                              color: 'white',
                              fontSize: '0.7rem'
                            }}
                          />
                        )}
                        
                        {hasInProgress && inProgressTag && (
                          <Chip
                            key={`${categoryId}-${inProgressTag.id}`}
                            label={`${category.name}: ${inProgressTag.name}`}
                            size="small"
                            onDelete={() => handleTagToggle(categoryId, inProgressTag.id)}
                            sx={{
                              backgroundColor: '#f59e0b',
                              color: 'white',
                              fontSize: '0.7rem'
                            }}
                          />
                        )}
                      </>
                    );
                  } else {
                    // Normal categories - show all selected tags
                    return tagIds.map((tagId) => {
                      const tag = tags[categoryId]?.find(t => t.id === tagId);
                      if (!tag) return null;
                      
                      return (
                        <Chip
                          key={`${categoryId}-${tagId}`}
                          label={`${category.name}: ${tag.name}`}
                          size="small"
                          onDelete={() => handleTagToggle(categoryId, tagId)}
                          sx={{
                            backgroundColor: category.color,
                            color: 'white',
                            fontSize: '0.7rem'
                          }}
                        />
                      );
                    });
                  }
                })}
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3 }}>
        <Button onClick={() => {
          onClose();
          // Reset state when cancelling
          setTimeout(() => {
            setAllSelectedTags({});
            setSelectedCategory('');
            setSelectedTag('');
            setBeforeAfterStatus('before');
            setFurnitureDescription('');
            setFurnitureId('');
            setSelectedFurniturePiece('');
            setSearchTerm('');
            setError(null);
          }, 100);
        }} sx={buttonStyles.cancelButton}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={loading || Object.keys(allSelectedTags).length === 0}
          sx={buttonStyles.primaryButton}
        >
          {loading ? 'Saving...' : 'Save Tags'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EnhancedImageTaggingDialog;
