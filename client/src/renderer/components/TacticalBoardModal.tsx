import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowCounterClockwise,
  ArrowUpRight,
  Camera,
  Circle,
  Crosshair,
  Fire,
  FloppyDisk,
  HandGrabbing,
  Lightning,
  PencilSimple,
  Strategy,
  Target,
  Trash,
  X,
} from '@phosphor-icons/react';
import { useI18n } from '../i18n';
import { STRAT_PLAYBOOK_KEY } from '../services/appSettings';

interface TacticalBoardModalProps {
  isOpen: boolean;
  initialGame: 'VALORANT' | 'PUBG';
  initialMapName?: string;
  dataRevision?: number;
  onClose: () => void;
}

type BoardTool = 'move' | 'smoke' | 'flash' | 'molly' | 'objective' | 'arrow' | 'pen';

interface BoardToken {
  id: string;
  team: 'ally' | 'enemy';
  label: string;
  x: number;
  y: number;
}

interface BoardStamp {
  id: string;
  kind: 'smoke' | 'flash' | 'molly' | 'objective';
  x: number;
  y: number;
}

interface BoardStroke {
  tool: 'arrow' | 'pen';
  color: string;
  points: Array<{ x: number; y: number }>;
}

interface SavedStratPreset {
  id: string;
  title: string;
  game: 'VALORANT' | 'PUBG';
  mapId: string;
  tokens: BoardToken[];
  stamps: BoardStamp[];
  strokes: BoardStroke[];
  zoneRadius: number;
  zoneCenter: { x: number; y: number };
  updatedAt: string;
}

interface MapZoneBox {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  kind?: 'site' | 'spawn' | 'room';
}

interface MapBlueprint {
  id: string;
  game: 'VALORANT' | 'PUBG';
  name: string;
  boxes: MapZoneBox[];
  landmarks?: Array<{ x: number; y: number; label: string }>;
  waterY?: number;
}

const CANVAS_W = 880;
const CANVAS_H = 560;

