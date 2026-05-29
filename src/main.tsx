import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { safelyFormatDate } from './lib/dateUtils';

// Global fallback for safelyFormatDate to resolve reported ReferenceErrors
(window as any).safelyFormatDate = safelyFormatDate;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
