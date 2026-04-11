import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Chip,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Business as BusinessIcon,
  Person as PersonIcon,
  Receipt as ReceiptIcon,
  Gavel as GavelIcon,
  Calculate as CalculateIcon,
  Notes as NotesIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';

const formatCurrency = (v) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(v || 0);

const calcTotals = (furnitureGroups, tax) => {
  let subtotal = 0;
  (furnitureGroups || []).forEach((g) => {
    const mat = (parseFloat(g.materialPrice) || 0) * (parseFloat(g.materialQnty) || 0);
    const lab = (parseFloat(g.labourPrice) || 0) * (parseFloat(g.labourQnty) || 0);
    const foam = g.foamEnabled
      ? (parseFloat(g.foamPrice) || 0) * (parseFloat(g.foamQnty) || 0)
      : 0;
    const paint = g.paintingEnabled
      ? (parseFloat(g.paintingLabour) || 0) * (parseFloat(g.paintingQnty) || 0)
      : 0;
    subtotal += mat + lab + foam + paint;
  });
  const pct = parseFloat(tax?.percentage) || 0;
  const taxAmt = tax?.enabled ? subtotal * (pct / 100) : 0;
  return { subtotal, taxAmt, total: subtotal + taxAmt };
};

const SectionTitle = ({ icon, label }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
    {React.cloneElement(icon, { sx: { color: '#b98f33' } })}
    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{label}</Typography>
  </Box>
);

const QuoteStep5Review = ({
  quoteNumber,
  selectedCustomer,
  isTemporaryCustomer,
  selectedContactPerson,
  furnitureGroups,
  selectedTerms,
  tax,
  notes,
}) => {
  const { subtotal, taxAmt, total } = calcTotals(furnitureGroups, tax);

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3, color: '#b98f33' }}>
        Review Quote — {quoteNumber}
      </Typography>

      {/* Customer */}
      <Paper elevation={0} sx={{ p: 2.5, mb: 3, borderRadius: 2, border: '1px solid rgba(0,0,0,0.08)' }}>
        <SectionTitle icon={<BusinessIcon />} label="Customer" />
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">Corporate Name</Typography>
            <Typography fontWeight="bold">
              {selectedCustomer?.corporateName || '—'}
              {isTemporaryCustomer && (
                <Chip label="Quote Customer" size="small" sx={{ ml: 1, bgcolor: '#f27921', color: 'white', fontSize: '0.7rem' }} />
              )}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">Contact Person</Typography>
            <Typography fontWeight="bold">{selectedContactPerson?.name || '—'}</Typography>
            {selectedContactPerson?.position && (
              <Typography variant="body2" color="text.secondary">{selectedContactPerson.position}</Typography>
            )}
            {selectedContactPerson?.email && (
              <Typography variant="body2" color="text.secondary">{selectedContactPerson.email}</Typography>
            )}
          </Grid>
          {selectedCustomer?.email && (
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">Email</Typography>
              <Typography>{selectedCustomer.email}</Typography>
            </Grid>
          )}
          {selectedCustomer?.phone && (
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">Phone</Typography>
              <Typography>{selectedCustomer.phone}</Typography>
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* Furniture */}
      <Paper elevation={0} sx={{ p: 2.5, mb: 3, borderRadius: 2, border: '1px solid rgba(0,0,0,0.08)' }}>
        <SectionTitle icon={<ReceiptIcon />} label={`Furniture Items (${(furnitureGroups || []).length})`} />
        {!furnitureGroups?.length ? (
          <Typography color="text.secondary">No furniture items added.</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#274290' }}>
                <TableRow>
                  {['Type', 'Material', 'Labour', 'Foam', 'Painting', 'Line Total'].map((h) => (
                    <TableCell key={h} sx={{ color: 'white', fontWeight: 'bold', fontSize: '0.78rem' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {furnitureGroups.map((g, i) => {
                  const mat = (parseFloat(g.materialPrice) || 0) * (parseFloat(g.materialQnty) || 0);
                  const lab = (parseFloat(g.labourPrice) || 0) * (parseFloat(g.labourQnty) || 0);
                  const foam = g.foamEnabled ? (parseFloat(g.foamPrice) || 0) * (parseFloat(g.foamQnty) || 0) : 0;
                  const paint = g.paintingEnabled ? (parseFloat(g.paintingLabour) || 0) * (parseFloat(g.paintingQnty) || 0) : 0;
                  const lineTotal = mat + lab + foam + paint;
                  return (
                    <TableRow key={i} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                      <TableCell sx={{ fontWeight: 'bold' }}>{g.furnitureType || '—'}</TableCell>
                      <TableCell>{mat > 0 ? formatCurrency(mat) : '—'}</TableCell>
                      <TableCell>{lab > 0 ? formatCurrency(lab) : '—'}</TableCell>
                      <TableCell>{foam > 0 ? formatCurrency(foam) : '—'}</TableCell>
                      <TableCell>{paint > 0 ? formatCurrency(paint) : '—'}</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: '#b98f33' }}>{formatCurrency(lineTotal)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Totals */}
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
          <Box sx={{ display: 'flex', gap: 4 }}>
            <Typography color="text.secondary">Subtotal</Typography>
            <Typography fontWeight="bold">{formatCurrency(subtotal)}</Typography>
          </Box>
          {tax.enabled && (
            <Box sx={{ display: 'flex', gap: 4 }}>
              <Typography color="text.secondary">Tax ({tax.percentage}%)</Typography>
              <Typography fontWeight="bold">{formatCurrency(taxAmt)}</Typography>
            </Box>
          )}
          <Divider sx={{ width: 240, my: 0.5 }} />
          <Box sx={{ display: 'flex', gap: 4 }}>
            <Typography variant="h6" fontWeight="bold">Total</Typography>
            <Typography variant="h6" fontWeight="bold" sx={{ color: '#b98f33' }}>{formatCurrency(total)}</Typography>
          </Box>
        </Box>
      </Paper>

      {/* Terms */}
      <Paper elevation={0} sx={{ p: 2.5, mb: 3, borderRadius: 2, border: '1px solid rgba(0,0,0,0.08)' }}>
        <SectionTitle icon={<GavelIcon />} label={`Terms & Conditions (${selectedTerms.length} selected)`} />
        {selectedTerms.length === 0 ? (
          <Typography color="text.secondary">No terms selected.</Typography>
        ) : (
          <List disablePadding dense>
            {selectedTerms.map((t, i) => (
              <ListItem key={t.id} disablePadding sx={{ mb: 0.5 }}>
                <ListItemIcon sx={{ minWidth: 28 }}>
                  <CheckIcon sx={{ fontSize: 16, color: '#4caf50' }} />
                </ListItemIcon>
                <ListItemText primary={<Typography variant="body2">{t.text}</Typography>} />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>

      {/* Tax & Notes */}
      {notes && (
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid rgba(0,0,0,0.08)' }}>
          <SectionTitle icon={<NotesIcon />} label="Notes" />
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{notes}</Typography>
        </Paper>
      )}
    </Box>
  );
};

export default QuoteStep5Review;
