import React, { useState, useEffect } from 'react';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import { Typography } from '@material-ui/core';

import { useStopwatch } from 'react-timer-hook';

import useRoomState from './../../hooks/useRoomState/useRoomState';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    sessionTimerContainer: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      textAlign: 'center',
      //   [theme.breakpoints.up('md')]: {
      //     marginLeft: '2.2em',
      //   },
    },

    textField: {
      paddingLeft: '0.5em',
      paddingRight: '0.5em',
    },
  })
);

export default function SessionTimer() {
  const classes = useStyles();
  const roomState = useRoomState();

  const { seconds, minutes, hours, days, isRunning, start, pause, reset } = useStopwatch({ autoStart: false });

  const [timerRunning, setTimerRunning] = useState<boolean>(false);

  useEffect(() => {
    if (roomState === 'connected' && timerRunning === false) {
      setTimerRunning(true);
      start();
    }
  }, [roomState, timerRunning, setTimerRunning, start]);

  return (
    <span className={classes.sessionTimerContainer}>
      {/* <Typography variant="subtitle1" className={classes.textField} gutterBottom noWrap> */}
      {/* <span> */}
      Session Time &nbsp; {hours} h : {minutes} m : {seconds} s{/* </span> */}
      {/* </Typography>
      <Typography variant="subtitle1" className={classes.textField} gutterBottom noWrap> */}
      {/* <span>
          
        </span> */}
      {/* </Typography> */}
    </span>
  );
}
