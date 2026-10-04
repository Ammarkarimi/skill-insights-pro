import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

// Define the type for the data prop
interface RoleChartProps {
  data: { [role: string]: number }; // The data is an object with role names as keys and numeric values
}

const RoleChart: React.FC<RoleChartProps> = ({ data }) => {
  // Map the data into an array suitable for the BarChart component
  const chartData = Object.entries(data).map(([role, value]) => ({ role, value }));

  return (
    <div>
      <h2 className="text-xl font-semibold">Role Distribution</h2>
      <BarChart width={500} height={300} data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="role" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="value" fill="#82ca9d" />
      </BarChart>
    </div>
  );
};

export default RoleChart;
