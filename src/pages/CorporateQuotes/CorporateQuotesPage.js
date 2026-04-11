import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, IconButton, Tooltip, CircularProgress, Avatar,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert,
  ToggleButtonGroup, ToggleButton, Collapse,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  RequestQuote as QuoteIcon,
  Business as BusinessIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as VersionIcon,
  SwapHoriz as ConvertIcon,
  Receipt as ReceiptIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  FileDownload as DownloadIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  collection, getDocs, deleteDoc, doc, query, orderBy,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNotification } from '../../shared/components/Common/NotificationSystem';
import { buttonStyles } from '../../styles/buttonStyles';
import QuoteStep5Review from './steps/QuoteStep5Review';

// ── helpers ──────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  draft:    { label: 'Draft',    color: '#757575', bg: 'rgba(117,117,117,0.12)' },
  sent:     { label: 'Sent',     color: '#1976d2', bg: 'rgba(25,118,210,0.12)' },
  accepted: { label: 'Accepted', color: '#2e7d32', bg: 'rgba(46,125,50,0.12)' },
  rejected: { label: 'Rejected', color: '#c62828', bg: 'rgba(198,40,40,0.12)' },
};

const StatusChip = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <Chip
      label={cfg.label}
      size="small"
      sx={{
        color: cfg.color,
        bgcolor: cfg.bg,
        fontWeight: 'bold',
        border: `1px solid ${cfg.color}40`,
      }}
    />
  );
};

const formatCurrency = (v) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(v || 0);

const calcTotal = (quote) => {
  let subtotal = 0;
  (quote.furnitureGroups || []).forEach((g) => {
    subtotal +=
      (parseFloat(g.materialPrice) || 0) * (parseFloat(g.materialQnty) || 0) +
      (parseFloat(g.labourPrice) || 0) * (parseFloat(g.labourQnty) || 0) +
      (g.foamEnabled ? (parseFloat(g.foamPrice) || 0) * (parseFloat(g.foamQnty) || 0) : 0) +
      (g.paintingEnabled ? (parseFloat(g.paintingLabour) || 0) * (parseFloat(g.paintingQnty) || 0) : 0);
  });
  const pct = parseFloat(quote.tax?.percentage) || 0;
  const taxAmt = quote.tax?.enabled ? subtotal * (pct / 100) : 0;
  return subtotal + taxAmt;
};

const formatDate = (ts) => {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
};

// ── Component ─────────────────────────────────────────────────────────────────

const groupQuotes = (quotesList) => {
  const groups = {};
  quotesList.forEach(q => {
     const baseNum = q.baseQuoteNumber || q.quoteNumber;
     if (!groups[baseNum]) groups[baseNum] = [];
     groups[baseNum].push(q);
  });
  
  return Object.values(groups).map(group => {
     group.sort((a, b) => (b.version || 1) - (a.version || 1));
     return {
        latest: group[0],
        history: group.slice(1)
     };
  }).sort((a, b) => {
     const tA = a.latest.createdAt?.toDate ? a.latest.createdAt.toDate() : new Date(a.latest.createdAt || 0);
     const tB = b.latest.createdAt?.toDate ? b.latest.createdAt.toDate() : new Date(b.latest.createdAt || 0);
     return tB - tA;
  });
};

