

import React from 'react';
import ReactDOM from 'react-dom/client';
import '@elastic/eui/dist/eui_theme_light.css';
import createCache from '@emotion/cache';
import { SftpTransferPage } from './SftpTransferPage';
import {
    EuiProvider,
    EuiPage,
    EuiPageBody,
    EuiText,
    EuiResizableContainer,
    EuiPanel,
} from '@elastic/eui';


const cache = createCache({
    key: 'codesandbox',
    container: document.querySelector('meta[name="emotion-styles"]'),
});
cache.compat = true;

// we render Sguala compoment to <div id="root">.
const root = ReactDOM.createRoot(document.getElementById("my-sftp"));
root.render(
    <EuiProvider cache={cache}>
        <EuiPage style={{height: '100%'}}>
            <EuiPageBody paddingSize="none" panelled={false} style={{height: '100%'}}>
                <SftpTransferPage />
            </EuiPageBody>
        </EuiPage>
    </EuiProvider>
);
