'use client';

import { useState } from 'react';
import { DndContext, useDraggable, useDroppable, DragEndEvent } from '@dnd-kit/core';
import { ShieldAlert, Users, Timer, Target, Move } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ShotChart } from './shot-chart';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type RosterEntry = {
    id: string;
    name: string;
    number: string;
    team: 'home' | 'guest';
    points: number;
    fouls: number;
    isActive: boolean;
};

type Game = {
    id: string;
    homeTeamName: string;
    guestTeamName: string;
    homeScore: number;
    guestScore: number;
    homeFouls: number;
    guestFouls: number;
    currentPeriod: number;
    clockSeconds: number;
    mode: 'simple' | 'advanced';
    rosters: RosterEntry[];
};

interface AdvancedScorerProps {
    game: Game;
    updateGame: (updates: Partial<Game>) => void;
    handleScore: (points: number, side?: 'home' | 'guest') => void;
}

export function AdvancedScorer({ game, updateGame, handleScore }: AdvancedScorerProps) {
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

    const onCourt = game.rosters.filter(p => p.isActive);
    const bench = game.rosters.filter(p => !p.isActive);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        // If dragging from bench to court slot
        if (overId.startsWith('court-') && activeId) {
            const player = game.rosters.find(r => r.id === activeId);
            if (!player) return;

            const updatedRosters = game.rosters.map(r => {
                if (r.id === activeId) return { ...r, isActive: true };
                return r;
            });
            updateGame({ rosters: updatedRosters });
        }
    };

    const handleAction = (action: string) => {
        if (action.startsWith('score-')) {
            const pts = parseInt(action.split('-')[1]);
            if (selectedPlayerId) {
                // If player selected, score directly for them
                const player = game.rosters.find(r => r.id === selectedPlayerId);
                if (player) {
                    const updatedRosters = game.rosters.map(r =>
                        r.id === selectedPlayerId ? { ...r, points: r.points + pts } : r
                    );
                    const update = player.team === 'home'
                        ? { homeScore: game.homeScore + pts, rosters: updatedRosters }
                        : { guestScore: game.guestScore + pts, rosters: updatedRosters };
                    updateGame(update);
                }
            } else {
                // Points-first: trigger overlay
                handleScore(pts);
            }
            return;
        }

        if (!selectedPlayerId) return;
        const player = game.rosters.find(r => r.id === selectedPlayerId);
        if (!player) return;

        console.log(`Action: ${action} for player: ${player.name}`);
        // Here we would emit to socket and update DB
        if (action === 'Foul') {
            const updatedRosters = game.rosters.map(r =>
                r.id === selectedPlayerId ? { ...r, fouls: r.fouls + 1 } : r
            );
            updateGame({ rosters: updatedRosters, homeFouls: player.team === 'home' ? game.homeFouls + 1 : game.homeFouls, guestFouls: player.team === 'guest' ? game.guestFouls + 1 : game.guestFouls });
        }
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
            <DndContext onDragEnd={handleDragEnd}>
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* On Court Section */}
                    <section>
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Users size={14} className="text-orange-500" />
                            On Court
                        </h3>
                        <div className="grid grid-cols-5 gap-2">
                            {[0, 1, 2, 3, 4].map(i => (
                                <CourtSlot
                                    key={i}
                                    index={i}
                                    player={onCourt[i]}
                                    isSelected={onCourt[i]?.id === selectedPlayerId}
                                    onSelect={() => setSelectedPlayerId(onCourt[i]?.id || null)}
                                    onBench={() => {
                                        const player = onCourt[i];
                                        if (player) {
                                            const updatedRosters = game.rosters.map(r =>
                                                r.id === player.id ? { ...r, isActive: false } : r
                                            );
                                            updateGame({ rosters: updatedRosters });
                                            if (selectedPlayerId === player.id) setSelectedPlayerId(null);
                                        }
                                    }}
                                />
                            ))}
                        </div>
                    </section>

                    {/* Shot Chart Section */}
                    <section>
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Target size={14} className="text-orange-500" />
                            Shot Chart
                        </h3>
                        <ShotChart />
                    </section>

                    {/* Bench Section */}
                    <section>
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Move size={14} />
                            Bench
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {bench.map(player => (
                                <DraggablePlayer key={player.id} player={player} />
                            ))}
                        </div>
                    </section>

                    {/* Action Palette */}
                    <section className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Quick Actions</h3>
                            {selectedPlayerId && (
                                <div className="text-[10px] font-bold text-orange-500 uppercase">
                                    Target: {game.rosters.find(r => r.id === selectedPlayerId)?.name}
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <ActionButton icon={<span className="text-xl font-black">+1</span>} label="FT" color="bg-orange-500" onClick={() => handleAction('score-1')} disabled={false} />
                            <ActionButton icon={<span className="text-xl font-black">+2</span>} label="2PT" color="bg-orange-600" onClick={() => handleAction('score-2')} disabled={false} />
                            <ActionButton icon={<span className="text-xl font-black">+3</span>} label="3PT" color="bg-orange-700" onClick={() => handleAction('score-3')} disabled={false} />

                            <ActionButton icon={<Target size={18} />} label="Rebound" color="bg-blue-600" onClick={() => handleAction('Rebound')} disabled={!selectedPlayerId} />
                            <ActionButton icon={<Move size={18} />} label="Assist" color="bg-green-600" onClick={() => handleAction('Assist')} disabled={!selectedPlayerId} />
                            <ActionButton icon={<ShieldAlert size={18} />} label="Steal" color="bg-purple-600" onClick={() => handleAction('Steal')} disabled={!selectedPlayerId} />
                            <ActionButton icon={<ShieldAlert size={18} />} label="Block" color="bg-red-600" onClick={() => handleAction('Block')} disabled={!selectedPlayerId} />
                            <ActionButton icon={<RotateCcw size={18} />} label="Turnover" color="bg-slate-700" onClick={() => handleAction('Turnover')} disabled={!selectedPlayerId} />
                            <ActionButton icon={<Timer size={18} />} label="Foul" color="bg-orange-600" onClick={() => handleAction('Foul')} disabled={!selectedPlayerId} />
                        </div>
                    </section>
                </div>
            </DndContext>
        </div>
    );
}

