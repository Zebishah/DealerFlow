import { doc, getDoc, updateDoc } from "firebase/firestore";
import { toast } from "react-toastify";

const updateReport = async (
  db,
  saleData,
  editableReportData,
  currentUser,
  onSuccess,
  onClose
) => {
  let isSubmitting = true;

  try {
    if (!saleData?.documentId) throw new Error("Missing document ID");
    if (!saleData?.saleId) throw new Error("Missing sale ID");

    const saleRef = doc(db, "sales", saleData.documentId);
    const saleDoc = await getDoc(saleRef);

    if (!saleDoc.exists()) {
      throw new Error("Sale document not found");
    }

    const salesData = saleDoc.data().sales;

    // Update the sale with matching saleId
    const updatedSales = salesData.map((saleItem) => {
      if (saleItem?.saleId === saleData.saleId) {
        // Initialize reportHistory and reportCount if they don't exist
        const currentReportHistory = saleItem?.reportHistory || [];
        const currentReportCount = saleItem?.reportCount || 0;

        // Create new history entry
        const newHistoryEntry = {
          generatedAt: new Date().toISOString(),
          generatedBy: currentUser?.userType || "unknown",
          generatedById: currentUser?.id || "unknown",
        };
        const reportStatus = {
          generatedAt: new Date().toISOString(),
          generatedBy: currentUser?.userType || "unknown",
          generatedById: currentUser?.id || "unknown",
          status: "pending",
          note: "",
        };

        return {
          ...saleItem,
          // Update fields with values from editableReportData
          wbosVehicle:
            editableReportData.vehicleCosts?.wbosVehicle ??
            saleItem.wbosVehicle,
          safetyInspection:
            editableReportData.vehicleCosts?.safetyInspection ??
            saleItem.safetyInspection,
          safety:
            editableReportData.vehicleCosts?.safetyInspection ??
            saleItem.safetyInspection,
          carProof:
            editableReportData.vehicleCosts?.carProof ?? saleItem.carProof,
          cleanUp: editableReportData.vehicleCosts?.cleanUp ?? saleItem.cleanUp,
          parts: editableReportData.vehicleCosts?.parts ?? saleItem.parts,
          repairs: editableReportData.vehicleCosts?.repairs ?? saleItem.repairs,
          tires: editableReportData.vehicleCosts?.tires ?? saleItem.tires,
          referral:
            editableReportData.vehicleCosts?.referral ?? saleItem.referral,
          gas: editableReportData.vehicleCosts?.gas ?? saleItem.gas,
          uber: editableReportData.vehicleCosts?.uber ?? saleItem.uber,
          driversTow:
            editableReportData.vehicleCosts?.driversTow ?? saleItem.driversTow,
          pictures:
            editableReportData.vehicleCosts?.pictures ?? saleItem.pictures,
          invoiceCopy:
            editableReportData.vehicleCosts?.invoiceCopy ??
            saleItem.invoiceCopy,
          tints: editableReportData.vehicleCosts?.tints ?? saleItem.tints,
          purolator:
            editableReportData.vehicleCosts?.purolator ?? saleItem.purolator,
          afcFloorPlan:
            editableReportData.vehicleCosts?.afcFloorPlan ??
            saleItem.afcFloorPlan,
          afc:
            editableReportData.vehicleCosts?.afcFloorPlan ??
            saleItem.afcFloorPlan,
          mtoLicense:
            editableReportData.vehicleCosts?.mtoLicense ?? saleItem.mtoLicense,
          warrantyCost:
            editableReportData.vehicleCosts?.warrantyCost ??
            saleItem.warrantyCost,
          warCost:
            editableReportData.vehicleCosts?.warrantyCost ??
            saleItem.warrantyCost,
          gapProtectionCost:
            editableReportData.vehicleCosts?.gapProtectionCost ??
            saleItem.gapProtectionCost,
          gapCost:
            editableReportData.vehicleCosts?.gapProtectionCost ??
            saleItem.gapProtectionCost,

          acv: editableReportData.vehicleCosts?.acv ?? saleItem.acv,
          otherCostItems:
            editableReportData.vehicleCosts?.otherCostItems ??
            saleItem.otherCostItems ??
            [],

          totalVehicleCosts:
            editableReportData.vehicleCosts?.totalVehicleCosts ??
            saleItem.totalVehicleCosts,
          bosVehicle:
            editableReportData.customerCosts?.bosVehicle ?? saleItem.bosVehicle,
          adminFee:
            editableReportData.customerCosts?.adminFee ?? saleItem.adminFee,
          gasoline:
            editableReportData.customerCosts?.gasoline ?? saleItem.gasoline,
          licensingCharge:
            editableReportData.customerCosts?.licensingCharge ??
            saleItem.licensingCharge,
          warrantySold:
            editableReportData.customerCosts?.warrantySold ??
            saleItem.warrantySold,
          warr:
            editableReportData.customerCosts?.warrantySold ??
            saleItem.warrantySold,
          gapProtection:
            editableReportData.customerCosts?.gapProtection ??
            saleItem.gapProtection,
          gap:
            editableReportData.customerCosts?.gapProtection ??
            saleItem.gapProtection,
          lenderReserve:
            editableReportData.customerCosts?.lenderReserve ??
            saleItem.lenderReserve,
          reserve:
            editableReportData.customerCosts?.lenderReserve ??
            saleItem.lenderReserve,
          lenderBonus:
            editableReportData.customerCosts?.lenderBonus ??
            saleItem.lenderBonus,
          otherIncomeItems:
            editableReportData.customerCosts?.otherIncomeItems ??
            saleItem.otherIncomeItems ??
            [],
          totalDealIncome:
            editableReportData.customerCosts?.total ?? saleItem.totalIncome,
          totalExpenses:
            editableReportData.dealSummary?.totalExpenses ??
            saleItem.totalExpenses,
          totalCOGS:
            editableReportData.dealSummary?.totalExpenses ??
            saleItem.totalExpenses,
          totalGross:
            editableReportData.dealSummary?.totalGross ?? saleItem.totalGross,
          gross:
            editableReportData.dealSummary?.totalGross ?? saleItem.totalGross,
          grossProfit:
            editableReportData.dealSummary?.totalGross ?? saleItem.totalGross,
          pac: editableReportData.dealSummary?.pac ?? saleItem.pac,
          salesGross:
            editableReportData.dealSummary?.salesGross ?? saleItem.salesGross,
          commissionRate:
            editableReportData.commission?.rate ?? saleItem.commissionRate,
          commission:
            editableReportData.commission?.amount ?? saleItem.commission,
          amountFunded:
            editableReportData.financing?.amountFunded ?? saleItem.amountFunded,

          ...(saleData?.saleType !== "wholesale" && {
            financeProvider:
              editableReportData.financing?.financeProvider ??
              saleItem.financeProvider,
          }),
          trade: editableReportData.financing?.trade ?? saleItem.trade,
          lienAmount: editableReportData.financing?.lien ?? saleItem.lienAmount,
          interestRate:
            editableReportData.financing?.interestRate ?? saleItem.interestRate,
          downpayment:
            editableReportData.financing?.downpayment ?? saleItem.downpayment,
          comments: editableReportData.comments ?? saleItem.comments,

          updatedAt: new Date().toISOString(),
          updatedBy: currentUser?.userType || "unknown",
          updatedById: currentUser?.id || "unknown",
          // Add report history and count
          reportHistory: [...currentReportHistory, newHistoryEntry],
          reportStatus,
          reportCount: currentReportCount + 1,
        };
      }
      return saleItem;
    });

    // Update Firestore document
    await updateDoc(saleRef, {
      sales: updatedSales,
    });

    toast.success("Sale report updated successfully!");
    onSuccess();
    onClose();
  } catch (error) {
    console.error("Error updating sale report:", error);
    toast.error(
      error instanceof Error ? error.message : "Failed to update sale report"
    );
  } finally {
    isSubmitting = false;
  }

  return { isSubmitting };
};

export default updateReport;
