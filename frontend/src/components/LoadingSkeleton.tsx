import React, { memo } from 'react';
import { Card, CardBody, Skeleton } from '@nextui-org/react';

interface LoadingSkeletonProps {
  variant?: 'form' | 'navbar' | 'profile' | 'button';
  className?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = memo(({ 
  variant = 'form', 
  className = '' 
}) => {
  switch (variant) {
    case 'form':
      return (
        <Card className={`w-full max-w-md border border-default-200 bg-default-50 shadow-xl ${className}`}>
          <CardBody className="py-6 space-y-6">
            <div className="space-y-4">
              <Skeleton className="h-4 w-3/4 rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-4 w-1/2 rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            <Skeleton className="h-10 w-full rounded-lg" />
            <div className="space-y-3">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </CardBody>
        </Card>
      );
    
    case 'navbar':
      return (
        <div className={`flex items-center space-x-3 ${className}`}>
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      );
    
    case 'profile':
      return (
        <div className={`flex items-center space-x-3 ${className}`}>
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-24 rounded-lg" />
          <Skeleton className="h-8 w-16 rounded-lg" />
        </div>
      );
    
    case 'button':
      return (
        <Skeleton className={`h-10 w-full rounded-lg ${className}`} />
      );
    
    default:
      return (
        <Skeleton className={`h-4 w-full rounded-lg ${className}`} />
      );
  }
});

LoadingSkeleton.displayName = 'LoadingSkeleton';

export default LoadingSkeleton;