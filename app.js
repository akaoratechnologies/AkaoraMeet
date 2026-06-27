const $ = (id) => document.getElementById(id);

const ui = {
  views: {
    home: $("homeView"),
    create: $("createView"),
    join: $("joinView"),
    meeting: $("meetingView"),
  },
  appStatus: $("appStatus"),
  openCreateBtn: $("openCreateBtn"),
  openJoinBtn: $("openJoinBtn"),
  createNameInput: $("createNameInput"),
  createNowBtn: $("createNowBtn"),
  generatedRoomCode: $("generatedRoomCode"),
  regenerateCodeBtn: $("regenerateCodeBtn"),
  createMicToggle: $("createMicToggle"),
  createCameraToggle: $("createCameraToggle"),
  joinNameInput: $("joinNameInput"),
  roomCodeInput: $("roomCodeInput"),
  joinNowBtn: $("joinNowBtn"),
  invalidRoomAlert: $("invalidRoomAlert"),
  joinMicToggle: $("joinMicToggle"),
  joinCameraToggle: $("joinCameraToggle"),
  activeRoomCode: $("activeRoomCode"),
  copyCodeBtn: $("copyCodeBtn"),
  copyInviteBtn: $("copyInviteBtn"),
  localVideo: $("localVideo"),
  remoteVideo: $("remoteVideo"),
  localPlaceholder: $("localPlaceholder"),
  remotePlaceholder: $("remotePlaceholder"),
  localInitial: $("localInitial"),
  localLabel: $("localLabel"),
  remoteLabel: $("remoteLabel"),
  localMediaState: $("localMediaState"),
  micBtn: $("micBtn"),
  cameraBtn: $("cameraBtn"),
  screenBtn: $("screenBtn"),
  chatToggleBtn: $("chatToggleBtn"),
  closeChatBtn: $("closeChatBtn"),
  chatDrawer: $("chatDrawer"),
  chatMessages: $("chatMessages"),
  emojiBtn: $("emojiBtn"),
  emojiRow: $("emojiRow"),
  chatInput: $("chatInput"),
  sendChatBtn: $("sendChatBtn"),
  hangupBtn: $("hangupBtn"),
  toast: $("toast"),
};

const state = {
  firebaseApp: null,
  db: null,
  peerId: makeId(14),
  roomId: null,
  role: null,
  displayName: "Guest",
  roomRef: null,
  pc: null,
  localStream: new MediaStream(),
  remoteStream: new MediaStream(),
  currentVideoTrack: null,
  currentAudioTrack: null,
  localScreenTrack: null,
  queuedCandidates: [],
  listeners: [],
  chatKeys: new Set(),
  generatedCode: "",
};

const rtcConfig = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
    // Add TURN here for stronger real-world connection success:
    // { urls: "turn:YOUR_TURN_SERVER:3478", username: "USERNAME", credential: "PASSWORD" }
  ],
};

boot();

function boot() {
  bindEvents();
  createFreshCode();

  try {
    if (!window.firebase) {
      setAppStatus("Firebase SDK not loaded", "error");
      toast("Firebase SDK could not load. Check internet connection.", "error");
      return;
    }

    const config = window.AKAORA_FIREBASE_CONFIG;
    if (!config || !config.apiKey || !config.databaseURL) {
      setAppStatus("Firebase config missing", "error");
      toast("Firebase config is missing in firebase-config.js", "error");
      return;
    }

    state.firebaseApp = firebase.apps.length ? firebase.app() : firebase.initializeApp(config);
    state.db = firebase.database(state.firebaseApp);
    setAppStatus("Ready", "ready");
  } catch (error) {
    console.error(error);
    setAppStatus("Firebase error", "error");
    toast(error.message || "Firebase initialization failed.", "error");
  }

  applyRoomFromUrl();
}

