import React, { ReactElement, useState } from 'react';
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
import { useTranslation } from 'react-i18next';


import { AddServerPage } from './AddServerPage';
import { EditSmtp } from './EditSmtp';

// main content of app.
export function Sguala(props) {
  const [toasts, setToasts] = useState([]);
  const [currentPage, setCurrentPage] = useState('MAIN');

  let updateCardListFN = undefined;
  const { t, i18n } = useTranslation();

  const setToast = (tos) => {
    setToasts((toss) => toss.concat(tos));
  }

  const clearToast = () => {
    setToasts([]);
  }
  const removeToast = (removedToast) => {
    setToasts((toss) => toss.filter((toast) => toast.id !== removedToast.id));
  }

  const setserverCardListUpdate = (fn) => {
    updateCardListFN = fn;
  }

  return (< EuiPage >
    <EuiPageBody paddingSize="none" panelled={false}>
      <div>
        <Nav navIsOpen={false}
          navIsDocked={false}
          setActivePage={(p) => { setCurrentPage(p) }} />

        {currentPage == 'MAIN' &&
          <>
            <AddServerPage updateCardList={async () => await updateCardListFN()} />

            <EuiToolTip
              position="export"
              content={
                <p>
                  {t('Export config')}
                </p>
              }
            >
              <EuiButtonIcon iconType="exportAction"
                aria-label='export config to clipboard'
                size="m"
                onClick={async () => {
                  await window.config.exportFile();
                  setToast(
                    {
                      id: new Date().valueOf(),
                      text: t('Export config'),
                      color: 'success',
                    }
                  );
                }} />
            </EuiToolTip>

            <EuiToolTip
              position="import"
              content={
                <p>
                  {t('Load config')}
                </p>
              }
            >
              <EuiButtonIcon iconType="importAction"
                aria-label='import config '
                size="m"
                onClick={async () => {
                  await window.config.importFile();
                  setToast(
                    {
                      id: new Date().valueOf(),
                      text: t('Load config'),
                      color: 'success',
                    }
                  );
                  await updateCardListFN();
                }} />
            </EuiToolTip>
          </>
        }
      </div>

      {currentPage == 'MAIN' && <div>
        <ServerCardList updateCardList={async () => await updateCardListFN()}
          setUpdateCB={(fn) => setserverCardListUpdate(fn)} />
      </div>}

      {currentPage == 'SMTP' && <div><EditSmtp /></div>}

      {currentPage == 'ABOUT' && <Abount />}

    </EuiPageBody>

    <EuiGlobalToastList
      toasts={toasts}
      dismissToast={() => {
        clearToast();
      }}
      toastLifeTimeMs={6000}
    />

  </EuiPage >
  );
}
