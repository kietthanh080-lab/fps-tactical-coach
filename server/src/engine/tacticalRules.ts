export interface TimelineEventInput {
  timestampMs: number;
  round: number;
  type: string;
  payload?: Record<string, any>;
}

export interface WeaponUsageStat {
  weaponName: string;
  category: 'AR' | 'DMR' | 'SR' | 'SMG' | 'LMG' | 'SG' | 'Pistol' | 'Throwable' | 'Other';
  kills: number;
  headshots: number;
  damageDealt: number;
  hits: number;
  throwablesUsed?: number;
  maxKillDistanceMeters?: number;
}

export interface RawRoundInput {
  roundNumber: number;
  startTimestampMs: number;
  endTimestampMs: number;
  result: 'WIN' | 'LOSS' | 'SURVIVED' | 'ELIMINATED';
  kills: number;
  deaths: number;
  assists: number;
  damageDealt: number;
  // Dữ liệu đặc thù VALORANT
  teamAvgLoadoutValue?: number;
  plantTimeMs?: number;
  siteSwitches?: number;
  wonOpeningDuel?: boolean;
  wasTradedWithin3s?: boolean;
  unusedAbilitiesCount?: number;
  // Dữ liệu đặc thù PUBG
  zonePhase?: number;
  distanceMovedMeters?: number;
  weaponStats?: WeaponUsageStat[];
  events: TimelineEventInput[];
}

export interface AnalyzedRound {
  roundNumber: number;
  startTimestampMs: number;
  endTimestampMs: number;
  result: 'WIN' | 'LOSS' | 'SURVIVED' | 'ELIMINATED';
  economyType: 'ECO' | 'FORCE_BUY' | 'BONUS' | 'FULL_BUY' | 'EARLY_LOOT' | 'LATE_ZONE';
  tacticalStyle: string;
  kills: number;
  deaths: number;
  assists: number;
  damageDealt: number;
  strengths: string[];
  mistakes: string[];
  weaponStats: WeaponUsageStat[];
  events: TimelineEventInput[];
}

const PUBG_WEAPON_CATALOG: Record<
  string,
  { name: string; category: WeaponUsageStat['category'] }