const MAP_BLUEPRINTS: MapBlueprint[] = [
  // VALORANT Blueprints
  {
    id: 'Ascent',
    game: 'VALORANT',
    name: 'Ascent',
    boxes: [
      { x: 0.14, y: 0.14, w: 0.2, h: 0.19, label: 'A SITE', kind: 'site' },
      { x: 0.16, y: 0.36, w: 0.15, h: 0.2, label: 'A MAIN', kind: 'room' },
      { x: 0.34, y: 0.24, w: 0.12, h: 0.14, label: 'TREE', kind: 'room' },
      { x: 0.42, y: 0.4, w: 0.17, h: 0.22, label: 'MID COURTYARD', kind: 'room' },
      { x: 0.56, y: 0.25, w: 0.13, h: 0.14, label: 'MARKET', kind: 'room' },
      { x: 0.67, y: 0.14, w: 0.2, h: 0.2, label: 'B SITE', kind: 'site' },
      { x: 0.69, y: 0.38, w: 0.16, h: 0.2, label: 'B MAIN', kind: 'room' },
      { x: 0.4, y: 0.05, w: 0.2, h: 0.09, label: 'DEFENDER SPAWN', kind: 'spawn' },
      { x: 0.38, y: 0.83, w: 0.24, h: 0.1, label: 'ATTACKER SPAWN', kind: 'spawn' },
    ],
  },
  {
    id: 'Bind',
    game: 'VALORANT',
    name: 'Bind',
    boxes: [
      { x: 0.64, y: 0.16, w: 0.21, h: 0.2, label: 'A SITE', kind: 'site' },
      { x: 0.58, y: 0.4, w: 0.14, h: 0.18, label: 'A SHORT', kind: 'room' },
      { x: 0.75, y: 0.39, w: 0.13, h: 0.2, label: 'SHOWERS', kind: 'room' },
      { x: 0.15, y: 0.16, w: 0.2, h: 0.2, label: 'B SITE', kind: 'site' },
      { x: 0.31, y: 0.38, w: 0.15, h: 0.18, label: 'HOOKAH', kind: 'room' },
      { x: 0.12, y: 0.39, w: 0.15, h: 0.24, label: 'B LONG', kind: 'room' },
      { x: 0.4, y: 0.06, w: 0.2, h: 0.09, label: 'DEFENDER SPAWN', kind: 'spawn' },
      { x: 0.38, y: 0.83, w: 0.24, h: 0.1, label: 'ATTACKER SPAWN', kind: 'spawn' },
    ],
  },
  {
    id: 'Haven',
    game: 'VALORANT',
    name: 'Haven',
    boxes: [
      { x: 0.7, y: 0.15, w: 0.18, h: 0.19, label: 'A SITE', kind: 'site' },
      { x: 0.72, y: 0.38, w: 0.15, h: 0.24, label: 'A LONG', kind: 'room' },
      { x: 0.42, y: 0.2, w: 0.16, h: 0.18, label: 'B SITE', kind: 'site' },
      { x: 0.42, y: 0.42, w: 0.16, h: 0.2, label: 'MID COURTYARD', kind: 'room' },
      { x: 0.28, y: 0.38, w: 0.11, h: 0.18, label: 'GARAGE', kind: 'room' },
      { x: 0.11, y: 0.15, w: 0.18, h: 0.19, label: 'C SITE', kind: 'site' },
      { x: 0.11, y: 0.38, w: 0.14, h: 0.26, label: 'C LONG', kind: 'room' },
      { x: 0.4, y: 0.05, w: 0.2, h: 0.09, label: 'DEFENDER SPAWN', kind: 'spawn' },
      { x: 0.38, y: 0.83, w: 0.24, h: 0.1, label: 'ATTACKER SPAWN', kind: 'spawn' },
    ],
  },
  {
    id: 'Split',
    game: 'VALORANT',
    name: 'Split',
    boxes: [
      { x: 0.67, y: 0.15, w: 0.2, h: 0.2, label: 'A SITE', kind: 'site' },
      { x: 0.65, y: 0.39, w: 0.18, h: 0.2, label: 'A MAIN / RAMP', kind: 'room' },
      { x: 0.42, y: 0.26, w: 0.16, h: 0.15, label: 'MAIL / VENT', kind: 'room' },
      { x: 0.42, y: 0.44, w: 0.16, h: 0.2, label: 'MID PLAZA', kind: 'room' },
      { x: 0.13, y: 0.15, w: 0.2, h: 0.2, label: 'B SITE', kind: 'site' },
      { x: 0.15, y: 0.39, w: 0.17, h: 0.21, label: 'B MAIN', kind: 'room' },
      { x: 0.4, y: 0.05, w: 0.2, h: 0.09, label: 'DEFENDER SPAWN', kind: 'spawn' },
      { x: 0.38, y: 0.83, w: 0.24, h: 0.1, label: 'ATTACKER SPAWN', kind: 'spawn' },
    ],
  },
  {
    id: 'Lotus',
    game: 'VALORANT',
    name: 'Lotus',
    boxes: [
      { x: 0.7, y: 0.15, w: 0.19, h: 0.2, label: 'A SITE', kind: 'site' },
      { x: 0.69, y: 0.4, w: 0.18, h: 0.22, label: 'A ROOT / RUBBLE', kind: 'room' },
      { x: 0.42, y: 0.24, w: 0.16, h: 0.2, label: 'B SITE', kind: 'site' },
      { x: 0.42, y: 0.47, w: 0.16, h: 0.16, label: 'B PILLARS', kind: 'room' },
      { x: 0.11, y: 0.16, w: 0.19, h: 0.2, label: 'C SITE', kind: 'site' },
      { x: 0.12, y: 0.4, w: 0.17, h: 0.22, label: 'C MOUND', kind: 'room' },
      { x: 0.4, y: 0.05, w: 0.2, h: 0.09, label: 'DEFENDER SPAWN', kind: 'spawn' },
      { x: 0.38, y: 0.83, w: 0.24, h: 0.1, label: 'ATTACKER SPAWN', kind: 'spawn' },
    ],
  },
  // PUBG Tactical Sector Blueprints
  {
    id: 'Erangel',
    game: 'PUBG',
    name: 'Erangel (8x8)',
    boxes: [],
    waterY: 0.72,
    landmarks: [
      { x: 0.22, y: 0.28, label: 'GEORGOPOL' },
      { x: 0.48, y: 0.14, label: 'SEVERNY' },
      { x: 0.51, y: 0.34, label: 'ROZHOK' },
      { x: 0.55, y: 0.41, label: 'SCHOOL' },
      { x: 0.44, y: 0.49, label: 'POCHINKI' },
      { x: 0.74, y: 0.28, label: 'YASNAYA POLYANA' },
      { x: 0.72, y: 0.58, label: 'MYLTA' },
      { x: 0.2, y: 0.65, label: 'PRIMORSK' },
      { x: 0.36, y: 0.72, label: 'WEST BRIDGE' },
      { x: 0.64, y: 0.72, label: 'EAST BRIDGE' },
      { x: 0.53, y: 0.84, label: 'SOSNOVKA MILITARY' },
    ],
  },
  {
    id: 'Miramar',
    game: 'PUBG',
    name: 'Miramar (8x8)',
    boxes: [],
    landmarks: [
      { x: 0.22, y: 0.32, label: 'EL POZO' },
      { x: 0.48, y: 0.31, label: 'SAN MARTIN' },
      { x: 0.54, y: 0.27, label: 'HACIENDA' },
      { x: 0.47, y: 0.52, label: 'PECADO' },
      { x: 0.68, y: 0.62, label: 'LOS LEONES' },
      { x: 0.32, y: 0.65, label: 'CHUMACERA' },
      { x: 0.75, y: 0.34, label: 'CRUZ DEL VALLE' },
      { x: 0.24, y: 0.78, label: 'VALLE DEL MAR' },
    ],
  },
  {
    id: 'Taego',
    game: 'PUBG',
    name: 'Taego (8x8)',
    boxes: [],
    landmarks: [
      { x: 0.48, y: 0.45, label: 'TERMINAL' },
      { x: 0.43, y: 0.24, label: 'PALACE' },
      { x: 0.62, y: 0.38, label: 'SCHOOL' },
      { x: 0.28, y: 0.58, label: 'GO DOK' },
      { x: 0.68, y: 0.68, label: 'HOSANNA' },
      { x: 0.24, y: 0.28, label: 'ARMY BASE' },
      { x: 0.76, y: 0.48, label: 'SHIPYARD' },
    ],
  },
  {
    id: 'Rondo',
    game: 'PUBG',
    name: 'Rondo (8x8)',
    boxes: [],
    landmarks: [
      { x: 0.66, y: 0.62, label: 'JADENA CITY' },
      { x: 0.48, y: 0.48, label: 'STADIUM' },
      { x: 0.34, y: 0.36, label: 'NEOX FACTORY' },
      { x: 0.24, y: 0.64, label: 'RIN JIANG' },
      { x: 0.28, y: 0.22, label: 'MEY RAN' },
      { x: 0.74, y: 0.28, label: 'YU LIN' },
      { x: 0.55, y: 0.76, label: 'TEST TRACK' },
    ],
  },
];

