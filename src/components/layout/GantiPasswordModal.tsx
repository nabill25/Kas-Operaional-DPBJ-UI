import { KeyRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { validateGantiPassword } from '../../../shared/validation';
import { ApiError, api } from '../../lib/api';
import { Button } from '../ui/Button';
import { Field, Input } from '../ui/Field';
import { Modal } from '../ui/Modal';

export function GantiPasswordModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [lama, setLama] = useState('');
  const [baru, setBaru] = useState('');
  const [ulang, setUlang] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [memuat, setMemuat] = useState(false);

  const reset = () => {
    setLama('');
    setBaru('');
    setUlang('');
    setErrors({});
  };

  const kirim = async (e: FormEvent) => {
    e.preventDefault();
    const h = validateGantiPassword({ password_lama: lama, password_baru: baru });
    const err: Record<string, string> = h.ok ? {} : { ...h.errors };
    if (!err.password_baru && baru !== ulang) err.ulang = 'Konfirmasi password tidak sama';
    setErrors(err);
    if (Object.keys(err).length > 0) return;
    setMemuat(true);
    try {
      await api('/auth/password', { body: { password_lama: lama, password_baru: baru } });
      toast.success('Password berhasil diganti');
      reset();
      onOpenChange(false);
    } catch (e2) {
      if (e2 instanceof ApiError) {
        setErrors(e2.errors);
        if (Object.keys(e2.errors).length === 0) toast.error(e2.message);
      }
    } finally {
      setMemuat(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
      judul="Ganti password"
      deskripsi="Sesi di perangkat lain akan dikeluarkan setelah password diganti."
      ikon={<KeyRound className="size-5" />}
      lebar="sm"
      terkunci={memuat}
    >
      <form id="form-password" onSubmit={kirim} className="space-y-4" noValidate>
        <Field label="Password lama" htmlFor="pw-lama" error={errors.password_lama} wajib>
          <Input
            id="pw-lama"
            type="password"
            autoComplete="current-password"
            value={lama}
            invalid={!!errors.password_lama}
            onChange={(e) => setLama(e.target.value)}
          />
        </Field>
        <Field label="Password baru" htmlFor="pw-baru" error={errors.password_baru} hint="Minimal 6 karakter" wajib>
          <Input
            id="pw-baru"
            type="password"
            autoComplete="new-password"
            value={baru}
            invalid={!!errors.password_baru}
            onChange={(e) => setBaru(e.target.value)}
          />
        </Field>
        <Field label="Ulangi password baru" htmlFor="pw-ulang" error={errors.ulang} wajib>
          <Input
            id="pw-ulang"
            type="password"
            autoComplete="new-password"
            value={ulang}
            invalid={!!errors.ulang}
            onChange={(e) => setUlang(e.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button varian="kedua" onClick={() => onOpenChange(false)} disabled={memuat}>
            Batal
          </Button>
          <Button type="submit" memuat={memuat}>
            Simpan password
          </Button>
        </div>
      </form>
    </Modal>
  );
}
