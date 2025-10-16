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
  Label as LabelIcon,
  MoreVert as MoreVertIcon,
  Search as SearchIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  DragIndicator as DragIndicatorIcon,
  FilterList as FilterListIcon,
  Category as CategoryIcon
} from '@mui/icons-material';
import {
  createTag,
  getTags,
  getTagsByCategory,
  getTagById,
  updateTag,
  deleteTag,
  getNextTagSortOrder,
  searchTags,
  validateTag
} from '../../../services/tagService';
import {
  getCategories
} from '../../../services/categoryService';
import { useAuth } from '../../../components/Auth/AuthContext';
import { buttonStyles } from '../../../styles/buttonStyles';

const TagManagementPage = () => {
  const [tags, setTags] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, tag: null });
  const [anchorEl, setAnchorEl] = useState(null);
  const [contextMenuTag, setContextMenuTag] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const { user } = useAuth();

  // Form states
  const [tagName, setTagName] = useState('');
  const [tagDescription, setTagDescription] = useState('');
  const [tagCategoryId, setTagCategoryId] = useState('');
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedCategory === 'all') {
      loadTags();
    } else {
      loadTagsByCategory(selectedCategory);
    }
  }, [selectedCategory]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [categoriesData, tagsData] = await Promise.all([
        getCategories({ isActive: true }),
        getTags({ isActive: true })
      ]);
      setCategories(categoriesData);
      setTags(tagsData);
    } catch (err) {
      console.error('Error loading data:', err);
      setError(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadTags = async () => {
    try {
      const fetchedTags = await getTags({ isActive: true });
      setTags(fetchedTags);
    } catch (err) {
      console.error('Error loading tags:', err);
      setError(`Failed to load tags: ${err.message}`);
    }
  };

  const loadTagsByCategory = async (categoryId) => {
    try {
      const fetchedTags = await getTagsByCategory(categoryId);
      setTags(fetchedTags);
    } catch (err) {
      console.error('Error loading tags by category:', err);
      setError(`Failed to load tags: ${err.message}`);
    }
  };

  const handleCreateTag = () => {
    setEditingTag(null);
    setTagName('');
    setTagDescription('');
    setTagCategoryId(categories.length > 0 ? categories[0].id : '');
    setFormErrors({});
    setShowCreateDialog(true);
  };

  const handleEditTag = (tag) => {
    setEditingTag(tag);
    setTagName(tag.name);
    setTagDescription(tag.description || '');
    setTagCategoryId(tag.categoryId);
    setFormErrors({});
    setShowCreateDialog(true);
    setAnchorEl(null);
  };

  const handleDeleteTag = (tag) => {
    setDeleteDialog({ open: true, tag });
    setAnchorEl(null);
  };

  const confirmDelete = async () => {
    try {
      setError(null);
      if (deleteDialog.tag) {
        await deleteTag(deleteDialog.tag.id);
        setDeleteDialog({ open: false, tag: null });
        await loadTags();
      }
    } catch (err) {
      console.error('Error deleting tag:', err);
      setError(`Failed to delete tag: ${err.message}`);
    }
  };

  const handleSaveTag = async () => {
    // Validation
    const tagData = {
      name: tagName.trim(),
      description: tagDescription.trim(),
      categoryId: tagCategoryId
    };

    const validationErrors = validateTag(tagData);
    if (validationErrors.length > 0) {
      setFormErrors({ general: validationErrors.join(', ') });
      return;
    }

    // Check for duplicate names in the same category
    const isDuplicate = tags.some(tag => 
      tag.name.toLowerCase() === tagName.toLowerCase() && 
      tag.categoryId === tagCategoryId &&
      tag.id !== editingTag?.id
    );
    
    if (isDuplicate) {
      setFormErrors({ name: 'Tag name already exists in this category' });
      return;
    }

    try {
      setError(null);
      
      if (editingTag) {
        await updateTag(editingTag.id, tagData);
      } else {
        const sortOrder = await getNextTagSortOrder(tagCategoryId);
        await createTag({ 
          ...tagData, 
          sortOrder,
          createdBy: user?.email || 'unknown' 
        });
      }

      setShowCreateDialog(false);
      setEditingTag(null);
      await loadTags();
    } catch (err) {
      console.error('Error saving tag:', err);
      setError(`Failed to save tag: ${err.message}`);
    }
  };

  const handleContextMenu = (event, tag) => {
    event.preventDefault();
    setContextMenuTag(tag);
    setAnchorEl(event.currentTarget);
  };

  const handleSearch = async () => {
    try {
      if (searchTerm.trim()) {
        const searchResults = await searchTags(searchTerm, selectedCategory === 'all' ? null : selectedCategory);
        setTags(searchResults);
      } else {
        if (selectedCategory === 'all') {
          await loadTags();
        } else {
          await loadTagsByCategory(selectedCategory);
        }
      }
    } catch (err) {
      console.error('Error searching tags:', err);
      setError(`Failed to search tags: ${err.message}`);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.name : 'Unknown Category';
  };

  const getCategoryColor = (categoryId) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.color : '#6B7280';
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
          Loading tags...
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
              Tag Management
            </Typography>
            <Typography variant="body1" sx={{ color: '#ffffff' }}>
              Create and manage tags within categories for organizing your images
            </Typography>
          </Box>
          <Button
            startIcon={<AddIcon />}
            onClick={handleCreateTag}
            sx={buttonStyles.primaryButton}
          >
            Create Tag
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
              label="Search Tags"
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
              <InputLabel sx={{ color: '#b98f33' }}>Filter by Category</InputLabel>
              <Select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                label="Filter by Category"
                sx={{ color: '#ffffff' }}
              >
                <SelectMenuItem value="all">All Categories</SelectMenuItem>
                {categories.map((category) => (
                  <SelectMenuItem key={category.id} value={category.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: category.color
                        }}
                      />
                      {category.name}
                    </Box>
                  </SelectMenuItem>
                ))}
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

      {/* Tags Table */}
      <Paper sx={{ overflow: 'hidden', backgroundColor: '#2a2a2a', border: '1px solid #333333' }}>
        <Box sx={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#2a2a2a' }}>
                <th style={{ padding: '16px', textAlign: 'left', borderBottom: '1px solid #333333', color: '#b98f33', fontWeight: 600 }}>Name</th>
                <th style={{ padding: '16px', textAlign: 'left', borderBottom: '1px solid #333333', color: '#b98f33', fontWeight: 600 }}>Description</th>
                <th style={{ padding: '16px', textAlign: 'left', borderBottom: '1px solid #333333', color: '#b98f33', fontWeight: 600 }}>Category</th>
                <th style={{ padding: '16px', textAlign: 'left', borderBottom: '1px solid #333333', color: '#b98f33', fontWeight: 600 }}>Sort Order</th>
                <th style={{ padding: '16px', textAlign: 'center', borderBottom: '1px solid #333333', color: '#b98f33', fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tags.map((tag) => (
                <tr 
                  key={tag.id} 
                  style={{ 
                    borderBottom: '1px solid #333333',
                    backgroundColor: '#2a2a2a',
                    '&:hover': { backgroundColor: '#3a3a3a' }
                  }}
                  onContextMenu={(e) => handleContextMenu(e, tag)}
                >
                  <td style={{ padding: '16px', color: '#ffffff' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: getCategoryColor(tag.categoryId),
                          mr: 2
                        }}
                      />
                      <Typography variant="body1" sx={{ fontWeight: 500, color: '#ffffff' }}>
                        {tag.name}
                      </Typography>
                    </Box>
                  </td>
                  <td style={{ padding: '16px', color: '#ffffff' }}>
                    <Typography variant="body2" sx={{ color: '#b98f33' }}>
                      {tag.description || 'No description'}
                    </Typography>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <Chip
                      label={getCategoryName(tag.categoryId)}
                      size="small"
                      sx={{
                        backgroundColor: getCategoryColor(tag.categoryId),
                        color: 'white',
                        fontWeight: 'bold',
                        '& .MuiChip-label': {
                          textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
                        }
                      }}
                    />
                  </td>
                  <td style={{ padding: '16px', color: '#ffffff' }}>
                    <Typography variant="body2" sx={{ color: '#ffffff' }}>
                      {tag.sortOrder || 1}
                    </Typography>
                  </td>
                  <td style={{ padding: '16px', textAlign: 'center' }}>
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                      <IconButton
                        size="small"
                        onClick={() => handleEditTag(tag)}
                        sx={{ color: '#b98f33' }}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleContextMenu(e, tag);
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
      {tags.length === 0 && (
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
            {searchTerm ? 'No Tags Found' : 'No Tags Yet'}
          </Typography>
          <Typography variant="body1" sx={{ color: '#ffffff', mb: 4, maxWidth: 400, mx: 'auto' }}>
            {searchTerm 
              ? `No tags match your search "${searchTerm}". Try a different search term.`
              : 'Create your first tag to start organizing your images with structured tags.'
            }
          </Typography>
          {!searchTerm && (
            <Button
              startIcon={<AddIcon />}
              onClick={handleCreateTag}
              size="large"
              sx={buttonStyles.primaryButton}
            >
              Create Your First Tag
            </Button>
          )}
        </Paper>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => {
          handleEditTag(contextMenuTag);
          setAnchorEl(null);
        }}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit Tag</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleDeleteTag(contextMenuTag)} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon color="error" />
          </ListItemIcon>
          <ListItemText>Delete Tag</ListItemText>
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
          {editingTag ? 'Edit Tag' : 'Create New Tag'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Tag Name"
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              margin="normal"
              error={!!formErrors.name}
              helperText={formErrors.name}
              variant="outlined"
            />
            <TextField
              fullWidth
              label="Description"
              value={tagDescription}
              onChange={(e) => setTagDescription(e.target.value)}
              margin="normal"
              multiline
              rows={2}
              variant="outlined"
            />
            
            <FormControl fullWidth margin="normal">
              <InputLabel>Category</InputLabel>
              <Select
                value={tagCategoryId}
                onChange={(e) => setTagCategoryId(e.target.value)}
                label="Category"
              >
                {categories.map((category) => (
                  <SelectMenuItem key={category.id} value={category.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: category.color
                        }}
                      />
                      {category.name}
                    </Box>
                  </SelectMenuItem>
                ))}
              </Select>
            </FormControl>
            
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
            onClick={handleSaveTag}
            sx={buttonStyles.primaryButton}
          >
            {editingTag ? 'Update Tag' : 'Create Tag'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, tag: null })}
        PaperProps={{
          sx: {
            backgroundColor: '#2a2a2a',
            border: '1px solid #333333'
          }
        }}
      >
        <DialogTitle sx={{ color: '#b98f33' }}>Delete Tag</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#ffffff' }}>
            Are you sure you want to delete the tag "{deleteDialog.tag?.name}"? 
            This action cannot be undone and may affect existing images.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, tag: null })} sx={buttonStyles.cancelButton}>
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

export default TagManagementPage;
