const NativeAudioContext =
    typeof window.AudioContext !== "undefined"
        ? window.AudioContext
        : typeof window.webkitAudioContext !== "undefined"
            ? window.webkitAudioContext
            : null;

const errors = Object.freeze({
    not_init: "Not initialized, first run Krisp.init()",
    no_stream: "No stream, run Krisp.getStream(stream)",
    no_support: "Platform not supported",
    already_init: "Krisp already initialized, first call krisp.destroy()",
    invalid_stream: "Invalid MediaStream",
    invalid_state: "Invalid state",
    not_connected: "Krisp is not connected to any valid stream, please call Krisp.connect(stream) first"
});

const states = Object.freeze({
    initialized: "initialized",
    not_initialized: "not_initialized",
    connected: "connected",
    disconnected: "disconnected",
    enabled: "enabled",
    disabled: "disabled",
});

class KrispFilter extends AudioWorkletNode {
    enable() {
        this.parameters.get("enabled").value = 1;
    }

    disable() {
        this.parameters.get("enabled").value = 0;
    }

    kill() {
        this.port.postMessage({type: "destroy"});
    }

    setLogging(enabled) {
        data.filter.port.postMessage({type: "logging", enabled})
    }
}

const modelTypes = Object.freeze({
    model_8: "model8",
    model_16: "model16",
    model_32: "model32",
    model_vad: "modelVad",
});

const utils = Object.freeze({
    getProcessor() {
        // return "./../wasm/debug/krisp.processor.js";
        return "/krisp/wasm/debug/krisp.processor.js";
    },

    getNodeName() {
        return "krisp-processor";
    },

    getUrlForType(modelType) {
        const url = "https://cdn.krisp.ai/scripts/ext/models";

        switch (modelType) {
            case modelTypes.model_8:
                return `${url}/small_8k.thw`;
            case modelTypes.model_16:
                return `${url}/small_16k.thw`;
            case modelTypes.model_32:
                return `${url}/nc_weight.thw`;
            case modelTypes.model_vad:
                return `${url}/vad.thw`;
            default:
                throw new Error(errors.invalid_state);
        }
    },

    async getModelData(modelType) {
        return await utils.loadModelData(utils.getUrlForType(modelType));
    },

    loadModelData(model) {
        return new Promise((resolve, reject) => {
            const api = new XMLHttpRequest();
            api.onload = (res) => {
                res ? resolve(res.target.response) : reject();
            };
            api.responseType = "arraybuffer";
            api.open("GET", model, true);
            api.send();
        });
    },
});

const filterFactory = Object.freeze({
    async create(audioContext, modelType) {
        console.log('makarand: filterFactory.create 1');
        if (!NativeAudioContext) {
            throw new Error(errors.no_support);
        }

        if (!(audioContext instanceof NativeAudioContext)) {
            throw new Error(errors.invalid_state);
        }

        const nodeName = utils.getNodeName();
        const script = utils.getProcessor();
        console.log('makarand: filterFactory.create 2');
        const data = await utils.getModelData(modelType);
        console.log('makarand: filterFactory.create 3');
        await audioContext.audioWorklet.addModule(script);
        console.log('makarand: filterFactory.create 4');
        const filter = new KrispFilter(audioContext, nodeName);
        console.log('makarand: filterFactory.create 5');
        filter.port.postMessage({
            isVad: modelType === modelTypes.model_vad,
            type: "init",
            data: data,
            sampleRate: audioContext.sampleRate,
        });
        return filter;
    },
});

const data = {
    state: states.not_initialized,
    context: null,
    filter: null,
    contextWasProvided: false,
    sources: [],
    outputs: [],
    streams: [],

    reset() {
        this.state = states.not_initialized;
        this.context = null;
        this.filter = null;
        this.contextWasProvided = false;
        this.sources = [];
        this.outputs = [];
        this.streams = [];
    },
};


