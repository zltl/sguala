import React from 'react';
import {
  EuiCard,
  EuiIcon,
  EuiProgress,
  EuiButtonIcon,
  EuiPopoverTitle,
  EuiPopover,
  EuiToolTip,
  RIGHT_ALIGNMENT,
  EuiHealth,
} from '@elastic/eui';

import { EditServer } from './EditServer';
import { EditAlert } from './EditAlert';

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
      isAlertEditOpen: false,
      isEditOpen: false,
      updateCardList: props.updateCardList,
      isFirst: props.isFirst,
      color: props.color,
    };
  }

  stoping = false;

  fcnt = 10;

  componentDidMount() {
    console.log('did mount', this.props.login.name);
    let timeoutMs = 1 * 1000;
    window.stat.connect(this.state.login);
    const fn = async () => {
      if (this.stoping) {
        return;
      }
      const nstat = await window.stat.get(this.state.login.uuid);
      this.setState({ stat: nstat });

      if (nstat && nstat.cpuloa && this.fcnt > 0) {
        this.fcnt--;
      }
      if (this.fcnt <= 0) {
        timeoutMs = 30 * 1000;
      }

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
  setIsAlertEditOpen(v) {
    this.setState({ isAlertEditOpen: v });
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

  async moveFront() {
    console.log('move front ', this.state.login.uuid);
    await window.config.configMoveFront(this.state.login.uuid);
    this.props.updateCardList();
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
            <div>
              {this.state.color &&
                <EuiHealth color={this.state.color}>
                  {this.state.login.group}
                </EuiHealth>}
            </div>

            <EuiPopover
              panelStyle={{ minWidth: 400 }}
              button={
                <EuiToolTip
                  position="top"
                  content={
                    <p>
                      移动到前面
                    </p>
                  }
                >
                  <EuiButtonIcon
                    isDisabled={this.state.isFirst}
                    iconType="sortLeft"
                    aria-label='move card up'
                    onClick={() => { this.moveFront() }}
                  />
                </EuiToolTip>
              }
              isOpen={this.state.isEditOpen}
              closePopover={() => this.setIsEditOpen(false)}
            >
            </EuiPopover>


            <EuiPopover
              panelStyle={{ minWidth: 400 }}
              button={
                <EuiToolTip
                  position="top"
                  content={
                    <p>
                      编辑服务器登录信息
                    </p>
                  }
                >
                  <EuiButtonIcon
                    iconType="documentEdit"
                    aria-label='edit server login info'
                    onClick={() => this.setIsEditOpen(!this.state.isEditOpen)}
                  />
                </EuiToolTip>
              }
              isOpen={this.state.isEditOpen}
              closePopover={() => this.setIsEditOpen(false)}
            >
              <EuiPopoverTitle>修改服务器</EuiPopoverTitle>
              <EditServer {...this.state.login}
                closePopover={() => this.setIsEditOpen(false)}
                updateCardList={async () => await this.props.updateCardList()} />
            </EuiPopover>

            <EuiPopover
              panelStyle={{ minWidth: 400 }}
              button={
                <EuiToolTip
                  position="top"
                  content={
                    <p>
                      编辑告警
                    </p>
                  }
                >
                  <EuiButtonIcon
                    iconType="alert"
                    aria-label='edit server alert info'
                    onClick={() => this.setIsAlertEditOpen(!this.state.isAlertEditOpen)}
                  />
                </EuiToolTip>
              }
              isOpen={this.state.isAlertEditOpen}
              closePopover={() => this.setIsAlertEditOpen(false)}
            >
              <EuiPopoverTitle>编辑告警</EuiPopoverTitle>
              <EditAlert
                uuid={this.state.login.uuid}
                closePopover={() => this.setIsAlertEditOpen(false)} />
            </EuiPopover>

            <EuiToolTip
              content={
                <p>
                  远程文件传输
                </p>
              }
            >
              <EuiButtonIcon
                iconType="crossClusterReplicationApp"
                aria-label='start transfer remote'
                onClick={() => { window.fs.sftpWindow(this.state.login.uuid); }}
              />
            </EuiToolTip>

            <EuiToolTip
              content={
                <p>
                  远程登录
                </p>
              }
            >
              <EuiButtonIcon
                style={{ 'margin-right': 40 }}
                iconType="consoleApp"
                aria-label='start terminal remote'
                onClick={() => { window.rterm.shellWindow(this.state.login.uuid); }}
              />
            </EuiToolTip>


            <EuiToolTip
              position="top"
              content={
                <p>
                  删除服务器卡片
                </p>
              }
            >
              <EuiButtonIcon
                iconType="trash"
                area-label='delete server'
                onClick={async () => {
                  console.log('delete', this.state.login.uuid);
                  await window.config.del(this.state.login.uuid);
                  await this.state.updateCardList();
                }}
              />
            </EuiToolTip>

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
