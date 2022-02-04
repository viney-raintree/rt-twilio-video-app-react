import { RNNoiseNode } from './rnnoise/rnnoisenode';
import { makeKrisp } from './krisp/krisp_wrapper.js';

export interface NoiseCancellation {
  isActive: () => boolean; // is noise cancellation currently active?
  disconnect: () => void;
  connect: (track: MediaStreamTrack) => MediaStreamTrack;
  kind: () => string;
}

const urlParams = new URLSearchParams(window.location.search);
const ancOption = (urlParams.get('anc') || 'krisp').toLowerCase();

let anc: NoiseCancellation | null = null;
export async function initANC(): Promise<NoiseCancellation> {
  if (!anc) {
    if (ancOption === 'krisp') {
      anc = await initKrisp();
    } else {
      anc = await initRNNoise();
    }
  }
  return anc;
}

async function initRNNoise() {
  const audio_context = new AudioContext({ sampleRate: 48000 });
  await RNNoiseNode.register(audio_context);

  let data: {
    stream: MediaStream;
    sourceNode: MediaStreamAudioSourceNode;
    rnnoiseNode: RNNoiseNode;
    destinationNode: MediaStreamAudioDestinationNode;
  } | null = null;

  return {
    connect: (track: MediaStreamTrack) => {
      if (data) {
        throw new Error('already connected');
      }

      const stream = new MediaStream([track]);
      const sourceNode = audio_context.createMediaStreamSource(stream);
      const rnnoiseNode = new RNNoiseNode(audio_context);
      const destinationNode = audio_context.createMediaStreamDestination();

      sourceNode.connect(rnnoiseNode);
      rnnoiseNode.connect(destinationNode);

      const mediaStream = destinationNode.stream;
      if (!mediaStream) {
        throw new Error('Error connecting to Krisp');
      }
      const cleanTrack = mediaStream.getAudioTracks()[0];
      if (!cleanTrack) {
        throw new Error('Error getting clean track from RNNoise');
      }

      rnnoiseNode.update(true);
      data = { sourceNode, rnnoiseNode, destinationNode, stream };
      console.log(data);
      return cleanTrack;
    },
    disconnect: () => {
      if (!data) {
        throw new Error('not connected');
      }
      data.rnnoiseNode.update(false);
      data.rnnoiseNode.disconnect();
      data.sourceNode.disconnect();
      data.destinationNode.disconnect();
      data.stream.getTracks().forEach(track => track.stop());
      data = null;
    },
    isActive: () => {
      return data !== null && data.rnnoiseNode.getIsActive();
    },
    kind: () => 'rnnoise',
  };
}

export function getANC(): NoiseCancellation | null {
  return anc;
}

// must call this function on user action.
// krisp create audio context which fails if not called
// on user action.
async function initKrisp() {
  try {
    const Krisp = await makeKrisp();
    await Krisp.init(false /* isVad */);
    // @ts-ignore
    window.Krisp = Krisp;
    console.log('makarand: initKrisp done');
    Krisp.setLogging(true);
    return {
      connect: (track: MediaStreamTrack) => {
        console.log('makarand: initKrisp.connect 1');
        const mediaStream = Krisp.connect(new MediaStream([track]));
        if (!mediaStream) {
          throw new Error('Error connecting to Krisp');
        }
        const cleanTrack = mediaStream.getAudioTracks()[0];
        if (!cleanTrack) {
          throw new Error('Error getting clean track from Krisp');
        }
        console.log('makarand: initKrisp.connect 2');
        Krisp.enable();
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
  } catch (error) {
    console.warn('Krisp.init failed:', error);
    throw error;
  }
}
