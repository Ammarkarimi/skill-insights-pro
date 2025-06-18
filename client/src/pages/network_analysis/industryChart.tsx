import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7f50', '#a9a9a9'];

// Define the type for the data prop
interface IndustryChartProps {
  data: { industry: string; value: number }[];  // Array format
}


const IndustryChart: React.FC<IndustryChartProps> = ({ data }) => {
  // Map the data into an array suitable for the PieChart component
  const chartData = Object.entries(data).map(([industry, value]) => ({ name: industry, value }));

  return (
    <div>
      <h2 className="text-xl font-semibold">Industry Breakdown</h2>
      <PieChart width={400} height={300}>
        <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={100} fill="#8884d8">
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </div>
  );
};

export default IndustryChart;
