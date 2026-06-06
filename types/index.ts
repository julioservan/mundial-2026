export type Confederation =
  | "UEFA"
  | "CONMEBOL"
  | "CONCACAF"
  | "CAF"
  | "AFC"
  | "OFC";

export type GroupId =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L";

export interface Team {
  id: string;
  name: string;
  code: string;
  flag: string;
  confederation: Confederation;
  group: GroupId;
  qualified: boolean;
}

export interface Venue {
  city: string;
  country: "USA" | "CAN" | "MEX";
  stadium: string;
}

export type MatchStage =
  | "group"
  | "round32"
  | "round16"
  | "quarterfinal"
  | "semifinal"
  | "third_place"
  | "final";

export type MatchStatus = "scheduled" | "live" | "finished";

export interface Match {
  id: string;
  stage: MatchStage;
  group?: GroupId;
  matchday?: number;
  kickoff: string;
  venue: Venue;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
}

export interface Prediction {
  matchId: string;
  homeScore: number;
  awayScore: number;
  submittedAt: string;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  points: number;
  exactScores: number;
  correctOutcomes: number;
  predictionsMade: number;
}