function bindEvents() {
  ui.openCreateBtn.addEventListener("click", openCreateFlow);
  ui.openJoinBtn.addEventListener("click", openJoinFlow);
  document.querySelectorAll("[data-back-home]").forEach((button) => button.addEventListener("click", goHome));

  ui.createNameInput.addEventListener("input", updateCreateButtonState);
  ui.joinNameInput.addEventListener("input", updateJoinButtonState);
  ui.roomCodeInput.addEventListener("input", () => {
    ui.invalidRoomAlert.hidden = true;
    updateJoinButtonState();
  });

  ui.regenerateCodeBtn.addEventListener("click", createFreshCode);
  ui.createNowBtn.addEventListener("click", createMeetingNow);
  ui.joinNowBtn.addEventListener("click", joinMeetingNow);

  bindToggle(ui.createMicToggle, "Mic");
  bindToggle(ui.createCameraToggle, "Camera");
  bindToggle(ui.joinMicToggle, "Mic");
  bindToggle(ui.joinCameraToggle, "Camera");

  ui.copyCodeBtn.addEventListener("click", () => copyText(state.roomId || "", "Room code copied"));
  ui.copyInviteBtn.addEventListener("click", () => copyText(buildInviteLink(), "Invite link copied"));
  ui.micBtn.addEventListener("click", toggleMicDuringCall);
  ui.cameraBtn.addEventListener("click", toggleCameraDuringCall);
  ui.screenBtn.addEventListener("click", toggleScreenShare);
  ui.hangupBtn.addEventListener("click", leaveMeeting);

  ui.chatToggleBtn.addEventListener("click", () => ui.chatDrawer.classList.add("open"));
  ui.closeChatBtn.addEventListener("click", () => ui.chatDrawer.classList.remove("open"));
  ui.emojiBtn.addEventListener("click", () => {
    ui.emojiRow.hidden = !ui.emojiRow.hidden;
  });
  ui.emojiRow.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      ui.chatInput.value += button.textContent;
      ui.chatInput.focus();
    });
  });
  ui.sendChatBtn.addEventListener("click", sendChatMessage);
  ui.chatInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") sendChatMessage();
  });
}

function bindToggle(button, label) {
  button.addEventListener("click", () => {
    const enabled = button.dataset.enabled !== "true";
    button.dataset.enabled = String(enabled);
    button.querySelector("span").textContent = `${label} ${enabled ? "on" : "off"}`;
  });
}

function showView(name) {
  Object.values(ui.views).forEach((view) => view.classList.remove("active"));
  ui.views[name].classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openCreateFlow() {
  ui.invalidRoomAlert.hidden = true;
  createFreshCode();
  showView("create");
  setTimeout(() => ui.createNameInput.focus(), 120);
}

function openJoinFlow() {
  ui.invalidRoomAlert.hidden = true;
  showView("join");
  setTimeout(() => (ui.roomCodeInput.value ? ui.joinNameInput.focus() : ui.roomCodeInput.focus()), 120);
}

function goHome() {
  const url = new URL(window.location.href);
  url.searchParams.delete("room");
  history.replaceState({}, "", url.toString());
  showView("home");
}

function updateCreateButtonState() {
  ui.createNowBtn.disabled = ui.createNameInput.value.trim().length < 2 || !state.db;
}

function updateJoinButtonState() {
  const hasName = ui.joinNameInput.value.trim().length >= 2;
  const hasRoom = parseRoomId(ui.roomCodeInput.value).length >= 6;
  ui.joinNowBtn.disabled = !state.db || !hasName || !hasRoom;
}

function createFreshCode() {
  state.generatedCode = makeRoomCode();
  ui.generatedRoomCode.textContent = state.generatedCode;
}

function applyRoomFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const room = parseRoomId(params.get("room") || "");
  if (room) {
    ui.roomCodeInput.value = room;
    updateJoinButtonState();
    showView("join");
  }
}

