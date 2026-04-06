/**
 * Track geometry for a 400m oval track rendered in a top-down view.
 *
 * The track is a "stadium" shape: two parallel straights connected by two semicircular bends.
 * All positions are computed using a single unified parametric path (angle-based for curves,
 * linear for straights) to guarantee continuity — no segment-boundary jumps.
 *
 * Direction: counterclockwise when viewed from above.
 *   progress 0.00 = start/finish line (bottom-left of home straight)
 *   progress ~0.25 = end of bottom straight / entering right curve
 *   progress ~0.50 = top back straight
 *   progress ~0.75 = entering left curve
 *   progress 1.00 = back to start
 */

export interface TrackConfig {
  centerX: number;
  centerY: number;
  straightLength: number;   // pixel length of each straight
  innerRadius: number;      // pixel radius of lane 1 inner edge
  laneWidth: number;        // pixel width of each lane
  lanes: number;
}

export interface Point { x: number; y: number }

/**
 * Track fills the screen with margins for UI overlay.
 * Canvas is 1200x700; we leave space at top for event label and bottom for timer.
 */
export const DEFAULT_TRACK_CONFIG: TrackConfig = {
  centerX: 700,
  centerY: 440,
  straightLength: 540,
  innerRadius: 190,
  laneWidth: 18,
  lanes: 8,
};

/**
 * Build a track config that fills the given canvas dimensions,
 * leaving a small margin for grandstands/UI.
 */
export function buildTrackConfig(canvasW: number, canvasH: number): TrackConfig {
  const margin = 60; // px on each side for stands
  const usableW = canvasW - margin * 2;
  const usableH = canvasH - margin * 2;
  const lanes = 8;

  // Track height = 2 * outerRadius = 2 * (innerRadius + lanes * laneWidth)
  // Track width  = straightLength + 2 * outerRadius
  // We want to maximise both within usableW x usableH.
  // laneWidth ~ 1.5% of usableH, innerRadius ~ 28% of usableH
  const laneWidth = Math.max(12, Math.round(usableH * 0.017));
  const outerRadius = Math.floor(usableH / 2);
  const innerRadius = outerRadius - lanes * laneWidth;
  const straightLength = Math.max(200, usableW - 2 * outerRadius);

  return {
    centerX: Math.round(canvasW / 2),
    centerY: Math.round(canvasH / 2) + 10,
    straightLength,
    innerRadius: Math.max(80, innerRadius),
    laneWidth,
    lanes,
  };
}

/** Lane center radius in pixels. */
function laneCenterRadius(lane: number, cfg: TrackConfig): number {
  return cfg.innerRadius + (lane - 0.5) * cfg.laneWidth;
}

/** Total perimeter in pixels for a given lane. */
export function getTrackPerimeter(lane: number, cfg: TrackConfig = DEFAULT_TRACK_CONFIG): number {
  const r = laneCenterRadius(lane, cfg);
  return cfg.straightLength * 2 + 2 * Math.PI * r;
}

/**
 * Convert a progress value [0,1) to an (x,y) point on the given lane.
 *
 * Path segments (measured in pixels along the lane's perimeter):
 *   seg A: bottom straight  (left→right)      length = straightLength
 *   seg B: right semicircle (bottom→top, CW)   length = PI * r
 *   seg C: top straight     (right→left)       length = straightLength
 *   seg D: left semicircle  (top→bottom, CW)   length = PI * r
 */
