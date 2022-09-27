import React, { useState } from 'react';
import {
  EuiButtonIcon,
  EuiCollapsibleNav,
  EuiTitle,
  EuiSpacer,
  EuiButton,
  EuiText,
  EuiCode,
  EuiListGroup,
  EuiListGroupItem,
} from '@elastic/eui';

export function Nav() {
  const [navIsOpen, setNavIsOpen] = useState(false);
  const [navIsDocked, setNavIsDocked] = useState(false);


  const myButton =
    <EuiButtonIcon
      aria-label='open nav menu'
      iconType="menu"
      onClick={() => setNavIsOpen(!navIsOpen)}
      size="m" />;

  return (
    <>
      <EuiCollapsibleNav
        size={240}
        button={myButton}
        isOpen={navIsOpen}
        isDocked={navIsDocked}
        onClose={() => setNavIsOpen(false)}
      >

        <EuiSpacer />
        <EuiListGroup flush={true} bordered={false}>
          <EuiListGroupItem onClick={() => { console.log('TODO') }} label="First item" />

          <EuiListGroupItem onClick={() => { console.log('TODO') }} label="Second item" />

          <EuiListGroupItem onClick={() => { console.log('TODO') }} label="Third item" isActive />

          <EuiListGroupItem onClick={() => { console.log('TODO') }} label="Fourth item" />
        </EuiListGroup>

      </EuiCollapsibleNav>
    </>

  );
}

