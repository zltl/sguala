import * as React from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/system/Box';
import LinearProgress, { LinearProgressProps } from '@mui/material/LinearProgress';
import { humanFileSize } from './humanSize';
import { useDrag, useDrop } from 'react-dnd'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import TerminalIcon from '@mui/icons-material/Terminal';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';

import { useTranslation } from 'react-i18next';
import { Observer } from './Observer';
import { EditServerPage } from './EditServerPage';

const MyLinearProgress = (props: LinearProgressProps) => {
  return (
    <LinearProgress
      {...props}
      sx={{
        "& .MuiLinearProgress-dashed": {
          backgroundColor: "lightgrey",
          backgroundImage: "none",
          animation: "none"
        }
      }} />
  );
}

interface ServerCardProps {
  groupName?: string;
  server?: any;
  reloadConf: () => void;
}

export function ServerCard(props: ServerCardProps) {
  const server = props.server;
  const { t, i18n } = useTranslation();

  const [info, setInfo] = React.useState(null);
  const [mouseEnter, setMouseEnter] = React.useState(false);

  const updateInfoLoop = async () => {
    // console.log("updateInfoLoop: ", JSON.stringify(server));
    const stat = await main.remote.getServerStat(server.uuid);
    console.log("stat=", JSON.stringify(stat));
    setInfo(stat);
    return stat;
  };

  const gotoEditServer = () => {
    Observer.notify('shellNavigateTo', {
      name: t('Edit Server'),
      page: <EditServerPage
        {...props.server}
        goBack={() => {
          Observer.notify('changePage', 'sguala');
        }} />,
      icon: <EditIcon />,
    });
  };
  const deleteServer = async () => {
    console.log("delete server: ", JSON.stringify(server));
    await main.conf.removeServer(server.groupUuid, server.uuid);
    props.reloadConf();
  };

  const startShell = async () => {
    await main.remote.shellWindow(server.uuid);
  }

  React.useEffect(() => {

    updateInfoLoop();
    const waitTime = 10000;

    console.log('server card mounted: ', JSON.stringify(server));
    const interval = setInterval(async () => {
      await updateInfoLoop();
    }, waitTime);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const mem = info?.mem;
  const cpu = info?.cpu * 100;
  const disks = info?.disk.List;

  const memTotal = mem?.total;
  const memAvail = mem?.avail;
  const memUsed = mem?.total - mem?.avail;
  const memRate = mem?.avail / mem?.total * 100;
  const memRateBuffer = (mem?.total - mem?.free) / mem?.total * 100;

  const calcColor = (rate: number): "primary" | "secondary" | "error" | "info" | "success" | "warning" | "inherit" => {
    if (rate > 90) {
      return "error";
    } else if (rate > 80) {
      return "warning";
    }
    return "primary";
  }

  const colorByOnline = () => {
    if (info?.online) {
      return "primary.main";
    }
    return "text.disabled";
  }

  const [{ opacity, isDragging }, dragRef, dragPreviewRef] = useDrag(
    () => ({
      type: 'server',
      item: { uuid: server.uuid, groupUuid: server.groupUuid },
      collect: (monitor) => ({
        opacity: monitor.isDragging() ? 0.3 : 1,
        isDragging: monitor.isDragging(),
      })
    }),
    [server]
  );
  const [{ isOver }, drop] = useDrop({
    accept: 'server',
    drop: (item: any) => {
      if (item.uuid === server.uuid) {
        return;
      }
      console.log('drop item:', JSON.stringify(item));
      (async () => {
        await main.conf.moveServer(item.groupUuid, item.uuid, server.groupUuid, server.uuid);
        props.reloadConf();
      })();
    },
    collect: monitor => ({
      isOver: !!monitor.isOver(),
    }),
  }, [server]);

  if (isDragging) {
    return <Box ref={dragPreviewRef} style={{ opacity }} />;
  }
  let overSx = {};
  if (isOver) {
    overSx = { borderLeft: '5px solid #9c27b0' }
  }

  return (
    <Box onMouseEnter={() => { setMouseEnter(true) }}
      onMouseLeave={() => { setMouseEnter(false) }}
      sx={{ ...overSx }} ref={drop}>
      <Box>
        <Box ref={dragRef}>
          {mouseEnter && <Box sx={{ '& > :not(style)': { mr: 2 } }} >
            <Box display='inline-flex'>
              <DragIndicatorIcon color="disabled" />
            </Box>
            <Box display='inline-flex' onClick={() => gotoEditServer()}><EditIcon color="disabled" /> </Box>

            <Box display='inline-flex'><DriveFileMoveIcon color="disabled" /> </Box>

            <Box display='inline-flex' onClick={() => startShell()}><TerminalIcon color="disabled" /> </Box>

            <Box display='inline-flex' onClick={() => deleteServer()} sx={{ float: 'right' }}><DeleteIcon color="disabled" /> </Box>
          </Box>}
          <Typography color={colorByOnline()} variant='h6'>{server.name}</Typography>
        </Box>
        <Typography variant='caption'>{server.username + "@" + server.host + ":" + server.port}</Typography>
      </Box>

      <Box>
        <Typography color="text.disabled" variant='caption'>{t('CPU')}: {cpu.toFixed(2)}%</Typography>
        <MyLinearProgress color={calcColor(cpu)} variant='determinate' value={cpu} valueBuffer={0} />
      </Box>

      <Box>
        <Typography color="text.disabled" variant='caption'>{t('Memory')}: {" "}
          {memRate.toFixed(2)}%
          - {humanFileSize(memUsed)}/{humanFileSize(memTotal)}</Typography>
        <MyLinearProgress color={calcColor(memRate)} variant='buffer' value={memRate} valueBuffer={memRateBuffer} />
      </Box>

      {
        disks?.map((disk: any) => {
          const rate = (disk.total - disk.avail) / disk.total * 100;
          return (
            <Box key={disk.name}>
              <Typography color="text.disabled" variant='caption'>
                {t('Disk')}({disk.name}) {(rate).toFixed(2)}% - {humanFileSize(disk.total - disk.avail)}/{humanFileSize(disk.total)}</Typography>
              <MyLinearProgress color={calcColor(rate)} variant='determinate' value={rate} valueBuffer={0} />
            </Box>
          );
        })
      }
    </Box>
  )
}
