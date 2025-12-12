import React, { useState } from 'react';
import { BoatState } from '../types';
import { Wind, Navigation, RotateCw, RotateCcw, AlertTriangle, Trophy, ArrowLeft, Zap, Ship, Heart, Award, Eye, RefreshCw } from 'lucide-react';
import { normalizeAngle, NO_GO_ZONE_DEG, MAX_BOAT_SPEED, WIND_SPEED } from '../constants';

interface Props {
  boat: BoatState;
  windDirection: number;
  onSteer: (dir: 'left' | 'right' | 'none') => void;
  level: number;
  lives: number;
  highscoreLevel: number;
  onResetRun: () => void;
  onCheatCode: (code: string) => void;
  upgrades: {
      hasSail: boolean;
      turnMultiplier: number;
      speedMultiplier: number;
      revealMap: boolean;
  };
}

const Dashboard: React.FC<Props> = ({ boat, windDirection, onSteer, level, lives, highscoreLevel, onResetRun, onCheatCode, upgrades }) => {
  const [cheatInput, setCheatInput] = useState("");

  // Calc relative wind angle for display
  const angleDiff = Math.abs(normalizeAngle(boat.heading - windDirection));
  const angleFromWindOrigin = 180 - (angleDiff * 180) / Math.PI; 
  
  const inNoGoZone = angleFromWindOrigin < NO_GO_ZONE_DEG;
  
  // Calculate polar efficiency percentage
  const currentWindSpeed = WIND_SPEED + (level - 1) * 3;
  const windFactorRaw = currentWindSpeed / WIND_SPEED;
  const windFactor = Math.max(0.6, Math.min(2.2, windFactorRaw));
  const maxSpeed = MAX_BOAT_SPEED * windFactor * upgrades.speedMultiplier;
  const efficiency = Math.min(100, Math.round((boat.speed / maxSpeed) * 100));

  const handleCheatSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
          onCheatCode(cheatInput);
          setCheatInput("");
      }
  };

  return (
    <>
        {/* Top Right: Telemetry (moved to keep left side near goal clear) */}
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur rounded-xl p-4 shadow-xl border border-white/20 text-slate-700 min-w-[200px]">
            <h1 className="text-xl font-bold mb-2 text-sky-700 flex items-center gap-2">
                <Navigation className="w-5 h-5" />
                Segel-Simulator
            </h1>

            <div className="mb-3 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-2">
                <ArrowLeft className="w-4 h-4 text-emerald-600" />
                <span>Erreiche den linken Rand!</span>
            </div>
            
            <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between p-2 bg-sky-50 rounded-lg border border-sky-100">
                    <span className="text-sky-800 font-bold flex items-center gap-2">
                        <Trophy className="w-4 h-4" /> LEVEL
                    </span>
                    <span className="font-mono font-black text-xl text-sky-600">
                        {level}
                    </span>
                </div>

                <div className="flex items-center justify-between p-2 bg-amber-50 rounded-lg border border-amber-100">
                    <span className="text-amber-800 font-bold flex items-center gap-2">
                        <Award className="w-4 h-4" /> HIGHSCORE
                    </span>
                    <span className="font-mono font-black text-xl text-amber-600">
                        {highscoreLevel}
                    </span>
                </div>

                <div className="flex items-center justify-between p-2 bg-rose-50 rounded-lg border border-rose-100">
                    <span className="text-rose-800 font-bold flex items-center gap-2">
                        <Heart className="w-4 h-4" /> LEBEN
                    </span>
                    <span className="font-mono font-black text-xl text-rose-600">
                        {lives}/5
                    </span>
                </div>

                <div className="flex items-center justify-between">
                    <span className="text-slate-500">Geschwindigkeit</span>
                    <span className="font-mono font-bold text-lg text-sky-600">
                        {boat.speed.toFixed(1)} <span className="text-xs">kn</span>
                    </span>
                </div>
                
                {/* Wind Indicator */}
                <div className="flex items-center justify-between">
                    <span className="text-slate-500">Windwinkel</span>
                    <div className="flex items-center gap-2">
                        <Wind className="w-4 h-4 text-slate-400" />
                        <span className="font-mono font-bold">
                            {Math.round(angleFromWindOrigin)}°
                        </span>
                    </div>
                </div>

                {/* Efficiency Bar */}
                {upgrades.hasSail ? (
                    <div>
                        <div className="flex justify-between text-xs mb-1 text-slate-400">
                            <span>Segel-Effizienz</span>
                            <span>{efficiency}%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-300 ${inNoGoZone ? 'bg-red-400' : 'bg-emerald-500'}`} 
                                style={{ width: `${efficiency}%` }}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="text-xs text-red-500 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        KEIN SEGEL
                    </div>
                )}

                {upgrades.hasSail && inNoGoZone && (
                    <div className="flex items-center gap-2 text-red-500 text-xs font-bold animate-pulse">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Im toten Winkel (No-Go Zone)</span>
                    </div>
                )}
            </div>

            <button
                type="button"
                onClick={onResetRun}
                className="mt-4 w-full bg-slate-900 text-white text-sm font-bold py-2 rounded-lg shadow hover:bg-slate-800 active:bg-slate-950 transition-colors flex items-center justify-center gap-2"
                title="Setzt Level/Leben zurück und platziert die Felsen neu. Upgrades & Highscore bleiben."
            >
                <RefreshCw className="w-4 h-4" />
                Reset (neue Felsen)
            </button>
        </div>

        {/* Bottom Right: Upgrade / Cheat Input + Active Badges */}
        <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2 group">
            
            {/* ACTIVE UPGRADES DISPLAY */}
            <div className="flex gap-2 mb-1 flex-wrap justify-end">
                {upgrades.hasSail && (
                    <div className="bg-sky-600 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-lg flex items-center gap-1 animate-pulse">
                        <Ship className="w-3 h-3" />
                        SEGEL
                    </div>
                )}
                {upgrades.revealMap && (
                    <div className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-lg flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        SICHT
                    </div>
                )}
                {upgrades.turnMultiplier > 1 && (
                    <div className="bg-violet-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-lg flex items-center gap-1 animate-bounce">
                        <RotateCw className="w-3 h-3" />
                        SUPER LENKUNG
                    </div>
                )}
                {upgrades.speedMultiplier > 1 && (
                    <div className="bg-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-lg flex items-center gap-1 animate-bounce">
                        <Zap className="w-3 h-3" />
                        TURBO
                    </div>
                )}
            </div>

            <div className="bg-white/90 backdrop-blur rounded-full shadow-lg border border-white/20 flex items-center p-1 pl-4 transition-all w-48 focus-within:w-64">
                <Zap className="w-4 h-4 text-amber-500 mr-2" />
                <input 
                    type="text" 
                    placeholder="Upgrade Code..." 
                    className="bg-transparent border-none outline-none text-sm text-slate-700 w-full placeholder-slate-400"
                    value={cheatInput}
                    onChange={(e) => setCheatInput(e.target.value)}
                    onKeyDown={handleCheatSubmit}
                />
            </div>
        </div>

        {/* Bottom Center: Controls Hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 pointer-events-none">
            
            {/* Desktop Hints */}
            <div className="hidden md:flex items-center gap-4 bg-black/30 backdrop-blur-sm text-white px-6 py-2 rounded-full text-sm">
                <span className="flex items-center gap-2">
                    <kbd className="bg-white/20 px-2 py-1 rounded">←</kbd>
                    Links
                </span>
                <span className="w-px h-4 bg-white/20"></span>
                <span className="flex items-center gap-2">
                    Rechts
                    <kbd className="bg-white/20 px-2 py-1 rounded">→</kbd>
                </span>
            </div>

            {/* Mobile Controls (Pointer events re-enabled) */}
            <div className="md:hidden flex gap-8 pointer-events-auto">
                 <button 
                    className="w-20 h-20 bg-white/90 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
                    onTouchStart={() => onSteer('left')}
                    onTouchEnd={() => onSteer('none')}
                    onMouseDown={() => onSteer('left')}
                    onMouseUp={() => onSteer('none')}
                 >
                     <RotateCcw className="w-8 h-8 text-sky-700" />
                 </button>
                 <button 
                    className="w-20 h-20 bg-white/90 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
                    onTouchStart={() => onSteer('right')}
                    onTouchEnd={() => onSteer('none')}
                    onMouseDown={() => onSteer('right')}
                    onMouseUp={() => onSteer('none')}
                 >
                     <RotateCw className="w-8 h-8 text-sky-700" />
                 </button>
            </div>
        </div>
    </>
  );
};

export default Dashboard;