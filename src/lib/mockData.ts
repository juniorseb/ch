import type { SongGeneration } from './types'

// Stand-in for `select * from song_generations where phone = ... and status
// = 'completed' order by created_at desc`, until the schema exists.
export const MOCK_SONGS: SongGeneration[] = [
  {
    id: '1',
    phone: '0700000000',
    occasion: 'anniversaire',
    recipientName: 'Aïcha',
    style: 'coupe-decale',
    status: 'completed',
    title: 'Pour Aïcha',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    audioUrl2: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    createdAt: '2026-06-12',
  },
  {
    id: '2',
    phone: '0700000000',
    occasion: 'amour',
    recipientName: 'maman',
    style: 'gospel',
    status: 'completed',
    title: 'Pour maman',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    createdAt: '2026-05-30',
  },
]