> = {
  // Assault Rifles (AR)
  WeapHK416_C: { name: 'M416', category: 'AR' },
  WeapBerylM762_C: { name: 'Beryl M762', category: 'AR' },
  WeapAK47_C: { name: 'AKM', category: 'AR' },
  WeapAUG_C: { name: 'AUG A3', category: 'AR' },
  WeapACE32_C: { name: 'ACE32', category: 'AR' },
  'WeapSCAR-L_C': { name: 'SCAR-L', category: 'AR' },
  WeapG36C_C: { name: 'G36C', category: 'AR' },
  WeapQBZ95_C: { name: 'QBZ95', category: 'AR' },
  WeapK2_C: { name: 'K2', category: 'AR' },
  WeapM16A4_C: { name: 'M16A4', category: 'AR' },
  WeapMk47Mutant_C: { name: 'Mk47 Mutant', category: 'AR' },
  WeapGroza_C: { name: 'Groza', category: 'AR' },
  WeapFamasG2_C: { name: 'FAMAS', category: 'AR' },
  // Designated Marksman Rifles (DMR)
  WeapMini14_C: { name: 'Mini 14', category: 'DMR' },
  WeapSKS_C: { name: 'SKS', category: 'DMR' },
  WeapMk12_C: { name: 'Mk12', category: 'DMR' },
  WeapDragunov_C: { name: 'Dragunov', category: 'DMR' },
  WeapSLR_C: { name: 'SLR', category: 'DMR' },
  WeapQBU88_C: { name: 'QBU', category: 'DMR' },
  WeapVSS_C: { name: 'VSS', category: 'DMR' },
  WeapMk14_C: { name: 'Mk14', category: 'DMR' },
  // Sniper Rifles (SR)
  WeapKar98k_C: { name: 'Kar98k', category: 'SR' },
  WeapM24_C: { name: 'M24', category: 'SR' },
  WeapAWM_C: { name: 'AWM', category: 'SR' },
  WeapMosinNagant_C: { name: 'Mosin Nagant', category: 'SR' },
  WeapLynxAMR_C: { name: 'Lynx AMR', category: 'SR' },
  WeapWin94_C: { name: 'Win94', category: 'SR' },
  // Submachine Guns (SMG)
  WeapUMP_C: { name: 'UMP45', category: 'SMG' },
  WeapJS9_C: { name: 'JS9', category: 'SMG' },
  WeapVector_C: { name: 'Vector', category: 'SMG' },
  WeapUZI_C: { name: 'Micro UZI', category: 'SMG' },
  WeapBizonPP19_C: { name: 'PP-19 Bizon', category: 'SMG' },
  WeapMP5K_C: { name: 'MP5K', category: 'SMG' },
  WeapTommyGun_C: { name: 'Tommy Gun', category: 'SMG' },
  WeapP90_C: { name: 'P90', category: 'SMG' },
  WeapMP9_C: { name: 'MP9', category: 'SMG' },
  // Light Machine Guns (LMG)
  WeapM249_C: { name: 'M249', category: 'LMG' },
  WeapDP28_C: { name: 'DP-28', category: 'LMG' },
  WeapMG3_C: { name: 'MG3', category: 'LMG' },
  // Shotguns (SG)
  WeapS12K_C: { name: 'S12K', category: 'SG' },
  WeapS686_C: { name: 'S686', category: 'SG' },
  WeapS1897_C: { name: 'S1897', category: 'SG' },
  WeapDBS_C: { name: 'DBS', category: 'SG' },
  WeapO12_C: { name: 'O12', category: 'SG' },
  // Pistols
  WeapDesertEagle_C: { name: 'Deagle', category: 'Pistol' },
  WeapP18C_C: { name: 'P18C', category: 'Pistol' },
  WeapP92_C: { name: 'P92', category: 'Pistol' },
  WeapP1911_C: { name: 'P1911', category: 'Pistol' },
  WeapSkorpion_C: { name: 'Skorpion', category: 'Pistol' },
  WeapSawedOff_C: { name: 'Sawed-Off', category: 'Pistol' },
  WeapR1895_C: { name: 'R1895', category: 'Pistol' },
  WeapR45_C: { name: 'R45', category: 'Pistol' },
  // Throwables
  ProjGrenade_C: { name: 'Frag Grenade', category: 'Throwable' },
  WeapGrenade_C: { name: 'Frag Grenade', category: 'Throwable' },
  ProjMolotov_C: { name: 'Molotov', category: 'Throwable' },
  WeapMolotov_C: { name: 'Molotov', category: 'Throwable' },
  ProjSmokeBomb_C: { name: 'Smoke Grenade', category: 'Throwable' },
  WeapSmokeBomb_C: { name: 'Smoke Grenade', category: 'Throwable' },
  ProjFlashBang_C: { name: 'Stun Grenade', category: 'Throwable' },
  WeapFlashBang_C: { name: 'Stun Grenade', category: 'Throwable' },
  ProjC4_C: { name: 'C4', category: 'Throwable' },
  WeapC4_C: { name: 'C4', category: 'Throwable' },
  ProjStickyBomb_C: { name: 'Sticky Bomb', category: 'Throwable' },
  WeapStickyBomb_C: { name: 'Sticky Bomb', category: 'Throwable' },
  ProjBluezoneGrenade_C: { name: 'BZ Grenade', category: 'Throwable' },
  WeapBluezoneGrenade_C: { name: 'BZ Grenade', category: 'Throwable' },
};

export function resolvePubgWeapon(rawCode?: string): {
  name: string;
  category: WeaponUsageStat['category'];
} | null {
  if (!rawCode) return null;
  const trimmed = String(rawCode).trim();
  if (!trimmed) return null;

  // Bỏ qua sát thương môi trường (bo đốt, ngã, xe tông)
  if (
    (trimmed.includes('Bluezone') && !trimmed.includes('Grenade')) ||
    trimmed.includes('Fall') ||
    trimmed.includes('Drown') ||
    trimmed.includes('RedZone')
  ) {
    return null;
  }

  if (PUBG_WEAPON_CATALOG[trimmed]) {
    return PUBG_WEAPON_CATALOG[trimmed];
  }

  if (trimmed.startsWith('Weap') || trimmed.startsWith('Proj')) {
    const cleaned = trimmed
      .replace(/^(Item_Weapon_|Weap|Proj)/, '')
      .replace(/_C$/, '')
      .replace(/_/g, ' ');
    return {
      name: cleaned || trimmed,
      category: trimmed.startsWith('Proj') ? 'Throwable' : 'Other',
    };
  }

  return null;
}