export function getTrackPoint(
  lane: number,
  progress: number,
  cfg: TrackConfig = DEFAULT_TRACK_CONFIG,
): Point {
  const { centerX, centerY, straightLength, innerRadius, laneWidth } = cfg;
  const r = laneCenterRadius(lane, cfg);
  const halfStraight = straightLength / 2;
  const perim = straightLength * 2 + 2 * Math.PI * r;

  // Normalize progress to [0, 1)
  let p = ((progress % 1) + 1) % 1;
  let d = p * perim;  // distance in pixels along the lane

  const segA = straightLength;
  const segB = segA + Math.PI * r;
  const segC = segB + straightLength;
  // segD ends at perim

  if (d <= segA) {
    // Bottom straight: left → right
    const t = d / straightLength;
    return {
      x: centerX - halfStraight + t * straightLength,
      y: centerY + r,
    };
  }

  if (d <= segB) {
    // Right semicircle: sweeps from bottom (-PI/2) up to top (+PI/2)
    const arcDist = d - segA;
    const angle = -Math.PI / 2 + (arcDist / (Math.PI * r)) * Math.PI;
    return {
      x: centerX + halfStraight + Math.cos(angle) * r,
      y: centerY - Math.sin(angle) * r,
    };
  }

  if (d <= segC) {
    // Top straight: right → left
    const t = (d - segB) / straightLength;
    return {
      x: centerX + halfStraight - t * straightLength,
      y: centerY - r,
    };
  }

  // Left semicircle: sweeps from top (+PI/2) through left (PI) to bottom (3PI/2)
  const arcDist = d - segC;
  const angle = Math.PI / 2 + (arcDist / (Math.PI * r)) * Math.PI;
  return {
    x: centerX - halfStraight + Math.cos(angle) * r,
    y: centerY - Math.sin(angle) * r,
  };
}

/**
 * Draw the stadium background (fans, trees, sky) and the full 8-lane track.
 */
export interface StadiumConfig {
  upperDeckColor?: number;
  seatColor?: number;
  infieldLogo?: number;
  logoColor?: number;
  trackColor?: number;
  fieldColor?: number;
  fieldStyle?: string;  // turf image key
  stadiumName?: string;
}

