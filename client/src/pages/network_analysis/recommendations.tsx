interface Recommendation {
  from: string;
  to: string;
}
const mockRecommendations: Recommendation[] = [
  { from: 'User1', to: 'User2' },
  { from: 'User2', to: 'User3' },
];
interface RecommendationsProps {
  data: Recommendation[]; // An array of Recommendation objects
}

const Recommendations: React.FC<RecommendationsProps> = ({ data }) => {
  return (
    <div>
      <h2 className="text-xl font-semibold">Connection Recommendations</h2>
      <ul className="list-disc pl-6">
        {data.map((rec, i) => (
          <li key={i}>{rec.from} → {rec.to}</li>
        ))}
      </ul>
    </div>
  );
};

export default Recommendations;
