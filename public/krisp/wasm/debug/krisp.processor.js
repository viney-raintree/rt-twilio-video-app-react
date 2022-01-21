/** ***********************************************************************
 *
 * KRISP TECHNOLOGIES, INC
 * __________________
 *
 * [2018] - [2020] Krisp Technologies, Inc
 * All Rights Reserved.
 *
 * NOTICE: By accessing this programming code, you acknowledge that you have read, understood, and agreed to the User Agreement available at
 *  https://krisp.ai/terms-of-use.

 * Please note that ALL information contained herein is and remains the property of Krisp Technologies, Inc., and its affiliates or assigns, if any. The intellectual property
 * contained herein is proprietary to Krisp Technologies, Inc. and may be covered by pending and granted U.S. and Foreign Patents, and is further protected by
 * copyright, trademark and/or other forms of intellectual property protection.

 * Dissemination of this information or reproduction of this material IS STRICTLY FORBIDDEN.

 *************************************************************************/

import Module from "./dsp.wasmmodule.js";
import {
  RENDER_QUANTUM_FRAMES,
  MAX_CHANNEL_COUNT,
  HeapAudioBuffer,
} from "./wasm-audio-helper.js";

/**
 * A simple demonstration of WASM-powered AudioWorkletProcessor.
 *
 * @class WASMWorkletProcessor
 * @extends AudioWorkletProcessor
 */
class WASMWorkletProcessor extends AudioWorkletProcessor {
  #weightsPtr;
  #modelInit = false;
  #keepAlive = true;
  #heapInputBuffer;
  #heapOutputBuffer;
  #kernel;
  #isVad;
  static get parameterDescriptors() {
    return [
      {
        name: "enabled",
        defaultValue: 0,
        minValue: 0,
        maxValue: 1,
        automationRate: "a-rate",
      },
    ];
  }

  /**
   * @constructor
   */
  constructor() {
    super();

    this.port.onmessage = ({ data }) => {
      switch (data.type) {
        case "init":
          this.init(data.isVad, data.data, data.sampleRate);
          break;
        case "destroy":
          this.destroy();
          break;
        case "logging":
          this.setLogging(data.enabled);
          break;
      }
    };
  }

  init(isVad, data, rate) {
    // Allocate the buffer for the heap access. Start with stereo, but it can
    // be expanded up to 32 channels.
    this.#heapInputBuffer = new HeapAudioBuffer(
        Module,
        RENDER_QUANTUM_FRAMES,
        2,
        MAX_CHANNEL_COUNT
    );
    this.#heapOutputBuffer = new HeapAudioBuffer(
        Module,
        RENDER_QUANTUM_FRAMES,
        2,
        MAX_CHANNEL_COUNT
    );

    this.#isVad = isVad;
    this.#kernel = isVad
        ? new Module.KrispProcessor(Module.Type.VAD)
        : new Module.KrispProcessor(Module.Type.NC);

    const weights = new Uint8Array(data);
    this.#weightsPtr = Module._malloc(weights.byteLength);

    const weightsArray = Module.HEAPU8.subarray(
        this.#weightsPtr,
        this.#weightsPtr + weights.byteLength
    );
    weightsArray.set(weights);

    this.#kernel.init_weights(this.#weightsPtr, weights.byteLength);
    this.#kernel.open_session(rate);
    this.#modelInit = true;
    this.#keepAlive = true;
  }

  destroy() {
    this.#heapInputBuffer.free();
    this.#heapOutputBuffer.free();
    this.#kernel.close_session();
    this.#kernel.destroy();
    this.#kernel.delete();
    Module._free(this.#weightsPtr);
    this.#modelInit = false;
    this.#keepAlive = false;
  }

  setLogging(enabled) {
    if(!this.#modelInit || !this.#kernel) {
      return;
    }

    this.#kernel.set_logging(enabled);
  }

  processDisabled(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    for (let channel = 0; channel < output.length; ++channel) {
      if (input[channel]) output[channel].set(input[channel]);
    }
    return this.#keepAlive;
  }

  /**
   * System-invoked process callback function.
   * @param  {Array} inputs Incoming audio stream.
   * @param  {Array} outputs Outgoing audio stream.
   * @param  {Object} parameters AudioParam data.
   * @return {Boolean} Active source flag.
   */
  process(inputs, outputs, parameters) {
    if (parameters.enabled == 0 || !this.#modelInit) {
      return this.processDisabled(inputs, outputs, parameters);
    }

    // Use the 1st input and output only to make the example simpler. |input|
    // and |output| here have the similar structure with the AudioBuffer
    // interface. (i.e. An array of Float32Array)
    const input = inputs[0];
    const output = outputs[0];
    //const output_vad = outputs[1];

    // For this given render quantum, the channel count of the node is fixed
    // and identical for the input and the output.
    const channelCount = input.length;

    // Prepare HeapAudioBuffer for the channel count change in the current
    // render quantum.
    this.#heapInputBuffer.adaptChannel(channelCount);
    this.#heapOutputBuffer.adaptChannel(channelCount);

    // Copy-in, process and copy-out.
    for (let channel = 0; channel < channelCount; ++channel) {
      this.#heapInputBuffer.getChannelData(channel).set(input[channel]);
    }
    this.#kernel.process(
        this.#heapInputBuffer.getHeapAddress(),
        this.#heapOutputBuffer.getHeapAddress(),
        channelCount
    );

    if(!this.#isVad)
    {
      for (let channel = 0; channel < channelCount; ++channel) {
        output[channel].set(this.#heapOutputBuffer.getChannelData(channel));
      }
    } else {
      this.port.postMessage({vadResult: this.#heapOutputBuffer.getChannelData(0)[0]});
    }

    
    return this.#keepAlive;
  }
}

registerProcessor("krisp-processor", WASMWorkletProcessor);
