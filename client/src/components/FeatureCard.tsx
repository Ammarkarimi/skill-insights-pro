
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  className?: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ 
  title, 
  description, 
  icon, 
  path,
  className 
}) => {
  return (
    <div className={cn("feature-card", className)}>
      <div className="feature-card-icon">
        {icon}
      </div>
      <h3 className="feature-card-title">{title}</h3>
      <p className="feature-card-description mb-4">{description}</p>
      <Link to={path} className="mt-auto">
        <Button className="w-full bg-primary hover:bg-primary/90">
          Get Started
        </Button>
      </Link>
    </div>
  );
};

export default FeatureCard;
