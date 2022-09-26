import React, { ReactElement } from 'react';
import { Nav } from './Nav'
import { ServerCardList } from './ServerCardList';

import {
  EuiProvider,
  EuiPage,
  EuiPageSection,
  EuiPageBody,
} from '@elastic/eui';
import '@elastic/eui/dist/eui_theme_light.css';


import { AddServerPage } from './AddServerPage';

// main content of app.
export class Sguala extends React.Component {

  setserverCardListUpdate(fn) {
    this.setState({ updateCardListFN: fn })
  }

  render() {
    return (
      <EuiPage>
        <EuiPageBody paddingSize="none" panelled={false}>
          <div>
            <Nav navIsOpen={false} navIsDocked={false} />
            <AddServerPage updateCardList={async () => await this.state.updateCardListFN()} />
          </div>
          <div>
            <ServerCardList updateCardList={async () => await this.state.updateCardListFN()}
              setUpdateCB={(fn) => this.setserverCardListUpdate(fn)} />
          </div>
        </EuiPageBody>
      </EuiPage>
    );
  }
}
