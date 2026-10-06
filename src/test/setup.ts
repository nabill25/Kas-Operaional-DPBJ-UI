import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Bersihkan DOM setelah setiap test (vitest tidak memakai globals di project ini).
afterEach(() => cleanup());