function CourtSlot({ index, player, isSelected, onSelect, onBench }: { index: number, player?: RosterEntry, isSelected: boolean, onSelect: () => void, onBench: () => void }) {
    const { isOver, setNodeRef } = useDroppable({
        id: `court-${index}`,
    });

    return (
        <div
            ref={setNodeRef}
            onClick={onSelect}
            className={cn(
                "aspect-square rounded-2xl border-2 flex flex-col items-center justify-center transition-all cursor-pointer",
                isOver ? "border-orange-500 bg-orange-500/10 scale-105" :
                    isSelected ? "border-orange-500 bg-orange-500/20 ring-2 ring-orange-500/50" : "border-slate-800 bg-slate-900",
                !player && "border-dashed opacity-50"
            )}
        >
            {player ? (
                <div className="w-full h-full flex flex-col items-center justify-center relative group">
                    <span className="text-xl font-black text-orange-500">{player.number}</span>
                    <span className="text-[8px] font-bold uppercase truncate max-w-[80%]">{player.name}</span>

                    <button
                        onClick={(e) => { e.stopPropagation(); onBench(); }}
                        className="absolute -top-1 -right-1 bg-slate-800 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <RotateCcw size={10} />
                    </button>
                </div>
            ) : (
                <div className="text-slate-700 italic text-[10px]">Slot {index + 1}</div>
            )}
        </div>
    );
}

function DraggablePlayer({ player }: { player: RosterEntry }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: player.id,
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    } : undefined;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={cn(
                "bg-slate-800 border border-slate-700 px-3 py-2 rounded-xl flex items-center gap-3 active:scale-95 transition-all cursor-grab",
                isDragging && "opacity-50 z-50 ring-2 ring-orange-500"
            )}
        >
            <span className="text-xs font-black text-slate-500">{player.number}</span>
            <span className="text-xs font-bold">{player.name}</span>
        </div>
    );
}

function ActionButton({ icon, label, color, onClick, disabled }: { icon: React.ReactNode, label: string, color: string, onClick: () => void, disabled: boolean }) {
    return (
        <button
            disabled={disabled}
            onClick={onClick}
            className={cn(
                "flex flex-col items-center justify-center p-4 rounded-xl gap-2 active:scale-95 transition-all bg-slate-800 border border-slate-700 hover:border-slate-600",
                disabled && "opacity-20 grayscale pointer-events-none"
            )}
        >
            <div className={cn("p-2 rounded-lg text-white", color)}>{icon}</div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
        </button>
    );
}

function RotateCcw(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
        </svg>
    );
}
