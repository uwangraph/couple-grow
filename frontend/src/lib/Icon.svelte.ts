import { ICONS } from './icons';

export function getIcon(name: string) {
  return ICONS[name] || null;
}
