import * as React from 'react';
import * as ReactDOM from 'react-dom/client';

import '../index.css';

import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

import './i18n';
import { SftpPage } from './SftpPage';

function render() {
  const root = ReactDOM.createRoot(document.getElementById('root'));

  root.render(<SftpPage />);
}

render();
