import React, { useState, useEffect, useRef } from 'react';
import { BoatState, RockState } from './types';
import { 
  WIND_SPEED, 
  MAX_BOAT_SPEED,
  TURN_RATE, 
  ACCELERATION, 
  DRAG, 
  normalizeAngle 
} from './constants';
import { calculateTargetSpeed, calculateSailTrim, isInNoGoZone } from './utils/physics';
import SimulationCanvas, { Rock as RockRender } from './components/SimulationCanvas';
import Dashboard from './components/Dashboard';

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const BASE_ROCK_COUNT = 6;

const generateRandomRocks = (opts: {
  count: number;
  width: number;
  height: number;
  targetZoneWidth: number;
  margin: number;
  startX: number;
  startY: number;
  startSafeRadius: number;
  minLeftCount: number;
  leftMaxX: number;
}): RockState[] => {
  const {
    count,
    width,
    height,
    targetZoneWidth,
    margin,
    startX,
    startY,
    startSafeRadius,
    minLeftCount,
    leftMaxX,
  } = opts;

  const rocks: RockState[] = [];
  const maxAttempts = 3000;
  const minGap = 22;

  const minX = targetZoneWidth + margin;
  const maxX = width - margin;
  const minY = margin;
  const maxY = height - margin;

  const safeStartR = startSafeRadius;

  const tryAddRock = (candidate: { x: number; y: number; radius: number }) => {
    const { x, y, radius } = candidate;

    // keep away from start
    const dxs = x - startX;
    const dys = y - startY;
    if (dxs * dxs + dys * dys < (safeStartR + radius) * (safeStartR + radius)) return false;

    // avoid overlapping with other rocks
    for (const r of rocks) {
      const dx = x - r.position.x;
      const dy = y - r.position.y;
      const minDist = radius + r.radius + minGap;
      if (dx * dx + dy * dy < minDist * minDist) return false;
    }

    rocks.push({
      position: { x: clamp(x, minX, maxX), y: clamp(y, minY, maxY) },
      radius,
    });
    return true;
  };

  // Ensure there are always some rocks on the left side (but not inside the target zone).
  const leftUpperX = Math.max(minX + 1, Math.min(leftMaxX, maxX));
  if (leftUpperX > minX) {
    let leftPlaced = 0;
    for (let attempt = 0; attempt < maxAttempts && leftPlaced < Math.min(minLeftCount, count); attempt++) {
      const radius = 32 + Math.random() * 28; // ~32..60
      const x = minX + Math.random() * (leftUpperX - minX);
      const y = minY + Math.random() * Math.max(1, maxY - minY);
      if (tryAddRock({ x, y, radius })) leftPlaced++;
    }
  }

  for (let attempt = 0; attempt < maxAttempts && rocks.length < count; attempt++) {
    const radius = 32 + Math.random() * 28; // ~32..60

    const x = minX + Math.random() * Math.max(1, maxX - minX);
    const y = minY + Math.random() * Math.max(1, maxY - minY);
    tryAddRock({ x, y, radius });
  }

  return rocks;
};

