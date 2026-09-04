import React from "react";
import { Box, Grid, Paper, Typography } from "@mui/material";
import { InfoCard, PersonCard } from "./TVScreen";

const Dashboard = ({ totalSales, leads, sortedSalesPerson }) => {
  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <InfoCard title="Total Leads" value="78" src="icon-1.png" />
        </Grid>
        <Grid item xs={12} md={3}>
          <InfoCard title="Total Sales" value={totalSales} src="icon-2.png" />
        </Grid>
        <Grid item xs={12} md={3}>
          <InfoCard title="Conversion Rate" value="21%" src="icon-4.png" />
        </Grid>
        <Grid item xs={12} md={3}>
          <InfoCard
            title="Lead Sources"
            value={leads.length}
            src="icon-3.png"
            delegate={leads}
          />
        </Grid>
        <Grid item xs={12}>
          <Paper elevation={3} sx={{ p: 2, mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Client Overview
            </Typography>
            <Grid container spacing={2}>
              {sortedSalesPerson && sortedSalesPerson.length > 0 ? (
                sortedSalesPerson.map((person) => (
                  <Grid item xs={12} key={person.uid}>
                    <PersonCard
                      name={person.name}
                      uid={person.uid}
                      sales={person.sales}
                    />
                  </Grid>
                ))
              ) : (
                <Grid item xs={12}>
                  <Box
                    display="flex"
                    justifyContent="center"
                    alignItems="center"
                    height="100px"
                  >
                    <Typography>No clients to display</Typography>
                  </Box>
                </Grid>
              )}
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
