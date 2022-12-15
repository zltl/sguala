import React, { useState } from 'react';
import {
  EuiButtonIcon,
  EuiToolTip,
  EuiModal,
  EuiModalHeader,
  EuiModalBody,
  EuiModalHeaderTitle,
} from '@elastic/eui';

import { EditServer } from './EditServer';
import { useTranslation } from 'react-i18next';

export class AddSrvProps {
  isPopoverOpen = false
  closePopover = false
}

export function AddServerPage(props) {

  const [isModalVisible, setIsModalVisible] = useState(false);

  const { t, i18n } = useTranslation();


  return (
    <>
      <EuiToolTip
        position="top"
        content={
          <p>
            {t('Add a remote server')}
          </p>
        }
      >
        <EuiButtonIcon iconType="plusInCircleFilled"
          aria-label='open add server form'
          size="m"
          onClick={() => setIsModalVisible(true)} />
      </EuiToolTip>
      {
        isModalVisible &&
        <EuiModal onClose={() => setIsModalVisible(false)}>
          <EuiModalHeader>
            <EuiModalHeaderTitle>
              <h1>{t('Add a remote server')}</h1>
            </EuiModalHeaderTitle>
          </EuiModalHeader>
          <EuiModalBody>
            <EditServer updateCardList={async () => await props.updateCardList()}
              closePopover={() => setIsModalVisible(false)} />
          </EuiModalBody>
        </EuiModal>
      }
    </>
  );
}

