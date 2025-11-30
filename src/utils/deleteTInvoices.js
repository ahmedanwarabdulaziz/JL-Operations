import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Utility function to delete all T- format invoices
 * This will delete invoices from:
 * - corporate-orders (where orderDetails.billInvoice starts with T-)
 * - customer-invoices (where invoiceNumber starts with T-)
 * - taxedInvoices (where invoiceNumber or orderDetails.billInvoice starts with T-)
 */
export const deleteAllTInvoices = async () => {
  const deletedInvoices = {
    corporateOrders: [],
    customerInvoices: [],
    taxedInvoices: []
  };

  try {
    console.log('Starting deletion of T- format invoices...');

    // Helper function to check if invoice number is T- format
    const isTFormatInvoice = (invoiceNumber) => {
      if (!invoiceNumber) return false;
      return String(invoiceNumber).trim().toUpperCase().startsWith('T-');
    };

    // 1. Delete from corporate-orders
    console.log('Checking corporate-orders...');
    const corporateOrdersRef = collection(db, 'corporate-orders');
    const corporateOrdersSnapshot = await getDocs(corporateOrdersRef);
    
    for (const docSnap of corporateOrdersSnapshot.docs) {
      const orderData = docSnap.data();
      const invoiceNumber = orderData.orderDetails?.billInvoice;
      
      if (isTFormatInvoice(invoiceNumber)) {
        await deleteDoc(doc(db, 'corporate-orders', docSnap.id));
        deletedInvoices.corporateOrders.push({
          id: docSnap.id,
          invoiceNumber: invoiceNumber
        });
        console.log(`Deleted corporate order: ${invoiceNumber}`);
      }
    }

    // 2. Delete from customer-invoices
    console.log('Checking customer-invoices...');
    const customerInvoicesRef = collection(db, 'customer-invoices');
    const customerInvoicesSnapshot = await getDocs(customerInvoicesRef);
    
    for (const docSnap of customerInvoicesSnapshot.docs) {
      const invoiceData = docSnap.data();
      const invoiceNumber = invoiceData.invoiceNumber;
      
      if (isTFormatInvoice(invoiceNumber)) {
        await deleteDoc(doc(db, 'customer-invoices', docSnap.id));
        deletedInvoices.customerInvoices.push({
          id: docSnap.id,
          invoiceNumber: invoiceNumber
        });
        console.log(`Deleted customer invoice: ${invoiceNumber}`);
      }
    }

    // 3. Delete from taxedInvoices
    console.log('Checking taxedInvoices...');
    const taxedInvoicesRef = collection(db, 'taxedInvoices');
    const taxedInvoicesSnapshot = await getDocs(taxedInvoicesRef);
    
    for (const docSnap of taxedInvoicesSnapshot.docs) {
      const invoiceData = docSnap.data();
      const invoiceNumber = invoiceData.invoiceNumber || invoiceData.orderDetails?.billInvoice;
      
      if (isTFormatInvoice(invoiceNumber)) {
        await deleteDoc(doc(db, 'taxedInvoices', docSnap.id));
        deletedInvoices.taxedInvoices.push({
          id: docSnap.id,
          invoiceNumber: invoiceNumber
        });
        console.log(`Deleted taxed invoice: ${invoiceNumber}`);
      }
    }

    // Summary
    const totalDeleted = 
      deletedInvoices.corporateOrders.length + 
      deletedInvoices.customerInvoices.length + 
      deletedInvoices.taxedInvoices.length;

    console.log('\n=== Deletion Summary ===');
    console.log(`Corporate Orders deleted: ${deletedInvoices.corporateOrders.length}`);
    console.log(`Customer Invoices deleted: ${deletedInvoices.customerInvoices.length}`);
    console.log(`Taxed Invoices deleted: ${deletedInvoices.taxedInvoices.length}`);
    console.log(`Total deleted: ${totalDeleted}`);

    return {
      success: true,
      deleted: deletedInvoices,
      total: totalDeleted
    };
  } catch (error) {
    console.error('Error deleting T- invoices:', error);
    return {
      success: false,
      error: error.message,
      deleted: deletedInvoices
    };
  }
};


