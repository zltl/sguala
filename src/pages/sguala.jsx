import React, { ReactElement } from 'react';
import { Nav } from './Nav'
import { ServerCardList } from './ServerCardList';
import { Abount } from './Abount';

import {
  EuiPage,
  EuiButtonIcon,
  EuiGlobalToastList,
  EuiPageBody,
  EuiToolTip,
  EuiPageSection,
} from '@elastic/eui';
import '@elastic/eui/dist/eui_theme_light.css';


import { AddServerPage } from './AddServerPage';
import { EditSmtp } from './EditSmtp';

// main content of app.
export class Sguala extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      toasts: [],
      currentPage: 'MAIN',
    }
  }

  setToast(tos) {
    this.setState((state) => {
      return {
        toasts: state.toasts.concat(tos),
      }
    })
  }
  clearToast() {
    this.setState({ toasts: [] });
  }
  removeToast(removedToast) {
    this.setState((state) => {
      return {
        toasts: state.toasts.filter((toast) => toast.id !== removedToast.id)
      };
    });
  }

  setserverCardListUpdate(fn) {
    this.setState({ updateCardListFN: fn });
  }

  render() {
    console.log("this.state.currentpage=", this.state.currentPage);
    return (< EuiPage >
      <EuiPageBody paddingSize="none" panelled={false}>
        <div>
          <Nav navIsOpen={false}
            navIsDocked={false}
            setActivePage={(p) => {
              this.setState({ currentPage: p });
            }} />

          {this.state.currentPage == 'MAIN' &&
            <>
              <AddServerPage updateCardList={async () => await this.state.updateCardListFN()} />

              <EuiToolTip
                position="export"
                content={
                  <p>
                    导出服务器列表到粘贴板
                  </p>
                }
              >

                <EuiButtonIcon iconType="exportAction"
                  aria-label='export config to clipboard'
                  size="m"
                  onClick={async () => {
                    await window.config.exportClipboard();
                    this.setToast(
                      {
                        id: new Date().valueOf(),
                        text: '已经导出到粘贴板',
                        color: 'success',
                      }
                    );
                  }} />
              </EuiToolTip>

              <EuiToolTip
                position="import"
                content={
                  <p>
                    从粘贴板导入服务器列表
                  </p>
                }
              >
                <EuiButtonIcon iconType="importAction"
                  aria-label='import config to clipboard'
                  size="m"
                  onClick={async () => {
                    const e = await window.config.importClipboard();
                    this.setToast(
                      {
                        id: new Date().valueOf(),
                        text: e ? e : '导入成功',
                        color: e ? 'danger' : 'success',
                      }
                    );
                    await this.state.updateCardListFN();
                  }} />
              </EuiToolTip>
            </>
          }
        </div>

        {this.state.currentPage == 'MAIN' && <div>
          <ServerCardList updateCardList={async () => await this.state.updateCardListFN()}
            setUpdateCB={(fn) => this.setserverCardListUpdate(fn)} />
        </div>}

        {this.state.currentPage == 'SMTP' && <div><EditSmtp /></div>}

        {this.state.currentPage == 'ABOUT' && <Abount />}

      </EuiPageBody>

      <EuiGlobalToastList
        toasts={this.state.toasts}
        dismissToast={() => {
          this.clearToast();
        }}
        toastLifeTimeMs={6000}
      />

    </EuiPage >
    );
  }
}
