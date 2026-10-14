import {
  Droplets,
  Trash2,
  Construction,
  Waves,
  Lightbulb,
  Bus,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react';

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Droplets,
  Trash2,
  Construction,
  Waves,
  Lightbulb,
  Bus,
  AlertCircle,
};

export const CATEGORY_COLORS: Record<string, string> = {
  'Water Supply': '#0ea5e9',
  'Garbage Overflow': '#16a34a',
  'Damaged Road': '#f59e0b',
  'Drainage Problem': '#06b6d4',
  'Streetlight Failure': '#8b5cf6',
  'Public Transport': '#ec4899',
};

export const CATEGORY_LIST = [
  'Water Supply',
  'Garbage Overflow',
  'Damaged Road',
  'Drainage Problem',
  'Streetlight Failure',
  'Public Transport',
];

export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: 'Open', color: '#1e40af', bg: '#dbeafe' },
  verified: { label: 'Verified', color: '#0e7490', bg: '#cffafe' },
  assigned: { label: 'Assigned', color: '#6d28d9', bg: '#ede9fe' },
  in_progress: { label: 'In Progress', color: '#b45309', bg: '#fef3c7' },
  resolved: { label: 'Resolved', color: '#15803d', bg: '#dcfce7' },
  rejected: { label: 'Rejected', color: '#b91c1c', bg: '#fee2e2' },
  reopened: { label: 'Reopened', color: '#c2410c', bg: '#ffedd5' },
  submitted: { label: 'Submitted', color: '#1e40af', bg: '#dbeafe' },
  linked: { label: 'Linked', color: '#0e7490', bg: '#cffafe' },
};

export const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: '#b91c1c', bg: '#fee2e2' },
  high: { label: 'High', color: '#c2410c', bg: '#ffedd5' },
  medium: { label: 'Medium', color: '#b45309', bg: '#fef3c7' },
  low: { label: 'Low', color: '#15803d', bg: '#dcfce7' },
};

export const INCIDENT_STATUSES = [
  'open',
  'verified',
  'assigned',
  'in_progress',
  'resolved',
  'rejected',
  'reopened',
];

export const STATUS_TRANSITIONS: Record<string, string[]> = {
  open: ['verified', 'rejected'],
  verified: ['assigned', 'in_progress', 'resolved', 'rejected'],
  assigned: ['in_progress', 'verified', 'resolved'],
  in_progress: ['resolved', 'reopened'],
  resolved: ['reopened'],
  rejected: ['open'],
  reopened: ['assigned', 'in_progress', 'resolved'],
};