async function createMeetingNow() {
  if (!state.db) return toast("Firebase is not ready yet.", "error");
  if (ui.createNameInput.value.trim().length < 2) return;

  ui.createNowBtn.disabled = true;
  ui.createNowBtn.innerHTML = loadingIcon("Creating...");

  state.role = "host";
  state.roomId = state.generatedCode || makeRoomCode();
  state.displayName = ui.createNameInput.value.trim().slice(0, 32);
  state.roomRef = state.db.ref(`rooms/${state.roomId}`);

  try {
    await prepareInitialMedia(isToggleOn(ui.createMicToggle), isToggleOn(ui.createCameraToggle));

    // Create the room path before WebRTC starts producing ICE candidates.
    // This avoids early candidates being overwritten by a later roomRef.set().
    await state.roomRef.set({
      status: "creating",
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      updatedAt: firebase.database.ServerValue.TIMESTAMP,
      createdBy: state.peerId,
      hostName: state.displayName,
      participants: {
        [state.peerId]: participantPayload("host"),
      },
    });

    enterMeetingScreen();
    setupPeerConnection("host");
    await applyLocalTracksToSenders();

    state.pc.onicecandidate = (event) => {
      if (event.candidate && state.roomRef) {
        state.roomRef.child("callerCandidates").push(event.candidate.toJSON()).catch(console.warn);
      }
    };

    const offer = await state.pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    await state.pc.setLocalDescription(offer);

    await state.roomRef.update({
      status: "waiting",
      updatedAt: firebase.database.ServerValue.TIMESTAMP,
      offer: { type: offer.type, sdp: offer.sdp },
    });

    listenForAnswer();
    listenForCandidates("calleeCandidates");
    listenForParticipants();
    setupFirebaseChat();
    setAppStatus("Room created", "ready");
    toast("Meeting created. Share the room link from the top right.");
  } catch (error) {
    console.error(error);
    await safeCleanupAfterFailedStart();
    setAppStatus("Create failed", "error");
    toast(error.message || "Could not create meeting. Check Firebase rules.", "error");
    showView("create");
  } finally {
    ui.createNowBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Create Meeting Now`;
    updateCreateButtonState();
  }
}

async function joinMeetingNow() {
  if (!state.db) return toast("Firebase is not ready yet.", "error");
  const room = parseRoomId(ui.roomCodeInput.value);
  if (!room || room.length < 6) return showInvalidRoom();
  if (ui.joinNameInput.value.trim().length < 2) return;

  ui.joinNowBtn.disabled = true;
  ui.joinNowBtn.innerHTML = loadingIcon("Checking room...");
  ui.invalidRoomAlert.hidden = true;

  try {
    const roomRef = state.db.ref(`rooms/${room}`);
    const snapshot = await roomRef.once("value");
    const data = snapshot.val();

    if (!data || !data.offer || data.status === "ended") {
      showInvalidRoom();
      return;
    }

    state.role = "guest";
    state.roomId = room;
    state.displayName = ui.joinNameInput.value.trim().slice(0, 32);
    state.roomRef = roomRef;

    await prepareInitialMedia(isToggleOn(ui.joinMicToggle), isToggleOn(ui.joinCameraToggle));
    enterMeetingScreen();
    setupPeerConnection("guest");

    state.pc.onicecandidate = (event) => {
      if (event.candidate && state.roomRef) {
        state.roomRef.child("calleeCandidates").push(event.candidate.toJSON()).catch(console.warn);
      }
    };

    await state.pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    await applyLocalTracksToSenders();
    await flushCandidateQueue();

    const answer = await state.pc.createAnswer();
    await state.pc.setLocalDescription(answer);

    await state.roomRef.update({
      status: "active",
      updatedAt: firebase.database.ServerValue.TIMESTAMP,
      answer: { type: answer.type, sdp: answer.sdp },
    });
    await state.roomRef.child(`participants/${state.peerId}`).set(participantPayload("guest"));

    listenForCandidates("callerCandidates");
    listenForParticipants();
    setupFirebaseChat();
    setAppStatus("Joined", "ready");
    toast("Joined meeting successfully.");
  } catch (error) {
    console.error(error);
    setAppStatus("Join failed", "error");
    toast(error.message || "Could not join meeting. Check room code and Firebase rules.", "error");
    showView("join");
  } finally {
    ui.joinNowBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/><path d="M3 12h12"/></svg>Join Meeting Now`;
    updateJoinButtonState();
  }
}

