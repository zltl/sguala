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

export class AddSrvProps {
  isPopoverOpen = false
  closePopover = false
}

export function AddServerPage(props) {

  const [isModalVisible, setIsModalVisible] = useState(false);

  return (
    <>
      <EuiToolTip
        position="top"
        content={
          <p>
            添加需要监控的服务器
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
              <h1>添加服务器</h1>
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

