import { useEffect, useState } from "react";
import { collection, getDocs, onSnapshot } from "firebase/firestore";

import HeaderComponent from "../../VirtualAssistantComponents/components/HeaderComponent";
import UpperCards from "../../VirtualAssistantComponents/components/UpperCards";
import { db } from "../../../config/firebaseConfig";
import SalesTableVA from "../../../shared/VirtualAssistantComponents/TableComponent";

const PublicAPILeads = () => {
  const [apiLeads, setApiLeads] = useState([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "apiLeads"),
      (querySnapshot) => {
        const leads = querySnapshot.docs.map((doc) => {
          const data = doc.data();

          const formatDate = (date) => {
            const d = new Date(date);
            return d.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            });
          };

          return {
            id: doc.id,
            dateTime: data.createdAt
              ? formatDate(data.createdAt.toDate())
              : "N/A",
            receivedDate: data.receivedDate
              ? formatDate(data.receivedDate)
              : "N/A",
            leadSource: data.leadSource || "N/A",
            amount: data.leadAmount || 0,
          };
        });

        setApiLeads(leads);
      },
      (error) => {
        console.error("Error with onSnapshot:", error);
      }
    );

    // Clean up the listener on unmount
    return () => unsubscribe();
  }, []);

  const leadsHeader = [
    {
      key: "dateTime",
      label: "Created Date",
      render: (value, row) => <div>{value}</div>,
    },
    { key: "receivedDate", label: "Received Date" },
    {
      key: "leadSource",
      label: "Lead Source",
      render: (value, row) => (
        <div className="max-w-xs truncate" title={value}>
          {value ? value : "N/A"}
        </div>
      ),
    },
    {
      key: "amount",
      label: "Lead Amount",
      render: (value) =>
        `$${Number(value).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
    },
  ];

  return (
    <div className="flex flex-col gap-y-8 w-full h-full">
      <HeaderComponent title="API Leads" showButton={false} />
      <UpperCards
        leadSources={null}
        SalesPerson={null}
        totalLeads={apiLeads.length}
      />
      <div className="px-4 flex items-start justify-start w-full h-full pb-8 overflow-y-auto  ">
        <div className="flex flex-col w-full h-full gap-y-8 overflow-y-auto">
          <SalesTableVA columns={leadsHeader} data={apiLeads} />
        </div>
      </div>
    </div>
  );
};

export default PublicAPILeads;
