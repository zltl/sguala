import React from 'react';
import ReactDOM from 'react-dom/client';
import '@elastic/eui/dist/eui_theme_light.css';
import createCache from '@emotion/cache';
import { MyTerminal } from './MyTerminal';
import './shell.css';

const cache = createCache({
    key: 'codesandbox',
    container: document.querySelector('meta[name="emotion-styles"]'),
});
cache.compat = true;

// we render Sguala compoment to <div id="root">.
const root = ReactDOM.createRoot(document.getElementById("my-shell"));
root.render(
    <MyTerminal />
);
