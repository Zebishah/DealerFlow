import React, { useEffect, useState } from "react";
import {
  doc,
  updateDoc,
  arrayUnion,
  getDoc,
  collection,
  getDocs,
} from "firebase/firestore";
import { toast } from "react-toastify";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Typography,
  Box,
  Stepper,
  Step,
  StepLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Divider,
  Paper,
  CircularProgress,
  IconButton,
} from "@mui/material";

import { db } from "../../../config/firebaseConfig";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3";
import { useAuth } from "../../../AuthContext";
import { formatDate } from "../../../Utils/format";
import { IoAddCircleOutline, IoRemoveCircleOutline } from "react-icons/io5";

const steps = [
  "Customer Information",
  "Finance Details",
  "Income Details",
  "Cost Details",
  "Financial Calculations",
];
const numericFields = [
  "wbosVehicle",
  "safetyInspection",
  "carProof",
  "cleanUp",
  "parts",
  "repairs",
  "tires",
  "referral",
  "gas",
  "uber",
  "driversTow",
  "pictures",
  "invoiceCopy",
  "tints",
  "purolator",
  "afc",
  "mtoLicense",
  "downpayment",
  "acv",
  "referralCost",
  "otherCosts1Amount",
  "otherCosts2Amount",
  "otherCosts3Amount",
  "warrantyCost",
  "gapProtectionCost",
  "pac",
  "gross",
  "commissionRate",
  "afcFloorPlan",
  "totalIncome",
  "totalCOGS",
  "salesGross",
  "commission",
  "trueGross",
  "daysToDelivery",
  "daysToFunding",
  "bosVehicle",
  "adminFee",
  "gasoline",
  "licensingCharge",
  "otherIncome1Amount",
  "otherIncome2Amount",
  "lenderReserve",
  "lenderBonus",
  "warrantySold",
  "gapProtection",
  "amountFunded",
  "lienAmount",
  "interestRate",
];

