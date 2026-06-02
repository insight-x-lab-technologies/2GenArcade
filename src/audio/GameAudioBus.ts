import type { AudioBus, GameSoundKit, MusicTrackName } from '@/types';
import type { AudioEngine } from './AudioEngine';

/** Per-game audio surface passed into the GameContext. Resolves the game's
 *  declarative sound kit against the shared engine; unknown ids are no-ops. */
export class GameAudioBus implements AudioBus {
  constructor(
    private readonly engine: AudioEngine,
    private readonly kit: GameSoundKit,
  ) {}

  playMusic(track: MusicTrackName): void {
    const def = this.kit[track];
    if (def) this.engine.playTrack(def, `game:${track}`);
  }

  stopMusic(): void {
    this.engine.stopMusic();
  }

  playSfx(id: string): void {
    const def = this.kit.sfx?.[id];
    if (def) this.engine.playSfx(def);
  }
}
