import { KeyRound, LogOut, Menu as IkonMenu, Moon, Search, Sun } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ROLE_LABEL } from '../../../shared/constants';
import { formatTanggal, tanggalLokalIso } from '../../../shared/format';
import { useAuth } from '../../context/AuthContext';
import { useTema } from '../../context/ThemeContext';
import { Avatar } from '../ui/Avatar';
import { Menu, MenuItem, MenuLabel, MenuPemisah } from '../ui/Menu';
import { GantiPasswordModal } from './GantiPasswordModal';
import { Merek } from './Sidebar';
import { NotifikasiMenu } from './NotifikasiMenu';

function sapaan(jam: number): string {
  if (jam < 11) return 'Selamat pagi';
  if (jam < 15) return 'Selamat siang';
  if (jam < 18) return 'Selamat sore';
  return 'Selamat malam';
}

export function TombolTema() {
  const { tema, ganti } = useTema();
  const gelap = tema === 'gelap';
  return (
    <button
      type="button"
      onClick={ganti}
      className="glass relative grid size-10 place-items-center overflow-hidden rounded-xl text-fg-muted transition hover:text-fg"
      aria-label={gelap ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'}
      title={gelap ? 'Tema terang' : 'Tema gelap'}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={tema}
          initial={{ y: 14, opacity: 0, rotate: -40 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: -14, opacity: 0, rotate: 40 }}
          transition={{ duration: 0.22 }}
        >
          {gelap ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user, keluar } = useAuth();
  const navigate = useNavigate();
  const [cari, setCari] = useState('');
  const [modalPassword, setModalPassword] = useState(false);
  if (!user) return null;

  const kirimCari = (e: FormEvent) => {
    e.preventDefault();
    const q = cari.trim();
    navigate(q ? `/pengajuan?q=${encodeURIComponent(q)}` : '/pengajuan');
    setCari('');
  };

  const prosesKeluar = async () => {
    await keluar();
    toast.success('Anda telah keluar');
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 px-4 pt-4 pb-2 sm:px-6 lg:px-8">
      <div className="glass flex h-16 items-center gap-3 rounded-[22px] px-3 sm:px-4">
        <button
          type="button"
          onClick={onMenu}
          className="grid size-10 place-items-center rounded-xl text-fg transition hover:bg-fg/[0.06] lg:hidden"
          aria-label="Buka menu"
        >
          <IkonMenu className="size-5" />
        </button>
        <div className="lg:hidden">
          <Merek ringkas />
        </div>

        <div className="hidden min-w-0 lg:block">
          <p className="truncate text-[15px] font-bold tracking-[-0.01em] text-fg">
            {sapaan(new Date().getHours())}, {user.nama.split(' ')[0]} 👋
          </p>
          <p className="text-xs text-fg-muted">{formatTanggal(tanggalLokalIso())}</p>
        </div>

        <form onSubmit={kirimCari} className="ml-auto hidden md:block" role="search">
          <label className="relative block">
            <span className="sr-only">Cari pengajuan</span>
            <Search className="pointer-events-none absolute top-1/2 z-10 left-3 size-4 -translate-y-1/2 text-fg-muted" />
            <input
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari kode, kegiatan, nama…"
              className="kontrol h-10 w-56 pl-9 transition-[width] duration-300 focus:w-72 xl:w-64"
            />
          </label>
        </form>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <NotifikasiMenu />
          <TombolTema />
          <Menu
            lebar="w-60"
            pemicu={
              <button
                type="button"
                className="flex items-center gap-2 rounded-xl p-1 transition hover:bg-fg/[0.06]"
                aria-label="Menu akun"
              >
                <Avatar nama={user.nama} className="size-9" />
              </button>
            }
          >
            <MenuLabel>
              <p className="truncate text-sm font-bold text-fg">{user.nama}</p>
              <p className="truncate text-xs text-fg-muted">
                @{user.username} · {ROLE_LABEL[user.role]}
              </p>
            </MenuLabel>
            <MenuPemisah />
            <MenuItem ikon={<KeyRound />} onSelect={() => setModalPassword(true)}>
              Ganti password
            </MenuItem>
            <MenuItem ikon={<LogOut />} bahaya onSelect={prosesKeluar}>
              Keluar
            </MenuItem>
          </Menu>
        </div>
      </div>
      <GantiPasswordModal open={modalPassword} onOpenChange={setModalPassword} />
    </header>
  );
}
