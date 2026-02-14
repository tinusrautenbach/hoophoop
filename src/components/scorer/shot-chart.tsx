'use client';

import { useState, useRef } from 'react';

type Shot = {
    x: number;
    y: number;
    made: boolean;
};

export function ShotChart() {
    const [shots, setShots] = useState<Shot[]>([]);
    const courtRef = useRef<HTMLDivElement>(null);

    const handleCourtClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!courtRef.current) return;

        const rect = courtRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        // For now, let's assume it's a "made" shot just to show something
        setShots([...shots, { x, y, made: true }]);
    };

    return (
        <div className="relative w-full aspect-[15/14] bg-input rounded-3xl border border-border overflow-hidden cursor-crosshair shadow-inner" ref={courtRef} onClick={handleCourtClick}>
            {/* Court Markings */}
            <div className="absolute inset-x-[10%] top-0 h-[40%] border-x border-b border-border/50 rounded-b-xl" /> {/* Paint */}
            <div className="absolute left-[50%] top-[40%] -translate-x-1/2 w-[30%] aspect-square border-2 border-border/50 rounded-full" /> {/* Free Throw Circle */}
            <div className="absolute left-[50%] top-0 -translate-x-1/2 w-[90%] aspect-[1/0.5] border-2 border-border/50 rounded-b-[100%] border-t-0" /> {/* 3pt Line */}
            <div className="absolute left-[50%] top-[5%] -translate-x-1/2 w-[10%] aspect-square bg-card rounded-full flex items-center justify-center border border-border">
                <div className="w-[60%] aspect-square border border-orange-500 rounded-full" /> {/* Hoop */}
            </div>

            {/* Shots */}
            {shots.map((shot, i) => (
                <div
                    key={i}
                    className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full border-2 border-slate-950 shadow-lg animate-in zoom-in-50 duration-300"
                    style={{
                        left: `${shot.x}%`,
                        top: `${shot.y}%`,
                        backgroundColor: shot.made ? '#f97316' : '#64748b'
                    }}
                />
            ))}

            <div className="absolute bottom-4 inset-x-0 text-center">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">Tap Court to Log Shot Location</span>
            </div>
        </div>
    );
}