export function drawTrack(
  graphics: Phaser.GameObjects.Graphics,
  cfg: TrackConfig = DEFAULT_TRACK_CONFIG,
  stadium?: StadiumConfig,
) {
  const { centerX, centerY, straightLength, innerRadius, laneWidth, lanes } = cfg;
  const halfS = straightLength / 2;
  const outerR = innerRadius + lanes * laneWidth;
  const W = (cfg.centerX) * 2;
  const H = (cfg.centerY) * 2;

  const upperDeckColor = stadium?.upperDeckColor ?? 0x444455;
  const seatColor = stadium?.seatColor ?? 0x555566;
  const trackSurfaceColor = stadium?.trackColor ?? 0xcc4433;
  const fieldColor = stadium?.fieldColor ?? 0x2a7a2a;
  const logoType = stadium?.infieldLogo ?? 0;
  const logoColor = stadium?.logoColor ?? 0xffd700;

  // ──────────────── STADIUM EXTERIOR (fills entire background) ────────────────
  // Concrete/steel structure behind the stands
  graphics.fillStyle(0x3a3a4a, 1);
  graphics.fillRect(0, 0, W, H);

  // Outer stadium wall — darker ring beyond the stands
  const wallOuterR = outerR + 90;
  graphics.fillStyle(0x2a2a3a, 1);
  graphics.fillRoundedRect(
    centerX - halfS - wallOuterR, centerY - wallOuterR,
    straightLength + wallOuterR * 2, wallOuterR * 2, wallOuterR,
  );

  // Upper deck / concourse ring
  const concourseR = outerR + 75;
  graphics.fillStyle(upperDeckColor, 1);
  graphics.fillRoundedRect(
    centerX - halfS - concourseR, centerY - concourseR,
    straightLength + concourseR * 2, concourseR * 2, concourseR,
  );

  // Light towers at four corners
  const towerPositions = [
    { x: centerX - halfS - wallOuterR + 20, y: centerY - wallOuterR + 20 },
    { x: centerX + halfS + wallOuterR - 20, y: centerY - wallOuterR + 20 },
    { x: centerX - halfS - wallOuterR + 20, y: centerY + wallOuterR - 20 },
    { x: centerX + halfS + wallOuterR - 20, y: centerY + wallOuterR - 20 },
  ];
  for (const tp of towerPositions) {
    graphics.fillStyle(0x666677, 1);
    graphics.fillRect(tp.x - 4, tp.y - 15, 8, 30);
    // Light glow
    graphics.fillStyle(0xffffcc, 0.3);
    graphics.fillCircle(tp.x, tp.y - 15, 12);
    graphics.fillStyle(0xffffee, 0.6);
    graphics.fillCircle(tp.x, tp.y - 15, 5);
  }

  // Stadium name text area (top of exterior)
  if (stadium?.stadiumName) {
    graphics.fillStyle(0x222233, 0.7);
    const nameW = Math.min(400, stadium.stadiumName.length * 16 + 40);
    graphics.fillRoundedRect(centerX - nameW / 2, 8, nameW, 28, 6);
  }

  // ──────────────── STANDS ALL AROUND THE TRACK ────────────────
  const standDepth = 50;
  const standOuterR = outerR + 12 + standDepth;
  const standInnerR = outerR + 12;

  // Stand structure background
  graphics.fillStyle(seatColor, 1);
  graphics.fillRoundedRect(
    centerX - halfS - standOuterR, centerY - standOuterR,
    straightLength + standOuterR * 2, standOuterR * 2, standOuterR,
  );

  // Rows of seats (3 tiers) — draw as concentric oval bands
  const fanColors = [0xff4444, 0x4488ff, 0xffdd44, 0x44ff88, 0xff88ff, 0xff8844, 0xffffff, 0x44ffff, 0xff6644, 0x66aaff];
  const rowCount = 4;
  const rowDepth = standDepth / rowCount;

  for (let row = 0; row < rowCount; row++) {
    const rOuter = standInnerR + (rowCount - row) * rowDepth;
    const rInner = standInnerR + (rowCount - row - 1) * rowDepth;

    // Row concrete
    const rowShade = 0x55 + row * 8;
    graphics.fillStyle((rowShade << 16) | (rowShade << 8) | (rowShade + 0x11), 1);
    graphics.fillRoundedRect(
      centerX - halfS - rOuter, centerY - rOuter,
      straightLength + rOuter * 2, rOuter * 2, rOuter,
    );

    // Fans in this row — place dots along the oval at this radius
    const fanR = (rOuter + rInner) / 2;
    const fanPerimeter = straightLength * 2 + 2 * Math.PI * fanR;
    const fanSpacing = 7;
    const numFans = Math.floor(fanPerimeter / fanSpacing);

    for (let i = 0; i < numFans; i++) {
      const d = (i / numFans) * fanPerimeter;
      const sA = straightLength, sB = sA + Math.PI * fanR, sC = sB + straightLength;
      let fx: number, fy: number;
      if (d <= sA) {
        fx = centerX - halfS + (d / sA) * straightLength;
        fy = centerY + fanR;
      } else if (d <= sB) {
        const t2 = (d - sA) / (Math.PI * fanR);
        const ang = -Math.PI / 2 + t2 * Math.PI;
        fx = centerX + halfS + Math.cos(ang) * fanR;
        fy = centerY - Math.sin(ang) * fanR;
      } else if (d <= sC) {
        fx = centerX + halfS - ((d - sB) / straightLength) * straightLength;
        fy = centerY - fanR;
      } else {
        const t2 = (d - sC) / (Math.PI * fanR);
        const ang = Math.PI / 2 + t2 * Math.PI;
        fx = centerX - halfS + Math.cos(ang) * fanR;
        fy = centerY - Math.sin(ang) * fanR;
      }

      // Fan: head + body
      const ci = Math.floor(Math.abs(Math.sin(i * 0.7 + row * 2.3)) * fanColors.length);
      graphics.fillStyle(fanColors[ci], 0.9);
      graphics.fillCircle(fx, fy, 2.5);
      graphics.fillRect(fx - 1.5, fy + 2.5, 3, 3.5);
    }
  }

  // Roof overhang ring
  graphics.lineStyle(4, 0x333344, 0.8);
  graphics.beginPath();
  graphics.moveTo(centerX - halfS, centerY + standOuterR);
  graphics.lineTo(centerX + halfS, centerY + standOuterR);
  for (let a = 0; a <= 32; a++) { const ang = -Math.PI/2+(a/32)*Math.PI; graphics.lineTo(centerX+halfS+Math.cos(ang)*standOuterR, centerY-Math.sin(ang)*standOuterR); }
  graphics.lineTo(centerX - halfS, centerY - standOuterR);
  for (let a = 0; a <= 32; a++) { const ang = Math.PI/2+(a/32)*Math.PI; graphics.lineTo(centerX-halfS+Math.cos(ang)*standOuterR, centerY-Math.sin(ang)*standOuterR); }
  graphics.closePath();
  graphics.strokePath();

  // ──────────────── GROUND / GRASS AROUND TRACK ────────────────
  const trackPad = 10;
  const totalOuterR = outerR + trackPad;
  graphics.fillStyle(0x3a8a3a, 1);
  graphics.fillRoundedRect(
    centerX - halfS - totalOuterR, centerY - totalOuterR,
    straightLength + totalOuterR * 2, totalOuterR * 2, totalOuterR,
  );

  // ──────────────── TRACK SURFACE ────────────────
  graphics.fillStyle(0x993322, 1);
  graphics.fillRoundedRect(
    centerX - halfS - outerR - 2, centerY - outerR - 2,
    straightLength + (outerR + 2) * 2, (outerR + 2) * 2, outerR + 2,
  );
  graphics.fillStyle(trackSurfaceColor, 1);
  graphics.fillRoundedRect(
    centerX - halfS - outerR, centerY - outerR,
    straightLength + outerR * 2, outerR * 2, outerR,
  );

  // ──────────────── INFIELD (textured field) ────────────────
  // Base field color
  graphics.fillStyle(fieldColor, 1);
  graphics.fillRoundedRect(
    centerX - halfS - innerRadius, centerY - innerRadius,
    straightLength + innerRadius * 2, innerRadius * 2, innerRadius,
  );

  // Derive stripe/texture colors from the field color
  const fcR = (fieldColor >> 16) & 0xff;
  const fcG = (fieldColor >> 8) & 0xff;
  const fcB = fieldColor & 0xff;
  const stripeColor = ((Math.min(255, fcR + 12) << 16) | (Math.min(255, fcG + 16) << 8) | Math.min(255, fcB + 8));
  const dotDark = ((Math.max(0, fcR - 20) << 16) | (Math.max(0, fcG - 15) << 8) | Math.max(0, fcB - 20));
  const dotLight = ((Math.min(255, fcR + 15) << 16) | (Math.min(255, fcG + 20) << 8) | Math.min(255, fcB + 10));

  // Mowing stripes — alternating light/dark bands
  const stripeWidth = 18;
  const safeHalfW = straightLength / 2 - 4;
  for (let sy = centerY - innerRadius + 8; sy < centerY + innerRadius - 8; sy += stripeWidth * 2) {
    const dy = Math.abs(sy + stripeWidth / 2 - centerY);
    if (dy < innerRadius - 8) {
      graphics.fillStyle(stripeColor, 0.3);
      graphics.fillRect(centerX - safeHalfW, sy, safeHalfW * 2, stripeWidth);
    }
  }

  // Center circle (like a football/soccer pitch center mark)
  graphics.lineStyle(1.5, 0xffffff, 0.12);
  graphics.strokeCircle(centerX, centerY, innerRadius * 0.35);

  // Center line across the field
  graphics.lineStyle(1.5, 0xffffff, 0.08);
  graphics.beginPath();
  graphics.moveTo(centerX, centerY - innerRadius + 8);
  graphics.lineTo(centerX, centerY + innerRadius - 8);
  graphics.strokePath();

  // Small center dot
  graphics.fillStyle(0xffffff, 0.15);
  graphics.fillCircle(centerX, centerY, 4);

  // Penalty-style arcs on each side (decorative field markings)
  graphics.lineStyle(1, 0xffffff, 0.08);
  graphics.beginPath();
  graphics.arc(centerX - safeHalfW + 30, centerY, innerRadius * 0.2, -Math.PI / 2, Math.PI / 2, false);
  graphics.strokePath();
  graphics.beginPath();
  graphics.arc(centerX + safeHalfW - 30, centerY, innerRadius * 0.2, Math.PI / 2, -Math.PI / 2, false);
  graphics.strokePath();

  // Grass texture dots
  let ts = 42;
  for (let i = 0; i < 200; i++) {
    ts = (ts * 1664525 + 1013904223) & 0xFFFFFFFF;
    const gx = centerX - safeHalfW + 10 + ((ts >>> 0) / 0xFFFFFFFF) * (safeHalfW * 2 - 20);
    ts = (ts * 1664525 + 1013904223) & 0xFFFFFFFF;
    const gy = centerY - innerRadius + 12 + ((ts >>> 0) / 0xFFFFFFFF) * (innerRadius * 2 - 24);
    ts = (ts * 1664525 + 1013904223) & 0xFFFFFFFF;
    const shade = ((ts >>> 0) / 0xFFFFFFFF) > 0.5 ? dotDark : dotLight;
    graphics.fillStyle(shade, 0.4);
    graphics.fillCircle(gx, gy, 1.5);
  }

  // ──────────────── INFIELD LOGO (semi-transparent, behind HUD) ────────────────
  if (logoType > 0) {
    const lr = Math.min(innerRadius * 0.5, 80); // logo radius
    graphics.lineStyle(3, logoColor, 0.15);
    graphics.fillStyle(logoColor, 0.08);

    switch (logoType) {
      case 1: // Shield
        graphics.beginPath();
        graphics.moveTo(centerX, centerY - lr);
        graphics.lineTo(centerX + lr * 0.8, centerY - lr * 0.3);
        graphics.lineTo(centerX + lr * 0.6, centerY + lr * 0.6);
        graphics.lineTo(centerX, centerY + lr);
        graphics.lineTo(centerX - lr * 0.6, centerY + lr * 0.6);
        graphics.lineTo(centerX - lr * 0.8, centerY - lr * 0.3);
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();
        break;
      case 2: // Star
        for (let i = 0; i < 5; i++) {
          const outerAngle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
          const innerAngle = outerAngle + Math.PI / 5;
          const ox = centerX + Math.cos(outerAngle) * lr;
          const oy = centerY + Math.sin(outerAngle) * lr;
          const ix = centerX + Math.cos(innerAngle) * lr * 0.4;
          const iy = centerY + Math.sin(innerAngle) * lr * 0.4;
          if (i === 0) { graphics.beginPath(); graphics.moveTo(ox, oy); }
          else { graphics.lineTo(ox, oy); }
          graphics.lineTo(ix, iy);
        }
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();
        break;
      case 3: // Diamond
        graphics.beginPath();
        graphics.moveTo(centerX, centerY - lr);
        graphics.lineTo(centerX + lr * 0.7, centerY);
        graphics.lineTo(centerX, centerY + lr);
        graphics.lineTo(centerX - lr * 0.7, centerY);
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();
        break;
      case 4: // Olympic rings
        const ringR = lr * 0.3;
        const ringY1 = centerY - ringR * 0.4;
        const ringY2 = centerY + ringR * 0.4;
        const ringColors = [0x0081C8, 0x000000, 0xEE334E, 0xFCB131, 0x00A651];
        const ringPositions = [
          { x: centerX - ringR * 2.2, y: ringY1 },
          { x: centerX, y: ringY1 },
          { x: centerX + ringR * 2.2, y: ringY1 },
          { x: centerX - ringR * 1.1, y: ringY2 },
          { x: centerX + ringR * 1.1, y: ringY2 },
        ];
        for (let i = 0; i < 5; i++) {
          graphics.lineStyle(2, ringColors[i], 0.2);
          graphics.strokeCircle(ringPositions[i].x, ringPositions[i].y, ringR);
        }
        break;
      case 5: // Flame
        graphics.beginPath();
        graphics.moveTo(centerX, centerY + lr * 0.7);
        graphics.lineTo(centerX - lr * 0.4, centerY + lr * 0.1);
        graphics.lineTo(centerX - lr * 0.25, centerY - lr * 0.3);
        graphics.lineTo(centerX, centerY - lr);
        graphics.lineTo(centerX + lr * 0.25, centerY - lr * 0.3);
        graphics.lineTo(centerX + lr * 0.4, centerY + lr * 0.1);
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();
        break;
    }
  }

  // ──────────────── LANE LINES ────────────────
  for (let lane = 0; lane <= lanes; lane++) {
    const r = innerRadius + lane * laneWidth;
    graphics.lineStyle(1, 0xffffff, lane === 0 || lane === lanes ? 0.8 : 0.35);
    graphics.beginPath();

    // Bottom straight
    graphics.moveTo(centerX - halfS, centerY + r);
    graphics.lineTo(centerX + halfS, centerY + r);

    // Right semicircle (bottom → top)
    const steps = 48;
    for (let a = 0; a <= steps; a++) {
      const angle = -Math.PI / 2 + (a / steps) * Math.PI;
      graphics.lineTo(
        centerX + halfS + Math.cos(angle) * r,
        centerY - Math.sin(angle) * r,
      );
    }

    // Top straight
    graphics.lineTo(centerX - halfS, centerY - r);

    // Left semicircle (top → left → bottom)
    for (let a = 0; a <= steps; a++) {
      const angle = Math.PI / 2 + (a / steps) * Math.PI;
      graphics.lineTo(
        centerX - halfS + Math.cos(angle) * r,
        centerY - Math.sin(angle) * r,
      );
    }

    graphics.closePath();
    graphics.strokePath();
  }

  // ──────────────── LANE NUMBERS ────────────────
  // (drawn as part of the scene, not here — but we mark the start/finish)

  // ──────────────── FINISH LINE (end of bottom straight = bottom-right) ────────────────
  const finishX = centerX + halfS;
  // Thick white finish line
  graphics.fillStyle(0xffffff, 0.9);
  graphics.fillRect(finishX - 2, centerY + innerRadius, 4, lanes * laneWidth);

  // Checkered pattern
  const checkerSize = 4;
  for (let lane2 = 0; lane2 < lanes; lane2++) {
    const ly = centerY + innerRadius + lane2 * laneWidth;
    for (let row = 0; row < Math.ceil(laneWidth / checkerSize); row++) {
      for (let col = 0; col < 3; col++) {
        const isBlack = (lane2 + row + col) % 2 === 0;
        graphics.fillStyle(isBlack ? 0x000000 : 0xffffff, 0.85);
        graphics.fillRect(
          finishX - 6 + col * checkerSize,
          ly + row * checkerSize,
          checkerSize,
          Math.min(checkerSize, laneWidth - row * checkerSize),
        );
      }
    }
  }

  // "FINISH" label
  graphics.fillStyle(0xffffff, 0.7);
  // Small triangle markers above and below the finish line
  graphics.fillTriangle(finishX, centerY + innerRadius - 8, finishX - 5, centerY + innerRadius - 2, finishX + 5, centerY + innerRadius - 2);
}

