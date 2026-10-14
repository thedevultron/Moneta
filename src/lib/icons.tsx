import {
  Baby, BookOpen, Briefcase, Bus, Car, Coffee, Dog, Dumbbell, Film, Fuel, Gamepad2, Gift, GraduationCap,
  HeartPulse, House, Laptop, Music, PiggyBank, Plane, Shield, Shirt, ShoppingBag, ShoppingBasket, Smartphone,
  Utensils, Wallet, Wifi, Zap, type LucideIcon,
} from "lucide-react";

export const ICONS: Record<string, LucideIcon> = {
  home: House,
  "shopping-basket": ShoppingBasket,
  utensils: Utensils,
  bus: Bus,
  zap: Zap,
  "shopping-bag": ShoppingBag,
  film: Film,
  "heart-pulse": HeartPulse,
  plane: Plane,
  briefcase: Briefcase,
  laptop: Laptop,
  "graduation-cap": GraduationCap,
  coffee: Coffee,
  "book-open": BookOpen,
  smartphone: Smartphone,
  wallet: Wallet,
  "piggy-bank": PiggyBank,
  shield: Shield,
  gift: Gift,
  dumbbell: Dumbbell,
  music: Music,
  car: Car,
  baby: Baby,
  dog: Dog,
  shirt: Shirt,
  gamepad: Gamepad2,
  wifi: Wifi,
  fuel: Fuel,
};

export const ICON_KEYS = Object.keys(ICONS);

/** Icon choices offered on the Goals page (subset of ICON_KEYS). AI tools accept only these. */
export const GOAL_ICON_KEYS = [
  "piggy-bank",
  "plane",
  "laptop",
  "shield",
  "home",
  "car",
  "gift",
  "graduation-cap",
  "smartphone",
  "heart-pulse",
];

export function Icon({ name, size = 18, className, strokeWidth = 1.6 }: { name: string; size?: number; className?: string; strokeWidth?: number }) {
  const C = ICONS[name] ?? Wallet;
  return <C size={size} className={className} strokeWidth={strokeWidth} />;
}

export const CATEGORY_COLORS = ["#847dff", "#00b3dd", "#d1c9ff", "#4b49aa", "#dd90d8", "#90b8f0", "#cc9166", "#8fb8a0"];

/** readable text color on a given tile color */
export function inkOn(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? "#0f1011" : "#ffffff";
}
