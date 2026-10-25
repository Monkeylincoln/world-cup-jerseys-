// Shared game config. Squads live in data-now.js and data-retro.js.
// Club players: "Name,POS,OVR,NATION". Nation players: "Name,POS,OVR".
// Positions used: GK RB CB LB CDM CM CAM RW LW ST
// Kit: [main colour, second colour, style] where style is
// solid | stripes | hoops | halves | sleeves | band | checks | diag

const ERAS = {};

// Formation slots: x/y are % positions on the pitch (y=0 is the attacking end)
const FORMATIONS = {
  '4-3-3': [
    ['GK', 50, 90], ['LB', 14, 68], ['CB', 37, 74], ['CB', 63, 74], ['RB', 86, 68],
    ['CM', 26, 48], ['CDM', 50, 56], ['CM', 74, 48],
    ['LW', 16, 22], ['ST', 50, 14], ['RW', 84, 22],
  ],
  '4-4-2': [
    ['GK', 50, 90], ['LB', 14, 68], ['CB', 37, 74], ['CB', 63, 74], ['RB', 86, 68],
    ['LM', 12, 42], ['CM', 37, 48], ['CM', 63, 48], ['RM', 88, 42],
    ['ST', 36, 15], ['ST', 64, 15],
  ],
  '4-2-3-1': [
    ['GK', 50, 90], ['LB', 14, 68], ['CB', 37, 74], ['CB', 63, 74], ['RB', 86, 68],
    ['CDM', 36, 54], ['CDM', 64, 54],
    ['LW', 16, 30], ['CAM', 50, 34], ['RW', 84, 30],
    ['ST', 50, 12],
  ],
  '3-5-2': [
    ['GK', 50, 90], ['CB', 25, 72], ['CB', 50, 76], ['CB', 75, 72],
    ['LM', 10, 44], ['CDM', 36, 54], ['CAM', 50, 36], ['CDM', 64, 54], ['RM', 90, 44],
    ['ST', 36, 14], ['ST', 64, 14],
  ],
  '5-3-2': [
    ['GK', 50, 90], ['LWB', 10, 60], ['CB', 30, 74], ['CB', 50, 77], ['CB', 70, 74], ['RWB', 90, 60],
    ['CM', 26, 46], ['CM', 50, 50], ['CM', 74, 46],
    ['ST', 36, 15], ['ST', 64, 15],
  ],
};

// For each slot: natural positions (no penalty) and alternates (-3 OVR).
// Anything else is out of position (-10 OVR).
const POSITION_FIT = {
  GK:  { n: ['GK'], a: [] },
  LB:  { n: ['LB'], a: ['CB', 'LW'] },
  RB:  { n: ['RB'], a: ['CB', 'RW'] },
  LWB: { n: ['LB'], a: ['LW'] },
  RWB: { n: ['RB'], a: ['RW'] },
  CB:  { n: ['CB'], a: ['CDM', 'LB', 'RB'] },
  CDM: { n: ['CDM'], a: ['CM', 'CB'] },
  CM:  { n: ['CM'], a: ['CDM', 'CAM'] },
  CAM: { n: ['CAM'], a: ['CM', 'ST', 'LW', 'RW'] },
  LM:  { n: ['LW'], a: ['CM', 'LB', 'RW', 'CAM'] },
  RM:  { n: ['RW'], a: ['CM', 'RB', 'LW', 'CAM'] },
  LW:  { n: ['LW'], a: ['RW', 'ST', 'CAM'] },
  RW:  { n: ['RW'], a: ['LW', 'ST', 'CAM'] },
  ST:  { n: ['ST'], a: ['LW', 'RW', 'CAM'] },
};
