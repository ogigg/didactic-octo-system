import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from "expo-audio";

const restReadyChime = require("../assets/sounds/rest-ready-chime.wav");

let player: AudioPlayer | null = null;
let audioModePromise: Promise<void> | null = null;

function ensureAudioMode() {
  audioModePromise ??= setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: "mixWithOthers",
  });
  return audioModePromise;
}

function getRestReadyPlayer() {
  player ??= createAudioPlayer(restReadyChime, {
    keepAudioSessionActive: true,
  });
  return player;
}

export async function playRestTimerCompleteSound() {
  try {
    await ensureAudioMode();
    const readyPlayer = getRestReadyPlayer();
    await readyPlayer.seekTo(0);
    readyPlayer.play();
  } catch (error) {
    console.warn("[rest-timer] failed to play completion sound:", error);
  }
}
