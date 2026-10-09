import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './style.css'; // Make sure tailwind styles are imported

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
