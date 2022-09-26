import React, { useState } from 'react';
import {
  EuiPopover,
  EuiPopoverTitle,
  EuiButtonIcon,
} from '@elastic/eui';

import { EditServer } from './EditServer';

export class AddSrvProps {
  isPopoverOpen = false
  closePopover = false
}

export function AddServerPage(props) {

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const onButtonClick = () =>
    setIsPopoverOpen((isPopoverOpen) => !isPopoverOpen);
  const closePopover = () => setIsPopoverOpen(false);


  return (
    <EuiPopover button={
      <EuiButtonIcon iconType="plusInCircleFilled"
        aria-label='open add server form'
        size="m"
        onClick={onButtonClick} />}
      isOpen={isPopoverOpen}
      closePopover={closePopover} >
      <EuiPopoverTitle>添加服务器</EuiPopoverTitle>
      <EditServer updateCardList={async () => await props.updateCardList()}
        setIsPopOverOpen={(v) => setIsPopoverOpen(v)} />
    </EuiPopover>
  );
}

