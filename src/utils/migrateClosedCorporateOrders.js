/**
 * Migration Script: Move orders from closed-corporate-orders to corporate-orders
 * 
 * This script migrates all orders from the 'closed-corporate-orders' collection
 * to the 'corporate-orders' collection with status 'closed'.
 * 
 * IMPORTANT: Run this script BEFORE updating the code to use only corporate-orders collection.
 * 
 * Usage:
 * 1. Import this function in a page or component temporarily
 * 2. Call migrateClosedCorporateOrders() 
 * 3. Check console for results
 * 4. Remove the import and call after migration is complete
 */

import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';

// Helper to get the "done" status value
const getDoneStatusValue = async () => {
  try {
    const statusesRef = collection(db, 'invoiceStatuses');
    const statusesSnapshot = await getDocs(statusesRef);
    const statusesData = statusesSnapshot.docs.map(doc => doc.data());
    const doneStatus = statusesData.find(status => 
      status.isEndState && status.endStateType === 'done'
    );
    return doneStatus ? doneStatus.value : null;
  } catch (error) {
    console.error('Error fetching invoice statuses:', error);
    return null;
  }
};

export const migrateClosedCorporateOrders = async () => {
  try {
    console.log('🚀 Starting migration of closed corporate orders...');
    
    // 1. Fetch all orders from closed-corporate-orders collection
    const closedOrdersRef = collection(db, 'closed-corporate-orders');
    const closedOrdersQuery = query(closedOrdersRef, orderBy('createdAt', 'desc'));
    const closedOrdersSnapshot = await getDocs(closedOrdersQuery);
    
    const closedOrders = closedOrdersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`📊 Found ${closedOrders.length} orders in closed-corporate-orders collection`);
    
    if (closedOrders.length === 0) {
      console.log('✅ No orders to migrate. Migration complete.');
      return { success: true, migrated: 0, errors: [] };
    }
    
    // 2. Check for duplicates in corporate-orders collection
    const corporateOrdersRef = collection(db, 'corporate-orders');
    const corporateOrdersSnapshot = await getDocs(corporateOrdersRef);
    const existingCorporateOrders = corporateOrdersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Create a map of existing orders by billInvoice for duplicate checking
    const existingBillInvoices = new Set(
      existingCorporateOrders.map(order => order.orderDetails?.billInvoice).filter(Boolean)
    );
    
    // Also check by document ID in case billInvoice is missing
    const existingOrderIds = new Set(existingCorporateOrders.map(order => order.id));
    
    let migrated = 0;
    let skipped = 0;
    const errors = [];
    
    // Get the "done" status value for invoiceStatus
    const doneStatusValue = await getDoneStatusValue();
    if (!doneStatusValue) {
      console.warn('⚠️  Warning: Could not find "done" status in invoiceStatuses. Orders will be migrated without invoiceStatus.');
    }
    
    // 3. Migrate each order
    for (const closedOrder of closedOrders) {
      try {
        const billInvoice = closedOrder.orderDetails?.billInvoice;
        
        // Check if order already exists in corporate-orders (by billInvoice or ID)
        if (billInvoice && existingBillInvoices.has(billInvoice)) {
          console.log(`⏭️  Skipping order ${billInvoice} - already exists in corporate-orders (by billInvoice)`);
          skipped++;
          continue;
        }
        
        // Also check if the order ID already exists (in case it was migrated before)
        if (existingOrderIds.has(closedOrder.id)) {
          console.log(`⏭️  Skipping order ${closedOrder.id} - already exists in corporate-orders (by ID)`);
          skipped++;
          continue;
        }
        
        // Prepare order data with invoiceStatus set to done status
        const orderData = {
          ...closedOrder,
          migratedFrom: 'closed-corporate-orders',
          migratedAt: new Date()
        };
        
        // Set invoiceStatus to done status if available
        if (doneStatusValue) {
          orderData.invoiceStatus = doneStatusValue;
        }
        
        // Remove the id field as it will be auto-generated
        delete orderData.id;
        
        // Add to corporate-orders collection
        await addDoc(corporateOrdersRef, orderData);
        
        // Delete from closed-corporate-orders collection
        await deleteDoc(doc(db, 'closed-corporate-orders', closedOrder.id));
        
        migrated++;
        console.log(`✅ Migrated order ${billInvoice || closedOrder.id} (${migrated}/${closedOrders.length})`);
        
      } catch (error) {
        console.error(`❌ Error migrating order ${closedOrder.id}:`, error);
        errors.push({
          orderId: closedOrder.id,
          billInvoice: closedOrder.orderDetails?.billInvoice,
          error: error.message
        });
      }
    }
    
    console.log('\n📈 Migration Summary:');
    console.log(`   ✅ Successfully migrated: ${migrated}`);
    console.log(`   ⏭️  Skipped (duplicates): ${skipped}`);
    console.log(`   ❌ Errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Errors details:');
      errors.forEach(err => {
        console.log(`   - Order ${err.billInvoice || err.orderId}: ${err.error}`);
      });
    }
    
    return {
      success: errors.length === 0,
      migrated,
      skipped,
      errors
    };
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

