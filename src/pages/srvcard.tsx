import React, {useState} from 'react';
import {
  EuiCard,
  EuiFlexGroup,
  EuiFlexItem,
  EuiCodeBlock,
  EuiRadioGroup,
  EuiText,
  EuiButton,
  EuiIcon,
  EuiCode,
  EuiProgress,
  EuiSpacer,
  EuiButtonIcon,
  EuiPopoverTitle,
  EuiPopover,
} from '@elastic/eui';

import { EditServer } from './editsrv';

export class SrvCardProps {
  title = "服务器名称"
}

export function ServerCard() {
  const [isEditOpen, setIsEditOpen] = useState(false);

  return (
    <EuiCard
    textAlign="left"
    title={
      <>
      服务器地址
      {' '}
      <EuiIcon size="s" type="online" />
      {' '}

      <EuiPopover
      button={
        <EuiButtonIcon
          iconType="documentEdit"
          onClick={ ()=>setIsEditOpen((isEditOpen:boolean)=>!isEditOpen) }
        />
      }
      isOpen={isEditOpen}
      closePopover={()=>setIsEditOpen(false)}
      >
      <EuiPopoverTitle>修改服务器</EuiPopoverTitle>
      <EditServer />
      </EuiPopover>
          </>
    }
    >
    <EuiProgress
      valueText={true}
      max={100}
      color="success"
      label="CPU 占用率"
      value={80}
    />
    <EuiProgress
      valueText={true}
      max={100}
      color="success"
      label="内存占用率"
      value={80}
    />
    <EuiProgress
      valueText={true}
      max={100}
      color="success"
      label="磁盘占用率"
      value={80}
    />
      </EuiCard>
  );
}

