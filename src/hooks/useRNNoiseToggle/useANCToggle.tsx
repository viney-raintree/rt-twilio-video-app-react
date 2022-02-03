import { useCallback, useEffect, useState } from 'react';
import { TwilioError } from 'twilio-video';
import { initANC } from '../../anc/noiseCancellation';
import useVideoContext from '../useVideoContext/useVideoContext';

let component_call = 0;
let toggleANC_call = 0;
export default function useANCToggle() {
  let useANCToggleCall = component_call++;
  console.log(`${useANCToggleCall}:makarand: useANCToggle`);
  const { removeLocalAudioTrack, getLocalAudioTrack, room, localTracks, onError } = useVideoContext();
  const [isReplacing, setIsReplacing] = useState(false);
  const [isUsingANC, setIsUsingANC] = useState(false);

  useEffect(() => {
    // when 1st time this is called we need to initANC.
    console.log(`${useANCToggleCall}:makarand: useANCToggle:useEffect`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleANC = useCallback(async () => {
    let toggleANCCall = `toggleANC #${useANCToggleCall}:${toggleANC_call++}`;
    // @ts-ignore
    const log = (...messages) => {
      console.log(toggleANCCall, ...messages);
    };
    log(`isUsingANC = ${isUsingANC}`);
    log('calling initANC');
    const anc = await initANC();
    log('done calling initANC');

    const localParticipant = room?.localParticipant;
    if (localParticipant) {
      const audioTrackPublications = Array.from(localParticipant.tracks.values());
      const audioTrack = audioTrackPublications.map(pub => pub.track).find(track => track && track.kind === 'audio');
      if (!isReplacing) {
        log('isReplacing 2');
        setIsReplacing(true);
        if (audioTrack) {
          log('audioTrack 3');
          // we need to unpublish, and then republish with ANC.
          const localTrackPublication = localParticipant?.unpublishTrack(audioTrack);
          // TODO: remove when SDK implements this event. See: https://issues.corp.twilio.com/browse/JSDK-2592
          localParticipant?.emit('trackUnpublished', localTrackPublication);
          removeLocalAudioTrack();
          log('removeLocalAudioTrack 4');
          try {
            const track = await getLocalAudioTrack();
            log('got getLocalAudioTrack');
            // get it cleaned.
            if (isUsingANC) {
              // just publish the track
              anc.disconnect();
              await localParticipant?.publishTrack(track);
              setIsUsingANC(false);
            } else {
              log('done calling initANC');
              const cleanTrack = anc.connect(track.mediaStreamTrack);
              log('done calling connect: ', cleanTrack);
              await localParticipant?.publishTrack(cleanTrack);
              log('done calling publish ');
              setIsUsingANC(true);
            }
          } catch (error) {
            log('catch:', error);
            let err = error as Error | TwilioError;
            onError(err);
          } finally {
            log('finally');
            setIsReplacing(false);
          }
        }
      }
    }
  }, [
    useANCToggleCall,
    isUsingANC,
    room?.localParticipant,
    isReplacing,
    removeLocalAudioTrack,
    getLocalAudioTrack,
    onError,
  ]);

  const noiseCancellationKind = 'krisp';
  return [isUsingANC, toggleANC, noiseCancellationKind] as const;
}
