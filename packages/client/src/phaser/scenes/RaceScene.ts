import Phaser from 'phaser';
import { RaceFrame, RunnerFrame, RaceResult, EventType } from '@track-stars/shared';
import { startMusic, stopMusic, setMusicVolume, playFanfare, startCrowd, setCrowdVolume, stopCrowd, stopMenuMusic } from '../utils/music';
import {
  drawTrack,
  getTrackPoint,
  getTrackPerimeter,
  buildTrackConfig,
  DEFAULT_TRACK_CONFIG,
  getStartProgress,
  getFinishProgress,
  distanceToTrackProgress,
  getEffectiveLane800,
  getEffectiveLaneSC,
  buildSpurPath,
  getSpurPoint,
  SpurPath,
  formatRaceTime,
  TrackConfig,
  StadiumConfig,
  Point,
} from '../utils/trackGeometry';
import { eventBus } from '../EventBus';

// ── Per-runner visual objects ──
interface RunnerVisual {
  lane: number;
  gfx: Phaser.GameObjects.Graphics;   // draws the stick figure
  label: Phaser.GameObjects.Text;
  boostGlow: Phaser.GameObjects.Arc;
  trail: Phaser.GameObjects.Graphics;
  isPlayer: boolean;
  prevPos: Point;
  animPhase: number; // running animation phase
  finishedTick: number;       // tick when this runner finished (-1 if not yet)
  walkTarget: Point | null;   // random infield point to walk toward after finishing
  indicator: Phaser.GameObjects.Graphics | null; // player locator triangle
}

const LANE_COLORS = [
  0xff4444, 0x4488ff, 0x44cc44, 0xffaa00,
  0xff44ff, 0x00ddaa, 0xdddd22, 0xaa44ff,
  0xff8866, 0x66ccff, 0x88ff88, 0xffcc44,
];
const SKIN_TONES = [0xf5cba7, 0xe0ac69, 0xc68642, 0x8d5524, 0xf5cba7, 0xe0ac69, 0xc68642, 0x8d5524];
const PLAYER_SKIN_TONES: Record<number, number> = {
  0: 0xf5cba7, 1: 0xf0b088, 2: 0xe0ac69, 3: 0xc68642, 4: 0x8d5524, 5: 0x4a2c0a,
};

export class RaceScene extends Phaser.Scene {
  private frames: RaceFrame[] = [];
  private results: RaceResult[] = [];
  private eventType: EventType = '200m';
  private playerLane: number = 4;
  private raceDistance: number = 200;
  private records: { finishTimeMs: number; displayName: string }[] = [];
  private myBestTimes: { time: number; name: string }[] = [];
  private friendsBestTimes: { time: number; name: string; isYou?: boolean }[] = [];
  private playerAppearance: any = null;
  private stadiumConfig: any = null;
  private laneLabels: Record<number, string> = {};
  private laneMetadata: Record<number, any> = {};
  private W: number = 1400;
  private H: number = 840;
  private cfg!: TrackConfig;

  private bgGraphics!: Phaser.GameObjects.Graphics;
  private crowdGfx!: Phaser.GameObjects.Graphics;
  private crowdFans: { x: number; y: number; color: number; phase: number; speed: number }[] = [];
  private crowdAnimSubset: number[] = []; // indices of fans to animate
  private crowdFrameSkip: number = 0;
  private runners: RunnerVisual[] = [];
  private minimapGfx!: Phaser.GameObjects.Graphics;

  private currentFrame: number = 0;
  private playbackSpeed: number = 1;
  private isPlaying: boolean = false;
  private frameAccum: number = 0;
  private raceFinished: boolean = false;
  private raceStartWallTime: number = 0; // Date.now() when race started
  private pausedTimeAccum: number = 0;   // total ms spent paused
  private crowdState: 'idle' | 'countdown' | 'raceStart' | 'racing' | 'homeStretch' | 'finished' = 'idle';
  private raceStartFrame: number = 0;
  private finishedCount: number = 0;

  private isPaused: boolean = false;
  private pauseMenu: Phaser.GameObjects.Container | null = null;

  private countdownText!: Phaser.GameObjects.Text;
  private positionText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private eventLabel!: Phaser.GameObjects.Text;
  private speedBtns: Phaser.GameObjects.Text[] = [];
  private recordsText!: Phaser.GameObjects.Text;

  // Center-field HUD
  private centerDistText!: Phaser.GameObjects.Text;
  private centerTimeText!: Phaser.GameObjects.Text;
  private splitsText!: Phaser.GameObjects.Text;
  private playerSplits: { distance: number; time: string }[] = [];
  private spurPath: SpurPath | null = null;
  private bypassOffset: number = 0;
  /** Full steeplechase lap path: points + cumulative arc lengths */
  private scLapPath: Point[] = [];
  private scLapArcLen: number[] = [];
  private scLapTotalLen: number = 0;
  private lastSplitDistance: number = 0;

  constructor() {
    super({ key: 'RaceScene', active: false, visible: false });
  }

  private _hasData = false;

  init(data: any) {
    if (!data || !data.frames) {
      // Scene was auto-started by Phaser without data — skip
      this._hasData = false;
      return;
    }
    this._hasData = true;
    this.frames = data.frames;
    this.results = data.results;
    this.eventType = data.eventType;
    this.playerLane = data.playerLane;
    this.raceDistance = data.eventType === '200m' ? 200 : data.eventType === '400m' ? 400 : data.eventType === '2000mSC' ? 2000 : 800;
    this.playbackSpeed = 1;
    this.frameAccum = 0;
    this.lastUpdateTime = 0;
    this.records = data.records || [];
    this.myBestTimes = data.myBestTimes || [];
    this.friendsBestTimes = data.friendsBestTimes || [];
    this.playerAppearance = data.playerAppearance || null;
    this.stadiumConfig = data.stadiumConfig || null;
    this.laneLabels = data.laneLabels || {};
    this.laneMetadata = data.laneMetadata || {};
    this.W = data.canvasWidth || 1400;
    this.H = data.canvasHeight || 840;
    this.cfg = buildTrackConfig(this.W, this.H);
    this.currentFrame = 0;
    this.isPlaying = false;
    this.frameAccum = 0;
    this.raceFinished = false;
  }

  create() {
    if (!this._hasData) return; // Wait for scene.start() with real data
    const { W, H, cfg } = this;
    this.cameras.main.setBackgroundColor('#87ceeb');

    // ── Track + stadium background ──
    this.bgGraphics = this.add.graphics();
    drawTrack(this.bgGraphics, cfg, this.stadiumConfig || undefined);

    // ── Turf image fill for infield ──
    // Hide everything behind a black cover until turf loads
    const fieldStyle = this.stadiumConfig?.fieldStyle || 'green';
    const turfKey = `turf_${fieldStyle}`;
    const cover = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 1).setDepth(9999);

    const revealScene = () => {
      this.tweens.add({ targets: cover, alpha: 0, duration: 300, onComplete: () => cover.destroy() });
    };

    if (!this.textures.exists(turfKey)) {
      this.load.image(turfKey, `/assets/track/${turfKey}.png`);
      this.load.once('complete', () => { this.applyTurfImage(turfKey); revealScene(); });
      this.load.start();
    } else {
      this.applyTurfImage(turfKey);
      revealScene();
    }

    // ── Animated crowd disabled for performance ──
    // Static crowd is already baked into drawTrack background
    this.crowdGfx = this.add.graphics().setDepth(1);

