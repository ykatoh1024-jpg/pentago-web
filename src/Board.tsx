import type { CellValue, Phase, Player, Pos } from "./types";

type Props = {
  board: CellValue[][];
  turn: Player;
  phase: Phase;
  pendingMove: Pos | null;
  onTapCell: (pos: Pos) => void;
};

export default function Board({ board, turn, phase, pendingMove, onTapCell }: Props) {
  // 盤面サイズを固定（ここが「置くとサイズが変わる」問題の根治）
  const CELL = 48; // 好みで 44〜52
  const GAP = 6;
  const PAD = 10;
  const BOARD_W = CELL * 6 + GAP * 5 + PAD * 2;

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div
        style={{
          width: BOARD_W,
          height: BOARD_W,
          padding: PAD,
          boxSizing: "border-box",
          borderRadius: 18,
          background: "rgba(255,255,255,0.9)",
          border: "1px solid rgba(17,24,39,0.12)",
          boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: GAP,
          }}
        >
          {board.map((row, y) =>
            row.map((v, x) => {
              const isPending = pendingMove?.x === x && pendingMove?.y === y;
              const showStone = v !== null || isPending;

              const stoneColor: CellValue = v ?? (isPending ? turn : null);

              // 「太いborder」で状態表現するとサイズが変わるので、outlineで表現する（サイズに影響しない）
              const outline =
                isPending && phase === "rotate"
                  ? "3px solid rgba(99,102,241,0.9)"
                  : isPending
                  ? "3px solid rgba(16,185,129,0.85)"
                  : "none";

              return (
                <div
                  key={`${x}-${y}`}
                  onClick={() => onTapCell({ x, y })}
                  role="button"
                  aria-label={`cell-${x}-${y}`}
                  style={{
                    width: CELL,
                    height: CELL,
                    borderRadius: 999,
                    background: "rgba(17,24,39,0.06)",
                    border: "1px solid rgba(17,24,39,0.10)",
                    boxSizing: "border-box",
                    position: "relative",
                    cursor: "pointer",
                    outline,
                    outlineOffset: 2,
                  }}
                >
                  {showStone && stoneColor && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 6,
                        borderRadius: 999,
                        background: stoneColor === "white" ? "#ffffff" : "#111827",
                        border:
                          stoneColor === "white"
                            ? "1px solid rgba(17,24,39,0.18)"
                            : "1px solid rgba(255,255,255,0.08)",
                        boxSizing: "border-box",
                        boxShadow: "0 6px 14px rgba(0,0,0,0.12)",
                        opacity: isPending && v === null ? 0.65 : 1,
                      }}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* 象限のガイド（薄い十字） */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}
