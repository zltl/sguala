import React from 'react';
import ReactDOM from 'react-dom/client';
import { Sguala } from './Sguala';
import '@elastic/eui/dist/eui_theme_light.css';
import createCache from '@emotion/cache';
import { EuiProvider } from '@elastic/eui';

import './i18n';

const cache = createCache({
    key: 'codesandbox',
    container: document.querySelector('meta[name="emotion-styles"]'),
});
cache.compat = true;

// we render Sguala compoment to <div id="root">.
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
    <EuiProvider cache={cache}>
        <Sguala />
    </EuiProvider>
);
