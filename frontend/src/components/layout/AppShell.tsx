import type { ReactNode } from 'react';
import {
  BookOpen,
  CalendarRange,
  LayoutDashboard,
  LayoutGrid,
  Layers,
  LogOut,
  Settings,
  UserCog,
  Users,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { useCurrentUser, useLogout } from '../../features/auth/useAuth.js';
import { useInstitutionProfile } from '../../features/institution/useInstitution.js';
import type { CurrentUser } from '../../schemas/auth.schema.js';
import { Avatar } from '../ui/Avatar.js';
import { NotificationBell } from './NotificationBell.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/DropdownMenu.js';
import { cn } from '../../lib/cn.js';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  roles?: CurrentUser['role'][];
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  { items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
  {
    label: 'Institution',
    items: [
      { to: '/admin/structure', label: 'Structure', icon: Layers, roles: ['admin'] },
      { to: '/admin/academic-years', label: 'Academic years', icon: CalendarRange, roles: ['admin'] },
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/admin/students', label: 'Students', icon: Users, roles: ['admin'] },
      { to: '/admin/staff', label: 'Staff', icon: UserCog, roles: ['admin'] },
    ],
  },
  {
    label: 'Teaching',
    items: [
      { to: '/teacher/courses', label: 'My Courses', icon: BookOpen, roles: ['teacher'] },
      { to: '/teacher/section', label: 'My Section', icon: LayoutGrid, roles: ['teacher'] },
    ],
  },
  {
    label: 'Learning',
    items: [{ to: '/student/courses', label: 'My Courses', icon: BookOpen, roles: ['student'] }],
  },
  {
    items: [
      { to: '/admin/settings', label: 'Institution settings', icon: Settings, roles: ['admin'] },
    ],
  },
];

export const AppShell = ({ children }: { children: ReactNode }) => {
  const { data: user } = useCurrentUser();
  const { data: institution } = useInstitutionProfile();
  const { mutate: signOut } = useLogout();

  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.roles || (user && item.roles.includes(user.role)),
      ),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface px-4 py-6 md:flex">
        <div className="mb-8 px-2">
          <span className="font-display text-xl italic text-primary">Ohara</span>
          {institution ? (
            <p className="mt-0.5 truncate text-xs font-medium text-subtle">{institution.name}</p>
          ) : null}
        </div>
        <nav className="flex flex-col gap-5">
          {visibleGroups.map((group, index) => (
            <div key={group.label ?? index} className="flex flex-col gap-1">
              {group.label ? (
                <span className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-subtle">
                  {group.label}
                </span>
              ) : null}
              {group.items.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 rounded-control px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary-soft text-primary'
                        : 'text-muted hover:bg-surface-hover hover:text-fg',
                    )
                  }
                >
                  <Icon className="size-4.5" aria-hidden />
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface px-4 md:px-8">
          <span className="font-display text-lg italic text-primary md:hidden">Ohara</span>
          <span className="hidden md:block" />

          {user ? (
            <div className="flex items-center gap-1.5">
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-control p-1 pr-2.5 transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                  <Avatar name={user.name} src={user.avatarUrl} size="sm" />
                  <span className="hidden text-sm font-medium text-fg sm:block">
                    {user.name}
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => signOut()} destructive>
                    <LogOut className="size-4" aria-hidden />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}
        </header>

        <main className="flex-1 px-4 py-8 md:px-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
};
