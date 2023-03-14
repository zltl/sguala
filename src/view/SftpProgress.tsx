import React from 'react';
import Typography from '@mui/material/Typography';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import Grid from '@mui/material/Grid';
import Divider from '@mui/material/Divider';
import { humanFileSize } from './humanSize';
import DoneIcon from '@mui/icons-material/Done';
import { useTranslation } from 'react-i18next';
import ErrorIcon from '@mui/icons-material/Error';
import { LinearProgress } from '@mui/material';

export function SftpProgress({ uuid, remote, local, dir }: { uuid: string, remote: string, local: string, dir: string }) {
  const [t, i18n] = useTranslation();
  const [startTime, setStartTime] = React.useState<Date>(new Date());
  const [transfered, setTransfered] = React.useState<number>(0);
  const [fsize, setFsize] = React.useState<number>(0);
  const [speed, setSpeed] = React.useState<number>(0);
  const [isEnd, setIsEnd] = React.useState<boolean>(false);
  const [err, setErr] = React.useState<string>(undefined);

  let direIcon = <UploadIcon color='disabled' />
  if (dir == 'get') {
    direIcon = <DownloadIcon color='disabled' />
  }

  React.useEffect(() => {
    console.log("SftpProgress mount");
    main.ipc.on(uuid, (event: any, msg: any) => {
      console.log('on transfer progress', JSON.stringify(msg));
      if (msg.op == 'transferProgress') {
        setTransfered(msg.transfered);
        setFsize(msg.fsize);
        setSpeed(msg.speed);
        setIsEnd(msg.isEnd);
      } else if (msg.op == 'transferError') {
        setErr(msg.error);
      }
    });

    return () => {
      console.log("SftpProgress unmount");
    };
  }, []);

  let rate = Math.round(transfered / fsize * 100);
  if (!rate) {
    rate = 0;
  }
  console.log(`transfered: ${transfered}, fsize: ${fsize}, rate: ${rate}, speed: ${speed}`);


  const spdstr = humanFileSize(speed) + '/s';

  return (
    <div style={{ width: '100%' }}>
      <Divider />
      <Grid container spacing={2} sx={{ width: '100%' }}>
        <Grid item xs={1}>
          {direIcon}
        </Grid>
        <Grid item xs={5}>
          <Typography variant="body2" component="div" sx={{ flexGrow: 1 }}>
            {remote}
          </Typography>
        </Grid>
        <Grid item xs={1}>
          <Typography variant="body2" component="div" sx={{ flexGrow: 1 }}>
            {dir == 'get' ? '->' : '<-'}
          </Typography>
        </Grid>
        <Grid item xs={5}>
          <Typography variant="body2" component="div" sx={{ flexGrow: 1 }}>
            {local}
          </Typography>
        </Grid>
      </Grid>
      <Grid container spacing={2} sx={{ width: '100%' }}>

        <Grid item xs={1}>
          {isEnd && !err && <DoneIcon color='success' />}
          {err && <ErrorIcon color='error' />}
        </Grid>

        <Grid item xs={5}>
          <LinearProgress variant="determinate" value={rate} />
        </Grid>
        <Grid item xs={3}>
          <Typography variant="body2" color="text.secondary">{humanFileSize(transfered) + "/" + humanFileSize(fsize)}</Typography>
        </Grid>

        <Grid item xs={3}>
          <Typography variant="body2" color="text.secondary">{spdstr}</Typography>
        </Grid>

      </Grid>
    </div>
  );


}