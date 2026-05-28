import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Card,
  CardContent,
  Grid,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  Avatar,
  Alert,
  CircularProgress,
  Chip
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Person as PersonIcon,
  Receipt as ReceiptIcon,
  CalendarToday as CalendarIcon,
  Print as PrintIcon,
  Archive as ArchiveIcon,
  FileDownload as DownloadIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../../../shared/components/Common/NotificationSystem';
import { collection, getDocs, deleteDoc, doc, query, orderBy, addDoc, getDoc, updateDoc } from 'firebase/firestore';
import { validateCustomerInvoiceNumber, getNextCustomerInvoiceNumber } from '../../../utils/invoiceNumberUtils';
import { db } from '../../../firebase/config';
import { buttonStyles } from '../../../styles/buttonStyles';
import { formatDate, formatDateOnly, toDateObject } from '../../../utils/dateUtils';
import { calculateOrderTotal } from '../../../utils/orderCalculations';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// ─── Module-level sort (no stale-closure risk) ────────────────────────────────
// Sort invoices by createdAt newest-first. Uses the same toDateObject helper
// as the Date column so sort order always matches what is displayed.
// Falls back to invoice number descending for records without a date.
const _getInvoiceNumberValue = (inv) => {
  const num = inv.invoiceNumber ? String(inv.invoiceNumber) : '';
  if (num.startsWith('T-')) return parseInt(num.substring(2), 10) || 0;
  return parseInt(num, 10) || 0;
};

const sortInvoicesByDate = (invoicesList) =>
  [...invoicesList].sort((a, b) => {
    const dA = toDateObject(a.createdAt);
    const dB = toDateObject(b.createdAt);
    if (dA && dB) return dB.getTime() - dA.getTime(); // both dated: newest first
    if (dA) return -1;                                 // only a has date: a first
    if (dB) return 1;                                  // only b has date: b first
    return _getInvoiceNumberValue(b) - _getInvoiceNumberValue(a); // fallback
  });
// ─────────────────────────────────────────────────────────────────────────────

