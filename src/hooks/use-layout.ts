import { useState, useEffect } from 'react';

export type LayoutMode = 'mobile' | 'desktop';

export function useLayout() {
    const [layout, setLayout] = useState<LayoutMode>('mobile');

    useEffect(() => {
        const checkLayout = () => {
            setLayout(window.innerWidth < 1024 ? 'mobile' : 'desktop');
        };

        checkLayout();
        window.addEventListener('resize', checkLayout);
        return () => window.removeEventListener('resize', checkLayout);
    }, []);

    return {
        layout,
        isMobile: layout === 'mobile',
        isDesktop: layout === 'desktop',
    };
}
