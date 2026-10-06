import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { Dialog } from 'radix-ui';
import { Suspense, useEffect, useState } from 'react';
import { useLocation, useOutlet } from 'react-router';
import { MuatHalaman } from '../ui/MuatHalaman';
import { Latar } from './Latar';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

/** Bekukan elemen outlet per halaman agar animasi keluar tetap menampilkan halaman lama. */
function OutletBeku() {
  const outlet = useOutlet();
  const [beku] = useState(outlet);
  return beku;
}

export function AppLayout() {
  const { pathname } = useLocation();
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    setDrawer(false);
  }, [pathname]);

  return (
    <div className="relative min-h-dvh">
      <Latar />

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[288px] p-4 pr-0 lg:block">
        <LayoutGroup id="sidebar-desktop">
          <Sidebar />
        </LayoutGroup>
      </aside>

      <Dialog.Root open={drawer} onOpenChange={setDrawer}>
        <AnimatePresence>
          {drawer && (
            <Dialog.Portal forceMount>
              <Dialog.Overlay asChild forceMount>
                <motion.div
                  className="fixed inset-0 z-50 bg-navy-950/45 backdrop-blur-sm lg:hidden"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                />
              </Dialog.Overlay>
              <Dialog.Content asChild forceMount aria-describedby={undefined}>
                <motion.div
                  className="fixed inset-y-0 left-0 z-50 w-[300px] max-w-[86vw] p-3 lg:hidden"
                  initial={{ x: '-105%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-105%' }}
                  transition={{ type: 'spring', stiffness: 360, damping: 36 }}
                >
                  <Dialog.Title className="sr-only">Menu navigasi</Dialog.Title>
                  <LayoutGroup id="sidebar-mobile">
                    <Sidebar onNavigasi={() => setDrawer(false)} />
                  </LayoutGroup>
                </motion.div>
              </Dialog.Content>
            </Dialog.Portal>
          )}
        </AnimatePresence>
      </Dialog.Root>

      <div className="lg:pl-[288px]">
        <Topbar onMenu={() => setDrawer(true)} />
        <main className="mx-auto w-full max-w-[1440px] px-4 pt-4 pb-16 sm:px-6 lg:px-8">
          <AnimatePresence mode="wait" initial={false} onExitComplete={() => window.scrollTo({ top: 0 })}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <Suspense fallback={<MuatHalaman />}>
                <OutletBeku />
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
