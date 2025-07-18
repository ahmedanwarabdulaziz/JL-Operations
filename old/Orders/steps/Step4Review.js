import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent
} from '@mui/material';

const Step4Review = ({ personalInfo, orderDetails, furnitureData }) => {
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Review Order
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Please review all the information before submitting the order.
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Customer Information
              </Typography>
              <Typography><strong>Name:</strong> {personalInfo.name}</Typography>
              <Typography><strong>Email:</strong> {personalInfo.email}</Typography>
              <Typography><strong>Phone:</strong> {personalInfo.phone || 'Not provided'}</Typography>
              <Typography><strong>Address:</strong> {personalInfo.address || 'Not provided'}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Order Details
              </Typography>
              <Typography><strong>Description:</strong> {orderDetails.description || 'Not provided'}</Typography>
              <Typography><strong>Bill Invoice:</strong> {orderDetails.billInvoice}</Typography>
              <Typography><strong>Platform:</strong> {orderDetails.platform || 'Not provided'}</Typography>
              <Typography><strong>Start Date:</strong> {orderDetails.startDate}</Typography>
              <Typography><strong>Timeline:</strong> {orderDetails.timeline || 'Not provided'}</Typography>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Furniture Details */}
        {furnitureData?.groups?.length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Furniture Details
                </Typography>
                {furnitureData.groups.map((group, index) => (
                  <Box key={group.id} sx={{ mb: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                      Furniture Group {index + 1}
                    </Typography>
                    <Typography><strong>Type:</strong> {group.furnitureType || 'Not specified'}</Typography>
                    <Typography><strong>Material Company:</strong> {group.materialCompany || 'Not specified'}</Typography>
                    <Typography><strong>Material Code:</strong> {group.materialCode || 'Not specified'}</Typography>
                    <Typography><strong>Material Qty:</strong> {group.materialQnty}</Typography>
                    <Typography><strong>Material Price:</strong> ${group.materialPrice || 0}</Typography>
                    <Typography><strong>Labour Price:</strong> ${group.labourPrice || 0}</Typography>
                    <Typography><strong>Labour Note:</strong> {group.labourNote || 'Not specified'}</Typography>
                    <Typography><strong>Labour Qty:</strong> {group.labourQnty}</Typography>
                    {group.foamEnabled && (
                      <>
                        <Typography><strong>Foam Price:</strong> ${group.foamPrice || 0}</Typography>
                        <Typography><strong>Foam Thickness:</strong> {group.foamThickness || 'Not specified'}</Typography>
                        <Typography><strong>Foam Note:</strong> {group.foamNote || 'Not specified'}</Typography>
                        <Typography><strong>Foam Qty:</strong> {group.foamQnty}</Typography>
                      </>
                    )}
                    {group.customerNote && (
                      <>
                        <Typography><strong>Customer Note:</strong> {group.customerNote}</Typography>
                      </>
                    )}
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default Step4Review; 