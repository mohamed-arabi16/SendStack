import React from 'react';
import { createRoot } from 'react-dom/client';
import Popup from './Popup';

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<Popup />);
}