const QuoteRow = ({ row, onAction }) => {
  const [open, setOpen] = useState(false);
  const { latest, history } = row;
  const hasHistory = history && history.length > 0;

  const renderCells = (quote, isHistoryRow = false) => (
    <React.Fragment>
      {/* Quote # */}
      <TableCell sx={{ textAlign: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {!isHistoryRow && <QuoteIcon sx={{ color: '#b98f33', fontSize: 20 }} />}
            {isHistoryRow && <QuoteIcon sx={{ color: 'action.active', fontSize: 16 }} />}
            <Typography fontWeight="bold" sx={{ color: isHistoryRow ? 'text.primary' : '#b98f33', fontSize: isHistoryRow ? '0.9rem' : '1.05rem' }}>
              {quote.quoteNumber}
            </Typography>
          </Box>
          {(quote.version > 1 || isHistoryRow) && (
            <Chip label={`v${quote.version || 1}`} size="small" sx={{ bgcolor: isHistoryRow ? '#757575' : '#f27921', color: 'white', fontSize: '0.7rem', height: 18 }} />
          )}
        </Box>
      </TableCell>

      {/* Customer */}
      <TableCell sx={{ textAlign: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          {!isHistoryRow && (
            <Avatar sx={{ bgcolor: quote.isTemporaryCustomer ? '#f27921' : '#274290', width: 32, height: 32 }}>
              <BusinessIcon sx={{ fontSize: 16 }} />
            </Avatar>
          )}
          <Box sx={{ textAlign: 'left' }}>
            <Typography variant={isHistoryRow ? "body2" : "subtitle2"} fontWeight={isHistoryRow ? "normal" : "bold"}>
              {quote.corporateCustomer?.corporateName || '—'}
            </Typography>
            {quote.isTemporaryCustomer && !isHistoryRow && (
              <Chip label="Quote Customer" size="small" sx={{ bgcolor: '#f27921', color: 'white', fontSize: '0.65rem', height: 16 }} />
            )}
          </Box>
        </Box>
      </TableCell>

      {/* Contact */}
      <TableCell sx={{ textAlign: 'center' }}>
        <Typography variant="body2">{quote.contactPerson?.name || '—'}</Typography>
        {quote.contactPerson?.position && !isHistoryRow && (
          <Typography variant="caption" color="text.secondary">{quote.contactPerson.position}</Typography>
        )}
      </TableCell>

      {/* Total */}
      <TableCell sx={{ textAlign: 'center' }}>
        <Typography fontWeight={isHistoryRow ? "normal" : "bold"} sx={{ color: isHistoryRow ? 'text.primary' : '#f27921' }}>
          {formatCurrency(calcTotal(quote))}
        </Typography>
        {quote.tax?.enabled && !isHistoryRow && (
          <Typography variant="caption" color="text.secondary">incl. {quote.tax.percentage}% tax</Typography>
        )}
      </TableCell>

      {/* Status */}
      <TableCell sx={{ textAlign: 'center' }}>
        <StatusChip status={quote.status} />
      </TableCell>

      {/* Date */}
      <TableCell sx={{ textAlign: 'center' }}>
        <Typography variant="body2">{formatDate(quote.createdAt)}</Typography>
      </TableCell>

      {/* Actions */}
      <TableCell sx={{ textAlign: 'center' }}>
        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
          <Tooltip title="Download PDF">
            <IconButton size="small" color="primary" onClick={() => onAction('download_pdf', quote)}>
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="View Quote">
            <IconButton size="small" color="primary" onClick={() => onAction('view', quote)}>
              <ViewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit Quote">
            <IconButton size="small" color="primary" onClick={() => onAction('edit', quote)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="New Version">
            <IconButton size="small" sx={{ color: '#b98f33' }} onClick={() => onAction('version', quote)}>
              <VersionIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Convert to Corporate Order">
            <IconButton size="small" sx={{ color: '#2e7d32' }} onClick={() => onAction('convert', quote)}>
              <ConvertIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete Quote">
            <IconButton size="small" color="error" onClick={() => onAction('delete', quote)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </TableCell>
    </React.Fragment>
  );

  return (
    <React.Fragment>
      <TableRow hover sx={{ '& > *': { borderBottom: hasHistory && open ? 'none' : undefined } }}>
        <TableCell sx={{ width: 40, p: 1, textAlign: 'center' }}>
          {hasHistory && (
            <IconButton aria-label="expand row" size="small" onClick={() => setOpen(!open)}>
              {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            </IconButton>
          )}
        </TableCell>
        {renderCells(latest, false)}
      </TableRow>
      {hasHistory && (
        <TableRow>
          <TableCell style={{ paddingBottom: 0, paddingTop: 0, backgroundColor: 'rgba(0,0,0,0.02)' }} colSpan={8}>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <Box sx={{ margin: 2, p: 2, borderLeft: '4px solid #b98f33', bgcolor: 'background.paper', borderRadius: 1, boxShadow: 1 }}>
                <Typography variant="subtitle2" gutterBottom component="div" sx={{ fontWeight: 'bold', color: '#b98f33', display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <VersionIcon fontSize="small" /> Previous Versions
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {['Quote #', 'Customer', 'Contact', 'Total', 'Status', 'Date', 'Actions'].map(h => (
                        <TableCell key={h} sx={{ fontWeight: 'bold', color: 'text.secondary', textAlign: 'center' }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {history.map((historyRow) => (
                      <TableRow key={historyRow.id} hover>
                        {renderCells(historyRow, true)}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </React.Fragment>
  );
};

const calculateCorporateQuoteTotals = (quote) => {
  let subtotal = 0;
  (quote.furnitureGroups || []).forEach((g) => {
    subtotal +=
      (parseFloat(g.materialPrice) || 0) * (parseFloat(g.materialQnty) || 0) +
      (parseFloat(g.labourPrice) || 0) * (parseFloat(g.labourQnty) || 0) +
      (g.foamEnabled ? (parseFloat(g.foamPrice) || 0) * (parseFloat(g.foamQnty) || 0) : 0) +
      (g.paintingEnabled ? (parseFloat(g.paintingLabour) || 0) * (parseFloat(g.paintingQnty) || 0) : 0);
  });
  const pct = parseFloat(quote.tax?.percentage) || 13;
  const taxAmt = quote.tax?.enabled ? subtotal * (pct / 100) : 0;
  
  return {
    subtotal: subtotal,
    tax: taxAmt,
    total: subtotal + taxAmt,
    taxPercentage: pct
  };
};

const getCorporateQuotePrintHtml = (quote, totals) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Corporate Quote - ${quote.quoteNumber || 'N/A'}</title>
      <style>
        body {
          -webkit-print-color-adjust: exact;
          color-adjust: exact;
          print-color-adjust: exact;
          background: white !important;
          margin: 0;
          padding: 0;
          font-family: Arial, sans-serif;
        }
        .invoice-header img { max-height: 100px !important; width: 100% !important; object-fit: contain !important; display: block !important; }
        .invoice-footer img { max-height: 100px !important; width: 100% !important; object-fit: contain !important; display: block !important; }
        .terms-header { background-color: #cc820d !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .terms-header * { color: white !important; }
        .total-box { background-color: #b98f33 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .total-box * { color: white !important; }
      </style>
    </head>
    <body>
      <div class="invoice-container" style="width: 100%; min-height: 100%; display: flex; flex-direction: column;">
        <div class="invoice-header" style="margin-bottom: 16px; position: relative; overflow: hidden; width: 100%; display: flex; justify-content: center; align-items: center;">
          <img src="${window.location.origin}/assets/images/invoice-headers/Invoice Header.png" alt="Invoice Header" style="width: 100%; height: auto; max-width: 100%; object-fit: contain; display: block;" />
        </div>
        <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start;">
          <div style="flex: 1; margin-right: 16px;">
            <h6 style="font-weight: bold; color: black; margin-bottom: 8px; font-size: 18px;">Quote Prepared For:</h6>
            <h5 style="font-weight: bold; margin-bottom: 8px; color: black; font-size: 20px;">${quote.corporateCustomer?.corporateName || 'N/A'}</h5>
            ${quote.contactPerson?.name ? `<div style="display: flex; align-items: center; margin-bottom: 4px;"><span style="color: black;">${quote.contactPerson.name}</span></div>` : ''}
            ${quote.contactPerson?.phone ? `<div style="display: flex; align-items: center; margin-bottom: 4px;"><span style="color: black;">${quote.contactPerson.phone}</span></div>` : ''}
            ${quote.contactPerson?.email ? `<div style="display: flex; align-items: center; margin-bottom: 4px;"><span style="color: black;">${quote.contactPerson.email}</span></div>` : ''}
            ${quote.corporateCustomer?.address ? `<div style="display: flex; align-items: flex-start; margin-bottom: 4px;"><span style="white-space: pre-line; color: black;">${quote.corporateCustomer.address}</span></div>` : ''}
          </div>
          <div style="min-width: 250px; flex-shrink: 0;">
            <div style="color: black; margin-bottom: 4px;"><strong>Date:</strong> ${new Date(quote.createdAt?.toDate ? quote.createdAt.toDate() : quote.createdAt || new Date()).toLocaleDateString('en-CA')}</div>
            <div style="color: black; margin-bottom: 4px;"><strong>Quote #</strong> ${quote.quoteNumber || 'N/A'}</div>
            <div style="color: black; margin-bottom: 4px;"><strong>Tax #</strong> 798633319-RT0001</div>
          </div>
        </div>
        <div style="margin-bottom: 16px;">
          <div style="border: 2px solid #333333; border-radius: 0; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <table style="width: 100%; border-collapse: collapse; background-color: white; table-layout: fixed;">
              <thead>
                <tr style="background-color: #f5f5f5;">
                  <th style="width: 66.67%; padding: 8px 16px; text-align: left; font-weight: bold; color: #333333; background-color: #f5f5f5; border: none; border-bottom: 2px solid #333333; border-right: 1px solid #ddd; font-size: 14px;">Description</th>
                  <th style="width: 11.11%; padding: 8px 16px; text-align: center; font-weight: bold; color: #333333; background-color: #f5f5f5; border: none; border-bottom: 2px solid #333333; border-right: 1px solid #ddd; font-size: 14px;">Price</th>
                  <th style="width: 11.11%; padding: 8px 16px; text-align: center; font-weight: bold; color: #333333; background-color: #f5f5f5; border: none; border-bottom: 2px solid #333333; border-right: 1px solid #ddd; font-size: 14px;">Qty</th>
                  <th style="width: 11.11%; padding: 8px 16px; text-align: right; font-weight: bold; color: #333333; background-color: #f5f5f5; border: none; border-bottom: 2px solid #333333; font-size: 14px;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${(() => {
                  const furnitureGroups = quote.furnitureGroups || [];
                  let rows = '';
                  if (furnitureGroups.length === 0) {
                    rows = '<tr><td colspan="4" style="padding: 16px; text-align: center; color: #666666; font-style: italic;">No items found</td></tr>';
                  } else {
                    furnitureGroups.forEach((group, groupIndex) => {
                      rows += `<tr style="background-color: #f8f9fa;"><td colspan="4" style="font-weight: bold; color: #274290; padding: 10px 16px; text-transform: uppercase; border: none; border-bottom: 1px solid #ddd;">${group.furnitureType || 'Furniture Group ' + (groupIndex + 1)}</td></tr>`;
                      const groupItems = [];
                      if (group.furniture && Array.isArray(group.furniture)) {
                        group.furniture.forEach((furniture, furnitureIndex) => {
                          if (furniture.price && furniture.quantity) {
                            groupItems.push({ name: furniture.name || 'Furniture Item ' + (furnitureIndex + 1), price: parseFloat(furniture.price) || 0, quantity: parseFloat(furniture.quantity) || 0 });
                          }
                        });
                      }
                      if (group.materialPrice && group.materialQnty && parseFloat(group.materialPrice) > 0) {
                        groupItems.push({ name: (group.materialCompany || 'Material') + ' - ' + (group.materialCode || 'Code'), price: parseFloat(group.materialPrice) || 0, quantity: parseFloat(group.materialQnty) || 0 });
                      }
                      if (group.labourPrice && group.labourQnty && parseFloat(group.labourPrice) > 0) {
                        groupItems.push({ name: 'Labour Work' + (group.labourNote ? ' - ' + group.labourNote : ''), price: parseFloat(group.labourPrice) || 0, quantity: parseFloat(group.labourQnty) || 0 });
                      }
                      if (group.foamEnabled && group.foamPrice && group.foamQnty && parseFloat(group.foamPrice) > 0) {
                        groupItems.push({ name: 'Foam' + (group.foamNote ? ' - ' + group.foamNote : ''), price: parseFloat(group.foamPrice) || 0, quantity: parseFloat(group.foamQnty) || 0 });
                      }
                      if (group.paintingEnabled && group.paintingLabour && group.paintingQnty && parseFloat(group.paintingLabour) > 0) {
                        groupItems.push({ name: 'Painting' + (group.paintingNote ? ' - ' + group.paintingNote : ''), price: parseFloat(group.paintingLabour) || 0, quantity: parseFloat(group.paintingQnty) || 0 });
                      }
                      groupItems.forEach(item => {
                        const rowTotal = item.price * item.quantity;
                        rows += `<tr><td style="padding: 8px 16px; border: none; border-bottom: 1px solid #ddd; color: black;">${item.name}</td><td style="padding: 8px 16px; text-align: center; border: none; border-bottom: 1px solid #ddd; color: black;">$${item.price.toFixed(2)}</td><td style="padding: 8px 16px; text-align: center; border: none; border-bottom: 1px solid #ddd; color: black;">${item.quantity}</td><td style="padding: 8px 16px; text-align: right; border: none; border-bottom: 1px solid #ddd; color: black;">$${rowTotal.toFixed(2)}</td></tr>`;
                      });
                    });
                  }
                  return rows;
                })()}
              </tbody>
            </table>
          </div>
        </div>
        <div style="margin-top: 4px;">
          <div style="display: flex; width: 100%; gap: 16px;">
            <div style="flex: 0 0 50%; max-width: 50%;">
              <div class="terms-header" style="background-color: #cc820d; color: white; padding: 8px; margin-bottom: 8px;">
                <h6 style="font-weight: bold; color: white; text-align: center; text-transform: uppercase; margin: 0; font-size: 16px;">Terms and Conditions</h6>
              </div>
              <div style="display: flex; flex-direction: column; gap: 8px;">
                ${(quote.selectedTerms && quote.selectedTerms.length > 0) ? 
                  quote.selectedTerms.map(term => `<div style="color: black; margin-bottom: 4px; font-size: 10px;">• ${term.text}</div>`).join('') :
                  `<div><p style="font-weight: bold; color: black; margin: 0 0 4px 0; font-size: 12px;">Valid for 30 Days</p><p style="color: black; margin: 0; font-size: 10px;">This quote is subject to change after 30 days.</p></div>`
                }
              </div>
            </div>
            <div style="flex: 1; display: flex; justify-content: flex-end; align-items: flex-start;">
              <div style="min-width: 300px; max-width: 400px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span style="color: black; font-size: 14px;">Subtotal:</span><span style="font-weight: bold; color: black; font-size: 14px;">$${totals.subtotal.toFixed(2)}</span></div>
                ${quote.tax?.enabled ? `<div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span style="color: black; font-size: 14px;">Tax Rate:</span><span style="font-weight: bold; color: black; font-size: 14px;">${totals.taxPercentage}%</span></div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span style="color: black; font-size: 14px;">Tax Due:</span><span style="font-weight: bold; color: black; font-size: 14px;">$${totals.tax.toFixed(2)}</span></div>` : ''}
                <div class="total-box" style="display: flex; justify-content: space-between; background-color: #b98f33; color: white; padding: 8px; border-radius: 4px; margin-top: 8px;"><span style="font-weight: bold; color: white; font-size: 14px;">Total Estimated:</span><span style="font-weight: bold; color: white; font-size: 14px;">$${totals.total.toFixed(2)}</span></div>
              </div>
            </div>
          </div>
        </div>
        ${quote.notes ? `
        <div style="margin-top: 20px; border: 1px solid #ddd; padding: 12px;">
           <h6 style="font-weight: bold; margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase;">Additional Notes</h6>
           <p style="white-space: pre-wrap; font-size: 13px; margin: 0;">${quote.notes}</p>
        </div>` : ''}
        <div class="invoice-footer" style="margin-top: 24px; width: 100%; display: flex; justify-content: center; align-items: center;">
          <img src="${window.location.origin}/assets/images/invoice-headers/invoice Footer.png" alt="Invoice Footer" style="width: 100%; height: auto; max-width: 100%; object-fit: contain; display: block;" />
        </div>
      </div>
    </body>
    </html>
  `;
};

const CorporateQuotesPage = () => {
  const navigate = useNavigate();
  const { showSuccess, showError, showConfirm } = useNotification();

  const [quotes, setQuotes]               = useState([]);
  const [filteredQuotes, setFilteredQuotes] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [searchTerm, setSearchTerm]       = useState('');
  const [statusFilter, setStatusFilter]   = useState('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState(null);
  const [deleting, setDeleting]           = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchQuotes = useCallback(async () => {
    try {
      setLoading(true);
      const snap = await getDocs(
        query(collection(db, 'corporate-quotes'), orderBy('createdAt', 'desc')),
      );
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setQuotes(data);
      setFilteredQuotes(applyFilters(data, searchTerm, statusFilter));
    } catch (e) {
      console.error(e);
      showError('Failed to fetch quotes');
      setQuotes([]);
      setFilteredQuotes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchQuotes(); }, [fetchQuotes]);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const applyFilters = (list, search, status) => {
    let result = [...list];
    if (status !== 'all') result = result.filter(q => q.status === status);
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(q =>
        q.quoteNumber?.toLowerCase().includes(s) ||
        q.corporateCustomer?.corporateName?.toLowerCase().includes(s) ||
        q.contactPerson?.name?.toLowerCase().includes(s),
      );
    }
    return result;
  };

  const handleSearch = (v) => {
    setSearchTerm(v);
    setFilteredQuotes(applyFilters(quotes, v, statusFilter));
  };

  const handleStatusFilter = (_, v) => {
    const filter = v || 'all';
    setStatusFilter(filter);
    setFilteredQuotes(applyFilters(quotes, searchTerm, filter));
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!quoteToDelete) return;
    try {
      setDeleting(true);
      await deleteDoc(doc(db, 'corporate-quotes', quoteToDelete.id));
      setQuotes(prev => prev.filter(q => q.id !== quoteToDelete.id));
      setFilteredQuotes(prev => prev.filter(q => q.id !== quoteToDelete.id));
      showSuccess('Quote deleted');
      setDeleteDialogOpen(false);
      setQuoteToDelete(null);
    } catch (e) {
      showError('Failed to delete quote');
    } finally {
      setDeleting(false);
    }
  };

  // ── New Version ────────────────────────────────────────────────────────────
  const handleNewVersion = (quote) => {
    navigate('/admin/corporate-quotes/new', {
      state: {
        versionMode: true,
        sourceQuoteData: quote,
      },
    });
  };

  // ── Convert to Order ───────────────────────────────────────────────────────
  const handleConvertToOrder = (quote) => {
    navigate('/admin/orders/corporate', {
      state: {
        duplicateMode: true,
        orderData: {
          corporateCustomer: quote.corporateCustomer,
          contactPerson: quote.contactPerson,
          furnitureGroups: quote.furnitureGroups,
          paymentDetails: { deposit: 0, amountPaid: 0 },
          orderDetails: { billInvoice: '', orderType: 'corporate' },
        },
        activeStep: 1,
      },
    });
  };

  // ── Print PDF ──────────────────────────────────────────────────────────────
  const handleDownloadPdf = async (quote) => {
    if (!quote) return;
    const fileName = `Quote ${quote.quoteNumber || 'N/A'}.pdf`;

    try {
      showSuccess('Generating PDF...');
      const totals = calculateCorporateQuoteTotals(quote);
      const htmlContent = getCorporateQuotePrintHtml(quote, totals);

      const iframe = document.createElement('iframe');
      iframe.id = 'corporate-quote-pdf-iframe';
      iframe.style.cssText = 'position:fixed;left:-9999px;width:800px;height:1200px;border:none;';
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow.document;
      doc.open();
      doc.write(htmlContent);
      doc.close();

      await new Promise((resolve) => {
        iframe.onload = resolve;
        if (iframe.contentDocument.readyState === 'complete') resolve();
        else setTimeout(resolve, 1500);
      });

      const body = iframe.contentDocument.body;
      const canvas = await html2canvas(body, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: body.scrollWidth,
        windowHeight: body.scrollHeight,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - margin * 2;

      while (heightLeft > 0) {
        pdf.addPage();
        position = -heightLeft + margin;
        pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
        heightLeft -= pageHeight - margin * 2;
      }

      pdf.save(fileName);
      document.body.removeChild(iframe);
      showSuccess('PDF downloaded successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      showError('Failed to download PDF');
      const iframeEl = document.getElementById('corporate-quote-pdf-iframe');
      if (iframeEl && iframeEl.parentNode) iframeEl.parentNode.removeChild(iframeEl);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  
  const handleAction = (action, quote) => {
    switch (action) {
      case 'download_pdf':
        handleDownloadPdf(quote);
        break;
      case 'view':
        setSelectedQuote(quote);
        setViewDialogOpen(true);
        break;
      case 'edit':
        navigate('/admin/corporate-quotes/new', { state: { editMode: true, sourceQuoteData: quote } });
        break;
      case 'version':
        handleNewVersion(quote);
        break;
      case 'convert':
        handleConvertToOrder(quote);
        break;
      case 'delete':
        setQuoteToDelete(quote);
        setDeleteDialogOpen(true);
        break;
      default:
        break;
    }
  };

  const groupedQuotes = groupQuotes(filteredQuotes);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress sx={{ color: '#b98f33' }} size={60} />
      </Box>
    );
  }

  const statusCounts = {
    all:      quotes.length,
    draft:    quotes.filter(q => q.status === 'draft').length,
    sent:     quotes.filter(q => q.status === 'sent').length,
    accepted: quotes.filter(q => q.status === 'accepted').length,
    rejected: quotes.filter(q => q.status === 'rejected').length,
  };

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
            Corporate Quotes
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {quotes.length} quote{quotes.length !== 1 ? 's' : ''} total
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchQuotes} sx={{ color: '#b98f33' }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/admin/corporate-quotes/new')}
            sx={{ ...buttonStyles.primaryButton, fontWeight: 'bold', minWidth: 150 }}
          >
            New Quote
          </Button>
        </Box>
      </Box>

      {/* Status filter + search */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Search by quote #, customer, contact..."
          value={searchTerm}
          onChange={e => handleSearch(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>,
            endAdornment: searchTerm && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => handleSearch('')}><RefreshIcon fontSize="small" /></IconButton>
              </InputAdornment>
            ),
          }}
          sx={{ width: 300, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        />

        <ToggleButtonGroup
          value={statusFilter}
          exclusive
          onChange={handleStatusFilter}
          size="small"
          sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 'bold' }, '& .Mui-selected': { bgcolor: '#b98f33 !important', color: '#000 !important' } }}
        >
          {[
            { val: 'all', label: `All (${statusCounts.all})` },
            { val: 'draft', label: `Draft (${statusCounts.draft})` },
            { val: 'sent', label: `Sent (${statusCounts.sent})` },
            { val: 'accepted', label: `Accepted (${statusCounts.accepted})` },
            { val: 'rejected', label: `Rejected (${statusCounts.rejected})` },
          ].map(({ val, label }) => (
            <ToggleButton key={val} value={val}>{label}</ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {/* Table */}
      <TableContainer component={Paper} sx={{ boxShadow: 2, flex: 1 }}>
        <Table>
          <TableHead sx={{ bgcolor: '#274290' }}>
            <TableRow>
              <TableCell sx={{ width: 40 }} />
              {['Quote #', 'Customer', 'Contact', 'Total', 'Status', 'Date', 'Actions'].map(h => (
                <TableCell key={h} sx={{ color: 'white', fontWeight: 'bold', textAlign: 'center' }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {groupedQuotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} sx={{ textAlign: 'center', py: 6 }}>
                  <QuoteIcon sx={{ fontSize: 56, color: 'rgba(185,143,51,0.3)', mb: 1 }} />
                  <Typography variant="h6" color="text.secondary">
                    {searchTerm || statusFilter !== 'all' ? 'No quotes match your filters' : 'No quotes yet'}
                  </Typography>
                  {!searchTerm && statusFilter === 'all' && (
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => navigate('/admin/corporate-quotes/new')}
                      sx={{ ...buttonStyles.primaryButton, mt: 2, fontWeight: 'bold' }}
                    >
                      Create First Quote
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ) : groupedQuotes.map((group) => (
              <QuoteRow key={group.latest.id} row={group} onAction={handleAction} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="lg" fullWidth
        sx={{ '& .MuiDialog-paper': { maxHeight: '90vh' } }}>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <QuoteIcon sx={{ color: '#b98f33' }} />
            <Typography variant="h6">
              {selectedQuote?.quoteNumber}
            </Typography>
            {selectedQuote && <StatusChip status={selectedQuote.status} />}
          </Box>
        </DialogTitle>
        <DialogContent sx={{ overflow: 'auto' }}>
          {selectedQuote && (
            <QuoteStep5Review
              quoteNumber={selectedQuote.quoteNumber}
              selectedCustomer={selectedQuote.corporateCustomer}
              isTemporaryCustomer={selectedQuote.isTemporaryCustomer}
              selectedContactPerson={selectedQuote.contactPerson}
              furnitureGroups={selectedQuote.furnitureGroups}
              selectedTerms={selectedQuote.selectedTerms || []}
              tax={selectedQuote.tax || { enabled: false, percentage: 0 }}
              notes={selectedQuote.notes}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
          {selectedQuote && (
            <>
              <Button
                onClick={() => handleDownloadPdf(selectedQuote)}
                sx={{ color: '#1976d2', fontWeight: 'bold' }}
                startIcon={<DownloadIcon />}
              >
                Download PDF
              </Button>
              <Button
                onClick={() => { setViewDialogOpen(false); handleNewVersion(selectedQuote); }}
                sx={{ color: '#b98f33', fontWeight: 'bold' }}
                startIcon={<VersionIcon />}
              >
                New Version
              </Button>
              <Button
                variant="contained"
                onClick={() => { setViewDialogOpen(false); handleConvertToOrder(selectedQuote); }}
                sx={{ bgcolor: '#2e7d32', '&:hover': { bgcolor: '#1b5e20' }, fontWeight: 'bold' }}
                startIcon={<ConvertIcon />}
              >
                Convert to Order
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Delete Quote</DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 1 }}>
            Are you sure you want to delete quote <strong>{quoteToDelete?.quoteNumber}</strong>?
            This action cannot be undone.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            disabled={deleting}
            onClick={handleDeleteConfirm}
          >
            {deleting ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CorporateQuotesPage;
