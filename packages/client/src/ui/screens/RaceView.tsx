import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { RaceSimulationResult } from '@track-stars/shared';
import { RaceScene } from '../../phaser/scenes/RaceScene';
import { eventBus } from '../../phaser/EventBus';
import { api } from '../../api/client';

interface Props {
  simulation: RaceSimulationResult;
  playerLane: number;
  rewards: { coinsEarned: number; xpEarned: number };
  playerAppearance?: any;
  stadiumConfig?: any;
  laneLabels?: Record<number, string>;
  laneMetadata?: Record<number, any>;
  onComplete: () => void;
}

export function RaceView({ simulation, playerLane, rewards, playerAppearance, stadiumConfig, laneLabels, laneMetadata, onComplete }: Props) {
  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const W = window.innerWidth;
    const H = window.innerHeight;

    // Preload the turf image before starting Phaser so there's no flash
    const fieldStyle = stadiumConfig?.fieldStyle || 'green';
    const turfSrc = `/assets/track/turf_${fieldStyle}.png`;
    const preImg = new Image();
    preImg.src = turfSrc; // starts loading immediately, cached by browser

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: W * dpr,
      height: H * dpr,
      parent: containerRef.current,
      backgroundColor: '#0a1628',
      scene: [RaceScene],
      fps: { target: 60, forceSetTimeOut: true } as any, // use setTimeout instead of rAF so browser doesn't throttle
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: W * dpr,
        height: H * dpr,
      },
      render: {
        pixelArt: false,
        antialias: true,
        roundPixels: false,
      },
    });

    gameRef.current = game;

    game.events.on('ready', async () => {
      let records: { finishTimeMs: number; displayName: string }[] = [];
      try {
        const allRecords = await api.getRecords();
        const eventKey = simulation.eventType as keyof typeof allRecords;
        records = (allRecords[eventKey] || []).map((r: any) => ({
          finishTimeMs: r.finishTimeMs,
          displayName: r.displayName,
        }));
      } catch { /* no records yet */ }

      game.scene.start('RaceScene', {
        frames: simulation.frames,
        results: simulation.results,
        eventType: simulation.eventType,
        playerLane,
        records,
        playerAppearance,
        stadiumConfig,
        laneLabels,
        laneMetadata,
        canvasWidth: W * dpr,
        canvasHeight: H * dpr,
      });
    });

    const handleComplete = () => {
      setTimeout(onComplete, 500);
    };

    eventBus.on('raceComplete', handleComplete);

    return () => {
      eventBus.off('raceComplete', handleComplete);
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <div ref={containerRef} style={{
      position: 'fixed',
      top: 0, left: 0,
      width: '100vw',
      height: '100vh',
      background: '#0a1628',
      overflow: 'hidden',
    }} />
  );
}
