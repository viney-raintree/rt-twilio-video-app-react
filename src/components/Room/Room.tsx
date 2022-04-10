import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { makeStyles, Theme } from '@material-ui/core';
import ChatWindow from '../ChatWindow/ChatWindow';
import ParticipantList from '../ParticipantList/ParticipantList';
import MainParticipant from '../MainParticipant/MainParticipant';
import BackgroundSelectionDialog from '../BackgroundSelectionDialog/BackgroundSelectionDialog';
import useChatContext from '../../hooks/useChatContext/useChatContext';
import useVideoContext from '../../hooks/useVideoContext/useVideoContext';
import WhiteBoard from '../WhiteBoard/WhiteBoard';
import { RemoteParticipant, RemoteTrackPublication } from 'twilio-video';

const useStyles = makeStyles((theme: Theme) => {
  const totalMobileSidebarHeight = `${theme.sidebarMobileHeight +
    theme.sidebarMobilePadding * 2 +
    theme.participantBorderWidth}px`;
  return {
    container: {
      position: 'relative',
      height: '100%',
      display: 'grid',
      gridTemplateColumns: `1fr ${theme.sidebarWidth}px`,
      gridTemplateRows: '100%',
      [theme.breakpoints.down('sm')]: {
        gridTemplateColumns: `100%`,
        gridTemplateRows: `calc(100% - ${totalMobileSidebarHeight}) ${totalMobileSidebarHeight}`,
      },
    },
    rightDrawerOpen: { gridTemplateColumns: `1fr ${theme.sidebarWidth}px ${theme.rightDrawerWidth}px` },
  };
});

export default function Room() {
  const classes = useStyles();
  const { isChatWindowOpen } = useChatContext();
  const { room, isBackgroundSelectionOpen, isWhiteBoardOpen, setIframeUrl, setWBValue } = useVideoContext();
  const [ isopenWB, setisopenWB] = useState(false);
  const [ enableDataTrack, setEnableDataTrack] = useState(true);
  const [isRoomSidUpdated, setIsRoomSidUpdated] = useState(false);


  const trackSubscribed = (track:any) => {
    console.log("track subscribed")
    if (track.kind === 'data') {
        track.on('message', (data:any) => {
          interface MyObj {
            whiteboard: string;
            url: string;
        }
          let obj: MyObj = JSON.parse(data);
          if (obj.whiteboard === 'close'){
            setisopenWB(false);
            setWBValue(false);
          }else{
            setisopenWB(true);
            setWBValue(true);
            setIframeUrl(obj.url);
          }

        });
    }
  };

  const participantConnected = (participant: RemoteParticipant) => {
    participant.tracks.forEach((publication: RemoteTrackPublication) => {
      if (publication.track) {
        trackSubscribed(publication.track);
      }
    });
    participant.on('trackSubscribed', trackSubscribed);
    participant.on('trackPublished', trackSubscribed)
  };

  useEffect(() => {
    setIsRoomSidUpdated(true);
    const params = new URLSearchParams(window.location.search);
    const dbprefix = params.get('dbprefix');
    const dbname = params.get('dbname');
    const chost = params.get('chost');
    const updateRTOnStartCall =
    dbprefix !== null && dbname !== null && chost !== null ? `https://${chost}/${dbprefix}/${dbname}/rtconnect/` : '';
       console.log(updateRTOnStartCall)
       try {
         const telehData = {
           Teleh_sessionStart: 'TRUE',
           roomName: room?.name,
           roomSID: room?.sid,         };
         let updatesent = navigator.sendBeacon(updateRTOnStartCall, JSON.stringify(telehData));
       } catch (error) {
       }

},[!isRoomSidUpdated])

useEffect(() => {
    if (enableDataTrack){
      setEnableDataTrack(false);
    }
    room!.participants.forEach(participantConnected);
    room!.on('participantConnected', participantConnected);


    //eslint-disable-next-line
  },[room, enableDataTrack]);
  return (
    <div
      className={clsx(classes.container, {
        [classes.rightDrawerOpen]: isChatWindowOpen || isBackgroundSelectionOpen ,
      })}
    >
      {(isWhiteBoardOpen || isopenWB) && <WhiteBoard isopenWB={isopenWB}/>}
      {(!(isWhiteBoardOpen || isopenWB )) &&  <MainParticipant />}
      <ParticipantList />
      {(!(isWhiteBoardOpen || isopenWB )) &&  <ChatWindow />}
      {(!(isWhiteBoardOpen || isopenWB )) &&  <BackgroundSelectionDialog />}
    </div>
  );
}
