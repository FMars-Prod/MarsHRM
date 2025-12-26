
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Check, Clock, ThumbsUp, ThumbsDown } from 'lucide-react';

interface LeaveHierarchyAnimationProps {
  stages: string[];
}

const stageIcons = [Clock, ThumbsUp, ThumbsUp, Check];

export function LeaveHierarchyAnimation({ stages }: LeaveHierarchyAnimationProps) {
  const [visibleStages, setVisibleStages] = useState<boolean[]>(new Array(stages.length).fill(false));
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          stages.forEach((_, index) => {
            setTimeout(() => {
              setVisibleStages((prev) => {
                const newVisible = [...prev];
                newVisible[index] = true;
                return newVisible;
              });
            }, index * 400); // Stagger the animation
          });
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );

    const currentRef = containerRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [stages]);

  return (
    <div ref={containerRef} className="space-y-4 pt-2">
      {stages.map((stage, index) => {
        const Icon = stageIcons[index] || Check;
        return (
          <div
            key={index}
            className={cn(
              'relative flex items-start gap-3 transition-opacity duration-500',
              visibleStages[index] ? 'opacity-100' : 'opacity-0'
            )}
          >
            <div className="relative mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center">
              <div
                className={cn(
                  'absolute h-full w-full rounded-full bg-primary/20 transition-all duration-300',
                   visibleStages[index] ? 'scale-100' : 'scale-0'
                )}
              />
              <Icon className="relative h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
                <p className="font-medium text-sm text-foreground">Stage {index + 1}</p>
                <p className="text-sm text-muted-foreground">{stage}</p>
            </div>
            {index < stages.length - 1 && (
                 <div className="absolute left-3 top-[1.8rem] h-[calc(100%-0.5rem)] w-0.5 -translate-x-1/2">
                    <div className={cn("h-full w-full bg-border transition-transform origin-top", visibleStages[index] ? "animate-fill-down" : "scale-y-0")} style={{ animationDelay: `${index * 400 + 200}ms` }}/>
                </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
