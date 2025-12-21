import type { CellValue, Player, Pos, Phase } from "./types";

type Props = {
  board: CellValue[][];
  turn: Player;
  phase: Phase;
  pendingMove: Pos | null;
  onTapCell: (pos: Pos) => void;
};

function cellLabel(v: CellValue): string {
  if (v === "white") return "⚪";
  if (v === "black") return "⚫";
  return "";
}

export default function Board({ board, turn, phase, pendingMove, onTapCell }: Props) {
  return (
    <div style={{ width: "100%", maxWidth: 520, margin: "0 auto" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: 6,
          padding: 10,
          borderRadius: 16,
          border: "2px solid rgba(17,24,39,0.15)",
          background: "white",
          touchAction: "manipulation",
        }}
      >
        {board.map((row, y) =>
          row.map((cell, x) => {
            const isPending = pendingMove?.x === x && pendingMove?.y === y;
            const showValue: CellValue = isPending ? turn : cell;

            const disabled =
              phase !== "place" || cell !== null || (pendingMove !== null && !isPending);

            const thickRight = x === 2;
            const thickBottom = y === 2;

            return (
              <button
                key={`${x}-${y}`}
                onClick={() => onTapCell({ x, y })}
                disabled={disabled}
                style={{
                  height: 54,
                  borderRadius: 12,
                  border: "2px solid rgba(17,24,39,0.18)",
                  background: disabled ? "rgba(17,24,39,0.04)" : "white",
                  fontSize: 22,
                  fontWeight: 900,
                  cursor: disabled ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  userSelect: "none",
                  WebkitTapHighlightColor: "transparent",
                  outline: "none",
                  boxShadow: isPending ? "0 0 0 3px rgba(59,130,246,0.25)" : "none",
                  borderRightWidth: thickRight ? 4 : 2,
                  borderBottomWidth: thickBottom ? 4 : 2,
                }}
                aria-label={`cell-${x}-${y}`}
              >
                {cellLabel(showValue)}
              </button>
            );
          })
        )}
      </div>
      <div style={{ textAlign: "center", fontSize: 12, opacity: 0.7 }}>
        {phase === "place" ? "空マスをタップして仮置き" : "次は回転（次のステップで実装）"}
      </div>
    </div>
  );
}