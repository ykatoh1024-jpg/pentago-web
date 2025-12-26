import type { CellValue, Phase, Player, Pos } from "./types";

type Props = {
  board: CellValue[][];
  turn: Player;
  phase: Phase;
  pendingMove: Pos | null;
  onTapCell: (pos: Pos) => void;

  selectedQuadrant: number;
  onSelectQuadrant?: (q: number) => void;
};

function quadrantFromCell(x: number, y: number): number {
  const ox = x < 3 ? 0 : 1;
  const oy = y < 3 ? 0 : 2;
  return ox + oy; // 0:左上, 1:右上, 2:左下, 3:右下
}

export default function Board({
  board,
  turn,
  phase,
  pendingMove,
  onTapCell,
  selectedQuadrant,
  onSelectQuadrant,
}: Props) {
  const GAP = 10;
  const CELL = 46;

  const isRotate = phase === "rotate";

  return (
    <div
      style={{
        width: "100%",
        background: "rgba(255,255,255,0.9)",
        border: "1px solid rgba(17,24,39,0.12)",
        borderRadius: 22,
        padding: 14,
        boxShadow: "0 14px 40px rgba(0,0,0,0.08)",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: `repeat(6, ${CELL}px)`,
          gridTemplateRows: `repeat(6, ${CELL}px)`,
          gap: GAP,
          justifyContent: "center",
          padding: 6,
          userSelect: "none",
          touchAction: "manipulation",
        }}
      >
        {/* 象限境界線（縦） */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 6,
            bottom: 6,
            left: "50%",
            width: 2,
            background: "rgba(17,24,39,0.18)",
            transform: `translateX(${GAP / 2}px)`,
            borderRadius: 999,
            pointerEvents: "none",
          }}
        />
        {/* 象限境界線（横） */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 6,
            right: 6,
            top: "50%",
            height: 2,
            background: "rgba(17,24,39,0.18)",
            transform: `translateY(${GAP / 2}px)`,
            borderRadius: 999,
            pointerEvents: "none",
          }}
        />

        {board.map((row, y) =>
          row.map((v, x) => {
            const q = quadrantFromCell(x, y);
            const isSelectedQ = isRotate && q === selectedQuadrant;

            const isPending = pendingMove && pendingMove.x === x && pendingMove.y === y;
            const renderVal: CellValue = isPending ? turn : v;

            const outline = isSelectedQ ? "2px solid rgba(99,102,241,0.55)" : "none";

            const canInteract =
              !renderVal && (!isRotate || !!onSelectQuadrant); // rotateなら象限選択、placeなら置く

            return (
              <div
                key={`${x}-${y}`}
                onClick={() => {
                  if (isRotate) {
                    onSelectQuadrant?.(q);
                    return;
                  }
                  onTapCell({ x, y });
                }}
                role="button"
                aria-label={`cell-${x}-${y}`}
                style={{
                  width: CELL,
                  height: CELL,
                  borderRadius: 999,
                  background: isSelectedQ ? "rgba(99,102,241,0.12)" : "rgba(17,24,39,0.06)",
                  border: isSelectedQ ? "2px solid rgba(99,102,241,0.35)" : "1px solid rgba(17,24,39,0.10)",
                  boxSizing: "border-box",
                  position: "relative",
                  cursor: "pointer",
                  outline,
                  outlineOffset: 2,
                  transition: "transform 0.06s ease, background 0.12s ease, border 0.12s ease",
                  transform: canInteract ? "scale(1)" : "scale(1)",
                }}
              >
                {/* 石（または仮置き） */}
                {renderVal && (
                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      inset: 7,
                      borderRadius: 999,
                      background: renderVal === "white" ? "white" : "#111827",
                      boxShadow:
                        renderVal === "white"
                          ? "0 10px 18px rgba(0,0,0,0.14), inset 0 0 0 1px rgba(17,24,39,0.18)"
                          : "0 10px 18px rgba(0,0,0,0.22), inset 0 0 0 1px rgba(255,255,255,0.10)",
                      opacity: isPending ? 0.75 : 1,
                    }}
                  />
                )}

                {/* 仮置きのリング（place中の pendingMove を分かりやすく） */}
                {isPending && (
                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      inset: 3,
                      borderRadius: 999,
                      border: "2px dashed rgba(99,102,241,0.75)",
                      boxShadow: "0 0 0 3px rgba(99,102,241,0.10)",
                      pointerEvents: "none",
                    }}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 小さな補助表示（身内ならこの程度でOK） */}
      {phase === "rotate" && (
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.72 }}>
          象限：{["左上", "右上", "左下", "右下"][selectedQuadrant]}（盤面タップで切替）
        </div>
      )}
    </div>
  );
}
