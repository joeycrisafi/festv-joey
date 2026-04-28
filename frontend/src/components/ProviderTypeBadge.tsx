import {
  UtensilsCrossed,
  ChefHat,
  Music2,
  Camera,
  Flower2,
  HelpCircle,
} from 'lucide-react';

/**
 * Canonical FESTV provider type config.
 * Only these 5 enums are valid — matches ProviderType in schema.prisma.
 */
export const providerTypeConfig = [
  {
    value: 'RESTO_VENUE',
    label: 'Restaurant / Venue',
    icon: UtensilsCrossed,
    color:     'bg-blue-50 text-blue-700 border-blue-200',
    darkColor: 'bg-blue-100 text-blue-800 border-blue-300',
  },
  {
    value: 'CATERER',
    label: 'Caterer',
    icon: ChefHat,
    color:     'bg-emerald-50 text-emerald-700 border-emerald-200',
    darkColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  {
    value: 'ENTERTAINMENT',
    label: 'Entertainment',
    icon: Music2,
    color:     'bg-purple-50 text-purple-700 border-purple-200',
    darkColor: 'bg-purple-100 text-purple-800 border-purple-300',
  },
  {
    value: 'PHOTO_VIDEO',
    label: 'Photo & Video',
    icon: Camera,
    color:     'bg-amber-50 text-amber-700 border-amber-200',
    darkColor: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  {
    value: 'FLORIST_DECOR',
    label: 'Florist & Decor',
    icon: Flower2,
    color:     'bg-pink-50 text-pink-700 border-pink-200',
    darkColor: 'bg-pink-100 text-pink-800 border-pink-300',
  },
];

interface ProviderTypeBadgeProps {
  type: string;
  showIcon?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'light' | 'dark';
}

export function ProviderTypeBadge({
  type,
  showIcon = true,
  size = 'md',
  variant = 'light',
}: ProviderTypeBadgeProps) {
  const config = providerTypeConfig.find(t => t.value === type);

  if (!config) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border"
        style={{ background: '#F5F3EF', color: '#7A7068', borderColor: 'rgba(0,0,0,0.09)' }}>
        {showIcon && <HelpCircle className="w-3 h-3" />}
        {type}
      </span>
    );
  }

  const Icon = config.icon;

  const sizeClasses = {
    xs: { text: 'text-xs', padding: 'px-2 py-0.5', icon: 'w-3 h-3' },
    sm: { text: 'text-xs', padding: 'px-2 py-1',   icon: 'w-3 h-3' },
    md: { text: 'text-sm', padding: 'px-3 py-1.5', icon: 'w-4 h-4' },
    lg: { text: 'text-base', padding: 'px-4 py-2', icon: 'w-5 h-5' },
  };

  const currentSize = sizeClasses[size];
  const colorClass = variant === 'dark' ? config.darkColor : config.color;

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${currentSize.padding} ${currentSize.text} ${colorClass} border rounded-full font-medium transition-colors`}
    >
      {showIcon && <Icon className={currentSize.icon} />}
      <span>{config.label}</span>
    </span>
  );
}

export function getProviderTypeConfig(type: string) {
  return providerTypeConfig.find(t => t.value === type);
}

export function getAllProviderTypes() {
  return providerTypeConfig;
}
