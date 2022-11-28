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

export function Nav(props) {
  const [navIsOpen, setNavIsOpen] = useState(false);
  const [navIsDocked, setNavIsDocked] = useState(false);
  const [activeID, setActiveID] = useState('MAIN');


  const setActivePage = (p) => {
    if (props.setActivePage) {
      props.setActivePage(p);
    }
    setActiveID(p);
  };

  const myButton =
    <EuiButtonIcon
      aria-label='open nav menu'
      iconType="menu"
      onClick={() => setNavIsOpen(!navIsOpen)}
      size="m" />;

  return (
    <EuiCollapsibleNav
      size={240}
      button={myButton}
      isOpen={navIsOpen}
      isDocked={navIsDocked}
      onClose={() => setNavIsOpen(false)}
    >

      <EuiSpacer />
      <EuiListGroup flush={true} bordered={false}>
        <EuiListGroupItem
          onClick={() => {
            setActivePage('MAIN');
          }}
          label="主界面"
          isActive={activeID == 'MAIN'} />

        <EuiListGroupItem
          onClick={() => {
            setActivePage('SMTP')
          }}
          label="发件箱设置"
          isActive={activeID == 'SMTP'} />


        <EuiListGroupItem
          onClick={() => {
            setActivePage('ABOUT')
          }}
          label="关于小凶许"
          isActive={activeID == 'ABOUT'} />

      </EuiListGroup>

    </EuiCollapsibleNav>
  );
}