function showInvalidRoom() {
  ui.invalidRoomAlert.hidden = false;
  setAppStatus("Invalid room", "error");
  toast("Invalid Room Code — please check the room code and try again.", "error");
}

async function prepareInitialMedia(wantsAudio, wantsVideo) {
  stopLocalMedia();
  state.localStream = new MediaStream();
  state.currentAudioTrack = null;
  state.currentVideoTrack = null;
  ui.localVideo.srcObject = state.localStream;

  if (!wantsAudio && !wantsVideo) {
    updateLocalMediaUI();
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: wantsAudio,
      video: wantsVideo ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
    });
    stream.getTracks().forEach((track) => state.localStream.addTrack(track));
    state.currentAudioTrack = stream.getAudioTracks()[0] || null;
    state.currentVideoTrack = stream.getVideoTracks()[0] || null;
    ui.localVideo.srcObject = state.localStream;
  } catch (error) {
    console.warn(error);
    toast("Camera/mic permission was blocked. Entering without media.", "error");
  } finally {
    updateLocalMediaUI();
  }
}

function setupPeerConnection(mode) {
  state.remoteStream = new MediaStream();
  ui.remoteVideo.srcObject = state.remoteStream;
  ui.remotePlaceholder.classList.remove("hidden");
  state.queuedCandidates = [];

  state.pc = new RTCPeerConnection(rtcConfig);

  state.pc.ontrack = (event) => {
    const [stream] = event.streams;
    const tracks = stream ? stream.getTracks() : [event.track];
    tracks.forEach((track) => {
      if (!state.remoteStream.getTracks().some((existing) => existing.id === track.id)) {
        state.remoteStream.addTrack(track);
      }
      if (track.kind === "video") {
        ui.remotePlaceholder.classList.add("hidden");
        track.onmute = () => ui.remotePlaceholder.classList.remove("hidden");
        track.onunmute = () => ui.remotePlaceholder.classList.add("hidden");
      }
    });
    ui.remoteVideo.srcObject = state.remoteStream;
  };

  state.pc.onconnectionstatechange = () => {
    const connectionState = state.pc?.connectionState || "unknown";
    if (connectionState === "connected") {
      setAppStatus("Connected", "connected");
      toast("Peer connected.");
    } else if (["failed", "disconnected"].includes(connectionState)) {
      setAppStatus(connectionState, "error");
      toast("Peer connection is unstable. A TURN server may be needed on this network.", "error");
    } else if (connectionState !== "closed") {
      setAppStatus(connectionState, "ready");
    }
  };

  state.pc.oniceconnectionstatechange = () => {
    const iceState = state.pc?.iceConnectionState;
    if (iceState === "failed") {
      toast("WebRTC ICE failed. Add a TURN server for strict networks.", "error");
    }
  };

  if (mode === "host") {
    // The host creates media sections up front, so mic/camera can be turned on later without forcing permission at startup.
    createOfferTransceivers();
  }
}

function createOfferTransceivers() {
  if (!state.pc) return;
  const hasAudio = state.pc.getTransceivers().some((t) => t.receiver.track.kind === "audio");
  const hasVideo = state.pc.getTransceivers().some((t) => t.receiver.track.kind === "video");
  if (!hasAudio) state.pc.addTransceiver("audio", { direction: "sendrecv" });
  if (!hasVideo) state.pc.addTransceiver("video", { direction: "sendrecv" });
}

async function applyLocalTracksToSenders() {
  if (!state.pc) return;
  const audioSender = findSender("audio");
  const videoSender = findSender("video");

  if (audioSender) await audioSender.replaceTrack(state.currentAudioTrack || null);
  if (videoSender) await videoSender.replaceTrack(state.currentVideoTrack || null);
}

function findSender(kind) {
  const transceiver = state.pc?.getTransceivers().find((t) => t.receiver?.track?.kind === kind || t.sender?.track?.kind === kind);
  if (transceiver?.sender) return transceiver.sender;
  return state.pc?.getSenders().find((sender) => sender.track?.kind === kind) || null;
}

