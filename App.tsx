import React, { useState, useEffect, useRef } from 'react';
import { BoatState, RockState } from './types';
import { 
  WIND_SPEED, 
  TURN_RATE, 
  ACCELERATION, 
  DRAG, 
  normalizeAngle 
} from './constants';
import { calculateTargetSpeed, calculateSailTrim, isInNoGoZone } from './utils/physics';
import SimulationCanvas, { Rock as RockRender } from './components/SimulationCanvas';
import Dashboard from './components/Dashboard';

const App: React.FC = () => {
  // Game State
  const [level, setLevel] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  
  // Upgrade State (formerly Cheats)
  const [upgrades, setUpgrades] = useState({
      hasSail: true, // Sail is now standard equipment
      turnMultiplier: 1.0,
      speedMultiplier: 1.0
  });

  // Initialize boat in center of screen
  const [boat, setBoat] = useState<BoatState>({
    position: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    heading: Math.PI, // Start facing West (Against the wind)
    speed: 0,
    rudderAngle: 0,
    sailAngle: 0,
  });

  // Felsen im Spielfeld: feste Hindernisse, die umsegelt werden müssen.
  // Wir legen mehrere Felsen mit sinnvollen Abständen an (ca. doppelt so viele wie vorher).
  const [rocks] = useState<RockState[]>([
    { position: { x: window.innerWidth * 0.45, y: window.innerHeight * 0.40 }, radius: 40 },
    { position: { x: window.innerWidth * 0.30, y: window.innerHeight * 0.70 }, radius: 50 },
    { position: { x: window.innerWidth * 0.65, y: window.innerHeight * 0.60 }, radius: 45 },
    { position: { x: window.innerWidth * 0.55, y: window.innerHeight * 0.25 }, radius: 35 },
    { position: { x: window.innerWidth * 0.38, y: window.innerHeight * 0.55 }, radius: 42 },
    { position: { x: window.innerWidth * 0.72, y: window.innerHeight * 0.75 }, radius: 48 },
  ]);

  // Wind increases with level
  const currentWindSpeed = WIND_SPEED + (level - 1) * 3;
  const wind = { direction: 0, speed: currentWindSpeed };

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
      }
  };

  // Game Loop
  const update = (time: number) => {
    if (lastTimeRef.current !== undefined) {
      setBoat((prevBoat) => {
        const newBoat = { ...prevBoat };

        // 1. Steering
        let turn = 0;
        // Apply Turn Multiplier from Upgrades
        const effectiveTurnRate = TURN_RATE * upgrades.turnMultiplier;

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
        const turnEffectiveness = upgrades.turnMultiplier > 1 ? 1 : Math.max(0.1, speedRatio);
            
        newBoat.heading = normalizeAngle(prevBoat.heading + turn * turnEffectiveness);

        // 2. Physics / Speed
        let driftX = 0;
        let driftY = 0;

        if (!upgrades.hasSail) {
            // NO SAIL MODE:
            // No target speed generation from wind.
            // Boat purely drifts with wind + drag slows down any residual momentum.
            // Drifts Right (Wind Direction 0)
            driftX = wind.speed * 0.02; // Slow drift downwind
            
            // Decelerate existing speed
            newBoat.speed *= 0.95; 
        } else {
            // SAILING MODE:
            // Apply Speed Multiplier from Upgrades
            let targetSpeed = calculateTargetSpeed(newBoat.heading, wind);
            targetSpeed *= upgrades.speedMultiplier;
            
            const effectiveAcceleration = ACCELERATION * upgrades.speedMultiplier;

            // Accelerate or Decelerate
            if (prevBoat.speed < targetSpeed) {
              newBoat.speed += effectiveAcceleration;
            } else {
              newBoat.speed -= DRAG;
            }
            
            if (targetSpeed === 0) {
                newBoat.speed *= 0.98; // Drag stops boat eventually
            }

            // DRIFT Logic (Sailing):
            // If in No-Go Zone (dead angle), drift with the wind
            if (isInNoGoZone(newBoat.heading, wind.direction)) {
                driftX = wind.speed * 0.03; 
            }
        }

        newBoat.speed = Math.max(0, newBoat.speed);

        // 3. Move
        // Forward component
        newBoat.position.x += Math.cos(newBoat.heading) * newBoat.speed;
        newBoat.position.y += Math.sin(newBoat.heading) * newBoat.speed;

        // Add Drift component
        newBoat.position.x += driftX;
        newBoat.position.y += driftY;

        // 4. Sail Trim (Visual only)
        if (upgrades.hasSail) {
            newBoat.sailAngle = calculateSailTrim(newBoat.heading, wind.direction);
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
            for (const rock of rocks) {
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
              setLevel(l => l + 1);
              setTimeout(() => {
                  setMessage("Level Aufstieg! Stärkerer Wind.");
                  setTimeout(() => setMessage(null), 2500);
              }, 0);
              
              return {
                position: { x: w / 2, y: h / 2 },
                heading: Math.PI, // Reset facing against wind
                speed: 0,
                rudderAngle: 0,
                sailAngle: 0,
              };
          }

          if (hitWall || hitRock) {
              setTimeout(() => {
                  setMessage(hitRock ? "Felsen berührt! Zurück zum Start." : "Rand berührt! Zurück zum Start.");
                  setTimeout(() => setMessage(null), 2000);
              }, 0);
              return {
                position: { x: w / 2, y: h / 2 },
                heading: Math.PI, // Reset facing against wind
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

  return (
    <div className="relative w-full h-screen bg-white overflow-hidden font-sans">
        <SimulationCanvas 
            boat={boat} 
            windSpeed={currentWindSpeed} 
            hasSail={upgrades.hasSail}
            rocks={rocks as RockRender[]} 
        />
        <Dashboard 
            boat={boat} 
            windDirection={wind.direction} 
            onSteer={handleSteer} 
            level={level} 
            onCheatCode={handleUpgradeCode}
            upgrades={upgrades}
        />
        
        {/* Central Message Overlay */}
        {message && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
                <div className="bg-black/60 backdrop-blur-md text-white px-8 py-4 rounded-2xl text-2xl font-bold shadow-2xl animate-bounce">
                    {message}
                </div>
            </div>
        )}
    </div>
  );
};

export default App;