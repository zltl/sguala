import React, { useState } from 'react';
import {
  EuiButtonIcon,
  EuiCollapsibleNav,
  EuiTitle,
  EuiSpacer,
  EuiButton,
  EuiText,
  EuiCode,
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

        <div style={{ padding: 16 }}>
          <EuiTitle>
            <h2>I am some nav</h2>
          </EuiTitle>
          <EuiSpacer />
          <EuiText size="s" color="subdued">
            <p>
              The docked status is being stored in{' '}
              <EuiCode>localStorage</EuiCode>.
            </p>
          </EuiText>
          <EuiSpacer />
          <EuiButton
            onClick={() => {
              setNavIsDocked(!navIsDocked);
              localStorage.setItem(
                'euiCollapsibleNavExample--isDocked',
                JSON.stringify(!navIsDocked)
              );
            }}
          >
            Docked: {navIsDocked ? 'on' : 'off'}
          </EuiButton>
        </div>
      </EuiCollapsibleNav>

      {navIsDocked && (
        <EuiText size="s" color="subdued">
          <p>
            The <EuiCode>button</EuiCode> gets hidden by default when the nav is
            docked unless you set{' '}
            <EuiCode language="js">showButtonIfDocked = true</EuiCode>.
          </p>
        </EuiText>
      )}
    </>

  );
}