const Krisp = {
    FilterFactory: Object.freeze({
        async create(audioContext, isVad) {
            const modelType = isVad
                ? modelTypes.model_vad
                : data.context.sampleRate <= 8000
                ? modelTypes.model_8
                : data.context.sampleRate <= 16000
                ? modelTypes.model_16
                : modelTypes.model_32;
            return await filterFactory.create(audioContext, modelType);
        }
    }),

    async init(isVad, audioContext) {
        console.log('makarand: krisp.init 1');
        if (Krisp.isInitialized()) {
            throw new Error(errors.already_init);
        }
        console.log('makarand: krisp.init 2');

        if (!NativeAudioContext) {
            throw new Error(errors.no_support);
        }

        console.log('makarand: krisp.init 3');
        data.contextWasProvided = audioContext instanceof NativeAudioContext;

        data.context = data.contextWasProvided
            ? audioContext
            : new NativeAudioContext();

            console.log('makarand: krisp.init 4');

        data.filter = await this.FilterFactory.create(data.context, isVad);
        console.log('makarand: krisp.init 5');
        data.state = states.initialized;
    },

    connect(stream) {
        if (Krisp.isConnected()) {
            return;
        }

        if (!Krisp.isInitialized()) {
            throw new Error(errors.not_init);
        }

        if (!data.filter || !data.context) {
            throw new Error(errors.invalid_state);
        }

        if (!(stream instanceof MediaStream)) {
            throw new Error(errors.invalid_stream);
        }

        const cleanStream = new MediaStream();

        stream.getAudioTracks().forEach((track) => {
            const trackStream = new MediaStream([track]);
            const source = data.context.createMediaStreamSource(trackStream);
            const output = data.context.createMediaStreamDestination();
            source.connect(data.filter);
            data.filter.connect(output);
            track = output.stream.getAudioTracks()[0];
            cleanStream.addTrack(track);
            data.sources.push(source);
            data.outputs.push(output);
            data.streams.push(trackStream);
        });
        stream.getVideoTracks().forEach((t) => cleanStream.addTrack(t));

        data.state = states.connected;

        return cleanStream;
    },

    enable() {
        if (Krisp.isEnabled()) {
            return;
        }

        if (!Krisp.isConnected()) {
            throw new Error(errors.not_connected);
        }

        if (!data.filter || !data.context) {
            throw new Error(errors.invalid_state);
        }

        data.filter.enable();

        data.state = states.enabled;
    },

    disable() {
        if (Krisp.isDisabled()) {
            return;
        }

        if (!Krisp.isConnected()) {
            throw new Error(errors.not_connected);
        }

        if (!data.filter || !data.context) {
            throw new Error(errors.invalid_state);
        }

        data.filter.disable();

        data.state = states.disabled;
    },

    disconnect() {
        if (Krisp.isDisconnected()) {
            return;
        }

        if (Krisp.isEnabled()) {
            Krisp.disable();
        }

        if (!data.filter || !data.context) {
            throw new Error(errors.invalid_state);
        }

        data.filter.disconnect();

        data.sources.forEach((source) => source.disconnect());
        data.outputs.forEach((output) => output.disconnect());
        data.streams.forEach((stream) =>
            stream.getTracks().forEach((track) => track.stop())
        );

        data.sources = [];
        data.outputs = [];
        data.streams = [];

        data.state = states.disconnected;
    },

    async destroy() {
        if (!Krisp.isInitialized()) {
            return;
        }

        if (Krisp.isEnabled()) {
            Krisp.disable();
        }

        if (Krisp.isConnected()) {
            Krisp.disconnect();
        }

        if (data.filter) {
            data.filter.port.postMessage({type: "destroy"});
            data.filter = null;
        }

        if (data.context) {
            if (!data.contextWasProvided) await data.context.close();
            data.context = null;
        }

        data.state = states.not_initialized;

        data.reset();
    },

    setLogging(enabled) {
        if (!Krisp.isInitialized()) {
            return;
        }

        if (data.filter) {
            data.filter.setLogging(enabled);
        }
    },

    setVADCallback(callback)
    {
        if(!(callback instanceof Function))
        {
            return;
        }

        data.filter.port.onmessage = ({data}) =>{
            callback(data.vadResult);
        };
    },

    getContext() {
        return data.context;
    },

    getFilter() {
        return data.filter;
    },

    getState() {
        return data.state;
    },

    isConnected() {
        return [states.connected, states.enabled, states.disabled].includes(
            data.state
        );
    },

    isInitialized() {
        return data.state !== states.not_initialized;
    },

    isDisabled() {
        return [
            states.disabled,
            states.disconnected,
            states.not_initialized,
        ].includes(data.state);
    },

    isEnabled() {
        return data.state === states.enabled;
    },

    isDisconnected() {
        return [states.disconnected, states.not_initialized].includes(data.state);
    },

};

export default Krisp;
