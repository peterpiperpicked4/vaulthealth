import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// Initialize database on app start
import { initDatabase } from './db/database';

initDatabase().then(() => {
  console.log('VaultHealth database initialized');
}).catch((err) => {
  console.error('Failed to initialize database:', err);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