function listenForAnswer() {
  if (!state.roomRef) return;
  const ref = state.roomRef.child("answer");
  const callback = async (snapshot) => {
    const answer = snapshot.val();
    if (!answer || !state.pc || state.pc.currentRemoteDescription) return;
    try {
      await state.pc.setRemoteDescription(new RTCSessionDescription(answer));
      await flushCandidateQueue();
      await state.roomRef.update({ status: "active", updatedAt: firebase.database.ServerValue.TIMESTAMP });
      setAppStatus("Connecting", "ready");
    } catch (error) {
      console.warn(error);
    }
  };
  ref.on("value", callback);
  state.listeners.push(() => ref.off("value", callback));
}

function listenForCandidates(pathName) {
  if (!state.roomRef) return;
  const ref = state.roomRef.child(pathName);
  const callback = (snapshot) => {
    const candidate = snapshot.val();
    if (candidate) addRemoteCandidate(candidate);
  };
  ref.on("child_added", callback);
  state.listeners.push(() => ref.off("child_added", callback));
}

async function addRemoteCandidate(candidate) {
  if (!state.pc) return;
  if (!state.pc.remoteDescription) {
    state.queuedCandidates.push(candidate);
    return;
  }
  try {
    await state.pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (error) {
    console.warn("ICE candidate ignored", error);
  }
}

async function flushCandidateQueue() {
  const queued = [...state.queuedCandidates];
  state.queuedCandidates = [];
  for (const candidate of queued) {
    await addRemoteCandidate(candidate);
  }
}

function listenForParticipants() {
  if (!state.roomRef) return;
  const ref = state.roomRef.child("participants");
  const callback = (snapshot) => {
    const participants = snapshot.val() || {};
    const others = Object.entries(participants).filter(([id]) => id !== state.peerId).map(([, value]) => value);
    const remote = others[0];
    if (remote?.name) {
      ui.remoteLabel.textContent = remote.name;
      const avatar = ui.remotePlaceholder.querySelector(".avatar-circle");
      if (avatar) avatar.textContent = getInitial(remote.name);
    } else {
      ui.remoteLabel.textContent = state.role === "host" ? "Waiting for guest..." : "Connecting to host...";
    }
  };
  ref.on("value", callback);
  state.listeners.push(() => ref.off("value", callback));
}

function setupFirebaseChat() {
  if (!state.roomRef) return;
  state.chatKeys.clear();
  ui.chatMessages.innerHTML = "";

  const ref = state.roomRef.child("messages").limitToLast(100);
  const callback = (snapshot) => {
    const key = snapshot.key;
    if (state.chatKeys.has(key)) return;
    state.chatKeys.add(key);
    const msg = snapshot.val();
    if (!msg || !msg.text) return;
    appendChatBubble(msg);
  };
  ref.on("child_added", callback);
  state.listeners.push(() => ref.off("child_added", callback));
}

async function sendChatMessage() {
  const text = ui.chatInput.value.trim();
  if (!text || !state.roomRef) return;
  ui.chatInput.value = "";
  ui.emojiRow.hidden = true;

  try {
    await state.roomRef.child("messages").push({
      senderId: state.peerId,
      name: state.displayName,
      text,
      createdAt: firebase.database.ServerValue.TIMESTAMP,
    });
  } catch (error) {
    console.warn(error);
    toast("Message could not be sent. Check Firebase rules.", "error");
  }
}

function appendChatBubble(msg) {
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble${msg.senderId === state.peerId ? " me" : ""}`;
  const time = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Now";
  bubble.innerHTML = `<small>${escapeHtml(msg.name || "Guest")} • ${escapeHtml(time)}</small><p>${escapeHtml(msg.text)}</p>`;
  ui.chatMessages.appendChild(bubble);
  ui.chatMessages.scrollTop = ui.chatMessages.scrollHeight;
}

function enterMeetingScreen() {
  ui.activeRoomCode.textContent = state.roomId;
  ui.localInitial.textContent = getInitial(state.displayName);
  ui.localLabel.textContent = state.displayName || "You";
  ui.remoteLabel.textContent = state.role === "host" ? "Waiting for guest..." : "Connecting to host...";
  ui.chatDrawer.classList.remove("open");
  updateLocalMediaUI();
  updateUrlRoom(state.roomId);
  showView("meeting");
}

async function toggleMicDuringCall() {
  if (!state.pc) return;

  if (!state.currentAudioTrack) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      state.currentAudioTrack = stream.getAudioTracks()[0] || null;
      if (state.currentAudioTrack) state.localStream.addTrack(state.currentAudioTrack);
      await applyLocalTracksToSenders();
      toast("Microphone turned on.");
    } catch (error) {
      console.warn(error);
      toast("Microphone permission blocked.", "error");
    }
  } else {
    state.currentAudioTrack.enabled = !state.currentAudioTrack.enabled;
    toast(state.currentAudioTrack.enabled ? "Microphone unmuted." : "Microphone muted.");
  }
  updateLocalMediaUI();
}

async function toggleCameraDuringCall() {
  if (!state.pc) return;

  if (!state.currentVideoTrack) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { width: { ideal: 1280 }, height: { ideal: 720 } } });
      state.currentVideoTrack = stream.getVideoTracks()[0] || null;
      if (state.currentVideoTrack) state.localStream.addTrack(state.currentVideoTrack);
      ui.localVideo.srcObject = state.localStream;
      await applyLocalTracksToSenders();
      toast("Camera turned on.");
    } catch (error) {
      console.warn(error);
      toast("Camera permission blocked.", "error");
    }
  } else {
    state.currentVideoTrack.enabled = !state.currentVideoTrack.enabled;
    toast(state.currentVideoTrack.enabled ? "Camera turned on." : "Camera turned off.");
  }
  updateLocalMediaUI();
}

async function toggleScreenShare() {
  if (!state.pc) return;
  const videoSender = findSender("video");

  if (state.localScreenTrack) {
    state.localScreenTrack.stop();
    state.localScreenTrack = null;
    if (videoSender) await videoSender.replaceTrack(state.currentVideoTrack || null);
    ui.localVideo.srcObject = state.localStream;
    ui.screenBtn.classList.remove("on");
    toast("Screen sharing stopped.");
    updateLocalMediaUI();
    return;
  }

  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    state.localScreenTrack = screenStream.getVideoTracks()[0];
    if (videoSender) await videoSender.replaceTrack(state.localScreenTrack);
    ui.localVideo.srcObject = screenStream;
    ui.localPlaceholder.classList.add("hidden");
    ui.screenBtn.classList.add("on");
    toast("Screen sharing started.");

    state.localScreenTrack.onended = async () => {
      state.localScreenTrack = null;
      if (videoSender) await videoSender.replaceTrack(state.currentVideoTrack || null);
      ui.localVideo.srcObject = state.localStream;
      ui.screenBtn.classList.remove("on");
      updateLocalMediaUI();
      toast("Screen sharing stopped.");
    };
  } catch (error) {
    console.warn(error);
    toast("Screen share cancelled or blocked.", "error");
  }
}

function updateLocalMediaUI() {
  ui.localVideo.srcObject = state.localStream;
  const micOn = Boolean(state.currentAudioTrack && state.currentAudioTrack.enabled);
  const camOn = Boolean(state.currentVideoTrack && state.currentVideoTrack.enabled);

  ui.micBtn.classList.toggle("on", micOn);
  ui.micBtn.classList.toggle("off", !micOn);
  ui.cameraBtn.classList.toggle("on", camOn);
  ui.cameraBtn.classList.toggle("off", !camOn);
  ui.localPlaceholder.classList.toggle("hidden", camOn || Boolean(state.localScreenTrack));
  ui.localMediaState.textContent = `${micOn ? "Mic on" : "Mic off"} • ${camOn ? "Camera on" : "Camera off"}`;
}

async function leaveMeeting() {
  ui.hangupBtn.disabled = true;
  try {
    removeFirebaseListeners();
    if (state.roomRef) {
      await state.roomRef.child(`participants/${state.peerId}`).remove().catch(() => {});
      if (state.role === "host") {
        await state.roomRef.update({ status: "ended", endedAt: firebase.database.ServerValue.TIMESTAMP }).catch(() => {});
      }
    }
  } catch (error) {
    console.warn(error);
  }

  if (state.pc) {
    state.pc.getSenders().forEach((sender) => { try { sender.track?.stop(); } catch (_) {} });
    state.pc.close();
  }
  stopLocalMedia();

  state.roomId = null;
  state.role = null;
  state.roomRef = null;
  state.pc = null;
  state.remoteStream = new MediaStream();
  state.chatKeys.clear();
  ui.localVideo.srcObject = null;
  ui.remoteVideo.srcObject = null;
  ui.chatMessages.innerHTML = "";
  ui.hangupBtn.disabled = false;
  setAppStatus("Ready", "ready");
  updateUrlRoom(null);
  createFreshCode();
  showView("home");
  toast("You left the meeting.");
}

async function safeCleanupAfterFailedStart() {
  removeFirebaseListeners();
  if (state.pc) state.pc.close();
  stopLocalMedia();
  if (state.role === "host" && state.roomRef) {
    await state.roomRef.remove().catch(() => {});
  }
  state.pc = null;
  state.roomRef = null;
  state.roomId = null;
}

function stopLocalMedia() {
  [state.currentAudioTrack, state.currentVideoTrack, state.localScreenTrack].forEach((track) => {
    try { track?.stop(); } catch (_) {}
  });
  state.currentAudioTrack = null;
  state.currentVideoTrack = null;
  state.localScreenTrack = null;
  state.localStream?.getTracks().forEach((track) => {
    try { track.stop(); } catch (_) {}
  });
  state.localStream = new MediaStream();
}

function removeFirebaseListeners() {
  state.listeners.splice(0).forEach((off) => {
    try { off(); } catch (_) {}
  });
}

function participantPayload(role) {
  return {
    id: state.peerId,
    name: state.displayName,
    role,
    joinedAt: firebase.database.ServerValue.TIMESTAMP,
  };
}

function isToggleOn(button) {
  return button.dataset.enabled === "true";
}

function setAppStatus(text, mode = "") {
  ui.appStatus.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) node.remove();
  });
  ui.appStatus.className = `status-chip ${mode}`.trim();
  ui.appStatus.append(` ${text}`);
}

function toast(message, type = "") {
  ui.toast.textContent = message;
  ui.toast.className = `toast show ${type}`.trim();
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    ui.toast.className = "toast";
  }, 2900);
}

async function copyText(text, successMessage) {
  if (!text) return;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const input = document.createElement("textarea");
      input.value = text;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.focus();
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    toast(successMessage);
  } catch (error) {
    console.warn(error);
    toast("Copy failed. Select and copy manually.", "error");
  }
}

function buildInviteLink() {
  const url = new URL(window.location.href);
  url.searchParams.set("room", state.roomId || "");
  return url.toString();
}

function updateUrlRoom(room) {
  const url = new URL(window.location.href);
  if (room) url.searchParams.set("room", room);
  else url.searchParams.delete("room");
  history.replaceState({}, "", url.toString());
}

function parseRoomId(value) {
  if (!value) return "";
  let raw = String(value).trim();
  try {
    const url = new URL(raw);
    raw = url.searchParams.get("room") || url.hash.replace("#", "") || raw;
  } catch (_) {}
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

function makeRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = crypto.getRandomValues(new Uint32Array(8));
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
}

function makeId(length = 12) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const values = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
}

function getInitial(name) {
  const clean = String(name || "Guest").trim();
  return clean ? clean.charAt(0).toUpperCase() : "G";
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function loadingIcon(text) {
  return `<svg viewBox="0 0 24 24"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>${escapeHtml(text)}`;
}

window.addEventListener("beforeunload", () => {
  try {
    if (state.roomRef) state.roomRef.child(`participants/${state.peerId}`).remove();
  } catch (_) {}
  stopLocalMedia();
});
