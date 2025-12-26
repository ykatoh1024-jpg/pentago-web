import { useEffect, useMemo, useRef, useState } from "react";
import type { CellValue, Phase, Player, Pos } from "./types";

type Props = {
  board: CellValue[][];
  turn: Player;
  phase: Phase;
  pendingMove: Pos | null;
  onTapCell: (pos: Pos) => void;

  selectedQuadrant: number;
  onSelectQuadrant?: (q: number) => void;

  onSwipeRotate?: (dir: "cw" | "ccw") => void;
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
  onSwipeRotate,
}: Props) {
  const isRotate = phase === "rotate";

  // ===== 見た目（深紅） =====
  const BOARD_COLOR_TOP = "#8B0000";
  const BOARD_COLOR_BOTTOM = "#5c0011";
  const LINE_COLOR = "rgba(255,255,255,0.40)";
  const HOLE_BG = "rgba(0,0,0,0.18)";
  const HOLE_BORDER = "rgba(255,255,255,0.18)";

  // ===== 画面幅基準で盤面を決める（iPadで大きく）=====
  const [vw, setVw] = useState<number>(() =>
    typeof window !== "undefined" ? window.innerWidth : 1024
  );

  useEffect(() => {
    const update = () => setVw(window.innerWidth);
    update();
    window.addEventListener("resize", update, { passive: true });
    window.addEventListener("orientationchange", update, { passive: true });
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  const boardSize = useMemo(() => {
    const isTablet = vw >= 768;
    const sideMargin = isTablet ? 32 : 24;
    const usable = vw - sideMargin * 2;
    const cap = isTablet ? 980 : 720;
    return clamp(usable, 280, cap);
  }, [vw]);

  const GAP = useMemo(() => (boardSize >= 560 ? 12 : 10), [boardSize]);

  const CELL = useMemo(() => {
    const raw = (boardSize - GAP * 5) / 6;
    return Math.round(clamp(raw, 38, 86));
  }, [boardSize, GAP]);

  const GRID_W = CELL * 6 + GAP * 5;
  const GRID_H = GRID_W;

  const MID_X = CELL * 3 + GAP * 2 + GAP / 2;
  const MID_Y = MID_X;

  // ===== Pointerでスワイプ検出（iPadで安定）=====
  const swipeRef = useRef<{ x: number; y: number; active: boolean } | null>(null);
  const SWIPE_MIN_PX = 28;
  const SWIPE_MAX_ANGLE = 0.6; // dyが大きい(縦スクロール系)は無視

  return (
    <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <div
        style={{
          display: "inline-block",
          borderRadius: 22,
          padding: 12,
          boxSizing: "border-box",
          background: `linear-gradient(180deg, ${BOARD_COLOR_TOP}, ${BOARD_COLOR_BOTTOM})`,
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 18px 44px rgba(0,0,0,0.22)",
        }}
      >
        <div
          style={{
            width: GRID_W,
            height: GRID_H,
            position: "relative",

            // ★ここが重要：rotate中はスクロールに奪われないようにする
            touchAction: isRotate ? "none" : "manipulation",
          }}
          onPointerDown={(e) => {
            if (!isRotate) return;
            // 盤面内でのスワイプだけ取る
            swipeRef.current = { x: e.clientX, y: e.clientY, active: true };
            // ポインタを捕まえる（外に出てもUP拾える）
            (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId);
          }}
          onPointerUp={(e) => {
            if (!isRotate) return;
            const s = swipeRef.current;
            swipeRef.current = null;
            if (!s || !s.active) return;

            const dx = e.clientX - s.x;
            const dy = e.clientY - s.y;

            if (Math.abs(dx) < SWIPE_MIN_PX) return;
            if (Math.abs(dy) > Math.abs(dx) * SWIPE_MAX_ANGLE) return;

            const dir: "cw" | "ccw" = dx > 0 ? "cw" : "ccw";
            onSwipeRotate?.(dir);
          }}
          onPointerCancel={() => {
            swipeRef.current = null;
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

          {/* セル */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              gridTemplateColumns: `repeat(6, ${CELL}px)`,
              gridTemplateRows: `repeat(6, ${CELL}px)`,
              gap: GAP,
              userSelect: "none",
            }}
          >
            {board.map((row, y) =>
              row.map((v, x) => {
                const q = quadrantFromCell(x, y);
                const isSelectedQ = isRotate && q === selectedQuadrant;

                const isPending = pendingMove && pendingMove.x === x && pendingMove.y === y;
                const renderVal: CellValue = isPending ? turn : v;

                const insetStone = Math.round(CELL * 0.15);
                const insetRing = Math.max(2, Math.round(CELL * 0.06));

                return (
                  <div
                    key={`${x}-${y}`}
                    // clickは維持（象限タップ/仮置き）
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
                      border: isSelectedQ
                        ? "2px solid rgba(255,255,255,0.42)"
                        : `1px solid ${HOLE_BORDER}`,
                      boxSizing: "border-box",
                      position: "relative",
                      cursor: "pointer",
                      outline: isSelectedQ ? "2px solid rgba(0,0,0,0.25)" : "none",
                      outlineOffset: 2,
                      transition: "background 0.12s ease, border 0.12s ease",
                    }}
                  >
                    {renderVal && (
                      <div
                        aria-hidden
                        style={{
                          position: "absolute",
                          inset: insetStone,
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

                    {isPending && (
                      <div
                        aria-hidden
                        style={{
                          position: "absolute",
                          inset: insetRing,
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

        {isRotate && (
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.92, color: "rgba(255,255,255,0.88)" }}>
            象限：{["左上", "右上", "左下", "右下"][selectedQuadrant]}（盤面タップで選択）／
            左右スワイプで回転（左↺・右↻）
          </div>
        )}
      </div>
    </div>
  );
}
