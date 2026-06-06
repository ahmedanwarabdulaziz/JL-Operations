import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, CircularProgress, IconButton, Tooltip,
  Collapse, Select, MenuItem, FormControl, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Alert,
  Checkbox, FormControlLabel
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import TableChartIcon from '@mui/icons-material/TableChart';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import HomeIcon from '@mui/icons-material/Home';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { collection, getDocs, query, orderBy, doc, getDoc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../../../shared/firebase/config';
import { toDateObject, formatDateOnly } from '../../../utils/dateUtils';
import { calculateOrderTotal, calculateOrderProfit } from '../../../shared/utils/orderCalculations';
import { normalizePaymentData } from '../../../utils/orderCalculations';
import { createAllocation, normalizeAllocation } from '../../../shared/utils/allocationUtils';
import { sendCompletionEmailWithGmail } from '../../../services/emailService';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

// ── Status chip colours ──────────────────────────────────────────────────────
const statusColor = (status = '') => {
  const s = status.toLowerCase();
  if (s.includes('done') || s.includes('paid') || s.includes('complete')) return { bg: '#2e7d32', color: '#fff' };
  if (s.includes('pending') || s.includes('process') || s.includes('progress')) return { bg: '#e65100', color: '#fff' };
  if (s.includes('pickup')) return { bg: '#1565c0', color: '#fff' };
  if (s.includes('delivery')) return { bg: '#6a1b9a', color: '#fff' };
  return { bg: '#424242', color: '#fff' };
};

// ── Cell styling helpers ──────────────────────────────────────────────────────
const headCell = {
  backgroundColor: '#111',
  color: '#b98f33',
  fontWeight: 'bold',
  fontSize: '0.72rem',
  py: 1,
  px: 1,
  border: '1px solid #333',
  whiteSpace: 'nowrap',
};
const bodyCell = (even) => ({
  backgroundColor: even ? '#1a1a1a' : '#212121',
  color: '#e0e0e0',
  fontSize: '0.78rem',
  py: 0.75,
  px: 1,
  border: '1px solid #2a2a2a',
});

// ──────────────────────────────────────────────────────────────────────────────

export default function MonthlyTrackerSection() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-based
  const [loading, setLoading]     = useState(true);
  const [rows, setRows]           = useState([]);
  const [homeExpenses, setHomeExpenses] = useState([]);
  const [invoiceStatuses, setInvoiceStatuses] = useState([]);
  const [expanded, setExpanded]   = useState(true);
  const [editingStatusId, setEditingStatusId] = useState(null);
  const [editingNote, setEditingNote] = useState({ id: null, value: '' });

  // ── Done-flow state: payment validation ────────────────────────────────────
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [validationError, setValidationError] = useState({
    type: '', message: '', row: null, newStatusObj: null, pendingAmount: 0, currentAmount: 0
  });

  // ── Done-flow state: allocation dialog ─────────────────────────────────────
  const [allocationDialogOpen, setAllocationDialogOpen] = useState(false);
  const [allocationRow, setAllocationRow] = useState(null);       // row being completed
  const [allocationNewStatus, setAllocationNewStatus] = useState(null); // newStatusObj
  const [monthlyAllocations, setMonthlyAllocations] = useState([]);
  const [allocationProcessing, setAllocationProcessing] = useState(false);

  // ── Done-flow state: completion email ──────────────────────────────────────
  const [completionEmailDialog, setCompletionEmailDialog] = useState({ open: false });
  const [completedRowForEmail, setCompletedRowForEmail] = useState(null);
  const [includeReviewEmail, setIncludeReviewEmail] = useState(true);
  const [sendEmailChecked, setSendEmailChecked] = useState(true);
  const [sendingCompletionEmail, setSendingCompletionEmail] = useState(false);

  // ── Fetch invoice statuses once ─────────────────────────────────────────────
  useEffect(() => {
    getDocs(collection(db, 'invoiceStatuses')).then(snap => {
      setInvoiceStatuses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }).catch(() => {});
  }, []);

  // ── Resolve status label ────────────────────────────────────────────────────
  const resolveStatus = useCallback((order) => {
    const raw = order.invoiceStatus || order.orderStatus || order.status || '';
    if (!raw) return '—';
    const found = invoiceStatuses.find(s => s.value === raw);
    return found ? found.label : raw;
  }, [invoiceStatuses]);

  // ── Allocation helpers ──────────────────────────────────────────────────────
  const generateMonthlyAllocations = useCallback(() => {
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-indexed
    const currentYear = now.getFullYear();
    const months = [];
    for (let i = -2; i <= 2; i++) {
      const monthIndex = (currentMonth + i + 12) % 12;
      const yr = currentYear + Math.floor((currentMonth + i) / 12);
      months.push({
        month: monthIndex + 1,
        year: yr,
        label: new Date(yr, monthIndex).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        percentage: i === 0 ? 100 : 0
      });
    }
    return months;
  }, []);

  const allocationTotal = monthlyAllocations.reduce((s, a) => s + (a.percentage || 0), 0);

  const updateAllocationPercentage = (index, val) => {
    const newAllocations = [...monthlyAllocations];
    let pct = parseFloat(val) || 0;
    pct = Math.max(0, Math.min(100, pct));
    const currentTotal = newAllocations.reduce((s, a, i) => i !== index ? s + (a.percentage || 0) : s, 0);
    if (currentTotal + pct > 100) pct = Math.max(0, 100 - currentTotal);
    newAllocations[index].percentage = pct;
    setMonthlyAllocations(newAllocations);
  };

  // ── Open the allocation dialog for a row ──────────────────────────────────
  const openAllocationDialog = useCallback((row, newStatusObj, fullOrderData) => {
    setAllocationRow({ ...row, _fullOrder: fullOrderData });
    setAllocationNewStatus(newStatusObj);
    setAllocationDialogOpen(true);
    // Pre-load existing allocation if present
    if (fullOrderData.allocation?.allocations?.length > 0) {
      const monthNames = ['January','February','March','April','May','June',
                          'July','August','September','October','November','December'];
      setMonthlyAllocations(
        fullOrderData.allocation.allocations.map(a => ({
          month: Number(a.month),
          year: Number(a.year),
          label: `${monthNames[Number(a.month) - 1]} ${a.year}`,
          percentage: a.percentage
        })).filter(a => a.month >= 1 && a.month <= 12)
      );
    } else {
      setMonthlyAllocations(generateMonthlyAllocations());
    }
  }, [generateMonthlyAllocations]);

  // ── Fetch full order data from Firestore ──────────────────────────────────
  const fetchFullOrder = async (row) => {
    let collName;
    if (row.isTInvoice)  collName = 'customer-invoices';
    else if (row.isCorp) collName = 'corporate-orders';
    else                 collName = 'orders';
    const snap = await getDoc(doc(db, collName, row.id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data(), orderType: row.isCorp ? 'corporate' : 'regular' };
  };

  // ── handleStatusChange — full Done flow ────────────────────────────────────
  const handleStatusChange = async (row, newStatusValue) => {
    if (!newStatusValue || newStatusValue === invoiceStatuses.find(s => s.label === row.status)?.value) {
      setEditingStatusId(null);
      return;
    }

    const newStatusObj = invoiceStatuses.find(s => s.value === newStatusValue);
    if (!newStatusObj) { setEditingStatusId(null); return; }
    setEditingStatusId(null);

    // ── End-state: "Done" ──────────────────────────────────────────────────
    if (newStatusObj.isEndState && newStatusObj.endStateType === 'done') {
      try {
        const fullOrder = await fetchFullOrder(row);
        if (!fullOrder) { console.error('Order not found'); return; }

        // Normalise for calculation
        const normalised = row.isCorp
          ? { ...fullOrder, furnitureData: { groups: fullOrder.furnitureGroups || [] }, paymentData: fullOrder.paymentDetails || {} }
          : { ...fullOrder, furnitureData: fullOrder.furnitureData || { groups: [] }, paymentData: fullOrder.paymentData || {} };

        const profitData = calculateOrderProfit(normalised);
        const totalAmount = profitData.revenue || 0;
        const paymentData = row.isCorp ? fullOrder.paymentDetails : fullOrder.paymentData;
        const normPayment = normalizePaymentData(paymentData);

        // Payment validation
        if (normPayment.amountPaid < totalAmount) {
          setValidationError({
            type: 'done',
            message: `Cannot complete order: Payment not fully received. Required: $${totalAmount.toFixed(2)}, Paid: $${normPayment.amountPaid.toFixed(2)}`,
            row,
            newStatusObj,
            pendingAmount: totalAmount - normPayment.amountPaid,
            currentAmount: normPayment.amountPaid,
            fullOrder,
            normalised,
          });
          setValidationDialogOpen(true);
          return;
        }

        // Fully paid → open allocation dialog
        openAllocationDialog(row, newStatusObj, fullOrder);
      } catch (err) {
        console.error('Error fetching order for Done flow:', err);
      }
      return;
    }

    // ── Non-done end-state or regular status — direct update ─────────────
    try {
      let collectionName;
      if (row.isTInvoice)  collectionName = 'customer-invoices';
      else if (row.isCorp) collectionName = 'corporate-orders';
      else                 collectionName = 'orders';
      const ref = doc(db, collectionName, row.id);
      await updateDoc(ref, { invoiceStatus: newStatusValue, statusUpdatedAt: new Date() });
      const newLabel = newStatusObj.label || newStatusValue;
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: newLabel } : r));
    } catch (err) {
      console.error('Status update error', err);
    }
  };

  // ── Make fully paid (payment bypass) ──────────────────────────────────────
  const handleMakeFullyPaid = async () => {
    const { row, newStatusObj, pendingAmount, currentAmount, fullOrder, normalised } = validationError;
    try {
      const paymentField = row.isCorp ? 'paymentDetails' : 'paymentData';
      const currentPayment = row.isCorp ? fullOrder.paymentDetails : fullOrder.paymentData;
      const totalAmount = currentAmount + pendingAmount;
      const collName = row.isCorp ? 'corporate-orders' : 'orders';
      await updateDoc(doc(db, collName, row.id), {
        [`${paymentField}.amountPaid`]: totalAmount,
        [`${paymentField}.paymentHistory`]: [
          ...(currentPayment?.paymentHistory || []),
          { amount: pendingAmount, date: new Date(), notes: 'Auto-paid to complete order' }
        ]
      });
      // Open allocation dialog with updated order
      const updatedOrder = {
        ...fullOrder,
        [paymentField]: { ...currentPayment, amountPaid: totalAmount }
      };
      setValidationDialogOpen(false);
      openAllocationDialog(row, newStatusObj, updatedOrder);
    } catch (err) {
      console.error('Error making fully paid:', err);
    }
  };

  // ── Apply allocation & complete the order ─────────────────────────────────
  const handleApplyAllocation = async () => {
    if (Math.abs(allocationTotal - 100) > 0.01) {
      alert('Total allocation percentage must equal 100%');
      return;
    }
    setAllocationProcessing(true);
    try {
      const row = allocationRow;
      const fullOrder = allocationRow._fullOrder;
      const newStatusObj = allocationNewStatus;

      const normalised = row.isCorp
        ? { ...fullOrder, furnitureData: { groups: fullOrder.furnitureGroups || [] }, paymentData: fullOrder.paymentDetails || {} }
        : { ...fullOrder, furnitureData: fullOrder.furnitureData || { groups: [] }, paymentData: fullOrder.paymentData || {} };

      const profitData = calculateOrderProfit(normalised);
      const allocationData = createAllocation(monthlyAllocations, profitData);

      const updateData = {
        invoiceStatus: newStatusObj.value,
        allocation: allocationData,
        statusUpdatedAt: new Date()
      };

      const collName = row.isCorp ? 'corporate-orders' : 'orders';
      const orderRef = doc(db, collName, row.id);

      if (row.isCorp) {
        const closedAtDate = new Date();
        await updateDoc(orderRef, {
          ...updateData,
          closedAt: closedAtDate,
          updatedAt: new Date()
        });

        // Sanitise — remove _fullOrder and any non-serialisable fields
        const { _fullOrder, ...sanitizedRow } = row;
        const doneOrderData = {
          ...fullOrder,
          allocation: allocationData,
          invoiceStatus: newStatusObj.value,
          orderType: 'corporate',
          source: 'corporate_order',
          closedAt: closedAtDate,
          status: 'done'
        };
        const taxedInvoiceData = {
          ...fullOrder,
          allocation: allocationData,
          invoiceStatus: newStatusObj.value,
          orderType: 'corporate',
          source: 'corporate_order',
          closedAt: closedAtDate,
          originalInvoiceId: fullOrder.id
        };

        await addDoc(collection(db, 'done-orders'), doneOrderData);
        await addDoc(collection(db, 'taxedInvoices'), taxedInvoiceData);

        // Remove from table (corporate done orders disappear)
        setRows(prev => prev.filter(r => r.id !== row.id));
      } else {
        await updateDoc(orderRef, updateData);
        // Update status label in table
        setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: newStatusObj.label } : r));
      }

      // Save the completed row for email
      setCompletedRowForEmail({ ...row, _fullOrder: fullOrder });

      setAllocationDialogOpen(false);
      setAllocationRow(null);
      setAllocationNewStatus(null);

      // Trigger email dialog if customer has email
      const customerEmail = row.isCorp
        ? (fullOrder.contactPerson?.email || fullOrder.corporateCustomer?.email)
        : fullOrder.personalInfo?.email;

      if (customerEmail && customerEmail.includes('@')) {
        setCompletionEmailDialog({ open: true });
        setSendEmailChecked(true);
        setIncludeReviewEmail(true);
      }
    } catch (err) {
      console.error('Error applying allocation:', err);
    } finally {
      setAllocationProcessing(false);
    }
  };

  // ── Send completion email ──────────────────────────────────────────────────
  const handleSendCompletionEmail = async () => {
    if (!sendEmailChecked || !completedRowForEmail) {
      setCompletionEmailDialog({ open: false });
      return;
    }
    setSendingCompletionEmail(true);
    try {
      const { _fullOrder: fullOrder, isCorp } = completedRowForEmail;
      const customerEmail = isCorp
        ? (fullOrder.contactPerson?.email || fullOrder.corporateCustomer?.email)
        : fullOrder.personalInfo?.email;

      if (customerEmail) {
        const orderDataForEmail = isCorp
          ? {
              corporateCustomer: fullOrder.corporateCustomer,
              contactPerson: fullOrder.contactPerson,
              orderDetails: fullOrder.orderDetails,
              furnitureData: { groups: fullOrder.furnitureGroups || [] },
              paymentData: fullOrder.paymentDetails || {}
            }
          : fullOrder;

        await sendCompletionEmailWithGmail(orderDataForEmail, customerEmail, includeReviewEmail, () => {});
      }
    } catch (err) {
      console.error('Completion email error:', err);
    } finally {
      setSendingCompletionEmail(false);
      setCompletionEmailDialog({ open: false });
      setCompletedRowForEmail(null);
    }
  };


  // ── Fetch invoices + home expenses for selected month ──────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [regularSnap, corpSnap, customerInvSnap, homeExpSnap] = await Promise.all([
          getDocs(query(collection(db, 'orders'),            orderBy('createdAt', 'desc'))),
          getDocs(query(collection(db, 'corporate-orders'),  orderBy('createdAt', 'desc'))),
          getDocs(collection(db, 'customer-invoices')),
          getDocs(query(collection(db, 'businessExpenses'),  orderBy('date',      'desc'))),
        ]);

        // ── Is this doc in the CURRENT month? Returns reason string or null ───
        const inMonth = (order) => {
          if (order.allocation?.allocations?.length) {
            const hit = order.allocation.allocations.some(a =>
              Number(a.year) === year &&
              Number(a.month) === month &&
              (a.percentage || 0) > 0          // ← must have a real value this month
            );
            if (hit) return `allocation(${order.allocation.allocations.map(a=>`${a.year}-${a.month}:${a.percentage}%`).join(',')})`;
            return null;
          }
          // Use createdAt only — matches the sort field so what you see is always this month
          const d = toDateObject(order.createdAt);
          if (!d) return null;
          const passes = d.getFullYear() === year && d.getMonth() + 1 === month;
          return passes ? `createdAt(${d.toISOString().slice(0,10)})` : null;
        };

        // ── Turn a Firestore doc + type into a table row ──────────────────────
        // overrides: { isTInvoice, originalInvoiceNo, ...extra fields merged onto order }
        const buildRow = (firestoreDoc, type, overrides = {}) => {
          const order = { id: firestoreDoc.id, ...firestoreDoc.data(), orderType: type };
          // Merge any extra fields (e.g. furnitureData from original order)
          Object.assign(order, overrides);
          const passedVia = inMonth(order);
          if (!passedVia) return null;

          const isCorp     = type === 'corporate';
          const invoiceNo  = order.invoiceNumber || order.orderDetails?.billInvoice || order.id.slice(-6);

          const normalised = isCorp
            ? { ...order, furnitureData: { groups: order.furnitureGroups || [] }, paymentData: order.paymentDetails || {} }
            : { ...order, furnitureData: order.furnitureData || { groups: [] }, paymentData: order.paymentData || {} };

          const totalInvoice = calculateOrderTotal(normalised) || 0;
          // TAX: 13% HST for corporate orders AND T-invoices (both are taxed)
          const isTaxed      = isCorp || order.isTInvoice === true;
          const tax          = isTaxed ? totalInvoice - totalInvoice / 1.13 : 0;
          const expenses     = (order.extraExpenses || []).reduce((s, e) => s + (parseFloat(e.total) || 0), 0);
          const clearIncome  = totalInvoice - tax;
          const status       = resolveStatus(order);
          const dueRaw       = order.orderDetails?.deadline || order.paymentDetails?.dueDate || null;
          const dueDate      = dueRaw ? (toDateObject(dueRaw)?.toLocaleDateString('en-CA') || '—') : '—';
          const internalNote = order.trackerInternalNote || '';
          const customer     = isCorp
            ? (order.corporateCustomer?.corporateName || 'Corporate')
            : (order.personalInfo?.customerName || order.personalInfo?.name || 'Customer');

          return {
            id: order.id,
            invoiceNo,
            createdAt: order.createdAt || null,
            _passedVia: passedVia,          // debug: why this row passed the month filter
            // T-invoice specific
            isTInvoice:       overrides.isTInvoice       || false,
            originalInvoiceNo: overrides.originalInvoiceNo || null,
            customer,
            isCorp,
            expenses,
            totalInvoice,
            tax,
            clearIncome,
            dueDate,
            status,
            rawStatus: order.invoiceStatus || order.orderStatus || order.status || '',
            internalNote,
          };
        };

        // ── 1. Find T-invoices (customer-invoices with T- prefix) ─────────────
        const tInvoiceDocs = customerInvSnap.docs.filter(d =>
          String(d.data().invoiceNumber || '').toUpperCase().startsWith('T-')
        );

        // IDs of original orders that are superseded by a T-invoice
        const supersededIds = new Set(
          tInvoiceDocs.map(d => d.data().originalOrderId).filter(Boolean)
        );

        // ── 2. Regular orders — skip superseded ones ───────────────────────────
        const regularRows = regularSnap.docs
          .filter(d => d.data().hasTInvoice !== true && !supersededIds.has(d.id))
          .map(d => buildRow(d, 'regular'))
          .filter(Boolean);

        // ── 3. Corporate orders ────────────────────────────────────────────────
        const corpRows = corpSnap.docs
          .map(d => buildRow(d, 'corporate'))
          .filter(Boolean);

        // ── 4. T-invoice rows — enrich with original order's cost data ─────────
        const tRows = await Promise.all(
          tInvoiceDocs.map(async (tDoc) => {
            const tData = { ...tDoc.data() };
            let originalInvoiceNo = null;

            if (tData.originalOrderId) {
              try {
                const origSnap = await getDoc(doc(db, 'orders', tData.originalOrderId));
                if (origSnap.exists()) {
                  const orig = origSnap.data();
                  originalInvoiceNo   = orig.orderDetails?.billInvoice || orig.invoiceNumber || null;
                  // Pull cost-side data from original order
                  tData.furnitureData  = orig.furnitureData;
                  tData.furnitureGroups = orig.furnitureGroups;
                  tData.extraExpenses  = orig.extraExpenses;
                  tData.originalCreatedAt  = orig.createdAt || null; // for grouping sort
                }
              } catch (e) {
                console.error('T-invoice original fetch error', e);
              }
            }

            // Synthetic doc-like object so buildRow can read .id and .data()
            const syntheticDoc = { id: tDoc.id, data: () => tData };
            const row = buildRow(syntheticDoc, 'regular', { isTInvoice: true, originalInvoiceNo });
            // Store original's createdAt so we can sort T-invoice alongside its original
            if (row && tData.originalCreatedAt) row.originalCreatedAt = tData.originalCreatedAt;
            return row;
          })
        );

        const built = [...regularRows, ...corpRows, ...tRows.filter(Boolean)];

        // Sort: group T-invoices right after their original, newest-original first
        built.sort((a, b) => {
          // Each row gets a sort date: T-invoices use their original's createdAt
          const getSortDate = (r) => {
            if (r.isTInvoice) return toDateObject(r.originalCreatedAt) || toDateObject(r.createdAt);
            return toDateObject(r.createdAt);
          };
          const dA = getSortDate(a);
          const dB = getSortDate(b);

          if (dA && dB) {
            const diff = dB.getTime() - dA.getTime();
            if (diff !== 0) return diff; // different groups → sort by date
          } else if (dA) return -1;
          else if (dB) return 1;

          // Same sort date = same group → original before T-invoice
          if (!a.isTInvoice && b.isTInvoice) return -1;
          if (a.isTInvoice && !b.isTInvoice) return 1;
          return 0;
        });



        // ── Filter out Cancelled & Pending end-state orders ───────────────────
        const activeRows = built.filter(row => {
          const statusObj = invoiceStatuses.find(s => s.value === row.rawStatus);
          if (!statusObj) return true; // unknown status — show it
          return statusObj.endStateType !== 'cancelled' && statusObj.endStateType !== 'pending';
        });

        setRows(activeRows);

        // ── 5. Home expenses for selected month ───────────────────────────────
        const homeForMonth = homeExpSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(e => {
            if (e.type !== 'home') return false;
            const d = toDateObject(e.date || e.createdAt);
            return d && d.getFullYear() === year && d.getMonth() + 1 === month;
          });
        setHomeExpenses(homeForMonth);

      } catch (err) {
        console.error('MonthlyTracker fetch error', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [year, month, resolveStatus]);

  const handleNoteSave = async (row) => {
    const newNote = editingNote.value;
    try {
      let collectionName;
      if (row.isTInvoice)    collectionName = 'customer-invoices';
      else if (row.isCorp)   collectionName = 'corporate-orders';
      else                   collectionName = 'orders';
      await updateDoc(doc(db, collectionName, row.id), { trackerInternalNote: newNote });
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, internalNote: newNote } : r));
    } catch (err) {
      console.error('Note save error', err);
    } finally {
      setEditingNote({ id: null, value: '' });
    }
  };

  // ── Totals ──────────────────────────────────────────────────────────────────
  const totalExpenses     = rows.reduce((s, r) => s + r.expenses,     0);
  const totalInvoice      = rows.reduce((s, r) => s + r.totalInvoice, 0);
  const totalTax          = rows.reduce((s, r) => s + r.tax,          0);
  const totalClear        = rows.reduce((s, r) => s + r.clearIncome,  0);
  const totalHomeExpenses = homeExpenses.reduce((s, e) => s + (parseFloat(e.total) || 0), 0);
  const clearTotal        = totalClear - totalHomeExpenses;

  return (
    <>
    <Box sx={{ mb: 4 }}>
      {/* ── Section Header ─────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, px: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <TableChartIcon sx={{ color: '#b98f33', fontSize: 28 }} />
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
            Monthly Financial Tracker
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="small" onClick={() => {
            setMonth(prev => {
              if (prev === 1) { setYear(y => y - 1); return 12; }
              return prev - 1;
            });
          }} sx={{ color: '#b98f33' }}>
            <ChevronLeftIcon />
          </IconButton>
          
          <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 'bold', minWidth: 140, textAlign: 'center' }}>
            {MONTH_NAMES[month - 1]} {year}
          </Typography>

          <IconButton size="small" onClick={() => {
            setMonth(prev => {
              if (prev === 12) { setYear(y => y + 1); return 1; }
              return prev + 1;
            });
          }} sx={{ color: '#b98f33' }}>
            <ChevronRightIcon />
          </IconButton>
          <Tooltip title={expanded ? 'Collapse' : 'Expand'}>
            <IconButton size="small" onClick={() => setExpanded(v => !v)} sx={{ color: '#b98f33', ml: 1 }}>
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Collapse in={expanded}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress sx={{ color: '#b98f33' }} />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>

            {/* ── Main Invoice Table ──────────────────────────────────────── */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <TableContainer component={Paper} sx={{ backgroundColor: '#111', border: '1px solid #333' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={headCell}>Invoice No.</TableCell>
                      <TableCell sx={{ ...headCell, textAlign: 'right' }}>Expenses</TableCell>
                      <TableCell sx={{ ...headCell, textAlign: 'right' }}>Total Invoice Income</TableCell>
                      <TableCell sx={{ ...headCell, textAlign: 'right' }}>TAX (corporate)</TableCell>
                      <TableCell sx={{ ...headCell, textAlign: 'right' }}>Total Clear Income</TableCell>
                      <TableCell sx={headCell}>Due Date</TableCell>
                      <TableCell sx={headCell}>Status</TableCell>
                      <TableCell sx={headCell}>Internal Note</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} sx={{ ...bodyCell(true), textAlign: 'center', py: 4, color: '#666' }}>
                          No invoices found for {MONTH_NAMES[month - 1]} {year}
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((row, i) => {
                        const even = i % 2 === 0;
                        const sc   = statusColor(row.status);
                         return (
                          <TableRow key={row.id} hover sx={{ cursor: 'default' }}>

                            {/* Invoice No. — tooltip shows customer + created date */}
                            <TableCell sx={{ ...bodyCell(even) }}>
                              <Tooltip
                                placement="top"
                                arrow
                                title={
                                  <Box sx={{ p: 0.5 }}>
                                    <Typography variant="caption" sx={{ display: 'block', fontWeight: 'bold', color: '#b98f33', fontSize: '0.8rem' }}>
                                      {row.customer}
                                    </Typography>
                                    <Typography variant="caption" sx={{ display: 'block', color: '#ccc', fontSize: '0.75rem', mt: 0.25 }}>
                                      Created: {row.createdAt ? formatDateOnly(row.createdAt) : 'No date'}
                                    </Typography>
                                  </Box>
                                }
                                componentsProps={{
                                  tooltip: {
                                    sx: {
                                      backgroundColor: '#1a1a1a',
                                      border: '1px solid #b98f33',
                                      borderRadius: 1,
                                      px: 1.5,
                                      py: 1,
                                      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                    }
                                  },
                                  arrow: { sx: { color: '#b98f33' } }
                                }}
                              >
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, cursor: 'pointer' }}>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontWeight: 'bold',
                                      color: row.isTInvoice ? '#4fc3f7' : '#b98f33',
                                      fontSize: '0.8rem',
                                    }}
                                  >
                                    {row.invoiceNo}
                                  </Typography>
                                  {row.isTInvoice && (
                                    <Chip
                                      label={`T-Invoice`}
                                      size="small"
                                      sx={{ fontSize: '0.58rem', height: 15, backgroundColor: '#01579b', color: '#fff', width: 'fit-content' }}
                                    />
                                  )}
                                  {row.originalInvoiceNo && (
                                    <Typography variant="caption" sx={{ color: '#666', fontSize: '0.68rem' }}>
                                      Ref: #{row.originalInvoiceNo}
                                    </Typography>
                                  )}
                                </Box>
                              </Tooltip>
                            </TableCell>

                            <TableCell sx={{ ...bodyCell(even), textAlign: 'right' }}>
                              {row.expenses > 0 ? fmt(row.expenses) : <span style={{ color: '#555' }}>—</span>}
                            </TableCell>
                            <TableCell sx={{ ...bodyCell(even), textAlign: 'right', fontWeight: 'bold', color: '#fff' }}>
                              {fmt(row.totalInvoice)}
                            </TableCell>
                            <TableCell sx={{ ...bodyCell(even), textAlign: 'right', color: '#ff9800' }}>
                              {row.tax > 0 ? fmt(row.tax) : <span style={{ color: '#555' }}>—</span>}
                            </TableCell>
                            <TableCell sx={{ ...bodyCell(even), textAlign: 'right', fontWeight: 'bold', color: '#4caf50' }}>
                              {fmt(row.clearIncome)}
                            </TableCell>
                            <TableCell sx={{ ...bodyCell(even), color: '#90caf9' }}>
                              {row.dueDate}
                            </TableCell>
                            <TableCell sx={bodyCell(even)}>
                              {editingStatusId === row.id ? (
                                <FormControl size="small" variant="outlined" sx={{ minWidth: 130 }}>
                                  <Select
                                    autoFocus
                                    open
                                    value={invoiceStatuses.find(s => s.label === row.status)?.value || ''}
                                    onChange={(e) => handleStatusChange(row, e.target.value)}
                                    onClose={() => setEditingStatusId(null)}
                                    sx={{
                                      fontSize: '0.72rem',
                                      color: '#fff',
                                      backgroundColor: '#1a1a1a',
                                      '.MuiOutlinedInput-notchedOutline': { borderColor: '#b98f33' },
                                      '.MuiSvgIcon-root': { color: '#b98f33' },
                                    }}
                                    MenuProps={{ PaperProps: { sx: { backgroundColor: '#1a1a1a', border: '1px solid #b98f33' } } }}
                                  >
                                    {invoiceStatuses.map(s => (
                                      <MenuItem key={s.value} value={s.value} sx={{ fontSize: '0.75rem', color: '#e0e0e0', '&:hover': { backgroundColor: '#2a2a2a' } }}>
                                        {s.label}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              ) : (
                                <Tooltip title="Click to change status">
                                  <Chip
                                    label={row.status}
                                    size="small"
                                    onClick={() => setEditingStatusId(row.id)}
                                    sx={{
                                      backgroundColor: sc.bg,
                                      color: sc.color,
                                      fontSize: '0.65rem',
                                      height: 20,
                                      fontWeight: 'bold',
                                      cursor: 'pointer',
                                      '&:hover': { opacity: 0.85, transform: 'scale(1.05)' },
                                      transition: 'all 0.15s ease',
                                    }}
                                  />
                                </Tooltip>
                              )}
                            </TableCell>
                            <TableCell sx={{ ...bodyCell(even), minWidth: 160 }}>
                              {editingNote.id === row.id ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <TextField
                                    autoFocus
                                    size="small"
                                    value={editingNote.value}
                                    onChange={e => setEditingNote({ id: row.id, value: e.target.value })}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') handleNoteSave(row);
                                      if (e.key === 'Escape') setEditingNote({ id: null, value: '' });
                                    }}
                                    placeholder="Internal note…"
                                    sx={{
                                      '& .MuiInputBase-input': { color: '#fff', fontSize: '0.75rem', py: 0.5, px: 1 },
                                      '& .MuiOutlinedInput-notchedOutline': { borderColor: '#b98f33' },
                                      '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#d4a843' },
                                      backgroundColor: '#1a1a1a',
                                      borderRadius: 1,
                                    }}
                                  />
                                  <Tooltip title="Save (Enter)">
                                    <IconButton size="small" onClick={() => handleNoteSave(row)} sx={{ color: '#4caf50', p: 0.3 }}>
                                      <CheckIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Cancel (Esc)">
                                    <IconButton size="small" onClick={() => setEditingNote({ id: null, value: '' })} sx={{ color: '#f44336', p: 0.3 }}>
                                      <CloseIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                              ) : (
                                <Box
                                  onClick={() => setEditingNote({ id: row.id, value: row.internalNote || '' })}
                                  sx={{
                                    display: 'flex', alignItems: 'center', gap: 0.5,
                                    cursor: 'pointer', minHeight: 28, px: 0.5, borderRadius: 1,
                                    '&:hover': { backgroundColor: '#1e1e1e' },
                                  }}
                                >
                                  {row.internalNote ? (
                                    <Typography sx={{ fontSize: '0.72rem', color: '#ccc', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {row.internalNote}
                                    </Typography>
                                  ) : (
                                    <Typography sx={{ fontSize: '0.68rem', color: '#444', fontStyle: 'italic', flex: 1 }}>Add note…</Typography>
                                  )}
                                  <EditIcon sx={{ fontSize: 12, color: '#555', flexShrink: 0 }} />
                                </Box>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}

                    {/* ── Totals row ───────────────────────────────────────── */}
                    {rows.length > 0 && (
                      <TableRow sx={{ backgroundColor: '#000' }}>
                        <TableCell colSpan={1} sx={{ ...bodyCell(false), fontWeight: 'bold', color: '#b98f33', borderTop: '2px solid #b98f33' }}>
                          TOTAL ({rows.length} invoice{rows.length !== 1 ? 's' : ''})
                        </TableCell>
                        <TableCell sx={{ ...bodyCell(false), textAlign: 'right', fontWeight: 'bold', color: '#fff', borderTop: '2px solid #b98f33' }}>
                          {fmt(totalExpenses)}
                        </TableCell>
                        <TableCell sx={{ ...bodyCell(false), textAlign: 'right', fontWeight: 'bold', color: '#fff', borderTop: '2px solid #b98f33' }}>
                          {fmt(totalInvoice)}
                        </TableCell>
                        <TableCell sx={{ ...bodyCell(false), textAlign: 'right', fontWeight: 'bold', color: '#ff9800', borderTop: '2px solid #b98f33' }}>
                          {fmt(totalTax)}
                        </TableCell>
                        <TableCell sx={{ ...bodyCell(false), textAlign: 'right', fontWeight: 'bold', color: '#4caf50', borderTop: '2px solid #b98f33' }}>
                          {fmt(totalClear)}
                        </TableCell>
                        <TableCell colSpan={3} sx={{ ...bodyCell(false), borderTop: '2px solid #b98f33' }} />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {/* ── Home Expenses Summary Panel ─────────────────────────────── */}
            <Box sx={{ width: 260, flexShrink: 0 }}>
              <Paper sx={{ backgroundColor: '#111', border: '1px solid #333', p: 0, overflow: 'hidden' }}>
                <Box sx={{ backgroundColor: '#1a1a1a', borderBottom: '1px solid #333', px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <HomeIcon sx={{ color: '#b98f33', fontSize: 18 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                    Home Expenses
                  </Typography>
                </Box>

                <Box sx={{ px: 0 }}>
                  {homeExpenses.length === 0 ? (
                    <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
                      <Typography variant="body2" sx={{ color: '#555' }}>
                        No home expenses for this month
                      </Typography>
                    </Box>
                  ) : (
                    homeExpenses.map((e, i) => (
                      <Box
                        key={e.id}
                        sx={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          px: 2, py: 0.75,
                          backgroundColor: i % 2 === 0 ? '#1a1a1a' : '#212121',
                          borderBottom: '1px solid #2a2a2a',
                        }}
                      >
                        <Typography variant="caption" sx={{ color: '#ccc', flex: 1, pr: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {e.description || 'Home Expense'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#f44336', fontWeight: 'bold', flexShrink: 0 }}>
                          {fmt(e.total)}
                        </Typography>
                      </Box>
                    ))
                  )}
                </Box>

                {homeExpenses.length > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 2, py: 1, borderTop: '1px solid #444', backgroundColor: '#1a1a1a' }}>
                    <Typography variant="caption" sx={{ color: '#b98f33', fontWeight: 'bold' }}>
                      Home Expenses Total
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#f44336', fontWeight: 'bold' }}>
                      {fmt(totalHomeExpenses)}
                    </Typography>
                  </Box>
                )}

                <Box sx={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  px: 2, py: 1.5,
                  backgroundColor: clearTotal >= 0 ? '#1b5e20' : '#7f0000',
                  borderTop: '2px solid #333',
                }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#fff' }}>
                    CLEAR TOTAL
                  </Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#fff', fontSize: '1rem' }}>
                    {fmt(clearTotal)}
                  </Typography>
                </Box>

                <Box sx={{ px: 2, py: 1, borderTop: '1px solid #2a2a2a' }}>
                  <Typography variant="caption" sx={{ color: '#555', display: 'block' }}>
                    Clear Income: {fmt(totalClear)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#555', display: 'block' }}>
                    − Home Expenses: {fmt(totalHomeExpenses)}
                  </Typography>
                </Box>
              </Paper>
            </Box>

          </Box>
        )}
      </Collapse>
    </Box>

    {/* ── Payment Validation Dialog ───────────────────────────────────────── */}
    <Dialog open={validationDialogOpen} onClose={() => setValidationDialogOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle sx={{
        background: 'linear-gradient(135deg, #b98f33 0%, #8b6b1f 100%)',
        color: '#000000',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        gap: 1
      }}>
        ⚠️ Payment Validation Required
      </DialogTitle>
      <DialogContent sx={{ backgroundColor: '#3a3a3a', p: 3 }}>
        <Box sx={{ p: 2, backgroundColor: '#2a2a2a', borderRadius: 1, border: '1px solid #b98f33', mb: 2 }}>
          <Typography variant="body1" sx={{ color: '#ffffff' }}>
            {validationError.message}
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: '#b98f33' }}>
          Click the button below to mark the remaining amount as paid and proceed to allocation.
        </Typography>
      </DialogContent>
      <DialogContent sx={{ backgroundColor: '#3a3a3a', pt: 0, pb: 1 }}>
        {validationError.type === 'done' && (
          <Button
            variant="contained"
            onClick={handleMakeFullyPaid}
            fullWidth
            sx={{
              background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
              color: '#000000',
              fontWeight: 'bold',
              border: '3px solid #4CAF50',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.3)',
              '&:hover': {
                background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
                border: '3px solid #45a049',
              },
            }}
          >
            ✓ Mark ${validationError.pendingAmount?.toFixed(2)} as Paid & Continue
          </Button>
        )}
      </DialogContent>
      <DialogActions sx={{ backgroundColor: '#3a3a3a', pb: 2, px: 2 }}>
        <Button
          onClick={() => setValidationDialogOpen(false)}
          sx={{ color: '#aaaaaa', '&:hover': { color: '#ffffff', backgroundColor: 'rgba(255,255,255,0.05)' } }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>

    {/* ── Allocation Dialog ───────────────────────────────────────────────── */}
    <Dialog open={allocationDialogOpen} onClose={() => !allocationProcessing && setAllocationDialogOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle sx={{
        background: 'linear-gradient(135deg, #b98f33 0%, #8b6b1f 100%)',
        color: '#000000',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        gap: 1
      }}>
        📊 Order Completion & Financial Allocation
      </DialogTitle>
      <DialogContent sx={{ backgroundColor: '#3a3a3a', p: 3 }}>
        {/* Order info */}
        {allocationRow && (
          <Box sx={{ mb: 3, p: 2, backgroundColor: '#2a2a2a', borderRadius: 1, border: '1px solid #b98f33' }}>
            <Typography variant="subtitle2" sx={{ color: '#b98f33', fontWeight: 'bold', mb: 0.5 }}>
              Order
            </Typography>
            <Typography variant="body2" sx={{ color: '#ffffff' }}>
              <strong style={{ color: '#b98f33' }}>Invoice:</strong> {allocationRow.invoiceNo}
            </Typography>
            <Typography variant="body2" sx={{ color: '#ffffff' }}>
              <strong style={{ color: '#b98f33' }}>Customer:</strong> {allocationRow.customer}
            </Typography>
          </Box>
        )}

        {/* Instruction */}
        <Typography variant="body2" sx={{ color: '#b98f33', mb: 2, fontStyle: 'italic' }}>
          Distribute the order's revenue across months. Total must equal exactly 100%.
        </Typography>

        {/* Allocation rows */}
        <Box sx={{ backgroundColor: '#2a2a2a', borderRadius: 1, border: '1px solid #333', overflow: 'hidden', mb: 2 }}>
          {monthlyAllocations.map((alloc, i) => (
            <Box
              key={`${alloc.year}-${alloc.month}`}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                px: 2,
                py: 1,
                borderBottom: i < monthlyAllocations.length - 1 ? '1px solid #333' : 'none',
                '&:hover': { backgroundColor: '#333' }
              }}
            >
              <Typography sx={{ color: '#ffffff', fontSize: '0.85rem', flex: 1, fontWeight: 500 }}>
                {alloc.label}
              </Typography>
              <TextField
                size="small"
                type="number"
                value={alloc.percentage}
                onChange={e => updateAllocationPercentage(i, e.target.value)}
                inputProps={{ min: 0, max: 100, step: 1 }}
                sx={{
                  width: 85,
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#444' },
                    '&:hover fieldset': { borderColor: '#b98f33' },
                    '&.Mui-focused fieldset': { borderColor: '#b98f33' },
                  },
                  '& .MuiInputBase-input': { color: '#ffffff', textAlign: 'right', fontSize: '0.85rem', py: 0.75 },
                  backgroundColor: '#1a1a1a',
                }}
              />
              <Typography sx={{ color: '#b98f33', fontSize: '0.85rem', fontWeight: 'bold', width: 18 }}>%</Typography>
            </Box>
          ))}
        </Box>

        {/* Total status */}
        <Box sx={{
          p: 1.5,
          borderRadius: 1,
          border: `1px solid ${Math.abs(allocationTotal - 100) < 0.01 ? '#4CAF50' : '#f44336'}`,
          backgroundColor: Math.abs(allocationTotal - 100) < 0.01 ? 'rgba(76,175,80,0.1)' : 'rgba(244,67,54,0.1)',
        }}>
          <Typography variant="body2" sx={{
            color: Math.abs(allocationTotal - 100) < 0.01 ? '#4caf50' : '#f44336',
            fontWeight: 'bold',
            textAlign: 'center'
          }}>
            {Math.abs(allocationTotal - 100) < 0.01
              ? `✓ Total: ${allocationTotal.toFixed(1)}% — Ready to complete`
              : `Total: ${allocationTotal.toFixed(1)}% — ${(100 - allocationTotal).toFixed(1)}% remaining`
            }
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ backgroundColor: '#3a3a3a', p: 2, gap: 1 }}>
        <Button
          onClick={() => setAllocationDialogOpen(false)}
          disabled={allocationProcessing}
          sx={{ color: '#aaaaaa', '&:hover': { color: '#ffffff', backgroundColor: 'rgba(255,255,255,0.05)' } }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleApplyAllocation}
          disabled={allocationProcessing || Math.abs(allocationTotal - 100) > 0.01}
          sx={{ backgroundColor: '#4caf50', '&:hover': { backgroundColor: '#388e3c' }, '&:disabled': { backgroundColor: '#333' } }}
        >
          {allocationProcessing ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Complete Order & Apply Allocation'}
        </Button>
      </DialogActions>
    </Dialog>

    {/* ── Completion Email Dialog ─────────────────────────────────────────── */}
    <Dialog
      open={completionEmailDialog.open}
      onClose={() => setCompletionEmailDialog({ open: false })}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#3a3a3a',
          borderRadius: 2,
          border: '2px solid #b98f33',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
        }
      }}
    >
      <DialogTitle sx={{
        background: 'linear-gradient(135deg, #b98f33 0%, #8b6b1f 100%)',
        color: '#000000',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        gap: 1
      }}>
        <span style={{ fontSize: '22px' }}>📧</span>
        Send Completion Email
      </DialogTitle>
      <DialogContent sx={{ mt: 2, backgroundColor: '#3a3a3a' }}>
        {/* Order info banner */}
        {completedRowForEmail && (
          <Box sx={{
            p: 2,
            backgroundColor: '#2a2a2a',
            borderRadius: 1,
            borderLeft: '4px solid #b98f33',
            mb: 3,
            textAlign: 'center'
          }}>
            <Typography variant="h6" sx={{ color: '#b98f33', fontWeight: 'bold' }}>
              Invoice: {completedRowForEmail.invoiceNo}
            </Typography>
            <Typography variant="body1" sx={{ color: '#ffffff', fontWeight: 500 }}>
              Customer: {completedRowForEmail.customer}
            </Typography>
          </Box>
        )}
        {/* Email options */}
        <Box sx={{
          p: 2,
          backgroundColor: '#2a2a2a',
          borderRadius: 1,
          borderLeft: '4px solid #b98f33',
          mb: 2
        }}>
          <Typography variant="subtitle1" sx={{ color: '#b98f33', mb: 1.5, fontWeight: 'bold' }}>
            📧 Email Options
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={sendEmailChecked}
                onChange={e => setSendEmailChecked(e.target.checked)}
                sx={{ color: '#b98f33', '&.Mui-checked': { color: '#b98f33' } }}
              />
            }
            label="Send completion email to customer"
            sx={{ color: '#ffffff', display: 'block', mb: 0.5, '& .MuiFormControlLabel-label': { fontWeight: 500 } }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={includeReviewEmail}
                onChange={e => setIncludeReviewEmail(e.target.checked)}
                sx={{ color: '#b98f33', '&.Mui-checked': { color: '#b98f33' } }}
              />
            }
            label="Include Google review request"
            sx={{ color: '#ffffff', display: 'block', ml: 1, '& .MuiFormControlLabel-label': { fontWeight: 500 } }}
          />
          <Typography variant="body2" sx={{ mt: 1.5, color: '#cccccc', fontStyle: 'italic', fontSize: '13px' }}>
            The email will include a warm thank you message, care instructions, and optionally a review request.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ backgroundColor: '#3a3a3a', p: 2, gap: 1 }}>
        <Button
          onClick={() => setCompletionEmailDialog({ open: false })}
          sx={{ color: '#aaaaaa', '&:hover': { color: '#ffffff', backgroundColor: 'rgba(255,255,255,0.05)' } }}
        >
          Skip
        </Button>
        <Button
          variant="contained"
          onClick={handleSendCompletionEmail}
          disabled={sendingCompletionEmail || !sendEmailChecked}
          sx={{
            background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
            color: '#000000',
            fontWeight: 'bold',
            border: '2px solid #b98f33',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 4px 8px rgba(0,0,0,0.3)',
            '&:hover': {
              background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
            },
            '&.Mui-disabled': {
              background: '#333',
              color: '#666',
              border: '2px solid #444',
              boxShadow: 'none',
            },
          }}
        >
          {sendingCompletionEmail
            ? <><CircularProgress size={16} sx={{ color: '#000', mr: 1 }} /> Sending…</>
            : 'Send Email'
          }
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
}