    // ── Create runners ──
    this.runners = [];
    const totalRunners = this.frames[0]?.runners.length || (this.eventType === '2000mSC' ? 12 : 8);
    for (let lane = 1; lane <= totalRunners; lane++) {
      const isPlayer = lane === this.playerLane;
      // Steeplechase: runners start spread across lanes on a curved line
      const startLane = this.eventType === '2000mSC'
        ? 1 + ((lane - 1) / Math.max(1, totalRunners - 1)) * 5 // spread across lanes 1-6
        : lane;
      const startProg = getStartProgress(this.eventType === '2000mSC' ? 1 : lane, this.eventType, cfg);
      const startPos = getTrackPoint(startLane, startProg, cfg);

      const gfx = this.add.graphics();
      // Label: use laneLabels if available (challenges show friend names)
      const laneLabel = this.laneLabels[lane] || (isPlayer ? 'YOU'
        : this.eventType === '2000mSC' ? `#${lane}` : `L${lane}`);
      const isLabeled = !!this.laneLabels[lane]; // has a special label (human player in challenge)
      const label = this.add.text(startPos.x, startPos.y - 28, laneLabel, {
        fontSize: (isPlayer || isLabeled) ? '13px' : '10px',
        fontFamily: 'Arial', fontStyle: 'bold',
        color: isPlayer ? '#FFD700' : isLabeled ? '#44ddff' : '#fff',
        stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5, 1);

      const boostGlow = this.add.arc(startPos.x, startPos.y, 20, 0, 360, false, 0x00ffff, 0)
        .setStrokeStyle(2, 0x00ffff, 0);
      const trail = this.add.graphics();

      const indicator = isPlayer ? this.add.graphics() : null;

      const rv: RunnerVisual = {
        lane, gfx, label, boostGlow, trail, isPlayer,
        prevPos: { ...startPos },
        animPhase: Math.random() * Math.PI * 2,
        finishedTick: -1,
        walkTarget: null,
        indicator,
      };
      this.runners.push(rv);

      // Draw runner in starting pose so they're visible during countdown
      gfx.setDepth(Math.round(startPos.y));
      label.setDepth(Math.round(startPos.y) + 1);
      this.drawRunner(gfx, startPos.x, startPos.y, lane, 0, false, false, isPlayer);
    }

    // ── Start lines + lane numbers ──
    const startLineGfx = this.add.graphics().setDepth(3);
    if (this.eventType === '2000mSC') {
      // Steeplechase: single curved start line across all lanes
      const startProg = getStartProgress(1, this.eventType, cfg);
      startLineGfx.lineStyle(2, 0xffffff, 0.8);
      startLineGfx.beginPath();
      const firstPt = getTrackPoint(1, startProg, cfg);
      startLineGfx.moveTo(firstPt.x, firstPt.y);
      for (let l = 1.5; l <= 8; l += 0.5) {
        const pt = getTrackPoint(l, startProg, cfg);
        startLineGfx.lineTo(pt.x, pt.y);
      }
      startLineGfx.strokePath();
    } else {
      for (let lane = 1; lane <= 8; lane++) {
        const startProg = getStartProgress(lane, this.eventType, cfg);
        const p1 = getTrackPoint(lane, startProg, cfg);
        const p2 = getTrackPoint(lane, startProg + 0.001, cfg);
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const tx = dx / len;
        const ty = dy / len;
        const nx = -ty;
        const ny = tx;
        const halfW = cfg.laneWidth / 2;

        startLineGfx.lineStyle(2, 0xffffff, 0.8);
        startLineGfx.beginPath();
        startLineGfx.moveTo(p1.x + nx * halfW, p1.y + ny * halfW);
        startLineGfx.lineTo(p1.x - nx * halfW, p1.y - ny * halfW);
        startLineGfx.strokePath();

        const numOffset = cfg.laneWidth * 0.8;
        const numX = p1.x - tx * numOffset;
        const numY = p1.y - ty * numOffset;
        const angle = Math.atan2(ty, tx) + Math.PI / 2;

        this.add.text(numX, numY, `${lane}`, {
          fontSize: `${Math.round(cfg.laneWidth * 0.75)}px`,
          fontFamily: 'Arial Black, sans-serif',
          fontStyle: 'bold',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 2,
        }).setOrigin(0.5, 0.5).setRotation(angle).setDepth(3);
      }
    }

    // ── 800m break line + cones ──
    // A straight line across all lanes at the start of the back straight,
    // where the first curve ends and runners can cut in to lane 1.
    // This is at x = centerX + halfS (right side of track, top straight start).
    if (this.eventType === '800m') {
      const breakGfx = this.add.graphics().setDepth(4);
      const breakX = cfg.centerX + cfg.straightLength / 2;
      const innerEdge = cfg.centerY - cfg.innerRadius;
      const outerEdge = cfg.centerY - (cfg.innerRadius + cfg.lanes * cfg.laneWidth);

      // Small orange cone on each lane boundary line
      for (let lane = 0; lane <= 8; lane++) {
        const coneY = cfg.centerY - (cfg.innerRadius + lane * cfg.laneWidth);
        const coneH = 6;
        const coneW = 3.5;

        // Cone body
        breakGfx.fillStyle(0xff6600, 0.95);
        breakGfx.fillTriangle(
          breakX, coneY - coneH,
          breakX - coneW, coneY,
          breakX + coneW, coneY,
        );
        // White stripe
        breakGfx.fillStyle(0xffffff, 0.85);
        breakGfx.fillRect(breakX - coneW * 0.55, coneY - coneH * 0.45, coneW * 1.1, 1.5);
        // Base
        breakGfx.fillStyle(0xdd4400, 1);
        breakGfx.fillRect(breakX - coneW - 1, coneY - 1, coneW * 2 + 2, 2);
      }
    }

    // ── Steeplechase: water jump bypass + barriers ──
    if (this.eventType === '2000mSC') {
      const barrierGfx = this.add.graphics().setDepth(4);
      const fillGfx = this.add.graphics().setDepth(2);

      const trackColor = this.stadiumConfig?.trackColor || 0xcc4422;
      const halfS = cfg.straightLength / 2;
      const curveCX = cfg.centerX - halfS;
      const curveCY = cfg.centerY;
      const innerR = cfg.innerRadius;
      const lw = cfg.laneWidth;

      const pitSize = lw * 3.5;
      const wpY = curveCY;

      // ── Bypass ellipse: lanes 1 & 4 at junctions, outer kisses lane 1 inner at leftmost point ──
      const Ry = innerR + 0.5 * lw; // matches lane 1 center at junctions
      const innerOff = Ry - innerR; // 0.5*lw — inner line meets lane 1 inner at junctions
      const outerOff = (innerR + 4 * lw) - Ry; // 3.5*lw — outer line meets lane 4 outer at junctions
      // Rx sized so outer dashed line touches lane 1 inner at the leftmost point
      const Rx = innerR - outerOff; // at angle PI: outer_x = curveCX - Rx - outerOff = curveCX - innerR
      const wpX = curveCX - Rx; // water pit center at ellipse leftmost
      const offset = (innerOff + outerOff) / 2;
      this.bypassOffset = offset;

      // At top/bottom: outer offset = Ry + offset = innerR + 4*lw = lane 4 outer edge ✓
      // At top/bottom: inner offset = Ry - offset = innerR = lane 1 inner edge ✓
      // At left: outer passes at wpX - offset, inner at wpX + offset (clears pit)

      // Build center ellipse path first, then offset by constant distance along normals
      const centerPts: { x: number; y: number; nx: number; ny: number }[] = [];
      for (let a = Math.PI / 2; a <= 3 * Math.PI / 2; a += 0.015) {
        const cx2 = curveCX + Math.cos(a) * Rx;
        const cy2 = curveCY - Math.sin(a) * Ry;
        centerPts.push({ x: cx2, y: cy2, nx: 0, ny: 0 });
      }
      // Compute normals from adjacent points (numerical, ensures constant-distance offset)
      for (let i = 0; i < centerPts.length; i++) {
        const prev = centerPts[Math.max(0, i - 1)];
        const next = centerPts[Math.min(centerPts.length - 1, i + 1)];
        const tdx = next.x - prev.x;
        const tdy = next.y - prev.y;
        const tlen = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
        // Normal: perpendicular to tangent, pointing outward (away from ellipse center)
        centerPts[i].nx = -tdy / tlen;
        centerPts[i].ny = tdx / tlen;
      }

      const buildOffsetCurve = (off: number): Point[] => {
        const pts: Point[] = [];
        for (const cp of centerPts) {
          pts.push({ x: cp.x + cp.nx * off, y: cp.y + cp.ny * off });
        }
        return pts;
      };

      const outerCurve = buildOffsetCurve(outerOff);   // offset outward to lane 4 outer
      const innerCurve = buildOffsetCurve(-innerOff);   // offset inward to lane 1 inner

      // ── Fill: area between lane 1 inner edge and inner dashed curve ──
      // Touches the regular track (no gap) and stops at the inner dashed line (no overflow)
      fillGfx.fillStyle(trackColor, 1.0);
      fillGfx.beginPath();
      // Lane 1 inner edge arc — top to bottom (this is where regular track ends)
      for (let a = Math.PI / 2; a <= 3 * Math.PI / 2; a += 0.02) {
        const x = curveCX + Math.cos(a) * innerR;
        const y = curveCY - Math.sin(a) * innerR;
        if (a === Math.PI / 2) fillGfx.moveTo(x, y);
        else fillGfx.lineTo(x, y);
      }
      // Inner dashed curve — bottom back to top (closes the polygon)
      for (let i = innerCurve.length - 1; i >= 0; i--) {
        fillGfx.lineTo(innerCurve[i].x, innerCurve[i].y);
      }
      fillGfx.closePath();
      fillGfx.fill();

      // ── Dashed lines ──
      const drawDashedPath = (pts: Point[]) => {
        const dashLen = 8;
        const gapLen = 6;
        let drawing = true;
        let accum = 0;
        barrierGfx.lineStyle(1.5, 0xffffff, 0.7);
        for (let i = 1; i < pts.length; i++) {
          const dx = pts[i].x - pts[i-1].x;
          const dy = pts[i].y - pts[i-1].y;
          accum += Math.sqrt(dx * dx + dy * dy);
          if (drawing) {
            barrierGfx.lineBetween(pts[i-1].x, pts[i-1].y, pts[i].x, pts[i].y);
            if (accum >= dashLen) { drawing = false; accum = 0; }
          } else {
            if (accum >= gapLen) { drawing = true; accum = 0; }
          }
        }
      };

      drawDashedPath(outerCurve);
      drawDashedPath(innerCurve);

      // ── Water pit — centered between the two dashed lines ──
      const wpDrawX = wpX - (outerOff - innerOff) / 2;
      // Water pit base
      barrierGfx.fillStyle(0x0d4477, 0.8);
      barrierGfx.fillRect(wpDrawX - pitSize / 2, wpY - pitSize / 2, pitSize, pitSize);
      // Lighter ripple bands (horizontal wavy lines)
      const wl = wpDrawX - pitSize / 2;
      const wt = wpY - pitSize / 2;
      for (let row = 0; row < 5; row++) {
        const ry = wt + pitSize * (0.15 + row * 0.18);
        barrierGfx.lineStyle(1.2, 0x3399dd, 0.35 - row * 0.04);
        barrierGfx.beginPath();
        for (let x = 0; x <= pitSize; x += 2) {
          const wx = wl + x;
          const wy = ry + Math.sin(x * 0.3 + row * 1.5) * 1.5;
          if (x === 0) barrierGfx.moveTo(wx, wy);
          else barrierGfx.lineTo(wx, wy);
        }
        barrierGfx.strokePath();
      }
      // Border
      barrierGfx.lineStyle(1.5, 0x003366, 0.7);
      barrierGfx.strokeRect(wpDrawX - pitSize / 2, wpY - pitSize / 2, pitSize, pitSize);
      barrierGfx.fillStyle(0x663300, 0.95);
      barrierGfx.fillRect(wpDrawX - pitSize / 2 - 1, wpY - pitSize / 2 - 3, pitSize + 2, 4);
      barrierGfx.fillStyle(0xffffff, 0.75);
      barrierGfx.fillRect(wpDrawX - pitSize / 2 + 3, wpY - pitSize / 2 - 2, pitSize - 6, 2);

      // ── Build full steeplechase lap path (one continuous loop) ──
      // Build lap path starting from the FINISH LINE (progress ~0.212) so distance=0 matches start position
      // Path: finish → right curve → top straight → bypass ellipse → bottom straight → back to finish
      this.scLapPath = [];
      this.scLapArcLen = [0];

      const scTrackLane = 1; // runners hug lane 1 on main track
      const pStep = 0.003;
      const finishProg = getFinishProgress(1, cfg); // ~0.212

      // Segment 1: finish line → right curve → top straight (progress 0.212 → 0.712)
      for (let p = finishProg; p <= 0.712; p += pStep) {
        this.scLapPath.push(getTrackPoint(scTrackLane, Math.min(p, 0.712), cfg));
      }
      // Segment 2: bypass ellipse (replaces left curve, progress 0.712 → 1.0)
      for (const cp of centerPts) {
        this.scLapPath.push({ x: cp.x, y: cp.y });
      }
      // Segment 3: bottom straight back to finish (progress 0.0 → 0.212)
      for (let p = pStep; p <= finishProg; p += pStep) {
        this.scLapPath.push(getTrackPoint(scTrackLane, Math.min(p, finishProg), cfg));
      }
      // Close the loop: ensure last point matches first point exactly
      this.scLapPath.push({ ...this.scLapPath[0] });

      // Compute cumulative pixel arc lengths
      for (let i = 1; i < this.scLapPath.length; i++) {
        const dx = this.scLapPath[i].x - this.scLapPath[i-1].x;
        const dy = this.scLapPath[i].y - this.scLapPath[i-1].y;
        this.scLapArcLen.push(this.scLapArcLen[i-1] + Math.sqrt(dx*dx + dy*dy));
      }
      this.scLapTotalLen = this.scLapArcLen[this.scLapArcLen.length - 1] || 1;

      // Store water pit info for jump detection
      const spur = buildSpurPath(cfg);
      spur.waterPit = { x: wpDrawX, y: wpY, size: pitSize };
      spur.points = centerPts.map(cp => ({ x: cp.x, y: cp.y }));
      this.spurPath = spur;

      // ── Regular barriers ──
      // H1 (0.30, right curve): perpendicular to curve
      // H2 (0.53), H3 (0.65): vertical on top straight
      // H5 (0.12): vertical on bottom straight
      // Draw barriers perpendicular to track at their position
      // H2 (0.499, right curve), H3 (0.700, top straight), H5 (0.099, bottom straight)
      const otherBarriers = [0.499, 0.700, 0.099];
      for (const prog of otherBarriers) {
        const ptMid = getTrackPoint(2.5, prog, cfg);
        const ptBefore = getTrackPoint(2.5, prog - 0.005, cfg);
        const ptAfter = getTrackPoint(2.5, prog + 0.005, cfg);
        const tx = ptAfter.x - ptBefore.x;
        const ty = ptAfter.y - ptBefore.y;
        const tlen = Math.sqrt(tx * tx + ty * ty) || 1;
        const perpX = -ty / tlen;
        const perpY = tx / tlen;
        const halfBarrier = cfg.laneWidth * 2;

        barrierGfx.lineStyle(4, 0x663300, 0.95);
        barrierGfx.lineBetween(
          ptMid.x - perpX * halfBarrier, ptMid.y - perpY * halfBarrier,
          ptMid.x + perpX * halfBarrier, ptMid.y + perpY * halfBarrier,
        );
        barrierGfx.lineStyle(2, 0xffffff, 0.8);
        barrierGfx.lineBetween(
          ptMid.x - perpX * halfBarrier * 0.4, ptMid.y - perpY * halfBarrier * 0.4,
          ptMid.x + perpX * halfBarrier * 0.4, ptMid.y + perpY * halfBarrier * 0.4,
        );
        barrierGfx.fillStyle(0x444444, 0.9);
        barrierGfx.fillCircle(ptMid.x - perpX * halfBarrier, ptMid.y - perpY * halfBarrier, 3);
        barrierGfx.fillCircle(ptMid.x + perpX * halfBarrier, ptMid.y + perpY * halfBarrier, 3);
      }

      // H1 on right curve — perpendicular to the curve (tangent direction)
      // Fades in after first lap, skipped on first pass
      {
        const prog = 0.299;
        const ptMid = getTrackPoint(2.5, prog, cfg); // center of barrier
        // Get tangent by sampling adjacent points
        const ptBefore = getTrackPoint(2.5, prog - 0.005, cfg);
        const ptAfter = getTrackPoint(2.5, prog + 0.005, cfg);
        const tx = ptAfter.x - ptBefore.x;
        const ty = ptAfter.y - ptBefore.y;
        const tlen = Math.sqrt(tx * tx + ty * ty) || 1;
        // Perpendicular to tangent = the barrier direction
        const perpX = -ty / tlen;
        const perpY = tx / tlen;
        const halfBarrier = cfg.laneWidth * 2; // spans ~4 lanes

        // Store H1 as a Phaser graphics object so we can fade it in
        const h1Gfx = this.add.graphics().setDepth(4).setAlpha(0);
        h1Gfx.lineStyle(4, 0x663300, 0.95);
        h1Gfx.lineBetween(
          ptMid.x - perpX * halfBarrier, ptMid.y - perpY * halfBarrier,
          ptMid.x + perpX * halfBarrier, ptMid.y + perpY * halfBarrier,
        );
        h1Gfx.lineStyle(2, 0xffffff, 0.8);
        h1Gfx.lineBetween(
          ptMid.x - perpX * halfBarrier * 0.4, ptMid.y - perpY * halfBarrier * 0.4,
          ptMid.x + perpX * halfBarrier * 0.4, ptMid.y + perpY * halfBarrier * 0.4,
        );
        h1Gfx.fillStyle(0x444444, 0.9);
        h1Gfx.fillCircle(ptMid.x - perpX * halfBarrier, ptMid.y - perpY * halfBarrier, 3);
        h1Gfx.fillCircle(ptMid.x + perpX * halfBarrier, ptMid.y + perpY * halfBarrier, 3);

        // Store reference for fade-in during race
        (this as any)._h1Gfx = h1Gfx;
        (this as any)._h1FadedIn = false;
      }
    }

    // ── Stadium name (if set) ──
    if (this.stadiumConfig?.stadiumName) {
      this.add.text(W / 2, 16, this.stadiumConfig.stadiumName, {
        fontSize: '18px', fontFamily: 'Arial Black', color: '#FFD700',
        stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5, 0).setDepth(10);
    }

    // ── Center-field display (inside the infield oval) ──
    const cx = cfg.centerX;
    const cy = cfg.centerY;

    // Event name — big and bold in the center
    this.centerDistText = this.add.text(cx, cy - 45, this.eventType, {
      fontSize: '72px', fontFamily: 'Arial Black, sans-serif',
      color: '#ffffff', stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5, 0.5).setAlpha(0.3).setDepth(2);

    // Live timer — large underneath
    this.centerTimeText = this.add.text(cx, cy + 10, '0.000s', {
      fontSize: '44px', fontFamily: 'Arial Black, sans-serif',
      color: '#FFD700', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5, 0.5).setDepth(2);

    // Splits display — below the timer
    this.splitsText = this.add.text(
      this.eventType === '2000mSC' ? cx - 210 : cx, cy + 45, '', {
      fontSize: '22px', fontFamily: 'Arial Black, sans-serif',
      color: '#fff', stroke: '#000', strokeThickness: 4,
      align: 'left', lineSpacing: 6,
    }).setOrigin(this.eventType === '2000mSC' ? 0 : 0.5, 0).setDepth(2);
    if (this.eventType === '2000mSC') {
      (this as any)._splitsText2 = this.add.text(cx + 20, cy + 45, '', {
        fontSize: '22px', fontFamily: 'Arial Black, sans-serif',
        color: '#fff', stroke: '#000', strokeThickness: 4,
        align: 'left', lineSpacing: 6,
      }).setOrigin(0, 0).setDepth(2);
    }

    this.playerSplits = [];
    this.lastSplitDistance = 0;

    // Hidden — kept as fields so applyFrame doesn't error, but not shown
    this.eventLabel = this.add.text(0, 0, '').setAlpha(0);
    this.positionText = this.add.text(0, 0, '').setAlpha(0);
    this.timerText = this.add.text(0, 0, '').setAlpha(0);

    // ── HUD: Pause button (top-left) ──
    const pauseBtn = this.add.text(20, 16, '⏸ PAUSE', {
      fontSize: '16px', fontFamily: 'Arial', fontStyle: 'bold',
      color: '#fff', backgroundColor: '#00000088',
      padding: { x: 12, y: 6 },
    }).setDepth(50).setInteractive({ useHandCursor: true });
    pauseBtn.on('pointerdown', () => this.togglePause());

    // ── HUD: Speed controls ──
    this.speedBtns = [];
    ['1x', '2x', '4x'].forEach((lbl, i) => {
      const btn = this.add.text(W - 140 + i * 48, H - 22, lbl, {
        fontSize: '14px', fontFamily: 'Arial', fontStyle: 'bold',
        color: i === 0 ? '#FFD700' : '#aaa',
        backgroundColor: '#22222288', padding: { x: 10, y: 5 },
      }).setOrigin(0.5, 1).setDepth(10).setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => {
        this.playbackSpeed = [1, 2, 4][i];
        this.frameAccum = 0; // reset accumulator on speed change
        this.speedBtns.forEach((b, j) => b.setColor(j === i ? '#FFD700' : '#aaa'));
      });
      this.speedBtns.push(btn);
    });

    // ── HUD: Player's Big Impact Card ──
    // Find the player's boost name by scanning frames for active boosts on their lane
    let playerBoostName = '';
    for (const frame of this.frames) {
      const runner = frame.runners.find(r => r.lane === this.playerLane);
      if (runner && runner.activeBoosts.length > 0) {
        playerBoostName = runner.activeBoosts[0];
        break;
      }
    }
    const boostEmojis: Record<string, string> = {
      'Perfect Start': '🚀', 'Turbo Start': '🚀', 'Adrenaline Rush': '🔥',
      'Second Wind': '💨', 'Speed Burst': '⚡', 'Final Kick': '⚡',
      'Thunder Strike': '⚡', 'Intimidate': '😤', 'Draft Surge': '🌊',
      'Iron Legs': '🦿', 'Crowd Favorite': '👑', 'Zen Focus': '🧘',
    };
    this.playerBoostName = playerBoostName;
    if (playerBoostName) {
      const emoji = boostEmojis[playerBoostName] || '⭐';
      // Measure text width first to size the box
      const tempLabel = this.add.text(0, 0, playerBoostName, {
        fontSize: '11px', fontFamily: 'Arial', fontStyle: 'bold',
      });
      const textWidth = tempLabel.width;
      tempLabel.destroy();
      const boxWidth = Math.max(textWidth + 45, 120); // 45 = emoji space + padding
      const boostBg = this.add.rectangle(20, H - 70, boxWidth, 50, 0x000000, 0.6)
        .setStrokeStyle(1, 0x00ccff, 0.6).setDepth(10).setOrigin(0, 0.5);
      this.boostCardBg = boostBg;
      this.add.text(28, H - 70, emoji, {
        fontSize: '24px',
      }).setOrigin(0, 0.5).setDepth(11);
      this.add.text(55, H - 78, playerBoostName, {
        fontSize: '11px', fontFamily: 'Arial', fontStyle: 'bold',
        color: '#00ccff', stroke: '#000', strokeThickness: 1,
      }).setDepth(11);
      this.add.text(55, H - 64, 'BIG IMPACT', {
        fontSize: '9px', fontFamily: 'Arial', color: '#888',
      }).setDepth(11);
    }

    // ── HUD: Minimap ──
    this.add.rectangle(W - 90, 55, 155, 95, 0x000000, 0.5)
      .setStrokeStyle(1, 0xffffff, 0.4).setDepth(10);
    this.add.text(W - 90, 12, 'MINIMAP', {
      fontSize: '8px', fontFamily: 'Arial', color: '#aaa',
    }).setOrigin(0.5, 0).setDepth(10);
    this.minimapGfx = this.add.graphics().setDepth(11);

    // ── HUD: Personal Records (bottom-left, hidden until race ends) ──
    this.recordsText = this.add.text(0, 0, '', { fontSize: '1px' }).setAlpha(0);

    // ── Countdown (above the distance label in the infield) ──
    this.countdownText = this.add.text(cfg.centerX, cfg.centerY - 150, '', {
      fontSize: '80px', fontFamily: 'Arial Black, sans-serif',
      color: '#FFD700', stroke: '#000', strokeThickness: 8,
      align: 'center',
    }).setOrigin(0.5, 0.5).setAlpha(0).setDepth(20);

    // Start crowd roar at scene load (if not muted)
    const globalMuted = localStorage.getItem('winbig_muted') === 'true';
    startCrowd();
    setCrowdVolume(globalMuted ? 0 : 0.45, 0.5);
    this.crowdState = 'idle';

    this.startCountdown();
  }

  private playAnnouncerSound(text: string) {
    if (!('speechSynthesis' in window)) return;
    if (localStorage.getItem('winbig_muted') === 'true') return;
    // Cancel any previous speech first to prevent overlapping
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Daniel') || v.name.includes('Samantha'))
    ) || voices.find(v => v.lang.startsWith('en-US')) || voices.find(v => v.lang.startsWith('en'));
    if (preferred) utter.voice = preferred;
    utter.rate = Math.min(2, 0.95 * this.playbackSpeed);
    utter.pitch = 0.85;
    utter.volume = 0.9;
    window.speechSynthesis.speak(utter);
  }

  private playGunshot() {
    if (localStorage.getItem('winbig_muted') === 'true') return;
    const ctx = new AudioContext();
    const t = ctx.currentTime;

    // Layer 1: Sharp transient crack (the "pop")
    const crackBuf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
    const crackData = crackBuf.getChannelData(0);
    for (let i = 0; i < crackData.length; i++) {
      // Very fast decay white noise — sharp crack
      crackData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.004));
    }
    const crackSrc = ctx.createBufferSource();
    crackSrc.buffer = crackBuf;
    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(0.9, t);
    crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    crackSrc.connect(crackGain);
    crackGain.connect(ctx.destination);
    crackSrc.start(t);