/**
 * The finish line is at the END of the bottom straight (bottom-right).
 * Returns the progress value [0,1) at the finish line for a given lane.
 * Since the bottom straight is seg A (progress 0 → straightLength/perim),
 * the finish line is at progress = straightLength / perimeter.
 */
export function getFinishProgress(lane: number, cfg: TrackConfig = DEFAULT_TRACK_CONFIG): number {
  return cfg.straightLength / getTrackPerimeter(lane, cfg);
}

/**
 * How much track progress a runner covers during the entire race.
 *
 * All runners travel the same number of meters in the simulation, but outer
 * lanes have a larger perimeter, so the same distance in meters corresponds
 * to a smaller fraction of their track.
 *
 * We use lane 1's perimeter as the reference:
 *   lane 1 perimeter = 1 lap = 400m equivalent
 *
 * For any lane:
 *   progressForRace = (raceMeters * lane1Perim / 400) / lanePerim
 *                   = raceMeters / 400 * (lane1Perim / lanePerim)
 */
export function getRaceProgressLength(
  lane: number,
  eventType: string,
  cfg: TrackConfig = DEFAULT_TRACK_CONFIG,
): number {
  const raceMeters = eventType === '200m' ? 200 : eventType === '400m' ? 400 : 800;
  const lane1Perim = getTrackPerimeter(1, cfg);
  const lanePerim = getTrackPerimeter(lane, cfg);
  return (raceMeters / 400) * (lane1Perim / lanePerim);
}

