'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface ScrollRevealProps {
    children: ReactNode;
    className?: string;
    stagger?: boolean;
    delay?: number;
}

export default function ScrollReveal({ children, className = '', stagger = false, delay = 0 }: ScrollRevealProps) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    if (delay) {
                        setTimeout(() => el.classList.add('sr-visible'), delay);
                    } else {
                        el.classList.add('sr-visible');
                    }
                    observer.unobserve(el);
                }
            },
            { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [delay]);

    return (
        <div ref={ref} className={`sr ${stagger ? 'sr-stagger' : ''} ${className}`}>
            {children}
        </div>
    );
}