const App: React.FC = () => {
  // Game State
  const [level, setLevel] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [lives, setLives] = useState(5);
  const livesRef = useRef(lives);
  useEffect(() => {
    livesRef.current = lives;
  }, [lives]);

  const [highscoreLevel, setHighscoreLevel] = useState<number>(() => {
    try {
      const raw = localStorage.getItem('segel_sim_highscore_level');
      const n = raw ? Number(raw) : 1;
      return Number.isFinite(n) && n >= 1 ? n : 1;
    } catch {
      return 1;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('segel_sim_highscore_level', String(highscoreLevel));
    } catch {
      // ignore storage failures
    }
  }, [highscoreLevel]);

  // Wind direction varies by level: always mostly left->right (0 rad), but within +/-45deg.
  const [windDirection, setWindDirection] = useState(0);
  const pickWindDirectionForLevel = (lvl: number) => {
    const maxAngle = Math.min(Math.PI / 4, (Math.PI / 18) + (lvl - 1) * (Math.PI / 36)); // 10deg + 5deg/level up to 45deg
    return (Math.random() * 2 - 1) * maxAngle; // [-maxAngle, +maxAngle]
  };
  useEffect(() => {
    setWindDirection(pickWindDirectionForLevel(level));
  }, [level]);
  
  // Upgrade State (formerly Cheats)
  const [upgrades, setUpgrades] = useState(() => {
    const defaults = {
      hasSail: false, // Start without a sail; can be unlocked via upgrade code
      turnMultiplier: 1.0,
      speedMultiplier: 1.0,
      revealMap: false, // "karpi" clears fog of war and reveals all rocks
    };
    try {
      const raw = localStorage.getItem('segel_sim_upgrades');
      if (!raw) return defaults;
      const parsed = JSON.parse(raw) as Partial<typeof defaults> | null;
      if (!parsed || typeof parsed !== 'object') return defaults;

      const hasSail = typeof parsed.hasSail === 'boolean' ? parsed.hasSail : defaults.hasSail;
      const turnMultiplier =
        typeof parsed.turnMultiplier === 'number' && Number.isFinite(parsed.turnMultiplier)
          ? parsed.turnMultiplier
          : defaults.turnMultiplier;
      const speedMultiplier =
        typeof parsed.speedMultiplier === 'number' && Number.isFinite(parsed.speedMultiplier)
          ? parsed.speedMultiplier
          : defaults.speedMultiplier;
      const revealMap =
        typeof parsed.revealMap === 'boolean' ? parsed.revealMap : defaults.revealMap;

      return { hasSail, turnMultiplier, speedMultiplier, revealMap };
    } catch {
      return defaults;
    }
  });
  // Keep latest upgrades available inside the requestAnimationFrame loop (avoid stale closure)
  const upgradesRef = useRef(upgrades);
  useEffect(() => {
    upgradesRef.current = upgrades;
  }, [upgrades]);
  useEffect(() => {
    try {
      localStorage.setItem('segel_sim_upgrades', JSON.stringify(upgrades));
    } catch {
      // ignore storage failures
    }
  }, [upgrades]);

  // Initialize boat in center of screen
  const [boat, setBoat] = useState<BoatState>({
    position: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    heading: Math.PI, // Start facing West (Against the wind)
    speed: 0,
    rudderAngle: 0,
    sailAngle: 0,
  });

  // Felsen im Spielfeld: feste Hindernisse, die umsegelt werden müssen (random pro Run / Reset).
  const [rockCount, setRockCount] = useState(BASE_ROCK_COUNT);
  const [rocks, setRocks] = useState<RockState[]>(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    return generateRandomRocks({
      count: BASE_ROCK_COUNT,
      width: w,
      height: h,
      targetZoneWidth: 120,
      margin: 40,
      startX: w / 2,
      startY: h / 2,
      startSafeRadius: 220,
      minLeftCount: 2,
      leftMaxX: w * 0.38,
    });
  });
  const rocksRef = useRef(rocks);
  useEffect(() => {
    rocksRef.current = rocks;
  }, [rocks]);

  // Wind increases with level
  const currentWindSpeed = WIND_SPEED + (level - 1) * 3;
  const wind = { direction: windDirection, speed: currentWindSpeed };
  // Keep latest wind available inside the requestAnimationFrame loop (avoid stale closure)
  const windRef = useRef(wind);
  useEffect(() => {
    windRef.current = wind;
  }, [wind.direction, wind.speed]);

  // Input State
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  // Loop Ref
  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>();

  // Input Handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent steering while typing in the upgrade box
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      keysPressed.current[e.code] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = false;
    };
    const handleResize = () => {
        // Optional: Keep boat relative to screen on resize? 
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleUpgradeCode = (code: string) => {
      const cleanCode = code.toLowerCase().trim();
      
      if (cleanCode === 'teamtage') {
          if (!upgrades.hasSail) {
              setUpgrades(prev => ({ ...prev, hasSail: true }));
              setMessage("UPGRADE: Segel installiert!");
              setTimeout(() => setMessage(null), 2500);
          } else {
              setMessage("Info: Segel bereits vorhanden");
              setTimeout(() => setMessage(null), 2000);
          }
      } else if (cleanCode === 'kiimedias') {
          setUpgrades(prev => ({ ...prev, turnMultiplier: 3.0 }));
          setMessage("UPGRADE: Super-Lenkung!");
          setTimeout(() => setMessage(null), 2000);
      } else if (cleanCode === 'turbo') {
          setUpgrades(prev => ({ ...prev, speedMultiplier: 1.5 }));
          setMessage("UPGRADE: Turbo Speed!");
          setTimeout(() => setMessage(null), 2000);
      } else if (cleanCode === 'karpi') {
          if (!upgrades.revealMap) {
              setUpgrades(prev => ({ ...prev, revealMap: true }));
              setMessage("UPGRADE: Nebel gelichtet!");
              setTimeout(() => setMessage(null), 2500);
          } else {
              setMessage("Info: Karte bereits aufgedeckt");
              setTimeout(() => setMessage(null), 2000);
          }
      }
  };

  // Game Loop
  const update = (time: number) => {
    if (lastTimeRef.current !== undefined) {
      setBoat((prevBoat) => {
        const newBoat = { ...prevBoat };
        const currentUpgrades = upgradesRef.current;
        const windNow = windRef.current;

        // 1. Steering
        let turn = 0;
        // Apply Turn Multiplier from Upgrades
        const effectiveTurnRate = TURN_RATE * currentUpgrades.turnMultiplier;

        if (keysPressed.current['ArrowLeft'] || keysPressed.current['KeyA']) {
          turn = -effectiveTurnRate;
          newBoat.rudderAngle = -0.5; // Visual rudder
        } else if (keysPressed.current['ArrowRight'] || keysPressed.current['KeyD']) {
          turn = effectiveTurnRate;
          newBoat.rudderAngle = 0.5;
        } else {
          newBoat.rudderAngle = 0;
        }
        
        // Turn effectiveness
        // If we have no sail (moving slowly/drifting), turning is sluggish unless we have super steering
        const speedRatio = Math.min(1, prevBoat.speed / 2);
        const turnEffectiveness = currentUpgrades.turnMultiplier > 1 ? 1 : Math.max(0.1, speedRatio);
            
        newBoat.heading = normalizeAngle(prevBoat.heading + turn * turnEffectiveness);

        // 2. Physics / Speed
        let driftX = 0;
        let driftY = 0;

        if (!currentUpgrades.hasSail) {
            // NO SAIL MODE:
            // No target speed generation from wind.
            // Boat purely drifts with wind + drag slows down any residual momentum.
            // Drifts downwind (along wind.direction)
            driftX = Math.cos(windNow.direction) * windNow.speed * 0.02; // Slow drift downwind
            driftY = Math.sin(windNow.direction) * windNow.speed * 0.02;
            
            // Decelerate existing speed
            newBoat.speed *= 0.95; 
        } else {
            // SAILING MODE:
            // Apply Speed Multiplier from Upgrades
            let targetSpeed = calculateTargetSpeed(newBoat.heading, windNow);
            targetSpeed *= currentUpgrades.speedMultiplier;
            
            const effectiveAcceleration = ACCELERATION * currentUpgrades.speedMultiplier;

            // Accelerate or Decelerate
            if (prevBoat.speed < targetSpeed) {
              newBoat.speed += effectiveAcceleration;
            } else {
              newBoat.speed -= DRAG;
            }
            
            if (targetSpeed === 0) {
                newBoat.speed *= 0.98; // Drag stops boat eventually
            }

            // DRIFT / LEEWAY Logic (Sailing):
            // Stronger wind should feel harder: more downwind push (especially at inefficient angles).
            const windFactorRaw = windNow.speed / WIND_SPEED; // 1.0 at level 1
            const windFactor = Math.max(0.8, Math.min(2.2, windFactorRaw));

            const polarMax = MAX_BOAT_SPEED * windFactor;
            const efficiency = polarMax > 0 ? Math.max(0, Math.min(1, targetSpeed / polarMax)) : 0;

            const leewayMag = windNow.speed * 0.010 * windFactor * (1 - efficiency);
            driftX += Math.cos(windNow.direction) * leewayMag;
            driftY += Math.sin(windNow.direction) * leewayMag;

            // If in No-Go Zone (dead angle), drift even more with the wind (irons)
            if (isInNoGoZone(newBoat.heading, windNow.direction)) {
                const ironsDrift = windNow.speed * 0.020 * windFactor;
                driftX += Math.cos(windNow.direction) * ironsDrift;
                driftY += Math.sin(windNow.direction) * ironsDrift;
            }
        }

        newBoat.speed = Math.max(0, newBoat.speed);

        // 3. Move
        // Forward component: only when sailing.
        // Without sail, the boat should drift with the wind (movement handled via driftX/driftY).
        const forwardSpeed = currentUpgrades.hasSail ? newBoat.speed : 0;
        newBoat.position.x += Math.cos(newBoat.heading) * forwardSpeed;
        newBoat.position.y += Math.sin(newBoat.heading) * forwardSpeed;

        // Add Drift component
        newBoat.position.x += driftX;
        newBoat.position.y += driftY;

        // 4. Sail Trim (Visual only)
        if (currentUpgrades.hasSail) {
            newBoat.sailAngle = calculateSailTrim(newBoat.heading, windNow.direction);
        } else {
            newBoat.sailAngle = 0;
        }

        return newBoat;
      });

      // Boundary- und Kollisions-Checks (Spielfeld-Rand und Felsen)
      setBoat(prev => {
          const { x, y } = prev.position;
          const w = window.innerWidth;
          const h = window.innerHeight;
          const buffer = 20;

          let hitWall = false;
          let hitRock = false;
          let won = false;

          // Linker Rand bleibt das Ziel (Levelaufstieg)
          if (x < buffer) {
             won = true;
          }
          // Andere Ränder bedeuten „Kollisionsfehler“
          else if (x > w - buffer || y < buffer || y > h - buffer) {
             hitWall = true;
          }

          // Felsenkollision: Abstand Boot-Mitte zu Fels-Mitte < Felsradius + Sicherheitsabstand
          if (!won) {
            const safetyRadius = 25; // ungefähr halbe Bootslänge als Puffer
            for (const rock of rocksRef.current) {
              const dx = x - rock.position.x;
              const dy = y - rock.position.y;
              const distSq = dx * dx + dy * dy;
              const minDist = rock.radius + safetyRadius;
              if (distSq < minDist * minDist) {
                hitRock = true;
                break;
              }
            }
          }

          if (won) {
              setLevel(l => {
                const next = l + 1;
                setHighscoreLevel(h => Math.max(h, next));
                return next;
              });
              setTimeout(() => {
                  setMessage("Level Aufstieg! Stärkerer Wind.");
                  setTimeout(() => setMessage(null), 2500);
              }, 0);
              
              return {
                position: { x: w / 2, y: h / 2 },
                heading: normalizeAngle(windRef.current.direction + Math.PI), // Reset facing into the wind
                speed: 0,
                rudderAngle: 0,
                sailAngle: 0,
              };
          }

          if (hitWall || hitRock) {
              const nextLives = livesRef.current - 1;
              setLives(Math.max(0, nextLives));

              if (nextLives <= 0) {
                // Game Over: reset run
                setTimeout(() => {
                  setMessage("Game Over! Zurück zu Level 1.");
                  setTimeout(() => setMessage(null), 2500);
                }, 0);
                setLevel(1);
                setLives(5);
              } else {
                setTimeout(() => {
                    const baseMsg = hitRock ? "Felsen berührt! Zurück zum Start." : "Rand berührt! Zurück zum Start.";
                    setMessage(`${baseMsg} Leben: ${nextLives}/5`);
                    setTimeout(() => setMessage(null), 2000);
                }, 0);
              }
              return {
                position: { x: w / 2, y: h / 2 },
                heading: normalizeAngle(windRef.current.direction + Math.PI), // Reset facing into the wind
                speed: 0,
                rudderAngle: 0,
                sailAngle: 0,
              };
          }

          return prev;
      });

    }
    lastTimeRef.current = time;
    requestRef.current = requestAnimationFrame(update);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // UI Handlers for Mobile
  const handleSteer = (direction: 'left' | 'right' | 'none') => {
      if (direction === 'left') {
          keysPressed.current['ArrowLeft'] = true;
          keysPressed.current['ArrowRight'] = false;
      } else if (direction === 'right') {
          keysPressed.current['ArrowRight'] = true;
          keysPressed.current['ArrowLeft'] = false;
      } else {
          keysPressed.current['ArrowLeft'] = false;
          keysPressed.current['ArrowRight'] = false;
      }
  };

  const handleResetRun = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;

    // reset run progress (keep upgrades + highscore)
    setLevel(1);
    setLives(5);
    setMessage("Neuer Run: Level zurückgesetzt & Felsen neu platziert.");
    setTimeout(() => setMessage(null), 2500);

    // new wind direction for level 1 right away
    const nextWindDir = pickWindDirectionForLevel(1);
    setWindDirection(nextWindDir);

    // reset boat
    keysPressed.current = {};
    const newWindDir = nextWindDir;
    setBoat({
      position: { x: w / 2, y: h / 2 },
      heading: normalizeAngle(newWindDir + Math.PI),
      speed: 0,
      rudderAngle: 0,
      sailAngle: 0,
    });

    // regenerate rocks and make it slightly harder with each reset
    setRockCount((prev) => {
      const nextCount = prev + 1;
      setRocks(
        generateRandomRocks({
          count: nextCount,
          width: w,
          height: h,
          targetZoneWidth: 120,
          margin: 40,
          startX: w / 2,
          startY: h / 2,
          startSafeRadius: 220,
          minLeftCount: 2,
          leftMaxX: w * 0.38,
        })
      );
      return nextCount;
    });
  };

  return (
    <div className="relative w-full h-screen bg-white overflow-hidden font-sans">
        <SimulationCanvas 
            boat={boat} 
            windSpeed={currentWindSpeed} 
            windDirection={wind.direction}
            hasSail={upgrades.hasSail}
            revealMap={upgrades.revealMap}
            rocks={rocks as RockRender[]} 
        />
        <Dashboard 
            boat={boat} 
            windDirection={wind.direction} 
            onSteer={handleSteer} 
            level={level} 
            onCheatCode={handleUpgradeCode}
            upgrades={upgrades}
            lives={lives}
            highscoreLevel={highscoreLevel}
            onResetRun={handleResetRun}
        />
        
        {/* Central Message Overlay */}
        {message && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none z-50">
                <div className="bg-black/60 backdrop-blur-md text-white px-6 py-3 rounded-2xl text-lg sm:text-xl font-bold shadow-2xl">
                    {message}
                </div>
            </div>
        )}
    </div>
  );
};

export default App;