import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  Divider,
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
  Switch,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import {
  FileDownload as DownloadIcon,
  Visibility as ViewIcon,
  Receipt as ReceiptIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Print as PrintIcon,
  Search as SearchIcon,
  Business as BusinessIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  LocationOn as LocationIcon,
  Archive as ArchiveIcon,
} from '@mui/icons-material';
import { collection, getDocs, query, orderBy, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import { calculateOrderTotal, calculateOrderCost, calculateOrderTax, getOrderCostBreakdown, formatFurnitureDetails, isRapidOrder, calculatePickupDeliveryCost } from '../../../shared/utils/orderCalculations';
import { fetchMaterialCompanyTaxRates, getMaterialCompanyTaxRate } from '../../../shared/utils/materialTaxRates';
import autoTable from 'jspdf-autotable';
import { useNotification } from '../../../shared/components/Common/NotificationSystem';
import { formatDate, formatDateOnly } from '../../../utils/dateUtils';
import { formatCorporateInvoiceForInvoice } from '../../../utils/invoiceNumberUtils';

// Register the autoTable plugin
jsPDF.API.autoTable = autoTable;

const CorporateInvoicesPage = () => {
  const [corporateOrders, setCorporateOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [creditCardFeeEnabled, setCreditCardFeeEnabled] = useState(false);
  const [savingFeeToggle, setSavingFeeToggle] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: '', type: 'info' });
  const [materialTaxRates, setMaterialTaxRates] = useState({});
  const [groupByNote, setGroupByNote] = useState(false);
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    fetchCorporateOrders();
    fetchMaterialCompanyTaxRates().then(setMaterialTaxRates);
  }, []);

  const fetchCorporateOrders = async () => {
    try {
      setLoading(true);
      
      // Fetch corporate orders
      const corporateOrdersRef = collection(db, 'corporate-orders');
      const q = query(corporateOrdersRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const ordersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setCorporateOrders(ordersData);
      setFilteredOrders(ordersData);
      
    } catch (error) {
      console.error('Error fetching corporate orders:', error);
      showError('Failed to fetch corporate orders');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (searchValue) => {
    setSearchTerm(searchValue);
    
    if (!searchValue.trim()) {
      setFilteredOrders(corporateOrders);
      return;
    }

    const searchLower = searchValue.toLowerCase();
    const filtered = corporateOrders.filter(order => {
      // Search in bill number
      if (order.orderDetails?.billInvoice?.toLowerCase().includes(searchLower)) {
        return true;
      }

      // Search in corporate customer info
      const corporateCustomer = order.corporateCustomer || {};
      const contactPerson = order.contactPerson || {};
      if (
        corporateCustomer.corporateName?.toLowerCase().includes(searchLower) ||
        corporateCustomer.email?.toLowerCase().includes(searchLower) ||
        corporateCustomer.phone?.toLowerCase().includes(searchLower) ||
        contactPerson.name?.toLowerCase().includes(searchLower) ||
        contactPerson.email?.toLowerCase().includes(searchLower) ||
        contactPerson.phone?.toLowerCase().includes(searchLower)
      ) {
        return true;
      }

      // Search in furniture data
      const furnitureGroups = order.furnitureGroups || [];
      const hasMatchingFurniture = furnitureGroups.some(group => 
        group.furniture?.some(furniture => 
          furniture.name?.toLowerCase().includes(searchLower) ||
          furniture.material?.toLowerCase().includes(searchLower) ||
          furniture.color?.toLowerCase().includes(searchLower)
        )
      );

      return hasMatchingFurniture;
    });

    setFilteredOrders(filtered);
  };

  const handleOrderSelect = (order) => {
    setSelectedOrder(order);
    // Load credit card fee setting for this order
    setCreditCardFeeEnabled(order.creditCardFeeEnabled || false);
  };

  const handleCreditCardFeeToggle = async (enabled) => {
    if (!selectedOrder) return;

    try {
      setSavingFeeToggle(true);
      setCreditCardFeeEnabled(enabled);
      
      // Update the corporate order with the new credit card fee setting
      const orderRef = doc(db, 'corporate-orders', selectedOrder.id);
      await updateDoc(orderRef, {
        creditCardFeeEnabled: enabled,
        updatedAt: new Date()
      });

      // Update local state
      setSelectedOrder(prev => ({
        ...prev,
        creditCardFeeEnabled: enabled
      }));

      showSuccess(`Credit card fee ${enabled ? 'enabled' : 'disabled'} for this order`);
    } catch (error) {
      console.error('Error updating credit card fee setting:', error);
      showError('Failed to update credit card fee setting');
    } finally {
      setSavingFeeToggle(false);
    }
  };

  const handleCloseCorporateInvoice = () => {
    setCloseDialogOpen(true);
  };

  const handleConfirmClose = async () => {
    if (!selectedOrder) return;

    try {
      const closedAt = new Date();
      
      // 1. Move to done-orders collection
      const doneOrderData = {
        ...selectedOrder,
        orderType: 'corporate',
        source: 'corporate_order',
        closedAt: closedAt,
        status: 'done'
      };
      await addDoc(collection(db, 'done-orders'), doneOrderData);

      // 2. Move to taxedInvoices collection
      const taxedInvoiceData = {
        ...selectedOrder,
        orderType: 'corporate',
        source: 'corporate_order',
        closedAt: closedAt,
        originalInvoiceId: selectedOrder.id
      };
      await addDoc(collection(db, 'taxedInvoices'), taxedInvoiceData);

      // 3. Move to closed-corporate-orders collection for preservation
      const closedOrderData = {
        ...selectedOrder,
        closedAt: closedAt,
        status: 'closed'
      };
      await addDoc(collection(db, 'closed-corporate-orders'), closedOrderData);

      // 4. Delete from corporate-orders collection
      await deleteDoc(doc(db, 'corporate-orders', selectedOrder.id));

      // 5. Update local state
      setSelectedOrder(null);
      await fetchCorporateOrders();
      
      setCloseDialogOpen(false);
      showSuccess('Corporate invoice closed successfully');
    } catch (error) {
      console.error('Error closing corporate invoice:', error);
      showError('Failed to close corporate invoice');
    }
  };

  // Corporate invoice calculations
  const calculateCorporateInvoiceTotals = (order) => {
    if (!order) return { subtotal: 0, delivery: 0, tax: 0, creditCardFee: 0, total: 0 };

    // Calculate subtotal from furniture groups (without delivery)
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

    // Calculate pickup/delivery cost separately
    const paymentDetails = order.paymentDetails || {};
    let delivery = 0;
    if (paymentDetails.pickupDeliveryEnabled) {
      const pickupCost = parseFloat(paymentDetails.pickupDeliveryCost) || 0;
      const serviceType = paymentDetails.pickupDeliveryServiceType;
      if (serviceType === 'both') {
        delivery = pickupCost * 2;
      } else {
        delivery = pickupCost;
      }
    }

    // Calculate tax (13% on subtotal + delivery)
    const tax = (subtotal + delivery) * 0.13;

    // Calculate credit card fee (2.5% on subtotal + delivery + tax) if enabled
    const creditCardFee = creditCardFeeEnabled ? (subtotal + delivery + tax) * 0.025 : 0;

    // Calculate total (subtotal + delivery + tax + credit card fee)
    const total = subtotal + delivery + tax + creditCardFee;

    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      delivery: parseFloat(delivery.toFixed(2)),
      tax: parseFloat(tax.toFixed(2)),
      creditCardFee: parseFloat(creditCardFee.toFixed(2)),
      total: parseFloat(total.toFixed(2))
    };
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const handlePrintInvoice = () => {
    if (!selectedOrder) {
      showError('Please select an order first');
      return;
    }

    try {
      const printWindow = window.open('', '_blank', 'width=800,height=600');
      const totals = calculateCorporateInvoiceTotals(selectedOrder);
      
      // Generate HTML content that matches the customer invoice print design exactly
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Corporate Invoice - ${formatCorporateInvoiceForInvoice(selectedOrder.orderDetails?.billInvoice) || 'N/A'}</title>
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
                  ${selectedOrder.corporateCustomer?.corporateName || 'N/A'}
                </h5>
                ${selectedOrder.contactPerson?.name ? `
                <div style="display: flex; align-items: center; margin-bottom: 4px;">
                  <span style="margin-right: 8px; font-size: 16px; color: #666666;">👤</span>
                  <span style="color: black;">${selectedOrder.contactPerson.name}</span>
                </div>
                ` : ''}
                ${selectedOrder.contactPerson?.phone ? `
                <div style="display: flex; align-items: center; margin-bottom: 4px;">
                  <span style="margin-right: 8px; font-size: 16px; color: #666666;">📞</span>
                  <span style="color: black;">${selectedOrder.contactPerson.phone}</span>
                </div>
                ` : ''}
                ${selectedOrder.contactPerson?.email ? `
                <div style="display: flex; align-items: center; margin-bottom: 4px;">
                  <span style="margin-right: 8px; font-size: 16px; color: #666666;">✉️</span>
                  <span style="color: black;">${selectedOrder.contactPerson.email}</span>
                </div>
                ` : ''}
                ${selectedOrder.corporateCustomer?.address ? `
                <div style="display: flex; align-items: flex-start; margin-bottom: 4px;">
                  <span style="margin-right: 8px; font-size: 16px; color: #666666; margin-top: 2px;">📍</span>
                  <span style="white-space: pre-line; color: black;">${selectedOrder.corporateCustomer.address}</span>
                </div>
                ` : ''}
              </div>

              <!-- Right Side - Invoice Details -->
              <div style="min-width: 250px; flex-shrink: 0;">
                <div style="color: black; margin-bottom: 4px;">
                  <strong>Date:</strong> ${formatDateOnly(new Date())}
                </div>
                <div style="color: black; margin-bottom: 4px;">
                  <strong>Invoice #</strong> ${formatCorporateInvoiceForInvoice(selectedOrder.orderDetails?.billInvoice) || 'N/A'}
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
                      const furnitureGroups = selectedOrder.furnitureGroups || [];
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
                          
                          // Add individual furniture items if they exist
                          if (group.furniture && Array.isArray(group.furniture)) {
                            group.furniture.forEach((furniture, furnitureIndex) => {
                              if (furniture.price && furniture.quantity) {
                                groupItems.push({
                                  name: furniture.name || `Furniture Item ${furnitureIndex + 1}`,
                                  price: parseFloat(furniture.price) || 0,
                                  quantity: parseFloat(furniture.quantity) || 0
                                });
                              }
                            });
                          }
                          
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
                    
                    ${totals.delivery > 0 ? `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                      <span style="color: black; font-size: 14px;">Delivery:</span>
                      <span style="font-weight: bold; color: black; font-size: 14px;">
                        $${totals.delivery.toFixed(2)}
                      </span>
                    </div>
                    ` : ''}
                    
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
      
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      
      showSuccess('Print preview opened successfully');
    } catch (error) {
      console.error('Error generating print preview:', error);
      showError('Failed to generate print preview');
    }
  };

  const getStatusColor = (status) => {
    const statusColors = {
      'pending': 'warning',
      'in-progress': 'info',
      'completed': 'success',
      'cancelled': 'error',
      'on-hold': 'secondary'
    };
    return statusColors[status] || 'default';
  };

  const getStatusText = (order) => {
    return order.orderDetails?.status || 'Unknown';
  };

  const getMaterialSummary = (order) => {
    if (!order.furnitureGroups || order.furnitureGroups.length === 0) {
      return 'No materials';
    }

    const materials = [];
    order.furnitureGroups.forEach(group => {
      if (group.materialCompany && group.materialCode) {
        const materialKey = `${group.materialCompany} - ${group.materialCode}`;
        if (!materials.includes(materialKey)) {
          materials.push(materialKey);
        }
      }
    });

    if (materials.length === 0) {
      return 'No materials';
    }

    return materials.join(', ');
  };

  const getGroupedOrders = () => {
    if (!groupByNote) {
      return filteredOrders;
    }

    // Group orders by note value
    const grouped = {};
    filteredOrders.forEach(order => {
      const noteValue = order.orderDetails?.note?.value || 'No Note';
      if (!grouped[noteValue]) {
        grouped[noteValue] = [];
      }
      grouped[noteValue].push(order);
    });

    // Flatten grouped orders, maintaining order within each group
    const result = [];
    Object.keys(grouped).sort().forEach(note => {
      result.push(...grouped[note]);
    });

    return result;
  };

  return (
    <Box sx={{ p: 3, width: '100%', backgroundColor: 'background.default' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
            Corporate Invoices
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            View and manage corporate invoices • Select an order to view invoice details
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', height: 'calc(100vh - 200px)', backgroundColor: '#f5f5f5' }}>
        {/* Left Column - Corporate Orders List */}
        <Paper 
          sx={{ 
            width: '400px', 
            minWidth: '400px',
            display: 'flex', 
            flexDirection: 'column',
            borderRadius: 0,
            borderRight: '1px solid #e0e0e0'
          }}
        >
          {/* Header */}
          <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <BusinessIcon sx={{ color: '#f27921' }} />
              Corporate Orders
            </Typography>
          
          {/* Search */}
          <TextField
            fullWidth
            size="small"
            placeholder="Search corporate orders..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#666' }} />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />

          {/* Group By Note Toggle */}
          <FormControlLabel
            control={
              <Checkbox
                checked={groupByNote}
                onChange={(e) => setGroupByNote(e.target.checked)}
                sx={{
                  color: '#f27921',
                  '&.Mui-checked': {
                    color: '#f27921'
                  }
                }}
              />
            }
            label="Group by Note"
            sx={{ color: '#f27921', fontWeight: 'bold', fontSize: '0.875rem' }}
          />

        </Box>

        {/* Orders List */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
              <CircularProgress />
            </Box>
          ) : filteredOrders.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {searchTerm ? 'No orders found matching your search.' : 'No corporate orders found.'}
              </Typography>
            </Box>
          ) : (
            <List sx={{ p: 0 }}>
              {filteredOrders.map((order, index) => (
                <React.Fragment key={order.id}>
                  <ListItem
                    button
                    onClick={() => handleOrderSelect(order)}
                    selected={selectedOrder?.id === order.id}
                    sx={{
                      py: 2,
                      px: 2,
                      '&.Mui-selected': {
                        backgroundColor: '#e3f2fd',
                        '&:hover': {
                          backgroundColor: '#e3f2fd',
                        }
                      }
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#f27921' }}>
                            #{order.orderDetails?.billInvoice || 'N/A'}
                          </Typography>
                          <BusinessIcon sx={{ color: '#f27921', fontSize: '1.2rem' }} />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 0.5 }}>
                            {order.corporateCustomer?.corporateName || 'Corporate Customer'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {order.contactPerson?.name && `Contact: ${order.contactPerson.name}`}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                            <Chip
                              label={getStatusText(order)}
                              size="small"
                              color={getStatusColor(getStatusText(order))}
                              sx={{ fontSize: '0.7rem' }}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {formatDateOnly(order.createdAt)}
                            </Typography>
                          </Box>
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < filteredOrders.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </Box>
      </Paper>

      {/* Right Column - Corporate Invoices Display */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedOrder ? (
          <>
            {/* Header with Credit Card Fee Toggle */}
            <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0', backgroundColor: '#000000' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                  Corporate Invoice - #{selectedOrder.orderDetails?.billInvoice}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={creditCardFeeEnabled}
                        onChange={(e) => handleCreditCardFeeToggle(e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Credit Card Fee (2.5%)"
                    sx={{ ml: 0, color: '#b98f33' }}
                  />
                  <Button
                    variant="contained"
                    startIcon={<PrintIcon />}
                    onClick={handlePrintInvoice}
                    sx={{
                      backgroundColor: '#274290',
                      color: 'white',
                      px: 2,
                      py: 1,
                      '&:hover': {
                        backgroundColor: '#1e2f5c'
                      }
                    }}
                  >
                    Print
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<ArchiveIcon />}
                    onClick={handleCloseCorporateInvoice}
                    sx={{
                      backgroundColor: '#274290',
                      color: 'white',
                      px: 2,
                      py: 1,
                      '&:hover': {
                        backgroundColor: '#1e2f5c'
                      }
                    }}
                  >
                    Close Invoice
                  </Button>
                </Box>
              </Box>
              
              <Typography variant="body2" sx={{ color: '#b98f33', mb: 2 }}>
                {selectedOrder.corporateCustomer?.corporateName} • {selectedOrder.contactPerson?.name}
              </Typography>

              {/* Internal JL Cost Analysis */}
              {(() => {
                const furnitureGroups = selectedOrder.furnitureGroups || [];
                
                // Calculate JL costs from all items in the table
                // Grand Total = sum of all Line Totals shown in the table
                let jlSubtotalBeforeTax = 0;
                let jlGrandTotal = 0;
                
                // Calculate from furniture groups
                furnitureGroups.forEach(group => {
                  // Material costs
                  if (group.materialJLPrice && parseFloat(group.materialJLPrice) > 0) {
                    const materialSubtotal = (parseFloat(group.materialJLQnty) || 0) * (parseFloat(group.materialJLPrice) || 0);
                    jlSubtotalBeforeTax += materialSubtotal;
                    const materialTaxRate = getMaterialCompanyTaxRate(group.materialCompany, materialTaxRates);
                    // Line Total = Subtotal * (1 + taxRate)
                    const materialLineTotal = materialSubtotal * (1 + materialTaxRate);
                    jlGrandTotal += materialLineTotal;
                  }
                  
                  // Foam costs (no tax)
                  if (group.foamJLPrice && parseFloat(group.foamJLPrice) > 0) {
                    const foamSubtotal = (parseFloat(group.foamQnty) || 1) * (parseFloat(group.foamJLPrice) || 0);
                    jlSubtotalBeforeTax += foamSubtotal;
                    // Line Total = Subtotal (no tax)
                    jlGrandTotal += foamSubtotal;
                  }
                });
                
                // Calculate from extra expenses
                if (selectedOrder.extraExpenses && selectedOrder.extraExpenses.length > 0) {
                  selectedOrder.extraExpenses.forEach(expense => {
                    const expenseQty = parseFloat(expense.quantity) || parseFloat(expense.qty) || parseFloat(expense.unit) || 1;
                    const expenseSubtotal = expenseQty * (parseFloat(expense.price) || 0);
                    jlSubtotalBeforeTax += expenseSubtotal;
                    
                    // Line Total = expense.total (which already includes tax)
                    // If total is not available, calculate it
                    let expenseLineTotal = 0;
                    if (expense.total !== undefined && expense.total !== null) {
                      expenseLineTotal = parseFloat(expense.total) || 0;
                    } else {
                      // Calculate total if not stored
                      let expenseTax = 0;
                      if (expense.taxRate !== undefined && expense.taxRate !== null) {
                        expenseTax = expenseSubtotal * (parseFloat(expense.taxRate) || 0);
                      } else if (expense.tax !== undefined && expense.tax !== null) {
                        const taxType = expense.taxType || 'fixed';
                        if (taxType === 'percent') {
                          const taxPercent = parseFloat(expense.tax) || 0;
                          expenseTax = expenseSubtotal * (taxPercent / 100);
                        } else {
                          expenseTax = parseFloat(expense.tax) || 0;
                        }
                      } else {
                        // Default to 13% if no tax info
                        expenseTax = expenseSubtotal * 0.13;
                      }
                      expenseLineTotal = expenseSubtotal + expenseTax;
                    }
                    jlGrandTotal += expenseLineTotal;
                  });
                }
                
                return (
                  <Box sx={{ mt: 2, mb: 2 }}>
                    <Typography variant="h6" sx={{ 
                      fontWeight: 'bold', 
                      mb: 1.5,
                      color: '#000000'
                    }}>
                      Internal JL Cost Analysis
                    </Typography>

                    {/* JL Table Header */}
                    <Box sx={{ 
                      display: 'flex',
                      backgroundColor: '#f0f0f0',
                      border: '1px solid #ccc',
                      fontWeight: 'bold',
                      fontSize: '0.8rem',
                      color: '#000000'
                    }}>
                      <Box sx={{ flex: 2, p: 0.5, borderRight: '1px solid #ccc' }}>Component</Box>
                      <Box sx={{ flex: 1, p: 0.5, borderRight: '1px solid #ccc', textAlign: 'right' }}>Qty</Box>
                      <Box sx={{ flex: 1, p: 0.5, borderRight: '1px solid #ccc', textAlign: 'right' }}>Unit Price</Box>
                      <Box sx={{ flex: 1, p: 0.5, borderRight: '1px solid #ccc', textAlign: 'right' }}>Subtotal</Box>
                      <Box sx={{ flex: 1, p: 0.5, borderRight: '1px solid #ccc', textAlign: 'right' }}>TAX</Box>
                      <Box sx={{ flex: 1, p: 0.5, textAlign: 'right' }}>Line Total</Box>
                    </Box>

                    {/* JL Table Content */}
                    {furnitureGroups.map((group, groupIndex) => {
                      // Check if this group has any records (Material, Foam, etc.)
                      const hasMaterial = group.materialJLPrice && parseFloat(group.materialJLPrice) > 0;
                      const hasFoam = group.foamJLPrice && parseFloat(group.foamJLPrice) > 0;
                      const hasRecords = hasMaterial || hasFoam;
                      
                      // Only render the group if it has records
                      if (!hasRecords) return null;
                      
                      return (
                        <Box key={groupIndex}>
                          {/* Furniture Type Header */}
                          <Box sx={{ 
                            display: 'flex',
                            backgroundColor: '#f8f8f8',
                            border: '1px solid #ccc',
                            borderTop: 'none',
                            fontWeight: 'bold',
                            fontSize: '0.8rem',
                            color: '#000000',
                            minHeight: '24px'
                          }}>
                            <Box sx={{ flex: 6, py: 0.25, px: 0.5, display: 'flex', alignItems: 'center' }}>
                              {group.furnitureType || 'Furniture Group'}
                            </Box>
                          </Box>

                          {/* JL Material */}
                          {group.materialJLPrice && parseFloat(group.materialJLPrice) > 0 && (
                            <Box sx={{ 
                              display: 'flex',
                              border: '1px solid #ccc',
                              borderTop: 'none',
                              fontSize: '0.8rem',
                              color: '#000000',
                              backgroundColor: '#ffffff',
                              minHeight: '24px'
                            }}>
                              <Box sx={{ flex: 2, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', display: 'flex', alignItems: 'center' }}>
                                Material ({group.materialCode || 'N/A'})
                              </Box>
                              <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                {(parseFloat(group.materialJLQnty) || 0).toFixed(2)}
                              </Box>
                              <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                ${(parseFloat(group.materialJLPrice) || 0).toFixed(2)}
                              </Box>
                              <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                ${((parseFloat(group.materialJLQnty) || 0) * (parseFloat(group.materialJLPrice) || 0)).toFixed(2)}
                              </Box>
                              <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                ${(((parseFloat(group.materialJLQnty) || 0) * (parseFloat(group.materialJLPrice) || 0)) * getMaterialCompanyTaxRate(group.materialCompany, materialTaxRates)).toFixed(2)}
                              </Box>
                              <Box sx={{ flex: 1, py: 0.25, px: 0.5, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                ${(((parseFloat(group.materialJLQnty) || 0) * (parseFloat(group.materialJLPrice) || 0)) * (1 + getMaterialCompanyTaxRate(group.materialCompany, materialTaxRates))).toFixed(2)}
                              </Box>
                            </Box>
                          )}

                          {/* JL Foam */}
                          {group.foamJLPrice && parseFloat(group.foamJLPrice) > 0 && (
                            <Box sx={{ 
                              display: 'flex',
                              border: '1px solid #ccc',
                              borderTop: 'none',
                              fontSize: '0.8rem',
                              color: '#000000',
                              backgroundColor: '#ffffff',
                              minHeight: '24px'
                            }}>
                              <Box sx={{ flex: 2, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', display: 'flex', alignItems: 'center' }}>
                                Foam
                              </Box>
                              <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                {(parseFloat(group.foamQnty) || 1).toFixed(2)}
                              </Box>
                              <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                ${(parseFloat(group.foamJLPrice) || 0).toFixed(2)}
                              </Box>
                              <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                ${((parseFloat(group.foamQnty) || 1) * (parseFloat(group.foamJLPrice) || 0)).toFixed(2)}
                              </Box>
                              <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                $0.00
                              </Box>
                              <Box sx={{ flex: 1, py: 0.25, px: 0.5, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                ${((parseFloat(group.foamQnty) || 1) * (parseFloat(group.foamJLPrice) || 0)).toFixed(2)}
                              </Box>
                            </Box>
                          )}
                        </Box>
                      );
                    })}

                    {/* Extra Expenses in JL Table */}
                    {selectedOrder.extraExpenses && selectedOrder.extraExpenses.length > 0 && (
                      <>
                        {/* Extra Expenses Header */}
                        <Box sx={{ 
                          display: 'flex',
                          backgroundColor: '#f8f8f8',
                          border: '1px solid #ccc',
                          borderTop: 'none',
                          fontWeight: 'bold',
                          fontSize: '0.8rem',
                          color: '#000000',
                          minHeight: '24px'
                        }}>
                          <Box sx={{ flex: 6, py: 0.25, px: 0.5, display: 'flex', alignItems: 'center' }}>
                            Extra Expenses
                          </Box>
                        </Box>

                        {/* Extra Expenses Items */}
                        {selectedOrder.extraExpenses.map((expense, expenseIndex) => (
                          <Box key={expenseIndex} sx={{ 
                            display: 'flex',
                            border: '1px solid #ccc',
                            borderTop: 'none',
                            fontSize: '0.8rem',
                            color: '#000000',
                            backgroundColor: '#ffffff',
                            minHeight: '24px'
                          }}>
                            <Box sx={{ flex: 2, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', display: 'flex', alignItems: 'center' }}>
                              {expense.description || 'Extra Expense'}
                            </Box>
                            <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                              {(parseFloat(expense.quantity) || parseFloat(expense.qty) || parseFloat(expense.unit) || 1).toFixed(2)}
                            </Box>
                            <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                              ${(parseFloat(expense.price) || 0).toFixed(2)}
                            </Box>
                            <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                              ${((parseFloat(expense.quantity) || parseFloat(expense.qty) || parseFloat(expense.unit) || 1) * (parseFloat(expense.price) || 0)).toFixed(2)}
                            </Box>
                            <Box sx={{ flex: 1, py: 0.25, px: 0.5, borderRight: '1px solid #ccc', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                              ${(((parseFloat(expense.quantity) || parseFloat(expense.qty) || parseFloat(expense.unit) || 1) * (parseFloat(expense.price) || 0)) * (parseFloat(expense.taxRate) || 0.13)).toFixed(2)}
                            </Box>
                            <Box sx={{ flex: 1, py: 0.25, px: 0.5, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                              ${(parseFloat(expense.total) || 0).toFixed(2)}
                            </Box>
                          </Box>
                        ))}
                      </>
                    )}

                    {/* JL Totals */}
                    <Box sx={{ 
                      display: 'flex', 
                      justifyContent: 'flex-end',
                      mt: 1
                    }}>
                      <Box sx={{ 
                        width: 300,
                        backgroundColor: '#f0f0f0',
                        border: '1px solid #999',
                        p: 1.5
                      }}>
                        <Box sx={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          mb: 0.5,
                          fontWeight: 'bold',
                          fontSize: '0.8rem',
                          color: '#000000'
                        }}>
                          <span>Subtotal (Before Tax):</span>
                          <span style={{ color: '#000000' }}>${jlSubtotalBeforeTax.toFixed(2)}</span>
                        </Box>
                        <Box sx={{ 
                          borderTop: '1px solid #ccc',
                          pt: 0.5,
                          display: 'flex', 
                          justifyContent: 'space-between',
                          fontWeight: 'bold',
                          fontSize: '0.9rem',
                          color: '#000000'
                        }}>
                          <span>Grand Total (JL Internal Cost):</span>
                          <span style={{ color: '#f27921' }}>${jlGrandTotal.toFixed(2)}</span>
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                );
              })()}
            </Box>


            {/* Invoice Content */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
              {(() => {
                const totals = calculateCorporateInvoiceTotals(selectedOrder);
                return (
                  <Paper 
                    elevation={3} 
                    sx={{ 
                      p: 4, 
                      width: '100%',
                      mx: 'auto',
                      backgroundColor: 'white',
                      '& .MuiTableHead-root': {
                        backgroundColor: '#ffffff !important'
                      },
                      '& .MuiTableCell-head': {
                        backgroundColor: '#ffffff !important'
                      },
                      '& .MuiTableRow-head': {
                        backgroundColor: '#ffffff !important'
                      }
                    }}
                  >
                    {/* Professional Invoice Header - Image Only */}
                    <Box className="invoice-header" sx={{ 
                      mb: 4,
                      position: 'relative',
                      overflow: 'hidden',
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center'
                    }}>
                      {/* Header Image Only */}
                      <img 
                        src="/assets/images/invoice-headers/Invoice Header.png" 
                        alt="Invoice Header" 
                        style={{ 
                          width: '100%',
                          height: 'auto',
                          maxWidth: '100%',
                          objectFit: 'contain',
                          display: 'block'
                        }}
                      />
                    </Box>

                    {/* Invoice Information Row - Left: Customer Info, Right: Date/Invoice/Tax */}
                    <Box className="invoice-info-section" sx={{ 
                      mb: 4,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start'
                    }}>
                      {/* Left Side - Customer Information */}
                      <Box sx={{ flex: 1, mr: 4 }}>
                        <Typography variant="h6" sx={{ 
                          fontWeight: 'bold', 
                          color: 'black',
                          mb: 2
                        }}>
                          Invoice to:
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2, color: 'black' }}>
                          {selectedOrder.corporateCustomer?.corporateName}
                        </Typography>
                        {selectedOrder.contactPerson?.name && (
                          <Box sx={{ mb: 1 }}>
                            <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black', display: 'inline' }}>
                              Contact: {selectedOrder.contactPerson.name}
                            </Typography>
                            {selectedOrder.orderDetails?.note?.value && (
                              <Typography variant="body1" sx={{ color: 'black', display: 'inline', ml: 1 }}>
                                • <strong>{selectedOrder.orderDetails.note.caption || 'Note'}:</strong> {selectedOrder.orderDetails.note.value}
                              </Typography>
                            )}
                          </Box>
                        )}
                        {selectedOrder.contactPerson?.phone && (
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                            <PhoneIcon sx={{ mr: 1, fontSize: '16px', color: '#666666' }} />
                            <Typography variant="body1" sx={{ color: 'black' }}>
                              {selectedOrder.contactPerson.phone}
                            </Typography>
                          </Box>
                        )}
                        {selectedOrder.contactPerson?.email && (
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                            <EmailIcon sx={{ mr: 1, fontSize: '16px', color: '#666666' }} />
                            <Typography variant="body1" sx={{ color: 'black' }}>
                              {selectedOrder.contactPerson.email}
                            </Typography>
                          </Box>
                        )}
                        {selectedOrder.corporateCustomer?.address && (
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 0.5 }}>
                            <LocationIcon sx={{ mr: 1, fontSize: '16px', color: '#666666', mt: 0.2 }} />
                            <Typography variant="body1" sx={{ whiteSpace: 'pre-line', color: 'black' }}>
                              {selectedOrder.corporateCustomer.address}
                            </Typography>
                          </Box>
                        )}
                      </Box>

                      {/* Right Side - Invoice Details */}
                      <Box sx={{ 
                        minWidth: '250px',
                        flexShrink: 0
                      }}>
                        <Typography variant="body1" sx={{ color: 'black', mb: 1 }}>
                          <strong>Date:</strong> {formatDateOnly(selectedOrder.createdAt)}
                        </Typography>
                        <Typography variant="body1" sx={{ color: 'black', mb: 1 }}>
                          <strong>Invoice #</strong> {formatCorporateInvoiceForInvoice(selectedOrder.orderDetails?.billInvoice)}
                        </Typography>
                        <Typography variant="body1" sx={{ color: 'black', mb: 1 }}>
                          <strong>Tax #</strong> 798633319-RT0001
                        </Typography>
                      </Box>
                    </Box>

                    {/* Items Table and Totals - Professional Layout */}
                    <Box className="invoice-table-section" sx={{ mb: 4 }}>
                      <Box sx={{ 
                        border: '2px solid #333333',
                        borderRadius: 0,
                        overflow: 'hidden',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}>
                        <table style={{ 
                          width: '100%', 
                          borderCollapse: 'collapse',
                          backgroundColor: 'white',
                          tableLayout: 'fixed'
                        }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f5f5f5' }}>
                              <th style={{ 
                                width: '66.67%',
                                padding: '8px 16px',
                                textAlign: 'left',
                                fontWeight: 'bold',
                                color: '#333333',
                                backgroundColor: '#f5f5f5',
                                border: 'none',
                                borderBottom: '2px solid #333333',
                                borderRight: '1px solid #ddd',
                                fontSize: '14px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                              }}>Description</th>
                              <th style={{ 
                                width: '11.11%',
                                padding: '8px 16px',
                                textAlign: 'center',
                                fontWeight: 'bold',
                                color: '#333333',
                                backgroundColor: '#f5f5f5',
                                border: 'none',
                                borderBottom: '2px solid #333333',
                                borderRight: '1px solid #ddd',
                                fontSize: '14px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                              }}>Price</th>
                              <th style={{ 
                                width: '11.11%',
                                padding: '8px 16px',
                                textAlign: 'center',
                                fontWeight: 'bold',
                                color: '#333333',
                                backgroundColor: '#f5f5f5',
                                border: 'none',
                                borderBottom: '2px solid #333333',
                                borderRight: '1px solid #ddd',
                                fontSize: '14px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                              }}>Unit</th>
                              <th style={{ 
                                width: '11.11%',
                                padding: '8px 16px',
                                textAlign: 'right',
                                fontWeight: 'bold',
                                color: '#333333',
                                backgroundColor: '#f5f5f5',
                                border: 'none',
                                borderBottom: '2px solid #333333',
                                fontSize: '14px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                              }}>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const furnitureGroups = selectedOrder.furnitureGroups || [];
                              const rows = [];
                              
                              // If no furniture groups, show a message
                              if (furnitureGroups.length === 0) {
                                rows.push(
                                  <tr key="no-items">
                                    <td colSpan="4" style={{ 
                                      padding: '16px',
                                      textAlign: 'center',
                                      color: '#666666',
                                      fontStyle: 'italic',
                                      border: 'none'
                                    }}>
                                      No items found
                                    </td>
                                  </tr>
                                );
                              } else {
                                // Render each furniture group with its items
                                furnitureGroups.forEach((group, groupIndex) => {
                                  // Add furniture group header
                                  rows.push(
                                    <tr key={`group-${groupIndex}`} style={{ backgroundColor: '#f8f9fa' }}>
                                      <td colSpan="4" style={{ 
                                        padding: '10px 16px',
                                        fontWeight: 'bold',
                                        color: '#274290',
                                        border: 'none',
                                        borderBottom: '1px solid #ddd',
                                        fontSize: '14px',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                      }}>
                                        {group.furnitureType || `Furniture Group ${groupIndex + 1}`}
                                      </td>
                                    </tr>
                                  );
                                  
                                  // Create items from furniture group data
                                  const groupItems = [];
                                  
                                  // Add individual furniture items if they exist
                                  if (group.furniture && Array.isArray(group.furniture)) {
                                    group.furniture.forEach((furniture, furnitureIndex) => {
                                      if (furniture.price && furniture.quantity) {
                                        groupItems.push({
                                          id: `item-${groupIndex}-furniture-${furnitureIndex}`,
                                          name: furniture.name || `Furniture Item ${furnitureIndex + 1}`,
                                          price: parseFloat(furniture.price) || 0,
                                          quantity: parseFloat(furniture.quantity) || 0
                                        });
                                      }
                                    });
                                  }
                                  
                                  // Add material item
                                  if (group.materialPrice && group.materialQnty && parseFloat(group.materialPrice) > 0) {
                                    groupItems.push({
                                      id: `item-${groupIndex}-material`,
                                      name: `${group.materialCompany || 'Material'} - ${group.materialCode || 'Code'}`,
                                      price: parseFloat(group.materialPrice) || 0,
                                      quantity: parseFloat(group.materialQnty) || 0
                                    });
                                  }
                                  
                                  // Add labour item
                                  if (group.labourPrice && group.labourQnty && parseFloat(group.labourPrice) > 0) {
                                    groupItems.push({
                                      id: `item-${groupIndex}-labour`,
                                      name: `Labour Work${group.labourNote ? ` - ${group.labourNote}` : ''}`,
                                      price: parseFloat(group.labourPrice) || 0,
                                      quantity: parseFloat(group.labourQnty) || 0
                                    });
                                  }
                                  
                                  // Add foam item if enabled
                                  if (group.foamEnabled && group.foamPrice && group.foamQnty && parseFloat(group.foamPrice) > 0) {
                                    groupItems.push({
                                      id: `item-${groupIndex}-foam`,
                                      name: `Foam${group.foamNote ? ` - ${group.foamNote}` : ''}`,
                                      price: parseFloat(group.foamPrice) || 0,
                                      quantity: parseFloat(group.foamQnty) || 0
                                    });
                                  }
                                  
                                  // Add painting item if enabled
                                  if (group.paintingEnabled && group.paintingLabour && group.paintingQnty && parseFloat(group.paintingLabour) > 0) {
                                    groupItems.push({
                                      id: `item-${groupIndex}-painting`,
                                      name: `Painting${group.paintingNote ? ` - ${group.paintingNote}` : ''}`,
                                      price: parseFloat(group.paintingLabour) || 0,
                                      quantity: parseFloat(group.paintingQnty) || 0
                                    });
                                  }
                                  
                                  // Add all items from this group
                                  groupItems.forEach((item, itemIndex) => {
                                    rows.push(
                                      <tr key={item.id || `item-${groupIndex}-${itemIndex}`} style={{ 
                                        borderBottom: '1px solid #ddd'
                                      }}>
                                        <td style={{ 
                                          width: '66.67%',
                                          padding: '8px 16px',
                                          color: '#333333',
                                          border: 'none',
                                          borderRight: '1px solid #eee',
                                          fontSize: '14px'
                                        }}>
                                          {item.name}
                                        </td>
                                        <td style={{ 
                                          width: '11.11%',
                                          padding: '8px 16px',
                                          textAlign: 'center',
                                          color: '#333333',
                                          border: 'none',
                                          borderRight: '1px solid #eee',
                                          fontSize: '14px',
                                          fontWeight: '500'
                                        }}>
                                          ${parseFloat(item.price || 0).toFixed(2)}
                                        </td>
                                        <td style={{ 
                                          width: '11.11%',
                                          padding: '8px 16px',
                                          textAlign: 'center',
                                          color: '#333333',
                                          border: 'none',
                                          borderRight: '1px solid #eee',
                                          fontSize: '14px',
                                          fontWeight: '500'
                                        }}>
                                          {item.quantity || 0}
                                        </td>
                                        <td style={{ 
                                          width: '11.11%',
                                          padding: '8px 16px',
                                          textAlign: 'right',
                                          fontWeight: 'bold',
                                          color: '#333333',
                                          border: 'none',
                                          fontSize: '14px'
                                        }}>
                                          ${((parseFloat(item.quantity || 0) * parseFloat(item.price || 0))).toFixed(2)}
                                        </td>
                                      </tr>
                                    );
                                  });
                                  
                                  // If no items were added, show a placeholder
                                  if (groupItems.length === 0) {
                                    rows.push(
                                      <tr key={`no-items-${groupIndex}`} style={{ 
                                        borderBottom: '1px solid #ddd'
                                      }}>
                                        <td colSpan="4" style={{ 
                                          padding: '8px 16px',
                                          color: '#666666',
                                          fontStyle: 'italic',
                                          border: 'none',
                                          fontSize: '14px'
                                        }}>
                                          No items in this group
                                        </td>
                                      </tr>
                                    );
                                  }
                                });
                              }

                              return rows;
                            })()}
                          </tbody>
                        </table>
                      </Box>
                      
                      {/* Terms and Conditions + Totals Section - Side by side */}
                      <Box sx={{ mt: 1 }}>
                        {/* Left Side - Terms and Conditions */}
                        <Box sx={{ 
                          display: 'flex',
                          width: '100%',
                          gap: 4
                        }}>
                          <Box sx={{ 
                            flex: '0 0 50%',
                            maxWidth: '50%'
                          }}>
                            <Box className="terms-header" sx={{ 
                              backgroundColor: '#cc820d',
                              color: 'white',
                              p: 1,
                              mb: 2
                            }}>
                              <Typography variant="h6" sx={{ 
                                fontWeight: 'bold', 
                                color: 'white',
                                textAlign: 'center',
                                textTransform: 'uppercase'
                              }}>
                                Terms and Conditions
                              </Typography>
                            </Box>
                            
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <Box>
                                <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black', mb: 1 }}>
                                  Payment by Cheque: <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#666' }}>(for corporates only)</span>
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'black' }}>
                                  Mail to: 322 Etheridge ave, Milton, ON CANADA L9E 1H7
                                </Typography>
                              </Box>
                              
                              <Box>
                                <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black', mb: 1 }}>
                                  Payment by direct deposit:
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'black' }}>
                                  Transit Number: 07232
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'black' }}>
                                  Institution Number: 010
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'black' }}>
                                  Account Number: 1090712
                                </Typography>
                              </Box>
                              
                              <Box>
                                <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black', mb: 1 }}>
                                  Payment by e-transfer:
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'black' }}>
                                  JL@JLupholstery.com
                                </Typography>
                              </Box>
                            </Box>
                          </Box>

                          {/* Right Side - Totals Section - Far Right */}
                          <Box sx={{ 
                            flex: '1',
                            display: 'flex', 
                            justifyContent: 'flex-end', 
                            alignItems: 'flex-start'
                          }}>
                            <Box className="totals-section" sx={{ 
                              minWidth: '300px',
                              maxWidth: '400px'
                            }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="body1" sx={{ color: 'black' }}>Subtotal:</Typography>
                                <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black' }}>
                                  ${totals.subtotal.toFixed(2)}
                                </Typography>
                              </Box>
                              
                              {totals.delivery > 0 && (
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                  <Typography variant="body1" sx={{ color: 'black' }}>Delivery:</Typography>
                                  <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black' }}>
                                    ${totals.delivery.toFixed(2)}
                                  </Typography>
                                </Box>
                              )}
                              
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="body1" sx={{ color: 'black' }}>Tax Rate:</Typography>
                                <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black' }}>
                                  13%
                                </Typography>
                              </Box>
                              
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="body1" sx={{ color: 'black' }}>Tax Due:</Typography>
                                <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black' }}>
                                  ${totals.tax.toFixed(2)}
                                </Typography>
                              </Box>
                              
                              {creditCardFeeEnabled && (
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                  <Typography variant="body1" sx={{ color: 'black' }}>Credit Card Fee:</Typography>
                                  <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'black' }}>
                                    ${totals.creditCardFee.toFixed(2)}
                                  </Typography>
                                </Box>
                              )}
                              
                              <Box className="total-box" sx={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                mb: 1,
                                backgroundColor: '#2c2c2c',
                                color: 'white',
                                p: 1,
                                borderRadius: 1
                              }}>
                                <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'white !important' }}>
                                  Total:
                                </Typography>
                                <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'white !important' }}>
                                  ${totals.total.toFixed(2)}
                                </Typography>
                              </Box>
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    </Box>

                    {/* Professional Invoice Footer - Image Only */}
                    <Box className="invoice-footer" sx={{ 
                      mt: 4,
                      position: 'relative',
                      overflow: 'hidden',
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center'
                    }}>
                      {/* Footer Image Only */}
                      <img 
                        src="/assets/images/invoice-headers/invoice Footer.png" 
                        alt="Invoice Footer" 
                        style={{ 
                          width: '100%',
                          height: 'auto',
                          maxWidth: '100%',
                          objectFit: 'contain',
                          display: 'block'
                        }}
                      />
                    </Box>
                  </Paper>
                );
              })()}
            </Box>
          </>
        ) : (
          <Box sx={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center', 
            alignItems: 'center',
            p: 3
          }}>
            <BusinessIcon sx={{ fontSize: '4rem', color: '#ccc', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
              Select a Corporate Order
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
              Choose a corporate order from the left panel to view its invoice details.
            </Typography>
          </Box>
        )}
      </Box>
      </Box>

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification({ ...notification, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setNotification({ ...notification, open: false })} 
          severity={notification.type}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>

      {/* Close Invoice Confirmation Dialog */}
      <Dialog open={closeDialogOpen} onClose={() => setCloseDialogOpen(false)}>
        <DialogTitle>Close Corporate Invoice</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to close this corporate invoice? This action will:
          </Typography>
          <ul style={{ marginTop: '16px', paddingLeft: '20px' }}>
            <li>Move the order to Done Orders</li>
            <li>Move the invoice to Taxed Invoices</li>
            <li>Remove it from the Corporate Invoices page</li>
            <li>Remove it from the Workshop</li>
          </ul>
          <Typography sx={{ mt: 2, fontWeight: 'bold' }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloseDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmClose} 
            variant="contained" 
            color="primary"
          >
            Close Invoice
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CorporateInvoicesPage;
