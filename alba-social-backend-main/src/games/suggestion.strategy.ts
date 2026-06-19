import {
  Game,
  GameType,
  HandicapRange,
  PlayerType,
  DayType,
  User,
  Profile,
  UserOnboarding,
  UserLocation,
} from '@prisma/client';

export interface GameWithExtras extends Game {
  players: { user_id: string }[];
  course?: { lat: number | null; lng: number | null } | null;
  organiser_handicap: HandicapRange | null;
  creator_id: string;
}

export class SuggestionStrategy {
  private readonly baseWeights = {
    distance: 0.3,
    gameType: 0.38,
    handicap: 0.18,
    social: 0.1,
    urgency: 0.04,
  } as const;

  // How strict should handicap matching be for each game type
  private readonly hcpStrictness: Record<
    GameType,
    'STRICT' | 'MEDIUM' | 'LENIENT'
  > = {
    COMPETITIVE_MATCH: 'STRICT',
    RELAXED_ROUND: 'MEDIUM',
    PURELY_SOCIAL: 'LENIENT',
    BEGINNER_FRIENDLY: 'LENIENT',
  } as const;

  private readonly hcpScoreTable = {
    STRICT: [1, 0.3, 0],
    MEDIUM: [1, 0.6, 0.2],
    LENIENT: [1, 0.8, 0.5],
  } as const;

  private readonly gameSimilarity: Record<GameType, GameType[]> = {
    PURELY_SOCIAL: ['RELAXED_ROUND', 'BEGINNER_FRIENDLY'],
    RELAXED_ROUND: ['PURELY_SOCIAL', 'BEGINNER_FRIENDLY'],
    COMPETITIVE_MATCH: ['RELAXED_ROUND'],
    BEGINNER_FRIENDLY: ['PURELY_SOCIAL', 'RELAXED_ROUND'],
  } as const;

  private readonly playerTypeMap: Record<PlayerType, [GameType, number][]> = {
    CASUAL_PLAYER: [
      ['PURELY_SOCIAL', 1],
      ['RELAXED_ROUND', 0.8],
    ],
    DEDICATED_IMPROVER: [
      ['RELAXED_ROUND', 1],
      ['COMPETITIVE_MATCH', 0.8],
      ['BEGINNER_FRIENDLY', 0.6],
    ],
    SERIOUS_COMPETITOR: [
      ['COMPETITIVE_MATCH', 1],
      ['RELAXED_ROUND', 0.5],
    ],
    NEW_TO_GOLF: [
      ['BEGINNER_FRIENDLY', 1],
      ['PURELY_SOCIAL', 0.8],
    ],
  } as const;

  constructor(private readonly radiusKm = 30) {}

  computeScore(
    g: GameWithExtras,
    deps: {
      user: User;
      profile?: Profile | null;
      onboarding?: UserOnboarding | null;
      loc?: UserLocation | null;
      strongTies: Set<string>;
      mediumTies: Set<string>;
    },
  ): number {
    const w = this.baseWeights;

    /* ---------------- distance ---------------- */
    let distanceScore = 0.5; // neutral default if no location
    if (deps.loc && (g.lat !== null || g.course?.lat !== null)) {
      const dKm = this.distanceKm(
        deps.loc.lat,
        deps.loc.lng,
        g.course?.lat ?? g.lat!,
        g.course?.lng ?? g.lng!,
      );
      distanceScore = 1 - Math.min(dKm, this.radiusKm) / this.radiusKm;
    }

    /* ---------------- game type ---------------- */
    const gameTypeScore = this.computeGameTypeScore(
      g.game_type as GameType,
      deps.onboarding?.preferences ?? [],
      deps.onboarding?.player_type as PlayerType | undefined,
    );

    /* ---------------- handicap ---------------- */
    const handicapScore = this.handicapScore(
      deps.onboarding?.handicap_range as HandicapRange | undefined,
      g.organiser_handicap as HandicapRange | undefined,
      g.game_type as GameType,
    );

    /* ---------------- social ---------------- */
    const socialScore = this.socialScore(
      g.players,
      deps.strongTies,
      deps.mediumTies,
    );

    /* ---------------- urgency ---------------- */
    const urgencyData = this.urgencyScore(g);
    const urgencyScore = urgencyData.score;
    const dynamicWUrge = w.urgency + urgencyData.weightBoost; // up to +0.04 when close

    /* ---------------- weighted sum ---------------- */
    const total =
      w.distance * distanceScore +
      w.gameType * gameTypeScore +
      w.handicap * handicapScore +
      w.social * socialScore +
      dynamicWUrge * urgencyScore;

    return total;
  }

  /* ------------ Helpers ------------- */

  private computeGameTypeScore(
    gameType: GameType,
    prefs: GameType[],
    playerType?: PlayerType,
  ): number {
    if (prefs.includes(gameType)) return 1;
    if (prefs.some((p) => this.gameSimilarity[p]?.includes(gameType)))
      return 0.8;
    const ptScore = this.playerTypeMap[playerType as PlayerType]?.find(
      ([g]) => g === gameType,
    )?.[1];
    return ptScore ?? 0;
  }

  private handicapScore(
    userHcp: HandicapRange | undefined,
    orgHcp: HandicapRange | undefined,
    gameType: GameType,
  ): number {
    if (!userHcp || !orgHcp) return 0.5;
    const rank: Record<HandicapRange, number> = {
      LOW: 0,
      MID: 1,
      HIGH: 2,
      DONT_KNOW: 3,
    } as const;
    const diff = Math.min(2, Math.abs(rank[userHcp] - rank[orgHcp]));
    const strictness = this.hcpStrictness[gameType];
    return this.hcpScoreTable[strictness][diff];
  }

  private socialScore(
    players: { user_id: string }[],
    strongSet: Set<string>,
    mediumSet: Set<string>,
  ): number {
    let strong = 0;
    let medium = 0;
    players.forEach((p) => {
      if (strongSet.has(p.user_id)) strong += 1;
      else if (mediumSet.has(p.user_id)) medium += 1;
    });
    const points = strong + 0.5 * medium;
    return Math.min(points / 3, 1);
  }

  private urgencyScore(g: Game): { score: number; weightBoost: number } {
    const needRatio = (g.players_needed - g.players_current) / g.players_needed;
    const daysUntil = Math.max(0, (g.date.getTime() - Date.now()) / 86_400_000);
    const timePressure = Math.max(0, Math.min(1, (14 - daysUntil) / 14));
    const blended = 0.7 * needRatio + 0.3 * timePressure;
    const score = Math.sqrt(blended);
    const weightBoost = 0.04 * timePressure; // double urgency weight when <14 days
    return { score, weightBoost };
  }

  private distanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRad(deg: number) {
    return (deg * Math.PI) / 180;
  }
}
