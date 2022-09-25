import React from 'react';
import {
  EuiButtonIcon,
  EuiCollapsibleNav,
  EuiTitle,
  EuiSpacer,
  EuiText,
  EuiCode,
} from '@elastic/eui';

export class NavProps {
  navIsOpen = false
  navIsDocked = false
}

export class Nav extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      ...props
    };
  }

  render() {
    const showNavButton = <EuiButtonIcon
      iconType="menu"
      onClick={() => this.setNavIsOpen(!this.state.navIsOpen)}
      size="m" />;
    return (
      <>
        <EuiCollapsibleNav
          size={240}
          button={showNavButton}
          isOpen={this.state.navIsOpen}
          isDocked={this.state.navIsDocked}
          onClose={() => this.setNavIsOpen(false)}
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

          </div>
        </EuiCollapsibleNav>

        {this.state.navIsDocked && (
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

  setNavIsOpen(isOpen) {
    console.log("isNavOpen: " + isOpen);
    this.setState({ navIsOpen: isOpen });
  }

  setNavIsDocked(isDocked) {
    console.log("isNavDocked: " + isDocked);
    this.setState({ navIsDocked: isDocked });
  }
}