/**
 * Starting position on the track for a given lane/event.
 *
 * All runners must FINISH at the finish line (end of bottom straight).
 * So the start = finish - raceProgressLength.
 */
export function getStartProgress(
  lane: number,
  eventType: string,
  cfg: TrackConfig = DEFAULT_TRACK_CONFIG,
): number {
  if (eventType === '800m') {
    // 800m stagger only covers one curve (not a full 400m lap).
    // Stagger = extra distance in one semicircle for this lane vs lane 1.
    const r1 = cfg.innerRadius + (1 - 0.5) * cfg.laneWidth;
    const rN = cfg.innerRadius + (lane - 0.5) * cfg.laneWidth;
    const staggerPixels = Math.PI * (rN - r1); // one semicircle difference
    const lanePerim = getTrackPerimeter(lane, cfg);
    const lane1Perim = getTrackPerimeter(1, cfg);

    // 800m = 2 laps. Convert 800m to lane-specific progress.
    const raceProgress = (800 / 400) * (lane1Perim / lanePerim);
    const finish = getFinishProgress(lane, cfg);
    // Start = finish - raceProgress, then shift forward by stagger
    const lane1Start = getFinishProgress(1, cfg) - (800 / 400);
    return lane1Start + staggerPixels / lanePerim;
  }
  return getFinishProgress(lane, cfg) - getRaceProgressLength(lane, eventType, cfg);
}

