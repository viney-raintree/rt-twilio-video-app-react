import { useCallback, useState } from 'react';
import { TwilioError } from 'twilio-video';
import { getANCKind, initANC } from '../../anc/noiseCancellation';
import useVideoContext from '../useVideoContext/useVideoContext';

let component_call = 0;
let toggleANC_call = 0;
export default function useANCToggle() {
  let useANCToggleCall = component_call++;
  const { removeLocalAudioTrack, getLocalAudioTrack, room, onError } = useVideoContext();
  const [isReplacing, setIsReplacing] = useState(false);
  const [isUsingANC, setIsUsingANC] = useState(false);
  const [noiseCancellationKind, setNoiseCancellationKind] = useState(getANCKind());

  const toggleANC = useCallback(async () => {
    let toggleANCCall = `toggleANC #${useANCToggleCall}:${toggleANC_call++}`;
    // @ts-ignore
    const log = (...messages) => {
      console.log(toggleANCCall, ...messages);
    };

    const anc = await initANC();
    log(`useANCToggle: isUsingANC = ${isUsingANC}, kind=${anc.kind}`);
    setNoiseCancellationKind(anc.kind);

    const localParticipant = room?.localParticipant;
    if (localParticipant) {
      const audioTrackPublications = Array.from(localParticipant.tracks.values());
      const audioTrack = audioTrackPublications.map(pub => pub.track).find(track => track && track.kind === 'audio');
      if (!isReplacing) {
        setIsReplacing(true);
        if (audioTrack) {
          // we need to unpublish, and then republish with ANC.
          const localTrackPublication = localParticipant?.unpublishTrack(audioTrack);
          // TODO: remove when SDK implements this event. See: https://issues.corp.twilio.com/browse/JSDK-2592
          localParticipant?.emit('trackUnpublished', localTrackPublication);
          removeLocalAudioTrack();
          try {
            const willUseANC = !isUsingANC;
            const track = await getLocalAudioTrack({
              noiseSuppression: !willUseANC,
            });
            log('got audioTrack with noiseSuppression: ', track.mediaStreamTrack.getSettings().noiseSuppression);
            // get it cleaned.
            if (isUsingANC) {
              // just publish the track
              anc.disconnect();
              await localParticipant?.publishTrack(track);
              setIsUsingANC(false);
            } else {
              const cleanTrack = anc.connect(track.mediaStreamTrack);
              await localParticipant?.publishTrack(cleanTrack);
              log('published audio track again');
              setIsUsingANC(true);
            }
          } catch (error) {
            let err = error as Error | TwilioError;
            onError(err);
          } finally {
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

  return [isUsingANC, toggleANC, noiseCancellationKind] as const;
}
