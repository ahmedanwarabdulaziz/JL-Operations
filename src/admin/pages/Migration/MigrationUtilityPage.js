import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Divider
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Storage as StorageIcon,
  PlayArrow as PlayArrowIcon
} from '@mui/icons-material';
import { migrateClosedCorporateOrders } from '../../../utils/migrateClosedCorporateOrders';
import { useNotification } from '../../../shared/components/Common/NotificationSystem';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../../firebase/config';

const MigrationUtilityPage = () => {
  const [loading, setLoading] = useState(false);
  const [migrationResult, setMigrationResult] = useState(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [stats, setStats] = useState({ closed: 0, active: 0 });
  const { showSuccess, showError } = useNotification();

  // Fetch statistics
  React.useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Count closed corporate orders
      const closedOrdersRef = collection(db, 'closed-corporate-orders');
      const closedSnapshot = await getDocs(closedOrdersRef);
      const closedCount = closedSnapshot.size;

      // Count active corporate orders
      const corporateOrdersRef = collection(db, 'corporate-orders');
      const corporateSnapshot = await getDocs(corporateOrdersRef);
      const activeCount = corporateSnapshot.docs.filter(
        doc => doc.data().status !== 'closed' && doc.data().orderDetails?.status !== 'closed'
      ).length;

      setStats({ closed: closedCount, active: activeCount });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleRunMigration = async () => {
    setLoading(true);
    setMigrationResult(null);
    
    try {
      const result = await migrateClosedCorporateOrders();
      setMigrationResult(result);
      
      if (result.success) {
        showSuccess(`Migration completed successfully! Migrated ${result.migrated} orders.`);
        await fetchStats(); // Refresh stats
      } else {
        showError(`Migration completed with ${result.errors.length} errors. Check details below.`);
      }
    } catch (error) {
      console.error('Migration error:', error);
      showError(`Migration failed: ${error.message}`);
      setMigrationResult({
        success: false,
        migrated: 0,
        skipped: 0,
        errors: [{ error: error.message }]
      });
    } finally {
      setLoading(false);
      setConfirmDialogOpen(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Corporate Orders Migration Utility
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        This utility migrates orders from the <strong>closed-corporate-orders</strong> collection 
        to the <strong>corporate-orders</strong> collection with status 'closed'. 
        This should be run once before deploying the updated code.
      </Alert>

      {/* Statistics Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Current Status
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            <Chip 
              label={`Closed Orders: ${stats.closed}`} 
              color="warning" 
              icon={<StorageIcon />}
            />
            <Chip 
              label={`Active Orders: ${stats.active}`} 
              color="success" 
              icon={<StorageIcon />}
            />
          </Box>
        </CardContent>
      </Card>

      {/* Migration Button */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Run Migration
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Click the button below to start the migration. This will:
        </Typography>
        <List dense>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="success" />
            </ListItemIcon>
            <ListItemText primary="Move all orders from closed-corporate-orders to corporate-orders" />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="success" />
            </ListItemIcon>
            <ListItemText primary="Set status to 'closed' for migrated orders" />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="success" />
            </ListItemIcon>
            <ListItemText primary="Check for duplicates before migrating" />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="success" />
            </ListItemIcon>
            <ListItemText primary="Preserve all order data" />
          </ListItem>
        </List>
        
        <Box sx={{ mt: 3 }}>
          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<PlayArrowIcon />}
            onClick={() => setConfirmDialogOpen(true)}
            disabled={loading || stats.closed === 0}
          >
            {loading ? 'Running Migration...' : 'Run Migration'}
          </Button>
          {stats.closed === 0 && (
            <Alert severity="success" sx={{ mt: 2 }}>
              No orders to migrate. Migration may have already been completed.
            </Alert>
          )}
        </Box>
      </Paper>

      {/* Loading Indicator */}
      {loading && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Migration in Progress
          </Typography>
          <LinearProgress sx={{ mt: 2 }} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Please wait while orders are being migrated. Do not close this page.
          </Typography>
        </Paper>
      )}

      {/* Migration Results */}
      {migrationResult && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Migration Results
          </Typography>
          
          <Box sx={{ mt: 2 }}>
            <Chip 
              label={`Successfully Migrated: ${migrationResult.migrated}`} 
              color="success" 
              icon={<CheckCircleIcon />}
              sx={{ mr: 1, mb: 1 }}
            />
            {migrationResult.skipped > 0 && (
              <Chip 
                label={`Skipped (Duplicates): ${migrationResult.skipped}`} 
                color="warning" 
                icon={<WarningIcon />}
                sx={{ mr: 1, mb: 1 }}
              />
            )}
            {migrationResult.errors.length > 0 && (
              <Chip 
                label={`Errors: ${migrationResult.errors.length}`} 
                color="error" 
                icon={<ErrorIcon />}
                sx={{ mb: 1 }}
              />
            )}
          </Box>

          {migrationResult.errors.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" color="error" gutterBottom>
                Errors:
              </Typography>
              <List dense>
                {migrationResult.errors.map((error, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <ErrorIcon color="error" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={error.billInvoice || error.orderId || 'Unknown order'} 
                      secondary={error.error}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {migrationResult.success && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Migration completed successfully! You can now deploy the updated code.
            </Alert>
          )}
        </Paper>
      )}

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
      >
        <DialogTitle>Confirm Migration</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to run the migration? This will:
            <ul>
              <li>Move {stats.closed} orders from closed-corporate-orders to corporate-orders</li>
              <li>Set their status to 'closed'</li>
              <li>Delete them from the closed-corporate-orders collection</li>
            </ul>
            <strong>This action cannot be undone.</strong> Make sure you have a backup of your database.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleRunMigration} 
            variant="contained" 
            color="primary"
            disabled={loading}
          >
            Run Migration
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MigrationUtilityPage;

