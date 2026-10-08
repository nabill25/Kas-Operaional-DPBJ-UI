import {
  ChartColumn,
  ClipboardCheck,
  FilePlus,
  FileStack,
  FileText,
  FolderTree,
  Landmark,
  LayoutDashboard,
  Settings,
  Shapes,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Link, useLocation } from 'react-router';
import { ROLE_LABEL, type Role } from '../../../shared/constants';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/cn';
import { useNotifikasi } from '../../lib/queries';
import { Avatar } from '../ui/Avatar';
import { Logo } from '../ui/Logo';

interface ItemNav {
  ke: string;
  label: string;
  ikon: LucideIcon;
  peran: Role[];
  aktif: (path: string) => boolean;
  /** Badge jumlah antrian (dari /notifikasi → antrian) sesuai peran. */
  badge?: 'diajukan_pum' | 'dikembalikan' | 'pendaftar';
}

const SEMUA: Role[] = ['operator', 'pum', 'pimpinan', 'admin'];

export const GRUP_NAV: { judul: string; item: ItemNav[] }[] = [
  {
    judul: 'Utama',
    item: [
      { ke: '/', label: 'Dashboard', ikon: LayoutDashboard, peran: SEMUA, aktif: (p) => p === '/' },
      {
        ke: '/pengajuan',
        label: 'Daftar Pengajuan',
        ikon: FileText,
        peran: SEMUA,
        aktif: (p) => p.startsWith('/pengajuan') && p !== '/pengajuan/baru',
        badge: 'dikembalikan',
      },
      {
        ke: '/pengajuan/baru',
        label: 'Buat Pengajuan',
        ikon: FilePlus,
        peran: ['operator', 'admin'],
        aktif: (p) => p === '/pengajuan/baru',
      },
    ],
  },
  {
    judul: 'Proses',
    item: [
      {
        ke: '/verifikasi',
        label: 'Verifikasi PUM',
        ikon: ClipboardCheck,
        peran: ['pum', 'admin'],
        aktif: (p) => p.startsWith('/verifikasi'),
        badge: 'diajukan_pum',
      },
      { ke: '/rekap', label: 'Rekap & Laporan', ikon: ChartColumn, peran: SEMUA, aktif: (p) => p.startsWith('/rekap') },
    ],
  },
  {
    judul: 'Master Data',
    item: [
      { ke: '/pegawai', label: 'Pegawai', ikon: Users, peran: SEMUA, aktif: (p) => p.startsWith('/pegawai') },
      {
        ke: '/master/jenis-pengajuan',
        label: 'Jenis Pengajuan',
        ikon: Shapes,
        peran: ['admin'],
        aktif: (p) => p.startsWith('/master/jenis-pengajuan'),
      },
      {
        ke: '/master/jenis-berkas',
        label: 'Jenis Berkas',
        ikon: FileStack,
        peran: ['admin'],
        aktif: (p) => p.startsWith('/master/jenis-berkas'),
      },
      {
        ke: '/master/project-task',
        label: 'Project & Task',
        ikon: FolderTree,
        peran: ['admin'],
        aktif: (p) => p.startsWith('/master/project-task'),
      },
      { ke: '/master/bank', label: 'Bank', ikon: Landmark, peran: ['admin'], aktif: (p) => p.startsWith('/master/bank') },
      {
        ke: '/pengguna',
        label: 'Pengguna',
        ikon: UserCog,
        peran: ['admin'],
        aktif: (p) => p.startsWith('/pengguna'),
        badge: 'pendaftar',
      },
    ],
  },
  {
    judul: 'Akun',
    item: [{ ke: '/pengaturan', label: 'Pengaturan', ikon: Settings, peran: SEMUA, aktif: (p) => p.startsWith('/pengaturan') }],
  },
];

export function Merek({ ringkas = false }: { ringkas?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-3 rounded-2xl outline-offset-4">
      <Logo className="size-10 rounded-xl shadow-lg shadow-navy-900/20" />
      {!ringkas && (
        <div className="leading-tight">
          <p className="text-[15px] font-extrabold tracking-[-0.02em] text-fg">Kas Operasional</p>
          <p className="text-[11px] font-semibold tracking-wide text-fg-muted">DPBJ · Universitas Indonesia</p>
        </div>
      )}
    </Link>
  );
}

export function Sidebar({ onNavigasi }: { onNavigasi?: () => void }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const { data: notif } = useNotifikasi();
  if (!user) return null;

  return (
    <nav className="glass flex h-full flex-col rounded-[28px] p-4" aria-label="Navigasi utama">
      <div className="px-1 pt-1 pb-5">
        <Merek />
      </div>

      <div className="-mx-1 flex-1 space-y-5 overflow-y-auto px-1">
        {GRUP_NAV.map((grup) => {
          const item = grup.item.filter((i) => i.peran.includes(user.role));
          if (item.length === 0) return null;
          return (
            <div key={grup.judul}>
              <p className="mb-1.5 px-3 text-[10.5px] font-bold tracking-[0.12em] text-fg-subtle uppercase">{grup.judul}</p>
              <ul className="space-y-0.5">
                {item.map((i) => {
                  const aktif = i.aktif(pathname);
                  const jumlah = i.badge ? (notif?.antrian[i.badge] ?? 0) : 0;
                  return (
                    <li key={i.ke}>
                      <Link
                        to={i.ke}
                        onClick={onNavigasi}
                        aria-current={aktif ? 'page' : undefined}
                        className={cn(
                          'group relative flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition-colors',
                          aktif ? 'text-navy-950' : 'text-fg-muted hover:bg-fg/[0.05] hover:text-fg',
                        )}
                      >
                        {aktif && (
                          <motion.span
                            layoutId="nav-aktif"
                            className="absolute inset-0 rounded-2xl bg-linear-to-b from-kuning-300 to-kuning-500 shadow-[inset_0_1px_0_rgb(255_255_255/0.7),0_8px_20px_-10px_rgb(var(--aksen-kilau)/0.95)]"
                            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                          />
                        )}
                        <i.ikon
                          className={cn('relative size-[18px] transition-transform group-hover:scale-110', aktif && 'text-navy-950')}
                          aria-hidden
                        />
                        <span className="relative flex-1 truncate">{i.label}</span>
                        {jumlah > 0 && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className={cn(
                              'relative grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10.5px] font-bold',
                              aktif
                                ? 'bg-navy-950 text-kuning-300'
                                : i.badge === 'dikembalikan'
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-navy-900 text-white dark:bg-kuning-400 dark:text-navy-950',
                            )}
                            aria-label={`${jumlah} perlu tindakan`}
                          >
                            {jumlah}
                          </motion.span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-fg/[0.04] p-3 ring-1 ring-fg/[0.06]">
        <Avatar nama={user.nama} className="size-9" />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-bold text-fg">{user.nama}</p>
          <p className="truncate text-xs text-fg-muted">{ROLE_LABEL[user.role]}</p>
        </div>
      </div>
    </nav>
  );
}
