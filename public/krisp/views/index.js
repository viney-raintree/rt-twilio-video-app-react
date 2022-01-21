import Krisp from "./../krispsdk.mjs";

class NCContainer {
    #container;
    #startButton;
    #callButton;
    #hangupButton;
    #stopButton;
    #toggleButton;

    #localVideo;
    #remoteVideo;

    #localStream;
    #pc1;
    #pc2;
    #offerOptions = {
        offerToReceiveAudio: 1,
        offerToReceiveVideo: 1,
    };

    #startTime;

    constructor() {
        this.#container = document.getElementById("nc_container");
        this.#startButton = document.getElementById("startButton");
        this.#callButton = document.getElementById("callButton");
        this.#hangupButton = document.getElementById("hangupButton");
        this.#stopButton = document.getElementById("stopButton");
        this.#toggleButton = document.getElementById("krispToggle");

        this.#localVideo = document.getElementById("localVideo");
        this.#remoteVideo = document.getElementById("remoteVideo");

        this.#callButton.disabled = true;
        this.#hangupButton.disabled = true;
        this.#stopButton.disabled = true;
        this.#toggleButton.disabled = true;
        this.#startButton.addEventListener("click", () => this.start());
        this.#callButton.addEventListener("click", () => this.call());
        this.#hangupButton.addEventListener("click", () => this.hangup());
        this.#stopButton.addEventListener("click", () => this.stop());
        this.#toggleButton.addEventListener("click", () => this.toggle());

        this.#localVideo.addEventListener("loadedmetadata", function () {
            console.log(
                `Local video videoWidth: ${this.videoWidth}px,  videoHeight: ${this.videoHeight}px`
            );
        });

        this.#remoteVideo.addEventListener("loadedmetadata", function () {
            console.log(
                `Remote video videoWidth: ${this.videoWidth}px,  videoHeight: ${this.videoHeight}px`
            );
        });

        this.#remoteVideo.addEventListener("resize", () => {
            console.log(
                `Remote video size changed to ${this.#remoteVideo.videoWidth}x${
                    this.#remoteVideo.videoHeight
                } - Time since pageload ${performance.now().toFixed(0)}ms`
            );
            // We'll use the first onsize callback as an indication that video has started
            // playing out.
            if (this.#startTime) {
                const elapsedTime = window.performance.now() - this.#startTime;
                console.log("Setup time: " + elapsedTime.toFixed(3) + "ms");
                this.#startTime = null;
            }
        });
    }

    getName(pc) {
        return pc === this.#pc1 ? "pc1" : "pc2";
    }

    getOtherPc(pc) {
        return pc === this.#pc1 ? this.#pc2 : this.#pc1;
    }

    async start() {
        console.log("Requesting local stream");
        this.#startButton.disabled = true;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true,
            });
            console.log("Received local stream");

            await Krisp.init(false);

            // Assigning cleaned stream to the video
            this.#localVideo.srcObject = stream;
            this.#localStream = stream;
            this.#callButton.disabled = false;
            this.#stopButton.disabled = false;
        } catch (e) {
            alert(`getUserMedia() error: ${e.name}`);
            console.error(e.message);
        }
    }

    async call() {
        const cleanStream = await Krisp.connect(this.#localStream);
        this.#localVideo.srcObject = cleanStream;
        this.#localStream = cleanStream;
        this.#callButton.disabled = true;
        this.#hangupButton.disabled = false;
        this.#stopButton.disabled = true;
        this.#toggleButton.disabled = false;
        console.log("Starting call");
        this.#startTime = window.performance.now();
        const videoTracks = this.#localStream.getVideoTracks();
        const audioTracks = this.#localStream.getAudioTracks();
        if (videoTracks.length > 0) {
            console.log(`Using video device: ${videoTracks[0].label}`);
        }
        if (audioTracks.length > 0) {
            console.log(`Using audio device: ${audioTracks[0].label}`);
        }
        const configuration = {};
        console.log("RTCPeerConnection configuration:", configuration);
        this.#pc1 = new RTCPeerConnection(configuration);
        console.log("Created local peer connection object pc1");
        this.#pc1.addEventListener("icecandidate", (e) =>
            this.onIceCandidate(this.#pc1, e)
        );
        this.#pc2 = new RTCPeerConnection(configuration);
        console.log("Created remote peer connection object pc2");
        this.#pc2.addEventListener("icecandidate", (e) =>
            this.onIceCandidate(this.#pc2, e)
        );
        this.#pc1.addEventListener("iceconnectionstatechange", (e) =>
            this.onIceStateChange(this.#pc1, e)
        );
        this.#pc2.addEventListener("iceconnectionstatechange", (e) =>
            this.onIceStateChange(this.#pc2, e)
        );
        this.#pc2.addEventListener("track", (e) => this.gotRemoteStream(e));

        this.#localStream
            .getTracks()
            .forEach((track) => this.#pc1.addTrack(track, this.#localStream));
        console.log("Added local stream to pc1");

        try {
            console.log("pc1 createOffer start");
            const offer = await this.#pc1.createOffer(this.#offerOptions);
            await this.onCreateOfferSuccess(offer);
        } catch (e) {
            this.onCreateSessionDescriptionError(e);
        }
    }

    async stop() {
        const localStream = this.#localVideo.srcObject;
        const remoteStream = this.#remoteVideo.srcObject;

        if (this.#localStream) {
            this.#localStream.getTracks().forEach((track) => {
                track.stop();
            });
        }

        if (localStream) {
            localStream.getTracks().forEach((track) => {
                track.stop();
            });
        }

        if (remoteStream) {
            remoteStream.getTracks().forEach((track) => {
                track.stop();
            });
        }

        await Krisp.destroy();

        this.#localStream = null;
        this.#startButton.disabled = false;
        this.#callButton.disabled = true;
        this.#stopButton.disabled = true;
        this.#toggleButton.disabled = true;
        this.#hangupButton.disabled = true;
    }

    onCreateSessionDescriptionError(error) {
        console.log(`Failed to create session description: ${error.toString()}`);
    }

    async onCreateOfferSuccess(desc) {
        console.log(`Offer from pc1\n${desc.sdp}`);
        console.log("pc1 setLocalDescription start");
        try {
            await this.#pc1.setLocalDescription(desc);
            this.onSetLocalSuccess(this.#pc1);
        } catch (e) {
            this.onSetSessionDescriptionError(e);
        }

        console.log("pc2 setRemoteDescription start");
        try {
            await this.#pc2.setRemoteDescription(desc);
            this.onSetRemoteSuccess(this.#pc2);
        } catch (e) {
            this.onSetSessionDescriptionError(e);
        }

        console.log("pc2 createAnswer start");
        // Since the 'remote' side has no media stream we need
        // to pass in the right constraints in order for it to
        // accept the incoming offer of audio and video.
        try {
            const answer = await this.#pc2.createAnswer();
            await this.onCreateAnswerSuccess(answer);
        } catch (e) {
            this.onCreateSessionDescriptionError(e);
        }
    }

    onSetLocalSuccess(pc) {
        console.log(`${this.getName(pc)} setLocalDescription complete`);
    }

    onSetRemoteSuccess(pc) {
        console.log(`${this.getName(pc)} setRemoteDescription complete`);
    }

    onSetSessionDescriptionError(error) {
        console.log(`Failed to set session description: ${error.toString()}`);
    }

    gotRemoteStream(e) {
        if (this.#remoteVideo.srcObject !== e.streams[0]) {
            this.#remoteVideo.srcObject = e.streams[0];
            console.log("pc2 received remote stream");
        }
    }

    async onCreateAnswerSuccess(desc) {
        console.log(`Answer from pc2:\n${desc.sdp}`);
        console.log("pc2 setLocalDescription start");
        try {
            await this.#pc2.setLocalDescription(desc);
            this.onSetLocalSuccess(this.#pc2);
        } catch (e) {
            this.onSetSessionDescriptionError(e);
        }
        console.log("pc1 setRemoteDescription start");
        try {
            await this.#pc1.setRemoteDescription(desc);
            this.onSetRemoteSuccess(this.#pc1);
        } catch (e) {
            this.onSetSessionDescriptionError(e);
        }
    }

    async onIceCandidate(pc, event) {
        try {
            await this.getOtherPc(pc).addIceCandidate(event.candidate);
            this.onAddIceCandidateSuccess(pc);
        } catch (e) {
            this.onAddIceCandidateError(pc, e);
        }
        console.log(
            `${this.getName(pc)} ICE candidate:\n${
                event.candidate ? event.candidate.candidate : "(null)"
            }`
        );
    }

    onAddIceCandidateSuccess(pc) {
        console.log(`${this.getName(pc)} addIceCandidate success`);
    }

    onAddIceCandidateError(pc, error) {
        console.log(
            `${this.getName(pc)} failed to add ICE Candidate: ${error.toString()}`
        );
    }

    onIceStateChange(pc, event) {
        if (pc) {
            console.log(`${this.getName(pc)} ICE state: ${pc.iceConnectionState}`);
            console.log("ICE state change event: ", event);
        }
    }

    hangup() {
        console.log("Ending call");
        if (this.#pc1) this.#pc1.close();
        if (this.#pc2) this.#pc2.close();
        this.#pc1 = null;
        this.#pc2 = null;
        this.#hangupButton.disabled = true;
        this.#callButton.disabled = false;
        this.#stopButton.disabled = false;
        this.#toggleButton.disabled = true;

        this.#toggleButton.innerText = "Toggle Krisp";
        Krisp.disconnect();
    }

    toggle() {
        if (Krisp.isEnabled()) {
            Krisp.disable();
            this.#toggleButton.innerText = "Toggle Krisp ✘";
        } else {
            Krisp.enable();
            this.#toggleButton.innerText = "Toggle Krisp ✓";
        }
    }

    show(bool) {
        this.#container.style.display = bool ? "block" : "none";
    }
}

class VADContainer {
    #container;
    #startButton;
    #stopButton;


    constructor() {
        this.#container = document.getElementById("vad_container");
        this.#startButton = document.getElementById("startButtonVAD");
        this.#stopButton = document.getElementById("stopButtonVAD");

        this.#startButton.addEventListener("click", () => this.start());
        this.#stopButton.addEventListener("click", () => this.stop());

        this.#stopButton.disabled = true;
    }

    async start() {
        await Krisp.init(true);
        this.#stopButton.disabled = false;
        this.#startButton.disabled = true;


        try {
            let stream = await navigator.mediaDevices.getUserMedia({audio:true});
            stream = Krisp.connect(stream);
            Krisp.enable();

            Krisp.setVADCallback((result)=>{
                console.log(result);
            });
            

        } catch (e) {
            console.error(e.message);
        }
    }


    async stop() {
        await Krisp.destroy();
        this.#stopButton.disabled = true;
        this.#startButton.disabled = false;
    }

    show(bool) {
        this.#container.style.display = bool ? "block" : "none";
    }
}

const ncContainer = new NCContainer();
const vadContainer = new VADContainer();

vadContainer.show(false);

const modelsFilter = document.getElementById("models");
modelsFilter.addEventListener("change", () => {
    const chosenModel = modelsFilter.value;
    if (chosenModel === "NC") {
        vadContainer.stop();
        vadContainer.show(false);
        ncContainer.show(true);
    }
    if (chosenModel === "VAD") {
        ncContainer.hangup();
        ncContainer.stop();
        ncContainer.show(false);
        vadContainer.show(true);
    }
});