/**
 * Convert simulation distance (0 → raceDistance) to track progress for rendering.
 *
 * At distance = 0:           returns start position (staggered per lane)
 * At distance = raceDistance: returns finish line (same physical spot, all lanes)
 *
 * For the 800m, runners start staggered (same as 400m start) but after the
 * first curve (~115m) they "break" and merge into lane 1 for the remainder.
 */
export function distanceToTrackProgress(
  lane: number,
  distance: number,
  eventType: string,
  cfg: TrackConfig = DEFAULT_TRACK_CONFIG,
): number {
  const raceMeters = eventType === '200m' ? 200 : eventType === '400m' ? 400 : 800;
  const distFrac = distance / raceMeters; // 0 → 1

  if (eventType === '800m') {
    return _800mTrackProgress(lane, distance, cfg);
  }

  const raceLen = getRaceProgressLength(lane, eventType, cfg);
  const finish = getFinishProgress(lane, cfg);
  return finish - raceLen * (1 - distFrac);
}

/**
 * 800m special handling:
 *
 * Phase 1 (0 → breakDistance): Runners stay in their own lanes, staggered.
 *   The stagger only covers one curve (not a full lap like 400m).
 *
 * Transition (breakDistance-20 → breakDistance+10): Runners blend from their
 *   lane to lane 1, both in lane position AND in track progress, ensuring
 *   no visual teleportation.
 *
 * Phase 2 (after break): All runners in lane 1 for the remaining ~685m.
 */
