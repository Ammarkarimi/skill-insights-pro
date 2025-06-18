import ForceGraph2D from 'react-force-graph-2d';

// Define types for the data structure
interface Connection {
  name: string;
  connections: string[];
}

interface NetworkGraphProps {
  connections: Connection[]; // An array of Connection objects
}

const NetworkGraph: React.FC<NetworkGraphProps> = ({ connections }) => {
  // Map connections into nodes and links for the graph
  const nodes = connections.map(c => ({ id: c.name }));
  const links = connections.flatMap(c =>
    c.connections.map(conn => ({ source: c.name, target: conn }))
  );

  return (
    <div>
      <h2 className="text-xl font-semibold">Network Graph</h2>
      <ForceGraph2D
        graphData={{ nodes, links }}
        width={600}
        height={400}
        nodeLabel="id"
      />
    </div>
  );
};

export default NetworkGraph;
