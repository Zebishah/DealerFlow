import { useLocation, useParams } from "react-router";
import HeaderComponent from "../../VirtualAssistantComponents/components/HeaderComponent";
import SalesOfSPTable from "../components/SalesOfSpTable";
import { useState } from "react";

const SalesOfSalesPerson = () => {
  const { id } = useParams();
  const decodedId = decodeURIComponent(id);
  const location = useLocation();
  const name = location.state?.name || "N/A";
  const totalLeads = location.state?.totalLeads || "0";
  const totalSales = location.state?.totalSales || "0";
  const [leadSources, setLeadSources] = useState([]);
  const [SalesPerson, setSalesPerson] = useState([""]);
  return (
    <div className="flex flex-col w-full min-h-[90vh]">
      <HeaderComponent
        title={name}
        buttonText="Upload New Lead"
        showButton={false}
        onButtonClick={() => {}}
        className=""
        name={name}
        totalLeads={totalLeads}
        totalSales={totalSales}
        showStats={true}
      />
      <SalesOfSPTable
        leadSources={leadSources}
        setLeadSources={setLeadSources}
        SalesPerson={SalesPerson}
        setSalesPerson={setSalesPerson}
        id={decodedId}
      />
    </div>
  );
};

export default SalesOfSalesPerson;
