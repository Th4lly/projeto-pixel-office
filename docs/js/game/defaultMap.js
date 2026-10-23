// Escritório padrão: uma "guilda" com jardim, salão, biblioteca, fliperama, escritório,
// sala de reunião (privada), auditório com palco (destaque), taverna, descanso e ateliê.
export function buildDefaultMap() {
  const W = 60;
  const H = 46;
  const floor = new Array(W * H).fill('wall_stone');
  const fill = (x0, y0, x1, y1, t) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) floor[y * W + x] = t;
  };

  // ---- linha de cima (y 1..13)
  fill(0, 0, 15, 14, 'hedge');
  fill(1, 1, 14, 13, 'grass');
  fill(7, 8, 7, 13, 'dirt'); fill(8, 7, 15, 7, 'dirt'); fill(6, 13, 8, 14, 'dirt');
  fill(15, 6, 15, 8, 'dirt');
  fill(16, 1, 35, 13, 'marble');
  fill(25, 1, 26, 13, 'carpet_red');
  fill(36, 6, 36, 8, 'marble');
  fill(37, 1, 47, 13, 'wood_dark');
  fill(48, 6, 48, 8, 'wood_dark');
  fill(49, 1, 58, 13, 'carpet_purple');
  // corredor 1
  fill(1, 15, 58, 17, 'cobble');
  fill(24, 14, 27, 14, 'carpet_red'); fill(41, 14, 43, 14, 'wood_dark'); fill(52, 14, 54, 14, 'carpet_purple');
  // ---- linha do meio (y 19..30)
  fill(1, 19, 24, 30, 'wood');
  fill(10, 18, 12, 18, 'wood');
  fill(25, 19, 25, 30, 'wall_plaster');
  fill(26, 19, 36, 30, 'carpet_blue');
  fill(27, 18, 29, 18, 'glass');
  fill(31, 18, 31, 18, 'carpet_blue');
  fill(38, 19, 58, 30, 'stone');
  fill(45, 19, 52, 22, 'wood');
  fill(41, 18, 43, 18, 'stone'); fill(54, 18, 56, 18, 'stone');
  // corredor 2
  fill(1, 32, 58, 33, 'cobble');
  fill(10, 31, 12, 31, 'wood'); fill(47, 31, 49, 31, 'stone');
  // ---- linha de baixo (y 35..44)
  fill(1, 35, 20, 44, 'wood_dark');
  fill(9, 34, 11, 34, 'wood_dark');
  fill(22, 35, 36, 44, 'carpet_green');
  fill(28, 34, 30, 34, 'carpet_green');
  fill(38, 35, 58, 44, 'wood');
  fill(46, 34, 48, 34, 'wood');
  fill(39, 41, 44, 44, 'sand');
  fill(21, 35, 21, 44, 'wall_wood'); fill(37, 35, 37, 44, 'wall_wood');

  const objects = [];
  let n = 0;
  const add = (type, x, y, extra = {}) => objects.push({ id: `d${String(n++).padStart(3, '0')}`, type, x, y, state: {}, data: {}, ...extra });
  const on = { state: { on: true } };

  // ===== Jardim
  add('fountain', 6, 5);
  add('tree', 1, 1); add('tree', 13, 1); add('tree', 1, 12); add('tree', 13, 12);
  add('flowers', 3, 3, { color: '#ff8fb8' }); add('flowers', 10, 3, { color: '#b06bff' }); add('flowers', 3, 9, { color: '#ffd84d' }); add('flowers', 10, 9, { color: '#ff8fb8' });
  add('bench', 4, 11); add('bench', 9, 11);
  add('bush', 1, 6); add('bush', 4, 1); add('bush', 10, 1);
  add('portal', 12, 10);
  add('signpost', 5, 13, { data: { text: 'Jardim da Guilda — jogue uma moeda na fonte dos desejos!' } });
  add('torch', 9, 13, on);

  // ===== Salão principal
  add('quest_board', 19, 1); add('notice_board', 29, 1);
  add('banner', 17, 1, { color: '#3f5aa8' }); add('banner', 23, 1, { color: '#a8343f' }); add('banner', 28, 1, { color: '#a8343f' }); add('banner', 34, 1, { color: '#3f5aa8' });
  add('statue', 17, 4); add('column', 22, 5); add('column', 29, 5);
  add('counter', 30, 10); add('counter', 31, 10); add('counter', 32, 10); add('chair', 31, 11, { color: '#a8343f' });
  add('plant_big', 16, 12); add('plant_big', 35, 12); add('plant_big', 35, 1);
  add('candelabra', 21, 12, on); add('candelabra', 30, 12, on);
  add('signpost', 23, 10, { data: { text: 'Bem-vindo à guilda! Pegue uma quest no quadro e chegue perto das pessoas para conversar.' } });
  add('calendar', 34, 5); add('mailbox', 35, 5);
  add('rug_round', 17, 8, { color: '#6e4aa0' });

  // ===== Biblioteca
  for (const x of [37, 39, 41, 43, 45]) add('bookshelf', x, 1);
  add('rug_round', 41, 7, { color: '#3f8a5c' });
  add('armchair', 40, 7, { color: '#3f5aa8' }); add('armchair', 43, 7, { color: '#3f5aa8' });
  add('table_round', 41, 10); add('globe', 46, 5); add('lamp', 46, 9, on); add('candelabra', 37, 12, on);
  add('desk_magic', 44, 11); add('chair', 44, 12, { color: '#6e4aa0' });
  add('bookshelf', 37, 5); add('painting', 47, 12);

  // ===== Fliperama
  add('arcade', 49, 1, { color: '#6e4aa0' }); add('arcade', 51, 1, { color: '#a8343f' }); add('arcade', 53, 1, { color: '#2f8a8a' }); add('arcade', 55, 1, { color: '#d9783a' });
  add('jukebox', 58, 1);
  add('game_table', 51, 6); add('game_table', 56, 6);
  add('stool', 50, 6); add('stool', 52, 6); add('stool', 55, 6); add('stool', 57, 6);
  add('trophy', 58, 9); add('dummy', 57, 12);
  add('beanbag', 50, 11, { color: '#ff8fb8' }); add('beanbag', 52, 11, { color: '#5db3ff' });
  add('tv', 50, 9);

  // ===== Escritório
  const deskTypes = ['desk_pc', 'desk', 'desk_pc', 'desk_magic', 'desk_pc'];
  [2, 6, 14, 18, 21].forEach((x, i) => {
    for (const y of [21, 26]) {
      add(deskTypes[(i + y) % deskTypes.length], x, y);
      add('chair', x, y + 1, { color: '#6b3fa0' }); add('chair', x + 1, y + 1, { color: '#6b3fa0' });
    }
  });
  add('server', 23, 19); add('mailbox', 24, 19);
  add('printer', 1, 30); add('water', 3, 30); add('clock', 16, 30); add('calendar', 8, 30);
  add('whiteboard', 19, 30); add('plant', 1, 19); add('plant', 24, 30); add('plant', 13, 30); add('plant_big', 9, 19);
  add('lamp', 5, 19, on);

  // ===== Sala de reunião (privada)
  add('meeting_table', 29, 24);
  for (let x = 29; x <= 32; x++) { add('chair', x, 23, { color: '#24356a' }); add('chair', x, 26, { color: '#24356a' }); }
  add('chair', 28, 24, { color: '#24356a' }); add('chair', 28, 25, { color: '#24356a' }); add('chair', 33, 24, { color: '#24356a' }); add('chair', 33, 25, { color: '#24356a' });
  add('whiteboard', 26, 19); add('tv', 34, 19); add('clock', 36, 21);
  add('plant', 26, 30); add('plant', 36, 30); add('lamp', 26, 23, on);
  add('door', 31, 18, { state: { open: true } });

  // ===== Auditório
  add('projector', 47, 19); add('podium', 48, 21);
  add('torch', 45, 19, on); add('torch', 52, 19, on);
  for (const y of [25, 27, 29]) for (const x of [39, 42, 50, 53, 56]) add('bench', x, y);
  add('banner', 38, 19, { color: '#6e4aa0' }); add('banner', 58, 19, { color: '#6e4aa0' });
  add('plant_big', 38, 30); add('plant_big', 58, 30);

  // ===== Taverna
  add('barrel', 1, 35); add('barrel', 2, 35); add('potion_shelf', 3, 35); add('cauldron', 5, 35); add('coffee', 6, 35); add('fridge', 7, 35);
  for (let x = 2; x <= 7; x++) add('counter', x, 37);
  add('fireplace', 17, 35, on); add('armchair', 16, 37, { color: '#a8343f' }); add('armchair', 19, 37, { color: '#a8343f' });
  for (const x of [4, 9, 14]) { add('table_round', x, 42); add('stool', x - 1, 42); add('stool', x + 1, 42); }
  add('table_long', 11, 39); add('stool', 11, 40); add('stool', 13, 40); add('bench', 11, 38);
  add('candelabra', 20, 44, on); add('barrel', 1, 44); add('crate', 2, 44); add('crate', 1, 43);

  // ===== Sala de descanso
  add('bed', 22, 35, { color: '#5b7fd6' });
  add('rug', 24, 38, { color: '#a8343f' }); add('sofa', 24, 37, { color: '#3f5aa8' }); add('armchair', 26, 37, { color: '#3f5aa8' });
  add('rug_round', 29, 37, { color: '#d9783a' }); add('sofa', 29, 36, { color: '#a8343f' }); add('armchair', 28, 38, { color: '#a8343f' }); add('armchair', 31, 38, { color: '#a8343f' });
  add('piano', 33, 35); add('wardrobe', 36, 35);
  add('beanbag', 29, 42, { color: '#ffd84d' }); add('beanbag', 31, 42, { color: '#7bc86a' }); add('beanbag', 33, 42, { color: '#ff8fb8' });
  add('tv', 30, 44); add('lamp', 22, 44, on); add('plant', 36, 44); add('window', 35, 35);

  // ===== Ateliê
  add('desk_magic', 40, 36); add('chair', 40, 37, { color: '#3f8a5c' }); add('chair', 41, 37, { color: '#3f8a5c' });
  add('desk_pc', 43, 36); add('chair', 43, 37, { color: '#3f8a5c' }); add('chair', 44, 37, { color: '#3f8a5c' });
  add('desk', 49, 36); add('chair', 49, 37, { color: '#3f8a5c' }); add('chair', 50, 37, { color: '#3f8a5c' });
  add('whiteboard', 53, 35); add('chest', 56, 35, { color: '#a76f3e' }); add('potion_shelf', 38, 35);
  add('dummy', 40, 43); add('dummy', 42, 43); add('signpost', 44, 41, { data: { text: 'Área de treino: desconte o estresse no boneco!' } });
  add('portal', 57, 43); add('plant_big', 58, 35); add('plant', 47, 44); add('lamp', 52, 44, on); add('crate', 38, 44);

  const zones = [
    { id: 'z-jardim', name: 'Jardim', kind: 'area', x: 1, y: 1, w: 14, h: 13 },
    { id: 'z-salao', name: 'Salão da Guilda', kind: 'area', x: 16, y: 1, w: 20, h: 13 },
    { id: 'z-biblioteca', name: 'Biblioteca', kind: 'area', x: 37, y: 1, w: 11, h: 13 },
    { id: 'z-fliperama', name: 'Fliperama', kind: 'area', x: 49, y: 1, w: 10, h: 13 },
    { id: 'z-escritorio', name: 'Escritório', kind: 'area', x: 1, y: 19, w: 24, h: 12 },
    { id: 'z-reuniao', name: 'Sala de reunião', kind: 'private', x: 26, y: 19, w: 11, h: 12 },
    { id: 'z-auditorio', name: 'Auditório', kind: 'area', x: 38, y: 23, w: 21, h: 8 },
    { id: 'z-palco', name: 'Palco', kind: 'spotlight', x: 45, y: 20, w: 8, h: 3 },
    { id: 'z-taverna', name: 'Taverna', kind: 'area', x: 1, y: 35, w: 20, h: 10 },
    { id: 'z-descanso', name: 'Descanso', kind: 'area', x: 22, y: 35, w: 15, h: 10 },
    { id: 'z-sofa', name: 'Sofá do papo', kind: 'private', x: 28, y: 36, w: 5, h: 4 },
    { id: 'z-atelie', name: 'Ateliê', kind: 'area', x: 38, y: 35, w: 21, h: 10 },
  ];

  return { map: { width: W, height: H, floor, spawn: { x: 25, y: 8 } }, objects, zones };
}
