import { useEffect, useState } from "react";
import axios from "axios";
import IndustryChart from "./industryChart";
import RoleChart from "./roleChart";
import NetworkGraph from "./networkGraph";
import Recommendations from "./recommendations";

// Define mock data
const mockConnections = [
  { name: 'User1', connections: ['User2', 'User3'] },
  { name: 'User2', connections: ['User1', 'User4'] },
  // Add more mock connections as needed
];

const mockRecommendations = [
  { from: 'User1', to: 'User2' },
  { from: 'User2', to: 'User3' },
  // Add more mock recommendations as needed
];

const mockIndustryData = {
  Tech: 10,
  Finance: 5,
  Healthcare: 3,
};

const mockRoleData = {
  Developer: 8,
  Manager: 3,
  Designer: 2,
};

// Define types for the data
interface NetworkAnalysisData {
  industry_breakdown: Array<{ industry: string; value: number }>;
  role_breakdown: Array<{ role: string; value: number }>;
  recommendations: string[];
}

interface NetworkAnalysisPageProps {
  mockConnections: any; // Define a proper type for connections, depending on its structure
}

const NetworkAnalysisPage: React.FC<NetworkAnalysisPageProps> = () => {
  const [data, setData] = useState<NetworkAnalysisData | null>(null);

  useEffect(() => {
    // Make the API call to get network analysis data
    axios.post("/api/network/analysis", { connections: mockConnections })
      .then(res => setData(res.data));
  }, [mockConnections]); // Add mockConnections as a dependency, if it changes

  if (!data) return <p>Loading...</p>;

  return (
    <div className="p-4 grid gap-6">
      <h1 className="text-2xl font-bold">Network Analysis</h1>
      <NetworkGraph connections={mockConnections} />
      <IndustryChart data={data.industry_breakdown} />
      <RoleChart data={data.role_breakdown} />
      <Recommendations data={mockRecommendations} />
    </div>
  );
};

export default NetworkAnalysisPage;
