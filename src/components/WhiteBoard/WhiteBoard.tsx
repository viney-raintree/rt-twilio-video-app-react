import React from 'react';
import clsx from 'clsx';
import { makeStyles, Theme } from '@material-ui/core/styles';
import useVideoContext from '../../hooks/useVideoContext/useVideoContext';

const useStyles = makeStyles((theme: Theme) => ({
  drawer: {
    display: 'flex',
    width: '100%',
    height: '100%',
  },
  hide: {
    display: 'none',
  },
}));

function WhiteBoard({isopenWB}: any) {
  const classes = useStyles();
  const { isWhiteBoardOpen, whiteBoardUrl } = useVideoContext();
  //<iframe style={{width: "100%"}}  src="https://miro.com/app/live-embed/uXjVOIkHpiQ=?boardAccessToken=zr1Pe3FssYYIZoDvCVTI9FXUdJF8IH3y&autoplay=true" title="WhiteBoard" frameBorder="0" scrolling="no" allowFullScreen>

  return (
     <aside className={clsx(classes.drawer, { [classes.hide]: !(isWhiteBoardOpen||isopenWB)})}>
          <iframe style={{width: "100%"}}  src={whiteBoardUrl} title="WhiteBoard" frameBorder="0" scrolling="no" allowFullScreen>
          </iframe>
    </aside>
  );
}

export default WhiteBoard;
