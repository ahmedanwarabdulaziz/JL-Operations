import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  TextField,
  InputAdornment,
  Chip,
  CircularProgress,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Receipt as ReceiptIcon,
  Business as BusinessIcon,
  Inventory as InventoryIcon,
  CheckCircle as CheckCircleIcon,
  ArrowBack as ArrowBackIcon,
  LocalShipping as LocalShippingIcon,
  Note as NoteIcon,
  Add as AddIcon,
  Save as SaveIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { collection, getDocs, updateDoc, doc, query, orderBy, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useNotification } from '../../../components/Common/NotificationSystem';
import { buttonStyles } from '../../../styles/buttonStyles';

const MaterialRequestPage = () => {
  const [orders, setOrders] = useState([]);
  const [materialsRequired, setMaterialsRequired] = useState([]);
  const [materialsOrdered, setMaterialsOrdered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updating, setUpdating] = useState(false);
  const [materialNotes, setMaterialNotes] = useState({});
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [selectedMaterialForNote, setSelectedMaterialForNote] = useState(null);
  const [currentNoteText, setCurrentNoteText] = useState('');
  const [materialCompanies, setMaterialCompanies] = useState([]);
  
  // General Expenses Dialog State
  const [generalExpenseDialogOpen, setGeneralExpenseDialogOpen] = useState(false);
  const [generalExpenseForm, setGeneralExpenseForm] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    materialCompany: '',
    materialCode: '',
    quantity: '',
    price: '',
    taxType: 'percent', // 'percent' or 'fixed'
    tax: '',
    total: 0
  });
  const [savingGeneralExpense, setSavingGeneralExpense] = useState(false);
  const [editingGeneralExpense, setEditingGeneralExpense] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  
  // Add new company dialog state
  const [addCompanyDialogOpen, setAddCompanyDialogOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [savingCompany, setSavingCompany] = useState(false);

  const { showSuccess, showError } = useNotification();

  // Refs to preserve scroll position
  const requiredScrollRef = useRef(null);
  const orderedScrollRef = useRef(null);
  const pendingScrollPositions = useRef(null);

  // Fetch material companies to get their order
  const fetchMaterialCompanies = useCallback(async () => {
    try {
      const companiesRef = collection(db, 'materialCompanies');
      const q = query(companiesRef, orderBy('createdAt', 'asc'));
      const querySnapshot = await getDocs(q);
      const companiesData = querySnapshot.docs.map((doc, index) => ({
        id: doc.id,
        order: doc.data().order ?? index,
        ...doc.data()
      }));
      
      // Sort by order field to respect the manual drag-and-drop order from Material Companies page
      companiesData.sort((a, b) => a.order - b.order);
      
      setMaterialCompanies(companiesData);
    } catch (error) {
      console.error('Error fetching material companies:', error);
    }
  }, []);

  // Helper function to parse ordered quantity from materialStatus
  const parseOrderedQuantity = (materialStatus) => {
    if (!materialStatus || typeof materialStatus !== 'string') return null;
    if (materialStatus.startsWith('Ordered:')) {
      const quantity = parseFloat(materialStatus.split(':')[1]);
      return isNaN(quantity) ? null : quantity;
    }
    // Support old format where status is just "Ordered"
    if (materialStatus === 'Ordered') {
      return null; // No quantity stored in old format
    }
    return null;
  };

  // Extract materials from orders (excluding completed/canceled orders)
  const extractMaterialsFromOrders = useCallback((ordersList) => {
    const materials = [];
    let skippedCount = 0;
    
    console.log('Total orders to process:', ordersList.length);
    
          ordersList.forEach(order => {
        // Skip "Done" and "Cancelled" orders - show all other statuses
        const orderStatus = order.orderStatus || order.status || order.invoiceStatus;
        console.log('Checking order status:', orderStatus, 'Order ID:', order.id, 'Invoice:', order.orderDetails?.billInvoice);
        
        if (orderStatus === 'Done' || orderStatus === 'done' || 
            orderStatus === 'Cancelled' || orderStatus === 'cancelled' ||
            orderStatus === 'Canceled' || orderStatus === 'canceled' ||
            orderStatus === 'Completed' || orderStatus === 'completed' ||
            orderStatus === 'Finished' || orderStatus === 'finished') {
          console.log('Skipping order with Done/Cancelled/Completed status:', orderStatus, 'Order ID:', order.id);
          skippedCount++;
          return;
        }

      const furnitureGroups = order.furnitureData?.groups || [];
      
      furnitureGroups.forEach(group => {
        if (group.materialCode && group.materialCompany) {
          // Get quantity from the correct field - use the same logic as materialQntyJL
          const materialQntyJL = group.materialJLQnty || 0;
          
          // Only add materials with actual quantities (> 0)
          if (materialQntyJL > 0) {
            const materialStatus = group.materialStatus || null;
            let orderedQnty = parseOrderedQuantity(materialStatus);
            const currentQnty = materialQntyJL;
            
            // Handle old format where status is just "Ordered" without quantity
            // In this case, treat current quantity as ordered quantity
            if (materialStatus === 'Ordered' && orderedQnty === null) {
              orderedQnty = currentQnty;
            }
            
            if (orderedQnty !== null && orderedQnty > 0) {
              // Material was ordered - always add to ordered materials
              materials.push({
                id: `${order.id}_${group.materialCode}_${group.materialCompany}`,
                orderId: order.id,
                invoiceNo: order.orderDetails?.billInvoice || 'N/A',
                materialCompany: group.materialCompany,
                materialCode: group.materialCode,
                materialName: group.materialName || group.materialCode,
                quantity: orderedQnty,
                materialQntyJL: currentQnty,
                orderedQntyJL: orderedQnty,
                unit: group.unit || 'Yard',
                materialStatus: materialStatus,
                materialNote: group.materialNote || '',
                orderDate: order.createdAt,
                customerName: order.personalInfo?.customerName || 'N/A',
                orderStatus: orderStatus,
                isAdditional: false
              });
              
              // Check if there's additional quantity needed
              const additionalQnty = currentQnty - orderedQnty;
              if (additionalQnty > 0) {
                // Add additional quantity to required materials
                materials.push({
                  id: `${order.id}_${group.materialCode}_${group.materialCompany}_additional`,
                  orderId: order.id,
                  invoiceNo: order.orderDetails?.billInvoice || 'N/A',
                  materialCompany: group.materialCompany,
                  materialCode: group.materialCode,
                  materialName: group.materialName || group.materialCode,
                  quantity: additionalQnty,
                  materialQntyJL: currentQnty,
                  orderedQntyJL: orderedQnty,
                  unit: group.unit || 'Yard',
                  materialStatus: null, // Additional quantity is not ordered yet
                  materialNote: group.materialNote || '',
                  orderDate: order.createdAt,
                  customerName: order.personalInfo?.customerName || 'N/A',
                  orderStatus: orderStatus,
                  isAdditional: true,
                  additionalQnty: additionalQnty
                });
              }
              // If additionalQnty <= 0, don't add to required (quantity decreased)
            } else {
              // Material not ordered yet - add to required materials
              materials.push({
                id: `${order.id}_${group.materialCode}_${group.materialCompany}`,
                orderId: order.id,
                invoiceNo: order.orderDetails?.billInvoice || 'N/A',
                materialCompany: group.materialCompany,
                materialCode: group.materialCode,
                materialName: group.materialName || group.materialCode,
                quantity: currentQnty,
                materialQntyJL: currentQnty,
                orderedQntyJL: null,
                unit: group.unit || 'Yard',
                materialStatus: materialStatus,
                materialNote: group.materialNote || '',
                orderDate: order.createdAt,
                customerName: order.personalInfo?.customerName || 'N/A',
                orderStatus: orderStatus,
                isAdditional: false
              });
            }
          }
        }
      });
    });
    
    console.log('Total materials extracted:', materials.length);
    return materials;
  }, []);

  // Group materials by company with proper sorting
  const groupMaterialsByCompany = (materials) => {
    const grouped = {};
    materials.forEach(material => {
      if (!grouped[material.materialCompany]) {
        grouped[material.materialCompany] = [];
      }
      grouped[material.materialCompany].push(material);
    });
    
    // Sort materials within each company by material code (alphabetical)
    Object.keys(grouped).forEach(company => {
      grouped[company].sort((a, b) => {
        const codeA = a.materialCode.toLowerCase();
        const codeB = b.materialCode.toLowerCase();
        if (codeA < codeB) return -1;
        if (codeA > codeB) return 1;
        return 0;
      });
    });
    
    return grouped;
  };

  // Sort companies by their order from Material Companies page
  const sortCompaniesByOrder = (groupedMaterials) => {
    const sortedEntries = Object.entries(groupedMaterials).sort(([companyA], [companyB]) => {
      const companyA_data = materialCompanies.find(c => c.name === companyA);
      const companyB_data = materialCompanies.find(c => c.name === companyB);
      
      // If both companies are found in materialCompanies, sort by their order
      if (companyA_data && companyB_data) {
        return companyA_data.order - companyB_data.order;
      }
      
      // If only one is found, prioritize the one that exists
      if (companyA_data && !companyB_data) return -1;
      if (!companyA_data && companyB_data) return 1;
      
      // If neither is found, sort alphabetically as fallback
      return companyA.toLowerCase().localeCompare(companyB.toLowerCase());
    });
    
    return Object.fromEntries(sortedEntries);
  };

  // Filter materials based on search term (quantity filtering is done at extraction)
  const filterMaterials = (materials, searchValue) => {
    // No need to filter by quantity here since it's done during extraction
    if (!searchValue.trim()) return materials;
    
    const searchLower = searchValue.toLowerCase();
    return materials.filter(material => 
      material.invoiceNo.toLowerCase().includes(searchLower) ||
      material.materialCode.toLowerCase().includes(searchLower) ||
      material.materialName.toLowerCase().includes(searchLower) ||
      material.materialCompany.toLowerCase().includes(searchLower) ||
      material.customerName.toLowerCase().includes(searchLower)
    );
  };

  // Fetch orders and extract materials
  const fetchMaterials = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch orders, material companies, and general expenses
      const [ordersSnapshot, companiesSnapshot, generalExpensesSnapshot] = await Promise.all([
        getDocs(collection(db, 'orders')),
        getDocs(query(collection(db, 'materialCompanies'), orderBy('createdAt', 'asc'))),
        getDocs(query(collection(db, 'generalExpenses'), orderBy('createdAt', 'desc')))
      ]);
      
      const ordersData = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const companiesData = companiesSnapshot.docs.map((doc, index) => ({
        id: doc.id,
        order: doc.data().order ?? index,
        ...doc.data()
      }));
      const generalExpensesData = generalExpensesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort companies by order field
      companiesData.sort((a, b) => a.order - b.order);
      
      setOrders(ordersData);
      setMaterialCompanies(companiesData);
      
      const allMaterials = extractMaterialsFromOrders(ordersData);
      
      // Convert general expenses to material format
      const generalExpenseMaterials = generalExpensesData.map(expense => ({
        id: `general_${expense.id}`,
        orderId: 'general',
        invoiceNo: 'GENERAL',
        materialCompany: expense.materialCompany,
        materialCode: expense.materialCode,
        materialName: expense.materialCode,
        quantity: expense.quantity,
        materialQntyJL: expense.quantity,
        unit: '',
        materialStatus: expense.materialStatus || null,
        materialNote: expense.note || '',
        orderDate: expense.createdAt,
        customerName: expense.description || 'General Expense',
        orderStatus: 'General',
        price: expense.price,
        tax: expense.tax,
        taxType: expense.taxType,
        total: expense.total,
        // Include original expense data for editing
        date: expense.date,
        description: expense.description,
        note: expense.note,
        createdAt: expense.createdAt,
        updatedAt: expense.updatedAt,
        isGeneralExpense: true
      }));
      
      // Combine order materials with general expense materials
      const combinedMaterials = [...allMaterials, ...generalExpenseMaterials];
      
      // Filter ordered materials: status starts with "Ordered:" or equals "Ordered" (old format)
      const orderedMaterials = combinedMaterials.filter(m => {
        const status = m.materialStatus;
        if (!status) return false;
        if (typeof status === 'string') {
          return status.startsWith('Ordered:') || status === 'Ordered';
        }
        return false;
      });
      
      // Filter required materials: status is null OR isAdditional is true
      const requiredMaterials = combinedMaterials.filter(m => {
        if (m.isAdditional === true) return true; // Additional quantities always in required
        const status = m.materialStatus;
        return !status || status === null;
      });
      
      setMaterialsRequired(requiredMaterials);
      setMaterialsOrdered(orderedMaterials);
      
    } catch (error) {
      console.error('Error fetching materials:', error);
      showError('Failed to fetch materials');
    } finally {
      setLoading(false);
    }
  }, [extractMaterialsFromOrders]);

  // Update material status and note
  const updateMaterialStatus = async (materialId, newStatus, note = '') => {
    try {
      setUpdating(true);
      
      // Save current scroll positions
      pendingScrollPositions.current = {
        required: requiredScrollRef.current?.scrollTop || 0,
        ordered: orderedScrollRef.current?.scrollTop || 0
      };
      
      // Find the material and its order
      const allMaterials = [...materialsRequired, ...materialsOrdered];
      const material = allMaterials.find(m => m.id === materialId);
      
      if (!material) {
        showError('Material not found');
        return;
      }

      // Handle general expenses differently
      if (material.isGeneralExpense) {
        const generalExpenseId = material.id.replace('general_', '');
        const generalExpenseRef = doc(db, 'generalExpenses', generalExpenseId);
        
        // When marking as "Ordered", store the quantity in the status
        let statusToStore = newStatus;
        if (newStatus === 'Ordered') {
          const currentQuantity = material.materialQntyJL || material.quantity || 0;
          statusToStore = `Ordered:${currentQuantity}`;
        }
        
        await updateDoc(generalExpenseRef, {
          materialStatus: statusToStore,
          note: note || material.materialNote || ''
        });
        
        showSuccess(`General expense status updated to ${newStatus || 'Required'}`);
        
        // Update local state without refreshing the entire page
        if (newStatus === 'Ordered') {
          const materialToMove = materialsRequired.find(m => m.id === materialId);
          if (materialToMove) {
            const updatedMaterial = { 
              ...materialToMove, 
              materialStatus: 'Ordered',
              materialNote: note || materialToMove.materialNote || ''
            };
            setMaterialsRequired(prev => prev.filter(m => m.id !== materialId));
            setMaterialsOrdered(prev => [...prev, updatedMaterial]);
          }
        } else if (newStatus === 'Received') {
          setMaterialsOrdered(prev => prev.filter(m => m.id !== materialId));
        } else if (newStatus === null) {
          const materialToMove = materialsOrdered.find(m => m.id === materialId);
          if (materialToMove) {
            const updatedMaterial = { 
              ...materialToMove, 
              materialStatus: null,
              materialNote: note || materialToMove.materialNote || ''
            };
            setMaterialsOrdered(prev => prev.filter(m => m.id !== materialId));
            setMaterialsRequired(prev => [...prev, updatedMaterial]);
          }
        }
        
        return;
      }

      // Handle regular order materials
      const orderRef = doc(db, 'orders', material.orderId);
      const order = orders.find(o => o.id === material.orderId);
      
      if (!order) {
        showError('Order not found');
        return;
      }

      // When marking as "Ordered", store the quantity in the status
      let statusToStore = newStatus;
      if (newStatus === 'Ordered') {
        // If this is additional material, add it to the existing ordered quantity
        if (material.isAdditional && material.orderedQntyJL) {
          // Add additional quantity to existing ordered quantity
          const newTotalOrdered = material.orderedQntyJL + (material.quantity || material.additionalQnty || 0);
          statusToStore = `Ordered:${newTotalOrdered}`;
        } else {
          // Store quantity in format "Ordered:10"
          const currentQuantity = material.materialQntyJL || material.quantity || 0;
          statusToStore = `Ordered:${currentQuantity}`;
        }
      }

      // Update the specific material status and note in the order
      const updatedFurnitureGroups = order.furnitureData.groups.map(group => {
        if (group.materialCode === material.materialCode && 
            group.materialCompany === material.materialCompany) {
          return { 
            ...group, 
            materialStatus: statusToStore,
            materialNote: note || group.materialNote || ''
          };
        }
        return group;
      });

      await updateDoc(orderRef, {
        'furnitureData.groups': updatedFurnitureGroups
      });

      // Update local state - handle ALL materials with the same orderId, materialCode, and materialCompany
      // This is important because Firebase updates all groups with the same materialCode/materialCompany
      const matchKey = (m) => 
        m.orderId === material.orderId && 
        m.materialCode === material.materialCode && 
        m.materialCompany === material.materialCompany;

      // Use a single batch update to avoid nested state update issues
      if (newStatus === 'Ordered') {
        // Update both states in sequence (React will batch these)
        setMaterialsRequired(prevRequired => {
          const materialsToMove = prevRequired.filter(matchKey);
          return materialsToMove.length > 0 
            ? prevRequired.filter(m => !matchKey(m))
            : prevRequired;
        });
        
        setMaterialsOrdered(prevOrdered => {
          // Get current required state to find materials to move
          // Since we can't access it directly, we'll use a callback that runs after state update
          // But for now, let's get materials from the order we already have
          const materialsToMove = materialsRequired.filter(matchKey);
          
          if (materialsToMove.length > 0) {
            const updatedMaterials = materialsToMove.map(m => ({
              ...m,
              materialStatus: 'Ordered',
              materialNote: note || m.materialNote || ''
            }));
            
            // Remove any existing materials with the same combination to avoid duplicates
            const filtered = prevOrdered.filter(m => !matchKey(m));
            return [...filtered, ...updatedMaterials];
          }
          return prevOrdered;
        });
      } else if (newStatus === 'Received') {
        // Remove all matching materials from ordered (they're received, so they disappear)
        setMaterialsOrdered(prev => prev.filter(m => !matchKey(m)));
      } else if (newStatus === null) {
        // Update both states in sequence (React will batch these)
        setMaterialsOrdered(prevOrdered => {
          const materialsToMove = prevOrdered.filter(matchKey);
          return materialsToMove.length > 0
            ? prevOrdered.filter(m => !matchKey(m))
            : prevOrdered;
        });
        
        setMaterialsRequired(prevRequired => {
          // Get materials to move from ordered state (using closure value)
          const materialsToMove = materialsOrdered.filter(matchKey);
          
          if (materialsToMove.length > 0) {
            const updatedMaterials = materialsToMove.map(m => ({
              ...m,
              materialStatus: null,
              materialNote: note || m.materialNote || ''
            }));
            
            // Remove any existing materials with the same combination to avoid duplicates
            const filtered = prevRequired.filter(m => !matchKey(m));
            return [...filtered, ...updatedMaterials];
          }
          return prevRequired;
        });
      }

      showSuccess(`Material status updated to ${newStatus || 'Required'}`);
      
      // Refresh materials to ensure correct state, especially for additional materials
      // Use setTimeout to allow UI updates to complete first
      setTimeout(() => {
        fetchMaterials();
      }, 500);
      
    } catch (error) {
      console.error('Error updating material status:', error);
      showError('Failed to update material status');
    } finally {
      setUpdating(false);
    }
  };

  // Handle note change
  const handleNoteChange = (materialId, note) => {
    setMaterialNotes(prev => ({
      ...prev,
      [materialId]: note
    }));
  };

  // Open note dialog
  const openNoteDialog = (material) => {
    setSelectedMaterialForNote(material);
    setCurrentNoteText(materialNotes[material.id] || material.materialNote || '');
    setNoteDialogOpen(true);
  };

  // Close note dialog
  const closeNoteDialog = () => {
    setNoteDialogOpen(false);
    setSelectedMaterialForNote(null);
    setCurrentNoteText('');
  };

  // Save note
  const saveNote = () => {
    if (selectedMaterialForNote) {
      handleNoteChange(selectedMaterialForNote.id, currentNoteText);
      closeNoteDialog();
      showSuccess('Note saved successfully');
    }
  };

  // General Expenses Functions
  const openGeneralExpenseDialog = () => {
    setGeneralExpenseForm({
      date: new Date().toISOString().split('T')[0],
      description: '',
      materialCompany: '',
      materialCode: '',
      quantity: '',
      price: '',
      taxType: 'percent',
      tax: '',
      total: 0
    });
    setGeneralExpenseDialogOpen(true);
  };

  const closeGeneralExpenseDialog = () => {
    setGeneralExpenseDialogOpen(false);
    setGeneralExpenseForm({
      date: new Date().toISOString().split('T')[0],
      description: '',
      materialCompany: '',
      materialCode: '',
      quantity: '',
      price: '',
      taxType: 'percent',
      tax: '',
      total: 0
    });
  };

  const handleGeneralExpenseInputChange = (field, value) => {
    const newForm = { ...generalExpenseForm, [field]: value };
    
    // Calculate total when price, quantity, or tax changes
    if (field === 'price' || field === 'quantity' || field === 'tax' || field === 'taxType') {
      const price = parseFloat(newForm.price) || 0;
      const quantity = parseFloat(newForm.quantity) || 0;
      const taxValue = parseFloat(newForm.tax) || 0;
      
      let taxAmount = 0;
      if (newForm.taxType === 'percent') {
        taxAmount = (price * quantity * taxValue) / 100;
      } else {
        taxAmount = taxValue;
      }
      
      newForm.total = (price * quantity + taxAmount).toFixed(2);
    }
    
    setGeneralExpenseForm(newForm);
  };

  const validateGeneralExpenseForm = () => {
    const { date, materialCompany, materialCode, quantity, price, tax } = generalExpenseForm;
    
    if (!date || !materialCompany || !materialCode || !quantity || !price || !tax) {
      showError('All fields except description are required');
      return false;
    }
    
    if (parseFloat(quantity) <= 0 || parseFloat(price) <= 0 || parseFloat(tax) < 0) {
      showError('Quantity and price must be greater than 0, tax cannot be negative');
      return false;
    }
    
    return true;
  };

  const saveGeneralExpense = async () => {
    if (!validateGeneralExpenseForm()) return;
    
    try {
      setSavingGeneralExpense(true);
      
      const generalExpenseData = {
        ...generalExpenseForm,
        quantity: parseFloat(generalExpenseForm.quantity),
        price: parseFloat(generalExpenseForm.price),
        tax: parseFloat(generalExpenseForm.tax),
        total: parseFloat(generalExpenseForm.total),
        type: 'general' // Mark as general expense
      };
      
      if (editingGeneralExpense) {
        // Update existing expense - extract Firebase ID from material ID
        const firebaseId = editingGeneralExpense.id.replace('general_', '');
        const expenseRef = doc(db, 'generalExpenses', firebaseId);
        await updateDoc(expenseRef, {
          ...generalExpenseData,
          updatedAt: new Date()
        });
        showSuccess('General expense updated successfully');
      } else {
        // Create new expense
        await addDoc(collection(db, 'generalExpenses'), {
          ...generalExpenseData,
          createdAt: new Date()
        });
        showSuccess('General expense added successfully');
      }
      
      closeGeneralExpenseDialog();
      
      // Refresh materials to include the new/updated general expense
      fetchMaterials();
      
    } catch (error) {
      console.error('Error saving general expense:', error);
      showError('Failed to save general expense');
    } finally {
      setSavingGeneralExpense(false);
    }
  };

  // Edit General Expense Functions
  const openEditGeneralExpenseDialog = (expense) => {
    setEditingGeneralExpense(expense);
    setGeneralExpenseForm({
      date: expense.date || new Date().toISOString().split('T')[0],
      description: expense.description || '',
      materialCompany: expense.materialCompany || '',
      materialCode: expense.materialCode || '',
      quantity: expense.quantity?.toString() || '',
      price: expense.price?.toString() || '',
      taxType: expense.taxType || 'percent',
      tax: expense.tax?.toString() || '',
      total: expense.total || 0
    });
    setGeneralExpenseDialogOpen(true);
  };

  const closeEditDialog = () => {
    setEditingGeneralExpense(null);
    closeGeneralExpenseDialog();
  };

  // Delete General Expense Functions
  const openDeleteDialog = (expense) => {
    setExpenseToDelete(expense);
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setExpenseToDelete(null);
  };

  const deleteGeneralExpense = async () => {
    if (!expenseToDelete) return;
    
    try {
      setUpdating(true);
      
      // Extract the original Firebase ID from the material ID
      const firebaseId = expenseToDelete.id.replace('general_', '');
      const expenseRef = doc(db, 'generalExpenses', firebaseId);
      await deleteDoc(expenseRef);
      
      showSuccess('General expense deleted successfully');
      closeDeleteDialog();
      
      // Refresh materials to remove the deleted expense
      fetchMaterials();
      
    } catch (error) {
      console.error('Error deleting general expense:', error);
      showError('Failed to delete general expense');
    } finally {
      setUpdating(false);
    }
  };

  // Add new company dialog handlers
  const openAddCompanyDialog = () => {
    setNewCompanyName('');
    setAddCompanyDialogOpen(true);
  };

  const closeAddCompanyDialog = () => {
    setAddCompanyDialogOpen(false);
    setNewCompanyName('');
  };

  const saveNewCompany = async () => {
    if (!newCompanyName.trim()) {
      showError('Please enter a company name');
      return;
    }

    // Check if company already exists
    const existingCompany = materialCompanies.find(company => 
      company.name.toLowerCase() === newCompanyName.trim().toLowerCase()
    );

    if (existingCompany) {
      showError('A company with this name already exists');
      return;
    }

    setSavingCompany(true);

    try {
      // Get the highest order number
      const maxOrder = materialCompanies.reduce((max, company) => 
        Math.max(max, company.order || 0), 0
      );

      const newCompanyData = {
        name: newCompanyName.trim(),
        order: maxOrder + 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'materialCompanies'), newCompanyData);
      
      // Add to local state
      const newCompany = {
        id: docRef.id,
        ...newCompanyData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      setMaterialCompanies(prev => [...prev, newCompany].sort((a, b) => a.order - b.order));
      
      // Update the general expense form to select the new company
      setGeneralExpenseForm(prev => ({
        ...prev,
        materialCompany: newCompany.name
      }));

      showSuccess('New material company added successfully');
      closeAddCompanyDialog();
    } catch (error) {
      console.error('Error saving new company:', error);
      showError('Failed to save new company');
    } finally {
      setSavingCompany(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  // Restore scroll position after materials update
  useEffect(() => {
    if (pendingScrollPositions.current) {
      // Use setTimeout to ensure DOM is fully updated
      setTimeout(() => {
        if (pendingScrollPositions.current) {
          if (requiredScrollRef.current && pendingScrollPositions.current.required !== undefined) {
            requiredScrollRef.current.scrollTop = pendingScrollPositions.current.required;
          }
          if (orderedScrollRef.current && pendingScrollPositions.current.ordered !== undefined) {
            orderedScrollRef.current.scrollTop = pendingScrollPositions.current.ordered;
          }
          // Clear the pending positions
          pendingScrollPositions.current = null;
        }
      }, 100);
    }
  }, [materialsRequired, materialsOrdered]);

  // Filter materials based on search
  const filteredRequiredMaterials = useMemo(() => filterMaterials(materialsRequired, searchTerm), [materialsRequired, searchTerm]);
  const filteredOrderedMaterials = useMemo(() => filterMaterials(materialsOrdered, searchTerm), [materialsOrdered, searchTerm]);

  // Group filtered materials and sort by company order
  const groupedRequiredMaterials = useMemo(() => sortCompaniesByOrder(groupMaterialsByCompany(filteredRequiredMaterials)), [filteredRequiredMaterials, materialCompanies]);
  const groupedOrderedMaterials = useMemo(() => sortCompaniesByOrder(groupMaterialsByCompany(filteredOrderedMaterials)), [filteredOrderedMaterials, materialCompanies]);

  const formatDate = (date) => {
    if (!date) return 'N/A';
    
    try {
      let dateObj;
      if (date && typeof date === 'object' && date.toDate) {
        dateObj = date.toDate();
      } else {
        dateObj = new Date(date);
      }
      
      if (isNaN(dateObj.getTime())) {
        return 'Invalid Date';
      }
      
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '60vh'
      }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ 
      height: 'calc(100vh - 100px)', 
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: '2px solid #e0e0e0' }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 2 }}>
          Material Request Management
        </Typography>
        
        {/* Search and Refresh */}
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            fullWidth
            placeholder="Search by invoice number, material code, company, or customer name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              )
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                backgroundColor: 'background.paper'
              }
            }}
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openGeneralExpenseDialog}
            sx={{
              ...buttonStyles.primaryButton,
              backgroundColor: '#f27921',
              '&:hover': {
                backgroundColor: '#e67e22'
              }
            }}
          >
            ADD General Expenses
          </Button>
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={fetchMaterials}
            disabled={updating}
            sx={buttonStyles.primaryButton}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Two Column Layout */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Column - Materials Required */}
        <Paper ref={requiredScrollRef} sx={{ 
          width: '50%', 
          height: '100%', 
          overflow: 'auto',
          borderRight: '2px solid #e0e0e0',
          display: 'flex',
          flexDirection: 'column'
        }}>
                     {/* Column Header */}
           <Box sx={{ p: 2, borderBottom: '2px solid #e0e0e0' }}>
             <Box sx={{ display: 'flex', alignItems: 'center' }}>
               <InventoryIcon sx={{ mr: 1, color: '#b98f33', fontSize: 24 }} />
               <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                 Materials Required ({filteredRequiredMaterials.length})
               </Typography>
             </Box>
           </Box>
          
          {/* Content */}
          <Box sx={{ flex: 1, p: 2 }}>
            {Object.keys(groupedRequiredMaterials).length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body1" color="text.secondary">
                  {searchTerm ? 'No materials found matching your search' : 'No materials require ordering'}
                </Typography>
              </Box>
            ) : (
              Object.entries(groupedRequiredMaterials).map(([company, materials]) => (
                <Box key={company} sx={{ mb: 3 }}>
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    mb: 1,
                    p: 1,
                    backgroundColor: 'rgba(185, 143, 51, 0.1)',
                    borderRadius: 1,
                    border: '1px solid rgba(185, 143, 51, 0.3)'
                  }}>
                    <BusinessIcon sx={{ mr: 1, color: '#b98f33', fontSize: 18 }} />
                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                      {company}
                    </Typography>
                    <Chip 
                      label={materials.length} 
                      size="small" 
                      sx={{ ml: 'auto', backgroundColor: '#ff6b6b', color: 'white', fontSize: '0.7rem' }}
                    />
                  </Box>
                  
                  {materials.map((material) => (
                    <Card key={material.id} sx={{ 
                      mb: 2, 
                      backgroundColor: '#000000',
                      border: material.isAdditional ? '2px solid #ff9800' : '2px solid #b98f33',
                      color: '#b98f33',
                      position: 'relative',
                      '&:hover': {
                        backgroundColor: '#1a1a1a',
                        transform: 'translateY(-2px)',
                        boxShadow: material.isAdditional 
                          ? '0 4px 20px rgba(255, 152, 0, 0.4)' 
                          : '0 4px 20px rgba(185, 143, 51, 0.3)'
                      },
                      transition: 'all 0.3s ease'
                    }}>
                      {/* Additional Quantity Badge */}
                      {material.isAdditional && (
                        <Chip
                          label="Additional"
                          size="small"
                          sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            backgroundColor: '#ff9800',
                            color: '#000000',
                            fontWeight: 'bold',
                            fontSize: '0.65rem',
                            height: '20px',
                            zIndex: 1
                          }}
                        />
                      )}
                      <CardContent sx={{ p: 2 }}>
                        {/* Three Column Layout */}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                          {/* Left Column - Material Code and Details */}
                          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5 }}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#b98f33', textAlign: 'left' }}>
                              {material.materialCode}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#b98f33', fontSize: '0.75rem', textAlign: 'left' }}>
                              {material.invoiceNo}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#b98f33', fontSize: '0.75rem', textAlign: 'left' }}>
                              {material.customerName.split(' ')[0]}
                            </Typography>
                          </Box>
                          
                          {/* Middle Column - Quantity */}
                          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minWidth: 80, flexDirection: 'column' }}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', color: material.isAdditional ? '#ff9800' : '#b98f33', textAlign: 'center' }}>
                              {material.isAdditional 
                                ? `+${material.quantity || material.additionalQnty} ${material.unit?.toLowerCase() || 'yards'}`
                                : material.isGeneralExpense 
                                  ? material.materialQntyJL 
                                  : `${material.quantity || material.materialQntyJL} ${material.unit?.toLowerCase() || 'yards'}`}
                            </Typography>
                            {material.isAdditional && (
                              <Typography variant="caption" sx={{ color: '#ff9800', fontSize: '0.65rem', textAlign: 'center', fontStyle: 'italic' }}>
                                Extra Quantity
                              </Typography>
                            )}
                          </Box>
                          
                          {/* Right Column - Action Buttons */}
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1, minWidth: 48 }}>
                            {/* Note Button */}
                            <IconButton
                              sx={{
                                ...buttonStyles.secondaryButton,
                                minWidth: 'auto',
                                padding: '8px',
                                borderRadius: '50%',
                                width: '32px',
                                height: '32px'
                              }}
                              size="small"
                              onClick={() => openNoteDialog(material)}
                            >
                              <NoteIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                            
                            {/* Edit/Delete buttons for general expenses */}
                            {material.isGeneralExpense && (
                              <>
                                <IconButton
                                  sx={{
                                    backgroundColor: '#2196f3',
                                    color: '#ffffff',
                                    minWidth: 'auto',
                                    padding: '6px',
                                    borderRadius: '50%',
                                    width: '32px',
                                    height: '32px',
                                    '&:hover': {
                                      backgroundColor: '#1976d2'
                                    }
                                  }}
                                  size="small"
                                  onClick={() => openEditGeneralExpenseDialog(material)}
                                >
                                  <EditIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                                <IconButton
                                  sx={{
                                    backgroundColor: '#f44336',
                                    color: '#ffffff',
                                    minWidth: 'auto',
                                    padding: '6px',
                                    borderRadius: '50%',
                                    width: '32px',
                                    height: '32px',
                                    '&:hover': {
                                      backgroundColor: '#d32f2f'
                                    }
                                  }}
                                  size="small"
                                  onClick={() => openDeleteDialog(material)}
                                >
                                  <DeleteIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </>
                            )}
                          </Box>
                          
                          {/* Action Button */}
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<LocalShippingIcon />}
                            onClick={() => updateMaterialStatus(
                              material.id, 
                              'Ordered', 
                              materialNotes[material.id] || material.materialNote || ''
                            )}
                            disabled={updating}
                            sx={{
                              ...buttonStyles.primaryButton,
                              fontSize: '0.75rem',
                              padding: '4px 12px'
                            }}
                          >
                            Order
                          </Button>
                        </Box>

                        {/* Note Display Row */}
                        {(materialNotes[material.id] || material.materialNote) && (
                          <Box sx={{ 
                            mt: 1, 
                            p: 1, 
                            backgroundColor: 'rgba(255,255,255,0.9)', 
                            borderRadius: 1,
                            border: '1px solid #8b6b1f'
                          }}>
                            <Typography variant="body2" sx={{ 
                              color: '#b98f33', 
                              fontStyle: 'italic',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1
                            }}>
                              <NoteIcon sx={{ fontSize: 16, color: '#b98f33' }} />
                              {materialNotes[material.id] || material.materialNote}
                            </Typography>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              ))
            )}
          </Box>
        </Paper>

        {/* Right Column - Materials Ordered */}
        <Paper ref={orderedScrollRef} sx={{ 
          width: '50%', 
          height: '100%', 
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Column Header */}
          <Box sx={{ p: 2, borderBottom: '2px solid #e0e0e0' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <LocalShippingIcon sx={{ mr: 1, color: '#feca57', fontSize: 24 }} />
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#feca57' }}>
                Materials Ordered ({filteredOrderedMaterials.length})
              </Typography>
            </Box>
          </Box>
          
          {/* Content */}
          <Box sx={{ flex: 1, p: 2 }}>
            {Object.keys(groupedOrderedMaterials).length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body1" color="text.secondary">
                  {searchTerm ? 'No materials found matching your search' : 'No materials currently ordered'}
                </Typography>
              </Box>
            ) : (
              Object.entries(groupedOrderedMaterials).map(([company, materials]) => (
                <Box key={company} sx={{ mb: 3 }}>
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    mb: 1,
                    p: 1,
                    backgroundColor: 'rgba(185, 143, 51, 0.1)',
                    borderRadius: 1,
                    border: '1px solid rgba(185, 143, 51, 0.3)'
                  }}>
                    <BusinessIcon sx={{ mr: 1, color: '#b98f33', fontSize: 18 }} />
                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                      {company}
                    </Typography>
                    <Chip 
                      label={materials.length} 
                      size="small" 
                      sx={{ ml: 'auto', backgroundColor: '#feca57', color: 'white', fontSize: '0.7rem' }}
                    />
                  </Box>
                  
                  {materials.map((material) => (
                    <Card key={material.id} sx={{ 
                      mb: 2, 
                      backgroundColor: '#000000',
                      border: '2px solid #b98f33',
                      color: '#b98f33',
                      '&:hover': {
                        backgroundColor: '#1a1a1a',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 20px rgba(185, 143, 51, 0.3)'
                      },
                      transition: 'all 0.3s ease'
                    }}>
                      <CardContent sx={{ p: 2 }}>
                        {/* Three Column Layout */}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                          {/* Left Column - Material Code and Details */}
                          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5 }}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#b98f33', textAlign: 'left' }}>
                              {material.materialCode}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#b98f33', fontSize: '0.75rem', textAlign: 'left' }}>
                              {material.invoiceNo}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#b98f33', fontSize: '0.75rem', textAlign: 'left' }}>
                              {material.customerName.split(' ')[0]}
                            </Typography>
                          </Box>
                          
                          {/* Middle Column - Quantity */}
                          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minWidth: 80, flexDirection: 'column' }}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#b98f33', textAlign: 'center' }}>
                              {material.isGeneralExpense 
                                ? material.orderedQntyJL || material.materialQntyJL
                                : `${material.orderedQntyJL || material.quantity || material.materialQntyJL} ${material.unit?.toLowerCase() || 'yards'}`}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#b98f33', fontSize: '0.65rem', textAlign: 'center', fontStyle: 'italic' }}>
                              Ordered
                            </Typography>
                          </Box>
                          
                          {/* Right Column - Action Buttons */}
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1, minWidth: 48 }}>
                            {/* Note Button */}
                            <IconButton
                              sx={{
                                ...buttonStyles.secondaryButton,
                                minWidth: 'auto',
                                padding: '8px',
                                borderRadius: '50%',
                                width: '32px',
                                height: '32px'
                              }}
                              size="small"
                              onClick={() => openNoteDialog(material)}
                            >
                              <NoteIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                            
                            {/* Edit/Delete buttons for general expenses */}
                            {material.isGeneralExpense && (
                              <>
                                <IconButton
                                  sx={{
                                    backgroundColor: '#2196f3',
                                    color: '#ffffff',
                                    minWidth: 'auto',
                                    padding: '6px',
                                    borderRadius: '50%',
                                    width: '32px',
                                    height: '32px',
                                    '&:hover': {
                                      backgroundColor: '#1976d2'
                                    }
                                  }}
                                  size="small"
                                  onClick={() => openEditGeneralExpenseDialog(material)}
                                >
                                  <EditIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                                <IconButton
                                  sx={{
                                    backgroundColor: '#f44336',
                                    color: '#ffffff',
                                    minWidth: 'auto',
                                    padding: '6px',
                                    borderRadius: '50%',
                                    width: '32px',
                                    height: '32px',
                                    '&:hover': {
                                      backgroundColor: '#d32f2f'
                                    }
                                  }}
                                  size="small"
                                  onClick={() => openDeleteDialog(material)}
                                >
                                  <DeleteIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </>
                            )}
                          </Box>
                          
                          {/* Action Buttons */}
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                              variant="contained"
                              size="small"
                              startIcon={<CheckCircleIcon />}
                              onClick={() => updateMaterialStatus(
                                material.id, 
                                'Received', 
                                materialNotes[material.id] || material.materialNote || ''
                              )}
                              disabled={updating}
                              sx={{
                                ...buttonStyles.primaryButton,
                                fontSize: '0.75rem',
                                padding: '4px 8px'
                              }}
                            >
                              Received
                            </Button>
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<ArrowBackIcon />}
                              onClick={() => updateMaterialStatus(
                                material.id, 
                                null, 
                                materialNotes[material.id] || material.materialNote || ''
                              )}
                              disabled={updating}
                              sx={{
                                ...buttonStyles.cancelButton,
                                fontSize: '0.75rem',
                                padding: '4px 8px'
                              }}
                            >
                              Back
                            </Button>
                          </Box>
                        </Box>

                        {/* Note Display Row */}
                        {(materialNotes[material.id] || material.materialNote) && (
                          <Box sx={{ 
                            mt: 1, 
                            p: 1, 
                            backgroundColor: 'rgba(255,255,255,0.9)', 
                            borderRadius: 1,
                            border: '1px solid #8b6b1f'
                          }}>
                            <Typography variant="body2" sx={{ 
                              color: '#b98f33', 
                              fontStyle: 'italic',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1
                            }}>
                              <NoteIcon sx={{ fontSize: 16, color: '#b98f33' }} />
                              {materialNotes[material.id] || material.materialNote}
                            </Typography>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              ))
            )}
          </Box>
        </Paper>
      </Box>

      {/* Note Dialog */}
      <Dialog open={noteDialogOpen} onClose={closeNoteDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{
          background: 'linear-gradient(135deg, #f27921 0%, #e67e22 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <NoteIcon />
          Add Note for Material
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            fullWidth
            multiline
            rows={4}
            placeholder="Enter your note here..."
            value={currentNoteText}
            onChange={(e) => setCurrentNoteText(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: '#8b6b1f'
                },
                '&:hover fieldset': {
                  borderColor: '#b98f33'
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#b98f33'
                }
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={closeNoteDialog}
            sx={buttonStyles.cancelButton}
          >
            Cancel
          </Button>
          <Button
            onClick={saveNote}
            variant="contained"
            sx={buttonStyles.primaryButton}
          >
            Save Note
          </Button>
        </DialogActions>
      </Dialog>

      {/* General Expenses Dialog */}
      <Dialog open={generalExpenseDialogOpen} onClose={editingGeneralExpense ? closeEditDialog : closeGeneralExpenseDialog} maxWidth="md" fullWidth>
        <DialogTitle sx={{
          background: 'linear-gradient(135deg, #f27921 0%, #e67e22 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          {editingGeneralExpense ? <EditIcon /> : <AddIcon />}
          {editingGeneralExpense ? 'Edit General Expense' : 'Add General Expense'}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Description Field */}
              <TextField
                fullWidth
                label="Description"
                value={generalExpenseForm.description}
                onChange={(e) => handleGeneralExpenseInputChange('description', e.target.value)}
                placeholder="Enter expense description (optional)"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#8b6b1f' },
                    '&:hover fieldset': { borderColor: '#b98f33' },
                    '&.Mui-focused fieldset': { borderColor: '#b98f33' }
                  }
                }}
              />

            {/* Date and Material Company Row */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Date"
                type="date"
                value={generalExpenseForm.date}
                onChange={(e) => handleGeneralExpenseInputChange('date', e.target.value)}
                InputLabelProps={{ shrink: true }}
                required
                sx={{
                  minWidth: '180px',
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#8b6b1f' },
                    '&:hover fieldset': { borderColor: '#b98f33' },
                    '&.Mui-focused fieldset': { borderColor: '#b98f33' }
                  }
                }}
              />
              
              <FormControl sx={{ flex: 1, minWidth: '300px' }} required>
                <InputLabel>Material Company</InputLabel>
                <Select
                  value={generalExpenseForm.materialCompany}
                  onChange={(e) => handleGeneralExpenseInputChange('materialCompany', e.target.value)}
                  label="Material Company"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: '#8b6b1f' },
                      '&:hover fieldset': { borderColor: '#b98f33' },
                      '&.Mui-focused fieldset': { borderColor: '#b98f33' }
                    }
                  }}
                >
                  {materialCompanies.map((company) => (
                    <MenuItem key={company.id} value={company.name}>
                      {company.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={openAddCompanyDialog}
                sx={{
                  ...buttonStyles.primaryButton,
                  minWidth: '120px',
                  px: 2,
                  py: 1.75,
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                Add New
              </Button>
            </Box>

            {/* Material Code, Quantity, and Price Row */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                label="Material Code"
                value={generalExpenseForm.materialCode}
                onChange={(e) => handleGeneralExpenseInputChange('materialCode', e.target.value)}
                placeholder="Enter material code"
                required
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#8b6b1f' },
                    '&:hover fieldset': { borderColor: '#b98f33' },
                    '&.Mui-focused fieldset': { borderColor: '#b98f33' }
                  }
                }}
              />
              
              <TextField
                label="Quantity"
                type="number"
                value={generalExpenseForm.quantity}
                onChange={(e) => handleGeneralExpenseInputChange('quantity', e.target.value)}
                placeholder="0"
                required
                inputProps={{ min: 0, step: 0.1 }}
                sx={{
                  minWidth: '120px',
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#8b6b1f' },
                    '&:hover fieldset': { borderColor: '#b98f33' },
                    '&.Mui-focused fieldset': { borderColor: '#b98f33' }
                  }
                }}
              />
              
              <TextField
                label="Price"
                type="number"
                value={generalExpenseForm.price}
                onChange={(e) => handleGeneralExpenseInputChange('price', e.target.value)}
                placeholder="0.00"
                required
                inputProps={{ min: 0, step: 0.01 }}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>
                }}
                sx={{
                  minWidth: '150px',
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#8b6b1f' },
                    '&:hover fieldset': { borderColor: '#b98f33' },
                    '&.Mui-focused fieldset': { borderColor: '#b98f33' }
                  }
                }}
              />
            </Box>

            {/* Tax Type and Tax Amount Row */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Tax Type</InputLabel>
                <Select
                  value={generalExpenseForm.taxType}
                  onChange={(e) => handleGeneralExpenseInputChange('taxType', e.target.value)}
                  label="Tax Type"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: '#8b6b1f' },
                      '&:hover fieldset': { borderColor: '#b98f33' },
                      '&.Mui-focused fieldset': { borderColor: '#b98f33' }
                    }
                  }}
                >
                  <MenuItem value="percent">Percentage (%)</MenuItem>
                  <MenuItem value="fixed">Fixed Amount ($)</MenuItem>
                </Select>
              </FormControl>
              
              <TextField
                fullWidth
                label={generalExpenseForm.taxType === 'percent' ? 'Tax Percentage' : 'Tax Amount'}
                type="number"
                value={generalExpenseForm.tax}
                onChange={(e) => handleGeneralExpenseInputChange('tax', e.target.value)}
                placeholder="0"
                required
                inputProps={{ min: 0, step: 0.01 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      {generalExpenseForm.taxType === 'percent' ? '%' : '$'}
                    </InputAdornment>
                  )
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#8b6b1f' },
                    '&:hover fieldset': { borderColor: '#b98f33' },
                    '&.Mui-focused fieldset': { borderColor: '#b98f33' }
                  }
                }}
              />
            </Box>
            
            {/* Total Calculation Display */}
            <Alert severity="info" sx={{ mt: 1 }}>
              <Typography variant="body2">
                <strong>Total: ${generalExpenseForm.total}</strong>
                <br />
                Calculation: (${generalExpenseForm.price || 0} × {generalExpenseForm.quantity || 0}) + Tax
              </Typography>
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 2 }}>
          <Button
            onClick={editingGeneralExpense ? closeEditDialog : closeGeneralExpenseDialog}
            sx={buttonStyles.cancelButton}
          >
            Cancel
          </Button>
          <Button
            onClick={saveGeneralExpense}
            variant="contained"
            disabled={savingGeneralExpense}
            startIcon={savingGeneralExpense ? <CircularProgress size={16} sx={{ color: '#000000' }} /> : <SaveIcon sx={{ color: '#000000' }} />}
            sx={buttonStyles.primaryButton}
          >
            {savingGeneralExpense ? 'Saving...' : (editingGeneralExpense ? 'Update General Expense' : 'Save General Expense')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={closeDeleteDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{
          background: 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <DeleteIcon />
          Delete General Expense
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Are you sure you want to delete this general expense?
          </Typography>
          {expenseToDelete && (
            <Box sx={{ p: 2, backgroundColor: '#f5f5f5', borderRadius: 1, border: '1px solid #ddd' }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                {expenseToDelete.description || `${expenseToDelete.materialCode} - ${expenseToDelete.materialCompany}`}
              </Typography>
              <Typography variant="caption" sx={{ color: '#666' }}>
                {expenseToDelete.materialCompany} • {expenseToDelete.quantity} • ${expenseToDelete.total}
              </Typography>
            </Box>
          )}
          <Alert severity="warning" sx={{ mt: 2 }}>
            This action cannot be undone. The expense will be permanently removed from the system.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 2 }}>
          <Button
            onClick={closeDeleteDialog}
            sx={buttonStyles.cancelButton}
          >
            Cancel
          </Button>
          <Button
            onClick={deleteGeneralExpense}
            variant="contained"
            disabled={updating}
            startIcon={updating ? <CircularProgress size={16} sx={{ color: '#000000' }} /> : <DeleteIcon sx={{ color: '#000000' }} />}
            sx={{
              backgroundColor: '#f44336',
              '&:hover': {
                backgroundColor: '#d32f2f'
              },
              '&:disabled': {
                backgroundColor: '#a0a0a0'
              }
            }}
          >
            {updating ? 'Deleting...' : 'Delete Expense'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add New Company Dialog */}
      <Dialog open={addCompanyDialogOpen} onClose={closeAddCompanyDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{
          background: 'linear-gradient(135deg, #f27921 0%, #e67e22 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <AddIcon />
          Add New Material Company
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              fullWidth
              label="Company Name"
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
              placeholder="Enter company name"
              required
              autoFocus
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: '#8b6b1f' },
                  '&:hover fieldset': { borderColor: '#b98f33' },
                  '&.Mui-focused fieldset': { borderColor: '#b98f33' }
                }
              }}
            />
            <Alert severity="info">
              <Typography variant="body2">
                This company will be added to the material companies database and will be available for all future expenses.
              </Typography>
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 2 }}>
          <Button
            onClick={closeAddCompanyDialog}
            sx={buttonStyles.cancelButton}
          >
            Cancel
          </Button>
          <Button
            onClick={saveNewCompany}
            variant="contained"
            disabled={savingCompany || !newCompanyName.trim()}
            startIcon={savingCompany ? <CircularProgress size={16} sx={{ color: '#000000' }} /> : <SaveIcon sx={{ color: '#000000' }} />}
            sx={buttonStyles.primaryButton}
          >
            {savingCompany ? 'Adding...' : 'Add Company'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MaterialRequestPage;
