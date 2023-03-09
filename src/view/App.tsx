import * as React from 'react';
import * as ReactDOM from 'react-dom/client';

import '../index.css';

import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import { ShellPage } from './ShellPage';

import './i18n';

function render() {
  const root = ReactDOM.createRoot(document.getElementById('root'));

  console.log(`This app is using Chrome (v${versions.chrome()}), Node.js (v${versions.node()}), and Electron (v${versions.electron()})`)

  root.render(<>
    <ShellPage />
  </>);
}

render();
