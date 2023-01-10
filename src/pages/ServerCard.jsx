import React, { useState, useEffect } from 'react';
import {
  EuiCard,
  EuiIcon,
  EuiProgress,
  EuiButtonIcon,
  EuiPopoverTitle,
  EuiPopover,
  EuiToolTip,
  EuiHealth,
  EuiModal,
  EuiModalHeader,
  EuiModalBody,
  EuiModalHeaderTitle,

} from '@elastic/eui';

import { EditServer } from './EditServer';
import { EditAlert } from './EditAlert';

import { useTranslation } from 'react-i18next';

export class SrvCardProps {
  title = "服务器名称"
}

export function ServerCard(props) {
  const [cpuload, setCpuload] = useState(undefined);
  const [memavail, setMemavail] = useState(undefined);
  const [memtotal, setMemtotal] = useState(undefined);
  const [memUsePercent, setMemUsePercent] = useState(undefined);
  const [online, setOnline] = useState('INIT');
  const [disks, setDisks] = useState([]);
  const [login, setLogin] = useState(props.login);
  const [isAlertEditOpen, setIsAlertEditOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const updateCardList = props.updateCardList;
  const isFirst = props.isFirst;
  const color = props.color;

  let stoping = false;
  let fcnt = 10;

  useEffect(() => {
    const chanKey = 'STAT_' + props.login.uuid;
    console.log('did mount', props.login.name);

    window.ipc.on(chanKey, (e, data) => {
      if (data.op == 'stat') {
        const nstat = data.stat;
        if (nstat) {
          setCpuload(nstat.cpuload);
          setMemavail(nstat.memavail);
          setMemtotal(nstat.memtotal);
          setMemUsePercent(nstat.memUsePercent);
          setOnline(nstat.online);
          setDisks(nstat.disks);
        }
      }
    });

    window.stat.connect(login);

    return () => {
      console.log('did unmount', props.login.name);
      window.stat.close(login.uuid);
      stoping = true;
    }
  }, [])


  const selectColor = (v) => {
    if (v < 80) {
      return 'success';
    }
    if (v < 90) {
      return 'warning';
    }
    return 'danger';
  }

  const moveFront = async () => {
    console.log('move front ', login.uuid);
    await window.config.configMoveFront(login.uuid);
    props.updateCardList();
  }

  const { t, i18n } = useTranslation();


  const diskX = disks.map((it) => {
    return (
      <EuiToolTip
        display='block'
        key={it.name}
        title={t("Disk usage") + " " + it.name}
        content={<>
          <p>{t("Total size")}: {humanFileSize(it.total)}</p>
          <p>{t("Available size")}: {humanFileSize(it.avail)}</p>
        </>}>
        <EuiProgress
          valueText={true}
          max={100}
          color={selectColor(it.usePercent * 100)}
          label={t("Disk usage") + " (" + it.name + ')'}
          value={(it.usePercent * 100).toFixed(2)}
        />
      </EuiToolTip>
    );
  });
  return (
    <EuiCard
      textAlign="left"
      title={
        <>
          {online == 'ONLINE' ? <EuiIcon size="s" type="online" /> : <EuiIcon size="s" type="offline" />}
          {' '}
          {login.name}
        </>
      }
      description={
        <>
          <div>
            {color &&
              <EuiHealth color={color}>
                {login.group}
              </EuiHealth>}
          </div>

          <EuiToolTip
            position="top"
            content={
              <p>
                {t("Move to Front")}
              </p>
            }
          >
            <EuiButtonIcon
              isDisabled={isFirst}
              iconType="sortLeft"
              aria-label='move card up'
              onClick={() => { moveFront() }}
            />
          </EuiToolTip>


          <>
            <EuiToolTip
              position="top"
              content={<p>{t("Edit server info")}</p>}>
              <EuiButtonIcon
                iconType="documentEdit"
                aria-label='edit server login info'
                onClick={() => setIsEditOpen(true)}
              />
            </EuiToolTip>

            {isEditOpen &&
              <EuiModal onClose={() => setIsEditOpen(false)}>
                <EuiModalHeader>
                  <EuiModalHeaderTitle>
                    <h1>{t('Modify server info')}</h1>
                  </EuiModalHeaderTitle>
                </EuiModalHeader>
                <EuiModalBody>
                  <EditServer {...login}
                    updateCardList={() => props.updateCardList()}
                    closePopover={() => { setIsEditOpen(false); }} />
                </EuiModalBody>
              </EuiModal>}
          </>


          <>
            <EuiToolTip
              position="top"
              content={
                <p>
                  {t('Edit alerts')}
                </p>
              }>
              <EuiButtonIcon
                iconType="alert"
                aria-label='edit server alert info'
                onClick={() => setIsAlertEditOpen(!isAlertEditOpen)} />
            </EuiToolTip>

            {isAlertEditOpen &&
              <EuiModal onClose={() => setIsAlertEditOpen(false)}>
                <EuiModalHeader>
                  <EuiModalHeaderTitle>
                    <h1> {t('Edit alerts')}</h1>
                  </EuiModalHeaderTitle>
                </EuiModalHeader>
                <EuiModalBody>
                  <EditAlert
                    uuid={login.uuid}
                    closePopover={() => setIsAlertEditOpen(false)} />
                </EuiModalBody>
              </EuiModal>}
          </>

          <EuiToolTip
            content={
              <p>
                {t('Remote file transfer')}
              </p>
            }
          >
            <EuiButtonIcon
              iconType="crossClusterReplicationApp"
              aria-label='start transfer remote'
              onClick={() => { window.fs.sftpWindow(login.uuid); }}
            />
          </EuiToolTip>

          <EuiToolTip
            content={
              <p>
                {t('Login terminal')}
              </p>
            }
          >
            <EuiButtonIcon
              style={{ marginRight: 40 }}
              iconType="consoleApp"
              aria-label='start terminal remote'
              onClick={() => { window.rterm.shellWindow(login.uuid); }}
            />
          </EuiToolTip>


          <EuiToolTip
            position="top"
            content={
              <p>
                {t('delete')}
              </p>
            }
          >
            <EuiButtonIcon
              iconType="trash"
              area-label='delete server'
              onClick={async () => {
                console.log('delete', login.uuid);
                await window.config.del(login.uuid);
                await updateCardList();
              }}
            />
          </EuiToolTip>

        </>
      }
    >

      <EuiProgress
        valueText={true}
        max={100}
        color={selectColor(cpuload * 100)}
        label={t("CPU usage")}
        value={(cpuload * 100).toFixed(2)}
      />

      <EuiToolTip
        display='block'
        title={t('Memory usage')}
        content={<><p>{t('Total memory size')}: {humanFileSize(memtotal)}</p>
          <p>{t('Available memory size')}: {humanFileSize(memavail)}</p>
          <p>MemAvailable = MemFree + Buffers + Cached</p></>}>
        <EuiProgress
          valueText={true}
          max={100}
          color={selectColor(memUsePercent * 100)}
          label={t('Memory usage')}
          value={(memUsePercent * 100).toFixed(2)}
        />

      </EuiToolTip>
      {diskX}
    </EuiCard>
  );
}


function humanFileSize(bytes, si = false, dp = 1) {
  const thresh = si ? 1000 : 1024;

  if (Math.abs(bytes) < thresh) {
    return bytes + ' B';
  }

  const units = si
    ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
  let u = -1;
  const r = 10 ** dp;

  do {
    bytes /= thresh;
    ++u;
  } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);


  return bytes.toFixed(dp) + ' ' + units[u];
}
