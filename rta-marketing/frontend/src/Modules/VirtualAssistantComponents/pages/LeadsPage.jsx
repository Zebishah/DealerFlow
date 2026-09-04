import { useState } from "react";
import HeaderComponent from "../components/HeaderComponent";
import LeadsPageVA from "../components/LeadsTableAll.jsx";
import UpperCards from "../components/UpperCards";
import UploadLeadModal from "../components/UploadLeadModal";

const LeadsPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [leadSources, setLeadSources] = useState([]);
  const [SalesPerson, setSalesPerson] = useState([""]);
  const [totalLeads, setTotalLeads] = useState(0);
  return (
    <div className="flex flex-col gap-y-8 w-screen h-full">
      <HeaderComponent
        title="Leads"
        buttonText="Upload New Lead"
        showButton={true}
        onButtonClick={() => setIsModalOpen(true)}
        className=""
      />
      <UpperCards
        leadSources={leadSources}
        SalesPerson={SalesPerson}
        totalLeads={totalLeads}
      />
      <LeadsPageVA
        leadSources={leadSources}
        setLeadSources={setLeadSources}
        SalesPerson={SalesPerson}
        setSalesPerson={setSalesPerson}
        setTotalLeads={setTotalLeads}
      />
      <UploadLeadModal
        isOpen={isModalOpen}
        leadSources={leadSources}
        SalesPerson={SalesPerson}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};

export default LeadsPage;
