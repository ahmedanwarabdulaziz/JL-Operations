import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, CircularProgress, IconButton, Tooltip,
  Collapse, Select, MenuItem, FormControl, TextField, InputAdornment
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import TableChartIcon from '@mui/icons-material/TableChart';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import HomeIcon from '@mui/icons-material/Home';
import { collection, getDocs, query, orderBy, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../shared/firebase/config';
import { toDateObject, formatDateOnly } from '../../../utils/dateUtils';
import { calculateOrderTotal } from '../../../shared/utils/orderCalculations';

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



        setRows(built);

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

  // ── Update status in Firestore and local state ──────────────────────────────
  const handleStatusChange = async (row, newStatusValue) => {
    if (!newStatusValue || newStatusValue === row.status) {
      setEditingStatusId(null);
      return;
    }
    try {
      // Determine the correct Firestore collection
      let collectionName;
      if (row.isTInvoice) {
        collectionName = 'customer-invoices';
      } else if (row.isCorp) {
        collectionName = 'corporate-orders';
      } else {
        collectionName = 'orders';
      }
      const ref = doc(db, collectionName, row.id);
      await updateDoc(ref, { invoiceStatus: newStatusValue, statusUpdatedAt: new Date() });
      // Update local rows immediately
      const newLabel = invoiceStatuses.find(s => s.value === newStatusValue)?.label || newStatusValue;
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: newLabel } : r));
    } catch (err) {
      console.error('Status update error', err);
    } finally {
      setEditingStatusId(null);
    }
  };

  // ── Save internal note to Firestore ────────────────────────────────────────
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
          <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 'bold', minWidth: 140, textAlign: 'center' }}>
            {MONTH_NAMES[month - 1]} {year}
          </Typography>
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
  );
}