// 800m lane break: runners exit the first curve at ~100m, then aggressively
// drift inward across the back straight. All runners in lanes 1-2 by ~250m
// (before the second curve), fully merged to lane 1 shortly after.
const BLEND_START = 100;   // start drifting inward exiting first curve
const BLEND_END = 165;     // in lanes 1-2 by halfway down the top straight

function _800mTrackProgress(
  lane: number,
  distance: number,
  cfg: TrackConfig,
): number {
  const lane1Perim = getTrackPerimeter(1, cfg);
  const pixPerMeter = lane1Perim / 400;

  // Always compute the lane-1 progress for this distance (used in phase 2 and blending)
  const lane1Prog = _800mLane1Progress(distance, cfg);

  if (distance <= BLEND_START) {
    // Phase 1: fully in own lane
    return _800mOwnLaneProgress(lane, distance, cfg);
  }

  if (distance >= BLEND_END) {
    // Phase 2: fully in lane 1
    return lane1Prog;
  }

  // Blend zone: smooth ease-in-out from own lane to lane 1 over back straight
  const linearT = (distance - BLEND_START) / (BLEND_END - BLEND_START);
  const t = linearT * linearT * (3 - 2 * linearT); // smoothstep for natural drift
  const ownProg = _800mOwnLaneProgress(lane, distance, cfg);
  return ownProg + (lane1Prog - ownProg) * t;
}

