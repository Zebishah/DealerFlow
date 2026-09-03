import { useEffect, useState, useRef } from "react";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  addDoc,
} from "firebase/firestore";
import emailjs from "emailjs-com";
import { db } from "../../../config/firebaseConfig";

// Function to check if leads exceed threshold specifically for the current month
const checkLeadsExceedThreshold = (leads, threshold = 10) => {
  if (!leads || !leads.length) return false;

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // Count only leads from the current calendar month
  const currentMonthLeads = leads.filter((lead) => {
    const leadDate = lead.timestamp?.toDate
      ? lead.timestamp.toDate()
      : new Date(lead.timestamp);
    return (
      leadDate.getMonth() === currentMonth &&
      leadDate.getFullYear() === currentYear
    );
  });

  return currentMonthLeads.length >= threshold;
};

// Function to send email notification
const sendLeadNotification = async (employee, manager, threshold) => {
  try {
    // Configure EmailJS with your service ID, template ID, and user ID
    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
    const userId = import.meta.env.VITE_EMAILJS_USER_ID;

    const currentMonth = new Date().toLocaleString("default", {
      month: "long",
    });
    const currentYear = new Date().getFullYear();

    // First email - to the salesperson
    await emailjs.send(
      serviceId,
      templateId,
      {
        to_email: employee.email,
        to_name: employee.name,
        subject: `Lead Target Achievement - ${currentMonth} ${currentYear}`,
        message: `Congratulations! You have achieved ${threshold}+ leads for ${currentMonth} ${currentYear}.`,
        company_name: "Your Company",
        month_name: currentMonth,
        from_name: "RTA Marketing Manager",
        year: currentYear,
      },
      userId
    );

    // Second email - to the manager
    await emailjs.send(
      serviceId,
      templateId,
      {
        to_email: manager.email,
        to_name: manager.name,
        subject: `Sales Lead Threshold Notification - ${currentMonth} ${currentYear}`,
        message: `${employee.name} has exceeded ${threshold} leads for ${currentMonth} ${currentYear}.`,
        company_name: "Your Company",
        from_name: "RTA Marketing Admins",
        month_name: currentMonth,
        year: currentYear,
      },
      userId
    );

    return true;
  } catch (error) {
    console.error("Error sending email notification:", error);
    return false;
  }
};