const SaleDetailsModal = ({ open, onClose, onSuccess, sale }) => {
  const { currentUser } = useAuth();
  const [financeProviders, setFinanceProviders] = useState([]);
  const [activeStep, setActiveStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    customerName: sale?.customerName || "",
    dealershipPurchase: sale?.dealershipPurchase || "",
    leadSource: sale?.leadSource || "",
    stockNumber: sale?.stockNumber || "",
    vehicle: `${sale?.vehicleMake || ""}`,
    warrantySold: sale?.warr || "",
    gapProtection: sale?.gap || "",
    warrantyCost: sale?.warCost || "",
    gapProtectionCost: sale?.gapCost || "",
    pac: sale?.pac || "",
    gross: sale?.grossProfit || "",
    dateLeadReceived: null,
    saleDate: sale?.saleDate ? new Date(sale.saleDate) : null,
    intermediateDate: sale?.saleDate ? new Date(sale.saleDate) : null,
    saleTime: new Date().toLocaleTimeString("en-GB", { hour12: false }), // e.g., "20:02:12"
    intermediateTime: new Date().toLocaleTimeString("en-GB", { hour12: false }),
    fundedDate: null,
    salesRep: "",
    saleType: sale?.saleType || "individual", // Default to 'individual' if no value is provided
    financeProvider:
      sale?.saleType === "wholesale" ? "" : sale?.financeProvider || "", // show when sale tyep is not wholesale , this is to handle the previous sales
    otherIncomeItems: sale?.otherIncomeItems || [],
    otherCostItems: sale?.otherCostItems || [],
    interestRate: "",
    amountFunded: "",
    tradeDescription: "",
    lienAmount: "",
    bosVehicle: "",
    gasoline: "",
    licensingCharge: "",

    lenderReserve: sale?.reserve || "",
    lenderBonus: "",
    wbosVehicle: "",
    safetyInspection: sale?.safety || "",
    carProof: "",
    cleanUp: "",
    parts: "",
    repairs: "",
    tires: "",
    referral: "",
    gas: "",
    uber: "",
    driversTow: "",
    pictures: "",
    invoiceCopy: "",
    tints: "",
    purolator: "",
    afc: "",
    mtoLicense: "",
    downpayment: "",
    acv: "",
    referralCost: "",

    commissionRate: "",
    afcFloorPlan: "",
    totalIncome: "",
    totalCOGS: "",
    salesGross: "",
    commission: "",
    trueGross: "",
    daysToDelivery: "",
    daysToFunding: "",

    //wholesale furher information
    year: sale?.year || "",
    dealershipSold: sale?.dealershipSold || "",
    profitLoss: sale?.profitLoss || "",
    dateVehicleReceived: sale?.dateVehicleReceived
      ? new Date(sale.dateVehicleReceived)
      : null,
    dateVehicleSold: sale?.dateVehicleSold
      ? new Date(sale.dateVehicleSold)
      : null,
    vehiclePurchasePrice: sale?.vehiclePurchasePrice || "",
    vehicleSoldPrice: sale?.vehicleSoldPrice || "",
    auction: sale?.auction || "",
    vehicleModel: sale?.vehicleModel || "",
    vehicleMake: sale?.vehicleMake || "",
    VIN: sale?.VIN || "",
    stockNumber: sale?.stockNumber || "",
  });
  useEffect(() => {
    if (sale) {
      setFormData({
        customerName: sale.customerName || "",
        dealershipPurchase: sale?.dealershipPurchase || "",
        leadSource: sale.leadSource || "",
        stockNumber: sale.stockNumber || "",
        vehicle: `${sale.vehicleMake || ""} `,
        warrantySold: sale.warr || "",
        gapProtection: sale.gap || "",
        warrantyCost: sale.warCost || "",
        gapProtectionCost: sale.gapCost || "",
        pac: sale.pac || "",
        gross: sale.grossProfit || "",
        dateLeadReceived: sale.dateLeadReceived
          ? new Date(sale.dateLeadReceived)
          : null, // Handle if it's missing or null
        saleDate: sale.saleDate ? new Date(sale.saleDate) : null, // Handle valid date format
        intermediateDate: sale?.saleDate ? new Date(sale.saleDate) : null,
        saleTime: new Date().toLocaleTimeString("en-GB", { hour12: false }), // e.g., "20:02:12"
        intermediateTime: new Date().toLocaleTimeString("en-GB", {
          hour12: false,
        }),
        fundedDate: sale.fundedDate ? new Date(sale.fundedDate) : null, // Handle missing or null value
        salesRep: sale.salesRep || "", // Default to empty if missing
        saleType: sale?.saleType || "individual", // Default to 'individual' if no value is provided
        financeProvider:
          sale?.saleType === "wholesale" ? "" : sale?.financeProvider || "", // Only show if not wholesale
        interestRate: sale.interestRate || "", // Ensure it's properly handled
        amountFunded: sale.amountFunded || "",
        tradeDescription: sale.tradeDescription || "", // Ensure empty if missing
        lienAmount: sale.lienAmount || "",
        bosVehicle: sale.bosVehicle || "",
        adminFee: sale.adminFee || "",
        gasoline: sale.gasoline || "",
        licensingCharge: sale.licensingCharge || "",

        lenderReserve: sale.reserve || "",
        lenderBonus: sale.lenderBonus || "",
        wbosVehicle: sale.wbosVehicle || "",
        safetyInspection: sale.safetyInspection || "", // Default empty if missing
        carProof: sale.carProof || "",
        cleanUp: sale.cleanUp || "",
        parts: sale.parts || "",
        repairs: sale.repairs || "",
        tires: sale.tires || "",
        referral: sale.referral || "",
        gas: sale.gas || "",
        uber: sale.uber || "",
        driversTow: sale.driversTow || "",
        pictures: sale.pictures || "",
        invoiceCopy: sale.invoiceCopy || "",
        tints: sale.tints || "",
        purolator: sale.purolator || "",
        afc: sale.afc || "",
        mtoLicense: sale.mtoLicense || "",
        downpayment: sale.downpayment || "",
        acv: sale.acv || "",
        referralCost: sale.referralCost || "",

        commissionRate: sale?.saleType === "wholesale" ? "0" : "25",
        afcFloorPlan: sale.afcFloorPlan || "",
        totalIncome: sale.totalIncome || "",
        totalCOGS: sale.totalCOGS || "",
        salesGross: sale.salesGross || "",
        commission: sale.commission || "",
        trueGross: sale.trueGross || "",
        daysToDelivery: sale.daysToDelivery || "",
        daysToFunding: sale.daysToFunding || "",

        //wholesale furher information
        year: sale?.year || "",
        dealershipSold: sale?.dealershipSold || "",
        profitLoss: sale?.profitLoss || "",
        dateVehicleReceived: sale?.dateVehicleReceived
          ? new Date(sale.dateVehicleReceived)
          : null,
        dateVehicleSold: sale?.dateVehicleSold
          ? new Date(sale.dateVehicleSold)
          : null,
        vehiclePurchasePrice: sale?.vehiclePurchasePrice || "",
        vehicleSoldPrice: sale?.vehicleSoldPrice || "",
        auction: sale?.auction || "",
        vehicleModel: sale?.vehicleModel || "",
        vehicleMake: sale?.vehicleMake || "",
        VIN: sale?.VIN || "",
        stockNumber: sale?.stockNumber || "",

        otherIncomeItems: sale.otherIncomeItems || [
          ...(sale.otherIncome1Amount
            ? [
                {
                  amount: sale.otherIncome1Amount,
                  description: sale.otherIncome1Description || "",
                },
              ]
            : []),
          ...(sale.otherIncome2Amount
            ? [
                {
                  amount: sale.otherIncome2Amount,
                  description: sale.otherIncome2Description || "",
                },
              ]
            : []),
        ],

        otherCostItems: sale.otherCostItems || [
          ...(sale.otherCosts1Amount
            ? [
                {
                  amount: sale.otherCosts1Amount,
                  description: sale.otherCosts1Description || "",
                },
              ]
            : []),
          ...(sale.otherCosts2Amount
            ? [
                {
                  amount: sale.otherCosts2Amount,
                  description: sale.otherCosts2Description || "",
                },
              ]
            : []),
          ...(sale.otherCosts3Amount
            ? [
                {
                  amount: sale.otherCosts3Amount,
                  description: sale.otherCosts3Description || "",
                },
              ]
            : []),
        ],
      });
    }
  }, [sale]);

  const fetchFinanceProviders = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "financeProviders"));
      const fetchedProviders = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
      }));
      setFinanceProviders(fetchedProviders);
    } catch (error) {
      console.error("Error fetching finance providers: ", error);
      toast.error("Failed to fetch finance providers: " + error.message);
    }
  };
  useEffect(() => {
    fetchFinanceProviders();
  }, []);
  const handleChange = (e) => {
    const { name, value } = e.target;

    // Check if the field should be numeric-only
    if (numericFields.includes(name)) {
      // Allow numbers, decimal point, or empty string
      if (value === "" || /^[0-9]*\.?[0-9]*$/.test(value)) {
        setFormData((prevData) => ({
          ...prevData,
          [name]: value === "" ? "" : value, // Keep as string for input, but can convert to number when needed
        }));
      }
    } else {
      // For text fields (descriptions), allow any input
      setFormData((prevData) => ({
        ...prevData,
        [name]: value,
      }));
    }
  };

  const calculateDaysBetween = (startDate, endDate) => {
    if (!startDate || !endDate) return "";

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end - start;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays >= 0 ? diffDays.toString() : "";
  };

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const onSubmit = async () => {
    setIsSubmitting(true);

    // Format date fields before submitting
    const formattedFormData = {
      ...formData,
      saleDate: formatDate(formData.saleDate),
      intermediateDate: formatDate(formData.saleDate),
      saleTime: new Date().toLocaleTimeString("en-GB", { hour12: false }), // e.g., "20:02:12"
      intermediateTime: new Date().toLocaleTimeString("en-GB", {
        hour12: false,
      }),
      dateLeadReceived: formatDate(formData.dateLeadReceived),
      fundedDate: formatDate(formData.fundedDate),
      dateVehicleReceived: formatDate(formData.dateVehicleReceived),
      dateVehicleSold: formatDate(formData.dateVehicleSold),
    };

    try {
      if (!sale?.documentId) throw new Error("Missing document ID");

      const saleRef = doc(db, "sales", sale?.documentId);
      const saleDoc = await getDoc(saleRef);

      if (!saleDoc.exists()) {
        throw new Error("Sale document not found");
      }

      const salesData = saleDoc.data().sales; // Assuming 'sales' is the array field in your Firestore document

      // Find the sale with the matching saleId and update it
      const updatedSales = salesData.map((saleItem) => {
        if (saleItem?.saleId === sale?.saleId) {
          return {
            ...saleItem,
            ...formattedFormData, // Apply all fields from formattedFormData to the matching saleItem
            warCost: formData.warrantyCost || sale.warCost,
            warr: formData.warrantySold || sale.warr,
            gap: formData.gapProtection || sale.gap,
            gapCost: formData.gapProtectionCost || sale.gapCost,
            grossProfit: formData.gross || sale.grossProfit,
            reserve: formData.lenderReserve || sale.lenderReserve,
            safety: formData.safetyInspection || sale.safety,
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser?.userType, // Or use actual user ID
            updatedById: currentUser?.id, // Or use actual user ID
            vehicleMake: formData.vehicle || `${sale.vehicleMake || ""} `,
          };
        }
        return saleItem;
      });

      // Update the Firestore document with the modified sales array
      await updateDoc(saleRef, {
        sales: updatedSales,
      });

      toast.success("Sale details updated successfully!");
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error updating sale details:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update sale details"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add handlers for dynamic fields
  const handleAddOtherIncome = () => {
    setFormData((prev) => ({
      ...prev,
      otherIncomeItems: [
        ...prev.otherIncomeItems,
        { amount: "", description: "" },
      ],
    }));
  };

  const handleRemoveOtherIncome = (index) => {
    setFormData((prev) => ({
      ...prev,
      otherIncomeItems: prev.otherIncomeItems.filter((_, i) => i !== index),
    }));
  };

  const handleOtherIncomeChange = (index, field, value) => {
    setFormData((prev) => {
      const updatedItems = [...prev.otherIncomeItems];
      updatedItems[index] = {
        ...updatedItems[index],
        [field]: value,
      };
      return { ...prev, otherIncomeItems: updatedItems };
    });
  };

  const handleAddOtherCost = () => {
    setFormData((prev) => ({
      ...prev,
      otherCostItems: [...prev.otherCostItems, { amount: "", description: "" }],
    }));
  };

  const handleRemoveOtherCost = (index) => {
    setFormData((prev) => ({
      ...prev,
      otherCostItems: prev.otherCostItems.filter((_, i) => i !== index),
    }));
  };

  const handleOtherCostChange = (index, field, value) => {
    setFormData((prev) => {
      const updatedItems = [...prev.otherCostItems];
      updatedItems[index] = {
        ...updatedItems[index],
        [field]: value,
      };
      return { ...prev, otherCostItems: updatedItems };
    });
  };

  // Calculate fields automatically when dependencies change
  useEffect(() => {
    // Calculate totalIncome
    const bosVehicle = Number.parseFloat(formData.bosVehicle || "0");
    const adminFee = Number.parseFloat(formData.adminFee || "0");
    const gasoline = Number.parseFloat(formData.gasoline || "0");
    const licensingCharge = Number.parseFloat(formData.licensingCharge || "0");
    const warrantySold = Number.parseFloat(formData.warrantySold || "0");
    const gapProtection = Number.parseFloat(formData.gapProtection || "0");
    const otherIncome1 = Number.parseFloat(formData.otherIncome1Amount || "0");
    const otherIncome2 = Number.parseFloat(formData.otherIncome2Amount || "0");
    const lenderReserve = Number.parseFloat(formData.lenderReserve || "0");
    const lenderBonus = Number.parseFloat(formData.lenderBonus || "0");
    const otherIncomeTotal = formData.otherIncomeItems.reduce(
      (sum, item) => sum + (Number.parseFloat(item.amount) || 0),
      0
    );

    const totalIncome =
      bosVehicle +
      adminFee +
      gasoline +
      licensingCharge +
      warrantySold +
      gapProtection +
      otherIncome1 +
      otherIncome2 +
      lenderReserve +
      lenderBonus +
      otherIncomeTotal;

    // Calculate totalCOGS
    const wbosVehicle = Number.parseFloat(formData.wbosVehicle || "0");
    const safetyInspection = Number.parseFloat(
      formData.safetyInspection || "0"
    );
    const carProof = Number.parseFloat(formData.carProof || "0");
    const cleanUp = Number.parseFloat(formData.cleanUp || "0");
    const parts = Number.parseFloat(formData.parts || "0");
    const repairs = Number.parseFloat(formData.repairs || "0");
    const tires = Number.parseFloat(formData.tires || "0");
    const referral = Number.parseFloat(formData.referral || "0");
    const gas = Number.parseFloat(formData.gas || "0");
    const uber = Number.parseFloat(formData.uber || "0");
    const driversTow = Number.parseFloat(formData.driversTow || "0");
    const pictures = Number.parseFloat(formData.pictures || "0");
    const invoiceCopy = Number.parseFloat(formData.invoiceCopy || "0");
    const tints = Number.parseFloat(formData.tints || "0");
    const purolator = Number.parseFloat(formData.purolator || "0");
    const afc = Number.parseFloat(formData.afc || "0");
    const mtoLicense = Number.parseFloat(formData.mtoLicense || "0");
    const warrantyCost = Number.parseFloat(formData.warrantyCost || "0");
    const gapProtectionCost = Number.parseFloat(
      formData.gapProtectionCost || "0"
    );
    const otherCosts1 = Number.parseFloat(formData.otherCosts1Amount || "0");
    const otherCosts2 = Number.parseFloat(formData.otherCosts2Amount || "0");
    // const otherCosts3 = Number.parseFloat(formData.otherCosts3Amount || "0");

    // Calculate totalCOGS including dynamic other cost items
    const otherCostsTotal = formData.otherCostItems.reduce(
      (sum, item) => sum + (Number.parseFloat(item.amount) || 0),
      0
    );

    const totalCOGS =
      wbosVehicle +
      safetyInspection +
      carProof +
      cleanUp +
      parts +
      repairs +
      tires +
      referral +
      gas +
      uber +
      driversTow +
      pictures +
      tints +
      purolator +
      afc +
      mtoLicense +
      warrantyCost +
      gapProtectionCost +
      otherCostsTotal;

    //afc floor plan
    const afcInput = Number.parseFloat(afc) || 0; // Get value (default 0 if empty)
    const afcFloorPlan = afcInput === 0 ? 0 : Math.min(300, afcInput); // Cap at 300

    // Calculate salesGross
    const pac = Number.parseFloat(formData.pac || "0");
    // const gross = Number.parseFloat(formData?.gross || "0");
    const gross = Number.parseFloat(totalIncome - totalCOGS || "0");
    const salesGross = gross - pac;

    // Calculate commission
    // Auto-set commission rate (0% for wholesale, 25% otherwise)
    const commissionRate =
      sale?.saleType === "wholesale"
        ? 0
        : parseFloat(formData.commissionRate || "0");

    // Calculate commission using the dynamic commission rate
    const commission =
      Math.round(salesGross * (commissionRate / 100) * 100) / 100;

    // Calculate trueGross
    const trueGross = salesGross - commission;

    const dateLeadReceived = sale?.dateLeadReceived
      ? new Date(sale?.dateLeadReceived)
      : null;
    const saleDate = sale?.saleDate ? new Date(sale?.saleDate) : null;
    const fundedDate = sale?.fundedDate ? new Date(sale?.fundedDate) : null;
    // Update formData with calculated values
    setFormData((prev) => ({
      ...prev,
      totalIncome: totalIncome.toFixed(2),
      totalCOGS: totalCOGS.toFixed(2),
      gross: gross.toFixed(2),
      salesGross: salesGross.toFixed(2),
      commission: commission.toFixed(2),
      afcFloorPlan: afcFloorPlan.toString(), // Ensure it stays capped
      trueGross: trueGross.toFixed(2),
    }));
  }, [
    formData.bosVehicle,
    formData.adminFee,
    formData.gasoline,
    formData.licensingCharge,
    formData.warrantySold,
    formData.gapProtection,
    formData.otherIncome1Amount,
    formData.otherIncome2Amount,
    formData.lenderReserve,
    formData.lenderBonus,
    formData.wbosVehicle,
    formData.safetyInspection,
    formData.carProof,
    formData.cleanUp,
    formData.parts,
    formData.repairs,
    formData.tires,
    formData.referral,
    formData.gas,
    formData.uber,
    formData.driversTow,
    formData.pictures,
    formData.invoiceCopy,
    formData.tints,
    formData.purolator,
    formData.afc,
    formData.mtoLicense,
    formData.warrantyCost,
    formData.gapProtectionCost,
    formData.otherCosts1Amount,
    formData.otherCosts2Amount,
    formData.otherCosts3Amount,
    formData.pac,
    formData.commissionRate,
    formData.commission,
    formData.otherIncomeItems,
    formData.otherCostItems,
  ]);

  const handleDateChange = (name, date) => {
    setFormData((prev) => ({ ...prev, [name]: date }));
  };

  // Render different form steps based on active step
  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Grid container spacing={5}>
            {/* Section Header */}
            <Grid item xs={12}>
              <Typography
                variant="h5"
                gutterBottom
                sx={{ fontWeight: "medium" }}
              >
                {formData.saleType === "wholesale"
                  ? "Dealership Information"
                  : "Customer & Car Information "}
              </Typography>
              <Divider sx={{ mb: 1 }} />
            </Grid>

            {/* First Row */}
            <Grid item xs={12} md={6}>
              <TextField
                label={
                  formData.saleType === "wholesale"
                    ? "Dealership Name"
                    : "Customer Name"
                }
                fullWidth
                size="small"
                variant="outlined"
                name={
                  formData.saleType === "wholesale"
                    ? "dealershipPurchase"
                    : "customerName"
                }
                value={
                  formData.saleType === "wholesale"
                    ? formData.dealershipPurchase
                    : formData.customerName
                }
                onChange={handleChange}
              />
            </Grid>
            {formData.saleType !== "wholesale" && (
              <Grid item xs={12} md={6}>
                <TextField
                  label="Lead Source "
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="leadSource"
                  value={formData.leadSource}
                  onChange={handleChange}
                />
              </Grid>
            )}

            {/* Date Picker Row */}
            <Grid item xs={12} md={4}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Date Lead Received"
                  value={formData.dateLeadReceived}
                  onChange={(date) =>
                    handleDateChange("dateLeadReceived", date)
                  }
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      size: "small",
                      variant: "outlined",
                    },
                  }}
                />
              </LocalizationProvider>
            </Grid>

            <Grid item xs={12} md={4}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Sale Date"
                  value={formData.saleDate}
                  onChange={(date) => handleDateChange("saleDate", date)}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      size: "small",
                      variant: "outlined",
                    },
                  }}
                />
              </LocalizationProvider>
            </Grid>
            {/* <Grid item xs={12} md={4}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Intermediate Date"
                  value={formData.intermediateDate}
                  onChange={(date) =>
                    handleDateChange("intermediateDate", date)
                  }
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      size: "small",
                      variant: "outlined",
                    },
                  }}
                />
              </LocalizationProvider>
            </Grid> */}
            <Grid item xs={12} md={4}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Funded Date"
                  value={formData.fundedDate}
                  onChange={(date) => handleDateChange("fundedDate", date)}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      size: "small",
                      variant: "outlined",
                    },
                  }}
                />
              </LocalizationProvider>
            </Grid>

            {/* Sales Rep Field with More Space */}
            <Grid item xs={12}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Sales Representative"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="salesRep"
                  value={formData.salesRep}
                  onChange={handleChange}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Vehicle Make"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="vehicleMake"
                  value={formData.vehicleMake}
                  onChange={handleChange}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Vehicle Model"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="vehicleModel"
                  value={formData.vehicleModel}
                  onChange={handleChange}
                />
              </Box>
            </Grid>
            {formData.saleType !== "wholesale" && (
              <>
                <Grid item xs={12} md={6}>
                  <Box sx={{ mt: 1 }}>
                    <TextField
                      label="VIN"
                      fullWidth
                      size="small"
                      variant="outlined"
                      name="VIN"
                      value={formData.VIN}
                      onChange={handleChange}
                    />
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box sx={{ mt: 1 }}>
                    <TextField
                      label="Stock Number"
                      fullWidth
                      size="small"
                      variant="outlined"
                      name="stockNumber"
                      value={formData.stockNumber}
                      onChange={handleChange}
                    />
                  </Box>
                </Grid>
              </>
            )}

            {formData.saleType === "wholesale" && (
              // Wholesale specific fields
              <>
                {/* <Grid item xs={12} md={6}>
                  <TextField
                    label="Year"
                    fullWidth
                    size="small"
                    variant="outlined"
                    name="year"
                    value={formData.year}
                    onChange={handleChange}
                  />
                </Grid> */}
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Vehicle Purchase Price"
                    fullWidth
                    size="small"
                    variant="outlined"
                    name="vehiclePurchasePrice"
                    value={formData.vehiclePurchasePrice}
                    onChange={handleChange}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">$</InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Vehicle Sold Price"
                    fullWidth
                    size="small"
                    variant="outlined"
                    name="vehicleSoldPrice"
                    value={formData.vehicleSoldPrice}
                    onChange={handleChange}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">$</InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Auction"
                    fullWidth
                    size="small"
                    variant="outlined"
                    name="auction"
                    value={formData.auction}
                    onChange={handleChange}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Profit/Loss"
                    fullWidth
                    size="small"
                    variant="outlined"
                    name="profitLoss"
                    value={formData.profitLoss}
                    onChange={handleChange}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">$</InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DatePicker
                      label="Date Vehicle Received"
                      value={formData.dateVehicleReceived}
                      onChange={(date) =>
                        handleDateChange("dateVehicleReceived", date)
                      }
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          size: "small",
                          variant: "outlined",
                        },
                      }}
                    />
                  </LocalizationProvider>
                </Grid>
                <Grid item xs={12} md={4}>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DatePicker
                      label="Date Vehicle Sold"
                      value={formData.dateVehicleSold}
                      onChange={(date) =>
                        handleDateChange("dateVehicleSold", date)
                      }
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          size: "small",
                          variant: "outlined",
                        },
                      }}
                    />
                  </LocalizationProvider>
                </Grid>
              </>
            )}
          </Grid>
        );
      case 1:
        return (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Finance Details
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            {formData.saleType !== "wholesale" && (
              <Grid item xs={12} md={6}>
                <TextField
                  select
                  label="Finance Provider"
                  fullWidth
                  name="financeProvider"
                  value={formData.financeProvider}
                  onChange={handleChange}
                  variant="outlined"
                >
                  <MenuItem value="">
                    <em>Select Finance Provider</em>
                  </MenuItem>
                  {financeProviders.map((provider) => (
                    <MenuItem key={provider.id} value={provider.name}>
                      {provider.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            )}
            <Grid item xs={12} md={6}>
              <TextField
                label="Interest Rate"
                fullWidth
                name="interestRate"
                value={formData.interestRate}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Stock #"
                fullWidth
                name="stockNumber"
                value={formData.stockNumber}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} md={8}>
              <TextField
                label="Vehicle"
                fullWidth
                name="vehicle"
                value={formData.vehicle}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Amount Funded"
                fullWidth
                name="amountFunded"
                value={formData.amountFunded}
                onChange={handleChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">$</InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Lien Amount"
                fullWidth
                name="lienAmount"
                value={formData.lienAmount}
                onChange={handleChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">$</InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Trade Description"
                fullWidth
                multiline
                rows={3}
                name="tradeDescription"
                value={formData.tradeDescription}
                onChange={handleChange}
              />
            </Grid>
          </Grid>
        );

      case 2:
        return (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Income Details
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Bos Values"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="bosVehicle"
                  value={formData.bosVehicle}
                  onChange={handleChange}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Admin Values"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="adminFee"
                  value={formData.adminFee}
                  onChange={handleChange}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Gasoline"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="gasoline"
                  value={formData.gasoline}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Licensing Charge"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="licensingCharge"
                  value={formData.licensingCharge}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Warranty Sold"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="warrantySold"
                  value={formData.warrantySold}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="GAP Protection"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="gapProtection"
                  value={formData.gapProtection}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Lender Reserve"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="lenderReserve"
                  value={formData.lenderReserve}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Lender Bonus"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="lenderBonus"
                  value={formData.lenderBonus}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Grid>
            {/* <Grid item xs={12} md={6}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Other Income 1 Amount"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="otherIncome1Amount"
                  value={formData.otherIncome1Amount}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Other Income 1 Description"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="otherIncome1Description"
                  value={formData.otherIncome1Description}
                  onChange={handleChange}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Other Income 2 Amount"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="otherIncome2Amount"
                  value={formData.otherIncome2Amount}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Other Income 2 Description"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="otherIncome2Description"
                  value={formData.otherIncome2Description}
                  onChange={handleChange}
                />
              </Box>
            </Grid> */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                Other Income Items
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            {formData.otherIncomeItems.map((item, index) => (
              <React.Fragment key={index}>
                <Grid item xs={12} md={5}>
                  <TextField
                    label={`Other Income ${index + 1} Amount`}
                    fullWidth
                    size="small"
                    variant="outlined"
                    value={item.amount}
                    onChange={(e) => {
                      // Only allow numbers and decimal point
                      const value = e.target.value;
                      if (value === "" || /^[0-9]*\.?[0-9]*$/.test(value)) {
                        handleOtherIncomeChange(index, "amount", value);
                      }
                    }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">$</InputAdornment>
                      ),
                    }}
                    // Prevent paste of non-numeric values
                    onPaste={(e) => {
                      const paste = e.clipboardData.getData("text");
                      if (!/^[0-9]*\.?[0-9]*$/.test(paste)) {
                        e.preventDefault();
                      }
                    }}
                    // Prevent non-numeric key presses (except control keys)
                    onKeyDown={(e) => {
                      if (
                        !/[0-9.]/.test(e.key) &&
                        e.key !== "Backspace" &&
                        e.key !== "Delete" &&
                        e.key !== "ArrowLeft" &&
                        e.key !== "ArrowRight" &&
                        e.key !== "Tab"
                      ) {
                        e.preventDefault();
                      }
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label={`Other Income ${index + 1} Description`}
                    fullWidth
                    size="small"
                    variant="outlined"
                    value={item.description}
                    onChange={(e) =>
                      handleOtherIncomeChange(
                        index,
                        "description",
                        e.target.value
                      )
                    }
                  />
                </Grid>
                <Grid
                  item
                  xs={12}
                  md={1}
                  sx={{ display: "flex", alignItems: "center" }}
                >
                  <IconButton
                    onClick={() => handleRemoveOtherIncome(index)}
                    color="error"
                  >
                    <IoRemoveCircleOutline />
                  </IconButton>
                </Grid>
              </React.Fragment>
            ))}

            <Grid item xs={12}>
              <Button
                variant="outlined"
                startIcon={<IoAddCircleOutline />}
                onClick={handleAddOtherIncome}
              >
                Add Other Income
              </Button>
            </Grid>
          </Grid>
        );
      case 3:
        return (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Cost Details
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="WBOS-Vehicle (incl. Buyer Fee)"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="wbosVehicle"
                  value={formData.wbosVehicle}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Safety Inspection & Certificate"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="safetyInspection"
                  value={formData.safetyInspection}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Car Proof"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="carProof"
                  value={formData.carProof}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Clean Up"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="cleanUp"
                  value={formData.cleanUp}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Parts"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="parts"
                  value={formData.parts}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Repairs"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="repairs"
                  value={formData.repairs}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Tires"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="tires"
                  value={formData.tires}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Referral"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="referral"
                  value={formData.referral}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={3}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Gas"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="gas"
                  value={formData.gas}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={3}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Uber"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="uber"
                  value={formData.uber}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={3}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Drivers/Tow"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="driversTow"
                  value={formData.driversTow}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={3}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Pictures"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="pictures"
                  value={formData.pictures}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={3}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Invoice Copy"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="invoiceCopy"
                  value={formData.invoiceCopy}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={3}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Tints"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="tints"
                  value={formData.tints}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={3}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Purolator"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="purolator"
                  value={formData.purolator}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={3}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="AFC (True $ amount)"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="afc"
                  value={formData.afc}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Allow only numbers or empty string
                    if (value === "" || /^\d*\.?\d*$/.test(value)) {
                      handleChange(e);
                    }
                  }}
                  inputProps={{ max: 300 }} // HTML validation (optional)
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="MTO - License"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="mtoLicense"
                  value={formData.mtoLicense}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Warranty Cost"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="warrantyCost"
                  value={formData.warrantyCost}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="GAP Protection Cost"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="gapProtectionCost"
                  value={formData.gapProtectionCost}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Downpayment"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="downpayment"
                  value={formData.downpayment}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="ACV"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="acv"
                  value={formData.acv}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="REFERRAL"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="referralCost"
                  value={formData.referralCost}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                Other Cost Items
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            {formData.otherCostItems.map((item, index) => (
              <React.Fragment key={index}>
                <Grid item xs={12} md={5}>
                  <TextField
                    label={`Other Cost ${index + 1} Amount`}
                    fullWidth
                    size="small"
                    variant="outlined"
                    value={item.amount}
                    onChange={(e) => {
                      // Only allow numbers and decimal point
                      const value = e.target.value;
                      if (value === "" || /^[0-9]*\.?[0-9]*$/.test(value)) {
                        handleOtherCostChange(index, "amount", value);
                      }
                    }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">$</InputAdornment>
                      ),
                    }}
                    // This prevents pasting non-numeric values
                    onPaste={(e) => {
                      const paste = e.clipboardData.getData("text");
                      if (!/^[0-9]*\.?[0-9]*$/.test(paste)) {
                        e.preventDefault();
                      }
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label={`Other Cost ${index + 1} Description`}
                    fullWidth
                    size="small"
                    variant="outlined"
                    value={item.description}
                    onChange={(e) =>
                      handleOtherCostChange(
                        index,
                        "description",
                        e.target.value
                      )
                    }
                  />
                </Grid>
                <Grid
                  item
                  xs={12}
                  md={1}
                  sx={{ display: "flex", alignItems: "center" }}
                >
                  <IconButton
                    onClick={() => handleRemoveOtherCost(index)}
                    color="error"
                  >
                    <IoRemoveCircleOutline />
                  </IconButton>
                </Grid>
              </React.Fragment>
            ))}

            <Grid item xs={12}>
              <Button
                variant="outlined"
                startIcon={<IoAddCircleOutline />}
                onClick={handleAddOtherCost}
              >
                Add Other Cost
              </Button>
            </Grid>
          </Grid>
        );
      case 4:
        return (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Financial Calculations
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>
            {sale?.saleType !== "wholesale" && (
              <Grid item xs={12} md={6}>
                <Box sx={{ mt: 1 }}>
                  <TextField
                    label="Commission Rate"
                    fullWidth
                    size="small"
                    variant="outlined"
                    name="commissionRate"
                    value={formData.commissionRate}
                    onChange={handleChange}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">%</InputAdornment>
                      ),
                    }}
                  />
                </Box>
              </Grid>
            )}

            <Grid item xs={12} md={6}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="AFC Floor Plan"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="afcFloorPlan"
                  value={formData.afcFloorPlan}
                  disabled
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Total Income"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="totalIncome"
                  value={formData.totalIncome}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Total COGS"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="totalCOGS"
                  value={formData.totalCOGS}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                  disabled
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Gross (Total Income - Total COGS)"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="gross"
                  value={formData.gross}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="PAC"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="pac"
                  value={formData.pac}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Sales Gross (Gross - PAC)"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="salesGross"
                  value={formData.salesGross}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                  disabled
                />
              </Box>
            </Grid>
            {sale?.saleType !== "wholesale" && (
              <Grid item xs={12} md={6}>
                <Box sx={{ mt: 1 }}>
                  <TextField
                    label="Commission"
                    fullWidth
                    size="small"
                    variant="outlined"
                    name="commission"
                    value={formData.commission}
                    onChange={handleChange}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">$</InputAdornment>
                      ),
                    }}
                  />
                </Box>
              </Grid>
            )}
            <Grid item xs={12} md={6}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="True Gross (Sale Gross - Comission)"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="trueGross"
                  value={formData.trueGross}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                  disabled
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Days to Delivery"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="daysToDelivery"
                  value={formData.daysToDelivery}
                  onChange={handleChange}
                  type="number"
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Days to Funding"
                  fullWidth
                  size="small"
                  variant="outlined"
                  name="daysToFunding"
                  value={formData.daysToFunding}
                  onChange={handleChange}
                  type="number"
                />
              </Box>
            </Grid>
            <Grid item xs={12}>
              <Box
                sx={{
                  mt: 3,
                  p: 2,
                  bgcolor: "background.paper",
                  borderRadius: 1,
                }}
              >
                <Typography variant="h6" gutterBottom color="primary">
                  Financial Summary
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Paper elevation={2} sx={{ p: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Total Income
                      </Typography>
                      <Typography variant="h6">
                        ${formData.totalIncome || "0.00"}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Paper elevation={2} sx={{ p: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Total COGS
                      </Typography>
                      <Typography variant="h6">
                        ${formData.totalCOGS || "0.00"}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Paper elevation={2} sx={{ p: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Gross Profit
                      </Typography>
                      <Typography variant="h6">
                        ${formData.gross || "0.00"}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Paper elevation={2} sx={{ p: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Sales Gross
                      </Typography>
                      <Typography variant="h6">
                        ${formData.salesGross || "0.00"}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Paper elevation={2} sx={{ p: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Commission
                      </Typography>
                      <Typography variant="h6">
                        ${formData.commission || "0.00"}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Paper elevation={2} sx={{ p: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        True Gross
                      </Typography>
                      <Typography variant="h6">
                        ${formData.trueGross || "0.00"}
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </Box>
            </Grid>
          </Grid>
        );
      default:
        return "Unknown step";
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: "80vh" },
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            Sale Details: {sale?.customerName || sale?.dealershipPurchase} -{" "}
            {sale?.stockNumber || ""}
          </Typography>
          <Button onClick={onClose} color="inherit" size="small">
            Close
          </Button>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ width: "100%" }}>
          <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
          <Box>{getStepContent(activeStep)}</Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, justifyContent: "space-between" }}>
        <Button
          disabled={activeStep === 0}
          onClick={handleBack}
          variant="outlined"
        >
          Back
        </Button>
        <Box>
          {activeStep === steps.length - 1 ? (
            <Button
              variant="contained"
              color="primary"
              onClick={onSubmit}
              disabled={isSubmitting}
              startIcon={isSubmitting && <CircularProgress size={20} />}
            >
              Submit
            </Button>
          ) : (
            <Button variant="contained" color="primary" onClick={handleNext}>
              Next
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default SaleDetailsModal;
