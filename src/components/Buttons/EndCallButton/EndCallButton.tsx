import React, { useState } from 'react';
import clsx from 'clsx';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';

import { Button } from '@material-ui/core';

import useVideoContext from '../../../hooks/useVideoContext/useVideoContext';

import axios from 'axios';
import { useEffect } from 'react';

import { isMobile } from '../../../utils';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    button: {
      background: theme.brand,
      color: 'white',
      '&:hover': {
        background: '#600101',
      },
    },
  })
);

export default function EndCallButton(props: { className?: string }) {
  const classes = useStyles();
  const { room, isSharingScreen } = useVideoContext();
  const params = new URLSearchParams(window.location.search);
  const chost = params.get('chost');
  const consumer = params.get('consumer');
  const dbprefix = params.get('dbprefix');
  const dbname = params.get('dbname');
  const [EndCallPressed, setEndCallPressed] = useState(false);

  const handleClick = () => {
    // if (isSharingScreen) {
    //   toggleScreenShare();
    // }
    // removeLocalAudioTrack();
    // removeLocalVideoTrack();

    setEndCallPressed(true);
    room!.disconnect();

    if (updateRTOnEndCall !== '') updateRaintree();

    if (redirectURL !== '')
      window.open(redirectURL, 'Feedback', 'resizable,scrollbars,status,toolbar,width=500,height=500,top=250,left=500');
  };

  const redirectURL =
    consumer === 'participant' && dbprefix !== null && dbname !== null && chost !== null
      ? `https://${chost}/${dbprefix}/${dbname}/TelehealthFeedback/?roomName=${room!.name}&participantName=${
          room!.localParticipant.identity
        }`
      : '';
  const updateRTOnEndCall =
    dbprefix !== null && dbname !== null && chost !== null ? `https://${chost}/${dbprefix}/${dbname}/rtconnect/` : '';

  const updateRaintree = async () => {
    try {
      const telehData = {
        Teleh_EndCall: 'TRUE',
        roomName: room!.name,
        participantName: room!.localParticipant.identity,
        consumer: consumer,
      };
      const response = await axios.post(updateRTOnEndCall, telehData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
      });
    } catch (error) {
      throw new Error(`Unable to connect to Raintree.`);
    }
  };

  const sendBeaconToRaintree = () => {
    try {
      const telehData = {
        Teleh_BrowserClose: 'TRUE',
        roomName: room!.name,
        participantName: room!.localParticipant.identity,
        consumer: consumer,
      };
      let updatesent = navigator.sendBeacon(updateRTOnEndCall, JSON.stringify(telehData));

      //      if (updatesent) {
      //        console.log('Update sent successfully');
      //      } else {
      //        console.log('End call becaon failed.');
      //      }
    } catch (error) {
      //      throw new Error(`Unable to connect to Raintree.`);
    }
  };

  useEffect(
    function setupunloadListener() {
      console.log('setupUnloadListener invoked');
      const params = new URLSearchParams(window.location.search);
      const chost = params.get('chost');
      const consumer = params.get('consumer');
      const dbprefix = params.get('dbprefix');
      const dbname = params.get('dbname');
      const redirectURL =
        consumer === 'participant' && dbprefix !== null && dbname !== null && chost !== null
          ? `https://${chost}/${dbprefix}/${dbname}/TelehealthFeedback/?roomName=${room!.name}&participantName=${
              room!.localParticipant.identity
            }`
          : '';
      const updateRTOnEndCall =
        dbprefix !== null && dbname !== null && chost !== null
          ? `https://${chost}/${dbprefix}/${dbname}/rtconnect/`
          : '';

      function handleEndCall() {
        if (EndCallPressed) return;

        const handleBeforeUnload = (event: any) => event.preventDefault();
        if (updateRTOnEndCall !== '') {
          console.log('handle end call closing - update RT');
          sendBeaconToRaintree();
        }

        if (redirectURL !== '') {
          console.log('handle end call closing - redirecturl');
          window.open(
            redirectURL,
            '_blank',
            'resizable,scrollbars,status,toolbar,width=500,height=500,top=250,left=500'
          );
        }
      }
      window.addEventListener('beforeunload', handleEndCall);
      if (isMobile) {
        // Add a listener to disconnect from the room when a mobile user closes their browser
        window.addEventListener('pagehide', handleEndCall);
      }

      return function cleanupListener() {
        window.removeEventListener('beforeunload', handleEndCall);
        if (isMobile) {
          window.removeEventListener('pagehide', handleEndCall);
        }
      };
    },
    [EndCallPressed]
  );

  return (
    <Button onClick={handleClick} className={clsx(classes.button, props.className)} data-cy-disconnect>
      Disconnect
    </Button>
  );
}