// Custom hook to continuously monitor lead counts by month
export const useLeadMonitoring = (
  db,
  threshold = 10,
  checkIntervalMinutes = 60
) => {
  const [monitoringStatus, setMonitoringStatus] = useState({
    running: false,
    lastCheck: null,
    error: null,
  });

  // Use refs to prevent multiple simultaneous checks and track initialization
  const isCheckingRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const intervalRef = useRef(null);

  // Create the monitoring function
  const monitorLeads = async (isManualTrigger = false) => {
    // Prevent multiple simultaneous checks
    if (isCheckingRef.current) {
      return { success: false, message: "Check already in progress" };
    }

    try {
      isCheckingRef.current = true;

      // Set status to running
      setMonitoringStatus((prev) => ({
        ...prev,
        running: true,
      }));

      // Get current month and year for tracking notifications
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();
      const monthYearKey = `${currentYear}-${currentMonth + 1}`;

      // Get the collection of monthly notification documents
      const notificationsCollectionRef = collection(
        db,
        "notificationHistory",
        "leadThresholds",
        "monthlyRecords"
      );

      // Try to get the document for the current month
      const currentMonthDocRef = doc(notificationsCollectionRef, monthYearKey);
      const currentMonthDocSnap = await getDoc(currentMonthDocRef);

      // Get already notified users for this month
      const sentNotifications = currentMonthDocSnap.exists()
        ? currentMonthDocSnap.data().notifiedUserIds || []
        : [];

      // Fetch manager info
      const managerEmail = "zebihaider123@gmail.com";
      const managerName = "Rta Marketing";

      // Fetch all employees
      const employeesRef = collection(db, "employees");
      const employeesSnapshot = await getDocs(employeesRef);

      const employeesToNotify = [];

      // Check each employee's leads for the current month only
      employeesSnapshot.docs.forEach((doc) => {
        const employee = { id: doc.id, ...doc.data() };

        // Skip if not a salesperson or already notified this month
        if (
          employee.userType !== "Employee" ||
          sentNotifications.includes(employee.uid)
        ) {
          return;
        }

        // Check if current month's leads exceed threshold
        if (checkLeadsExceedThreshold(employee.leads, threshold)) {
          employeesToNotify.push(employee);
        }
      });

      // Only proceed with notifications if there are employees to notify
      if (employeesToNotify.length === 0) {
        setMonitoringStatus({
          running: false,
          lastCheck: new Date(),
          error: null,
        });

        return {
          success: true,
          employeesNotified: 0,
          message: "No new notifications needed",
        };
      }

      // Send notifications for employees who exceeded threshold
      const updatedSentNotifications = [...sentNotifications];
      let successfulNotifications = 0;

      for (const employee of employeesToNotify) {
        try {
          // Send emails to employee and manager
          const success = await sendLeadNotification(
            employee,
            { email: managerEmail, name: managerName },
            threshold
          );

          if (success) {
            updatedSentNotifications.push(employee.uid);
            successfulNotifications++;
          } else {
            console.error(`Failed to send notification for ${employee.name}`);
          }
        } catch (error) {
          console.error(
            `Error sending notification for ${employee.name}:`,
            error
          );
        }
      }

      // Update notification history in Firestore only if we sent notifications
      if (successfulNotifications > 0) {
        try {
          if (!currentMonthDocSnap.exists()) {
            await setDoc(currentMonthDocRef, {
              notifiedUserIds: updatedSentNotifications,
              month: currentMonth + 1,
              year: currentYear,
              createdAt: new Date(),
              lastUpdated: new Date(),
            });
          } else {
            await setDoc(
              currentMonthDocRef,
              {
                notifiedUserIds: updatedSentNotifications,
                lastUpdated: new Date(),
              },
              { merge: true }
            );
          }
          console.log(
            `Updated notification history for ${successfulNotifications} employees`
          );
        } catch (error) {
          console.error("Error updating notification history:", error);
        }
      }

      // Update status with successful completion
      setMonitoringStatus({
        running: false,
        lastCheck: new Date(),
        error: null,
      });

      return {
        success: true,
        employeesNotified: successfulNotifications,
        message: `Successfully notified ${successfulNotifications} employees`,
      };
    } catch (error) {
      console.error("Error monitoring leads:", error);
      setMonitoringStatus({
        running: false,
        lastCheck: new Date(),
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    } finally {
      isCheckingRef.current = false;
    }
  };

  useEffect(() => {
    // Only initialize once
    if (hasInitializedRef.current) {
      return;
    }

    hasInitializedRef.current = true;

    // Don't run immediately on mount to prevent unwanted emails
    // Only set up the interval
    intervalRef.current = setInterval(() => {
      monitorLeads(false);
    }, checkIntervalMinutes * 60 * 1000);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      hasInitializedRef.current = false;
    };
  }, [db, threshold, checkIntervalMinutes]);

  // Manual trigger function that can be called explicitly
  const triggerManualCheck = () => {
    return monitorLeads(true);
  };

  // Return both the status AND the function to trigger manually
  return {
    status: monitoringStatus,
    triggerCheck: triggerManualCheck,
    isChecking: isCheckingRef.current,
  };
};

// Component to handle continuous monitoring
export const LeadMonitor = ({ threshold = 10, checkIntervalMinutes = 60 }) => {
  const { status, triggerCheck } = useLeadMonitoring(
    db,
    threshold,
    checkIntervalMinutes
  );

  // Optional: Add a manual trigger button for testing (remove in production)
  const handleManualCheck = async () => {
    console.log("Manual check triggered");
    const result = await triggerCheck();
    console.log("Manual check result:", result);
  };

  // For development/testing purposes, you can uncomment this to add a manual trigger button
  /*
  return (
    <div style={{ position: 'fixed', top: '10px', right: '10px', zIndex: 1000 }}>
      <button onClick={handleManualCheck} disabled={status.running}>
        {status.running ? 'Checking...' : 'Manual Check'}
      </button>
      {status.lastCheck && (
        <div style={{ fontSize: '12px', marginTop: '5px' }}>
          Last check: {status.lastCheck.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
  */

  // This is a "silent" component that doesn't render anything visible
  // It just sets up the monitoring system
  return null;
};
