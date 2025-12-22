import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Alert,
  Snackbar,
  CircularProgress,
  Chip,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  FileDownload as DownloadIcon,
  Visibility as ViewIcon,
  Receipt as ReceiptIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Print as PrintIcon,
} from '@mui/icons-material';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import { calculateOrderTotal, calculateOrderCost, calculateOrderTax, getOrderCostBreakdown, formatFurnitureDetails, isRapidOrder, calculatePickupDeliveryCost } from '../../../shared/utils/orderCalculations';
import { fetchMaterialCompanyTaxRates, getMaterialCompanyTaxRate } from '../../../shared/utils/materialTaxRates';
import { formatCorporateInvoiceForInvoice } from '../../../utils/invoiceNumberUtils';
import { formatDateOnly } from '../../../utils/dateUtils';
import autoTable from 'jspdf-autotable';

// Register the autoTable plugin
jsPDF.API.autoTable = autoTable;

const TaxedInvoicesPage = () => {
  const [taxedInvoices, setTaxedInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ open: false, message: '', type: 'info' });
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'closed', 'in-progress'
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [materialTaxRates, setMaterialTaxRates] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    fetchTaxedInvoices();
    fetchMaterialCompanyTaxRates().then(setMaterialTaxRates);
  }, []);

  useEffect(() => {
    applyFilters();
  }, [taxedInvoices, searchTerm, dateFilter, statusFilter]);

  // Parse invoice number for sorting (handles both T- format and old format)
  const parseInvoiceNumberForSort = (invoiceNumber) => {
    if (!invoiceNumber) return 0;
    const str = String(invoiceNumber);
    if (str.startsWith('T-')) {
      const numPart = str.substring(2);
      return parseInt(numPart, 10) || 0;
    }
    return parseInt(str, 10) || 0;
  };

  // Check if invoice number is T- format
  const isTFormatInvoice = (invoiceNumber) => {
    if (!invoiceNumber) return false;
    const str = String(invoiceNumber).trim();
    // Check for T- prefix (case insensitive)
    return str.toUpperCase().startsWith('T-');
  };

  const fetchTaxedInvoices = async () => {
    try {
      setLoading(true);
      
      // Fetch from all three collections
      const [taxedInvoicesSnapshot, corporateOrdersSnapshot, customerInvoicesSnapshot] = await Promise.all([
        getDocs(collection(db, 'taxedInvoices')),
        getDocs(collection(db, 'corporate-orders')),
        getDocs(collection(db, 'customer-invoices'))
      ]);
      
      // Process taxed invoices (closed)
      const taxedInvoicesData = taxedInvoicesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        status: 'closed',
        source: 'taxedInvoices'
      }));
      
      // Process corporate orders (in-progress)
      const corporateOrdersData = corporateOrdersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        status: 'in-progress',
        source: 'corporate-orders',
        orderType: 'corporate'
      }));
      
      // Process customer invoices (in-progress)
      const customerInvoicesData = customerInvoicesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        status: 'in-progress',
        source: 'customer-invoices',
        orderType: 'customer'
      }));
      
      // Combine all invoices
      const allInvoices = [...taxedInvoicesData, ...corporateOrdersData, ...customerInvoicesData];
      
      console.log('Total invoices fetched:', allInvoices.length);
      console.log('Sample invoice data:', allInvoices.slice(0, 3).map(inv => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        billInvoice: inv.orderDetails?.billInvoice,
        source: inv.source
      })));
      
      // Filter to only T- format invoices
      const tFormatInvoices = allInvoices.filter(invoice => {
        // Check multiple possible locations for invoice number
        const invoiceNumber = invoice.invoiceNumber 
          || invoice.orderDetails?.billInvoice 
          || invoice.billInvoice;
        
        const isTFormat = isTFormatInvoice(invoiceNumber);
        
        // Debug logging
        if (invoiceNumber) {
          console.log('Checking invoice:', {
            id: invoice.id,
            source: invoice.source,
            invoiceNumber: invoiceNumber,
            isTFormat: isTFormat
          });
        }
        
        return isTFormat;
      });
      
      console.log('T- format invoices found:', tFormatInvoices.length);
      if (tFormatInvoices.length > 0) {
        console.log('Sample T- invoices:', tFormatInvoices.slice(0, 3).map(inv => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber || inv.orderDetails?.billInvoice,
          status: inv.status
        })));
      }
      
      // Sort by invoice number (handles T- format)
      tFormatInvoices.sort((a, b) => {
        const aInvoice = a.invoiceNumber || a.orderDetails?.billInvoice || 'T-0';
        const bInvoice = b.invoiceNumber || b.orderDetails?.billInvoice || 'T-0';
        const aNum = parseInvoiceNumberForSort(aInvoice);
        const bNum = parseInvoiceNumberForSort(bInvoice);
        return bNum - aNum; // Descending order (highest first)
      });
      
      setTaxedInvoices(tFormatInvoices);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      showNotification('Error fetching invoices', 'error');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...taxedInvoices];
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(invoice => {
        return invoice.status === statusFilter;
      });
    }
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(invoice => {
        const searchLower = searchTerm.toLowerCase();
        
        // Search in regular customer fields
        if (invoice.customerInfo?.customerName?.toLowerCase().includes(searchLower) ||
            invoice.originalCustomerInfo?.customerName?.toLowerCase().includes(searchLower) ||
            invoice.customerInfo?.phone?.includes(searchTerm) ||
            invoice.originalCustomerInfo?.phone?.includes(searchTerm)) {
          return true;
        }
        
        // Search in corporate customer fields
        if (invoice.orderType === 'corporate') {
          if (invoice.corporateCustomer?.corporateName?.toLowerCase().includes(searchLower) ||
              invoice.contactPerson?.name?.toLowerCase().includes(searchLower) ||
              invoice.contactPerson?.phone?.includes(searchTerm) ||
              invoice.contactPerson?.email?.toLowerCase().includes(searchLower)) {
            return true;
          }
        }
        
        // Search in invoice number (handle T- format)
        const invoiceNumber = invoice.orderDetails?.billInvoice || invoice.invoiceNumber;
        if (invoiceNumber?.toString().toLowerCase().includes(searchTerm.toLowerCase())) {
          return true;
        }
        
        return false;
      });
    }
    
    // Apply date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      let startDate;
      
      switch (dateFilter) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = null;
      }
      
      if (startDate) {
        filtered = filtered.filter(invoice => {
          const invoiceDate = new Date(invoice.closedAt || invoice.createdAt);
          return invoiceDate >= startDate;
        });
      }
    }
    
    setFilteredInvoices(filtered);
  };

  const showNotification = (message, type = 'info') => {
    setNotification({ open: true, message, type });
  };

  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  const formatCurrency = (value) => {
    const num = parseFloat(value);
    return isNaN(num) ? '$0.00' : `$${num.toFixed(2)}`;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    
    try {
      // Handle different date formats
      let dateObj;
      
      if (date instanceof Date) {
        dateObj = date;
      } else if (typeof date === 'string') {
        // Try to parse the date string
        dateObj = new Date(date);
      } else if (date.seconds) {
        // Handle Firestore timestamp
        dateObj = new Date(date.seconds * 1000);
      } else if (date._seconds) {
        // Handle Firestore timestamp with _seconds
        dateObj = new Date(date._seconds * 1000);
      } else {
        dateObj = new Date(date);
      }
      
      // Check if the date is valid
      if (isNaN(dateObj.getTime())) {
        return 'N/A';
      }
      
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Date formatting error:', error, 'Date value:', date);
      return 'N/A';
    }
  };

  const calculateInvoiceTotals = (invoice) => {
    if (!invoice) return { 
      grandTotal: 0, 
      amountPaid: 0, 
      balanceDue: 0,
      subtotal: 0,
      taxAmount: 0
    };
    
    // Check if this is a T-invoice from customer-invoices
    const isTInvoice = invoice.source === 'customer-invoices' || 
                      (invoice.invoiceNumber && isTFormatInvoice(invoice.invoiceNumber)) ||
                      (invoice.orderDetails?.billInvoice && isTFormatInvoice(invoice.orderDetails.billInvoice));
    
    // Check if the invoice has stored calculations
    if (invoice.calculations) {
      const grandTotal = invoice.calculations.total || 0;
      const taxAmount = invoice.calculations.taxAmount || 0;
      const subtotal = invoice.calculations.subtotal || 0;
      
      return {
        grandTotal: grandTotal,
        subtotal: subtotal,
        taxAmount: taxAmount,
      amountPaid: invoice.orderType === 'corporate' 
        ? (invoice.paymentDetails?.amountPaid || 0)
        : (invoice.paidAmount || invoice.paymentData?.amountPaid || 0),
      balanceDue: grandTotal - (invoice.orderType === 'corporate' 
        ? (invoice.paymentDetails?.amountPaid || 0)
        : (invoice.paidAmount || invoice.paymentData?.amountPaid || 0))
      };
    }
    
    // Fallback: try to calculate using the order calculation functions
    console.log('Calculating totals for invoice:', invoice.id, 'orderType:', invoice.orderType);
    console.log('Invoice data structure:', {
      furnitureData: invoice.furnitureData,
      furnitureGroups: invoice.furnitureGroups,
      paymentData: invoice.paymentData,
      paymentDetails: invoice.paymentDetails
    });
    
    const total = calculateOrderTotal(invoice);
    const taxAmount = calculateOrderTax(invoice);
    const subtotal = total - taxAmount;
    
    console.log('Calculation results:', { total, taxAmount, subtotal, isTInvoice });
    
    // If calculations are 0, try to calculate manually for corporate orders
    if (total === 0 && invoice.orderType === 'corporate' && invoice.furnitureGroups) {
      console.log('Manual calculation for corporate order...');
      let manualSubtotal = 0;
      let manualTaxAmount = 0;
      
      invoice.furnitureGroups.forEach((group, groupIndex) => {
        console.log(`Processing group ${groupIndex}:`, group);
        
        // Material costs
        const materialPrice = parseFloat(group.materialPrice) || 0;
        const materialQnty = parseFloat(group.materialQnty) || 0;
        const materialTotal = materialPrice * materialQnty;
        manualSubtotal += materialTotal;
        manualTaxAmount += materialTotal * 0.13; // 13% tax on materials
        
        // Labour costs (not taxable)
        const labourPrice = parseFloat(group.labourPrice) || 0;
        const labourQnty = parseFloat(group.labourQnty) || 0;
        manualSubtotal += labourPrice * labourQnty;
        
        // Foam costs (taxable)
        if (group.foamEnabled || group.foamPrice > 0) {
          const foamPrice = parseFloat(group.foamPrice) || 0;
          const foamQnty = parseFloat(group.foamQnty) || 0;
          const foamTotal = foamPrice * foamQnty;
          manualSubtotal += foamTotal;
          manualTaxAmount += foamTotal * 0.13; // 13% tax on foam
        }
        
        // Painting costs (not taxable - labour)
        if (group.paintingEnabled || group.paintingLabour > 0) {
          const paintingPrice = parseFloat(group.paintingLabour) || 0;
          const paintingQnty = parseFloat(group.paintingQnty) || 0;
          manualSubtotal += paintingPrice * paintingQnty;
        }
      });
      
      const manualTotal = manualSubtotal + manualTaxAmount;
      console.log('Manual calculation results:', { 
        manualSubtotal, 
        manualTaxAmount, 
        manualTotal 
      });
      
      return {
        grandTotal: manualTotal,
        subtotal: manualSubtotal,
        taxAmount: manualTaxAmount,
        amountPaid: invoice.paymentDetails?.amountPaid || 0,
        balanceDue: manualTotal - (invoice.paymentDetails?.amountPaid || 0)
      };
    }
    
    return {
      grandTotal: total,
      subtotal: subtotal,
      taxAmount: taxAmount,
      amountPaid: invoice.orderType === 'corporate' 
        ? (invoice.paymentDetails?.amountPaid || 0)
        : (invoice.paidAmount || invoice.paymentData?.amountPaid || 0),
      balanceDue: total - (invoice.orderType === 'corporate' 
        ? (invoice.paymentDetails?.amountPaid || 0)
        : (invoice.paidAmount || invoice.paymentData?.amountPaid || 0))
    };
  };

  const handleViewInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setViewDialogOpen(true);
  };

  const handlePrintInvoice = async (invoice) => {
    try {
      // Route to the correct print page based on invoice type
      if (invoice.orderType === 'corporate' || invoice.source === 'corporate-orders' || invoice.source === 'taxedInvoices' && invoice.orderType === 'corporate') {
        // For corporate invoices: navigate to corporate invoices page with the invoice data
        // We'll use the corporate invoice print format
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        // Use the same calculation function as CorporateInvoicesPage
        const totals = calculateCorporateInvoiceTotals(invoice);
        const creditCardFeeEnabled = invoice.creditCardFeeEnabled || invoice.headerSettings?.creditCardFeeEnabled || false;
        
        // Generate corporate invoice HTML (same format as CorporateInvoicesPage)
        const htmlContent = generateCorporateInvoiceHTML(invoice, totals, creditCardFeeEnabled);
        
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
      } else {
        // For customer invoices: generate customer invoice HTML and open print preview
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        const totals = calculateInvoiceTotals(invoice);
        
        // Generate customer invoice HTML (same format as PrintInvoicePage)
        const htmlContent = generateCustomerInvoiceHTML(invoice, totals);
        
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
      }
    } catch (error) {
      console.error('Error printing invoice:', error);
      showNotification('Error printing invoice', 'error');
    }
  };

  // Calculate corporate invoice totals (same as CorporateInvoicesPage)
  const calculateCorporateInvoiceTotals = (order) => {
    if (!order) return { subtotal: 0, tax: 0, creditCardFee: 0, total: 0 };

    // Calculate subtotal from furniture groups
    const furnitureGroups = order.furnitureGroups || [];
    let subtotal = 0;

    furnitureGroups.forEach(group => {
      // Add material cost
      if (group.materialPrice && group.materialQnty && parseFloat(group.materialPrice) > 0) {
        const price = parseFloat(group.materialPrice) || 0;
        const quantity = parseFloat(group.materialQnty) || 0;
        subtotal += price * quantity;
      }
      
      // Add labour cost
      if (group.labourPrice && group.labourQnty && parseFloat(group.labourPrice) > 0) {
        const price = parseFloat(group.labourPrice) || 0;
        const quantity = parseFloat(group.labourQnty) || 0;
        subtotal += price * quantity;
      }
      
      // Add foam cost if enabled
      if (group.foamEnabled && group.foamPrice && group.foamQnty && parseFloat(group.foamPrice) > 0) {
        const price = parseFloat(group.foamPrice) || 0;
        const quantity = parseFloat(group.foamQnty) || 0;
        subtotal += price * quantity;
      }
      
      // Add painting cost if enabled
      if (group.paintingEnabled && group.paintingLabour && group.paintingQnty && parseFloat(group.paintingLabour) > 0) {
        const price = parseFloat(group.paintingLabour) || 0;
        const quantity = parseFloat(group.paintingQnty) || 0;
        subtotal += price * quantity;
      }
    });

    // Add pickup/delivery cost if enabled
    const paymentDetails = order.paymentDetails || {};
    if (paymentDetails.pickupDeliveryEnabled) {
      const pickupCost = parseFloat(paymentDetails.pickupDeliveryCost) || 0;
      const serviceType = paymentDetails.pickupDeliveryServiceType;
      if (serviceType === 'both') {
        subtotal += pickupCost * 2;
      } else {
        subtotal += pickupCost;
      }
    }

    // Calculate tax (13% on subtotal)
    const tax = subtotal * 0.13;

    // Calculate credit card fee (2.5% on subtotal + tax) if enabled
    const creditCardFeeEnabled = order.creditCardFeeEnabled || order.headerSettings?.creditCardFeeEnabled || false;
    const creditCardFee = creditCardFeeEnabled ? (subtotal + tax) * 0.025 : 0;

    // Calculate total
    const total = subtotal + tax + creditCardFee;

    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      tax: parseFloat(tax.toFixed(2)),
      creditCardFee: parseFloat(creditCardFee.toFixed(2)),
      total: parseFloat(total.toFixed(2))
    };
  };

  // Generate corporate invoice HTML (same format as CorporateInvoicesPage)
  const generateCorporateInvoiceHTML = (invoice, totals, creditCardFeeEnabled) => {
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Corporate Invoice - ${formatCorporateInvoiceForInvoice(invoice.invoiceNumber || invoice.orderDetails?.billInvoice) || 'N/A'}</title>
        <style>
          @media print {
            @page {
              margin: 0.5in 0.6in 0.5in 0.5in;
              size: A4;
            }
            
            body {
              -webkit-print-color-adjust: exact;
              color-adjust: exact;
              print-color-adjust: exact;
              background: white !important;
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
            }
            
            .invoice-header {
              position: fixed !important;
              top: 0 !important;
              left: 0 !important;
              right: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              background: white !important;
            }
            
            .invoice-header img {
              max-height: 100px !important;
              width: 100% !important;
              object-fit: contain !important;
              display: block !important;
            }
            
            .invoice-footer {
              position: fixed !important;
              bottom: 0 !important;
              left: 0 !important;
              right: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
            }
            
            .invoice-footer img {
              max-height: 100px !important;
              width: 100% !important;
              object-fit: contain !important;
              display: block !important;
            }
            
            .invoice-container {
              padding-top: 110px !important;
              padding-bottom: 110px !important;
              padding-left: 15px !important;
              padding-right: 20px !important;
              box-sizing: border-box !important;
            }
            
            .terms-header {
              background-color: #cc820d !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            
            .terms-header * {
              color: white !important;
            }
            
            .paid-box {
              background-color: #4CAF50 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            
            .balance-box {
              background-color: #cc820d !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            
            .total-box {
              background-color: #2c2c2c !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            
            .paid-box *, .balance-box *, .total-box * {
              color: white !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container" style="width: 100%; height: 100%; display: flex; flex-direction: column;">
          <!-- Professional Invoice Header - Image Only -->
          <div class="invoice-header" style="
            margin-bottom: 16px;
            position: relative;
            overflow: hidden;
            width: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
          ">
            <img 
              src="/assets/images/invoice-headers/Invoice Header.png" 
              alt="Invoice Header" 
              style="
                width: 100%;
                height: auto;
                max-width: 100%;
                object-fit: contain;
                display: block;
              "
            />
          </div>

          <!-- Invoice Information Row - Left: Customer Info, Right: Date/Invoice/Tax -->
          <div style="
            margin-bottom: 16px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          ">
            <!-- Left Side - Customer Information -->
            <div style="flex: 1; margin-right: 16px;">
              <h6 style="
                font-weight: bold;
                color: black;
                margin-bottom: 8px;
                font-size: 18px;
              ">
                Invoice to:
              </h6>
              <h5 style="font-weight: bold; margin-bottom: 8px; color: black; font-size: 20px;">
                ${invoice.corporateCustomer?.corporateName || 'N/A'}
              </h5>
              ${invoice.contactPerson?.name ? `
              <div style="display: flex; align-items: center; margin-bottom: 4px;">
                <span style="margin-right: 8px; font-size: 16px; color: #666666;">👤</span>
                <span style="color: black;">${invoice.contactPerson.name}</span>
              </div>
              ` : ''}
              ${invoice.contactPerson?.phone ? `
              <div style="display: flex; align-items: center; margin-bottom: 4px;">
                <span style="margin-right: 8px; font-size: 16px; color: #666666;">📞</span>
                <span style="color: black;">${invoice.contactPerson.phone}</span>
              </div>
              ` : ''}
              ${invoice.contactPerson?.email ? `
              <div style="display: flex; align-items: center; margin-bottom: 4px;">
                <span style="margin-right: 8px; font-size: 16px; color: #666666;">✉️</span>
                <span style="color: black;">${invoice.contactPerson.email}</span>
              </div>
              ` : ''}
              ${invoice.corporateCustomer?.address ? `
              <div style="display: flex; align-items: flex-start; margin-bottom: 4px;">
                <span style="margin-right: 8px; font-size: 16px; color: #666666; margin-top: 2px;">📍</span>
                <span style="white-space: pre-line; color: black;">${invoice.corporateCustomer.address}</span>
              </div>
              ` : ''}
            </div>

            <!-- Right Side - Invoice Details -->
            <div style="min-width: 250px; flex-shrink: 0;">
                <div style="color: black; margin-bottom: 4px;">
                  <strong>Date:</strong> ${formatDateOnly(new Date())}
                </div>
              <div style="color: black; margin-bottom: 4px;">
                <strong>Invoice #</strong> ${formatCorporateInvoiceForInvoice(invoice.invoiceNumber || invoice.orderDetails?.billInvoice) || 'N/A'}
              </div>
              <div style="color: black; margin-bottom: 4px;">
                <strong>Tax #</strong> 798633319-RT0001
              </div>
            </div>
          </div>

          <!-- Items Table and Totals - Professional Layout -->
          <div style="margin-bottom: 16px;">
            <div style="
              border: 2px solid #333333;
              border-radius: 0;
              overflow: hidden;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            ">
              <table style="
                width: 100%;
                border-collapse: collapse;
                background-color: white;
                table-layout: fixed;
              ">
                <thead>
                  <tr style="background-color: #f5f5f5;">
                    <th style="
                      width: 66.67%;
                      padding: 8px 16px;
                      text-align: left;
                      font-weight: bold;
                      color: #333333;
                      background-color: #f5f5f5;
                      border: none;
                      border-bottom: 2px solid #333333;
                      border-right: 1px solid #ddd;
                      font-size: 14px;
                      text-transform: uppercase;
                      letter-spacing: 0.5px;
                    ">Description</th>
                    <th style="
                      width: 11.11%;
                      padding: 8px 16px;
                      text-align: center;
                      font-weight: bold;
                      color: #333333;
                      background-color: #f5f5f5;
                      border: none;
                      border-bottom: 2px solid #333333;
                      border-right: 1px solid #ddd;
                      font-size: 14px;
                      text-transform: uppercase;
                      letter-spacing: 0.5px;
                    ">Price</th>
                    <th style="
                      width: 11.11%;
                      padding: 8px 16px;
                      text-align: center;
                      font-weight: bold;
                      color: #333333;
                      background-color: #f5f5f5;
                      border: none;
                      border-bottom: 2px solid #333333;
                      border-right: 1px solid #ddd;
                      font-size: 14px;
                      text-transform: uppercase;
                      letter-spacing: 0.5px;
                    ">Unit</th>
                    <th style="
                      width: 11.11%;
                      padding: 8px 16px;
                      text-align: right;
                      font-weight: bold;
                      color: #333333;
                      background-color: #f5f5f5;
                      border: none;
                      border-bottom: 2px solid #333333;
                      font-size: 14px;
                      text-transform: uppercase;
                      letter-spacing: 0.5px;
                    ">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${(() => {
                    const furnitureGroups = invoice.furnitureGroups || [];
                    let rows = '';
                    
                    if (furnitureGroups.length === 0) {
                      rows = `
                        <tr>
                          <td colspan="4" style="
                            padding: 16px;
                            text-align: center;
                            color: #666666;
                            font-style: italic;
                            border: none;
                          ">
                            No items found
                          </td>
                        </tr>
                      `;
                    } else {
                      furnitureGroups.forEach((group, groupIndex) => {
                        // Add furniture group header
                        rows += `
                          <tr style="background-color: #f8f9fa;">
                            <td colspan="4" style="
                              font-weight: bold;
                              color: #274290;
                              padding: 10px 16px;
                              text-transform: uppercase;
                              border: none;
                              border-bottom: 1px solid #ddd;
                            ">
                              ${group.furnitureType || `Furniture Group ${groupIndex + 1}`}
                            </td>
                          </tr>
                        `;
                        
                        // Create items from furniture group data
                        const groupItems = [];
                        
                        // Add material item
                        if (group.materialPrice && group.materialQnty && parseFloat(group.materialPrice) > 0) {
                          groupItems.push({
                            name: `${group.materialCompany || 'Material'} - ${group.materialCode || 'Code'}`,
                            price: parseFloat(group.materialPrice) || 0,
                            quantity: parseFloat(group.materialQnty) || 0
                          });
                        }
                        
                        // Add labour item
                        if (group.labourPrice && group.labourQnty && parseFloat(group.labourPrice) > 0) {
                          groupItems.push({
                            name: `Labour Work${group.labourNote ? ` - ${group.labourNote}` : ''}`,
                            price: parseFloat(group.labourPrice) || 0,
                            quantity: parseFloat(group.labourQnty) || 0
                          });
                        }
                        
                        // Add foam item if enabled
                        if (group.foamEnabled && group.foamPrice && group.foamQnty && parseFloat(group.foamPrice) > 0) {
                          groupItems.push({
                            name: `Foam${group.foamNote ? ` - ${group.foamNote}` : ''}`,
                            price: parseFloat(group.foamPrice) || 0,
                            quantity: parseFloat(group.foamQnty) || 0
                          });
                        }
                        
                        // Add painting item if enabled
                        if (group.paintingEnabled && group.paintingLabour && group.paintingQnty && parseFloat(group.paintingLabour) > 0) {
                          groupItems.push({
                            name: `Painting${group.paintingNote ? ` - ${group.paintingNote}` : ''}`,
                            price: parseFloat(group.paintingLabour) || 0,
                            quantity: parseFloat(group.paintingQnty) || 0
                          });
                        }
                        
                        // Add all items from this group
                        groupItems.forEach(item => {
                          const total = item.price * item.quantity;
                          rows += `
                            <tr>
                              <td style="padding: 8px 16px; border: none; border-bottom: 1px solid #ddd; color: black;">${item.name}</td>
                              <td style="padding: 8px 16px; text-align: center; border: none; border-bottom: 1px solid #ddd; color: black;">$${item.price.toFixed(2)}</td>
                              <td style="padding: 8px 16px; text-align: center; border: none; border-bottom: 1px solid #ddd; color: black;">${item.quantity}</td>
                              <td style="padding: 8px 16px; text-align: right; border: none; border-bottom: 1px solid #ddd; color: black;">$${total.toFixed(2)}</td>
                            </tr>
                          `;
                        });
                      });
                    }
                    
                    return rows;
                  })()}
                </tbody>
              </table>
            </div>
          </div>
          
          <!-- Terms and Conditions + Totals Section - Side by side -->
          <div style="margin-top: 4px;">
            <div style="display: flex; width: 100%; gap: 16px;">
              <!-- Left Side - Terms and Conditions -->
              <div style="flex: 0 0 50%; max-width: 50%;">
                <div class="terms-header" style="
                  background-color: #cc820d;
                  color: white;
                  padding: 8px;
                  margin-bottom: 8px;
                ">
                  <h6 style="
                    font-weight: bold;
                    color: white;
                    text-align: center;
                    text-transform: uppercase;
                    margin: 0;
                    font-size: 16px;
                  ">
                    Terms and Conditions
                  </h6>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <div>
                    <p style="font-weight: bold; color: black; margin: 0 0 4px 0; font-size: 14px;">
                      Payment by Cheque: <span style="font-size: 10px; font-weight: normal; color: #666;">(for corporates only)</span>
                    </p>
                    <p style="color: black; margin: 0; font-size: 12px;">
                      Mail to: 322 Etheridge ave, Milton, ON CANADA L9E 1H7
                    </p>
                  </div>
                  
                  <div>
                    <p style="font-weight: bold; color: black; margin: 0 0 4px 0; font-size: 14px;">
                      Payment by direct deposit:
                    </p>
                    <p style="color: black; margin: 0; font-size: 12px;">
                      Transit Number: 07232
                    </p>
                    <p style="color: black; margin: 0; font-size: 12px;">
                      Institution Number: 010
                    </p>
                    <p style="color: black; margin: 0; font-size: 12px;">
                      Account Number: 1090712
                    </p>
                  </div>
                  
                  <div>
                    <p style="font-weight: bold; color: black; margin: 0 0 4px 0; font-size: 14px;">
                      Payment by e-transfer:
                    </p>
                    <p style="color: black; margin: 0; font-size: 12px;">
                      JL@JLupholstery.com
                    </p>
                  </div>
                </div>
              </div>
              
              <!-- Right Side - Totals Section -->
              <div style="flex: 1; display: flex; justify-content: flex-end; align-items: flex-start;">
                <div style="min-width: 300px; max-width: 400px;">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="color: black; font-size: 14px;">Subtotal:</span>
                    <span style="font-weight: bold; color: black; font-size: 14px;">
                      $${totals.subtotal.toFixed(2)}
                    </span>
                  </div>
                  
                  <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="color: black; font-size: 14px;">Tax Rate:</span>
                    <span style="font-weight: bold; color: black; font-size: 14px;">
                      13%
                    </span>
                  </div>
                  
                  <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="color: black; font-size: 14px;">Tax Due:</span>
                    <span style="font-weight: bold; color: black; font-size: 14px;">
                      $${totals.tax.toFixed(2)}
                    </span>
                  </div>
                  
                  ${creditCardFeeEnabled ? `
                  <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="color: black; font-size: 14px;">Credit Card Fee:</span>
                    <span style="font-weight: bold; color: black; font-size: 14px;">
                      $${totals.creditCardFee.toFixed(2)}
                    </span>
                  </div>
                  ` : ''}
                  
                  <div class="paid-box" style="
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 4px;
                    background-color: #4CAF50;
                    color: white;
                    padding: 8px;
                    border-radius: 4px;
                  ">
                    <span style="font-weight: bold; color: white; font-size: 14px;">Paid:</span>
                    <span style="font-weight: bold; color: white; font-size: 14px;">
                      $0.00
                    </span>
                  </div>
                  
                  <div class="balance-box" style="
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 4px;
                    background-color: #cc820d;
                    color: white;
                    padding: 8px;
                    border-radius: 4px;
                  ">
                    <span style="font-weight: bold; color: white; font-size: 14px;">Balance:</span>
                    <span style="font-weight: bold; color: white; font-size: 14px;">
                      $${totals.total.toFixed(2)}
                    </span>
                  </div>
                  
                  <div class="total-box" style="
                    display: flex;
                    justify-content: space-between;
                    background-color: #2c2c2c;
                    color: white;
                    padding: 8px;
                    border-radius: 4px;
                  ">
                    <span style="font-weight: bold; color: white; font-size: 14px;">Total:</span>
                    <span style="font-weight: bold; color: white; font-size: 14px;">
                      $${totals.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Invoice Footer Image -->
          <div class="invoice-footer" style="
            margin-top: 24px;
            width: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
          ">
            <img 
              src="/assets/images/invoice-headers/invoice Footer.png" 
              alt="Invoice Footer" 
              style="
                width: 100%;
                height: auto;
                max-width: 100%;
                object-fit: contain;
                display: block;
              "
            />
          </div>
        </div>
      </body>
      </html>
    `;
  };

  // Generate customer invoice HTML (same format as PrintInvoicePage)
  const generateCustomerInvoiceHTML = (invoice, totals) => {
    const companyInfo = {
      name: 'JL Operations',
      address: '322 Etheridge ave, Milton, ON CANADA L9E 1H7',
      email: 'JL@JLupholstery.com',
      taxNumber: '798633319-RT0001'
    };
    
    const paidAmount = invoice.paidAmount || invoice.calculations?.paidAmount || 0;
    const balance = totals.grandTotal - paidAmount;
    const taxPercentage = invoice.headerSettings?.taxPercentage || 13;
    const creditCardFeeEnabled = invoice.headerSettings?.creditCardFeeEnabled || false;
    const creditCardFee = invoice.calculations?.creditCardFeeAmount || 0;
    
    // Generate items table rows
    const generateItemsRows = () => {
      const furnitureGroups = invoice.furnitureGroups || [];
      const items = invoice.items || [];
      
      if (furnitureGroups.length === 0 && items.length === 0) {
        return `
          <tr>
            <td colspan="4" style="
              padding: 16px;
              text-align: center;
              color: #666666;
              font-style: italic;
              border: none;
            ">
              No items found
            </td>
          </tr>
        `;
      }
      
      let rows = '';
      const itemsByGroup = {};
      
      // Group items by their furniture group index
      items.forEach(item => {
        const match = item.id?.match(/item-(\d+)-/);
        const groupIndex = match ? parseInt(match[1]) : 0;
        if (!itemsByGroup[groupIndex]) {
          itemsByGroup[groupIndex] = [];
        }
        itemsByGroup[groupIndex].push(item);
      });
      
      // Render each furniture group with its items
      furnitureGroups.forEach((group, groupIndex) => {
        // Add furniture group header
        rows += `
          <tr style="background-color: #f8f9fa;">
            <td colspan="4" style="
              padding: 10px 16px;
              font-weight: bold;
              color: #274290;
              border: none;
              border-bottom: 1px solid #ddd;
              font-size: 14px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            ">
              ${group.name}
            </td>
          </tr>
        `;
        
        // Add items that belong to this group
        const groupItems = itemsByGroup[groupIndex] || [];
        groupItems.forEach((item) => {
          const itemTotal = (parseFloat(item.quantity || 0) * parseFloat(item.price || 0));
          rows += `
            <tr>
              <td style="
                width: 66.67%;
                padding: 8px 16px;
                color: #333333;
                border: none;
                border-bottom: 1px solid #ddd;
                border-right: 1px solid #eee;
                font-size: 14px;
              ">
                ${item.name}
              </td>
              <td style="
                width: 11.11%;
                padding: 8px 16px;
                text-align: center;
                color: #333333;
                border: none;
                border-bottom: 1px solid #ddd;
                border-right: 1px solid #eee;
                font-size: 14px;
                font-weight: 500;
              ">
                $${parseFloat(item.price || 0).toFixed(2)}
              </td>
              <td style="
                width: 11.11%;
                padding: 8px 16px;
                text-align: center;
                color: #333333;
                border: none;
                border-bottom: 1px solid #ddd;
                border-right: 1px solid #eee;
                font-size: 14px;
                font-weight: 500;
              ">
                ${item.quantity || 0}
              </td>
              <td style="
                width: 11.11%;
                padding: 8px 16px;
                text-align: right;
                font-weight: bold;
                color: #333333;
                border: none;
                border-bottom: 1px solid #ddd;
                font-size: 14px;
              ">
                $${itemTotal.toFixed(2)}
              </td>
            </tr>
          `;
        });
      });
      
      // Add any ungrouped items
      const ungroupedItems = items.filter(item => {
        const match = item.id?.match(/item-(\d+)-/);
        const groupIndex = match ? parseInt(match[1]) : -1;
        return groupIndex >= furnitureGroups.length;
      });
      
      ungroupedItems.forEach((item) => {
        const itemTotal = (parseFloat(item.quantity || 0) * parseFloat(item.price || 0));
        rows += `
          <tr>
            <td style="
              width: 66.67%;
              padding: 8px 16px;
              color: #333333;
              border: none;
              border-bottom: 1px solid #ddd;
              border-right: 1px solid #eee;
              font-size: 14px;
            ">
              ${item.name}
            </td>
            <td style="
              width: 11.11%;
              padding: 8px 16px;
              text-align: center;
              color: #333333;
              border: none;
              border-bottom: 1px solid #ddd;
              border-right: 1px solid #eee;
              font-size: 14px;
              font-weight: 500;
            ">
              $${parseFloat(item.price || 0).toFixed(2)}
            </td>
            <td style="
              width: 11.11%;
              padding: 8px 16px;
              text-align: center;
              color: #333333;
              border: none;
              border-bottom: 1px solid #ddd;
              border-right: 1px solid #eee;
              font-size: 14px;
              font-weight: 500;
            ">
              ${item.quantity || 0}
            </td>
            <td style="
              width: 11.11%;
              padding: 8px 16px;
              text-align: right;
              font-weight: bold;
              color: #333333;
              border: none;
              border-bottom: 1px solid #ddd;
              font-size: 14px;
            ">
              $${itemTotal.toFixed(2)}
            </td>
          </tr>
        `;
      });
      
      return rows;
    };
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Customer Invoice - ${formatCorporateInvoiceForInvoice(invoice.invoiceNumber) || 'N/A'}</title>
        <style>
          @media print {
            @page {
              margin: 0.5in;
              size: letter;
            }
            
            body {
              -webkit-print-color-adjust: exact;
              color-adjust: exact;
              print-color-adjust: exact;
              background: white !important;
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
            }
            
            .invoice-header {
              position: relative !important;
              margin-bottom: 16px !important;
              padding: 0 !important;
              width: 100% !important;
              background: white !important;
            }
            
            .invoice-header img {
              max-height: 100px !important;
              width: 100% !important;
              object-fit: contain !important;
              display: block !important;
            }
            
            .invoice-footer {
              position: relative !important;
              margin-top: 24px !important;
              padding: 0 !important;
              width: 100% !important;
            }
            
            .invoice-footer img {
              max-height: 100px !important;
              width: 100% !important;
              object-fit: contain !important;
              display: block !important;
            }
            
            .terms-header {
              background-color: #cc820d !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            
            .terms-header * {
              color: white !important;
            }
            
            .paid-box {
              background-color: #4CAF50 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            
            .balance-box {
              background-color: ${balance >= 0 ? '#cc820d' : '#4CAF50'} !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            
            .total-box {
              background-color: #2c2c2c !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            
            .paid-box *, .balance-box *, .total-box * {
              color: white !important;
            }
          }
        </style>
      </head>
      <body>
        <div style="width: 100%; padding: 20px; box-sizing: border-box;">
          <!-- Professional Invoice Header - Image Only -->
          <div class="invoice-header" style="
            margin-bottom: 16px;
            position: relative;
            overflow: hidden;
            width: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
          ">
            <img 
              src="/assets/images/invoice-headers/Invoice Header.png" 
              alt="Invoice Header" 
              style="
                width: 100%;
                height: auto;
                max-width: 100%;
                object-fit: contain;
                display: block;
              "
            />
          </div>

          <!-- Invoice Information Row - Left: Customer Info, Right: Date/Invoice/Tax -->
          <div style="
            margin-bottom: 16px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          ">
            <!-- Left Side - Customer Information -->
            <div style="flex: 1; margin-right: 16px;">
              <h6 style="
                font-weight: bold;
                color: black;
                margin-bottom: 8px;
                font-size: 18px;
              ">
                Invoice to:
              </h6>
              <h5 style="font-weight: bold; margin-bottom: 8px; color: black; font-size: 20px;">
                ${invoice.customerInfo?.customerName || invoice.originalCustomerInfo?.customerName || 'N/A'}
              </h5>
              ${invoice.customerInfo?.phone || invoice.originalCustomerInfo?.phone ? `
              <div style="display: flex; align-items: center; margin-bottom: 4px;">
                <span style="margin-right: 8px; font-size: 16px; color: #666666;">📞</span>
                <span style="color: black;">${invoice.customerInfo?.phone || invoice.originalCustomerInfo?.phone}</span>
              </div>
              ` : ''}
              ${invoice.customerInfo?.email || invoice.originalCustomerInfo?.email ? `
              <div style="display: flex; align-items: center; margin-bottom: 4px;">
                <span style="margin-right: 8px; font-size: 16px; color: #666666;">✉️</span>
                <span style="color: black;">${invoice.customerInfo?.email || invoice.originalCustomerInfo?.email}</span>
              </div>
              ` : ''}
              ${invoice.customerInfo?.address || invoice.originalCustomerInfo?.address ? `
              <div style="display: flex; align-items: flex-start; margin-bottom: 4px;">
                <span style="margin-right: 8px; font-size: 16px; color: #666666; margin-top: 2px;">📍</span>
                <span style="white-space: pre-line; color: black;">${invoice.customerInfo?.address || invoice.originalCustomerInfo?.address}</span>
              </div>
              ` : ''}
            </div>

            <!-- Right Side - Invoice Details -->
            <div style="min-width: 250px; flex-shrink: 0;">
              <div style="color: black; margin-bottom: 4px;">
                <strong>Date:</strong> ${formatDateOnly(invoice.createdAt || invoice.closedAt || new Date())}
              </div>
              <div style="color: black; margin-bottom: 4px;">
                <strong>Invoice #</strong> ${formatCorporateInvoiceForInvoice(invoice.invoiceNumber) || 'N/A'}
              </div>
              <div style="color: black; margin-bottom: 4px;">
                <strong>Tax #</strong> ${companyInfo.taxNumber}
              </div>
            </div>
          </div>

          <!-- Items Table and Totals - Professional Layout -->
          <div style="margin-bottom: 16px;">
            <div style="
              border: 2px solid #333333;
              border-radius: 0;
              overflow: hidden;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            ">
              <table style="
                width: 100%;
                border-collapse: collapse;
                background-color: white;
                table-layout: fixed;
              ">
                <thead>
                  <tr style="background-color: #f5f5f5;">
                    <th style="
                      width: 66.67%;
                      padding: 8px 16px;
                      text-align: left;
                      font-weight: bold;
                      color: #333333;
                      background-color: #f5f5f5;
                      border: none;
                      border-bottom: 2px solid #333333;
                      border-right: 1px solid #ddd;
                      font-size: 14px;
                      text-transform: uppercase;
                      letter-spacing: 0.5px;
                    ">Description</th>
                    <th style="
                      width: 11.11%;
                      padding: 8px 16px;
                      text-align: center;
                      font-weight: bold;
                      color: #333333;
                      background-color: #f5f5f5;
                      border: none;
                      border-bottom: 2px solid #333333;
                      border-right: 1px solid #ddd;
                      font-size: 14px;
                      text-transform: uppercase;
                      letter-spacing: 0.5px;
                    ">Price</th>
                    <th style="
                      width: 11.11%;
                      padding: 8px 16px;
                      text-align: center;
                      font-weight: bold;
                      color: #333333;
                      background-color: #f5f5f5;
                      border: none;
                      border-bottom: 2px solid #333333;
                      border-right: 1px solid #ddd;
                      font-size: 14px;
                      text-transform: uppercase;
                      letter-spacing: 0.5px;
                    ">Unit</th>
                    <th style="
                      width: 11.11%;
                      padding: 8px 16px;
                      text-align: right;
                      font-weight: bold;
                      color: #333333;
                      background-color: #f5f5f5;
                      border: none;
                      border-bottom: 2px solid #333333;
                      font-size: 14px;
                      text-transform: uppercase;
                      letter-spacing: 0.5px;
                    ">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${generateItemsRows()}
                </tbody>
              </table>
            </div>
          </div>
          
          <!-- Terms and Conditions + Totals Section - Side by side -->
          <div style="margin-top: 4px;">
            <div style="display: flex; width: 100%; gap: 16px;">
              <!-- Left Side - Terms and Conditions -->
              <div style="flex: 0 0 50%; max-width: 50%;">
                <div class="terms-header" style="
                  background-color: #cc820d;
                  color: white;
                  padding: 8px;
                  margin-bottom: 8px;
                ">
                  <h6 style="
                    font-weight: bold;
                    color: white;
                    text-align: center;
                    text-transform: uppercase;
                    margin: 0;
                    font-size: 16px;
                  ">
                    Terms and Conditions
                  </h6>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <div>
                    <p style="font-weight: bold; color: black; margin: 0 0 4px 0; font-size: 14px;">
                      Payment by Cheque: <span style="font-size: 10px; font-weight: normal; color: #666;">(for corporates only)</span>
                    </p>
                    <p style="color: black; margin: 0; font-size: 12px;">
                      Mail to: ${companyInfo.address}
                    </p>
                  </div>
                  
                  <div>
                    <p style="font-weight: bold; color: black; margin: 0 0 4px 0; font-size: 14px;">
                      Payment by direct deposit:
                    </p>
                    <p style="color: black; margin: 0; font-size: 12px;">
                      Transit Number: 07232
                    </p>
                    <p style="color: black; margin: 0; font-size: 12px;">
                      Institution Number: 010
                    </p>
                    <p style="color: black; margin: 0; font-size: 12px;">
                      Account Number: 1090712
                    </p>
                  </div>
                  
                  <div>
                    <p style="font-weight: bold; color: black; margin: 0 0 4px 0; font-size: 14px;">
                      Payment by e-transfer:
                    </p>
                    <p style="color: black; margin: 0; font-size: 12px;">
                      ${companyInfo.email}
                    </p>
                  </div>
                </div>
              </div>
              
              <!-- Right Side - Totals Section -->
              <div style="flex: 1; display: flex; justify-content: flex-end; align-items: flex-start;">
                <div style="min-width: 300px; max-width: 400px;">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="color: black; font-size: 14px;">Subtotal:</span>
                    <span style="font-weight: bold; color: black; font-size: 14px;">
                      $${totals.subtotal.toFixed(2)}
                    </span>
                  </div>
                  
                  <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="color: black; font-size: 14px;">Tax Rate:</span>
                    <span style="font-weight: bold; color: black; font-size: 14px;">
                      ${taxPercentage}%
                    </span>
                  </div>
                  
                  <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="color: black; font-size: 14px;">Tax Due:</span>
                    <span style="font-weight: bold; color: black; font-size: 14px;">
                      $${totals.taxAmount.toFixed(2)}
                    </span>
                  </div>
                  
                  ${creditCardFeeEnabled && creditCardFee > 0 ? `
                  <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="color: black; font-size: 14px;">Credit Card Fee:</span>
                    <span style="font-weight: bold; color: black; font-size: 14px;">
                      $${creditCardFee.toFixed(2)}
                    </span>
                  </div>
                  ` : ''}
                  
                  <div class="paid-box" style="
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 4px;
                    background-color: #4CAF50;
                    color: white;
                    padding: 8px;
                    border-radius: 4px;
                  ">
                    <span style="font-weight: bold; color: white; font-size: 14px;">Paid:</span>
                    <span style="font-weight: bold; color: white; font-size: 14px;">
                      $${paidAmount.toFixed(2)}
                    </span>
                  </div>
                  
                  <div class="balance-box" style="
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 4px;
                    background-color: ${balance >= 0 ? '#cc820d' : '#4CAF50'};
                    color: white;
                    padding: 8px;
                    border-radius: 4px;
                  ">
                    <span style="font-weight: bold; color: white; font-size: 14px;">Balance:</span>
                    <span style="font-weight: bold; color: white; font-size: 14px;">
                      $${balance.toFixed(2)}
                    </span>
                  </div>
                  
                  <div class="total-box" style="
                    display: flex;
                    justify-content: space-between;
                    background-color: #2c2c2c;
                    color: white;
                    padding: 8px;
                    border-radius: 4px;
                  ">
                    <span style="font-weight: bold; color: white; font-size: 14px;">Total:</span>
                    <span style="font-weight: bold; color: white; font-size: 14px;">
                      $${totals.grandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Signature Section - Right Aligned -->
          <div style="display: flex; justify-content: flex-end; align-items: flex-start; margin-top: 24px; margin-bottom: 24px;">
            <div style="text-align: center; min-width: 300px; margin-right: 32px;">
              <p style="color: black; margin: 0 0 8px 0; font-size: 12px;">
                Signature
              </p>
              <div style="
                width: 250px;
                height: 1px;
                background-color: black;
                margin: 0 auto 4px auto;
              "></div>
              <p style="
                color: black;
                font-family: 'Brush Script MT', 'Lucida Handwriting', 'Kalam', cursive;
                font-size: 1.5rem;
                font-weight: normal;
                font-style: normal;
                letter-spacing: 0.1em;
                text-align: center;
                margin: 0;
              ">
                Ahmed Albaghdadi
              </p>
            </div>
          </div>

          <!-- Invoice Footer Image -->
          <div class="invoice-footer" style="
            margin-top: 24px;
            width: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
          ">
            <img 
              src="/assets/images/invoice-headers/invoice Footer.png" 
              alt="Invoice Footer" 
              style="
                width: 100%;
                height: auto;
                max-width: 100%;
                object-fit: contain;
                display: block;
              "
            />
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const generateInvoiceHTML = (invoice, totals) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Taxed Invoice - ${formatCorporateInvoiceForInvoice(invoice.invoiceNumber || invoice.orderDetails?.billInvoice) || 'N/A'}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 12px;
            background-color: #ffffff;
            color: #000000;
          }
          .invoice-container {
            max-width: 210mm;
            margin: 0 auto;
            padding: 12px;
            background-color: #ffffff;
            color: #000000;
            min-height: 297mm;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid #ccc;
          }
          .customer-info {
            flex: 1;
          }
          .customer-name {
            font-size: 1.5rem;
            font-weight: bold;
            color: #000000;
            margin-bottom: 8px;
          }
          .invoice-number {
            text-align: right;
          }
          .invoice-number h1 {
            font-size: 1.5rem;
            font-weight: bold;
            color: #000000;
            margin: 0 0 4px 0;
          }
          .logo {
            height: 45px;
            width: auto;
            margin-bottom: 8px;
          }
          .taxed-badge {
            background-color: #4caf50;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8rem;
            font-weight: bold;
            margin-top: 8px;
            display: inline-block;
          }
          .table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
          }
          .table th {
            background-color: #f0f0f0;
            border: 1px solid #ccc;
            padding: 4px 8px;
            font-size: 0.8rem;
            font-weight: bold;
            text-align: left;
          }
          .table td {
            border: 1px solid #ccc;
            padding: 2px 4px;
            font-size: 0.8rem;
            text-align: left;
          }
          .totals-section {
            width: 300px;
            margin-left: auto;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
            font-size: 0.8rem;
          }
          .total-row.grand-total {
            border-top: 1px solid #ccc;
            padding-top: 4px;
            margin-bottom: 8px;
            font-weight: bold;
            font-size: 0.9rem;
          }
          .footer {
            margin-top: 12px;
            padding-top: 8px;
            text-align: center;
            font-size: 0.8rem;
            color: #666666;
            border-top: 1px solid #ccc;
          }
          @media print {
            body { margin: 0; padding: 0; }
            .invoice-container { box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <!-- Header -->
          <div class="header">
            <div class="customer-info">
              <div class="customer-name">
                ${invoice.orderType === 'corporate' 
                  ? (invoice.corporateCustomer?.corporateName || 'N/A')
                  : (invoice.customerInfo?.customerName || invoice.originalCustomerInfo?.customerName || 'N/A')
                }
              </div>
              <div style="display: flex; gap: 16px;">
                <div>
                  <div class="detail-item">Phone: ${invoice.orderType === 'corporate'
                    ? (invoice.contactPerson?.phone || 'N/A')
                    : (invoice.customerInfo?.phone || invoice.originalCustomerInfo?.phone || 'N/A')
                  }</div>
                  <div class="detail-item">Email: ${invoice.orderType === 'corporate'
                    ? (invoice.contactPerson?.email || 'N/A')
                    : (invoice.customerInfo?.email || invoice.originalCustomerInfo?.email || 'N/A')
                  }</div>
                </div>
                <div>
                  <div class="detail-item">Address: ${invoice.orderType === 'corporate'
                    ? (invoice.corporateCustomer?.address || 'N/A')
                    : (invoice.customerInfo?.address || invoice.originalCustomerInfo?.address || 'N/A')
                  }</div>
                  <div class="detail-item">Date: ${formatDate(invoice.closedAt || invoice.createdAt)}</div>
                </div>
              </div>
            </div>
            <div class="invoice-number">
              <img src="/assets/images/logo-001.png" alt="JL Upholstery Logo" class="logo">
              <h1>${formatCorporateInvoiceForInvoice(invoice.invoiceNumber || invoice.orderDetails?.billInvoice) || 'N/A'}</h1>
              <div class="taxed-badge">TAXED INVOICE</div>
            </div>
          </div>

          <!-- Invoice Items Table -->
          <table class="table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${generateInvoiceItemsHTML(invoice)}
            </tbody>
          </table>

          <!-- Totals -->
          <div class="totals-section">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>${formatCurrency(totals.grandTotal - (totals.grandTotal * 0.13))}</span>
            </div>
            <div class="total-row">
              <span>Tax (13%):</span>
              <span>${formatCurrency(totals.grandTotal * 0.13)}</span>
            </div>
            <div class="total-row grand-total">
              <span>Grand Total:</span>
              <span>${formatCurrency(totals.grandTotal)}</span>
            </div>
            <div class="total-row">
              <span>Amount Paid:</span>
              <span>${formatCurrency(totals.amountPaid)}</span>
            </div>
            <div class="total-row">
              <span>Balance Due:</span>
              <span>${formatCurrency(totals.balanceDue)}</span>
            </div>
          </div>

          <div class="footer">
            <p>This invoice has been closed and moved to taxed invoices.</p>
            <p>Closed on: ${formatDate(invoice.closedAt)}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const generateInvoiceItemsHTML = (invoice) => {
    if (!invoice.furnitureGroups || !Array.isArray(invoice.furnitureGroups)) {
      return '<tr><td colspan="4">No items found</td></tr>';
    }

    let html = '';
    
    invoice.furnitureGroups.forEach((group, groupIndex) => {
      if (group.furnitureType) {
        html += `
          <tr style="background-color: #f8f8f8;">
            <td colspan="4" style="font-weight: bold; padding: 4px 8px;">
              ${group.furnitureType}
            </td>
          </tr>
        `;
        
        // Materials
        if (group.materialCode && group.materialPrice) {
          html += `
            <tr>
              <td>Material: ${group.materialCode}</td>
              <td>${group.materialQnty || 1}</td>
              <td>${formatCurrency(group.materialPrice)}</td>
              <td>${formatCurrency((parseFloat(group.materialPrice) || 0) * (parseFloat(group.materialQnty) || 1))}</td>
            </tr>
          `;
        }
        
        // Labour
        if (group.labourPrice) {
          html += `
            <tr>
              <td>Labour${group.labourNote ? ': ' + group.labourNote : ''}</td>
              <td>${group.labourQnty || 1}</td>
              <td>${formatCurrency(group.labourPrice)}</td>
              <td>${formatCurrency((parseFloat(group.labourPrice) || 0) * (parseFloat(group.labourQnty) || 1))}</td>
            </tr>
          `;
        }
        
        // Foam
        if (group.foamEnabled && group.foamPrice) {
          html += `
            <tr>
              <td>Foam${group.foamNote ? ': ' + group.foamNote : ''}</td>
              <td>${group.foamQnty || 1}</td>
              <td>${formatCurrency(group.foamPrice)}</td>
              <td>${formatCurrency((parseFloat(group.foamPrice) || 0) * (parseFloat(group.foamQnty) || 1))}</td>
            </tr>
          `;
        }
      }
    });
    
    return html;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#274290', mb: 1 }}>
          T- Format Invoices
        </Typography>
        <Typography variant="body1" color="text.secondary">
          View and manage all T- format invoices (closed and in-progress) from corporate orders and customer invoices
        </Typography>
      </Box>

      {/* Filters and Search */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={5}>
            <TextField
              fullWidth
              placeholder="Search by customer name, invoice number, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Date Filter</InputLabel>
              <Select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                label="Date Filter"
              >
                <MenuItem value="all">All Time</MenuItem>
                <MenuItem value="today">Today</MenuItem>
                <MenuItem value="week">This Week</MenuItem>
                <MenuItem value="month">This Month</MenuItem>
                <MenuItem value="year">This Year</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', mr: 1 }}>
                Status:
              </Typography>
              <Button
                variant={statusFilter === 'all' ? 'contained' : 'outlined'}
                onClick={() => setStatusFilter('all')}
                size="small"
                sx={{
                  backgroundColor: statusFilter === 'all' ? '#b98f33' : 'transparent',
                  color: statusFilter === 'all' ? '#000' : '#b98f33',
                  borderColor: '#b98f33',
                  '&:hover': {
                    backgroundColor: statusFilter === 'all' ? '#d4af5a' : 'rgba(185, 143, 51, 0.1)',
                    borderColor: '#b98f33'
                  }
                }}
              >
                All T- Invoices
              </Button>
              <Button
                variant={statusFilter === 'closed' ? 'contained' : 'outlined'}
                onClick={() => setStatusFilter('closed')}
                size="small"
                sx={{
                  backgroundColor: statusFilter === 'closed' ? '#4CAF50' : 'transparent',
                  color: statusFilter === 'closed' ? '#fff' : '#4CAF50',
                  borderColor: '#4CAF50',
                  '&:hover': {
                    backgroundColor: statusFilter === 'closed' ? '#45a049' : 'rgba(76, 175, 80, 0.1)',
                    borderColor: '#4CAF50'
                  }
                }}
              >
                Closed Only
              </Button>
              <Button
                variant={statusFilter === 'in-progress' ? 'contained' : 'outlined'}
                onClick={() => setStatusFilter('in-progress')}
                size="small"
                sx={{
                  backgroundColor: statusFilter === 'in-progress' ? '#f27921' : 'transparent',
                  color: statusFilter === 'in-progress' ? '#fff' : '#f27921',
                  borderColor: '#f27921',
                  '&:hover': {
                    backgroundColor: statusFilter === 'in-progress' ? '#e66a0f' : 'rgba(242, 121, 33, 0.1)',
                    borderColor: '#f27921'
                  }
                }}
              >
                In Progress
              </Button>
              <Chip 
                label={`${filteredInvoices.length} invoices`}
                color="primary"
                variant="outlined"
                sx={{ ml: 'auto' }}
              />
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Invoices Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell sx={{ fontWeight: 'bold' }}>Invoice # (T-)</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Invoice #</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Customer</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Invoice Date</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Date Closed</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Subtotal</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Tax</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Total</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} align="center" sx={{ py: 4 }}>
                    <Typography variant="body1" color="text.secondary">
                      {taxedInvoices.length === 0 
                        ? 'No T- format invoices found. Make sure you have created invoices with T- format (T-100001, T-100002, etc.)'
                        : 'No invoices match the current filters. Try adjusting your search or filter criteria.'
                      }
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((invoice) => {
                  const totals = calculateInvoiceTotals(invoice);
                  return (
                    <TableRow key={invoice.id} hover>
                    <TableCell>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                        {invoice.invoiceNumber || invoice.orderDetails?.billInvoice || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {invoice.orderType === 'customer' || invoice.source === 'customer-invoices' ? (
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#274290' }}>
                          {invoice.originalOrderNumber || 'N/A'}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={invoice.orderType === 'corporate' || invoice.source === 'corporate-orders' ? 'Corporate' : 'Customer'}
                        size="small"
                        color={invoice.orderType === 'corporate' || invoice.source === 'corporate-orders' ? 'primary' : 'secondary'}
                        sx={{ 
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          backgroundColor: invoice.orderType === 'corporate' || invoice.source === 'corporate-orders' ? '#f27921' : '#274290',
                          color: '#fff'
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={invoice.status === 'closed' ? 'Closed' : 'In Progress'}
                        size="small"
                        color={invoice.status === 'closed' ? 'success' : 'warning'}
                        sx={{ fontSize: '0.75rem' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                          {invoice.orderType === 'corporate' 
                            ? (invoice.corporateCustomer?.corporateName || 'N/A')
                            : (invoice.customerInfo?.customerName || invoice.originalCustomerInfo?.customerName || 'N/A')
                          }
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {invoice.orderType === 'corporate'
                            ? (invoice.contactPerson?.phone || 'N/A')
                            : (invoice.customerInfo?.phone || invoice.originalCustomerInfo?.phone || 'N/A')
                          }
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const invoiceDate = invoice.createdAt || invoice.dateCreated || invoice.invoiceDate;
                        console.log('Invoice date fields:', {
                          createdAt: invoice.createdAt,
                          dateCreated: invoice.dateCreated,
                          invoiceDate: invoice.invoiceDate,
                          selected: invoiceDate
                        });
                        return formatDate(invoiceDate);
                      })()}
                    </TableCell>
                    <TableCell>
                      {invoice.status === 'closed' 
                        ? formatDate(invoice.closedAt)
                        : <Typography variant="body2" color="text.secondary">N/A</Typography>
                      }
                    </TableCell>
                    <TableCell>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                        {formatCurrency(totals.subtotal)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#d32f2f' }}>
                        {formatCurrency(totals.taxAmount)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                        {formatCurrency(totals.grandTotal)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="View Invoice">
                          <IconButton 
                            size="small" 
                            onClick={() => handleViewInvoice(invoice)}
                            sx={{ color: '#274290' }}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Print Invoice">
                          <IconButton 
                            size="small" 
                            onClick={() => handlePrintInvoice(invoice)}
                            sx={{ color: '#b98f33' }}
                          >
                            <PrintIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* View Invoice Dialog */}
      <Dialog 
        open={viewDialogOpen} 
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Invoice #{formatCorporateInvoiceForInvoice(selectedInvoice?.invoiceNumber || selectedInvoice?.orderDetails?.billInvoice) || 'N/A'} - {selectedInvoice?.status === 'closed' ? 'Closed' : 'In Progress'} Invoice
        </DialogTitle>
        <DialogContent>
          {selectedInvoice && (
            <Box>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" sx={{ mb: 1 }}>Customer Information</Typography>
                  <Typography><strong>Name:</strong> {selectedInvoice.orderType === 'corporate' 
                    ? (selectedInvoice.corporateCustomer?.corporateName || 'N/A')
                    : (selectedInvoice.customerInfo?.customerName || selectedInvoice.originalCustomerInfo?.customerName || 'N/A')
                  }</Typography>
                  <Typography><strong>Phone:</strong> {selectedInvoice.orderType === 'corporate'
                    ? (selectedInvoice.contactPerson?.phone || 'N/A')
                    : (selectedInvoice.customerInfo?.phone || selectedInvoice.originalCustomerInfo?.phone || 'N/A')
                  }</Typography>
                  <Typography><strong>Email:</strong> {selectedInvoice.orderType === 'corporate'
                    ? (selectedInvoice.contactPerson?.email || 'N/A')
                    : (selectedInvoice.customerInfo?.email || selectedInvoice.originalCustomerInfo?.email || 'N/A')
                  }</Typography>
                  <Typography><strong>Address:</strong> {selectedInvoice.orderType === 'corporate'
                    ? (selectedInvoice.corporateCustomer?.address || 'N/A')
                    : (selectedInvoice.customerInfo?.address || selectedInvoice.originalCustomerInfo?.address || 'N/A')
                  }</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" sx={{ mb: 1 }}>Invoice Details</Typography>
                  <Typography><strong>Invoice #:</strong> {formatCorporateInvoiceForInvoice(selectedInvoice.invoiceNumber || selectedInvoice.orderDetails?.billInvoice) || 'N/A'}</Typography>
                  <Typography><strong>Status:</strong> 
                    <Chip
                      label={selectedInvoice.status === 'closed' ? 'Closed' : 'In Progress'}
                      size="small"
                      color={selectedInvoice.status === 'closed' ? 'success' : 'warning'}
                      sx={{ ml: 1 }}
                    />
                  </Typography>
                  <Typography><strong>Date Closed:</strong> {formatDate(selectedInvoice.closedAt)}</Typography>
                  <Typography><strong>Subtotal:</strong> {formatCurrency(calculateInvoiceTotals(selectedInvoice).subtotal)}</Typography>
                  <Typography><strong>Tax (13%):</strong> {formatCurrency(calculateInvoiceTotals(selectedInvoice).taxAmount)}</Typography>
                  <Typography><strong>Total Amount:</strong> {formatCurrency(calculateInvoiceTotals(selectedInvoice).grandTotal)}</Typography>
                  <Typography><strong>Amount Paid:</strong> {formatCurrency(calculateInvoiceTotals(selectedInvoice).amountPaid)}</Typography>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
          <Button 
            onClick={() => selectedInvoice && handlePrintInvoice(selectedInvoice)}
            variant="contained"
            startIcon={<PrintIcon />}
            sx={{ backgroundColor: '#b98f33' }}
          >
            Print Invoice
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleCloseNotification} 
          severity={notification.type}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TaxedInvoicesPage;