    // Layer 2: Mid-frequency punch (body of the shot)
    const punchOsc = ctx.createOscillator();
    const punchGain = ctx.createGain();
    punchOsc.type = 'square';
    punchOsc.frequency.setValueAtTime(800, t);
    punchOsc.frequency.exponentialRampToValueAtTime(100, t + 0.05);
    punchGain.gain.setValueAtTime(0.6, t);
    punchGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    punchOsc.connect(punchGain);
    punchGain.connect(ctx.destination);
    punchOsc.start(t);
    punchOsc.stop(t + 0.07);

    // Layer 3: Low boom (resonance)
    const boomOsc = ctx.createOscillator();
    const boomGain = ctx.createGain();
    boomOsc.type = 'sine';
    boomOsc.frequency.setValueAtTime(300, t);
    boomOsc.frequency.exponentialRampToValueAtTime(30, t + 0.12);
    boomGain.gain.setValueAtTime(0.5, t);
    boomGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    boomOsc.connect(boomGain);
    boomGain.connect(ctx.destination);
    boomOsc.start(t);
    boomOsc.stop(t + 0.2);

    // Layer 4: Tail echo (stadium reverb feel)
    const tailBuf = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
    const tailData = tailBuf.getChannelData(0);
    for (let i = 0; i < tailData.length; i++) {
      tailData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.08));
    }
    const tailSrc = ctx.createBufferSource();
    tailSrc.buffer = tailBuf;
    const tailGain = ctx.createGain();
    tailGain.gain.setValueAtTime(0.15, t + 0.01);
    tailGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    const tailFilter = ctx.createBiquadFilter();
    tailFilter.type = 'bandpass';
    tailFilter.frequency.value = 2000;
    tailFilter.Q.value = 0.5;
    tailSrc.connect(tailFilter);
    tailFilter.connect(tailGain);
    tailGain.connect(ctx.destination);
    tailSrc.start(t + 0.01);

    setTimeout(() => ctx.close(), 1500);
  }

  private applyTurfImage(turfKey: string = 'turf_green') {
    if (!this.textures.exists(turfKey)) return;
    const cfg = this.cfg;
    const infieldW = cfg.straightLength + cfg.innerRadius * 2;
    const infieldH = cfg.innerRadius * 2;
    const tex = this.textures.get(turfKey).getSourceImage();
    const scale = Math.max(infieldW / tex.width, infieldH / tex.height) * 1.02;

    const turfImg = this.add.image(cfg.centerX, cfg.centerY + infieldH * 0.045, turfKey)
      .setScale(scale).setDepth(1);

    // Oval mask clipped to the infield
    const maskGfx = this.make.graphics({ x: 0, y: 0 });
    maskGfx.fillStyle(0xffffff, 1);
    maskGfx.fillRoundedRect(
      cfg.centerX - cfg.straightLength / 2 - cfg.innerRadius,
      cfg.centerY - cfg.innerRadius,
      infieldW, infieldH, cfg.innerRadius,
    );
    turfImg.setMask(maskGfx.createGeometryMask());
  }

  private countdownId: number = 0;
  private boostCardBg: Phaser.GameObjects.Rectangle | null = null;
  private playerBoostName: string = ''; // increments each countdown to kill stale ones

  private startCountdown() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.cancel(); // kill any leftover speech
    }

    // Each countdown gets a unique ID — stale loops from replays will self-terminate
    this.countdownId++;
    const myId = this.countdownId;

    let lastTickTime = Date.now();
    let accumulatedMs = 0;
    let phase = 0;

    const countdownCheck = () => {
      // Kill if scene restarted (new countdown has a different ID)
      if (myId !== this.countdownId) return;
      if (this.isPaused) { lastTickTime = Date.now(); requestAnimationFrame(countdownCheck); return; }

      const now = Date.now();
      const dt = now - lastTickTime;
      lastTickTime = now;
      accumulatedMs += Math.min(dt, 50) * this.playbackSpeed; // cap at 50ms for smoother timing
      const elapsed = accumulatedMs;

      if (phase === 0 && elapsed >= 200) {
        phase = 1;
        this.countdownText.setFontSize(36);
        this.countdownText.setText('RUNNERS,\nTAKE YOUR MARKS!').setAlpha(1).setScale(1);
        if (this.playbackSpeed <= 1) this.playAnnouncerSound('Runners, take your marks!');
        setCrowdVolume(0.08, 1.0);
        this.crowdState = 'countdown';
      } else if (phase === 1 && elapsed >= 1800) {
        phase = 2;
        this.countdownText.setText('SET!').setAlpha(1).setScale(1.3).setFontSize(60);
        if (this.playbackSpeed <= 1) this.playAnnouncerSound('Set!');
        setCrowdVolume(0.03, 0.4);
      } else if (phase === 2 && elapsed >= 2800) {
        phase = 3;
        this.playGunshot();
        this.countdownText.setText('GO!').setAlpha(1).setScale(1.8).setFontSize(80);
        this.tweens.add({
          targets: this.countdownText,
          alpha: 0, scale: 1, duration: Math.round(500 / this.playbackSpeed), ease: 'Power2',
        });
        setCrowdVolume(0.5, 0.3);
        this.crowdState = 'raceStart';
        this.raceStartFrame = 0;
        this.finishedCount = 0;
        this.isPlaying = true;
        this.lastUpdateTime = Date.now();
        if (localStorage.getItem('winbig_muted') !== 'true') {
          startMusic();
        }
        return;
      }
      requestAnimationFrame(countdownCheck);
    };
    requestAnimationFrame(countdownCheck);

    // Dummy event (not used, keeps structure)
    let idx = 0;
    this.time.addEvent({
      delay: 99999, repeat: 0,
      callback: () => { idx++; },
    });
  }

  private lastUpdateTime: number = 0;

  update(_time: number, delta: number) {
    if (!this.isPlaying || this.raceFinished || this.isPaused) return;

    // Always use real wall clock delta (not Phaser's delta which gets throttled)
    const now = Date.now();
    if (this.lastUpdateTime === 0) this.lastUpdateTime = now;
    const realDelta = now - this.lastUpdateTime;
    this.lastUpdateTime = now;

    // Advance frames based on real elapsed time
    this.frameAccum += realDelta * this.playbackSpeed;
    const msPerTick = 1000 / 60;

    // Process up to 2 frames visually per update for smoothness
    let rendered = 0;
    while (this.frameAccum >= msPerTick && this.currentFrame < this.frames.length) {
      this.frameAccum -= msPerTick;
      this.currentFrame++;
      rendered++;
      // Only render every Nth frame to keep it smooth when catching up
      if (rendered <= 2 || this.frameAccum < msPerTick) {
        this.applyFrame(this.frames[this.currentFrame - 1]);
      }
    }
    // If we skipped rendering, make sure we show the final position
    if (rendered > 2 && this.currentFrame > 0) {
      this.applyFrame(this.frames[this.currentFrame - 1]);
    }

    if (this.currentFrame >= this.frames.length && !this.raceFinished) {
      this.raceFinished = true;
      this.isPlaying = false;
      this.time.delayedCall(600, () => this.showResults());
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Draw a stick-figure runner at (x, y)
  // ═══════════════════════════════════════════════════════════
  private drawRunner(
    gfx: Phaser.GameObjects.Graphics,
    x: number, y: number,
    lane: number, phase: number,
    isRunning: boolean, isFinished: boolean, isPlayer: boolean,
    jumping: boolean = false,
  ) {
    gfx.clear();
    // Determine appearance: player customization > challenge laneMetadata > default bot
    const pa = isPlayer && this.playerAppearance ? this.playerAppearance : null;
    const lm = this.laneMetadata[lane]?.appearance || null;
    const app = pa || lm; // player appearance takes priority, then challenge metadata

    const BOT_HAIR_COLORS = [0x222222, 0x4a3000, 0x8B4513, 0xDAA520, 0xCC3300, 0x888888, 0x111111, 0x553311];
    const BOT_HAIR_STYLES = [0, 1, 2, 4, 5, 0, 1, 2];
    const BOT_SHORTS = [0x222244, 0x000000, 0x222222, 0x002244, 0x440022, 0x004422, 0x333333, 0x220022];
    const BOT_SHOES = [0x222222, 0xffffff, 0xff2200, 0x0044ff, 0x222222, 0x00aa00, 0xff8800, 0x000000];

    const color = app ? app.jerseyColor : LANE_COLORS[lane - 1];
    const skin = app ? (PLAYER_SKIN_TONES[app.skinTone] || SKIN_TONES[lane - 1]) : SKIN_TONES[lane - 1];
    const hairColor = app ? app.hairColor : BOT_HAIR_COLORS[lane - 1];
    const hairStyle = app ? app.hairStyle : BOT_HAIR_STYLES[lane - 1];
    const shortsColor = app ? app.shortsColor : BOT_SHORTS[lane - 1];
    const shoeColor = app ? app.shoeColor : BOT_SHOES[lane - 1];
    const accessory = app ? app.accessory : 0;
    const s = isPlayer ? 1.0 : 0.85;
    // At high speed, skip outlines for performance (saves ~50% draw calls)
    const drawOutlines = this.playbackSpeed <= 1 || isPlayer;

    // Animation: arms and legs swing with sin/cos of phase
    // Jumping pose: big lead leg extension, trail leg tucked, strong lean, arms up
    const legSwing = jumping ? 0.6 : isRunning ? Math.sin(phase) * 0.5 : 0;
    const armSwing = jumping ? -0.5 : isRunning ? Math.sin(phase + Math.PI) * 0.4 : 0;
    const bodyBob = jumping ? -1 : isRunning ? Math.abs(Math.sin(phase)) * 1.5 : 0;
    const lean = jumping ? 3 * s : isRunning ? 2 * s : 0;

    // (x, y) = foot/ground position on the track lane center
    // Build body upward from feet
    const groundY = y;
    const cx = x + lean;
    const legLen = 11 * s;   // total leg length from hip to foot
    const hipY = groundY - legLen + bodyBob;
    const torsoH = 12 * s;
    const torsoTop = hipY - torsoH;
    const headY = torsoTop - 6 * s + bodyBob;

    // Shadow at ground level
    gfx.fillStyle(0x000000, 0.25);
    gfx.fillEllipse(x, groundY + 2, 16 * s, 5 * s);

    const ol = 1.2 * s; // outline thickness

    // Legs — black outline first, then skin
    // Leg geometry: from below shorts down to ground
    const legTop = hipY + 3 * s; // just below shorts hem
    const halfLeg = (groundY - legTop) / 2;
    const lKneeX = cx - 1 * s + legSwing * 4 * s;
    const lKneeY = legTop + halfLeg;
    const lFootX = cx - 1.5 * s + legSwing * 7 * s;
    const lFootY = groundY - Math.abs(legSwing) * 2 * s; // lifts when kicking

    const rKneeX = cx + 1 * s - legSwing * 4 * s;
    const rKneeY = legTop + halfLeg;
    const rFootX = cx + 1.5 * s - legSwing * 7 * s;
    const rFootY = groundY - Math.abs(legSwing) * 2 * s;

    // Back leg (the one swinging backward) — drawn first so front leg overlaps
    const leftBack = legSwing > 0; // left leg is forward when legSwing > 0
    const backFootX = leftBack ? rFootX : lFootX;
    const backFootY = leftBack ? rFootY : lFootY;
    const backKneeX = leftBack ? rKneeX : lKneeX;
    const backKneeY = leftBack ? rKneeY : lKneeY;
    const frontFootX = leftBack ? lFootX : rFootX;
    const frontFootY = leftBack ? lFootY : rFootY;
    const frontKneeX = leftBack ? lKneeX : rKneeX;
    const frontKneeY = leftBack ? lKneeY : rKneeY;

    // Back leg
    if (drawOutlines) {
      gfx.lineStyle(3.5 * s, 0x000000, 1);
      gfx.beginPath(); gfx.moveTo(cx, legTop); gfx.lineTo(backKneeX, backKneeY); gfx.lineTo(backFootX, backFootY); gfx.strokePath();
    }
    gfx.lineStyle(2.5 * s, skin, 1);
    gfx.beginPath(); gfx.moveTo(cx, legTop); gfx.lineTo(backKneeX, backKneeY); gfx.lineTo(backFootX, backFootY); gfx.strokePath();
    // Back shoe
    if (drawOutlines) { gfx.fillStyle(0x000000, 1); gfx.fillCircle(backFootX, backFootY, 3 * s); }
    gfx.fillStyle(shoeColor, 1);
    gfx.fillCircle(backFootX, backFootY, 2.5 * s);

    // Shorts
    if (drawOutlines) { gfx.fillStyle(0x000000, 1); gfx.fillRoundedRect(cx - 5 * s - ol, hipY - 1 * s - ol, 10 * s + ol * 2, 5 * s + ol * 2, 2.5 * s); }
    gfx.fillStyle(shortsColor, 1);
    gfx.fillRoundedRect(cx - 5 * s, hipY - 1 * s, 10 * s, 5 * s, 2 * s);

    // Front leg
    if (drawOutlines) {
      gfx.lineStyle(3.5 * s, 0x000000, 1);
      gfx.beginPath(); gfx.moveTo(cx, legTop); gfx.lineTo(frontKneeX, frontKneeY); gfx.lineTo(frontFootX, frontFootY); gfx.strokePath();
    }
    gfx.lineStyle(2.5 * s, skin, 1);
    gfx.beginPath(); gfx.moveTo(cx, legTop); gfx.lineTo(frontKneeX, frontKneeY); gfx.lineTo(frontFootX, frontFootY); gfx.strokePath();
    // Front shoe
    if (drawOutlines) { gfx.fillStyle(0x000000, 1); gfx.fillCircle(frontFootX, frontFootY, 3 * s); }
    gfx.fillStyle(shoeColor, 1);
    gfx.fillCircle(frontFootX, frontFootY, 2.5 * s);

    // Torso (jersey)
    if (drawOutlines) { gfx.fillStyle(0x000000, 1); gfx.fillRoundedRect(cx - 5 * s - ol, torsoTop - ol, 10 * s + ol * 2, 12 * s + ol * 2, 3.5 * s); }
    gfx.fillStyle(color, 1);
    gfx.fillRoundedRect(cx - 5 * s, torsoTop, 10 * s, 12 * s, 3 * s);

    // Arms — different pose for finished vs running/standing
    const shoulderY = torsoTop + 2 * s;
    let lHandX: number, lHandY: number, rHandX: number, rHandY: number;

    if (isFinished) {
      // Arms up celebration
      lHandX = cx - 10 * s;
      lHandY = shoulderY - 12 * s;
      rHandX = cx + 10 * s;
      rHandY = shoulderY - 12 * s;
    } else if (jumping) {
      // Hurdle jump: one arm forward, one back — classic hurdler form
      lHandX = cx + 8 * s; // lead arm forward
      lHandY = shoulderY - 4 * s;
      rHandX = cx - 4 * s; // trail arm tucked back
      rHandY = shoulderY - 10 * s;
    } else {
      // Normal running/standing arms
      lHandX = cx - 8 * s + armSwing * 8 * s;
      lHandY = shoulderY + 10 * s + armSwing * 3 * s;
      rHandX = cx + 8 * s - armSwing * 8 * s;
      rHandY = shoulderY + 10 * s - armSwing * 3 * s;
    }

    if (drawOutlines) {
      gfx.lineStyle(3 * s, 0x000000, 1);
      gfx.beginPath(); gfx.moveTo(cx - 4 * s, shoulderY); gfx.lineTo(lHandX, lHandY); gfx.strokePath();
      gfx.beginPath(); gfx.moveTo(cx + 4 * s, shoulderY); gfx.lineTo(rHandX, rHandY); gfx.strokePath();
    }
    gfx.lineStyle(2 * s, skin, 1);
    gfx.beginPath(); gfx.moveTo(cx - 4 * s, shoulderY); gfx.lineTo(lHandX, lHandY); gfx.strokePath();
    gfx.beginPath(); gfx.moveTo(cx + 4 * s, shoulderY); gfx.lineTo(rHandX, rHandY); gfx.strokePath();

    // Head
    if (drawOutlines) { gfx.fillStyle(0x000000, 1); gfx.fillCircle(cx, headY, 6.5 * s); }
    gfx.fillStyle(skin, 1);
    gfx.fillCircle(cx, headY, 5.5 * s);

    // Hair — positioned at the top of the head (headY - 5.5*s = crown)
    const crownY = headY - 5.5 * s;
    gfx.fillStyle(hairColor, 1);
    switch (hairStyle) {
      case 1: // Bald — no hair
        break;
      case 2: // Afro — big round above head
        gfx.fillCircle(cx, crownY - 1 * s, 7.5 * s);
        gfx.fillStyle(skin, 1);
        gfx.fillCircle(cx, headY, 5.5 * s);
        break;
      case 3: // (Removed) — no hair
        break;
      case 4: // Mohawk — strip on top
        gfx.fillRoundedRect(cx - 1.5 * s, crownY - 5 * s, 3 * s, 7 * s, 1.5 * s);
        break;
      case 5: // Long — cap on top, sides start higher
        gfx.fillEllipse(cx, crownY + 1 * s, 12 * s, 5 * s);
        gfx.fillRect(cx - 6 * s, crownY + 1 * s, 2.5 * s, 8 * s);
        gfx.fillRect(cx + 3.5 * s, crownY + 1 * s, 2.5 * s, 8 * s);
        break;
      default: // Short crop (0) — neat cap
        gfx.fillEllipse(cx, crownY + 1.5 * s, 10 * s, 4.5 * s);
    }

    // Headband accessory
    if (accessory === 1) {
      gfx.fillStyle(color, 1);
      gfx.fillRect(cx - 6 * s, headY - 3 * s, 12 * s, 2 * s);
    }
    // Sunglasses accessory
    if (accessory === 2) {
      gfx.fillStyle(0x111111, 1);
      gfx.fillRoundedRect(cx - 5 * s, headY - 2 * s, 4 * s, 2.5 * s, 1 * s);
      gfx.fillRoundedRect(cx + 1 * s, headY - 2 * s, 4 * s, 2.5 * s, 1 * s);
      gfx.fillRect(cx - 1 * s, headY - 1.5 * s, 2 * s, 1 * s);
    }
    // Wristbands accessory
    if (accessory === 3) {
      gfx.fillStyle(color, 1);
      gfx.fillCircle(lHandX, lHandY, 2 * s);
      gfx.fillCircle(rHandX, rHandY, 2 * s);
    }

    // Player gold outline
    if (isPlayer) {
      gfx.lineStyle(1.5, 0xffd700, 0.8);
      gfx.strokeCircle(cx, headY, 6.5 * s);
    }

    // (celebration pose is now handled in the arms section above)
  }

  // ═══════════════════════════════════════════════════════════
  // Apply a simulation frame
  // ═══════════════════════════════════════════════════════════
  private applyFrame(frame: RaceFrame) {
    const { cfg, W, H } = this;

    const raceTimeMs = Math.round(frame.tick / 60 * 1000);
    const raceTimeStr = formatRaceTime(raceTimeMs);
    this.timerText.setText(raceTimeStr);

    // Center-field live timer
    this.centerTimeText.setText(raceTimeStr);

    // Track player's 200m splits
    const playerData = frame.runners.find(r => r.lane === this.playerLane);
    if (playerData) {
      const splitInterval = 200;
      const nextSplit = this.lastSplitDistance + splitInterval;
      if (playerData.distance >= nextSplit && this.lastSplitDistance < this.raceDistance) {
        this.playerSplits.push({
          distance: nextSplit,
          time: raceTimeStr,
        });
        this.lastSplitDistance = nextSplit;

        // Update splits display
        if (this.eventType === '2000mSC') {
          // Column 1: 200m-1000m, Column 2: 1200m-2000m
          const col1: string[] = [];
          const col2: string[] = [];
          for (const sp of this.playerSplits) {
            const line = `${sp.distance}m: ${sp.time}`;
            if (sp.distance <= 1000) col1.push(line); else col2.push(line);
          }
          this.splitsText.setText(col1.join('\n'));
          const splitsText2 = (this as any)._splitsText2 as Phaser.GameObjects.Text;
          if (splitsText2) splitsText2.setText(col2.join('\n'));
        } else {
          let splitsStr = '';
          for (const sp of this.playerSplits) {
            splitsStr += `${sp.distance}m: ${sp.time}\n`;
          }
          this.splitsText.setText(splitsStr);
        }
      }
    }

    const sorted = [...frame.runners].sort((a, b) => b.distance - a.distance);
    let posLines = '';
    sorted.forEach((r, i) => {
      const you = r.lane === this.playerLane ? '  <<' : '';
      const fin = r.finished ? '  FIN' : '';
      posLines += `${i + 1}. L${r.lane} ${r.distance.toFixed(0)}m${you}${fin}\n`;
    });
    this.positionText.setText(posLines);

    // ── Crowd noise logic ──
    this.raceStartFrame++;
    const leadRunner = sorted[0]; // most distance covered
    const newFinished = frame.runners.filter(r => r.finished).length;

    if (this.crowdState === 'raceStart' && this.raceStartFrame > 180) {
      // 3 seconds after gun: crowd settles to a murmur
      setCrowdVolume(0.10, 2.0);
      this.crowdState = 'racing';
    }

    if (this.crowdState === 'racing' && leadRunner) {
      // Check if leader is on the final straight (last ~20% of race)
      const leadPct = leadRunner.distance / this.raceDistance;
      if (leadPct > 0.80) {
        // Crowd roars for the home stretch!
        setCrowdVolume(0.5, 1.0);
        this.crowdState = 'homeStretch';
      }
    }

    if (this.crowdState === 'homeStretch' && newFinished !== this.finishedCount) {
      this.finishedCount = newFinished;
      if (newFinished >= 5) {
        // Top 5 have finished — start fading crowd
        setCrowdVolume(0.05, 3.0);
        this.crowdState = 'finished';
      }
    }

    for (const rd of frame.runners) {
      const rv = this.runners[rd.lane - 1];
      if (!rv) continue;

      // Performance: skip redrawing bots at high playback speeds
      // At 2x: redraw bots every 2nd frame. At 4x: every 3rd frame.
      if (!rv.isPlayer && this.playbackSpeed >= 2) {
        const skipRate = this.playbackSpeed >= 4 ? 3 : 2;
        if (this.currentFrame % skipRate !== 0) continue;
      }

      let fx: number, fy: number;
      let isRunning = !rd.finished && rd.speed > 1;
      let isWalking = false;

      if (rd.finished) {
        // For 800m, runners finish in lane 1 — use lane 1 for all post-finish movement
        const finishLane = (this.eventType === '800m' || this.eventType === '2000mSC') ? 1 : rd.lane;

        if (rv.finishedTick < 0) {
          rv.finishedTick = this.currentFrame;
          // Walk target: forward past the finish line into the curve, then infield
          const finishProg = getFinishProgress(finishLane, cfg);
          const pastFinish = getTrackPoint(finishLane, finishProg + 0.08 + Math.random() * 0.07, cfg);
          rv.walkTarget = {
            x: pastFinish.x + (cfg.centerX - pastFinish.x) * (0.3 + Math.random() * 0.4),
            y: pastFinish.y + (cfg.centerY - pastFinish.y) * (0.3 + Math.random() * 0.4),
          };
        }

        const ticksSinceFinish = this.currentFrame - rv.finishedTick;
        if (rv.walkTarget && ticksSinceFinish > 60) {
          const tdx = rv.walkTarget.x - rv.prevPos.x;
          const tdy = rv.walkTarget.y - rv.prevPos.y;
          const dist = Math.sqrt(tdx * tdx + tdy * tdy);
          if (dist > 3) {
            const walkSpd = 0.4 * this.playbackSpeed;
            rv.prevPos.x += (tdx / dist) * walkSpd;
            rv.prevPos.y += (tdy / dist) * walkSpd;
            rv.animPhase += 0.06 * this.playbackSpeed;
            isWalking = true;
          }
        } else if (ticksSinceFinish <= 60) {
          // Slow deceleration jog past finish line — from lane 1 for 800m
          const finishProg2 = getFinishProgress(finishLane, cfg);
          const coastProg = finishProg2 + (ticksSinceFinish / 60) * 0.008;
          const coastPos = getTrackPoint(finishLane, coastProg, cfg);
          rv.prevPos.x = coastPos.x;
          rv.prevPos.y = coastPos.y;
          rv.animPhase += 0.04 * this.playbackSpeed;
          isWalking = true;
        }
        fx = rv.prevPos.x;
        fy = rv.prevPos.y;
      } else {
        let pos: Point;
        const totalR = this.frames[0]?.runners.length || (this.eventType === '2000mSC' ? 12 : 8);

        if (this.eventType === '2000mSC' && this.scLapPath.length > 1) {
          // Lap path lookup
          const lapFrac = (rd.distance % 400) / 400;
          const targetDist = lapFrac * this.scLapTotalLen;
          let lo = 0, hi = this.scLapArcLen.length - 1;
          while (hi - lo > 1) {
            const mid2 = (lo + hi) >> 1;
            if (this.scLapArcLen[mid2] <= targetDist) lo = mid2; else hi = mid2;
          }
          const segLen = this.scLapArcLen[hi] - this.scLapArcLen[lo];
          const segFrac = segLen > 0.01 ? (targetDist - this.scLapArcLen[lo]) / segLen : 0;
          const p0 = this.scLapPath[lo];
          const p1 = this.scLapPath[Math.min(hi, this.scLapPath.length - 1)];
          const px = p0.x + (p1.x - p0.x) * segFrac;
          const py = p0.y + (p1.y - p0.y) * segFrac;

          // Perpendicular spread — keep all runners between lane 1 and lane 3
          const prevPt = this.scLapPath[Math.max(0, lo - 1)];
          const nextPt = this.scLapPath[Math.min(hi + 1, this.scLapPath.length - 1)];
          const tdx = nextPt.x - prevPt.x;
          const tdy = nextPt.y - prevPt.y;
          const tlen = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
          const nx = -tdy / tlen;
          const ny = tdx / tlen;

          const runnerFrac = (rd.lane - 1) / Math.max(1, totalR - 1);
          // Pack in lane 1-2 — tight spread, prioritize inside
          const spread = -cfg.laneWidth * 0.3 + runnerFrac * cfg.laneWidth * 0.8;
          pos = { x: px + nx * spread, y: py + ny * spread };

          // Natural cut-in at race start: first 30m, blend from starting spread to pack
          if (rd.distance < 30) {
            const startLane = 1 + ((rd.lane - 1) / Math.max(1, totalR - 1)) * 5;
            const trackProg = distanceToTrackProgress(rd.lane, rd.distance, this.eventType, cfg);
            const spreadPos = getTrackPoint(startLane, trackProg, cfg);
            const blend = rd.distance / 30;
            const eased = blend * blend;
            pos = {
              x: spreadPos.x + (pos.x - spreadPos.x) * eased,
              y: spreadPos.y + (pos.y - spreadPos.y) * eased,
            };
          }

        } else if (this.eventType === '800m') {
          const effectiveLane = getEffectiveLane800(rd.lane, rd.distance);
          const trackProg = distanceToTrackProgress(rd.lane, rd.distance, this.eventType, cfg);
          pos = getTrackPoint(effectiveLane, trackProg, cfg);
        } else {
          const trackProg = distanceToTrackProgress(rd.lane, rd.distance, this.eventType, cfg);
          pos = getTrackPoint(rd.lane, trackProg, cfg);
        }

        const lf = 0.55;
        const pdx = pos.x - rv.prevPos.x;
        const pdy = pos.y - rv.prevPos.y;
        const jump = Math.sqrt(pdx * pdx + pdy * pdy);
        fx = jump > 200 ? pos.x : rv.prevPos.x + pdx * lf;
        fy = jump > 200 ? pos.y : rv.prevPos.y + pdy * lf;
        rv.prevPos = { x: fx, y: fy };
        rv.animPhase += (rd.speed / 10) * 0.35 * this.playbackSpeed;
      }

      // Depth sort by Y
      const depthVal = Math.round(fy);
      rv.gfx.setDepth(depthVal);
      rv.label.setDepth(depthVal + 1);
      rv.trail.setDepth(depthVal - 1);
      rv.boostGlow.setDepth(depthVal + 1);

      // Steeplechase hurdle jump — check visual proximity to barrier positions
      let jumpOffset = 0;
      let isJumping = false;
      if (this.eventType === '2000mSC' && !rd.finished) {
        // Fade in H1 after first right curve completes (~200m into the race)
        const h1Gfx = (this as any)._h1Gfx as Phaser.GameObjects.Graphics | null;
        if (h1Gfx && !(this as any)._h1FadedIn) {
          // Use the lead runner's distance to trigger fade
          const leadDist = Math.max(...frame.runners.map(r => r.distance));
          if (leadDist > 200) {
            (this as any)._h1FadedIn = true;
            this.tweens.add({ targets: h1Gfx, alpha: 1, duration: 800, ease: 'Sine.easeIn' });
          }
        }

        // Check distance from runner's visual position to each barrier's visual position
        // H1 (0.30) is skipped on the first lap (distance < 400)
        const barrierProgs = [0.299, 0.499, 0.700, 0.099];
        const jumpPx = 30;
        const maxH = 10;
        for (const bp of barrierProgs) {
          // Skip H1 on first lap
          if (bp === 0.299 && rd.distance < 400) continue;

          const bpt1 = getTrackPoint(1, bp, cfg);
          const bpt4 = getTrackPoint(4, bp, cfg);
          const bx = (bpt1.x + bpt4.x) / 2;
          const by = (bpt1.y + bpt4.y) / 2;
          const dx = fx - bx;
          const dy = fy - by;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < jumpPx) {
            isJumping = true;
            jumpOffset = (1 - (dist / jumpPx)) * maxH;
            break;
          }
        }
        // Water jump: check proximity to water pit center
        if (!isJumping && this.spurPath) {
          const wp = this.spurPath.waterPit;
          const dx = fx - wp.x;
          const dy = fy - wp.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const wpJumpPx = 40;
          if (dist < wpJumpPx) {
            isJumping = true;
            jumpOffset = (1 - (dist / wpJumpPx)) * 14;
          }
        }
      }

      this.drawRunner(rv.gfx, fx, fy - jumpOffset, rd.lane, rv.animPhase, isRunning || isWalking, rd.finished && !isWalking, rv.isPlayer, isJumping);

      const runnerHeight = (11 + 12 + 12) * (rv.isPlayer ? 1.0 : 0.85);
      rv.label.setPosition(fx, fy - jumpOffset - runnerHeight - 6);
      rv.boostGlow.setPosition(fx, fy - jumpOffset - runnerHeight * 0.5);

      // Purple flashing triangle above player's runner
      if (rv.indicator) {
        rv.indicator.clear();
        const flash = 0.5 + Math.sin(this.currentFrame * 0.15) * 0.5; // 0-1 flash cycle
        const bob = Math.sin(this.currentFrame * 0.08) * 4;
        const iy = fy - runnerHeight - 22 + bob;
        // Solid white fill — flash controls brightness
        const v = Math.round(0xbb + flash * 0x44);
        const col = (v << 16) | (v << 8) | v;
        rv.indicator.fillStyle(col, 1);
        rv.indicator.fillTriangle(fx, iy + 14, fx - 10, iy, fx + 10, iy);
        rv.indicator.lineStyle(3, 0x000000, 1);
        rv.indicator.strokeTriangle(fx, iy + 14, fx - 10, iy, fx + 10, iy);
        rv.indicator.lineStyle(1.5, 0xffd700, 1);
        rv.indicator.strokeTriangle(fx, iy + 14, fx - 10, iy, fx + 10, iy);
        rv.indicator.setDepth(depthVal + 2);
      }

      // Speed trail
      rv.trail.clear();
      if (rv.isPlayer && rd.speed > 8 && !rd.finished) {
        const el = this.eventType === '2000mSC'
          ? getEffectiveLaneSC(rd.lane - 1, rd.distance, this.frames[0]?.runners.length || 12)
          : this.eventType === '800m' ? getEffectiveLane800(rd.lane, rd.distance) : rd.lane;
        const tp = distanceToTrackProgress(rd.lane, rd.distance, this.eventType, cfg);
        const alpha = Math.min(0.4, (rd.speed - 8) / 8);
        for (let i = 1; i <= 3; i++) {
          const pp = getTrackPoint(el, tp - 0.0012 * i, cfg);
          rv.trail.fillStyle(LANE_COLORS[rd.lane - 1], alpha * (1 - i * 0.25));
          rv.trail.fillCircle(pp.x, pp.y, 3 - i * 0.5);
        }
      }

      // Boost glow
      if (rd.activeBoosts.length > 0) {
        const pulse = 0.3 + Math.sin(this.currentFrame * 0.15) * 0.15;
        rv.boostGlow.setFillStyle(0x00ffff, pulse);
        rv.boostGlow.setStrokeStyle(2, 0x00ffff, pulse + 0.2);
        rv.boostGlow.setScale(1.4);
        if (this.currentFrame % 90 === 0) this.popupText(fx, fy - 40, rd.activeBoosts[0], '#00ffff');
      } else {
        rv.boostGlow.setFillStyle(0x000000, 0);
        rv.boostGlow.setStrokeStyle(0);
      }
    }

    // Update Big Impact card glow when boost is active
    if (this.boostCardBg && this.playerBoostName) {
      const playerRunner = frame.runners.find(r => r.lane === this.playerLane);
      const isActive = playerRunner?.activeBoosts.includes(this.playerBoostName);
      if (isActive) {
        const pulse = 0.6 + Math.sin(this.currentFrame * 0.15) * 0.3;
        this.boostCardBg.setFillStyle(0x003344, 0.8);
        this.boostCardBg.setStrokeStyle(2, 0x00ffff, pulse);
      } else {
        this.boostCardBg.setFillStyle(0x000000, 0.6);
        this.boostCardBg.setStrokeStyle(1, 0x00ccff, 0.6);
      }
    }

    this.drawMinimap(frame);
    // Crowd animation disabled for performance
    // this.animateCrowd(this.currentFrame);
  }

  // ═══════════════════════════════════════════════════════════
  // Minimap
  // ═══════════════════════════════════════════════════════════
  private drawMinimap(frame: RaceFrame) {
    const mmCX = this.W - 90;
    const mmCY = 55;
    const mmS = 40;
    const mmR = 24;

    this.minimapGfx.clear();

    this.minimapGfx.lineStyle(2, 0x884444, 0.6);
    this.minimapGfx.beginPath();
    this.minimapGfx.moveTo(mmCX - mmS, mmCY + mmR);
    this.minimapGfx.lineTo(mmCX + mmS, mmCY + mmR);
    for (let a = 0; a <= 20; a++) {
      const ang = -Math.PI / 2 + (a / 20) * Math.PI;
      this.minimapGfx.lineTo(mmCX + mmS + Math.cos(ang) * mmR, mmCY - Math.sin(ang) * mmR);
    }
    this.minimapGfx.lineTo(mmCX - mmS, mmCY - mmR);
    for (let a = 0; a <= 20; a++) {
      const ang = Math.PI / 2 + (a / 20) * Math.PI;
      this.minimapGfx.lineTo(mmCX - mmS + Math.cos(ang) * mmR, mmCY - Math.sin(ang) * mmR);
    }
    this.minimapGfx.closePath();
    this.minimapGfx.strokePath();

    const mmPerim = mmS * 4 + 2 * Math.PI * mmR;
    for (const rd of frame.runners) {
      const tp = distanceToTrackProgress(1, rd.distance, this.eventType);
      const p = ((tp % 1) + 1) % 1;
      const d = p * mmPerim;
      const sA = mmS * 2, sB = sA + Math.PI * mmR, sC = sB + mmS * 2;
      let mx: number, my: number;
      if (d <= sA) { mx = mmCX - mmS + (d / sA) * mmS * 2; my = mmCY + mmR; }
      else if (d <= sB) { const t = (d - sA) / (Math.PI * mmR); const a = -Math.PI / 2 + t * Math.PI; mx = mmCX + mmS + Math.cos(a) * mmR; my = mmCY - Math.sin(a) * mmR; }
      else if (d <= sC) { mx = mmCX + mmS - ((d - sB) / (mmS * 2)) * mmS * 2; my = mmCY - mmR; }
      else { const t = (d - sC) / (Math.PI * mmR); const a = Math.PI / 2 + t * Math.PI; mx = mmCX - mmS + Math.cos(a) * mmR; my = mmCY - Math.sin(a) * mmR; }

      const isP = rd.lane === this.playerLane;
      this.minimapGfx.fillStyle(LANE_COLORS[rd.lane - 1], isP ? 1 : 0.75);
      this.minimapGfx.fillCircle(mx, my, isP ? 4 : 2.5);
      if (isP) { this.minimapGfx.lineStyle(1, 0xffd700, 0.8); this.minimapGfx.strokeCircle(mx, my, 5); }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Animated crowd
  // ═══════════════════════════════════════════════════════════
  /**
   * Generate a SMALL subset of fans for animation. The static crowd is already
   * baked into the background by drawTrack(). We only animate ~120 fans that
   * "jump" on a separate graphics layer — cheap to redraw every few frames.
   */
  private generateCrowdFans() {
    const { cfg } = this;
    const outerR = cfg.innerRadius + cfg.lanes * cfg.laneWidth;
    const standInnerR = outerR + 14;
    const standDepth = 50;
    const halfS = cfg.straightLength / 2;
    const fanColors = [0xff4444, 0x4488ff, 0xffdd44, 0x44ff88, 0xff88ff, 0xff8844, 0xffffff, 0x44ffff];

    this.crowdFans = [];

    // Only place ~120 animated fans spread across 2 rows
    const rows = [1, 3]; // inner and outer tier
    const rowDepth = standDepth / 4;

    for (const row of rows) {
      const rOuter = standInnerR + (4 - row) * rowDepth;
      const rInner = standInnerR + (4 - row - 1) * rowDepth;
      const fanR = (rOuter + rInner) / 2;
      const perimeter = cfg.straightLength * 2 + 2 * Math.PI * fanR;
      const numFans = 40; // 40 per row = 80 total

      for (let i = 0; i < numFans; i++) {
        const d = (i / numFans) * perimeter;
        const sA = cfg.straightLength, sB = sA + Math.PI * fanR, sC = sB + cfg.straightLength;
        let fx: number, fy: number;
        if (d <= sA) {
          fx = cfg.centerX - halfS + (d / sA) * cfg.straightLength;
          fy = cfg.centerY + fanR;
        } else if (d <= sB) {
          const t = (d - sA) / (Math.PI * fanR);
          const ang = -Math.PI / 2 + t * Math.PI;
          fx = cfg.centerX + halfS + Math.cos(ang) * fanR;
          fy = cfg.centerY - Math.sin(ang) * fanR;
        } else if (d <= sC) {
          fx = cfg.centerX + halfS - ((d - sB) / cfg.straightLength) * cfg.straightLength;
          fy = cfg.centerY - fanR;
        } else {
          const t = (d - sC) / (Math.PI * fanR);
          const ang = Math.PI / 2 + t * Math.PI;
          fx = cfg.centerX - halfS + Math.cos(ang) * fanR;
          fy = cfg.centerY - Math.sin(ang) * fanR;
        }

        this.crowdFans.push({
          x: fx, y: fy,
          color: fanColors[i % fanColors.length],
          phase: Math.random() * Math.PI * 2,
          speed: 1.5 + Math.random() * 3,
        });
      }
    }
  }

  /** Redraw only every 8th frame to save CPU. ~80 fans total. */
  private animateCrowd(tick: number) {
    this.crowdFrameSkip++;
    if (this.crowdFrameSkip % 8 !== 0) return;

    this.crowdGfx.clear();
    const time = tick * 0.04;

    for (const fan of this.crowdFans) {
      const cycle = Math.sin(time * fan.speed + fan.phase);
      const jumping = cycle > 0.2;
      const offset = jumping ? -3 - cycle * 4 : 0;

      this.crowdGfx.fillStyle(fan.color, 0.9);
      this.crowdGfx.fillCircle(fan.x, fan.y + offset, 2.5);
      this.crowdGfx.fillRect(fan.x - 1.5, fan.y + offset + 2.5, 3, 3);
    }
  }

  private popupText(x: number, y: number, text: string, color: string) {
    const t = this.add.text(x, y, text, {
      fontSize: '10px', fontFamily: 'Arial Black',
      color, stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5, 1).setDepth(15);
    this.tweens.add({
      targets: t, y: y - 25, alpha: 0, duration: 1100, ease: 'Power2',
      onComplete: () => t.destroy(),
    });
  }

  // ═══════════════════════════════════════════════════════════
  // Results
  // ═══════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════
  // Pause Menu
  // ═══════════════════════════════════════════════════════════
  private togglePause() {
    if (this.raceFinished) return;
    if (this.isPaused) {
      this.hidePauseMenu();
    } else {
      this.showPauseMenu();
    }
  }

  private pauseStartTime: number = 0;

  private showPauseMenu() {
    this.isPaused = true;
    this.pauseStartTime = Date.now();
    this.time.paused = true;
    setCrowdVolume(0, 0.1);
    setMusicVolume(0);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    const { W, H } = this;

    const container = this.add.container(0, 0).setDepth(100);

    // Overlay
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6);
    container.add(overlay);

    // Panel
    const pw = 340, ph = 360;
    const panel = this.add.rectangle(W / 2, H / 2, pw, ph, 0x1a1a1a, 0.95)
      .setStrokeStyle(2, 0xcc2244);
    container.add(panel);

    // Title
    const title = this.add.text(W / 2, H / 2 - ph / 2 + 30, 'PAUSED', {
      fontSize: '32px', fontFamily: 'Arial Black', color: '#fff',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5);
    container.add(title);

    const btnStyle = (y: number, label: string, color: string, onClick: () => void) => {
      const bg = this.add.rectangle(W / 2, y, 260, 44, parseInt(color.slice(1), 16), 1)
        .setStrokeStyle(1, 0xffffff, 0.3).setInteractive({ useHandCursor: true });
      const txt = this.add.text(W / 2, y, label, {
        fontSize: '18px', fontFamily: 'Arial Black', color: '#fff',
      }).setOrigin(0.5);
      bg.on('pointerover', () => bg.setAlpha(0.8));
      bg.on('pointerout', () => bg.setAlpha(1));
      bg.on('pointerdown', onClick);
      container.add(bg);
      container.add(txt);
      return { bg, txt };
    };

    const baseY = H / 2 - 90;
    btnStyle(baseY, 'RESUME', '#44aa44', () => this.hidePauseMenu());
    btnStyle(baseY + 55, 'RESTART', '#4488cc', () => this.restartRace());
    btnStyle(baseY + 110, 'SKIP TO END', '#cc8844', () => this.skipToEnd());

    // Mute toggle
    const isMuted = localStorage.getItem('winbig_muted') === 'true';
    const muteBtn = btnStyle(baseY + 165, isMuted ? '🔇 UNMUTE' : '🔊 MUTE', '#555555', () => {
      const nowMuted = localStorage.getItem('winbig_muted') === 'true';
      const newMuted = !nowMuted;
      localStorage.setItem('winbig_muted', newMuted ? 'true' : 'false');
      muteBtn.txt.setText(newMuted ? '🔇 UNMUTE' : '🔊 MUTE');
      if (newMuted) {
        setMusicVolume(0);
        setCrowdVolume(0, 0.1);
      }
      // Audio will restore on resume if not muted
    });

    btnStyle(baseY + 220, 'EXIT', '#cc2244', () => {
      this.hidePauseMenu();
      stopMusic();
      stopCrowd();
      eventBus.emit('raceComplete', { results: this.results, playerLane: this.playerLane });
    });

    this.pauseMenu = container;
  }

  private hidePauseMenu() {
    this.isPaused = false;
    this.lastUpdateTime = Date.now(); // reset so pause isn't treated as background tab
    this.time.paused = false;
    // Only restore audio if not globally muted
    const isMuted = localStorage.getItem('winbig_muted') === 'true';
    if (!isMuted) {
      setCrowdVolume(0.1, 0.3);
      setMusicVolume(0.3);
    }
    if (this.pauseMenu) {
      this.pauseMenu.destroy();
      this.pauseMenu = null;
    }
  }

  private restartRace() {
    this.hidePauseMenu();
    stopMusic();
    stopCrowd();
    // Reset all state and restart the scene with the same data
    this.scene.restart({
      frames: this.frames,
      results: this.results,
      eventType: this.eventType,
      playerLane: this.playerLane,
      records: this.records,
      playerAppearance: this.playerAppearance,
      stadiumConfig: this.stadiumConfig,
      canvasWidth: this.W,
      canvasHeight: this.H,
    });
  }

  private skipToEnd() {
    this.hidePauseMenu();
    // Jump to the last frame
    while (this.currentFrame < this.frames.length) {
      this.applyFrame(this.frames[this.currentFrame]);
      this.currentFrame++;
    }
    this.raceFinished = true;
    this.isPlaying = false;
    this.time.delayedCall(100, () => this.showResults());
  }

  private async showResults() {
    stopMusic();
    setCrowdVolume(0, 1.0);
    this.time.delayedCall(1500, () => stopCrowd());
    const playerResult = this.results.find(r => r.lane === this.playerLane);
    const isVictory = playerResult?.finishPosition === 1;
    playFanfare(isVictory);

    // Fetch fresh best times (includes the just-completed race)
    try {
      const { api } = await import('../../api/client');
      const bestData = await api.getBestTimes(this.eventType);
      this.myBestTimes = bestData.myBest || [];
      this.friendsBestTimes = bestData.friendsBest || [];
    } catch { /* use whatever we had */ }

    const { W, H } = this;

    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setDepth(9000);

    // Three panels: Friends Best (left), Race Results (center), Your Best (right)
    const pw = 440, ph = 440;
    const spw = 220, sph = 380; // side panel dimensions
    const gap = 12;
    const centerX = W / 2;
    const centerY = H / 2;

    // ── LEFT PANEL: Friends Best Times ──
    const leftX = centerX - pw / 2 - gap - spw / 2;
    this.add.rectangle(leftX, centerY, spw, sph, 0x0a1a2a, 0.95)
      .setStrokeStyle(2, 0x4488cc).setDepth(9001);
    this.add.text(leftX, centerY - sph / 2 + 14, `FRIENDS BEST\n${this.eventType}`, {
      fontSize: '14px', fontFamily: 'Arial Black', color: '#4488cc',
      stroke: '#000', strokeThickness: 2, align: 'center',
    }).setOrigin(0.5, 0).setDepth(9002);

    if (this.friendsBestTimes.length === 0) {
      this.add.text(leftX, centerY, 'No times yet', {
        fontSize: '12px', fontFamily: 'Arial', color: '#666',
      }).setOrigin(0.5).setDepth(9002);
    } else {
      this.friendsBestTimes.slice(0, 10).forEach((r, i) => {
        const y = centerY - sph / 2 + 55 + i * 28;
        const col = r.isYou ? '#FFD700' : '#ccc';
        this.add.text(leftX - spw / 2 + 12, y, `${i + 1}.`, {
          fontSize: '12px', fontFamily: 'Arial Black', color: '#666',
        }).setDepth(9002);
        this.add.text(leftX - spw / 2 + 30, y, `${r.name}${r.isYou ? ' (YOU)' : ''}`, {
          fontSize: '12px', fontFamily: 'Arial', color: col, stroke: '#000', strokeThickness: 1,
        }).setDepth(9002);
        this.add.text(leftX + spw / 2 - 12, y, formatRaceTime(r.time), {
          fontSize: '12px', fontFamily: 'Arial Black', color: col, stroke: '#000', strokeThickness: 1,
        }).setOrigin(1, 0).setDepth(9002);
      });
    }

    // ── CENTER PANEL: Race Results ──
    this.add.rectangle(centerX, centerY, pw, ph, 0x12122a, 0.95)
      .setStrokeStyle(3, 0xffd700).setDepth(9001);

    this.add.text(centerX, centerY - ph / 2 + 22, 'RACE RESULTS', {
      fontSize: '28px', fontFamily: 'Arial Black', color: '#FFD700',
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5, 0).setDepth(9002);

    const medals = ['1st', '2nd', '3rd'];
    const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32'];

    this.results.slice(0, 8).forEach((res, i) => {
      const isP = res.lane === this.playerLane;
      const y = centerY - ph / 2 + 65 + i * 36;
      const col = isP ? '#FFD700' : i < 3 ? '#fff' : '#999';

      this.add.text(centerX - 190, y, i < 3 ? medals[i] : `${i + 1}th`, {
        fontSize: '16px', fontFamily: 'Arial Black',
        color: i < 3 ? medalColors[i] : '#555',
        stroke: '#000', strokeThickness: 2,
      }).setDepth(9002);

      this.add.arc(centerX - 130, y + 9, 7, 0, 360, false, LANE_COLORS[res.lane - 1]).setDepth(9002);

      this.add.text(centerX - 110, y, `${res.displayName}${isP ? ' (YOU)' : ''}`, {
        fontSize: '14px', fontFamily: 'Arial',
        color: col, stroke: '#000', strokeThickness: 2,
      }).setDepth(9002);

      this.add.text(centerX + 150, y, formatRaceTime(res.finishTimeMs), {
        fontSize: '14px', fontFamily: 'Arial Black',
        color: col, stroke: '#000', strokeThickness: 2,
      }).setOrigin(1, 0).setDepth(9002);
    });

    const pr = this.results.find(r => r.lane === this.playerLane);
    if (pr) {
      const txt = pr.finishPosition === 1 ? 'VICTORY!'
        : pr.finishPosition <= 3 ? 'PODIUM FINISH!'
        : `${pr.finishPosition}th Place`;
      const tc = pr.finishPosition === 1 ? '#FFD700'
        : pr.finishPosition <= 3 ? '#44ff44' : '#ff8888';
      this.add.text(centerX, centerY + ph / 2 - 75, txt, {
        fontSize: '26px', fontFamily: 'Arial Black',
        color: tc, stroke: '#000', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(9002);
    }

    // ── RIGHT PANEL: Your Best Times ──
    const rightX = centerX + pw / 2 + gap + spw / 2;
    this.add.rectangle(rightX, centerY, spw, sph, 0x1a0a1a, 0.95)
      .setStrokeStyle(2, 0xcc2244).setDepth(9001);
    this.add.text(rightX, centerY - sph / 2 + 14, `YOUR BEST\n${this.eventType}`, {
      fontSize: '14px', fontFamily: 'Arial Black', color: '#cc2244',
      stroke: '#000', strokeThickness: 2, align: 'center',
    }).setOrigin(0.5, 0).setDepth(9002);

    if (this.myBestTimes.length === 0) {
      this.add.text(rightX, centerY, 'No times yet', {
        fontSize: '12px', fontFamily: 'Arial', color: '#666',
      }).setOrigin(0.5).setDepth(9002);
    } else {
      this.myBestTimes.slice(0, 10).forEach((r, i) => {
        const y = centerY - sph / 2 + 55 + i * 28;
        this.add.text(rightX - spw / 2 + 12, y, `${i + 1}.`, {
          fontSize: '12px', fontFamily: 'Arial Black', color: '#666',
        }).setDepth(9002);
        this.add.text(rightX + spw / 2 - 12, y, formatRaceTime(r.time), {
          fontSize: '13px', fontFamily: 'Arial Black', color: '#FFD700', stroke: '#000', strokeThickness: 1,
        }).setOrigin(1, 0).setDepth(9002);
      });
    }

    // ── Buttons (below center panel) ──
    const replayBg = this.add.rectangle(centerX - 110, centerY + ph / 2 - 30, 180, 40, 0x4488cc)
      .setStrokeStyle(2, 0x66aaee).setInteractive({ useHandCursor: true }).setDepth(9002);
    this.add.text(centerX - 110, centerY + ph / 2 - 30, 'REPLAY', {
      fontSize: '16px', fontFamily: 'Arial Black', color: '#fff',
    }).setOrigin(0.5).setDepth(9003);
    replayBg.on('pointerover', () => replayBg.setFillStyle(0x5599dd));
    replayBg.on('pointerout', () => replayBg.setFillStyle(0x4488cc));
    replayBg.on('pointerdown', () => this.restartRace());

    const btnBg = this.add.rectangle(centerX + 110, centerY + ph / 2 - 30, 180, 40, 0x4444aa)
      .setStrokeStyle(2, 0xffd700).setInteractive({ useHandCursor: true }).setDepth(9002);
    this.add.text(centerX + 110, centerY + ph / 2 - 30, 'CONTINUE', {
      fontSize: '16px', fontFamily: 'Arial Black', color: '#fff',
    }).setOrigin(0.5).setDepth(9003);

    btnBg.on('pointerover', () => btnBg.setFillStyle(0x5555cc));
    btnBg.on('pointerout', () => btnBg.setFillStyle(0x4444aa));
    btnBg.on('pointerdown', () => {
      eventBus.emit('raceComplete', { results: this.results, playerLane: this.playerLane });
    });
  }
}
