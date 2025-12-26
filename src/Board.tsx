import { useEffect, useMemo, useState } from "react";
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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
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
  const PAD = 10;

  // 盤面の“実寸”（グリッド部分）
  const GRID_W = CELL * 6 + GAP * 5;
  const GRID_H = CELL * 6 + GAP * 5;

  // 3×3と3×3の境界（真ん中の“ギャップ”の中央）
  const MID_X = CELL * 3 + GAP * 2 + GAP / 2;
  const MID_Y = CELL * 3 + GAP * 2 + GAP / 2;

  const isRotate = phase === "rotate";

  // 深紅（ボード色）
  const BOARD_COLOR = "#8B0000";
  const LINE_COLOR = "rgba(255,255,255,0.35)";
  const HOLE_BG = "rgba(0,0,0,0.18)";
  const HOLE_BORDER = "rgba(255,255,255,0.18)";

  // ===== iPad最適化：盤面を中央寄せ & 自動スケール =====
  const [vw, setVw] = useState<number>(() => (typeof window !== "undefined" ? window.innerWidth : 390));
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const scale = useMemo(() => {
    // 盤面コンテナに左右 padding を少し残して収める
    const safePadding = 24; // iPadで余白を残しつつ最大化
    const available = vw - safePadding * 2;

    // iPad帯は大きくしてOK。スマホは等倍〜少しだけ。
    const isIPadLike = vw >= 768 && vw <= 1024;

    // ここで “盤面（GRID_W）” を画面幅にフィットするようにスケール
    const raw = available / GRID_W;

    if (isIPadLike) return clamp(raw, 1.15, 1.75); // iPadは大きく見せたい
    return clamp(raw, 0.92, 1.12); // スマホは崩さない範囲
  }, [vw, GRID_W]);

  return (
    <div
      style={{
        width: "100%",
        borderRadius: 22,
        padding: PAD,
        boxSizing: "border-box",
        background: `linear-gradient(180deg, ${BOARD_COLOR}, #6e0014)`,
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 18px 44px rgba(0,0,0,0.22)",
        // sticky操作に隠れず、iPadでも詰まらない
        marginBottom: 10,
      }}
    >
      {/* 中央寄せを確実にするためのラッパー */}
      <div
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "center",
        }}
      >
        {/* scaleの基準点を中央に固定（左寄りを防止） */}
        <div
          style={{
            width: GRID_W,
            height: GRID_H,
            position: "relative",
            transform: `scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          {/* 4分割線（縦） */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: -2,
              bottom: -2,
              left: MID_X,
              width: 3,
              transform: "translateX(-1.5px)",
              background: LINE_COLOR,
              borderRadius: 999,
              pointerEvents: "none",
              boxShadow: "0 0 0 1px rgba(0,0,0,0.18)",
            }}
          />
          {/* 4分割線（横） */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: -2,
              right: -2,
              top: MID_Y,
              height: 3,
              transform: "translateY(-1.5px)",
              background: LINE_COLOR,
              borderRadius: 999,
              pointerEvents: "none",
              boxShadow: "0 0 0 1px rgba(0,0,0,0.18)",
            }}
          />

          {/* 盤面セル */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              gridTemplateColumns: `repeat(6, ${CELL}px)`,
              gridTemplateRows: `repeat(6, ${CELL}px)`,
              gap: GAP,
              userSelect: "none",
              touchAction: "manipulation",
            }}
          >
            {board.map((row, y) =>
              row.map((v, x) => {
                const q = quadrantFromCell(x, y);
                const isSelectedQ = isRotate && q === selectedQuadrant;

                const isPending = pendingMove && pendingMove.x === x && pendingMove.y === y;
                const renderVal: CellValue = isPending ? turn : v;

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
                      background: isSelectedQ ? "rgba(255,255,255,0.12)" : HOLE_BG,
                      border: isSelectedQ ? "2px solid rgba(255,255,255,0.42)" : `1px solid ${HOLE_BORDER}`,
                      boxSizing: "border-box",
                      position: "relative",
                      cursor: "pointer",
                      outline: isSelectedQ ? "2px solid rgba(0,0,0,0.25)" : "none",
                      outlineOffset: 2,
                      transition: "background 0.12s ease, border 0.12s ease",
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
                              ? "0 10px 18px rgba(0,0,0,0.22), inset 0 0 0 1px rgba(17,24,39,0.22)"
                              : "0 10px 18px rgba(0,0,0,0.30), inset 0 0 0 1px rgba(255,255,255,0.12)",
                          opacity: isPending ? 0.78 : 1,
                        }}
                      />
                    )}

                    {/* 仮置きリング */}
                    {isPending && (
                      <div
                        aria-hidden
                        style={{
                          position: "absolute",
                          inset: 3,
                          borderRadius: 999,
                          border: "2px dashed rgba(255,255,255,0.70)",
                          boxShadow: "0 0 0 3px rgba(255,255,255,0.12)",
                          pointerEvents: "none",
                        }}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {phase === "rotate" && (
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9, color: "rgba(255,255,255,0.88)" }}>
          象限：{["左上", "右上", "左下", "右下"][selectedQuadrant]}（盤面タップで切替）
        </div>
      )}
    </div>
  );
}