export function analyzeRoundTactics(
  round: RawRoundInput,
  gameType: 'VALORANT' | 'PUBG'
): AnalyzedRound {
  const strengths: string[] = [];
  const mistakes: string[] = [];
  const weaponStats = round.weaponStats || [];

  if (gameType === 'VALORANT') {
    const avgLoadout = round.teamAvgLoadoutValue ?? 3900;
    let economyType: AnalyzedRound['economyType'] = 'FULL_BUY';
    if (avgLoadout < 1600) economyType = 'ECO';
    else if (avgLoadout < 3100) economyType = 'FORCE_BUY';
    else if (avgLoadout < 3700) economyType = 'BONUS';

    const plantSec = (round.plantTimeMs ?? 0) / 1000;
    let tacticalStyle = 'DEFAULT_CONTROL';
    if (plantSec > 0 && plantSec <= 25) {
      tacticalStyle = 'FAST_EXECUTE';
    } else if ((round.siteSwitches ?? 0) >= 1) {
      tacticalStyle = 'FAKE_ROTATE';
    }

    if (round.wonOpeningDuel) {
      strengths.push('Opening Pick: Thắng giao tranh mở màn, tạo lợi thế hơn người sớm.');
    }
    if (round.kills >= 2) {
      strengths.push(`Multi-Kill (${round.kills} mạng): Tạo đột biến lớn trong giao tranh.`);
    }
    if (round.deaths > 0 && round.wasTradedWithin3s === false) {
      mistakes.push('Untraded Death: Bị hạ gục ở vị trí tách lẻ, đồng đội không thể đổi mạng.');
    }
    if (round.deaths > 0 && (round.unusedAbilitiesCount ?? 0) >= 2) {
      mistakes.push(`Lãng phí tài nguyên: Bị hạ gục khi còn dư ${round.unusedAbilitiesCount} kỹ năng.`);
    }
    if (economyType === 'ECO' && round.result === 'WIN') {
      strengths.push('Thrifty Win: Thắng round thiếu trang bị nhờ phối hợp chiến thuật tốt.');
    }

    return {
      roundNumber: round.roundNumber,
      startTimestampMs: round.startTimestampMs,
      endTimestampMs: round.endTimestampMs,
      result: round.result,
      economyType,
      tacticalStyle,
      kills: round.kills,
      deaths: round.deaths,
      assists: round.assists,
      damageDealt: round.damageDealt,
      strengths,
      mistakes,
      weaponStats,
      events: round.events,
    };
  }

  // Phân tích chiến thuật theo từng giai đoạn vòng bo (PUBG)
  const phase = round.zonePhase ?? round.roundNumber;
  const economyType: AnalyzedRound['economyType'] = phase <= 2 ? 'EARLY_LOOT' : 'LATE_ZONE';

  let tacticalStyle = 'EDGE_ROTATION';
  if (phase === 1 && (round.kills > 0 || round.damageDealt > 120)) {
    tacticalStyle = 'HOT_DROP_AGGRO';
  } else if ((round.distanceMovedMeters ?? 0) < 150 && phase >= 3) {
    tacticalStyle = 'CENTER_HOLD';
  }

  if (round.damageDealt >= 180) {
    strengths.push(
      `Áp lực hỏa lực cao: Gây ${Math.round(round.damageDealt)} sát thương trong Phase ${phase}.`
    );
  }
  if (round.kills >= 1 && round.deaths === 0) {
    strengths.push(`Xử lý giao tranh gọn: Hạ gục ${round.kills} mục tiêu và bảo toàn vị trí.`);
  }

  const longRangeSniper = weaponStats.find(
    (w) => (w.category === 'SR' || w.category === 'DMR') && (w.maxKillDistanceMeters || 0) >= 140
  );
  if (longRangeSniper) {
    strengths.push(
      `Bắn tỉa tầm xa: Hạ gục mục tiêu ở cự ly ${longRangeSniper.maxKillDistanceMeters}m bằng ${longRangeSniper.weaponName}.`
    );
  }

  const smokeStat = weaponStats.find((w) => w.weaponName === 'Smoke Grenade');
  if (phase >= 3 && (smokeStat?.throwablesUsed || 0) >= 2) {
    strengths.push(
      `Che chắn chiến thuật: Sử dụng ${smokeStat?.throwablesUsed} Smoke Grenade để tạo góc di chuyển an toàn.`
    );
  }

  if (round.deaths > 0 && round.damageDealt < 40) {
    mistakes.push(
      `Bị bắt lẻ ở Phase ${phase}: Bị hạ gục nhanh trước khi kịp phản kháng hoặc ném smoke.`
    );
  }
  if (phase >= 4 && (round.distanceMovedMeters ?? 0) > 650) {
    mistakes.push('Di chuyển muộn: Phải chạy bo quãng đường dài ở vòng bo cuối, dễ lộ vị trí.');
  }

  return {
    roundNumber: round.roundNumber,
    startTimestampMs: round.startTimestampMs,
    endTimestampMs: round.endTimestampMs,
    result: round.result,
    economyType,
    tacticalStyle,
    kills: round.kills,
    deaths: round.deaths,
    assists: round.assists,
    damageDealt: Math.round(round.damageDealt),
    strengths,
    mistakes,
    weaponStats,
    events: round.events,
  };
}

