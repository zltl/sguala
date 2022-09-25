import React, { ReactElement } from 'react';
import '@elastic/eui/dist/eui_theme_light.css';
import { Nav } from './nav'
import { ServerCard, SrvCardProps } from './srvcard';

import {
  EuiProvider,
  EuiPage,
  EuiPageSection,
  EuiPageBody,
} from '@elastic/eui';

import { AddSrvProps, AddServerPage } from './addsrv';

// main content of app.
export class Sguala extends React.Component {

  render() {

    const card = new SrvCardProps();
    const addSrvProps = new AddSrvProps();

    return (
      <EuiProvider colorMode="light">
        <EuiPage>
          <EuiPageBody paddingSize="none" panelled={false}>
            <EuiPageSection paddingSize="none">
              <Nav navIsOpen={false} navIsDocked={false} />
              <AddServerPage />
            </EuiPageSection>
            <EuiPageSection>sections...</EuiPageSection>

            <ServerCard />
          </EuiPageBody>
        </EuiPage>
      </EuiProvider>
    );
  }
}