const CustomerInvoicesPage = () => {
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [createInvoiceDialogOpen, setCreateInvoiceDialogOpen] = useState(false);
  const [availableOrders, setAvailableOrders] = useState([]);
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [closeInvoiceDialogOpen, setCloseInvoiceDialogOpen] = useState(false);
  const [invoiceToClose, setInvoiceToClose] = useState(null);

  const { showSuccess, showError, showConfirm } = useNotification();
  const navigate = useNavigate();

  // Fetch orders from Firebase for invoice creation (ALL orders without T-invoicing)
  const fetchOrders = useCallback(async () => {
    try {
      // Fetch from both orders and done-orders collections
      const [ordersSnapshot, doneOrdersSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'orders'), orderBy('orderDetails.billInvoice', 'desc'))),
        getDocs(query(collection(db, 'done-orders'), orderBy('orderDetails.billInvoice', 'desc')))
      ]);
      
      const ordersData = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const doneOrdersData = doneOrdersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Combine all orders (all statuses, not just done)
      const allOrders = [...ordersData, ...doneOrdersData];
      setOrders(allOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      showError('Failed to fetch orders');
    }
  }, []);

  // Fetch invoices from Firebase
  const fetchInvoices = useCallback(async () => {
    try {
      console.log('Starting to fetch customer invoices...');
      setLoading(true);
      
      const invoicesCollection = collection(db, 'customer-invoices');
      const invoicesQuery = query(invoicesCollection);
      const invoicesSnapshot = await getDocs(invoicesQuery);
      const invoicesData = invoicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      console.log('Invoices data received:', invoicesData);
      
      // Fetch order numbers for invoices that don't have originalOrderNumber
      const invoicesWithOrderNumbers = await Promise.all(
        invoicesData.map(async (invoice) => {
          if (invoice.originalOrderNumber) {
            return invoice; // Already has order number
          }
          
          // Fetch the original order to get the order number
          try {
            if (invoice.originalOrderId) {
              const ordersCollection = collection(db, 'orders');
              const orderDoc = await getDoc(doc(ordersCollection, invoice.originalOrderId));
              if (orderDoc.exists()) {
                const orderData = orderDoc.data();
                return {
                  ...invoice,
                  originalOrderNumber: orderData.orderDetails?.billInvoice || 'N/A'
                };
              }
            }
            return invoice;
          } catch (error) {
            console.error('Error fetching order number for invoice:', invoice.id, error);
            return invoice;
          }
        })
      );
      
      // Sort by creation date (newest first)
      const sortedInvoices = sortInvoicesByDate(invoicesWithOrderNumbers);
      console.log('Sorted invoices with order numbers:', sortedInvoices);
      
      setInvoices(sortedInvoices);
      setFilteredInvoices(sortedInvoices);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      showError(`Failed to fetch invoices: ${error.message}`);
      setInvoices([]);
      setFilteredInvoices([]);
    } finally {
      console.log('Setting loading to false');
      setLoading(false);
    }
  }, []);

  // Update available orders when invoices change
  const updateAvailableOrders = useCallback(() => {
    const ordersWithoutInvoices = orders.filter(order => {
      // Exclude orders that already have a T-invoice (check both invoices and hasTInvoice flag)
      const hasTInvoice = invoices.some(invoice => {
        const isTFormat = invoice.invoiceNumber && String(invoice.invoiceNumber).startsWith('T-');
        return isTFormat && invoice.originalOrderId === order.id;
      });
      const orderHasTInvoiceFlag = order.hasTInvoice === true;
      return !hasTInvoice && !orderHasTInvoiceFlag;
    });
    setAvailableOrders(ordersWithoutInvoices);
  }, [orders, invoices]);

  // Filter orders based on search term
  const getFilteredOrders = useCallback(() => {
    if (!orderSearchTerm.trim()) {
      return availableOrders;
    }
    
    const searchLower = orderSearchTerm.toLowerCase();
    return availableOrders.filter(order => {
      // Search by bill/invoice number
      if (order.orderDetails?.billInvoice?.toLowerCase().includes(searchLower)) {
        return true;
      }
      
      // Search by customer name
      if (order.personalInfo?.customerName?.toLowerCase().includes(searchLower)) {
        return true;
      }
      
      // Search by customer email
      if (order.personalInfo?.email?.toLowerCase().includes(searchLower)) {
        return true;
      }
      
      // Search by customer phone
      if (order.personalInfo?.phone?.toLowerCase().includes(searchLower)) {
        return true;
      }
      
      return false;
    });
  }, [availableOrders, orderSearchTerm]);

  useEffect(() => {
    fetchInvoices();
    fetchOrders();
  }, [fetchInvoices, fetchOrders]);

  // Update available orders when invoices or orders change
  useEffect(() => {
    if (orders.length > 0 && invoices.length >= 0) {
      updateAvailableOrders();
    }
  }, [orders, invoices, updateAvailableOrders]);

  // Global search function
  const handleSearch = (searchValue) => {
    setSearchTerm(searchValue);
    
    if (!searchValue.trim()) {
      setFilteredInvoices(sortInvoicesByDate([...invoices]));
      return;
    }

    const searchLower = searchValue.toLowerCase();
    const filtered = invoices.filter(invoice => {
      // Search in invoice number
      if (invoice.invoiceNumber?.toLowerCase().includes(searchLower)) {
        return true;
      }

      // Search in customer info (original and current)
      if (
        invoice.originalCustomerInfo?.customerName?.toLowerCase().includes(searchLower) ||
        invoice.originalCustomerInfo?.email?.toLowerCase().includes(searchLower) ||
        invoice.originalCustomerInfo?.phone?.toLowerCase().includes(searchLower) ||
        invoice.originalCustomerInfo?.address?.toLowerCase().includes(searchLower) ||
        invoice.customerInfo?.customerName?.toLowerCase().includes(searchLower) ||
        invoice.customerInfo?.email?.toLowerCase().includes(searchLower) ||
        invoice.customerInfo?.phone?.toLowerCase().includes(searchLower) ||
        invoice.customerInfo?.address?.toLowerCase().includes(searchLower)
      ) {
        return true;
      }

      // Search in order reference
      if (invoice.originalOrderNumber?.toLowerCase().includes(searchLower) ||
          invoice.originalOrderId?.toLowerCase().includes(searchLower)) {
        return true;
      }

      return false;
    });

    // Sort filtered results by creation date (newest first)
    const sortedFiltered = sortInvoicesByDate(filtered);
    setFilteredInvoices(sortedFiltered);
  };

  // Handle invoice deletion
  const handleDeleteInvoice = async () => {
    if (!invoiceToDelete) return;

    try {
      setDeleting(true);
      const invoicesCollection = collection(db, 'customer-invoices');
      
      // Check if this is a T-invoice (starts with T-)
      const isTInvoice = invoiceToDelete.invoiceNumber && String(invoiceToDelete.invoiceNumber).startsWith('T-');
      const originalOrderId = invoiceToDelete.originalOrderId;
      
      // Delete the invoice
      await deleteDoc(doc(invoicesCollection, invoiceToDelete.id));
      
      setInvoices(prev => prev.filter(invoice => invoice.id !== invoiceToDelete.id));
      setFilteredInvoices(prev => prev.filter(invoice => invoice.id !== invoiceToDelete.id));

      // If it's a T-invoice, restore the original order by removing hasTInvoice flag
      if (isTInvoice && originalOrderId) {
        try {
          const orderRef = doc(db, 'orders', originalOrderId);
          const orderDoc = await getDoc(orderRef);
          
          if (orderDoc.exists()) {
            await updateDoc(orderRef, {
              hasTInvoice: false,
              tInvoiceId: null
            });
            
            // Update local state
            setOrders(prevOrders =>
              prevOrders.map(order =>
                order.id === originalOrderId
                  ? { ...order, hasTInvoice: false, tInvoiceId: null }
                  : order
              )
            );
          }
        } catch (orderError) {
          console.error('Error restoring original order:', orderError);
          // Don't fail the deletion if order update fails
        }
      }

      await clearInvoiceNumberReferences(invoiceToDelete);
      
      showSuccess('Invoice deleted successfully');
      setDeleteDialogOpen(false);
      setInvoiceToDelete(null);
    } catch (error) {
      console.error('Error deleting invoice:', error);
      showError('Failed to delete invoice');
    } finally {
      setDeleting(false);
    }
  };

  const parseInvoiceNumberValue = (value) => {
    if (value === null || value === undefined) return null;
    const match = String(value).match(/\d+/);
    if (!match) return null;
    const parsed = parseInt(match[0], 10);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const clearInvoiceNumberReferences = useCallback(async (invoice) => {
    const invoiceNumber = parseInvoiceNumberValue(invoice?.invoiceNumber);
    const originalOrderId = invoice?.originalOrderId;

    if (!invoiceNumber) {
      return;
    }

    const collectionsToCheck = [
      { name: 'orders', id: originalOrderId },
      { name: 'corporate-orders', id: originalOrderId },
      { name: 'done-orders', id: originalOrderId }
    ];

    let referencesCleared = 0;

    for (const { name, id } of collectionsToCheck) {
      if (!id) continue;

      try {
        const referenceDocRef = doc(db, name, id);
        const referenceSnapshot = await getDoc(referenceDocRef);

        if (referenceSnapshot.exists()) {
          const data = referenceSnapshot.data();
          const existingNumber = parseInvoiceNumberValue(data?.orderDetails?.billInvoice);

          if (existingNumber === invoiceNumber) {
            await updateDoc(referenceDocRef, {
              'orderDetails.billInvoice': null,
              'orderDetails.lastUpdated': new Date()
            });
            referencesCleared += 1;
          }
        }
      } catch (error) {
        console.error(`Error clearing invoice number from ${name}/${id}:`, error);
      }
    }

    if (referencesCleared > 0) {
      setOrders(prevOrders =>
        prevOrders.map(order => {
          if (order.id !== originalOrderId) return order;

          const currentNumber = parseInvoiceNumberValue(order.orderDetails?.billInvoice);
          if (currentNumber !== invoiceNumber) return order;

          return {
            ...order,
            orderDetails: {
              ...order.orderDetails,
              billInvoice: null,
              lastUpdated: new Date()
            }
          };
        })
      );
    }
  }, []);

  // Handle close invoice (move to taxed invoices)
  const handleCloseInvoice = async () => {
    if (!invoiceToClose) return;

    try {
      // Create a copy of the invoice with additional metadata for taxed invoices
      const taxedInvoiceData = {
        ...invoiceToClose,
        closedAt: new Date(),
        originalInvoiceId: invoiceToClose.id,
        source: 'customer_invoice'
      };
      
      // Add to taxed invoices collection
      await addDoc(collection(db, 'taxedInvoices'), taxedInvoiceData);
      
      // Remove from customer-invoices collection (since it's now closed)
      await deleteDoc(doc(db, 'customer-invoices', invoiceToClose.id));
      
      // Update local state
      setInvoices(prev => prev.filter(invoice => invoice.id !== invoiceToClose.id));
      setFilteredInvoices(prev => prev.filter(invoice => invoice.id !== invoiceToClose.id));
      
      showSuccess('Invoice archived to taxed invoices!');
      setCloseInvoiceDialogOpen(false);
      setInvoiceToClose(null);
      
    } catch (error) {
      console.error('Error closing invoice:', error);
      showError('Failed to close invoice');
    }
  };

  // Calculate invoice total
  const calculateInvoiceTotal = (invoice) => {
    // Use the saved total from invoice calculations if available
    if (invoice.calculations?.total !== undefined) {
      return invoice.calculations.total;
    }

    // Fallback: calculate manually if saved total is not available
    const subtotal = invoice.items?.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.price) || 0;
      return sum + (quantity * price);
    }, 0) || 0;

    const taxRate = parseFloat(invoice.headerSettings?.taxPercentage) || 0;
    const taxAmount = (subtotal * taxRate) / 100;

    const ccFeeEnabled = invoice.headerSettings?.creditCardFeeEnabled || false;
    const ccFeeRate = parseFloat(invoice.headerSettings?.creditCardFeePercentage) || 0;
    const ccFeeAmount = ccFeeEnabled ? (subtotal * ccFeeRate) / 100 : 0;

    return subtotal + taxAmount + ccFeeAmount;
  };

  // Calculate paid amount
  const getPaidAmount = (invoice) => {
    // Check multiple possible locations for paid amount
    return invoice.paidAmount || 
           invoice.calculations?.paidAmount || 
           invoice.paymentInfo?.paidAmount ||
           invoice.paymentData?.paidAmount ||
           0;
  };

  // Calculate balance
  const calculateBalance = (invoice) => {
    const total = calculateInvoiceTotal(invoice);
    const paid = getPaidAmount(invoice);
    return total - paid;
  };

  // Handle create invoice from order
  const handleCreateInvoice = async (order) => {
    try {
      // Corporate orders should not use customer invoices - they have their own system
      if (order.orderType === 'corporate') {
        showError('Corporate orders use a separate invoice system. Please use Corporate Invoices page.');
        return;
      }

      // Check if order already has a T-invoice
      const existingTInvoice = invoices.find(invoice => {
        const isTFormat = invoice.invoiceNumber && String(invoice.invoiceNumber).startsWith('T-');
        return isTFormat && invoice.originalOrderId === order.id;
      });

      if (existingTInvoice) {
        showError(`This order already has a T-invoice: ${existingTInvoice.invoiceNumber}. Please edit or delete the existing T-invoice first.`);
        return;
      }

      // Check if order has hasTInvoice flag
      if (order.hasTInvoice === true) {
        showError('This order already has a T-invoice. Please check the Customer Invoices list.');
        return;
      }

      let workingOrder = order;
      // Validate that the customer invoice number is available
      let invoiceNumber = order.orderDetails?.billInvoice;

      if (!invoiceNumber) {
        invoiceNumber = await getNextCustomerInvoiceNumber();
      }

      if (invoiceNumber) {
        let isAvailable = await validateCustomerInvoiceNumber(invoiceNumber);
        if (!isAvailable) {
          // Get the next available number and update the order before proceeding
          const nextInvoiceNumber = await getNextCustomerInvoiceNumber();

          if (!nextInvoiceNumber) {
            showError('Unable to determine the next available invoice number. Please try again later.');
            return;
          }

          const orderCollectionName = order.orderType === 'corporate' ? 'corporate-orders' : 'orders';
          const orderRef = doc(db, orderCollectionName, order.id);

          await updateDoc(orderRef, {
            'orderDetails.billInvoice': nextInvoiceNumber,
            'orderDetails.lastUpdated': new Date()
          });

          invoiceNumber = nextInvoiceNumber;
          workingOrder = {
            ...order,
            orderDetails: {
              ...order.orderDetails,
              billInvoice: nextInvoiceNumber,
              lastUpdated: new Date()
            }
          };

          // Update local state so UI reflects the new invoice number
          setOrders(prevOrders =>
            prevOrders.map(existingOrder =>
              existingOrder.id === order.id
                ? workingOrder
                : existingOrder
            )
          );

          showSuccess(`Invoice number was already used. Order updated to #${nextInvoiceNumber}.`);
        }
      }

      navigate('/admin/customer-invoices/create', { 
        state: { orderData: workingOrder } 
      });
    } catch (error) {
      console.error('Error validating invoice number:', error);
      showError('Failed to validate invoice number');
    }
  };

  // Handle print invoice
  const handlePrintInvoice = (invoice) => {
    navigate('/admin/customer-invoices/print', { 
      state: { invoiceData: invoice } 
    });
  };

  // ── Direct PDF download — no navigation ────────────────────────────────────
  const handleDownloadPdfInvoice = async (invoice) => {
    const fileName = `Invoice ${invoice.invoiceNumber || 'N/A'}.pdf`;
    try {
      showSuccess('Generating PDF…');

      // ── Build items rows HTML ────────────────────────────────────────────
      const furnitureGroups = invoice.furnitureGroups || [];
      const items = invoice.items || [];
      let itemRows = '';

      if (furnitureGroups.length === 0 && items.length === 0) {
        itemRows = '<tr><td colspan="4" style="padding:16px;text-align:center;color:#666;font-style:italic;">No items found</td></tr>';
      } else {
        // Map items to their group
        const byGroup = {};
        items.forEach(item => {
          const m = item.id?.match(/item-(\d+)-/);
          const gi = m ? parseInt(m[1]) : 0;
          if (!byGroup[gi]) byGroup[gi] = [];
          byGroup[gi].push(item);
        });

        furnitureGroups.forEach((group, gi) => {
          itemRows += `<tr style="background:#f8f9fa"><td colspan="4" style="font-weight:bold;color:#274290;padding:10px 16px;text-transform:uppercase;border:none;border-bottom:1px solid #ddd;font-size:14px;">${group.name || ''}</td></tr>`;
          (byGroup[gi] || []).forEach(item => {
            const amt = (parseFloat(item.quantity || 0) * parseFloat(item.price || 0)).toFixed(2);
            itemRows += `<tr><td style="padding:8px 16px;border:none;border-bottom:1px solid #ddd;color:#333;font-size:14px;">${item.name || ''}</td><td style="padding:8px 16px;text-align:center;border:none;border-bottom:1px solid #ddd;color:#333;font-size:14px;">$${parseFloat(item.price || 0).toFixed(2)}</td><td style="padding:8px 16px;text-align:center;border:none;border-bottom:1px solid #ddd;color:#333;font-size:14px;">${item.quantity || 0}</td><td style="padding:8px 16px;text-align:right;font-weight:bold;color:#333;border:none;border-bottom:1px solid #ddd;font-size:14px;">$${amt}</td></tr>`;
          });
        });

        // Ungrouped items fallback
        items.filter(item => {
          const m = item.id?.match(/item-(\d+)-/);
          return m ? parseInt(m[1]) >= furnitureGroups.length : false;
        }).forEach(item => {
          const amt = (parseFloat(item.quantity || 0) * parseFloat(item.price || 0)).toFixed(2);
          itemRows += `<tr><td style="padding:8px 16px;border:none;border-bottom:1px solid #ddd;color:#333;font-size:14px;">${item.name || ''}</td><td style="padding:8px 16px;text-align:center;border:none;border-bottom:1px solid #ddd;color:#333;font-size:14px;">$${parseFloat(item.price || 0).toFixed(2)}</td><td style="padding:8px 16px;text-align:center;border:none;border-bottom:1px solid #ddd;color:#333;font-size:14px;">${item.quantity || 0}</td><td style="padding:8px 16px;text-align:right;font-weight:bold;color:#333;border:none;border-bottom:1px solid #ddd;font-size:14px;">$${amt}</td></tr>`;
        });
      }

      // ── Calculations ────────────────────────────────────────────────────
      const calc = invoice.calculations || {};
      const subtotal   = parseFloat(calc.subtotal || 0).toFixed(2);
      const taxPct     = invoice.headerSettings?.taxPercentage || 0;
      const taxAmt     = parseFloat(calc.taxAmount || 0).toFixed(2);
      const ccEnabled  = invoice.headerSettings?.creditCardFeeEnabled;
      const ccAmt      = parseFloat(calc.creditCardFeeAmount || 0).toFixed(2);
      const paidAmt    = parseFloat(invoice.paidAmount || calc.paidAmount || 0).toFixed(2);
      const total      = parseFloat(calc.total || 0).toFixed(2);
      const balance    = (parseFloat(total) - parseFloat(paidAmt)).toFixed(2);
      const balColor   = parseFloat(balance) >= 0 ? '#cc820d' : '#4CAF50';

      const createdDate = invoice.createdAt
        ? (invoice.createdAt.toDate ? invoice.createdAt.toDate() : new Date(invoice.createdAt)).toLocaleDateString('en-CA')
        : new Date().toLocaleDateString('en-CA');

      const cust = invoice.customerInfo || invoice.originalCustomerInfo || {};

      // ── HTML Template ────────────────────────────────────────────────────
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <title>Invoice ${invoice.invoiceNumber || 'N/A'}</title>
  <style>
    body { -webkit-print-color-adjust:exact; print-color-adjust:exact; background:white; margin:0; padding:0; font-family:Arial,sans-serif; }
    .header img,.footer img { max-height:100px!important; width:100%!important; object-fit:contain!important; display:block!important; }
    .terms-hd { background-color:#cc820d!important; -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }
    .terms-hd * { color:white!important; }
    .paid-box  { background-color:#4CAF50!important; -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }
    .bal-box   { background-color:${balColor}!important; -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }
    .tot-box   { background-color:#2c2c2c!important; -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }
    .paid-box *,.bal-box *,.tot-box * { color:white!important; }
  </style>
</head>
<body>
<div style="width:100%;min-height:100%;display:flex;flex-direction:column;">
  <div class="header" style="margin-bottom:16px;width:100%;display:flex;justify-content:center;">
    <img src="${window.location.origin}/assets/images/invoice-headers/Invoice Header.png" alt="Header" style="width:100%;height:auto;" />
  </div>
  <div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-start;">
    <div style="flex:1;margin-right:16px;">
      <h6 style="font-weight:bold;color:black;margin-bottom:8px;font-size:18px;">Invoice to:</h6>
      <h5 style="font-weight:bold;margin-bottom:8px;color:black;font-size:20px;">${cust.customerName || 'N/A'}</h5>
      ${cust.phone ? `<div style="margin-bottom:4px;color:black;">📞 ${cust.phone}</div>` : ''}
      ${cust.email ? `<div style="margin-bottom:4px;color:black;">✉️ ${cust.email}</div>` : ''}
      ${cust.address ? `<div style="margin-bottom:4px;color:black;white-space:pre-line;">📍 ${cust.address}</div>` : ''}
    </div>
    <div style="min-width:250px;flex-shrink:0;">
      <div style="color:black;margin-bottom:4px;"><strong>Date:</strong> ${createdDate}</div>
      <div style="color:black;margin-bottom:4px;"><strong>Invoice #</strong> ${invoice.invoiceNumber || 'N/A'}</div>
      <div style="color:black;margin-bottom:4px;"><strong>Tax #</strong> 798633319-RT0001</div>
    </div>
  </div>
  <div style="margin-bottom:16px;border:2px solid #333;overflow:hidden;">
    <table style="width:100%;border-collapse:collapse;background:white;table-layout:fixed;">
      <thead>
        <tr style="background:#f5f5f5;">
          <th style="width:66.67%;padding:8px 16px;text-align:left;font-weight:bold;color:#333;background:#f5f5f5;border:none;border-bottom:2px solid #333;border-right:1px solid #ddd;font-size:14px;">Description</th>
          <th style="width:11.11%;padding:8px 16px;text-align:center;font-weight:bold;color:#333;background:#f5f5f5;border:none;border-bottom:2px solid #333;border-right:1px solid #ddd;font-size:14px;">Price</th>
          <th style="width:11.11%;padding:8px 16px;text-align:center;font-weight:bold;color:#333;background:#f5f5f5;border:none;border-bottom:2px solid #333;border-right:1px solid #ddd;font-size:14px;">Unit</th>
          <th style="width:11.11%;padding:8px 16px;text-align:right;font-weight:bold;color:#333;background:#f5f5f5;border:none;border-bottom:2px solid #333;font-size:14px;">Amount</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
  </div>
  <div style="margin-top:4px;">
    <div style="display:flex;width:100%;gap:16px;">
      <div style="flex:0 0 50%;max-width:50%;">
        <div class="terms-hd" style="background:#cc820d;color:white;padding:8px;margin-bottom:8px;">
          <h6 style="font-weight:bold;color:white;text-align:center;text-transform:uppercase;margin:0;font-size:16px;">Terms and Conditions</h6>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div><p style="font-weight:bold;color:black;margin:0 0 4px 0;font-size:14px;">Payment by Cheque: <span style="font-size:10px;font-weight:normal;color:#666;">(for corporates only)</span></p><p style="color:black;margin:0;font-size:12px;">Mail to: 322 Etheridge ave, Milton, ON CANADA L9E 1H7</p></div>
          <div><p style="font-weight:bold;color:black;margin:0 0 4px 0;font-size:14px;">Payment by direct deposit:</p><p style="color:black;margin:0;font-size:12px;">Transit Number: 07232</p><p style="color:black;margin:0;font-size:12px;">Institution Number: 010</p><p style="color:black;margin:0;font-size:12px;">Account Number: 1090712</p></div>
          <div><p style="font-weight:bold;color:black;margin:0 0 4px 0;font-size:14px;">Payment by e-transfer:</p><p style="color:black;margin:0;font-size:12px;">JL@JLupholstery.com</p></div>
        </div>
      </div>
      <div style="flex:1;display:flex;justify-content:flex-end;align-items:flex-start;">
        <div style="min-width:300px;max-width:400px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="color:black;font-size:14px;">Subtotal:</span><span style="font-weight:bold;color:black;font-size:14px;">$${subtotal}</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="color:black;font-size:14px;">Tax Rate:</span><span style="font-weight:bold;color:black;font-size:14px;">${taxPct}%</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="color:black;font-size:14px;">Tax Due:</span><span style="font-weight:bold;color:black;font-size:14px;">$${taxAmt}</span></div>
          ${ccEnabled ? `<div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="color:black;font-size:14px;">Credit Card Fee:</span><span style="font-weight:bold;color:black;font-size:14px;">$${ccAmt}</span></div>` : ''}
          <div class="paid-box" style="display:flex;justify-content:space-between;margin-bottom:4px;background:#4CAF50;color:white;padding:8px;border-radius:4px;"><span style="font-weight:bold;color:white;font-size:14px;">Paid:</span><span style="font-weight:bold;color:white;font-size:14px;">$${paidAmt}</span></div>
          <div class="bal-box" style="display:flex;justify-content:space-between;margin-bottom:4px;background:${balColor};color:white;padding:8px;border-radius:4px;"><span style="font-weight:bold;color:white;font-size:14px;">Balance:</span><span style="font-weight:bold;color:white;font-size:14px;">$${balance}</span></div>
          <div class="tot-box" style="display:flex;justify-content:space-between;background:#2c2c2c;color:white;padding:8px;border-radius:4px;"><span style="font-weight:bold;color:white;font-size:14px;">Total:</span><span style="font-weight:bold;color:white;font-size:14px;">$${total}</span></div>
        </div>
      </div>
    </div>
  </div>
  <div class="footer" style="margin-top:24px;width:100%;display:flex;justify-content:center;">
    <img src="${window.location.origin}/assets/images/invoice-headers/invoice Footer.png" alt="Footer" style="width:100%;height:auto;" />
  </div>
</div>
</body>
</html>`;

      // ── Fix relative paths → absolute URLs so html2canvas can load images ──
      const origin = window.location.origin;
      htmlContent = htmlContent
        .replace(/src="\/assets\//g, `src="${origin}/assets/`)
        .replace(/url\(\/assets\//g, `url(${origin}/assets/`);

      // ── Render in hidden iframe ───────────────────────────────────────────
      const iframe = document.createElement('iframe');
      iframe.id = 'customer-invoice-pdf-iframe';
      iframe.style.cssText = 'position:fixed;left:-9999px;width:800px;height:1200px;border:none;visibility:hidden;';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();

      // Wait for images to fully load
      await new Promise(resolve => setTimeout(resolve, 2500));

      const body = iframeDoc.body;
      const canvas = await html2canvas(body, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: body.scrollWidth,
        windowHeight: body.scrollHeight,
        width: body.scrollWidth,
        height: body.scrollHeight,
      });

      const imgData  = canvas.toDataURL('image/jpeg', 0.92);
      const pdf      = new jsPDF('p', 'mm', 'a4');
      const margin   = 10;
      const imgWidth = 210 - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position   = margin;
      pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
      heightLeft -= (297 - margin * 2);
      while (heightLeft > 0) {
        pdf.addPage();
        position = -(imgHeight - heightLeft) + margin;
        pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
        heightLeft -= (297 - margin * 2);
      }

      pdf.save(fileName);
      document.body.removeChild(iframe);
      showSuccess('PDF downloaded successfully!');
    } catch (err) {
      console.error('Error generating PDF:', err);
      showError('Failed to download PDF');
      const el = document.getElementById('customer-invoice-pdf-iframe');
      if (el?.parentNode) el.parentNode.removeChild(el);
    }
  };

  if (loading) {
    console.log('Customer Invoices page is in loading state');
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 3,
        flexWrap: 'wrap',
        gap: 2
      }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
            Customer Invoices
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Manage customer invoices • Create invoices from orders • Print and export
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateInvoiceDialogOpen(true)}
            sx={{
              ...buttonStyles.primaryButton,
              minWidth: 150,
              px: 3,
              flexShrink: 0,
              fontWeight: 'bold'
            }}
          >
            Create Invoice
          </Button>
        </Box>
      </Box>

      {/* Search and Stats */}
      <Grid container spacing={3} sx={{ mb: 3, flexShrink: 0 }}>
        <Grid xs={12} md={8}>
          <TextField
            fullWidth
            placeholder="Search by invoice number, customer name, email, phone, or order reference..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
              endAdornment: searchTerm && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => handleSearch('')}>
                    <RefreshIcon />
                  </IconButton>
                </InputAdornment>
              )
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                backgroundColor: 'background.paper',
                '&:hover': {
                  backgroundColor: 'action.hover'
                }
              }
            }}
          />
        </Grid>
        <Grid xs={12} md={4}>
          <Card sx={{ 
            background: 'linear-gradient(145deg, #a0a0a0 0%, #808080 50%, #606060 100%)',
            color: '#000000',
            border: '6px solid #4CAF50',
            borderRadius: 2,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.3)',
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '50%',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
              borderRadius: '2px 2px 0 0',
              pointerEvents: 'none'
            }
          }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#000000' }}>
                {filteredInvoices.length}
              </Typography>
              <Typography variant="body2" sx={{ color: '#000000' }}>
                {searchTerm ? 'Filtered Invoices' : 'Total Invoices'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Invoices Table */}
      <TableContainer component={Paper} sx={{ boxShadow: 2 }}>
        <Table>
          <TableHead sx={{ backgroundColor: '#274290' }}>
            <TableRow>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', textAlign: 'center', verticalAlign: 'middle' }}>Invoice #</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', textAlign: 'center', verticalAlign: 'middle' }}>Customer</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', textAlign: 'center', verticalAlign: 'middle' }}>Order Reference</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', textAlign: 'center', verticalAlign: 'middle' }}>Total Amount</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', textAlign: 'center', verticalAlign: 'middle' }}>Paid Amount</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', textAlign: 'center', verticalAlign: 'middle' }}>Balance</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', textAlign: 'center', verticalAlign: 'middle' }}>Tax</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', textAlign: 'center', verticalAlign: 'middle' }}>CC Fee</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', textAlign: 'center', verticalAlign: 'middle' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                  <CalendarIcon sx={{ fontSize: 16 }} />
                  Created Date
                </Box>
              </TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', textAlign: 'center', verticalAlign: 'middle' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredInvoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="h6" color="text.secondary">
                    {searchTerm ? 'No invoices found matching your search' : 'No invoices found'}
                  </Typography>
                  {!searchTerm && (
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => setCreateInvoiceDialogOpen(true)}
                      sx={{
                        ...buttonStyles.primaryButton,
                        mt: 2,
                        minWidth: 180,
                        px: 4,
                        py: 1.5,
                        fontSize: '1.1rem',
                        fontWeight: 'bold'
                      }}
                    >
                      Create First Invoice
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filteredInvoices.map((invoice) => (
                <TableRow key={invoice.id} hover sx={{ '&:hover': { backgroundColor: 'action.hover' } }}>
                  <TableCell sx={{ textAlign: 'center', verticalAlign: 'middle' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ReceiptIcon sx={{ mr: 1, color: '#b98f33', fontSize: 24 }} />
                      <Typography variant="h5" sx={{ 
                        fontWeight: 'bold', 
                        color: '#b98f33',
                        fontSize: '1.5rem',
                        textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                      }}>
                        {invoice.invoiceNumber || 'N/A'}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ textAlign: 'center', verticalAlign: 'middle' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                        <PersonIcon />
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                          {invoice.originalCustomerInfo?.customerName || invoice.customerInfo?.customerName || 'N/A'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {invoice.originalCustomerInfo?.email || invoice.customerInfo?.email || 'No email'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {invoice.customerInfo?.phone || 'No phone'}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ textAlign: 'center', verticalAlign: 'middle' }}>
                    <Chip
                      label={invoice.originalOrderNumber || invoice.originalOrderId || 'N/A'}
                      size="small"
                      sx={{
                        backgroundColor: '#e3f2fd',
                        color: '#1976d2',
                        fontWeight: 'bold'
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ textAlign: 'center', verticalAlign: 'middle' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#f27921' }}>
                      ${calculateInvoiceTotal(invoice).toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ textAlign: 'center', verticalAlign: 'middle' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#4CAF50' }}>
                      ${getPaidAmount(invoice).toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ textAlign: 'center', verticalAlign: 'middle' }}>
                    <Typography variant="subtitle1" sx={{ 
                      fontWeight: 'bold', 
                      color: calculateBalance(invoice) >= 0 ? '#f27921' : '#4CAF50'
                    }}>
                      ${calculateBalance(invoice).toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ textAlign: 'center', verticalAlign: 'middle' }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {invoice.headerSettings?.taxPercentage || 0}%
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ textAlign: 'center', verticalAlign: 'middle' }}>
                    <Chip
                      label={invoice.headerSettings?.creditCardFeeEnabled ? 
                        `${invoice.headerSettings?.creditCardFeePercentage || 0}%` : 
                        'Disabled'
                      }
                      size="small"
                      sx={{
                        backgroundColor: invoice.headerSettings?.creditCardFeeEnabled ? '#fff3e0' : '#f5f5f5',
                        color: invoice.headerSettings?.creditCardFeeEnabled ? '#f57c00' : '#757575',
                        fontWeight: 'bold'
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ textAlign: 'center', verticalAlign: 'middle' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{
                        backgroundColor: invoice.createdAt ? '#e8f5e9' : '#fce4ec',
                        border: `1px solid ${invoice.createdAt ? '#4CAF50' : '#e91e63'}`,
                        borderRadius: 1,
                        px: 1.5,
                        py: 0.5,
                        minWidth: 110
                      }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: invoice.createdAt ? '#2e7d32' : '#c62828', fontSize: '0.8rem' }}>
                          {invoice.createdAt ? formatDateOnly(invoice.createdAt) : '⚠ No Date'}
                        </Typography>
                      </Box>
                      {invoice.createdAt && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                          {formatDate(invoice.createdAt, { hour: '2-digit', minute: '2-digit', second: undefined, year: undefined, month: undefined, day: undefined })}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ textAlign: 'center', verticalAlign: 'middle' }}>
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                      <Tooltip title="View Invoice">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => {
                            setSelectedInvoice(invoice);
                            setViewDialogOpen(true);
                          }}
                        >
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit Invoice">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => {
                            navigate('/admin/customer-invoices/edit', { 
                              state: { invoiceData: invoice } 
                            });
                          }}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Download PDF">
                        <IconButton
                          size="small"
                          sx={{ color: '#e53935' }}
                          onClick={() => handleDownloadPdfInvoice(invoice)}
                        >
                          <DownloadIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Print Invoice">
                        <IconButton
                          size="small"
                          color="secondary"
                          onClick={() => handlePrintInvoice(invoice)}
                        >
                          <PrintIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Archive to Taxed Invoices">
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => {
                            setInvoiceToClose(invoice);
                            setCloseInvoiceDialogOpen(true);
                          }}
                        >
                          <ArchiveIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Invoice">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            setInvoiceToDelete(invoice);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create Invoice Dialog */}
      <Dialog
        open={createInvoiceDialogOpen}
        onClose={() => {
          setCreateInvoiceDialogOpen(false);
          setOrderSearchTerm(''); // Clear search when closing
        }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <ReceiptIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">Create Invoice from Order</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Select an order to create an invoice from (shows all orders without T-invoicing, regardless of status):
            </Typography>
            
            {/* Search Box */}
            <TextField
              fullWidth
              placeholder="Search by order number, customer name, email, or phone..."
              value={orderSearchTerm}
              onChange={(e) => setOrderSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: orderSearchTerm && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setOrderSearchTerm('')}>
                      <RefreshIcon />
                    </IconButton>
                  </InputAdornment>
                )
              }}
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  backgroundColor: 'background.paper',
                  '&:hover': {
                    backgroundColor: 'action.hover'
                  }
                }
              }}
            />
            
            <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Order #</TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell>Order Date</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Order Total (Inc. Tax)</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {getFilteredOrders().length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ textAlign: 'center', py: 2 }}>
                        <Typography color="text.secondary">
                          {orderSearchTerm ? 'No orders found matching your search' : 'All orders already have invoices created'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    getFilteredOrders().map((order) => (
                      <TableRow key={order.id} hover>
                        <TableCell>
                          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                            {order.orderDetails?.billInvoice || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {order.personalInfo?.customerName || 'N/A'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {order.personalInfo?.email || 'No email'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {formatDateOnly(order.createdAt)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={order.invoiceStatus || order.workflowStatus || 'Unknown'}
                            size="small"
                            sx={{
                              backgroundColor: order.invoiceStatus === 'done' ? '#4CAF50' :
                                             order.invoiceStatus === 'cancelled' ? '#F44336' :
                                             order.workflowStatus === 'Inprogress' ? '#FF9800' : '#757575',
                              color: 'white',
                              fontWeight: 'bold'
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Tooltip title="Includes materials, labour, foam, painting, pickup/delivery, and 13% tax on materials & foam">
                            <Typography variant="body2" sx={{ fontWeight: 'bold', cursor: 'help' }}>
                              ${calculateOrderTotal(order).toFixed(2)}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => {
                              setCreateInvoiceDialogOpen(false);
                              setOrderSearchTerm(''); // Clear search when closing
                              handleCreateInvoice(order);
                            }}
                            sx={buttonStyles.primaryButton}
                          >
                            Create Invoice
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCreateInvoiceDialogOpen(false);
            setOrderSearchTerm(''); // Clear search when closing
          }} sx={buttonStyles.cancelButton}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Invoice Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <ReceiptIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">Invoice Details</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedInvoice && (
            <Box sx={{ mt: 2 }}>
              {/* Invoice Header Information */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold', color: '#274290' }}>
                  Invoice #{selectedInvoice.invoiceNumber}
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                      <strong>Customer:</strong> {selectedInvoice.originalCustomerInfo?.customerName || selectedInvoice.customerInfo?.customerName}
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                      <strong>Email:</strong> {selectedInvoice.originalCustomerInfo?.email || selectedInvoice.customerInfo?.email || 'N/A'}
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                      <strong>Phone:</strong> {selectedInvoice.originalCustomerInfo?.phone || selectedInvoice.customerInfo?.phone || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                      <strong>Date:</strong> {formatDateOnly(selectedInvoice.createdAt)}
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                      <strong>Order Ref:</strong> #{selectedInvoice.originalOrderNumber || selectedInvoice.originalOrderId}
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 1, fontWeight: 'bold', color: '#f27921' }}>
                      <strong>Total:</strong> ${calculateInvoiceTotal(selectedInvoice).toFixed(2)}
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 1, fontWeight: 'bold', color: '#4CAF50' }}>
                      <strong>Paid:</strong> ${getPaidAmount(selectedInvoice).toFixed(2)}
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 1, fontWeight: 'bold', color: calculateBalance(selectedInvoice) >= 0 ? '#f27921' : '#4CAF50' }}>
                      <strong>Balance:</strong> ${calculateBalance(selectedInvoice).toFixed(2)}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>

              {/* Invoice Items Grouped by Furniture Group */}
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#274290' }}>
                Invoice Items
              </Typography>
              
              <Box sx={{ 
                border: '1px solid #ddd',
                borderRadius: 1,
                overflow: 'hidden'
              }}>
                <TableContainer>
                  <Table>
                    <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold', color: '#333333' }}>Description</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: '#333333', textAlign: 'center' }}>Price</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: '#333333', textAlign: 'center' }}>Unit</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: '#333333', textAlign: 'right' }}>Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(() => {
                        const furnitureGroups = selectedInvoice.furnitureGroups || [];
                        const items = selectedInvoice.items || [];
                        
                        
                        const rows = [];
                        
                        // If no items, show a message
                        if (furnitureGroups.length === 0 && items.length === 0) {
                          rows.push(
                            <TableRow key="no-items">
                              <TableCell colSpan="4" sx={{ textAlign: 'center', color: '#666666', fontStyle: 'italic' }}>
                                No items found
                              </TableCell>
                            </TableRow>
                          );
                        } else {
                          // Try to group items by their furniture group index
                          const itemsByGroup = {};
                          let hasValidGrouping = false;
                          
                          items.forEach(item => {
                            // Extract group index from item ID (e.g., "item-0-material" -> 0)
                            const match = item.id?.match(/item-(\d+)-/);
                            const groupIndex = match ? parseInt(match[1]) : -1;
                            
                            if (groupIndex >= 0 && groupIndex < furnitureGroups.length) {
                              hasValidGrouping = true;
                              if (!itemsByGroup[groupIndex]) {
                                itemsByGroup[groupIndex] = [];
                              }
                              itemsByGroup[groupIndex].push(item);
                            }
                          });
                          
                          // If we have valid grouping, use it
                          if (hasValidGrouping && furnitureGroups.length > 0) {
                            // Render each furniture group with its items
                            furnitureGroups.forEach((group, groupIndex) => {
                              // Add furniture group header
                              rows.push(
                                <TableRow key={`group-${groupIndex}`} sx={{ backgroundColor: '#f8f9fa' }}>
                                  <TableCell 
                                    colSpan="4" 
                                    sx={{ 
                                      fontWeight: 'bold',
                                      color: '#274290',
                                      fontSize: '14px',
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.5px',
                                      py: 1
                                    }}
                                  >
                                    {group.name}
                                  </TableCell>
                                </TableRow>
                              );
                              
                              // Add items that belong to this group
                              const groupItems = itemsByGroup[groupIndex] || [];
                              groupItems.forEach((item, itemIndex) => {
                                rows.push(
                                  <TableRow key={item.id || `item-${groupIndex}-${itemIndex}`}>
                                    <TableCell sx={{ color: '#333333' }}>
                                      {item.name}
                                    </TableCell>
                                    <TableCell sx={{ textAlign: 'center', color: '#333333' }}>
                                      ${parseFloat(item.price || 0).toFixed(2)}
                                    </TableCell>
                                    <TableCell sx={{ textAlign: 'center', color: '#333333' }}>
                                      {item.quantity || 0}
                                    </TableCell>
                                    <TableCell sx={{ textAlign: 'right', fontWeight: 'bold', color: '#333333' }}>
                                      ${((parseFloat(item.quantity || 0) * parseFloat(item.price || 0))).toFixed(2)}
                                    </TableCell>
                                  </TableRow>
                                );
                              });
                            });
                            
                            // Add any items that don't belong to any group (fallback)
                            const ungroupedItems = items.filter(item => {
                              const match = item.id?.match(/item-(\d+)-/);
                              const groupIndex = match ? parseInt(match[1]) : -1;
                              return groupIndex >= furnitureGroups.length;
                            });
                            
                            if (ungroupedItems.length > 0) {
                              ungroupedItems.forEach((item, itemIndex) => {
                                rows.push(
                                  <TableRow key={item.id || `ungrouped-${itemIndex}`}>
                                    <TableCell sx={{ color: '#333333' }}>
                                      {item.name}
                                    </TableCell>
                                    <TableCell sx={{ textAlign: 'center', color: '#333333' }}>
                                      ${parseFloat(item.price || 0).toFixed(2)}
                                    </TableCell>
                                    <TableCell sx={{ textAlign: 'center', color: '#333333' }}>
                                      {item.quantity || 0}
                                    </TableCell>
                                    <TableCell sx={{ textAlign: 'right', fontWeight: 'bold', color: '#333333' }}>
                                      ${((parseFloat(item.quantity || 0) * parseFloat(item.price || 0))).toFixed(2)}
                                    </TableCell>
                                  </TableRow>
                                );
                              });
                            }
                          } else {
                            // Fallback: Show items without grouping
                            items.forEach((item, index) => {
                              rows.push(
                                <TableRow key={item.id || `item-${index}`}>
                                  <TableCell sx={{ color: '#333333' }}>
                                    {item.name}
                                  </TableCell>
                                  <TableCell sx={{ textAlign: 'center', color: '#333333' }}>
                                    ${parseFloat(item.price || 0).toFixed(2)}
                                  </TableCell>
                                  <TableCell sx={{ textAlign: 'center', color: '#333333' }}>
                                    {item.quantity || 0}
                                  </TableCell>
                                  <TableCell sx={{ textAlign: 'right', fontWeight: 'bold', color: '#333333' }}>
                                    ${((parseFloat(item.quantity || 0) * parseFloat(item.price || 0))).toFixed(2)}
                                  </TableCell>
                                </TableRow>
                              );
                            });
                          }
                        }

                        return rows;
                      })()}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>

              {/* Invoice Summary */}
              <Box sx={{ mt: 3, p: 2, backgroundColor: '#f8f9fa', borderRadius: 1 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#274290' }}>
                  Invoice Summary
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body1">Subtotal:</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                    ${(selectedInvoice.calculations?.subtotal || 0).toFixed(2)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body1">Tax:</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                    ${(selectedInvoice.calculations?.taxAmount || 0).toFixed(2)}
                  </Typography>
                </Box>
                {selectedInvoice.headerSettings?.creditCardFeeEnabled && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body1">Credit Card Fee:</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                      ${(selectedInvoice.calculations?.creditCardFeeAmount || 0).toFixed(2)}
                    </Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#274290' }}>
                    Total:
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#274290' }}>
                    ${calculateInvoiceTotal(selectedInvoice).toFixed(2)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body1">
                    Paid Amount:
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#4CAF50' }}>
                    ${getPaidAmount(selectedInvoice).toFixed(2)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #ddd', pt: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: calculateBalance(selectedInvoice) >= 0 ? '#f27921' : '#4CAF50' }}>
                    Balance:
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: calculateBalance(selectedInvoice) >= 0 ? '#f27921' : '#4CAF50' }}>
                    ${calculateBalance(selectedInvoice).toFixed(2)}
                  </Typography>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)} sx={buttonStyles.cancelButton}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This action cannot be undone. The invoice will be permanently deleted.
          </Alert>
          <Typography>
            Are you sure you want to delete invoice #{' '}
            <strong>{invoiceToDelete?.invoiceNumber}</strong> for{' '}
            <strong>{invoiceToDelete?.originalCustomerInfo?.customerName || invoiceToDelete?.customerInfo?.customerName}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} sx={buttonStyles.cancelButton}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleDeleteInvoice}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : <DeleteIcon />}
            sx={buttonStyles.dangerButton}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Close Invoice Confirmation Dialog */}
      <Dialog
        open={closeInvoiceDialogOpen}
        onClose={() => setCloseInvoiceDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
          color: '#000000',
          fontWeight: 'bold'
        }}>
          Archive Invoice to Taxed Invoices
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#3a3a3a', color: '#ffffff', p: 3 }}>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Are you sure you want to archive this invoice to taxed invoices?
          </Typography>
          {invoiceToClose && (
            <>
              <Typography variant="body2" sx={{ mb: 2, color: '#cccccc' }}>
                <strong>Invoice #:</strong> {invoiceToClose.invoiceNumber || 'N/A'}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: '#cccccc' }}>
                <strong>Customer:</strong> {invoiceToClose.originalCustomerInfo?.customerName || invoiceToClose.customerInfo?.customerName || 'N/A'}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: '#cccccc' }}>
                <strong>Total Amount:</strong> ${calculateInvoiceTotal(invoiceToClose).toFixed(2)}
              </Typography>
            </>
          )}
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Warning:</strong> This action will archive the invoice to the "Taxed Invoices" section and remove it from the current customer invoices list. This action cannot be undone.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#3a3a3a', p: 2 }}>
          <Button 
            onClick={() => setCloseInvoiceDialogOpen(false)}
            sx={{
              color: '#ffffff',
              border: '1px solid #666666',
              '&:hover': {
                backgroundColor: '#555555'
              }
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleCloseInvoice}
            variant="contained"
            sx={{
              background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
              color: '#000000',
              border: '2px solid #4caf50',
              '&:hover': {
                background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
                border: '2px solid #45a049'
              }
            }}
          >
            Archive Invoice
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CustomerInvoicesPage;