// Chuyển đổi Telemetry PUBG thành từng giai đoạn vòng bo kèm chi tiết vũ khí
export function parsePubgTelemetryToRounds(
  telemetryEvents: any[],
  targetPlayerName: string,
  localTimeline: TimelineEventInput[]
): RawRoundInput[] {
  const matchStartLog = telemetryEvents.find((e) => e._T === 'LogMatchStart');
  const matchStartEpoch = matchStartLog ? new Date(matchStartLog._D).getTime() : 0;

  const roundsMap = new Map<number, RawRoundInput>();
  const phaseWeaponsMap = new Map<number, Map<string, WeaponUsageStat>>();
  let currentPhase = 1;
  const currentlyEquippedSet = new Set<string>();

  const getOrCreateWeaponStat = (
    phase: number,
    weaponName: string,
    category: WeaponUsageStat['category']
  ): WeaponUsageStat => {
    if (!phaseWeaponsMap.has(phase)) {
      phaseWeaponsMap.set(phase, new Map());
    }
    const wMap = phaseWeaponsMap.get(phase)!;
    if (!wMap.has(weaponName)) {
      wMap.set(weaponName, {
        weaponName,
        category,
        kills: 0,
        headshots: 0,
        damageDealt: 0,
        hits: 0,
        throwablesUsed: 0,
        maxKillDistanceMeters: 0,
      });
    }
    return wMap.get(weaponName)!;
  };

  const ensurePhase = (phase: number, timestampMs: number): RawRoundInput => {
    if (!roundsMap.has(phase)) {
      roundsMap.set(phase, {
        roundNumber: phase,
        zonePhase: phase,
        startTimestampMs: Math.max(0, timestampMs),
        endTimestampMs: Math.max(0, timestampMs + 60000),
        result: 'SURVIVED',
        kills: 0,
        deaths: 0,
        assists: 0,
        damageDealt: 0,
        distanceMovedMeters: 0,
        weaponStats: [],
        events: [],
      });

      // Kế thừa các vũ khí đang mang sẵn trên người từ phase trước
      for (const rawEquipped of currentlyEquippedSet) {
        const resolved = resolvePubgWeapon(rawEquipped);
        if (resolved && resolved.category !== 'Throwable' && resolved.category !== 'Pistol') {
          getOrCreateWeaponStat(phase, resolved.name, resolved.category);
        }
      }
    }
    return roundsMap.get(phase)!;
  };

  ensurePhase(1, 0);

  for (const ev of telemetryEvents) {
    const evTime = ev._D ? new Date(ev._D).getTime() - matchStartEpoch : 0;
    if (evTime < 0) continue;

    if (ev._T === 'LogPhaseChange' && typeof ev.phase === 'number') {
      const prevRound = ensurePhase(currentPhase, evTime);
      prevRound.endTimestampMs = evTime;
      currentPhase = ev.phase;
      ensurePhase(currentPhase, evTime);
    }

    const round = ensurePhase(currentPhase, evTime);
    round.endTimestampMs = Math.max(round.endTimestampMs, evTime);

    // 1. Theo dõi vũ khí người chơi trang bị / tháo ra trong từng giai đoạn
    if (ev._T === 'LogItemEquip' && ev.character?.name === targetPlayerName) {
      const itemId = String(ev.item?.itemId || '');
      const resolved = resolvePubgWeapon(itemId);
      if (resolved) {
        currentlyEquippedSet.add(itemId);
        if (resolved.category !== 'Throwable') {
          getOrCreateWeaponStat(currentPhase, resolved.name, resolved.category);
        }
      }
    }

    if (ev._T === 'LogItemUnequip' && ev.character?.name === targetPlayerName) {
      const itemId = String(ev.item?.itemId || '');
      currentlyEquippedSet.delete(itemId);
    }

    // 2. Theo dõi vũ khí ném (Smoke, Frag, Molotov, Stun)
    if (ev._T === 'LogPlayerUseThrowable' && ev.attacker?.name === targetPlayerName) {
      const resolved = resolvePubgWeapon(ev.weapon?.itemId);
      if (resolved) {
        const stat = getOrCreateWeaponStat(currentPhase, resolved.name, resolved.category);
        stat.throwablesUsed = (stat.throwablesUsed || 0) + 1;
      }
    }

    // 3. Theo dõi sát thương & số lần bắn trúng của từng vũ khí
    if (
      ev._T === 'LogPlayerTakeDamage' &&
      ev.attacker?.name === targetPlayerName &&
      ev.victim?.name !== targetPlayerName
    ) {
      const dmg = Number(ev.damage || 0);
      round.damageDealt += dmg;

      const resolved = resolvePubgWeapon(ev.damageCauserName);
      if (resolved && dmg > 0) {
        const stat = getOrCreateWeaponStat(currentPhase, resolved.name, resolved.category);
        stat.damageDealt = Math.round(stat.damageDealt + dmg);
        stat.hits += 1;
        if (ev.damageReason === 'HeadShot') {
          stat.headshots += 1;
        }
      }
    }

    // 4. Theo dõi hạ gục & bị hạ gục kèm tên vũ khí + cự ly (m)
    if (ev._T === 'LogPlayerKillV2') {
      if (ev.killer?.name === targetPlayerName) {
        round.kills += 1;
        const rawWeapon = ev.killerDamageInfo?.damageCauserName;
        const resolved = resolvePubgWeapon(rawWeapon);
        const distanceMeters = Math.round(Number(ev.killerDamageInfo?.distance || 0) / 100);
        const isHeadshot = ev.killerDamageInfo?.damageReason === 'HeadShot';

        if (resolved) {
          const stat = getOrCreateWeaponStat(currentPhase, resolved.name, resolved.category);
          stat.kills += 1;
          if (distanceMeters > (stat.maxKillDistanceMeters || 0)) {
            stat.maxKillDistanceMeters = distanceMeters;
          }
        }

        round.events.push({
          timestampMs: evTime,
          round: currentPhase,
          type: 'KILL',
          payload: {
            victim: ev.victim?.name,
            weapon: resolved ? resolved.name : rawWeapon,
            distanceMeters,
            isHeadshot,
          },
        });
      }

      if (ev.victim?.name === targetPlayerName) {
        round.deaths += 1;
        round.result = 'ELIMINATED';
        const rawKillerWeapon = ev.killerDamageInfo?.damageCauserName;
        const resolvedKillerWeapon = resolvePubgWeapon(rawKillerWeapon);
        const distanceMeters = Math.round(Number(ev.killerDamageInfo?.distance || 0) / 100);

        round.events.push({
          timestampMs: evTime,
          round: currentPhase,
          type: 'DEATH',
          payload: {
            killer: ev.killer?.name,
            weapon: resolvedKillerWeapon ? resolvedKillerWeapon.name : rawKillerWeapon,
            distanceMeters,
          },
        });
      }
    }
  }

  for (const localEv of localTimeline) {
    const targetRound = roundsMap.get(localEv.round) || ensurePhase(1, localEv.timestampMs);
    targetRound.events.push(localEv);
  }

  // Gắn danh sách vũ khí đã sắp xếp theo sát thương vào từng Phase
  for (const [phase, round] of roundsMap.entries()) {
    const wMap = phaseWeaponsMap.get(phase);
    if (wMap) {
      round.weaponStats = Array.from(wMap.values()).sort(
        (a, b) => b.damageDealt - a.damageDealt || b.kills - a.kills
      );
    }
  }

  return Array.from(roundsMap.values()).sort((a, b) => a.roundNumber - b.roundNumber);
}

