import * as React from 'react';
import Typography from '@mui/material/Typography';
import Fab, { FabProps } from '@mui/material/Fab';
import Stack from '@mui/material/Stack';


interface Props extends FabProps {
  label: string;
  icon: React.ReactNode;
}
export function LabelFab(props: Props) {
  const { label, icon, ...rest } = props;
  return (
    <Stack direction="row"
      sx={{
        marginRight: 0,
      }}
      style={{
        marginLeft: 'auto',
      }}>
      <div
        style={{
          height: 60,
          display: 'flex',
          justifyContent: 'center',
          marginRight: 10,
          alignItems: 'center',
        }}><Typography variant='h6' >{label}</Typography></div>
      <Fab {...rest}>
        {icon}
      </Fab>
    </Stack >
  );
}
