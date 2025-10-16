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
  Switch,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem as SelectMenuItem
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Label as LabelIcon,
  MoreVert as MoreVertIcon,
  Palette as PaletteIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  DragIndicator as DragIndicatorIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material';
import {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  getNextSortOrder,
  validateCategory
} from '../../../services/categoryService';
import { createBeforeAfterTags } from '../../../services/tagService';
import { useAuth } from '../../../components/Auth/AuthContext';
import { buttonStyles } from '../../../styles/buttonStyles';

const CategoryManagementPage = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, category: null });
  const [anchorEl, setAnchorEl] = useState(null);
  const [contextMenuCategory, setContextMenuCategory] = useState(null);

  const { user } = useAuth();

  // Form states
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [categoryColor, setCategoryColor] = useState('#3B82F6');
  const [categoryRequired, setCategoryRequired] = useState(false);
  const [categoryType, setCategoryType] = useState('normal');
  const [formErrors, setFormErrors] = useState({});

  // Predefined colors for category selection
  const categoryColors = [
    { name: 'Blue', value: '#3B82F6' },
    { name: 'Green', value: '#10B981' },
    { name: 'Orange', value: '#F59E0B' },
    { name: 'Red', value: '#EF4444' },
    { name: 'Purple', value: '#8B5CF6' },
    { name: 'Indigo', value: '#6366F1' },
    { name: 'Cyan', value: '#06B6D4' },
    { name: 'Pink', value: '#EC4899' },
    { name: 'Yellow', value: '#EAB308' },
    { name: 'Gray', value: '#6B7280' },
    { name: 'Teal', value: '#14B8A6' },
    { name: 'Violet', value: '#7C3AED' },
    { name: 'Rose', value: '#F43F5E' },
    { name: 'Emerald', value: '#22C55E' },
    { name: 'Fuchsia', value: '#A855F7' },
    { name: 'Orange-600', value: '#F97316' }
  ];

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedCategories = await getCategories({ isActive: true });
      setCategories(fetchedCategories);
    } catch (err) {
      console.error('Error loading categories:', err);
      setError(`Failed to load categories: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = () => {
    setEditingCategory(null);
    setCategoryName('');
    setCategoryDescription('');
    setCategoryColor('#3B82F6');
    setCategoryRequired(false);
    setCategoryType('normal');
    setFormErrors({});
    setShowCreateDialog(true);
  };

  const handleEditCategory = (category) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryDescription(category.description || '');
    setCategoryColor(category.color);
    setCategoryRequired(category.required || false);
    setCategoryType(category.categoryType || 'normal');
    setFormErrors({});
    setShowCreateDialog(true);
    setAnchorEl(null);
  };

  const handleDeleteCategory = (category) => {
    setDeleteDialog({ open: true, category });
    setAnchorEl(null);
  };

  const confirmDelete = async () => {
    try {
      setError(null);
      if (deleteDialog.category) {
        await deleteCategory(deleteDialog.category.id);
        setDeleteDialog({ open: false, category: null });
        await loadCategories();
      }
    } catch (err) {
      console.error('Error deleting category:', err);
      setError(`Failed to delete category: ${err.message}`);
    }
  };

  const handleSaveCategory = async () => {
    // Validation
    const categoryData = {
      name: categoryName.trim(),
      description: categoryDescription.trim(),
      color: categoryColor,
      required: categoryRequired,
      categoryType: categoryType
    };

    const validationErrors = validateCategory(categoryData);
    if (validationErrors.length > 0) {
      setFormErrors({ general: validationErrors.join(', ') });
      return;
    }

    // Check for duplicate names
    const isDuplicate = categories.some(cat => 
      cat.name.toLowerCase() === categoryName.toLowerCase() && 
      cat.id !== editingCategory?.id
    );
    
    if (isDuplicate) {
      setFormErrors({ name: 'Category name already exists' });
      return;
    }

    try {
      setError(null);
      
      if (editingCategory) {
        await updateCategory(editingCategory.id, categoryData);
      } else {
        const sortOrder = await getNextSortOrder();
        const newCategory = await createCategory({ 
          ...categoryData, 
          sortOrder,
          createdBy: user?.email || 'unknown' 
        });

        // Auto-create Before/After tags for Before/After categories
        if (categoryType === 'before-after') {
          await createBeforeAfterTags(newCategory.id, user?.email || 'unknown');
        }
      }

      setShowCreateDialog(false);
      setEditingCategory(null);
      await loadCategories();
    } catch (err) {
      console.error('Error saving category:', err);
      setError(`Failed to save category: ${err.message}`);
    }
  };

  const handleContextMenu = (event, category) => {
    event.preventDefault();
    setContextMenuCategory(category);
    setAnchorEl(event.currentTarget);
  };

  const handleColorSelect = (color) => {
    setCategoryColor(color);
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
          Loading categories...
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
              Category Management
            </Typography>
            <Typography variant="body1" sx={{ color: '#ffffff' }}>
              Create and manage tag categories for organizing your images
            </Typography>
          </Box>
          <Button
            startIcon={<AddIcon />}
            onClick={handleCreateCategory}
            sx={buttonStyles.primaryButton}
          >
            Create Category
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

      {/* Categories Table */}
      <Paper sx={{ overflow: 'hidden', backgroundColor: '#2a2a2a', border: '1px solid #333333' }}>
        <Box sx={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#2a2a2a' }}>
                <th style={{ padding: '16px', textAlign: 'left', borderBottom: '1px solid #333333', color: '#b98f33', fontWeight: 600 }}>Name</th>
                <th style={{ padding: '16px', textAlign: 'left', borderBottom: '1px solid #333333', color: '#b98f33', fontWeight: 600 }}>Description</th>
                <th style={{ padding: '16px', textAlign: 'left', borderBottom: '1px solid #333333', color: '#b98f33', fontWeight: 600 }}>Type</th>
                <th style={{ padding: '16px', textAlign: 'left', borderBottom: '1px solid #333333', color: '#b98f33', fontWeight: 600 }}>Color</th>
                <th style={{ padding: '16px', textAlign: 'left', borderBottom: '1px solid #333333', color: '#b98f33', fontWeight: 600 }}>Required</th>
                <th style={{ padding: '16px', textAlign: 'left', borderBottom: '1px solid #333333', color: '#b98f33', fontWeight: 600 }}>Sort Order</th>
                <th style={{ padding: '16px', textAlign: 'center', borderBottom: '1px solid #333333', color: '#b98f33', fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr 
                  key={category.id} 
                  style={{ 
                    borderBottom: '1px solid #333333',
                    backgroundColor: '#2a2a2a',
                    '&:hover': { backgroundColor: '#3a3a3a' }
                  }}
                  onContextMenu={(e) => handleContextMenu(e, category)}
                >
                  <td style={{ padding: '16px', color: '#ffffff' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: category.color,
                          mr: 2
                        }}
                      />
                      <Typography variant="body1" sx={{ fontWeight: 500, color: '#ffffff' }}>
                        {category.name}
                      </Typography>
                    </Box>
                  </td>
                  <td style={{ padding: '16px', color: '#ffffff' }}>
                    <Typography variant="body2" sx={{ color: '#b98f33' }}>
                      {category.description || 'No description'}
                    </Typography>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <Chip
                      label={category.categoryType === 'before-after' ? 'Before & After' : 'Normal'}
                      size="small"
                      sx={{
                        backgroundColor: category.categoryType === 'before-after' ? '#FF6B35' : '#2a2a2a',
                        color: category.categoryType === 'before-after' ? '#ffffff' : '#b98f33',
                        border: category.categoryType === 'before-after' ? 'none' : '1px solid #333333',
                        fontWeight: 'bold'
                      }}
                    />
                  </td>
                  <td style={{ padding: '16px' }}>
                    <Chip
                      label={category.color}
                      size="small"
                      sx={{
                        backgroundColor: category.color,
                        color: 'white',
                        fontWeight: 'bold',
                        '& .MuiChip-label': {
                          textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
                        }
                      }}
                    />
                  </td>
                  <td style={{ padding: '16px' }}>
                    <Chip
                      label={category.required ? 'Required' : 'Optional'}
                      size="small"
                      sx={{
                        backgroundColor: category.required ? '#f44336' : '#2a2a2a',
                        color: category.required ? '#ffffff' : '#b98f33',
                        border: category.required ? 'none' : '1px solid #333333'
                      }}
                    />
                  </td>
                  <td style={{ padding: '16px', color: '#ffffff' }}>
                    <Typography variant="body2" sx={{ color: '#ffffff' }}>
                      {category.sortOrder || 1}
                    </Typography>
                  </td>
                  <td style={{ padding: '16px', textAlign: 'center' }}>
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                      <IconButton
                        size="small"
                        onClick={() => handleEditCategory(category)}
                        sx={{ color: '#b98f33' }}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleContextMenu(e, category);
                        }}
                        sx={{ color: '#b98f33' }}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </Box>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      </Paper>

      {/* Empty State */}
      {categories.length === 0 && (
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
            <LabelIcon sx={{ fontSize: 40 }} />
          </Avatar>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: '#b98f33' }}>
            No Categories Yet
          </Typography>
          <Typography variant="body1" sx={{ color: '#ffffff', mb: 4, maxWidth: 400, mx: 'auto' }}>
            Create your first category to start organizing your images with structured tags.
          </Typography>
          <Button
            startIcon={<AddIcon />}
            onClick={handleCreateCategory}
            size="large"
            sx={buttonStyles.primaryButton}
          >
            Create Your First Category
          </Button>
        </Paper>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => {
          handleEditCategory(contextMenuCategory);
          setAnchorEl(null);
        }}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit Category</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleDeleteCategory(contextMenuCategory)} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon color="error" />
          </ListItemIcon>
          <ListItemText>Delete Category</ListItemText>
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
          {editingCategory ? 'Edit Category' : 'Create New Category'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Category Name"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              margin="normal"
              error={!!formErrors.name}
              helperText={formErrors.name}
              variant="outlined"
            />
            <TextField
              fullWidth
              label="Description"
              value={categoryDescription}
              onChange={(e) => setCategoryDescription(e.target.value)}
              margin="normal"
              multiline
              rows={2}
              variant="outlined"
            />
            
            <FormControl fullWidth margin="normal">
              <InputLabel sx={{ color: '#b98f33' }}>Category Type</InputLabel>
              <Select
                value={categoryType}
                onChange={(e) => setCategoryType(e.target.value)}
                label="Category Type"
                sx={{ color: '#ffffff' }}
              >
                <SelectMenuItem value="normal">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        backgroundColor: '#b98f33'
                      }}
                    />
                    Normal Category
                  </Box>
                </SelectMenuItem>
                <SelectMenuItem value="before-after">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        backgroundColor: '#FF6B35'
                      }}
                    />
                    Before & After Category
                  </Box>
                </SelectMenuItem>
              </Select>
            </FormControl>
            
            {categoryType === 'before-after' && (
              <Alert severity="info" sx={{ mt: 2, backgroundColor: '#FF6B3515', border: '1px solid #FF6B35' }}>
                <Typography variant="body2" sx={{ color: '#FF6B35' }}>
                  <strong>Before & After Category:</strong> This will automatically create "Before", "After", and "In Progress" tags for tracking furniture transformations.
                </Typography>
              </Alert>
            )}
            
            <FormControlLabel
              control={
                <Switch
                  checked={categoryRequired}
                  onChange={(e) => setCategoryRequired(e.target.checked)}
                  color="primary"
                />
              }
              label="Required Category"
              sx={{ mt: 2, mb: 2 }}
            />
            
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                Category Color
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Chip
                  label={categoryColor}
                  sx={{
                    backgroundColor: categoryColor,
                    color: 'white',
                    fontWeight: 'bold',
                    '& .MuiChip-label': {
                      textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
                    }
                  }}
                />
              </Box>
              
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {categoryColors.map((color, index) => (
                  <Box
                    key={index}
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      backgroundColor: color.value,
                      cursor: 'pointer',
                      border: categoryColor === color.value ? '3px solid #3f51b5' : '2px solid #ccc',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        transform: 'scale(1.1)',
                        borderColor: '#3f51b5'
                      }
                    }}
                    onClick={() => handleColorSelect(color.value)}
                  />
                ))}
              </Box>
            </Box>
            
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
            onClick={handleSaveCategory}
            sx={buttonStyles.primaryButton}
          >
            {editingCategory ? 'Update Category' : 'Create Category'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, category: null })}
        PaperProps={{
          sx: {
            backgroundColor: '#2a2a2a',
            border: '1px solid #333333'
          }
        }}
      >
        <DialogTitle sx={{ color: '#b98f33' }}>Delete Category</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#ffffff' }}>
            Are you sure you want to delete the category "{deleteDialog.category?.name}"? 
            This action cannot be undone and may affect existing tags and images.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, category: null })} sx={buttonStyles.cancelButton}>
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

export default CategoryManagementPage;
