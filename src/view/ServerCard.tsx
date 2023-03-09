import * as React from 'react';
import Typography from '@mui/material/Typography';
import Fab, { FabProps } from '@mui/material/Fab';
import Stack from '@mui/material/Stack';
import Box from '@mui/system/Box';
import LinearProgress, { LinearProgressProps } from '@mui/material/LinearProgress';
import { sleepAsync } from './sleepAsync';
import { humanFileSize } from './humanSize';


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
}

export function ServerCard(props: ServerCardProps) {
  const server = props.server;

  const [info, setInfo] = React.useState(null);

  const updateInfoLoop = async () => {
    console.log("updateInfoLoop: ", JSON.stringify(server));
    const stat = await main.remote.getServerStat(server);
    console.log("stat=", JSON.stringify(stat));
    setInfo(stat);
    return stat;
  };

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

  return (
    <Box>
      <Box>
        <Typography color={colorByOnline()} variant='h6' >{server.name}</Typography>
        <Typography variant='caption'>{server.username + "@" + server.host + ":" + server.port}</Typography>
      </Box>

      <Box>
        <Typography color="text.disabled" variant='caption'>CPU 占用率: {cpu.toFixed(2)}%</Typography>
        <MyLinearProgress color={calcColor(cpu)} variant='determinate' value={cpu} valueBuffer={0} />
      </Box>

      <Box>
        <Typography color="text.disabled" variant='caption'>内存占用率: {" "}
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
                磁盘({disk.name}) {(rate).toFixed(2)}% - {humanFileSize(disk.total - disk.avail)}/{humanFileSize(disk.total)}</Typography>
              <MyLinearProgress color={calcColor(rate)} variant='determinate' value={rate} valueBuffer={0} />
            </Box>
          );
        })
      }


    </Box>
  )
}
