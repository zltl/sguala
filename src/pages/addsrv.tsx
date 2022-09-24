import React, { useState } from 'react';
import {
  EuiTextArea,
  EuiFieldPassword,
  EuiSwitch,
  EuiPopover,
  EuiPopoverTitle,
  EuiPopoverFooter,
  EuiButton,
  EuiFlexGroup,
  EuiFlexItem,
  EuiTextColor,
  EuiButtonIcon,
  EuiCheckboxGroup,
  EuiFieldText,
  EuiForm,
  EuiFormRow,
  EuiFilePicker,
  EuiLink,
  EuiFieldNumber,
  EuiRange,
  EuiSelect,
  EuiSpacer,
  EuiCheckbox,
  EuiText,
  useGeneratedHtmlId,
} from '@elastic/eui';

import { EditServer } from './editsrv';

export class AddSrvProps {
  isPopoverOpen = false
  closePopover = false
}

export function AddServerPage() {

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const onButtonClick = () =>
    setIsPopoverOpen((isPopoverOpen) => !isPopoverOpen);
  const closePopover = () => setIsPopoverOpen(false);


  return (
    <EuiPopover button={ <EuiButtonIcon iconType="plusInCircleFilled"
                                        size="m"
                                        onClick={onButtonClick} /> }
    isOpen={isPopoverOpen}
    closePopover={closePopover} >
    <EuiPopoverTitle>添加服务器</EuiPopoverTitle>

    <EditServer />
    </EuiPopover>
  );
}

