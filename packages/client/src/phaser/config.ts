import Phaser from 'phaser';
import { RaceScene } from './scenes/RaceScene';

export function createGameConfig(parent: string): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    width: 1200,
    height: 700,
    parent,
    backgroundColor: '#0a1628',
    scene: [RaceScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  };
}