export interface PubgMapPoint {
  x: number;
  y: number;
  tMs: number;
  phase?: number;
  label?: string;
}

export interface PubgSafeZoneCircle {
  phase: number;
  x: number;
  y: number;
  radius: number;
}

export interface PubgMapTelemetrySummary {
  mapRawName: string;
  mapSizeCm: number;
  path: PubgMapPoint[];
  kills: PubgMapPoint[];
  deaths: PubgMapPoint[];
  safeZones: PubgSafeZoneCircle[];
}

const PUBG_MAP_SIZE_CM: Record<string, number> = {
  Baltic_Main: 816000,
  Erangel_Main: 816000,
  Desert_Main: 816000,
  Tiger_Main: 816000,
  Kiki_Main: 816000,
  Neon_Main: 816000,
  Vikendi_Main: 816000,
  DihorOtok_Main: 612000,
  Savage_Main: 408000,
  Chimera_Main: 306000,
  Summerland_Main: 204000,
};

export function extractPubgMapTelemetry(
  telemetryEvents: any[],
  targetPlayerName: string
): PubgMapTelemetrySummary {
  const matchStartLog = telemetryEvents.find((e) => e._T === 'LogMatchStart');
  const matchStartEpoch = matchStartLog?._D ? new Date(matchStartLog._D).getTime() : 0;
  const mapRawName = String(matchStartLog?.mapName || 'Unknown');
  let mapSizeCm = PUBG_MAP_SIZE_CM[mapRawName] || 816000;

  const rawPath: PubgMapPoint[] = [];
  const kills: PubgMapPoint[] = [];
  const deaths: PubgMapPoint[] = [];
  const zonesByPhase = new Map<number, PubgSafeZoneCircle>();

  let currentPhase = 1;
  let lastSampleMs = -999999;

  for (const ev of telemetryEvents) {
    const evTime = ev._D ? Math.max(0, new Date(ev._D).getTime() - matchStartEpoch) : 0;

    if (ev._T === 'LogPhaseChange' && typeof ev.phase === 'number') {
      currentPhase = Math.max(1, ev.phase);
    }

    if (ev._T === 'LogGameStatePeriodic' && ev.gameState?.safetyZoneRadius > 0) {
      const gs = ev.gameState;
      const sx = Number(gs.safetyZonePosition?.x || 0);
      const sy = Number(gs.safetyZonePosition?.y || 0);
      const sr = Number(gs.safetyZoneRadius || 0);
      if (sx > 0 && sy > 0 && sr > 0 && !zonesByPhase.has(currentPhase)) {
        zonesByPhase.set(currentPhase, { phase: currentPhase, x: sx, y: sy, radius: sr });
      }
    }

    if (ev._T === 'LogPlayerPosition' && ev.character?.name === targetPlayerName) {
      const lx = Number(ev.character?.location?.x);
      const ly = Number(ev.character?.location?.y);
      if (Number.isFinite(lx) && Number.isFinite(ly) && (lx > 0 || ly > 0)) {
        if (lx > mapSizeCm || ly > mapSizeCm) {
          mapSizeCm = 816000;
        }
        if (evTime - lastSampleMs >= 15000 && rawPath.length < 160) {
          lastSampleMs = evTime;
          rawPath.push({
            x: Math.round(lx),
            y: Math.round(ly),
            tMs: evTime,
            phase: currentPhase,
          });
        }
      }
    }

    if (ev._T === 'LogPlayerKillV2') {
      if (ev.killer?.name === targetPlayerName) {
        const loc = ev.victim?.location || ev.killer?.location;
        const kx = Number(loc?.x);
        const ky = Number(loc?.y);
        if (Number.isFinite(kx) && Number.isFinite(ky) && (kx > 0 || ky > 0)) {
          const weaponInfo = resolvePubgWeapon(ev.killerDamageInfo?.damageCauserName);
          kills.push({
            x: Math.round(kx),
            y: Math.round(ky),
            tMs: evTime,
            phase: currentPhase,
            label: `${ev.victim?.name || 'Enemy'}${weaponInfo ? ` (${weaponInfo.name})` : ''}`,
          });
        }
      }

      if (ev.victim?.name === targetPlayerName) {
        const dx = Number(ev.victim?.location?.x);
        const dy = Number(ev.victim?.location?.y);
        if (Number.isFinite(dx) && Number.isFinite(dy) && (dx > 0 || dy > 0)) {
          deaths.push({
            x: Math.round(dx),
            y: Math.round(dy),
            tMs: evTime,
            phase: currentPhase,
            label: ev.killer?.name ? `Hạ bởi ${ev.killer.name}` : 'Bị hạ gục',
          });
        }
      }
    }
  }

  return {
    mapRawName,
    mapSizeCm,
    path: rawPath,
    kills,
    deaths,
    safeZones: Array.from(zonesByPhase.values()).sort((a, b) => a.phase - b.phase),
  };
}