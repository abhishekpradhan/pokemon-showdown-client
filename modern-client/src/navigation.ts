import {
  BookOpen,
  Gamepad2,
  Settings,
  Shield,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  to: '/' | '/teambuilder' | '/rooms' | '/ladder' | '/replays' | '/settings';
  label: string;
  icon: LucideIcon;
  activePattern: RegExp;
};

export const navItems: NavItem[] = [
  { to: '/', label: 'Battle', icon: Gamepad2, activePattern: /^\/($|battle\/)/ },
  { to: '/teambuilder', label: 'Teams', icon: Shield, activePattern: /^\/teambuilder/ },
  { to: '/rooms', label: 'Rooms', icon: Users, activePattern: /^\/rooms/ },
  { to: '/ladder', label: 'Ladder', icon: Trophy, activePattern: /^\/ladder/ },
  { to: '/replays', label: 'Replays', icon: BookOpen, activePattern: /^\/replays/ },
  { to: '/settings', label: 'Settings', icon: Settings, activePattern: /^\/settings/ },
];
