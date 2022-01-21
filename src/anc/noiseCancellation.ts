import { RNNoiseNode } from './rnnoise/rnnoisenode';
import { makeKrisp } from './krisp/krisp_wrapper.js';

export interface NoiseCancellation2 {
  isActive: () => boolean; // is noise cancellation currently active?
  disconnect: () => void;
  connect: (track: MediaStreamTrack) => MediaStreamTrack;
  kind: () => string;
}

export interface NoiseCancellation {
  isActive: () => boolean; // is noise cancellation currently active?
  turnOn: () => void;
  turnOff: () => void;
  kind: () => string;
}

export interface NoiseCancellationWithTrack {
  track: MediaStreamTrack;
  noiseCancellation: NoiseCancellation | null;
}

const urlParams = new URLSearchParams(window.location.search);
const ancOption = (urlParams.get('anc') || 'krisp').toLowerCase();

let anc: NoiseCancellation2 | null = null;
export async function initANC(): Promise<NoiseCancellation2> {
  if (!anc) {
    anc = await initKrisp();
  }
  return anc;
}

async function initKrisp() {
  // const KrispModule = makeKrisp();
  const Krisp = await makeKrisp();
  await Krisp.init(false /* isVad */);

  return {
    connect: (track: MediaStreamTrack) => {
      const mediaStream = Krisp.connect(new MediaStream([track]));
      if (!mediaStream) {
        throw new Error('Error connecting to Krisp');
      }
      const cleanTrack = mediaStream.getAudioTracks()[0];
      if (!cleanTrack) {
        throw new Error('Error getting clean track from Krisp');
      }
      return cleanTrack;
    },
    disconnect: () => {
      Krisp.disconnect();
    },
    isActive: () => {
      return Krisp.isEnabled();
    },
    kind: () => 'krisp',
  };
}

export async function removeNoiseFromMSTrack(msTrack: MediaStreamTrack): Promise<NoiseCancellationWithTrack> {
  if (ancOption === 'rnnoise') {
    console.warn('!*** Using rnnoise *** !');
    const noiseCancellationAndTrack = await rnnNoise_removeNoiseFromTrack(msTrack);
    return noiseCancellationAndTrack;
  } else if (ancOption === 'krisp') {
    throw new Error('Krisp old version not implemented');
  } else {
    console.warn('!*** Not using rnnoise *** !');
    return {
      track: msTrack,
      noiseCancellation: null,
    };
  }
}

export async function rnnNoise_removeNoiseFromTrack(track: MediaStreamTrack): Promise<NoiseCancellationWithTrack> {
  const audio_context = new AudioContext({ sampleRate: 48000 });
  await RNNoiseNode.register(audio_context);
  const stream = new MediaStream([track]);

  const sourceNode = audio_context.createMediaStreamSource(stream);
  const rnnoiseNode = new RNNoiseNode(audio_context);
  const destinationNode = audio_context.createMediaStreamDestination();

  sourceNode.connect(rnnoiseNode);
  rnnoiseNode.connect(destinationNode);

  const outputStream = destinationNode.stream;
  return {
    noiseCancellation: {
      isActive: () => rnnoiseNode && rnnoiseNode.getIsActive(),
      turnOn: () => rnnoiseNode && rnnoiseNode.update(true),
      turnOff: () => rnnoiseNode && rnnoiseNode.update(false),
      kind: () => 'rnNoise',
    },
    track: outputStream.getTracks()[0],
  };
}
