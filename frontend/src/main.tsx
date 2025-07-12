import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import App from './App';
import './index.css';

// Import your Publishable Key
/* const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing Publishable Key')
} */  

createRoot(document.getElementById('root')!).render(
  <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <App />
  </Router>
);