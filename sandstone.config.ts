import type { SandstoneConfig } from 'sandstone';

export default {
  name: 'rw.vanilla',
  description: [ 'A ', { text: 'Sandstone', color: 'gold' }, ' data pack.' ],
  formatVersion: 10,
  namespace: 'rw.vanilla',
  packUid: 'Zy1QSetT',
  saveOptions: { path: '.' },
  onConflict: {
    default: 'warn',
  },
} as SandstoneConfig;
