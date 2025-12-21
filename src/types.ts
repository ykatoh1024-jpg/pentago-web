export type Player = "white" | "black";
export type Phase = "place" | "rotate";
export type CellValue = Player | null;

export type Pos = { x: number; y: number };

export type GameMode = "local" | "ai";
