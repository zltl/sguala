import * as React from 'react';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { ServerCard } from './ServerCard';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { Box } from '@mui/system';
import { useDrag, useDrop } from 'react-dnd'
import LinearProgress from '@mui/material/LinearProgress';

interface Props {
  group: { name: string, uuid: string, servers: any[] };
  reloadConf: () => void;
}

export function ServerGroupEnd({ reloadConf }: { reloadConf: () => void }) {
  const [{ isOver }, drop] = useDrop({
    accept: 'group',
    drop: (item: any) => {
      console.log('drop item to end:', JSON.stringify(item));
      main.conf.moveGroup(item.uuid, 'end');
      reloadConf();
    },
    collect: monitor => ({
      isOver: !!monitor.isOver(),
    }),
  }, []);

  return (
    <Box ref={drop} sx={{ height: 200, width: '100%' }}>
      {isOver && <LinearProgress variant="determinate" color="secondary" value={0} />}
    </Box>
  );
}

export function ServerGroup(props: Props) {
  const group = props.group;
  const [expanded, setExpanded] = React.useState(false);
  const [{ opacity }, dragRef] = useDrag(
    () => ({
      type: 'group',
      item: { uuid: group.uuid },
      collect: (monitor) => ({
        opacity: monitor.isDragging() ? 0.3 : 1
      })
    }),
    []
  );

  const [{ isOver }, drop] = useDrop({
    accept: 'group',
    drop: (item: any) => {
      if (item.uuid === group.uuid) {
        return;
      }
      console.log('drop item:', JSON.stringify(item));
      main.conf.moveGroup(item.uuid, group.uuid);
      props.reloadConf();
    },
    collect: monitor => ({
      isOver: !!monitor.isOver(),
    }),
  }, [props.group]);

  return (
    <Box ref={dragRef} style={{ opacity }}>
      <Box ref={drop}>
        {isOver && <LinearProgress variant="determinate" color="secondary" value={0} />}
        <Accordion expanded={expanded} onChange={
          (event, isExpanded) => {
            setExpanded(isExpanded);
          }
        } >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls="panel1a-content"
            id="panel1a-header"
            sx={{ cursor: 'move' }}>
            <Box sx={{ marginRight: 2, cursor: 'move' }}>
              <DragIndicatorIcon color="disabled" />
            </Box>
            <Typography >{group.name}</Typography>
          </AccordionSummary>
          <AccordionDetails >
            {expanded &&
              <Grid sx={{ flexGrow: 1 }} container spacing={{ xs: 2, md: 3 }} columns={{ xs: 4, sm: 8, md: 12 }}>
                {group.servers.map((server) => (
                  <Grid item xs={4} sm={4} md={4} key={server.uuid + server.updateTime}>
                    <ServerCard server={server} groupName={group.name} />
                  </Grid>
                ))}
              </Grid>
            }
          </AccordionDetails>
        </Accordion>
      </Box>
    </Box>
  );
}