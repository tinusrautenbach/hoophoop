'use client';

import { useLayout } from '@/hooks/use-layout';

interface LayoutContainerProps {
    mobile: React.ReactNode;
    desktop: React.ReactNode;
}

export function LayoutContainer({ mobile, desktop }: LayoutContainerProps) {
    const { isMobile } = useLayout();

    return isMobile ? <>{mobile}</> : <>{desktop}</>;
}