/** Progress for a runner in their own lane during the staggered start phase. */
function _800mOwnLaneProgress(lane: number, distance: number, cfg: TrackConfig): number {
  const lane1Perim = getTrackPerimeter(1, cfg);
  const lanePerim = getTrackPerimeter(lane, cfg);
  const pixPerMeter = lane1Perim / 400;
  const startProg = getStartProgress(lane, '800m', cfg);

  const pixelsTraveled = distance * pixPerMeter;
  const progressTraveled = pixelsTraveled / lanePerim;
  return startProg + progressTraveled;
}

/** Progress on lane 1 for any distance — used after the break. */
function _800mLane1Progress(distance: number, cfg: TrackConfig): number {
  const lane1Perim = getTrackPerimeter(1, cfg);
  const pixPerMeter = lane1Perim / 400;
  const start1 = getStartProgress(1, '800m', cfg);

  const pixelsTraveled = distance * pixPerMeter;
  const progressTraveled = pixelsTraveled / lane1Perim;
  return start1 + progressTraveled;
}

/**
 * For the 800m, return the effective lane for rendering at a given distance.
 * Before the break: own lane. Blends to lane 1 during the transition.
 */
export function getEffectiveLane800(lane: number, distance: number): number {
  if (distance <= BLEND_START) return lane;

  // Phase 1: aggressively cut in across the back straight to lanes 1-2
  if (distance <= BLEND_END) {
    const linearT = (distance - BLEND_START) / (BLEND_END - BLEND_START);
    const t = linearT * linearT * (3 - 2 * linearT); // smoothstep
    // Target: spread runners across lanes 1-2 based on their original lane
    // Lane 1 stays at 1, lane 8 targets ~2, middle lanes in between
    const targetLane = 1 + ((lane - 1) / 7) * 1.0; // 1.0 to 2.0
    return lane + (targetLane - lane) * t;
  }

  // Phase 2: converge from lanes 1-2 into lane 1 over the next 50m
  const FINAL_END = BLEND_END + 30;
  if (distance >= FINAL_END) return 1;
  const spread = 1 + ((lane - 1) / 7) * 1.0; // where they were at BLEND_END
  const t2 = (distance - BLEND_END) / (FINAL_END - BLEND_END);
  return spread + (1 - spread) * t2;
}

/**
 * Format milliseconds as a race time string.
 * Under 60s: "23.456s"
 * 60s and over: "1:23.456"
 */
export function formatRaceTime(ms: number): string {
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) {
    return `${totalSeconds.toFixed(3)}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${minutes}:${seconds.toFixed(3).padStart(6, '0')}`;
}
