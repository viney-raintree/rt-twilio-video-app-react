import { useState } from 'react';
import { Room, LocalDataTrack, LocalAudioTrack, LocalVideoTrack  } from 'twilio-video';
import { ErrorCallback } from '../../../types';
import axios from 'axios';

export default function useWhiteBoardToggle(room: Room | null, localTracks: (LocalAudioTrack | LocalVideoTrack | LocalDataTrack)[], onError?: ErrorCallback) {
  const [isWhiteBoardOpen, toggleWhiteBoard] = useState(false);
  const [whiteBoardUrl, setWhiteBoardUrl] = useState('');
  const params = new URLSearchParams(window.location.search);
  const chost: string = params.get('chost')!;

  const setWBValue = (val: boolean) => {
    toggleWhiteBoard(val);
  }

  const toggleWB = () =>{

    const dataTrack = localTracks.find(track => track.kind === 'data') as LocalDataTrack;

    async function getWhiteBoardTokenFromServer() {
      return fetchToken(chost + '/rtconnect/getToken');
  }

  async function fetchToken(req: any){

    let config = {
      headers: { 'Cache-Control': 'no-cache' },
      params: {
        chost: chost,
      },
    };
     const response = await axios.get('api/getWhiteboardToken', config).then( res => { return res; });
     const result = await JSON.parse(JSON.stringify(response.data));
     console.log(result.accessToken);
     return result.accessToken;
    }

    room!.localParticipant.on('trackPublished', publication => {
      console.log("Before if publish");
      if (publication.track === dataTrack) {
        console.log("inside if publish");
      }
    });

    room!.localParticipant.on('trackPublicationFailed', (error, track) => {
      console.log(" if publish error");

      if (track === dataTrack) {
        console.log("inside if error");
      }
    });

    if (isWhiteBoardOpen){
      toggleWhiteBoard(!isWhiteBoardOpen);
      room!.localParticipant.publishTrack(dataTrack).then(() => {
        dataTrack.send(JSON.stringify({
          whiteboard: "close",
          url : whiteBoardUrl
        }));
      }).catch((error) => {
        console.log("error occured"+error);
      })
    }else{
      toggleWhiteBoard(!isWhiteBoardOpen);
      //open whiteboard logic goes here
      //punlish track
      if (whiteBoardUrl !== "") {
        room!.localParticipant.publishTrack(dataTrack).then(() => {
          dataTrack.send(JSON.stringify({
            "whiteboard": "open",
            "url" : whiteBoardUrl
          }))         }).catch((error) => {
          console.log("error occured"+error);
        })
        return
      }
      room!.localParticipant.publishTrack(dataTrack).then(() => {
        //@ts-ignore
        miroBoardsPicker.open({
          clientId: '3458764519047707269', // 1) Put your 'clientId' here.
          action: 'access-link',
          allowCreateAnonymousBoards: true, //2) Enable this option
          getAnonymousUserToken: () => getWhiteBoardTokenFromServer(), // Provide token in async way
          success: (data: any) => {
            setWhiteBoardUrl(data.accessLink);
            console.log(data.accessLink)
            dataTrack.send(JSON.stringify({
              whiteboard: "open",
              url : data.accessLink
            }))
              console.log('on success', data)
          },
          error: (e: any) => {
              console.log('on error', e)
          },
          cancel: () => {
              console.log('on cancel')
          },

      })
      }).catch((error) => {
        console.log("error occured"+error);
      })
      console.log("Promise");
    }
  }
  const setIframeUrl = (url : string) => {
    setWhiteBoardUrl(url);
  }
  return [isWhiteBoardOpen, toggleWB, whiteBoardUrl, setIframeUrl, setWBValue] as const;

}


