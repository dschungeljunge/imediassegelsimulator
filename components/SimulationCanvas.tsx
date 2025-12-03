import React, { useRef, useEffect } from 'react';
import { BoatState, Vector2D } from '../types';

// Ein einzelner Fels im Spielfeld
export interface Rock {
  position: Vector2D;
  radius: number;
}

interface Props {
  boat: BoatState;
  windSpeed: number;
  hasSail: boolean;
  rocks?: Rock[]; // optionale Hindernisse, damit wir SimulationCanvas schrittweise erweitern können
}

const SimulationCanvas: React.FC<Props> = ({ boat, windSpeed, hasSail, rocks = [] }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const windParticlesRef = useRef<{x: number, y: number, speed: number, len: number}[]>([]);

  // Initialize wind particles
  useEffect(() => {
    if (windParticlesRef.current.length === 0) {
        for(let i=0; i<60; i++) {
            windParticlesRef.current.push({
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
                speed: 10 + Math.random() * 10,
                len: 20 + Math.random() * 30
            });
        }
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const render = () => {
        // Clear - White Water
        ctx.fillStyle = '#ffffff'; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw Target Zone (Left Side) - Adjusted for White BG
        const gradient = ctx.createLinearGradient(0, 0, 100, 0);
        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.2)'); // Emerald with low opacity
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 100, canvas.height);
        
        // Draw Target Line
        ctx.strokeStyle = '#10b981'; // Emerald 500
        ctx.setLineDash([10, 10]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(10, canvas.height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw Static Water Grid - Light Gray
        ctx.strokeStyle = '#e2e8f0'; // Slate 200
        ctx.lineWidth = 1;
        const gridSize = 100;
        
        for (let x = 0; x < canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }

        // Draw Wind - Yellow/Amber
        ctx.strokeStyle = '#d97706'; // Amber 600
        windParticlesRef.current.forEach(p => {
            // Move particle absolute L->R
            // Wind speed factor from props
            const speedFactor = windSpeed / 15; // normalize roughly
            p.x += p.speed * speedFactor * 0.5;

            // Wrap
            if (p.x > canvas.width) p.x = -p.len;
            if (p.x < -p.len) p.x = canvas.width;
            
            // Y jitter slightly
            p.y += (Math.random() - 0.5) * 0.5;

            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + p.len, p.y);
            ctx.lineWidth = 2;
            ctx.stroke();
        });

        // Draw Rocks (Felsen) als feste Hindernisse im Spielfeld
        // WICHTIG: nur im Sichtkreis um das Boot zeichnen, damit Felsen im Nebel wirklich „unsichtbar“ sind
        const fogRadius = 260; // Basis-Sicht-Radius (wird auch für den Nebel genutzt)
        const rockVisibleRadius = fogRadius * 0.9;

        if (rocks.length > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(boat.position.x, boat.position.y, rockVisibleRadius, 0, Math.PI * 2);
            ctx.clip();

            ctx.fillStyle = '#4b5563'; // Slate 600
            ctx.strokeStyle = '#020617'; // Slate 950
            ctx.lineWidth = 2;

            rocks.forEach((rock, index) => {
                const spikes = 6 + (index % 4); // leicht unterschiedliche „Zackigkeit“
                const baseRadius = rock.radius;

                ctx.beginPath();
                for (let i = 0; i < spikes; i++) {
                    const angle = (i / spikes) * Math.PI * 2;
                    // Unregelmässigkeit: mal etwas länger, mal etwas kürzer
                    const variance = 0.6 + 0.5 * Math.sin(i * 1.7 + index);
                    const r = baseRadius * variance;
                    const px = rock.position.x + Math.cos(angle) * r;
                    const py = rock.position.y + Math.sin(angle) * r;
                    if (i === 0) {
                        ctx.moveTo(px, py);
                    } else {
                        ctx.lineTo(px, py);
                    }
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Kleine Highlights auf der „Oberseite“ des Felsens
                const highlightRadius = baseRadius * 0.4;
                ctx.beginPath();
                ctx.fillStyle = '#9ca3af'; // hellere Kante
                ctx.arc(
                    rock.position.x - baseRadius * 0.2,
                    rock.position.y - baseRadius * 0.3,
                    highlightRadius,
                    0,
                    Math.PI * 2
                );
                ctx.fill();

                ctx.fillStyle = '#4b5563';
            });

            ctx.restore(); // Clip beenden
        }

        // Zum Schluss das Boot zeichnen
        ctx.save();
        ctx.translate(boat.position.x, boat.position.y);
        ctx.rotate(boat.heading);

        // Hull - Light Gray with Dark Border for contrast on White
        ctx.fillStyle = '#f8fafc'; // Slate 50
        ctx.strokeStyle = '#334155'; // Slate 700
        ctx.lineWidth = 2;
        ctx.beginPath();
        // Simple boat shape
        ctx.moveTo(25, 0); // Bow
        ctx.bezierCurveTo(10, 15, -20, 15, -25, 10); // Starboard side
        ctx.lineTo(-25, -10); // Stern
        ctx.bezierCurveTo(-20, -15, 10, -15, 25, 0); // Port side
        ctx.fill();
        ctx.stroke();

        // Deck details
        ctx.fillStyle = '#cbd5e1'; // Slate 300
        ctx.beginPath();
        ctx.arc(-10, 0, 8, 0, Math.PI * 2); // Cockpit
        ctx.fill();
        ctx.stroke();

        // Mast Base
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(5, 0, 3, 0, Math.PI * 2);
        ctx.fill();

        // Rudder
        ctx.save();
        ctx.translate(-25, 0); // Stern
        ctx.rotate(boat.rudderAngle);
        ctx.fillStyle = '#64748b'; // Slate 500
        ctx.fillRect(-2, -8, 8, 16);
        ctx.restore();

        // Mast & Sail - Only if hasSail is true
        if (hasSail) {
            ctx.save();
            ctx.translate(5, 0); // Mast position
            ctx.rotate(boat.sailAngle);
            
            // Boom
            ctx.strokeStyle = '#1e293b'; // Slate 800
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-35, 0);
            ctx.stroke();

            // Mainsail
            // Change color to visible stone/gray for white background
            ctx.fillStyle = '#e7e5e4'; // Stone 200
            ctx.strokeStyle = '#57534e'; // Stone 600
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, 0); // Mast
            ctx.lineTo(-35, 0); // Boom end
            // Curve for wind fill
            // If wind is from left (relative), curve right
            ctx.quadraticCurveTo(-15, -10, 0, -50); // Head of sail
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.restore(); // End Sail
        }

        ctx.restore(); // End Boat

        // Fog of War / Nebel: Umgebung wird abgedunkelt, das Zentrum um das Boot bleibt klar,
        // Felsen ausserhalb des Sichtkreises sind ohnehin nicht gezeichnet.
        ctx.save();
        const fogGradient = ctx.createRadialGradient(
            boat.position.x, boat.position.y, fogRadius * 0.3,
            boat.position.x, boat.position.y, fogRadius
        );
        fogGradient.addColorStop(0, 'rgba(15, 23, 42, 0.0)');   // direkt um das Boot: keine Abdunkelung
        fogGradient.addColorStop(0.6, 'rgba(15, 23, 42, 0.35)'); // mittlerer Bereich: etwas dunkler
        fogGradient.addColorStop(1, 'rgba(15, 23, 42, 0.85)');   // Rand: sehr dunkel

        ctx.fillStyle = fogGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    };

    let animationFrameId: number;
    const loop = () => {
      render();
      animationFrameId = requestAnimationFrame(loop);
    };
    loop();

    return () => cancelAnimationFrame(animationFrameId);
  }, [boat, windSpeed, hasSail]);

  return <canvas ref={canvasRef} className="absolute inset-0 block" />;
};

export default SimulationCanvas;