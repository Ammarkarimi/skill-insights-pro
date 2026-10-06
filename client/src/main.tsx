import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { captureAttribution } from './lib/attribution'
import { initAnalytics } from './lib/analytics'

captureAttribution();
void initAnalytics();

createRoot(document.getElementById("root")!).render(<App />);
