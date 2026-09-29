import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

/**
 * Pitidos tipo walkie-talkie: un tono ALTO cuando alguien empieza a hablar y un
 * tono BAJO ("roger") cuando termina. Los reproductores se crean una sola vez y
 * se reutilizan para que el pitido salga al instante.
 */
let startPlayer: AudioPlayer | null = null;
let endPlayer: AudioPlayer | null = null;

function ensurePlayers() {
  if (!startPlayer) {
    startPlayer = createAudioPlayer(require('../../../assets/audio/beep-start.wav'));
    startPlayer.volume = 1;
  }
  if (!endPlayer) {
    endPlayer = createAudioPlayer(require('../../../assets/audio/beep-end.wav'));
    endPlayer.volume = 1;
  }
}

function play(player: AudioPlayer | null) {
  if (!player) return;
  try {
    player.seekTo(0); // rebobina por si se reproduce en rápida sucesión
    player.play();
  } catch {
    /* noop */
  }
}

/** Pitido de INICIO (alguien tomó la palabra / empezaste a hablar). */
export function playStartBeep() {
  try {
    ensurePlayers();
    play(startPlayer);
  } catch {
    /* noop */
  }
}

/** Pitido de FIN (se soltó la palabra). */
export function playEndBeep() {
  try {
    ensurePlayers();
    play(endPlayer);
  } catch {
    /* noop */
  }
}
