import { useCallback, useState } from 'react';
import { LocalAudioTrack } from 'twilio-video';
import useVideoContext from '../useVideoContext/useVideoContext';

export default function useANCToggle() {
  console.log('makarand: useANCToggle');
  const {
    isUsingANC,
    enableANC,
    disableANC,
    noiseCancellationKind,
    removeLocalAudioTrack,
    getLocalAudioTrack,
    room,
    localTracks,
    onError,
  } = useVideoContext();
  const [isReplacing, setIsReplacing] = useState(false);

  const toggleANC = useCallback(() => {
    console.log('makarand: useANCToggle:toggleANC');
    const localParticipant = room?.localParticipant;
    const audioTrack = localTracks.find(track => track.kind === 'audio') as LocalAudioTrack;
    if (!isReplacing) {
      setIsReplacing(true);
      if (audioTrack) {
        // we need to unpublish, and then republish with ANC.
        const localTrackPublication = localParticipant?.unpublishTrack(audioTrack);
        // TODO: remove when SDK implements this event. See: https://issues.corp.twilio.com/browse/JSDK-2592
        localParticipant?.emit('trackUnpublished', localTrackPublication);
        removeLocalAudioTrack();
      }

      isUsingANC ? disableANC() : enableANC();

      if (audioTrack) {
        getLocalAudioTrack()
          .then((track: LocalAudioTrack) => localParticipant?.publishTrack(track))
          .catch(onError)
          .finally(() => {
            setIsReplacing(false);
          });
      } else {
        setIsReplacing(false);
      }
    }
  }, [
    room,
    localTracks,
    isReplacing,
    isUsingANC,
    disableANC,
    enableANC,
    getLocalAudioTrack,
    onError,
    removeLocalAudioTrack,
  ]);

  return [isUsingANC, toggleANC, noiseCancellationKind] as const;
}
