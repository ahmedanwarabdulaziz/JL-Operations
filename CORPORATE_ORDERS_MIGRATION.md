# Corporate Orders Migration Guide

## Overview
This migration consolidates corporate orders from two collections (`corporate-orders` and `closed-corporate-orders`) into a single collection (`corporate-orders`) using a status field to track closed orders, similar to how regular orders work.

## Changes Made

### 1. Migration Script Created
- **File**: `src/utils/migrateClosedCorporateOrders.js`
- **Purpose**: Moves all orders from `closed-corporate-orders` to `corporate-orders` with status 'closed'
- **Features**:
  - Checks for duplicates before migrating
  - Preserves all order data
  - Adds migration metadata
  - Provides detailed console logging

### 2. Code Updates

#### CorporateInvoicesPage.js
- **Updated**: `handleConfirmClose()` function
  - Now updates status in `corporate-orders` collection instead of moving to `closed-corporate-orders`
  - Sets `orderDetails.status` and `status` to 'closed'
  - Adds `closedAt` timestamp

#### WorkshopPage.js
- **Updated**: `applyAllocation()` function for corporate orders
  - Updates status in `corporate-orders` collection instead of moving to `closed-corporate-orders`
  - Filters out closed corporate orders when fetching active orders

#### EndDonePage.js (both admin and regular)
- **Updated**: `fetchOrders()` function
  - Removed reference to `closed-corporate-orders` collection
  - Now fetches from `corporate-orders` and filters for status 'closed'
  - Updated filtering logic to check `status === 'closed'` or `orderDetails.status === 'closed'`

#### OrdersPage.js
- **Updated**: `fetchOrders()` function
  - Filters out closed corporate orders (status === 'closed') from active orders list

#### CustomerInvoicesPage.js
- **Updated**: Removed `closed-corporate-orders` from collections to check when clearing references

## Migration Steps

### ⚠️ IMPORTANT: Run migration BEFORE deploying code changes

1. **Backup your database** (recommended)

2. **Run the migration script**:
   - Temporarily import the migration function in a page component (e.g., DashboardPage.js)
   - Add a button or call it in useEffect to run the migration
   - Example:
   ```javascript
   import { migrateClosedCorporateOrders } from '../utils/migrateClosedCorporateOrders';
   
   // In component:
   useEffect(() => {
     // Uncomment to run migration (run once only!)
     // migrateClosedCorporateOrders().then(result => {
     //   console.log('Migration result:', result);
     // });
   }, []);
   ```

3. **Verify migration**:
   - Check console logs for migration summary
   - Verify orders appear in `corporate-orders` collection with status 'closed'
   - Verify `closed-corporate-orders` collection is empty (or can be deleted)

4. **Deploy code changes**:
   - All code changes are ready to deploy
   - The new code will work with the migrated data structure

## Data Structure

### Before Migration
- Active corporate orders: `corporate-orders` collection
- Closed corporate orders: `closed-corporate-orders` collection

### After Migration
- All corporate orders: `corporate-orders` collection
  - Active orders: `status !== 'closed'` or no status field
  - Closed orders: `status === 'closed'` or `orderDetails.status === 'closed'`

## Status Field Usage

Corporate orders now use the `status` field similar to regular orders:
- **'pending'**: Newly created orders (default)
- **'closed'**: Orders that have been closed/completed

The `orderDetails.status` field is also set to 'closed' for consistency.

## Testing Checklist

- [ ] Run migration script successfully
- [ ] Verify closed orders appear in `corporate-orders` with status 'closed'
- [ ] Test closing a corporate invoice (should update status, not move collection)
- [ ] Test workshop allocation for corporate orders (should update status)
- [ ] Verify EndDone page shows closed corporate orders correctly
- [ ] Verify Orders page doesn't show closed corporate orders
- [ ] Verify Workshop page doesn't show closed corporate orders
- [ ] Verify CorporateInvoices page shows all corporate orders (including closed)

## Rollback Plan

If issues occur:
1. The migration script preserves original data in `closed-corporate-orders` until deletion
2. Code can be reverted to previous version
3. Data can be manually moved back if needed

## Notes

- The migration script checks for duplicates by `billInvoice` number
- Orders are migrated with `migratedFrom` and `migratedAt` fields for tracking
- The `closed-corporate-orders` collection can be safely deleted after migration verification

