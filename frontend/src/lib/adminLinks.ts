// Admin panel entries — shared between the desktop gear menu
// (components/layout/Header.tsx's AdminMenu) and the "Panel administratora"
// section on /profil (the mobile home for admin tools since the hamburger
// sheet dropped its logged-in branches).
import type { LucideIcon } from 'lucide-react';
import { BarChart3, Building2, Users as UsersIcon } from 'lucide-react';

export interface AdminLink {
  href: string;
  label: string;
  Icon: LucideIcon;
}

export const ADMIN_LINKS: AdminLink[] = [
  { href: '/admin/analityka', label: 'Analityka', Icon: BarChart3 },
  { href: '/admin/przeglad', label: 'Przegląd boisk', Icon: Building2 },
  { href: '/admin/moderacja', label: 'Moderacja boisk', Icon: Building2 },
  { href: '/admin/outreach', label: 'Kontakt z obiektami', Icon: Building2 },
  { href: '/admin/uzytkownicy', label: 'Użytkownicy', Icon: UsersIcon },
];
