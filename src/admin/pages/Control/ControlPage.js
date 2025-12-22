import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  CircularProgress,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Tooltip,
  Alert,
  Divider
} from '@mui/material';
import {
  Search as SearchIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useNotification } from '../../../shared/components/Common/NotificationSystem';
import { collection, getDocs, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../../firebase/config';

// All collections in the database
const COLLECTIONS = [
  { name: 'customers', label: 'Customers', icon: '👥' },
  { name: 'orders', label: 'Orders', icon: '📋' },
  { name: 'corporate-orders', label: 'Corporate Orders', icon: '🏢' },
  { name: 'treatments', label: 'Treatments', icon: '🔧' },
  { name: 'materialCompanies', label: 'Material Companies', icon: '🏭' },
  { name: 'platforms', label: 'Platforms', icon: '🌐' },
  { name: 'leads', label: 'Leads', icon: '🎯' },
  { name: 'invoiceStatuses', label: 'Invoice Statuses', icon: '📊' },
  { name: 'extraExpenses', label: 'Extra Expenses', icon: '💰' },
  { name: 'corporateCustomers', label: 'Corporate Customers', icon: '🏛️' },
  { name: 'allocationOrders', label: 'Allocation Orders', icon: '📈' },
  { name: 'website_images', label: 'Website Images', icon: '🖼️' },
  { name: 'categories', label: 'Categories', icon: '📁' },
  { name: 'tags', label: 'Tags', icon: '🏷️' },
  { name: 'furniturePieces', label: 'Furniture Pieces', icon: '🪑' },
];

const ControlPage = () => {
  const [selectedCollection, setSelectedCollection] = useState('customers');
  const [collectionsData, setCollectionsData] = useState({});
  const [loading, setLoading] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [editingCell, setEditingCell] = useState(null); // { collectionName, docId, field, value }
  const [deleteDialog, setDeleteDialog] = useState({ open: false, collectionName: '', docId: '', docData: null });
  const [refreshing, setRefreshing] = useState(false);
  const { showSuccess, showError, showConfirm } = useNotification();

  // Get current collection name
  const currentCollectionName = selectedCollection;

  // Set up real-time listeners for all collections
  useEffect(() => {
    const unsubscribeFunctions = [];

    COLLECTIONS.forEach(({ name }) => {
      try {
        // Try with createdAt ordering first
        const collectionRef = collection(db, name);
        let q;
        try {
          q = query(collectionRef, orderBy('createdAt', 'desc'));
        } catch (e) {
          // If createdAt doesn't exist, use collection without ordering
          q = collectionRef;
        }

        const unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const data = [];
            snapshot.forEach((doc) => {
              data.push({
                id: doc.id,
                ...doc.data()
              });
            });
            setCollectionsData((prev) => ({
              ...prev,
              [name]: data
            }));
            setLoading((prev) => ({
              ...prev,
              [name]: false
            }));
          },
          (error) => {
            console.error(`Error listening to ${name}:`, error);
            setLoading((prev) => ({
              ...prev,
              [name]: false
            }));
            // If collection doesn't exist or has no data, set empty array
            setCollectionsData((prev) => ({
              ...prev,
              [name]: []
            }));
          }
        );

        unsubscribeFunctions.push(unsubscribe);
        setLoading((prev) => ({ ...prev, [name]: true }));
      } catch (error) {
        console.error(`Error setting up listener for ${name}:`, error);
        setCollectionsData((prev) => ({
          ...prev,
          [name]: []
        }));
        setLoading((prev) => ({
          ...prev,
          [name]: false
        }));
      }
    });

    return () => {
      unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!currentCollectionName || !collectionsData[currentCollectionName]) {
      return [];
    }

    const data = collectionsData[currentCollectionName];
    if (!searchTerm.trim()) {
      return data;
    }

    const searchLower = searchTerm.toLowerCase();
    return data.filter((doc) => {
      // Search across all fields recursively
      const searchInObject = (obj) => {
        for (const key in obj) {
          if (obj[key] === null || obj[key] === undefined) continue;
          
          if (typeof obj[key] === 'object' && !Array.isArray(obj[key]) && !(obj[key] instanceof Date)) {
            if (searchInObject(obj[key])) return true;
          } else {
            const value = String(obj[key]).toLowerCase();
            if (value.includes(searchLower)) return true;
          }
        }
        return false;
      };

      return searchInObject(doc);
    });
  }, [collectionsData, currentCollectionName, searchTerm]);

  // Get all unique fields from the filtered data
  const getFields = useCallback((data) => {
    if (!data || data.length === 0) return [];
    
    const fieldsSet = new Set();
    const extractFields = (obj, prefix = '') => {
      Object.keys(obj).forEach((key) => {
        if (key === 'id') return; // Skip id field
        
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];
        
        if (value === null || value === undefined) {
          fieldsSet.add(fullKey);
        } else if (Array.isArray(value)) {
          fieldsSet.add(fullKey);
        } else if (typeof value === 'object' && !(value instanceof Date)) {
          extractFields(value, fullKey);
        } else {
          fieldsSet.add(fullKey);
        }
      });
    };

    data.forEach((doc) => {
      extractFields(doc);
    });

    return Array.from(fieldsSet).sort();
  }, []);

  const fields = useMemo(() => getFields(filteredData), [filteredData, getFields]);

  // Handle inline editing
  const handleCellClick = (docId, field, currentValue) => {
    setEditingCell({
      collectionName: currentCollectionName,
      docId,
      field,
      value: currentValue !== null && currentValue !== undefined ? String(currentValue) : ''
    });
  };

  const handleCellChange = (newValue) => {
    setEditingCell((prev) => ({
      ...prev,
      value: newValue
    }));
  };

  const handleCellSave = async () => {
    if (!editingCell) return;

    const { collectionName, docId, field, value } = editingCell;
    
    try {
      const docRef = doc(db, collectionName, docId);
      
      // Get current document to determine value type and build nested structure
      const currentData = collectionsData[collectionName]?.find((d) => d.id === docId);
      if (!currentData) {
        throw new Error('Document not found');
      }

      // Get the original value to determine type
      const fieldPath = field.split('.');
      let originalValue = currentData;
      for (const part of fieldPath) {
        if (originalValue === null || originalValue === undefined) break;
        originalValue = originalValue[part];
      }

      // Try to parse value based on original type
      let parsedValue = value.trim();
      if (originalValue !== null && originalValue !== undefined) {
        if (typeof originalValue === 'number') {
          parsedValue = value.trim() === '' ? 0 : Number(value);
          if (isNaN(parsedValue)) parsedValue = value; // Keep as string if not a valid number
        } else if (typeof originalValue === 'boolean') {
          parsedValue = value.toLowerCase() === 'true';
        } else if (originalValue instanceof Date) {
          parsedValue = new Date(value).toISOString();
        } else {
          parsedValue = value;
        }
      }

      // Build nested update object
      const updateData = {};
      if (fieldPath.length === 1) {
        // Simple field
        updateData[field] = parsedValue;
      } else {
        // Nested field - build the nested structure
        // Get the parent object
        let parent = currentData;
        for (let i = 0; i < fieldPath.length - 1; i++) {
          parent = parent[fieldPath[i]];
          if (!parent) {
            throw new Error(`Parent field ${fieldPath.slice(0, i + 1).join('.')} does not exist`);
          }
        }
        
        // Build nested update preserving structure
        const rootKey = fieldPath[0];
        updateData[rootKey] = { ...currentData[rootKey] };
        let nested = updateData[rootKey];
        for (let i = 1; i < fieldPath.length - 1; i++) {
          nested[fieldPath[i]] = { ...nested[fieldPath[i]] };
          nested = nested[fieldPath[i]];
        }
        nested[fieldPath[fieldPath.length - 1]] = parsedValue;
      }

      updateData.updatedAt = new Date().toISOString();

      await updateDoc(docRef, updateData);

      showSuccess(`Field ${field} updated successfully`);
      setEditingCell(null);
    } catch (error) {
      console.error('Error updating document:', error);
      showError(`Failed to update field: ${error.message}`);
    }
  };

  const handleCellCancel = () => {
    setEditingCell(null);
  };

  // Handle delete
  const handleDeleteClick = (docId, docData) => {
    setDeleteDialog({
      open: true,
      collectionName: currentCollectionName,
      docId,
      docData
    });
  };

  const handleDeleteConfirm = async () => {
    const { collectionName, docId } = deleteDialog;
    
    try {
      const docRef = doc(db, collectionName, docId);
      await deleteDoc(docRef);
      showSuccess('Document deleted successfully');
      setDeleteDialog({ open: false, collectionName: '', docId: '', docData: null });
    } catch (error) {
      console.error('Error deleting document:', error);
      showError(`Failed to delete document: ${error.message}`);
    }
  };

  // Get field value from nested object
  const getFieldValue = (doc, fieldPath) => {
    const parts = fieldPath.split('.');
    let value = doc;
    for (const part of parts) {
      if (value === null || value === undefined) return '';
      value = value[part];
    }
    if (value === null || value === undefined) return '';
    if (typeof value === 'object' && !(value instanceof Date)) {
      return JSON.stringify(value);
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    return String(value);
  };

  // Format field value for display
  const formatValue = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  };

  const currentData = filteredData;
  const isLoading = loading[currentCollectionName];

  const selectedCollectionData = COLLECTIONS.find(c => c.name === selectedCollection);

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
      {/* Sidebar with Collections List */}
      <Paper
        sx={{
          width: 280,
          minWidth: 280,
          height: '100%',
          borderRadius: 0,
          borderRight: '1px solid',
          borderColor: 'divider',
          overflow: 'auto'
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#b98f33', mb: 1 }}>
            Collections
          </Typography>
          <Divider sx={{ mb: 1 }} />
        </Box>
        <List sx={{ pt: 0 }}>
          {COLLECTIONS.map((collection) => (
            <ListItem key={collection.name} disablePadding>
              <ListItemButton
                selected={selectedCollection === collection.name}
                onClick={() => {
                  setSelectedCollection(collection.name);
                  setSearchTerm('');
                  setEditingCell(null);
                }}
                sx={{
                  px: 2,
                  py: 1.5,
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(185, 143, 51, 0.2)',
                    borderLeft: '3px solid #b98f33',
                    '&:hover': {
                      backgroundColor: 'rgba(185, 143, 51, 0.3)'
                    }
                  },
                  '&:hover': {
                    backgroundColor: 'rgba(185, 143, 51, 0.1)'
                  }
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <Typography sx={{ fontSize: '1.2rem' }}>{collection.icon}</Typography>
                </ListItemIcon>
                <ListItemText
                  primary={collection.label}
                  secondary={
                    collectionsData[collection.name] !== undefined
                      ? `${collectionsData[collection.name].length} records`
                      : 'Loading...'
                  }
                  primaryTypographyProps={{
                    fontWeight: selectedCollection === collection.name ? 'bold' : 'normal',
                    color: selectedCollection === collection.name ? '#b98f33' : 'text.primary'
                  }}
                  secondaryTypographyProps={{
                    fontSize: '0.75rem'
                  }}
                />
                {collectionsData[collection.name] && collectionsData[collection.name].length > 0 && (
                  <Chip
                    label={collectionsData[collection.name].length}
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: '0.7rem',
                      backgroundColor: selectedCollection === collection.name ? '#b98f33' : 'rgba(185, 143, 51, 0.3)',
                      color: '#000000',
                      fontWeight: 'bold'
                    }}
                  />
                )}
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Paper>

      {/* Main Content Area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
              {selectedCollectionData?.label || 'Database Control Center'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              View, edit, and manage all database records in real-time
            </Typography>
          </Box>
          <Tooltip title="Refresh Data">
            <IconButton
              onClick={() => {
                setRefreshing(true);
                setTimeout(() => setRefreshing(false), 1000);
              }}
              sx={{ color: '#b98f33' }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Search Bar */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <TextField
            fullWidth
            placeholder={`Search ${selectedCollectionData?.label} by any field...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#b98f33' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                '&:hover fieldset': {
                  borderColor: '#b98f33',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#b98f33',
                },
              },
            }}
          />
          {searchTerm && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Showing {filteredData.length} of {collectionsData[currentCollectionName]?.length || 0} records
            </Typography>
          )}
        </Paper>

        {/* Data Table */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
              <CircularProgress sx={{ color: '#b98f33' }} />
            </Box>
          ) : currentData.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary">
                {collectionsData[currentCollectionName]?.length === 0
                  ? 'No records found in this collection'
                  : 'No records match your search'}
              </Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ backgroundColor: '#b98f33', color: '#000000', fontWeight: 'bold', minWidth: 150, position: 'sticky', left: 0, zIndex: 3 }}>
                      Document ID
                    </TableCell>
                    {fields.map((field) => (
                      <TableCell
                        key={field}
                        sx={{ backgroundColor: '#b98f33', color: '#000000', fontWeight: 'bold', minWidth: 150 }}
                      >
                        {field}
                      </TableCell>
                    ))}
                    <TableCell sx={{ backgroundColor: '#b98f33', color: '#000000', fontWeight: 'bold', width: 100, position: 'sticky', right: 0, zIndex: 3 }}>
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {currentData.map((document) => (
                    <TableRow key={document.id} sx={{ '&:hover': { backgroundColor: '#2a2a2a' } }}>
                      <TableCell sx={{ position: 'sticky', left: 0, backgroundColor: 'background.paper', zIndex: 2 }}>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {document.id}
                        </Typography>
                      </TableCell>
                      {fields.map((field) => {
                        const isEditing =
                          editingCell?.collectionName === currentCollectionName &&
                          editingCell?.docId === document.id &&
                          editingCell?.field === field;
                        const currentValue = getFieldValue(document, field);

                        return (
                          <TableCell
                            key={field}
                            onClick={() => handleCellClick(document.id, field, currentValue)}
                            sx={{
                              cursor: 'pointer',
                              '&:hover': {
                                backgroundColor: isEditing ? 'transparent' : 'rgba(185, 143, 51, 0.1)'
                              },
                              position: 'relative'
                            }}
                          >
                            {isEditing ? (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <TextField
                                  size="small"
                                  value={editingCell.value}
                                  onChange={(e) => handleCellChange(e.target.value)}
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleCellSave();
                                    } else if (e.key === 'Escape') {
                                      handleCellCancel();
                                    }
                                  }}
                                  sx={{
                                    flex: 1,
                                    '& .MuiInputBase-input': {
                                      fontSize: '0.875rem',
                                      padding: '4px 8px'
                                    }
                                  }}
                                />
                                <IconButton size="small" onClick={handleCellSave} sx={{ color: '#4CAF50' }}>
                                  <SaveIcon fontSize="small" />
                                </IconButton>
                                <IconButton size="small" onClick={handleCellCancel} sx={{ color: '#f44336' }}>
                                  <CancelIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            ) : (
                              <Tooltip title="Click to edit" arrow>
                                <Typography
                                  variant="body2"
                                  sx={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    maxWidth: 250
                                  }}
                                >
                                  {formatValue(currentValue)}
                                </Typography>
                              </Tooltip>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell sx={{ position: 'sticky', right: 0, backgroundColor: 'background.paper', zIndex: 2 }}>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteClick(document.id, document)}
                            sx={{
                              color: '#f44336',
                              '&:hover': {
                                backgroundColor: 'rgba(244, 67, 54, 0.1)'
                              }
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>

        {fields.length > 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Showing all {fields.length} fields. Click on any cell to edit.
          </Alert>
        )}
      </Box>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, collectionName: '', docId: '', docData: null })}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this document? This action cannot be undone.
            <Box sx={{ mt: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                Collection: {deleteDialog.collectionName}
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                Document ID: {deleteDialog.docId}
              </Typography>
            </Box>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, collectionName: '', docId: '', docData: null })}>
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ControlPage;

