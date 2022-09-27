import React from 'react';
import {
  EuiCard,
  EuiIcon,
  EuiProgress,
  EuiButtonIcon,
  EuiPopoverTitle,
  EuiPopover,
  EuiFlexGroup,
  EuiFlexItem,
} from '@elastic/eui';

import { EditServer } from './EditServer';

export class SrvCardProps {
  title = "服务器名称"
}

export class ServerCard extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      stat: {
        cpuloa: undefined,
        memavail: undefined,
        memtotal: undefined,
        memUsePercent: undefined,
        online: 'INIT',
        disks: [],
      },
      login: props.login,
      isEditOpen: false,
    };
  }

  stoping = false;

  componentDidMount() {
    console.log('did mount', this.props.login.name);
    const timeoutMs = 1 * 1000;
    window.stat.connect(this.state.login);
    const fn = async () => {
      if (this.stoping) {
        return;
      }
      const nstat = await window.stat.get(this.state.login.uuid);
      this.setState({ stat: nstat });
      setTimeout(fn, timeoutMs);
    };
    setTimeout(fn, timeoutMs);
  }
  componentWillUnmount() {
    console.log('did unmount', this.props.login.name);
    window.stat.close(this.state.login.uuid);
    this.stoping = true;
  }

  setIsEditOpen(v) {
    this.setState({ isEditOpen: v });
  }

  selectColor(v) {
    if (v < 80) {
      return 'success';
    }
    if (v < 90) {
      return 'warning';
    }
    return 'danger';
  }

  render() {
    const diskX = this.state.stat.disks.map((it) => {
      return (
        <EuiProgress
          key={it.name}
          valueText={true}
          max={100}
          color={this.selectColor(it.usePercent * 100)}
          label={"磁盘占用率 (" + it.name + ')'}
          value={(it.usePercent * 100).toFixed(2)}
        />);
    });
    return (
      <EuiCard
        textAlign="left"
        title={
          <>
            {this.state.stat.online == 'ONLINE' ? <EuiIcon size="s" type="online" /> : <EuiIcon size="s" type="offline" />}
            {' '}
            {this.state.login.name}
          </>
        }
        description={
          <>
            <EuiPopover
              style={{ marginRight: 30 }}
              button={
                <EuiButtonIcon
                  iconType="documentEdit"
                  aria-label='edit server login info'
                  onClick={() => this.setIsEditOpen(!this.state.isEditOpen)}
                />
              }
              isOpen={this.state.isEditOpen}
              closePopover={() => this.setIsEditOpen(false)}
            >
              <EuiPopoverTitle>修改服务器</EuiPopoverTitle>
              <EditServer {...this.state.login}
                closePopover={() => this.setIsEditOpen(false)}
                updateCardList={async () => await this.props.updateCardList()} />
            </EuiPopover>
            <EuiButtonIcon
              iconType="trash"
              area-label='delete server'
              onClick={async () => {
                console.log('delete', this.state.login.uuid);
                await window.config.del(this.state.login.uuid);
                await this.props.updateCardList();
              }}
            />
          </>
        }
      >


        <EuiProgress
          valueText={true}
          max={100}
          color={this.selectColor(this.state.stat.cpuload * 100)}
          label="CPU 占用率"
          value={(this.state.stat.cpuload * 100).toFixed(2)}
        />
        <EuiProgress
          valueText={true}
          max={100}
          color={this.selectColor(this.state.stat.memUsePercent * 100)}
          label="内存占用率"
          value={(this.state.stat.memUsePercent * 100).toFixed(2)}
        />
        {diskX}
      </EuiCard>
    );
  }
}
