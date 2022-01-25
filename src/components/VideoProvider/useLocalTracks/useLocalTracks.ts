import { DEFAULT_VIDEO_CONSTRAINTS, SELECTED_AUDIO_INPUT_KEY, SELECTED_VIDEO_INPUT_KEY } from '../../../constants';
import { getDeviceInfo, isPermissionDenied } from '../../../utils';
import { useCallback, useState } from 'react';
import { getANC } from '../../../anc/noiseCancellation';
import Video, {
  LocalVideoTrack,
  LocalAudioTrack,
  CreateLocalTrackOptions,
  CreateLocalTracksOptions,
} from 'twilio-video';

const noiseCancellation_activeInitially = false;

// updates audio track options depending on ANC setting.
function updateAudioOptions(options: CreateLocalTrackOptions, useANC: boolean) {
  options = {
    channelCount: { ideal: 1 },
    echoCancellation: { ideal: true },
    autoGainControl: { ideal: false },
    sampleRate: { ideal: 48000 },
    ...options,
    noiseSuppression: { ideal: !useANC },
  };
}

async function video_createLocalTracks(options: CreateLocalTracksOptions, useANC: boolean) {
  console.group('makarand: video_createLocalTracks');
  try {
    const anc = getANC();
    if (options.audio) {
      options.audio = typeof options.audio === 'object' ? options.audio : {};
      updateAudioOptions(options.audio, anc !== null && useANC);
    }

    console.log('makarand: createLocalTracks');
    const localTracks = await Video.createLocalTracks(options);
    console.log('makarand: createLocalTracks done');
    const localVideoTrack = localTracks.find(track => track.kind === 'video') as LocalVideoTrack;
    let localAudioTrack = localTracks.find(track => track.kind === 'audio') as LocalAudioTrack;
    if (localAudioTrack && useANC && anc !== null) {
      localAudioTrack = new LocalAudioTrack(anc.connect(localAudioTrack.mediaStreamTrack));
    }
    return { localVideoTrack, localAudioTrack };
  } catch (error) {
    console.warn('makarand: video_createLocalTracks failed:', error);
    throw error;
  } finally {
    console.log('makarand: video_createLocalTracks finally');
    console.groupEnd();
  }
}

async function video_createLocalAudioTrack(useANC: boolean, deviceId?: string) {
  const anc = getANC();

  const options: CreateLocalTrackOptions = {};
  if (deviceId) {
    options.deviceId = { exact: deviceId };
  }
  updateAudioOptions(options, useANC && anc !== null);

  const localAudioTrack = await Video.createLocalAudioTrack(options);

  if (useANC && anc !== null) {
    const cleanTrack = anc.connect(localAudioTrack.mediaStreamTrack);
    return new LocalAudioTrack(cleanTrack);
  } else {
    return localAudioTrack;
  }
}

