import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from 'react';
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
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  IconButton
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Business as BusinessIcon,
  Inventory as InventoryIcon,
  LocalShipping as LocalShippingIcon,
  CheckCircle as CheckCircleIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Add as AddIcon,
  Save as SaveIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { collection, getDocs, updateDoc, doc, query, orderBy, getDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useNotification } from '../../../shared/components/Common/NotificationSystem';
import { buttonStyles } from '../../../styles/buttonStyles';

const MaterialTrackPage = () => {
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Data State
  const [materialsToOrder, setMaterialsToOrder] = useState([]);
  const [materialsWaiting, setMaterialsWaiting] = useState([]);
  const [materialsReceived, setMaterialsReceived] = useState([]);
  const [materialCompanies, setMaterialCompanies] = useState([]);
  // Tracks which company groups are collapsed, keyed by `${columnType}::${company}`
  // so the same company can be collapsed in one column independently of the others.
  const [collapsedCompanies, setCollapsedCompanies] = useState(new Set());

  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteForm, setNoteForm] = useState({ item: null, text: '' });
  const [savingNote, setSavingNote] = useState(false);

  // General Expenses (manually-entered materials not tied to any order) state
  const [generalExpenseDialogOpen, setGeneralExpenseDialogOpen] = useState(false);
  const [generalExpenseForm, setGeneralExpenseForm] = useState({
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
  const [savingGeneralExpense, setSavingGeneralExpense] = useState(false);
  const [editingGeneralExpense, setEditingGeneralExpense] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [addCompanyDialogOpen, setAddCompanyDialogOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [savingCompany, setSavingCompany] = useState(false);

  const { showSuccess, showError } = useNotification();

  const toggleCompanyCollapse = (columnType, company) => {
    const key = `${columnType}::${company}`;
    setCollapsedCompanies(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Scroll Refs
  const toOrderScrollRef = useRef(null);
  const waitingScrollRef = useRef(null);
  const receivedScrollRef = useRef(null);
  const pendingScrollPositions = useRef(null);

  const fetchMaterials = useCallback(async () => {
    try {
      setLoading(true);
      const [ordersSnap, corporateOrdersSnap, companiesSnap, generalExpensesSnap] = await Promise.all([
        getDocs(collection(db, 'orders')),
        getDocs(collection(db, 'corporate-orders')),
        getDocs(query(collection(db, 'materialCompanies'), orderBy('createdAt', 'asc'))),
        getDocs(query(collection(db, 'generalExpenses'), orderBy('createdAt', 'desc')))
      ]);
      
      const ordersList = [
        ...ordersSnap.docs.map(d => ({ id: d.id, ...d.data(), orderType: 'regular' })),
        ...corporateOrdersSnap.docs.map(d => ({ id: d.id, ...d.data(), orderType: 'corporate' }))
      ];

      const companiesData = companiesSnap.docs.map((d, index) => ({
        id: d.id,
        order: d.data().order ?? index,
        ...d.data()
      })).sort((a, b) => a.order - b.order);
      setMaterialCompanies(companiesData);

      // Extract & Merge
      // Group by invoice + code + company
      const mergeMap = new Map();

      ordersList.forEach(order => {
        const status = order.orderStatus || order.status || order.invoiceStatus || '';
        const sLower = status.toLowerCase();
        if (['done', 'cancelled', 'canceled', 'completed', 'finished'].includes(sLower)) {
          return;
        }

        const groups = order.orderType === 'corporate' 
          ? (order.furnitureGroups || [])
          : (order.furnitureData?.groups || []);

        groups.forEach((group, idx) => {
          if (!group.materialCode || !group.materialCompany) return;
          const jlQty = Number(group.materialJLQnty) || 0;
          if (jlQty <= 0) return;

          const invoice = order.orderDetails?.billInvoice || 'N/A';
          const mergeKey = `${order.id}_${group.materialCompany}_${group.materialCode}`;

          if (!mergeMap.has(mergeKey)) {
            mergeMap.set(mergeKey, {
              key: mergeKey,
              orderId: order.id,
              orderType: order.orderType,
              invoiceNo: invoice,
              materialCompany: group.materialCompany,
              materialCode: group.materialCode,
              materialName: group.materialName || group.materialCode,
              customerName: order.orderType === 'corporate' 
                ? (order.corporateCustomer?.corporateName || 'N/A')
                : (order.personalInfo?.customerName || 'N/A'),
              totalQty: 0,
              totalOrdered: 0,
              totalReceived: 0,
              unit: group.unit || 'Yard',
              trackNote: group.trackNote || ''
            });
          }
          
          const row = mergeMap.get(mergeKey);
          if (!row.trackNote && group.trackNote) {
            row.trackNote = group.trackNote;
          }
          row.totalQty += jlQty;
          row.totalOrdered += (Number(group.ordered) || 0);
          row.totalReceived += (Number(group.received) || 0);
        });
      });

      const toOrder = [];
      const waiting = [];
      const received = [];

      Array.from(mergeMap.values()).forEach(row => {
        row.pendingToOrder = row.totalQty - row.totalOrdered;
        row.waitingToReceive = row.totalOrdered - row.totalReceived;
        row.alreadyReceived = row.totalReceived;

        if (row.pendingToOrder > 0) toOrder.push({ ...row, column: 'ToOrder' });
        if (row.waitingToReceive > 0) waiting.push({ ...row, column: 'Waiting' });
        if (row.alreadyReceived > 0) received.push({ ...row, column: 'Received' });
      });

      // General expenses: manually-entered materials, not tied to any order. Each doc is
      // already its own unique trackable record (no merging across duplicates needed).
      generalExpensesSnap.docs.forEach(d => {
        const expense = { id: d.id, ...d.data() };
        if (!expense.materialCode || !expense.materialCompany) return;
        const totalQty = Number(expense.quantity) || 0;
        if (totalQty <= 0) return;

        const totalOrdered = Number(expense.ordered) || 0;
        const totalReceived = Number(expense.received) || 0;
        const row = {
          key: `general_${expense.id}`,
          orderType: 'general',
          isGeneralExpense: true,
          expenseId: expense.id,
          rawExpense: expense,
          invoiceNo: 'GENERAL',
          materialCompany: expense.materialCompany,
          materialCode: expense.materialCode,
          materialName: expense.materialCode,
          customerName: expense.description || 'General Expense',
          unit: '',
          trackNote: expense.trackNote || '',
          totalQty,
          totalOrdered,
          totalReceived,
          pendingToOrder: totalQty - totalOrdered,
          waitingToReceive: totalOrdered - totalReceived,
          alreadyReceived: totalReceived
        };

        if (row.pendingToOrder > 0) toOrder.push({ ...row, column: 'ToOrder' });
        if (row.waitingToReceive > 0) waiting.push({ ...row, column: 'Waiting' });
        if (row.alreadyReceived > 0) received.push({ ...row, column: 'Received' });
      });

      setMaterialsToOrder(toOrder);
      setMaterialsWaiting(waiting);
      setMaterialsReceived(received);
    } catch (error) {
      console.error('Error fetching material track data:', error);
      showError('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  // Intentionally run once on mount only — do not re-fetch (and reset scroll/local
  // state) just because fetchMaterials' identity changes from an unrelated re-render.
  useEffect(() => {
    fetchMaterials();
  }, []);

  // Restore scroll positions synchronously to prevent jumping
  useLayoutEffect(() => {
    if (pendingScrollPositions.current) {
      if (toOrderScrollRef.current && pendingScrollPositions.current.toOrder !== undefined) {
        toOrderScrollRef.current.scrollTop = pendingScrollPositions.current.toOrder;
      }
      if (waitingScrollRef.current && pendingScrollPositions.current.waiting !== undefined) {
        waitingScrollRef.current.scrollTop = pendingScrollPositions.current.waiting;
      }
      if (receivedScrollRef.current && pendingScrollPositions.current.received !== undefined) {
        receivedScrollRef.current.scrollTop = pendingScrollPositions.current.received;
      }
      pendingScrollPositions.current = null;
    }
  }, [materialsToOrder, materialsWaiting, materialsReceived]);

  const markOrdered = async (mergeKeyObj) => {
    if (mergeKeyObj.orderType === 'general') return markOrderedGeneral(mergeKeyObj);
    try {
      setUpdating(true);
      pendingScrollPositions.current = {
        toOrder: toOrderScrollRef.current?.scrollTop || 0,
        waiting: waitingScrollRef.current?.scrollTop || 0,
        received: receivedScrollRef.current?.scrollTop || 0
      };

      const { orderId, orderType, materialCompany, materialCode } = mergeKeyObj;
      const collectionName = orderType === 'corporate' ? 'corporate-orders' : 'orders';
      const orderRef = doc(db, collectionName, orderId);
      const orderDoc = await getDoc(orderRef);
      if (!orderDoc.exists()) {
        showError('Order not found');
        return;
      }

      const orderData = orderDoc.data();
      const groups = orderType === 'corporate' ? (orderData.furnitureGroups || []) : (orderData.furnitureData?.groups || []);
      let hasChanges = false;
      const updatedGroups = [...groups];

      groups.forEach((group, idx) => {
        if (group.materialCompany === materialCompany && group.materialCode === materialCode) {
          const qty = Number(group.materialJLQnty) || 0;
          if (qty > 0 && (Number(group.ordered) || 0) !== qty) {
            updatedGroups[idx] = { ...updatedGroups[idx], ordered: qty };
            hasChanges = true;
          }
        }
      });

      if (hasChanges) {
        const updateData = orderType === 'corporate' 
          ? { furnitureGroups: updatedGroups }
          : { 'furnitureData.groups': updatedGroups };
        await updateDoc(orderRef, updateData);
        showSuccess('Marked as ordered');
        
        // Recompute local state for this merge key
        recomputeMergeKey(updatedGroups, mergeKeyObj);
      }
    } catch (e) {
      console.error(e);
      showError('Failed to mark ordered');
    } finally {
      setUpdating(false);
    }
  };

  const markReceived = async (mergeKeyObj) => {
    if (mergeKeyObj.orderType === 'general') return markReceivedGeneral(mergeKeyObj);
    try {
      setUpdating(true);
      pendingScrollPositions.current = {
        toOrder: toOrderScrollRef.current?.scrollTop || 0,
        waiting: waitingScrollRef.current?.scrollTop || 0,
        received: receivedScrollRef.current?.scrollTop || 0
      };

      const { orderId, orderType, materialCompany, materialCode } = mergeKeyObj;
      const collectionName = orderType === 'corporate' ? 'corporate-orders' : 'orders';
      const orderRef = doc(db, collectionName, orderId);
      const orderDoc = await getDoc(orderRef);
      if (!orderDoc.exists()) {
        showError('Order not found');
        return;
      }

      const orderData = orderDoc.data();
      const groups = orderType === 'corporate' ? (orderData.furnitureGroups || []) : (orderData.furnitureData?.groups || []);
      let hasChanges = false;
      const updatedGroups = [...groups];

      groups.forEach((group, idx) => {
        if (group.materialCompany === materialCompany && group.materialCode === materialCode) {
          const orderedQty = Number(group.ordered) || 0;
          if (orderedQty > 0 && (Number(group.received) || 0) !== orderedQty) {
            updatedGroups[idx] = { ...updatedGroups[idx], received: orderedQty };
            hasChanges = true;
          }
        }
      });

      if (hasChanges) {
        const updateData = orderType === 'corporate' 
          ? { furnitureGroups: updatedGroups }
          : { 'furnitureData.groups': updatedGroups };
        await updateDoc(orderRef, updateData);
        showSuccess('Marked as received');
        
        // Recompute local state for this merge key
        recomputeMergeKey(updatedGroups, mergeKeyObj);
      }
    } catch (e) {
      console.error(e);
      showError('Failed to mark received');
    } finally {
      setUpdating(false);
    }
  };

  const undoOrder = async (mergeKeyObj) => {
    if (mergeKeyObj.orderType === 'general') return undoOrderGeneral(mergeKeyObj);
    try {
      setUpdating(true);
      pendingScrollPositions.current = {
        toOrder: toOrderScrollRef.current?.scrollTop || 0,
        waiting: waitingScrollRef.current?.scrollTop || 0,
        received: receivedScrollRef.current?.scrollTop || 0
      };

      const { orderId, orderType, materialCompany, materialCode } = mergeKeyObj;
      const collectionName = orderType === 'corporate' ? 'corporate-orders' : 'orders';
      const orderRef = doc(db, collectionName, orderId);
      const orderDoc = await getDoc(orderRef);
      if (!orderDoc.exists()) {
        showError('Order not found');
        return;
      }

      const orderData = orderDoc.data();
      const groups = orderType === 'corporate' ? (orderData.furnitureGroups || []) : (orderData.furnitureData?.groups || []);
      let hasChanges = false;
      const updatedGroups = [...groups];

      groups.forEach((group, idx) => {
        if (group.materialCompany === materialCompany && group.materialCode === materialCode) {
          const orderedQty = Number(group.ordered) || 0;
          const receivedQty = Number(group.received) || 0;
          if (orderedQty > receivedQty) {
            updatedGroups[idx] = { ...updatedGroups[idx], ordered: receivedQty };
            hasChanges = true;
          }
        }
      });

      if (hasChanges) {
        const updateData = orderType === 'corporate' 
          ? { furnitureGroups: updatedGroups }
          : { 'furnitureData.groups': updatedGroups };
        await updateDoc(orderRef, updateData);
        showSuccess('Order mark reverted');
        recomputeMergeKey(updatedGroups, mergeKeyObj);
      }
    } catch (e) {
      console.error(e);
      showError('Failed to revert order mark');
    } finally {
      setUpdating(false);
    }
  };

  const undoReceive = async (mergeKeyObj) => {
    if (mergeKeyObj.orderType === 'general') return undoReceiveGeneral(mergeKeyObj);
    try {
      setUpdating(true);
      pendingScrollPositions.current = {
        toOrder: toOrderScrollRef.current?.scrollTop || 0,
        waiting: waitingScrollRef.current?.scrollTop || 0,
        received: receivedScrollRef.current?.scrollTop || 0
      };

      const { orderId, orderType, materialCompany, materialCode } = mergeKeyObj;
      const collectionName = orderType === 'corporate' ? 'corporate-orders' : 'orders';
      const orderRef = doc(db, collectionName, orderId);
      const orderDoc = await getDoc(orderRef);
      if (!orderDoc.exists()) {
        showError('Order not found');
        return;
      }

      const orderData = orderDoc.data();
      const groups = orderType === 'corporate' ? (orderData.furnitureGroups || []) : (orderData.furnitureData?.groups || []);
      let hasChanges = false;
      const updatedGroups = [...groups];

      groups.forEach((group, idx) => {
        if (group.materialCompany === materialCompany && group.materialCode === materialCode) {
          const receivedQty = Number(group.received) || 0;
          if (receivedQty > 0) {
            updatedGroups[idx] = { ...updatedGroups[idx], received: 0 };
            hasChanges = true;
          }
        }
      });

      if (hasChanges) {
        const updateData = orderType === 'corporate' 
          ? { furnitureGroups: updatedGroups }
          : { 'furnitureData.groups': updatedGroups };
        await updateDoc(orderRef, updateData);
        showSuccess('Receive mark reverted');
        recomputeMergeKey(updatedGroups, mergeKeyObj);
      }
    } catch (e) {
      console.error(e);
      showError('Failed to revert receive mark');
    } finally {
      setUpdating(false);
    }
  };

  const recomputeMergeKey = (latestGroups, mergeKeyObj) => {
    let newTotalQty = 0;
    let newTotalOrdered = 0;
    let newTotalReceived = 0;
    let newTrackNote = mergeKeyObj.trackNote;

    latestGroups.forEach(group => {
      if (group.materialCompany === mergeKeyObj.materialCompany && group.materialCode === mergeKeyObj.materialCode) {
        if (group.trackNote !== undefined) newTrackNote = group.trackNote;
        const jlQty = Number(group.materialJLQnty) || 0;
        if (jlQty > 0) {
          newTotalQty += jlQty;
          newTotalOrdered += (Number(group.ordered) || 0);
          newTotalReceived += (Number(group.received) || 0);
        }
      }
    });

    const pendingToOrder = newTotalQty - newTotalOrdered;
    const waitingToReceive = newTotalOrdered - newTotalReceived;
    const alreadyReceived = newTotalReceived;

    const baseObj = {
      ...mergeKeyObj,
      totalQty: newTotalQty,
      totalOrdered: newTotalOrdered,
      totalReceived: newTotalReceived,
      pendingToOrder,
      waitingToReceive,
      alreadyReceived,
      trackNote: newTrackNote
    };

    // Update To Order List
    setMaterialsToOrder(prev => {
      const filtered = prev.filter(m => m.key !== mergeKeyObj.key);
      if (pendingToOrder > 0) return [...filtered, { ...baseObj, column: 'ToOrder' }];
      return filtered;
    });

    // Update Waiting List
    setMaterialsWaiting(prev => {
      const filtered = prev.filter(m => m.key !== mergeKeyObj.key);
      if (waitingToReceive > 0) return [...filtered, { ...baseObj, column: 'Waiting' }];
      return filtered;
    });

    // Update Received List
    setMaterialsReceived(prev => {
      const filtered = prev.filter(m => m.key !== mergeKeyObj.key);
      if (alreadyReceived > 0) return [...filtered, { ...baseObj, column: 'Received' }];
      return filtered;
    });
  };

  // Recompute a general expense row's three derived quantities from the live doc and
  // patch local state in place — mirrors recomputeMergeKey but sourced from a single doc.
  const recomputeGeneralExpenseRow = (latestExpenseData, mergeKeyObj) => {
    const totalQty = Number(latestExpenseData.quantity) || 0;
    const totalOrdered = Number(latestExpenseData.ordered) || 0;
    const totalReceived = Number(latestExpenseData.received) || 0;

    const pendingToOrder = totalQty - totalOrdered;
    const waitingToReceive = totalOrdered - totalReceived;
    const alreadyReceived = totalReceived;

    const baseObj = {
      ...mergeKeyObj,
      rawExpense: latestExpenseData,
      totalQty,
      totalOrdered,
      totalReceived,
      pendingToOrder,
      waitingToReceive,
      alreadyReceived,
      trackNote: latestExpenseData.trackNote || ''
    };

    setMaterialsToOrder(prev => {
      const filtered = prev.filter(m => m.key !== mergeKeyObj.key);
      if (pendingToOrder > 0) return [...filtered, { ...baseObj, column: 'ToOrder' }];
      return filtered;
    });
    setMaterialsWaiting(prev => {
      const filtered = prev.filter(m => m.key !== mergeKeyObj.key);
      if (waitingToReceive > 0) return [...filtered, { ...baseObj, column: 'Waiting' }];
      return filtered;
    });
    setMaterialsReceived(prev => {
      const filtered = prev.filter(m => m.key !== mergeKeyObj.key);
      if (alreadyReceived > 0) return [...filtered, { ...baseObj, column: 'Received' }];
      return filtered;
    });
  };

  const markOrderedGeneral = async (item) => {
    try {
      setUpdating(true);
      pendingScrollPositions.current = {
        toOrder: toOrderScrollRef.current?.scrollTop || 0,
        waiting: waitingScrollRef.current?.scrollTop || 0,
        received: receivedScrollRef.current?.scrollTop || 0
      };

      const ref = doc(db, 'generalExpenses', item.expenseId);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        showError('Expense not found');
        return;
      }
      const live = snap.data();
      const qty = Number(live.quantity) || 0;
      if (qty <= 0 || (Number(live.ordered) || 0) === qty) return;

      await updateDoc(ref, { ordered: qty });
      showSuccess('Marked as ordered');
      recomputeGeneralExpenseRow({ ...live, ordered: qty }, item);
    } catch (e) {
      console.error(e);
      showError('Failed to mark ordered');
    } finally {
      setUpdating(false);
    }
  };

  const markReceivedGeneral = async (item) => {
    try {
      setUpdating(true);
      pendingScrollPositions.current = {
        toOrder: toOrderScrollRef.current?.scrollTop || 0,
        waiting: waitingScrollRef.current?.scrollTop || 0,
        received: receivedScrollRef.current?.scrollTop || 0
      };

      const ref = doc(db, 'generalExpenses', item.expenseId);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        showError('Expense not found');
        return;
      }
      const live = snap.data();
      const orderedQty = Number(live.ordered) || 0;
      if (orderedQty <= 0 || (Number(live.received) || 0) === orderedQty) return;

      await updateDoc(ref, { received: orderedQty });
      showSuccess('Marked as received');
      recomputeGeneralExpenseRow({ ...live, received: orderedQty }, item);
    } catch (e) {
      console.error(e);
      showError('Failed to mark received');
    } finally {
      setUpdating(false);
    }
  };

  const undoOrderGeneral = async (item) => {
    try {
      setUpdating(true);
      pendingScrollPositions.current = {
        toOrder: toOrderScrollRef.current?.scrollTop || 0,
        waiting: waitingScrollRef.current?.scrollTop || 0,
        received: receivedScrollRef.current?.scrollTop || 0
      };

      const ref = doc(db, 'generalExpenses', item.expenseId);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        showError('Expense not found');
        return;
      }
      const live = snap.data();
      const orderedQty = Number(live.ordered) || 0;
      const receivedQty = Number(live.received) || 0;
      if (orderedQty <= receivedQty) return;

      await updateDoc(ref, { ordered: receivedQty });
      showSuccess('Order mark reverted');
      recomputeGeneralExpenseRow({ ...live, ordered: receivedQty }, item);
    } catch (e) {
      console.error(e);
      showError('Failed to revert order mark');
    } finally {
      setUpdating(false);
    }
  };

  const undoReceiveGeneral = async (item) => {
    try {
      setUpdating(true);
      pendingScrollPositions.current = {
        toOrder: toOrderScrollRef.current?.scrollTop || 0,
        waiting: waitingScrollRef.current?.scrollTop || 0,
        received: receivedScrollRef.current?.scrollTop || 0
      };

      const ref = doc(db, 'generalExpenses', item.expenseId);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        showError('Expense not found');
        return;
      }
      const live = snap.data();
      const receivedQty = Number(live.received) || 0;
      if (receivedQty <= 0) return;

      await updateDoc(ref, { received: 0 });
      showSuccess('Receive mark reverted');
      recomputeGeneralExpenseRow({ ...live, received: 0 }, item);
    } catch (e) {
      console.error(e);
      showError('Failed to revert receive mark');
    } finally {
      setUpdating(false);
    }
  };

  const openNoteDialog = (item) => {
    setNoteForm({ item, text: item.trackNote || '' });
    setNoteDialogOpen(true);
  };

  const closeNoteDialog = () => {
    setNoteDialogOpen(false);
    setNoteForm({ item: null, text: '' });
  };

  const saveNote = async () => {
    if (!noteForm.item) return;
    try {
      setSavingNote(true);
      const { item, text } = noteForm;
      if (item.orderType === 'general') {
        const ref = doc(db, 'generalExpenses', item.expenseId);
        await updateDoc(ref, { trackNote: text });
        recomputeGeneralExpenseRow({ ...item.rawExpense, trackNote: text }, item);
      } else {
        const collectionName = item.orderType === 'corporate' ? 'corporate-orders' : 'orders';
        const orderRef = doc(db, collectionName, item.orderId);
        const orderDoc = await getDoc(orderRef);
        if (!orderDoc.exists()) return;

        const orderData = orderDoc.data();
        const groups = item.orderType === 'corporate' ? (orderData.furnitureGroups || []) : (orderData.furnitureData?.groups || []);
        let hasChanges = false;
        const updatedGroups = [...groups];

        groups.forEach((group, idx) => {
          if (group.materialCompany === item.materialCompany && group.materialCode === item.materialCode) {
            updatedGroups[idx] = { ...updatedGroups[idx], trackNote: text };
            hasChanges = true;
          }
        });

        if (hasChanges) {
          const updateData = item.orderType === 'corporate' 
            ? { furnitureGroups: updatedGroups }
            : { 'furnitureData.groups': updatedGroups };
          await updateDoc(orderRef, updateData);
          recomputeMergeKey(updatedGroups, { ...item, trackNote: text });
        }
      }
      showSuccess('Note saved successfully');
      closeNoteDialog();
    } catch (e) {
      console.error(e);
      showError('Failed to save note');
    } finally {
      setSavingNote(false);
    }
  };

  // General Expenses CRUD (add/edit/delete a manually-entered material expense)
  const openGeneralExpenseDialog = () => {
    setEditingGeneralExpense(null);
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
  };

  const closeEditDialog = () => {
    setEditingGeneralExpense(null);
    setGeneralExpenseDialogOpen(false);
  };

  const handleGeneralExpenseInputChange = (field, value) => {
    const newForm = { ...generalExpenseForm, [field]: value };

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
        type: 'general'
      };

      if (editingGeneralExpense) {
        const expenseRef = doc(db, 'generalExpenses', editingGeneralExpense.id);
        await updateDoc(expenseRef, {
          ...generalExpenseData,
          updatedAt: new Date()
        });
        showSuccess('General expense updated successfully');
      } else {
        await addDoc(collection(db, 'generalExpenses'), {
          ...generalExpenseData,
          createdAt: new Date()
        });
        showSuccess('General expense added successfully');
      }

      setGeneralExpenseDialogOpen(false);
      setEditingGeneralExpense(null);
      fetchMaterials();
    } catch (error) {
      console.error('Error saving general expense:', error);
      showError('Failed to save general expense');
    } finally {
      setSavingGeneralExpense(false);
    }
  };

  const openEditGeneralExpenseDialog = (item) => {
    const expense = item.rawExpense || {};
    setEditingGeneralExpense({ id: item.expenseId, ...expense });
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

  const openDeleteDialog = (item) => {
    setExpenseToDelete({ id: item.expenseId, ...(item.rawExpense || {}) });
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
      await deleteDoc(doc(db, 'generalExpenses', expenseToDelete.id));
      showSuccess('General expense deleted successfully');
      closeDeleteDialog();
      fetchMaterials();
    } catch (error) {
      console.error('Error deleting general expense:', error);
      showError('Failed to delete general expense');
    } finally {
      setUpdating(false);
    }
  };

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

    const existingCompany = materialCompanies.find(company =>
      company.name.toLowerCase() === newCompanyName.trim().toLowerCase()
    );
    if (existingCompany) {
      showError('A company with this name already exists');
      return;
    }

    setSavingCompany(true);
    try {
      const maxOrder = materialCompanies.reduce((max, company) => Math.max(max, company.order || 0), 0);
      const newCompanyData = {
        name: newCompanyName.trim(),
        order: maxOrder + 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, 'materialCompanies'), newCompanyData);
      const newCompany = { id: docRef.id, ...newCompanyData, createdAt: new Date(), updatedAt: new Date() };

      setMaterialCompanies(prev => [...prev, newCompany].sort((a, b) => a.order - b.order));
      setGeneralExpenseForm(prev => ({ ...prev, materialCompany: newCompany.name }));

      showSuccess('New material company added successfully');
      closeAddCompanyDialog();
    } catch (error) {
      console.error('Error saving new company:', error);
      showError('Failed to save new company');
    } finally {
      setSavingCompany(false);
    }
  };

  const applySearch = (list) => {
    if (!searchTerm.trim()) return list;
    const s = searchTerm.toLowerCase();
    return list.filter(m => 
      m.invoiceNo.toLowerCase().includes(s) ||
      m.materialCode.toLowerCase().includes(s) ||
      m.materialName.toLowerCase().includes(s) ||
      m.materialCompany.toLowerCase().includes(s) ||
      m.customerName.toLowerCase().includes(s)
    );
  };

  const groupAndSort = (list) => {
    const grouped = {};
    list.forEach(m => {
      if (!grouped[m.materialCompany]) grouped[m.materialCompany] = [];
      grouped[m.materialCompany].push(m);
    });

    Object.keys(grouped).forEach(comp => {
      grouped[comp].sort((a, b) => a.materialCode.toLowerCase().localeCompare(b.materialCode.toLowerCase()));
    });

    const sortedEntries = Object.entries(grouped).sort(([compA], [compB]) => {
      const a = materialCompanies.find(c => c.name === compA);
      const b = materialCompanies.find(c => c.name === compB);
      if (a && b) return a.order - b.order;
      if (a && !b) return -1;
      if (!a && b) return 1;
      return compA.toLowerCase().localeCompare(compB.toLowerCase());
    });
    return Object.fromEntries(sortedEntries);
  };

  const toOrderGrouped = useMemo(() => groupAndSort(applySearch(materialsToOrder)), [materialsToOrder, searchTerm, materialCompanies]);
  const waitingGrouped = useMemo(() => groupAndSort(applySearch(materialsWaiting)), [materialsWaiting, searchTerm, materialCompanies]);
  const receivedGrouped = useMemo(() => groupAndSort(applySearch(materialsReceived)), [materialsReceived, searchTerm, materialCompanies]);

  const renderColumn = (title, groupedData, icon, scrollRef, columnType) => (
    <Paper ref={scrollRef} sx={{ 
      flex: 1, 
      height: '100%', 
      overflow: 'auto',
      borderRight: columnType !== 'Received' ? '2px solid #e0e0e0' : 'none',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <Box sx={{ p: 2, borderBottom: '2px solid #e0e0e0' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {icon}
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
            {title} ({Object.values(groupedData).flat().length})
          </Typography>
        </Box>
      </Box>
      <Box sx={{ flex: 1, p: 2 }}>
        {Object.keys(groupedData).length === 0 ? (
          <Typography variant="body1" color="text.secondary" textAlign="center" mt={4}>
            {searchTerm ? 'No results' : 'Empty'}
          </Typography>
        ) : (
          Object.entries(groupedData).map(([company, items]) => {
            const isCollapsed = collapsedCompanies.has(`${columnType}::${company}`);
            return (
            <Box key={company} sx={{ mb: 3 }}>
              <Box
                onClick={() => toggleCompanyCollapse(columnType, company)}
                sx={{
                  display: 'flex', alignItems: 'center', mb: 1, p: 1,
                  backgroundColor: 'rgba(185, 143, 51, 0.1)', borderRadius: 1,
                  border: '1px solid rgba(185, 143, 51, 0.3)',
                  cursor: 'pointer',
                  userSelect: 'none',
                  '&:hover': { backgroundColor: 'rgba(185, 143, 51, 0.18)' }
                }}
              >
                <BusinessIcon sx={{ mr: 1, color: '#b98f33', fontSize: 18 }} />
                <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                  {company}
                </Typography>
                <Chip label={items.length} size="small" sx={{ ml: 'auto', mr: 1, backgroundColor: '#b98f33', color: 'white', fontSize: '0.7rem' }} />
                {isCollapsed
                  ? <ExpandMoreIcon sx={{ color: '#b98f33', fontSize: 20 }} />
                  : <ExpandLessIcon sx={{ color: '#b98f33', fontSize: 20 }} />}
              </Box>

              <Collapse in={!isCollapsed} timeout="auto" unmountOnExit>
              {items.map(item => {
                const qtyToShow = columnType === 'ToOrder' ? item.pendingToOrder : 
                                  columnType === 'Waiting' ? item.waitingToReceive : 
                                  item.alreadyReceived;
                const isExtra = columnType === 'ToOrder' && item.totalOrdered > 0;

                return (
                  <Card key={item.key} sx={{ 
                    mb: 1.5,
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #333',
                    color: '#e0e0e0',
                    '&:hover': {
                      backgroundColor: '#252525',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                      borderColor: '#b98f33'
                    },
                    transition: 'all 0.3s ease'
                  }}>
                    <CardContent sx={{ p: '12px !important' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#b98f33', lineHeight: 1.2 }}>
                          {item.materialCode}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="subtitle2" sx={{ color: '#b98f33', fontWeight: 'bold' }}>
                            {qtyToShow}{item.unit ? ` ${item.unit}` : ''}
                          </Typography>
                          {item.isGeneralExpense && (
                            <>
                              <IconButton
                                size="small"
                                onClick={() => openEditGeneralExpenseDialog(item)}
                                sx={{ color: '#2196f3', p: '4px' }}
                              >
                                <EditIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => openDeleteDialog(item)}
                                sx={{ color: '#f44336', p: '4px' }}
                              >
                                <DeleteIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </>
                          )}
                        </Box>
                      </Box>

                      {isExtra && (
                        <Box sx={{ mb: 1 }}>
                          <Chip 
                            label="Extra" 
                            size="small" 
                            sx={{ backgroundColor: '#ff9800', color: 'white', fontWeight: 'bold', height: 20, fontSize: '0.7rem', mr: 1 }}
                          />
                          <Typography variant="caption" sx={{ color: '#ff9800' }}>
                            Originally ordered {item.totalOrdered} → now need {item.totalQty} (+{item.pendingToOrder})
                          </Typography>
                        </Box>
                      )}

                      <Grid container spacing={1} sx={{ mb: 1 }}>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary" display="block">Invoice</Typography>
                          <Typography variant="body2">{item.invoiceNo}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary" display="block">Customer</Typography>
                          <Typography variant="body2" noWrap title={item.customerName}>{item.customerName}</Typography>
                        </Grid>
                      </Grid>

                      <Box sx={{ mb: columnType !== 'Received' ? 1.5 : 0, p: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <Box sx={{ flex: 1, mr: 1, overflow: 'hidden' }}>
                          <Typography variant="caption" color="text.secondary" display="block">Note</Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: item.trackNote ? '#e0e0e0' : '#777', fontStyle: item.trackNote ? 'normal' : 'italic', wordBreak: 'break-word' }}>
                            {item.trackNote || 'No note added'}
                          </Typography>
                        </Box>
                        <IconButton size="small" onClick={() => openNoteDialog(item)} sx={{ color: '#b98f33', mt: 0.5 }}>
                          <EditIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Box>

                      {columnType === 'ToOrder' && (
                        <Button
                          fullWidth
                          variant="contained"
                          size="small"
                          disabled={updating}
                          onClick={() => markOrdered(item)}
                          startIcon={<LocalShippingIcon />}
                          sx={{ ...buttonStyles.primaryButton, mt: 1 }}
                        >
                          {isExtra ? 'Order Extra' : 'Order'}
                        </Button>
                      )}

                      {columnType === 'Waiting' && (
                        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                          <Button
                            variant="outlined"
                            size="small"
                            disabled={updating}
                            onClick={() => undoOrder(item)}
                            sx={{ color: '#f44336', borderColor: '#f44336', minWidth: 'auto', p: '4px 8px' }}
                            title="Undo Order"
                          >
                            Undo
                          </Button>
                          <Button
                            fullWidth
                            variant="contained"
                            size="small"
                            disabled={updating}
                            onClick={() => markReceived(item)}
                            startIcon={<CheckCircleIcon />}
                            sx={{ 
                              ...buttonStyles.primaryButton, 
                              backgroundColor: '#4caf50',
                              '&:hover': { backgroundColor: '#3d8b40' } 
                            }}
                          >
                            Received
                          </Button>
                        </Box>
                      )}

                      {columnType === 'Received' && (
                        <Button
                          fullWidth
                          variant="outlined"
                          size="small"
                          disabled={updating}
                          onClick={() => undoReceive(item)}
                          sx={{ mt: 1, color: '#ff9800', borderColor: '#ff9800', p: '4px 8px' }}
                        >
                          Undo Receive
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              </Collapse>
            </Box>
            );
          })
        )}
      </Box>
    </Paper>
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: '2px solid #e0e0e0' }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 2 }}>
          Material Track
        </Typography>
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
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, backgroundColor: 'background.paper' } }}
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openGeneralExpenseDialog}
            sx={{
              ...buttonStyles.primaryButton,
              backgroundColor: '#f27921',
              '&:hover': { backgroundColor: '#e67e22' }
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

      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {renderColumn('To Order', toOrderGrouped, <InventoryIcon sx={{ mr: 1, color: '#b98f33' }} />, toOrderScrollRef, 'ToOrder')}
        {renderColumn('Waiting to Receive', waitingGrouped, <LocalShippingIcon sx={{ mr: 1, color: '#b98f33' }} />, waitingScrollRef, 'Waiting')}
        {renderColumn('Received', receivedGrouped, <CheckCircleIcon sx={{ mr: 1, color: '#b98f33' }} />, receivedScrollRef, 'Received')}
      </Box>

      {/* General Expenses Add/Edit Dialog */}
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
            <TextField
              fullWidth
              label="Description"
              value={generalExpenseForm.description}
              onChange={(e) => handleGeneralExpenseInputChange('description', e.target.value)}
              placeholder="Enter expense description (optional)"
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Date"
                type="date"
                value={generalExpenseForm.date}
                onChange={(e) => handleGeneralExpenseInputChange('date', e.target.value)}
                InputLabelProps={{ shrink: true }}
                required
                sx={{ minWidth: '180px' }}
              />

              <FormControl sx={{ flex: 1, minWidth: '300px' }} required>
                <InputLabel>Material Company</InputLabel>
                <Select
                  value={generalExpenseForm.materialCompany}
                  onChange={(e) => handleGeneralExpenseInputChange('materialCompany', e.target.value)}
                  label="Material Company"
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
                sx={{ ...buttonStyles.primaryButton, minWidth: '120px', px: 2, py: 1.75, whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                Add New
              </Button>
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                label="Material Code"
                value={generalExpenseForm.materialCode}
                onChange={(e) => handleGeneralExpenseInputChange('materialCode', e.target.value)}
                placeholder="Enter material code"
                required
              />

              <TextField
                label="Quantity"
                type="number"
                value={generalExpenseForm.quantity}
                onChange={(e) => handleGeneralExpenseInputChange('quantity', e.target.value)}
                placeholder="0"
                required
                inputProps={{ min: 0, step: 0.1 }}
                sx={{ minWidth: '120px' }}
              />

              <TextField
                label="Price"
                type="number"
                value={generalExpenseForm.price}
                onChange={(e) => handleGeneralExpenseInputChange('price', e.target.value)}
                placeholder="0.00"
                required
                inputProps={{ min: 0, step: 0.01 }}
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                sx={{ minWidth: '150px' }}
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Tax Type</InputLabel>
                <Select
                  value={generalExpenseForm.taxType}
                  onChange={(e) => handleGeneralExpenseInputChange('taxType', e.target.value)}
                  label="Tax Type"
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
              />
            </Box>

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
          <Button onClick={editingGeneralExpense ? closeEditDialog : closeGeneralExpenseDialog} sx={buttonStyles.cancelButton}>
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
          <Button onClick={closeDeleteDialog} sx={buttonStyles.cancelButton}>
            Cancel
          </Button>
          <Button
            onClick={deleteGeneralExpense}
            variant="contained"
            disabled={updating}
            startIcon={updating ? <CircularProgress size={16} sx={{ color: '#000000' }} /> : <DeleteIcon sx={{ color: '#000000' }} />}
            sx={{
              backgroundColor: '#f44336',
              '&:hover': { backgroundColor: '#d32f2f' },
              '&:disabled': { backgroundColor: '#a0a0a0' }
            }}
          >
            {updating ? 'Deleting...' : 'Delete Expense'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Note Dialog */}
      <Dialog open={noteDialogOpen} onClose={closeNoteDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{
          background: 'linear-gradient(135deg, #b98f33 0%, #9a7625 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <EditIcon />
          {noteForm.item ? `Note: ${noteForm.item.materialCode}` : 'Edit Note'}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <TextField
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            placeholder="Add a note for this material track record..."
            value={noteForm.text}
            onChange={(e) => setNoteForm({ ...noteForm, text: e.target.value })}
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 2 }}>
          <Button onClick={closeNoteDialog} sx={buttonStyles.cancelButton}>
            Cancel
          </Button>
          <Button
            onClick={saveNote}
            variant="contained"
            disabled={savingNote}
            startIcon={savingNote ? <CircularProgress size={16} sx={{ color: '#000000' }} /> : <SaveIcon sx={{ color: '#000000' }} />}
            sx={{ ...buttonStyles.primaryButton, backgroundColor: '#b98f33', '&:hover': { backgroundColor: '#9a7625' } }}
          >
            {savingNote ? 'Saving...' : 'Save Note'}
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
            />
            <Alert severity="info">
              <Typography variant="body2">
                This company will be added to the material companies database and will be available for all future expenses.
              </Typography>
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 2 }}>
          <Button onClick={closeAddCompanyDialog} sx={buttonStyles.cancelButton}>
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

export default MaterialTrackPage;