function createDefaultTokens(game: 'VALORANT' | 'PUBG'): BoardToken[] {
  const count = game === 'VALORANT' ? 5 : 4;
  const allies: BoardToken[] = Array.from({ length: count }, (_, i) => ({
    id: `ally-${i + 1}`,
    team: 'ally',
    label: `A${i + 1}`,
    x: 0.36 + i * 0.07,
    y: 0.86,
  }));
  const enemies: BoardToken[] = Array.from({ length: count }, (_, i) => ({
    id: `enemy-${i + 1}`,
    team: 'enemy',
    label: `E${i + 1}`,
    x: 0.36 + i * 0.07,
    y: 0.12,
  }));
  return [...allies, ...enemies];
}

function loadPlaybook(): SavedStratPreset[] {
  try {
    const raw = localStorage.getItem(STRAT_PLAYBOOK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePlaybook(list: SavedStratPreset[]): SavedStratPreset[] {
  const trimmed = list.slice(0, 30);
  try {
    localStorage.setItem(STRAT_PLAYBOOK_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignore storage quota
  }
  return trimmed;
}

export const TacticalBoardModal: React.FC<TacticalBoardModalProps> = ({
  isOpen,
  initialGame,
  initialMapName = '',
  dataRevision = 0,
  onClose,
}) => {
  const { tr } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [boardGame, setBoardGame] = useState<'VALORANT' | 'PUBG'>(initialGame);
  const availableMaps = useMemo(
    () => MAP_BLUEPRINTS.filter((m) => m.game === boardGame),
    [boardGame]
  );

  const [selectedMapId, setSelectedMapId] = useState<string>(
    availableMaps[0]?.id || 'Ascent'
  );
  const [activeTool, setActiveTool] = useState<BoardTool>('move');
  const [strokeColor, setStrokeColor] = useState<string>('#38BDF8');

  const [tokens, setTokens] = useState<BoardToken[]>(() => createDefaultTokens(initialGame));
  const [stamps, setStamps] = useState<BoardStamp[]>([]);
  const [strokes, setStrokes] = useState<BoardStroke[]>([]);
  const [activeStroke, setActiveStroke] = useState<BoardStroke | null>(null);

  const [zoneRadius, setZoneRadius] = useState<number>(0.24);
  const [zoneCenter, setZoneCenter] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.48 });

  const [playbook, setPlaybook] = useState<SavedStratPreset[]>(() => loadPlaybook());
  const [stratTitle, setStratTitle] = useState('');
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const dragTargetRef = useRef<
    | { kind: 'token'; id: string }
    | { kind: 'stamp'; id: string }
    | { kind: 'zone' }
    | null
  >(null);

  useEffect(() => {
    if (!isOpen) return;
    setPlaybook(loadPlaybook());
    setBoardGame(initialGame);

    const gameMaps = MAP_BLUEPRINTS.filter((m) => m.game === initialGame);
    const matched = gameMaps.find(
      (m) => initialMapName && initialMapName.toLowerCase().includes(m.id.toLowerCase())
    );
    const nextMapId = matched?.id || gameMaps[0]?.id || 'Ascent';
    setSelectedMapId(nextMapId);
    setTokens(createDefaultTokens(initialGame));
    setStamps([]);
    setStrokes([]);
    setStatusNote(null);
  }, [isOpen, initialGame, initialMapName, dataRevision]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const handleSwitchBoardGame = (nextGame: 'VALORANT' | 'PUBG') => {
    setBoardGame(nextGame);
    const firstMap = MAP_BLUEPRINTS.find((m) => m.game === nextGame)?.id || 'Ascent';
    setSelectedMapId(firstMap);
    setTokens(createDefaultTokens(nextGame));
    setStamps([]);
    setStrokes([]);
  };

  const activeBlueprint = useMemo(
    () =>
      MAP_BLUEPRINTS.find((m) => m.id === selectedMapId && m.game === boardGame) ||
      availableMaps[0],
    [availableMaps, boardGame, selectedMapId]
  );

  const renderBoard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeBlueprint) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isValo = boardGame === 'VALORANT';

    // 1. Tactical Substrate
    ctx.fillStyle = isValo ? '#090C12' : '#0B1016';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // 2. Coordinate Grid (8x8 for PUBG, architectural grid for VALORANT)
    const cols = 8;
    const rows = 8;
    ctx.strokeStyle = isValo ? 'rgba(255, 70, 85, 0.08)' : 'rgba(229, 154, 35, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 1; i < cols; i += 1) {
      const gx = (CANVAS_W / cols) * i;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, CANVAS_H);
      ctx.stroke();
    }
    for (let j = 1; j < rows; j += 1) {
      const gy = (CANVAS_H / rows) * j;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(CANVAS_W, gy);
      ctx.stroke();
    }

    if (!isValo) {
      // Grid Headers A-H / 1-8
      ctx.fillStyle = '#64748B';
      ctx.font = 'bold 10px JetBrains Mono, monospace';
      for (let i = 0; i < 8; i += 1) {
        ctx.fillText(String.fromCharCode(65 + i), (CANVAS_W / 8) * i + 8, 14);
        ctx.fillText(String(i + 1), 6, (CANVAS_H / 8) * i + 26);
      }

      if (typeof activeBlueprint.waterY === 'number') {
        const wy = activeBlueprint.waterY * CANVAS_H;
        ctx.fillStyle = 'rgba(56, 189, 248, 0.09)';
        ctx.fillRect(0, wy - 18, CANVAS_W, 36);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
        ctx.beginPath();
        ctx.moveTo(0, wy - 18);
        ctx.lineTo(CANVAS_W, wy - 18);
        ctx.moveTo(0, wy + 18);
        ctx.lineTo(CANVAS_W, wy + 18);
        ctx.stroke();
      }

      // PUBG Landmarks
      (activeBlueprint.landmarks || []).forEach((lm) => {
        const lx = lm.x * CANVAS_W;
        const ly = lm.y * CANVAS_H;
        ctx.fillStyle = '#171D28';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.2;
        ctx.fillRect(lx - 6, ly - 6, 12, 12);
        ctx.strokeRect(lx - 6, ly - 6, 12, 12);

        ctx.fillStyle = '#CBD5E1';
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(lm.label, lx, ly - 11);
      });
      ctx.textAlign = 'left';

      // PUBG Safe Zone Ring
      if (zoneRadius > 0.04) {
        const zx = zoneCenter.x * CANVAS_W;
        const zy = zoneCenter.y * CANVAS_H;
        const zr = zoneRadius * Math.min(CANVAS_W, CANVAS_H);
        ctx.beginPath();
        ctx.arc(zx, zy, zr, 0, Math.PI * 2);
        ctx.strokeStyle = '#EEF2F6';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(zx, zy, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#E59A23';
        ctx.fill();
      }
    } else {
      // VALORANT Callout Boxes & Corridors
      activeBlueprint.boxes.forEach((box) => {
        const bx = box.x * CANVAS_W;
        const by = box.y * CANVAS_H;
        const bw = box.w * CANVAS_W;
        const bh = box.h * CANVAS_H;

        if (box.kind === 'site') {
          ctx.fillStyle = 'rgba(255, 70, 85, 0.12)';
          ctx.strokeStyle = 'rgba(255, 70, 85, 0.6)';
          ctx.lineWidth = 2;
        } else if (box.kind === 'spawn') {
          ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
          ctx.lineWidth = 1.4;
        } else {
          ctx.fillStyle = 'rgba(23, 29, 40, 0.85)';
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 1.4;
        }

        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeRect(bx, by, bw, bh);

        ctx.fillStyle = box.kind === 'site' ? '#FF4655' : '#94A3B8';
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(box.label, bx + bw / 2, by + bh / 2 + 4);
      });
      ctx.textAlign = 'left';
    }

    // 3. Utility Stamps (Smoke, Flash, Molly, Objective)
    stamps.forEach((st) => {
      const sx = st.x * CANVAS_W;
      const sy = st.y * CANVAS_H;
      if (st.kind === 'smoke') {
        ctx.beginPath();
        ctx.arc(sx, sy, 32, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(148, 163, 184, 0.34)';
        ctx.fill();
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.fillStyle = '#EEF2F6';
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SMK', sx, sy + 3);
      } else if (st.kind === 'flash') {
        ctx.beginPath();
        ctx.arc(sx, sy, 18, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(229, 154, 35, 0.32)';
        ctx.fill();
        ctx.strokeStyle = '#E59A23';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#E59A23';
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('FLS', sx, sy + 3);
      } else if (st.kind === 'molly') {
        ctx.beginPath();
        ctx.arc(sx, sy, 28, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 70, 85, 0.28)';
        ctx.fill();
        ctx.strokeStyle = '#FF4655';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#FF4655';
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('MLY', sx, sy + 3);
      } else {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.3)';
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2;
        ctx.fillRect(-10, -10, 20, 20);
        ctx.strokeRect(-10, -10, 20, 20);
        ctx.restore();
      }
      ctx.textAlign = 'left';
    });

    // 4. Drawn Strokes & Sightline Arrows
    const allStrokes = activeStroke ? [...strokes, activeStroke] : strokes;
    allStrokes.forEach((stroke) => {
      if (stroke.points.length < 2) return;
      ctx.strokeStyle = stroke.color;
      ctx.fillStyle = stroke.color;
      ctx.lineWidth = 2.8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.tool === 'pen') {
        ctx.beginPath();
        stroke.points.forEach((pt, idx) => {
          const px = pt.x * CANVAS_W;
          const py = pt.y * CANVAS_H;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      } else {
        const start = stroke.points[0];
        const end = stroke.points[stroke.points.length - 1];
        const x1 = start.x * CANVAS_W;
        const y1 = start.y * CANVAS_H;
        const x2 = end.x * CANVAS_W;
        const y2 = end.y * CANVAS_H;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const head = 13;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      }
    });

    // 5. Draggable Squad / Agent Tokens
    tokens.forEach((tk) => {
      const tx = tk.x * CANVAS_W;
      const ty = tk.y * CANVAS_H;
      ctx.beginPath();
      ctx.arc(tx, ty, 13, 0, Math.PI * 2);
      ctx.fillStyle = tk.team === 'ally' ? '#10B981' : '#FF4655';
      ctx.fill();
      ctx.strokeStyle = '#0A0D12';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      ctx.fillStyle = tk.team === 'ally' ? '#0A0D12' : '#EEF2F6';
      ctx.font = 'bold 10.5px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(tk.label, tx, ty + 3.5);
    });
    ctx.textAlign = 'left';

    // 6. Watermark Footer on Canvas
    ctx.fillStyle = 'rgba(10, 13, 18, 0.82)';
    ctx.fillRect(10, CANVAS_H - 28, 310, 20);
    ctx.fillStyle = '#94A3B8';
    ctx.font = 'bold 11px JetBrains Mono, monospace';
    ctx.fillText(
      `TacticalReplayAI | ${boardGame} - ${activeBlueprint.name} ${stratTitle ? `| ${stratTitle}` : ''}`.slice(
        0,
        48
      ),
      16,
      CANVAS_H - 14
    );
  }, [
    activeBlueprint,
    activeStroke,
    boardGame,
    stamps,
    stratTitle,
    strokes,
    tokens,
    zoneCenter.x,
    zoneCenter.y,
    zoneRadius,
  ]);

  useEffect(() => {
    if (isOpen) {
      renderBoard();
    }
  }, [isOpen, renderBoard]);

  if (!isOpen) return null;

  const getNormPoint = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0.02, Math.min(0.98, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0.02, Math.min(0.98, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = getNormPoint(e);

    if (activeTool === 'move') {
      // Check tokens first
      const hitToken = [...tokens]
        .reverse()
        .find((tk) => Math.hypot((tk.x - pt.x) * CANVAS_W, (tk.y - pt.y) * CANVAS_H) <= 18);
      if (hitToken) {
        dragTargetRef.current = { kind: 'token', id: hitToken.id };
        return;
      }

      const hitStamp = [...stamps]
        .reverse()
        .find((st) => Math.hypot((st.x - pt.x) * CANVAS_W, (st.y - pt.y) * CANVAS_H) <= 28);
      if (hitStamp) {
        dragTargetRef.current = { kind: 'stamp', id: hitStamp.id };
        return;
      }

      if (
        boardGame === 'PUBG' &&
        Math.hypot((zoneCenter.x - pt.x) * CANVAS_W, (zoneCenter.y - pt.y) * CANVAS_H) <= 22
      ) {
        dragTargetRef.current = { kind: 'zone' };
      }
      return;
    }

    if (
      activeTool === 'smoke' ||
      activeTool === 'flash' ||
      activeTool === 'molly' ||
      activeTool === 'objective'
    ) {
      setStamps((prev) => [
        ...prev,
        { id: `st-${Date.now()}`, kind: activeTool, x: pt.x, y: pt.y },
      ]);
      return;
    }

    if (activeTool === 'arrow' || activeTool === 'pen') {
      setActiveStroke({
        tool: activeTool,
        color: strokeColor,
        points: [pt],
      });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = getNormPoint(e);

    if (dragTargetRef.current) {
      const target = dragTargetRef.current;
      if (target.kind === 'token') {
        setTokens((prev) =>
          prev.map((tk) => (tk.id === target.id ? { ...tk, x: pt.x, y: pt.y } : tk))
        );
      } else if (target.kind === 'stamp') {
        setStamps((prev) =>
          prev.map((st) => (st.id === target.id ? { ...st, x: pt.x, y: pt.y } : st))
        );
      } else if (target.kind === 'zone') {
        setZoneCenter(pt);
      }
      return;
    }

    if (activeStroke) {
      setActiveStroke((prev) => {
        if (!prev) return null;
        if (prev.tool === 'pen') {
          return { ...prev, points: [...prev.points, pt] };
        }
        return { ...prev, points: [prev.points[0], pt] };
      });
    }
  };

  const handleCanvasMouseUp = () => {
    dragTargetRef.current = null;
    if (activeStroke && activeStroke.points.length >= 2) {
      setStrokes((prev) => [...prev, activeStroke]);
    }
    setActiveStroke(null);
  };

  const handleUndo = () => {
    if (strokes.length > 0) {
      setStrokes((prev) => prev.slice(0, -1));
    } else if (stamps.length > 0) {
      setStamps((prev) => prev.slice(0, -1));
    }
  };

  const handleClearBoard = () => {
    setTokens(createDefaultTokens(boardGame));
    setStamps([]);
    setStrokes([]);
  };

  const handleSaveStrat = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle =
      stratTitle.trim() || `${selectedMapId} #${playbook.filter((p) => p.game === boardGame).length + 1}`;
    const preset: SavedStratPreset = {
      id: `strat-${Date.now()}`,
      title: cleanTitle,
      game: boardGame,
      mapId: selectedMapId,
      tokens,
      stamps,
      strokes,
      zoneRadius,
      zoneCenter,
      updatedAt: new Date().toISOString(),
    };
    const next = savePlaybook([preset, ...playbook]);
    setPlaybook(next);
    setStratTitle('');
    setStatusNote(tr(`Saved playbook "${cleanTitle}"`, `Đã lưu chiến thuật "${cleanTitle}"`));
    window.setTimeout(() => setStatusNote(null), 2500);
  };

  const handleLoadStrat = (preset: SavedStratPreset) => {
    setBoardGame(preset.game);
    setSelectedMapId(preset.mapId);
    setTokens(preset.tokens);
    setStamps(preset.stamps);
    setStrokes(preset.strokes);
    setZoneRadius(preset.zoneRadius ?? 0.24);
    setZoneCenter(preset.zoneCenter || { x: 0.5, y: 0.48 });
    setStratTitle(preset.title);
  };

  const handleDeleteStrat = (id: string) => {
    setPlaybook(savePlaybook(playbook.filter((p) => p.id !== id)));
  };

  const handleCopyBoardPng = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png')
    );
    if (!blob) return;

    try {
      if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setStatusNote(
          tr('Copied strategy board PNG to clipboard!', 'Đã copy ảnh Sa bàn vào clipboard!')
        );
        window.setTimeout(() => setStatusNote(null), 2500);
        return;
      }
    } catch {
      // Fallback to download
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `strat-${boardGame.toLowerCase()}-${selectedMapId.toLowerCase()}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setStatusNote(tr('Downloaded strategy PNG!', 'Đã tải ảnh PNG Sa bàn!'));
    window.setTimeout(() => setStatusNote(null), 2500);
  };

  const isValo = boardGame === 'VALORANT';
  const filteredPlaybook = playbook.filter((p) => p.game === boardGame);

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0A0D12]/85 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tactical-board-title"
    >
      <div className="bg-[#10141C] border border-[#334155] rounded-[4px] w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-[#232B3B] bg-[#0A0D12]">
          <div className="flex items-center gap-3">
            <div
              className={`h-8 w-8 rounded-[2px] flex items-center justify-center border ${
                isValo
                  ? 'bg-[#FF4655]/15 border-[#FF4655]/45 text-[#FF4655] theme-cut-valo'
                  : 'bg-[#E59A23]/15 border-[#E59A23]/45 text-[#E59A23]'
              }`}
            >
              <Strategy size={17} weight="bold" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="tactical-board-title"
                className="font-display text-base font-bold text-[#EEF2F6]"
              >
                {tr('2D Tactical Strategy & Callout Board', 'Sa bàn Chiến thuật & Callout 2D')}
              </h2>
              <p className="text-xs text-[#94A3B8]">
                {tr(
                  'Drag squad tokens, stamp smokes/flashes/mollies, sketch rotations, and copy PNG for Discord',
                  'Kéo thả vị trí đội hình, đặt Smoke/Flash/Molly, vẽ mũi tên di chuyển và xuất PNG gửi Discord'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {statusNote && (
              <span className="font-mono text-xs text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/30 px-2.5 py-1 rounded-[2px]">
                {statusNote}
              </span>
            )}
            <button
              type="button"
              onClick={() => void handleCopyBoardPng()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-[#38BDF8] hover:bg-sky-300 text-[#0A0D12] text-xs font-bold transition"
            >
              <Camera size={14} weight="bold" aria-hidden="true" />
              <span>{tr('Copy PNG', 'Copy ảnh PNG')}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={tr('Close Strategy Board', 'Đóng Sa bàn 2D')}
              className="p-1.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] text-[#94A3B8] hover:text-[#EEF2F6]"
            >
              <X size={15} weight="bold" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Body Grid */}
        <div className="flex-1 overflow-y-auto tactical-scrollbar p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Canvas Column */}
          <div className="lg:col-span-9 space-y-3">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[2px] bg-[#0A0D12] border border-[#232B3B] p-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="flex p-0.5 rounded-[2px] bg-[#10141C] border border-[#232B3B]">
                  <button
                    type="button"
                    onClick={() => handleSwitchBoardGame('VALORANT')}
                    className={`px-2.5 py-1 rounded-[2px] font-mono text-[11px] font-bold ${
                      isValo ? 'bg-[#FF4655] text-[#EEF2F6]' : 'text-[#94A3B8]'
                    }`}
                  >
                    VALORANT
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchBoardGame('PUBG')}
                    className={`px-2.5 py-1 rounded-[2px] font-mono text-[11px] font-bold ${
                      !isValo ? 'bg-[#E59A23] text-[#0A0D12]' : 'text-[#94A3B8]'
                    }`}
                  >
                    PUBG
                  </button>
                </div>

                <label htmlFor="strat-map-select" className="sr-only">
                  {tr('Select tactical map', 'Chọn bản đồ chiến thuật')}
                </label>
                <select
                  id="strat-map-select"
                  value={selectedMapId}
                  onChange={(e) => setSelectedMapId(e.target.value)}
                  className="px-2.5 py-1 rounded-[2px] bg-[#10141C] border border-[#232B3B] font-mono text-xs font-bold text-[#EEF2F6]"
                >
                  {availableMaps.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>

                {(
                  [
                    { id: 'move', label: tr('Move', 'Kéo thả'), icon: HandGrabbing },
                    { id: 'smoke', label: 'Smoke', icon: Circle },
                    { id: 'flash', label: 'Flash', icon: Lightning },
                    { id: 'molly', label: isValo ? 'Molly' : 'Nade', icon: Fire },
                    { id: 'objective', label: isValo ? 'Spike' : 'Drop', icon: Target },
                    { id: 'arrow', label: tr('Arrow', 'Mũi tên'), icon: ArrowUpRight },
                    { id: 'pen', label: tr('Line', 'Vẽ nét'), icon: PencilSimple },
                  ] as const
                ).map((tool) => {
                  const IconComp = tool.icon;
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => setActiveTool(tool.id)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-[2px] border text-xs font-semibold transition ${
                        activeTool === tool.id
                          ? 'bg-[#232B3B] border-[#38BDF8] text-[#EEF2F6]'
                          : 'bg-[#171D28] border-[#232B3B] text-[#94A3B8] hover:text-[#EEF2F6]'
                      }`}
                    >
                      <IconComp size={12} weight="bold" aria-hidden="true" />
                      <span>{tool.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5">
                {(['#38BDF8', '#10B981', '#E59A23', '#FF4655'] as const).map((col) => (
                  <button
                    key={col}
                    type="button"
                    aria-label={tr(`Select ink color ${col}`, `Chọn màu vẽ ${col}`)}
                    onClick={() => setStrokeColor(col)}
                    style={{ backgroundColor: col }}
                    className={`h-4 w-4 rounded-[2px] ${
                      strokeColor === col ? 'ring-2 ring-[#EEF2F6] scale-110' : 'opacity-75'
                    }`}
                  />
                ))}

                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={strokes.length === 0 && stamps.length === 0}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-[2px] bg-[#171D28] border border-[#232B3B] text-xs text-[#94A3B8] hover:text-[#EEF2F6] disabled:opacity-40"
                >
                  <ArrowCounterClockwise size={12} weight="bold" aria-hidden="true" />
                  <span>{tr('Undo', 'Hoàn tác')}</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearBoard}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-[2px] bg-[#171D28] border border-[#232B3B] text-xs text-[#F43F5E] hover:bg-[#232B3B]"
                >
                  <Trash size={12} weight="bold" aria-hidden="true" />
                  <span>{tr('Reset', 'Đặt lại')}</span>
                </button>
              </div>
            </div>

            {!isValo && (
              <div className="flex items-center gap-3 rounded-[2px] bg-[#0A0D12] border border-[#232B3B] px-3 py-1.5 text-xs font-mono text-[#94A3B8]">
                <Crosshair size={13} weight="bold" className="text-[#E59A23]" aria-hidden="true" />
                <label htmlFor="pubg-board-zone-radius">
                  {tr('Safe Zone Circle Size:', 'Bán kính Vòng Bo Trắng:')}
                </label>
                <input
                  id="pubg-board-zone-radius"
                  type="range"
                  min={0}
                  max={42}
                  value={Math.round(zoneRadius * 100)}
                  onChange={(e) => setZoneRadius(Number(e.target.value) / 100)}
                  className="w-40 accent-[#E59A23] cursor-pointer"
                />
                <span className="text-[11px] text-[#64748B]">
                  {tr(
                    '(Use Move tool to drag orange center dot)',
                    '(Dùng công cụ Kéo thả để di chuyển tâm bo màu cam)'
                  )}
                </span>
              </div>
            )}

            <div className="rounded-[2px] border border-[#232B3B] bg-[#0A0D12] overflow-hidden">
              <canvas
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                role="img"
                aria-label={tr(
                  `Interactive 2D strategy board for ${selectedMapId}`,
                  `Sa bàn chiến thuật 2D cho bản đồ ${selectedMapId}`
                )}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                className={`w-full h-auto block select-none ${
                  activeTool === 'move' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
                }`}
              />
            </div>
          </div>

          {/* Playbook Presets Column */}
          <div className="lg:col-span-3 flex flex-col gap-3">
            <form
              onSubmit={handleSaveStrat}
              className="rounded-[4px] border border-[#232B3B] bg-[#0A0D12] p-3 space-y-2.5"
            >
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[#EEF2F6]">
                {tr('Save to Team Playbook', 'Lưu vào Sổ tay Chiến thuật')}
              </h3>
              <label htmlFor="strat-preset-title" className="sr-only">
                {tr('Strategy preset title', 'Tên bài đánh chiến thuật')}
              </label>
              <input
                id="strat-preset-title"
                type="text"
                value={stratTitle}
                onChange={(e) => setStratTitle(e.target.value)}
                placeholder={
                  isValo
                    ? tr('e.g. Ascent A Split Default', 'VD: Bài đánh A Split Ascent')
                    : tr('e.g. Bridge Gatekeep Phase 4', 'VD: Giữ cầu Quân sự Bo 4')
                }
                className="w-full px-2.5 py-1.5 rounded-[2px] bg-[#10141C] border border-[#232B3B] text-xs text-[#EEF2F6] placeholder-[#64748B] focus:outline-none focus:border-[#38BDF8]"
              />
              <button
                type="submit"
                className={`w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-[2px] text-xs font-bold transition ${
                  isValo
                    ? 'bg-[#FF4655] hover:bg-rose-500 text-[#EEF2F6]'
                    : 'bg-[#E59A23] hover:bg-amber-400 text-[#0A0D12]'
                }`}
              >
                <FloppyDisk size={14} weight="bold" aria-hidden="true" />
                <span>{tr('Save Playbook Preset', 'Lưu Bài đánh')}</span>
              </button>
            </form>

            <div className="flex-1 rounded-[4px] border border-[#232B3B] bg-[#0A0D12] p-3 space-y-2 overflow-y-auto max-h-[54vh] tactical-scrollbar">
              <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
                {tr(
                  `Saved ${boardGame} Plays (${filteredPlaybook.length})`,
                  `Bài đánh ${boardGame} đã lưu (${filteredPlaybook.length})`
                )}
              </h3>

              {filteredPlaybook.length === 0 ? (
                <p className="text-xs text-[#64748B] leading-relaxed">
                  {tr(
                    'No saved strategies for this game yet. Arrange tokens and utility on the board, then click Save.',
                    'Chưa có bài đánh nào được lưu. Sắp xếp đội hình và bom khói trên bản đồ rồi bấm Lưu.'
                  )}
                </p>
              ) : (
                filteredPlaybook.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-[2px] bg-[#10141C] border border-[#232B3B] hover:border-[#334155]"
                  >
                    <button
                      type="button"
                      onClick={() => handleLoadStrat(p)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <p className="text-xs font-bold text-[#EEF2F6] truncate">{p.title}</p>
                      <p className="font-mono text-[10px] text-[#64748B]">
                        {p.mapId} - {p.stamps.length} util - {p.strokes.length} lines
                      </p>
                    </button>
                    <button
                      type="button"
                      aria-label={tr(`Delete strategy ${p.title}`, `Xóa bài đánh ${p.title}`)}
                      onClick={() => handleDeleteStrat(p.id)}
                      className="p-1 text-[#64748B] hover:text-[#F43F5E]"
                    >
                      <Trash size={13} weight="bold" aria-hidden="true" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