export default function useLocalTracks() {
  const [audioTrack, setAudioTrack] = useState<LocalAudioTrack>();
  const [videoTrack, setVideoTrack] = useState<LocalVideoTrack>();
  const [isAcquiringLocalTracks, setIsAcquiringLocalTracks] = useState(false);
  const [isUsingANC, setIsUsingNoiseCancellation] = useState(noiseCancellation_activeInitially);

  const enableANC = useCallback(async () => {
    // const anc = await getANC();
    // console.log('enabling noise cancellation');
    // if (audioTrack) {
    //   // we must stop the existing audio track
    //   // and then
    //   console.log('enableANC stopping old track');
    //   audioTrack.stop();
    //   setAudioTrack(undefined);
    // }
    setIsUsingNoiseCancellation(true);
  }, []);

  const disableANC = useCallback(() => {
    // if (anc) {
    //   console.log('disabling noise cancellation');
    //   anc.disconnect();
    //   setIsUsingNoiseCancellation(false);
    // }
    setIsUsingNoiseCancellation(false);
  }, []);

  const getLocalAudioTrack = useCallback(
    (deviceId?: string) => {
      return video_createLocalAudioTrack(isUsingANC, deviceId).then(newTrack => {
        setAudioTrack(newTrack);
        return newTrack;
      });
    },
    [isUsingANC]
  );

  const getLocalVideoTrack = useCallback(async () => {
    const selectedVideoDeviceId = window.localStorage.getItem(SELECTED_VIDEO_INPUT_KEY);

    const { videoInputDevices } = await getDeviceInfo();

    const hasSelectedVideoDevice = videoInputDevices.some(
      device => selectedVideoDeviceId && device.deviceId === selectedVideoDeviceId
    );

    const options: CreateLocalTrackOptions = {
      ...(DEFAULT_VIDEO_CONSTRAINTS as {}),
      name: `camera-${Date.now()}`,
      ...(hasSelectedVideoDevice && { deviceId: { exact: selectedVideoDeviceId! } }),
    };

    return Video.createLocalVideoTrack(options).then(newTrack => {
      setVideoTrack(newTrack);
      return newTrack;
    });
  }, []);

  const removeLocalAudioTrack = useCallback(() => {
    if (audioTrack) {
      audioTrack.stop();
      setAudioTrack(undefined);
    }
  }, [audioTrack]);

  const removeLocalVideoTrack = useCallback(() => {
    if (videoTrack) {
      videoTrack.stop();
      setVideoTrack(undefined);
    }
  }, [videoTrack]);

  const getAudioAndVideoTracks = useCallback(async () => {
    const { audioInputDevices, videoInputDevices, hasAudioInputDevices, hasVideoInputDevices } = await getDeviceInfo();

    if (!hasAudioInputDevices && !hasVideoInputDevices) return Promise.resolve();
    if (isAcquiringLocalTracks || audioTrack || videoTrack) return Promise.resolve();

    setIsAcquiringLocalTracks(true);

    const selectedAudioDeviceId = window.localStorage.getItem(SELECTED_AUDIO_INPUT_KEY);
    const selectedVideoDeviceId = window.localStorage.getItem(SELECTED_VIDEO_INPUT_KEY);

    const hasSelectedAudioDevice = audioInputDevices.some(
      device => selectedAudioDeviceId && device.deviceId === selectedAudioDeviceId
    );
    const hasSelectedVideoDevice = videoInputDevices.some(
      device => selectedVideoDeviceId && device.deviceId === selectedVideoDeviceId
    );

    // In Chrome, it is possible to deny permissions to only audio or only video.
    // If that has happened, then we don't want to attempt to acquire the device.
    const isCameraPermissionDenied = await isPermissionDenied('camera');
    const isMicrophonePermissionDenied = await isPermissionDenied('microphone');

    const shouldAcquireVideo = hasVideoInputDevices && !isCameraPermissionDenied;
    const shouldAcquireAudio = hasAudioInputDevices && !isMicrophonePermissionDenied;

    const localTrackConstraints = {
      video: shouldAcquireVideo && {
        ...(DEFAULT_VIDEO_CONSTRAINTS as {}),
        name: `camera-${Date.now()}`,
        ...(hasSelectedVideoDevice && { deviceId: { exact: selectedVideoDeviceId! } }),
      },
      audio:
        shouldAcquireAudio &&
        (hasSelectedAudioDevice ? { deviceId: { exact: selectedAudioDeviceId! } } : hasAudioInputDevices),
    };

    return video_createLocalTracks(localTrackConstraints, isUsingANC)
      .then(({ localVideoTrack, localAudioTrack }) => {
        if (localVideoTrack) {
          setVideoTrack(localVideoTrack);
          // Save the deviceId so it can be picked up by the VideoInputList component. This only matters
          // in cases where the user's video is disabled.
          window.localStorage.setItem(
            SELECTED_VIDEO_INPUT_KEY,
            localVideoTrack.mediaStreamTrack.getSettings().deviceId ?? ''
          );
        }

        if (localAudioTrack) {
          setAudioTrack(localAudioTrack);
        }

        // These custom errors will be picked up by the MediaErrorSnackbar component.
        if (isCameraPermissionDenied && isMicrophonePermissionDenied) {
          const error = new Error();
          error.name = 'NotAllowedError';
          throw error;
        }

        if (isCameraPermissionDenied) {
          throw new Error('CameraPermissionsDenied');
        }

        if (isMicrophonePermissionDenied) {
          throw new Error('MicrophonePermissionsDenied');
        }
      })
      .catch(error => {
        console.log('makarand: video_createLocalTracks Error:', error);
        throw error;
      })
      .finally(() => setIsAcquiringLocalTracks(false));
  }, [audioTrack, videoTrack, isAcquiringLocalTracks, isUsingANC]);

  const localTracks = [audioTrack, videoTrack].filter(track => track !== undefined) as (
    | LocalAudioTrack
    | LocalVideoTrack
  )[];

  return {
    localTracks,
    disableANC,
    enableANC,
    isUsingANC,
    getLocalVideoTrack,
    getLocalAudioTrack,
    isAcquiringLocalTracks,
    removeLocalAudioTrack,
    removeLocalVideoTrack,
    getAudioAndVideoTracks,
  };
}
