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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function getQuadrantCenter(
  rect: DOMRect,
  quadrant: number
): { cx: number; cy: number } {
  const halfW = rect.width / 2;
  const halfH = rect.height / 2;

  const qx = quadrant % 2;      // 0 or 1
  const qy = quadrant < 2 ? 0 : 1;

  return {
    cx: rect.left + halfW * (qx + 0.5),
    cy: rect.top + halfH * (qy + 0.5),
  };
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

  // ===== iPad最適化：画面幅(vw)基準で盤面サイズ決定 =====
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

  // 実寸固定でズレ防止
  const GRID_W = CELL * 6 + GAP * 5;
  const GRID_H = GRID_W;

  // 4分割線：中央ギャップの中心
  const MID = CELL * 3 + GAP * 2 + GAP / 2;

  // ===== 見た目（深紅） =====
  const BOARD_TOP = "#8B0000";
  const BOARD_BTM = "#5c0011";
  const LINE_COLOR = "rgba(255,255,255,0.40)";
  const HOLE_BG = "rgba(0,0,0,0.18)";
  const HOLE_BORDER = "rgba(255,255,255,0.18)";

  // ===== 透明スワイプレイヤー（iPad Safari安定：native touch）=====
  const swipeLayerRef = useRef<HTMLDivElement | null>(null);
  const [debugSwipe, setDebugSwipe] = useState<string>("");

  useEffect(() => {
    const el = swipeLayerRef.current;
    if (!el) return;
    if (!isRotate) return;

    let sx = 0;
    let sy = 0;
    let tracking = false;

    let startRX = 0; // centerから見た開始点ベクトル
    let startRY = 0;

    const SWIPE_MIN_PX = 26;
    const TAP_MAX_PX = 10;
    const SWIPE_MAX_ANGLE = 0.65;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      tracking = true;

      const t = e.touches[0];
      sx = t.clientX;
      sy = t.clientY;

      const rect = el.getBoundingClientRect();
      const { cx, cy } = getQuadrantCenter(rect, selectedQuadrant);

      startRX = sx - cx;
      startRY = sy - cy;

      e.preventDefault();
    };


    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const dx = e.touches[0].clientX - sx;
      const dy = e.touches[0].clientY - sy;
      if (Math.abs(dx) > 10 && Math.abs(dy) <= Math.abs(dx) * SWIPE_MAX_ANGLE) {
        e.preventDefault();
      }
    };

    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;

      const t = e.changedTouches[0];
      const ex = t.clientX;
      const ey = t.clientY;

      const dx = ex - sx;
      const dy = ey - sy;

      // タップ＝象限選択
      if (Math.abs(dx) <= TAP_MAX_PX && Math.abs(dy) <= TAP_MAX_PX) {
        const rect = el.getBoundingClientRect();
        const rx = ex - rect.left;
        const ry = ey - rect.top;

        const qx = rx < rect.width / 2 ? 0 : 1;
        const qy = ry < rect.height / 2 ? 0 : 2;
        const q = qx + qy;

        onSelectQuadrant?.(q);
        setDebugSwipe(`tap q=${q}`);
        return;
      }

      // スワイプ小さすぎは無視
      if (Math.hypot(dx, dy) < SWIPE_MIN_PX) {
        setDebugSwipe(`move small dx=${Math.round(dx)} dy=${Math.round(dy)}`);
        return;
      }

      // ==== 本物のダイヤル式 ====
      // 外積 z = r x d = rx*dy - ry*dx
      const cross = startRX * dy - startRY * dx;

      // crossの絶対値が小さい＝中心方向に擦ってる（回転感が弱い）ので無視
      if (Math.abs(cross) < 60) {
        setDebugSwipe(`weak spin cross=${Math.round(cross)} (ignored)`);
        return;
      }

      // ここは画面座標（y下向き）なので符号が直感と逆になることがある。
      // まずはこれで “指の回し方向” が一致する方を採用：
      const dir: "cw" | "ccw" = cross < 0 ? "cw" : "ccw";

      setDebugSwipe(
        `dial dx=${Math.round(dx)} dy=${Math.round(dy)} cross=${Math.round(cross)} dir=${dir} ✅`
      );
      onSwipeRotate?.(dir);
    };


    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: false });
    el.addEventListener("touchcancel", onEnd, { passive: false });

    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [isRotate, onSelectQuadrant, onSwipeRotate]);

  // ===== セルクリック（placeのみ）=====
  function onCellClick(x: number, y: number) {
    if (isRotate) return;
    onTapCell({ x, y });
  }

  return (
    <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <div
        style={{
          display: "inline-block",
          borderRadius: 22,
          padding: 12,
          boxSizing: "border-box",
          background: `linear-gradient(180deg, ${BOARD_TOP}, ${BOARD_BTM})`,
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 18px 44px rgba(0,0,0,0.22)",
        }}
      >
        <div
          style={{
            width: GRID_W,
            height: GRID_H,
            position: "relative",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
        >
          {/* 4分割線 */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: -2,
              bottom: -2,
              left: MID,
              width: 3,
              transform: "translateX(-1.5px)",
              background: LINE_COLOR,
              borderRadius: 999,
              pointerEvents: "none",
              boxShadow: "0 0 0 1px rgba(0,0,0,0.18)",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: -2,
              right: -2,
              top: MID,
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
            }}
          >
            {board.map((row, y) =>
              row.map((v, x) => {
                const isPending = pendingMove && pendingMove.x === x && pendingMove.y === y;
                const renderVal: CellValue = isPending ? turn : v;

                const insetStone = Math.round(CELL * 0.15);
                const insetRing = Math.max(2, Math.round(CELL * 0.06));

                return (
                  <div
                    key={`${x}-${y}`}
                    role="button"
                    aria-label={`cell-${x}-${y}`}
                    onClick={() => onCellClick(x, y)}
                    style={{
                      width: CELL,
                      height: CELL,
                      borderRadius: 999,
                      background: HOLE_BG,
                      border: `1px solid ${HOLE_BORDER}`,
                      boxSizing: "border-box",
                      position: "relative",
                      cursor: isRotate ? "default" : "pointer",
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

          {/* rotate中の透明スワイプレイヤー */}
          {isRotate && (
            <div
              ref={swipeLayerRef}
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 50,
                background: "transparent",
                touchAction: "none",
                userSelect: "none",
                WebkitUserSelect: "none",
              }}
            />
          )}
        </div>

        {isRotate && (
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.92, color: "rgba(255,255,255,0.88)" }}>
            象限：{["左上", "右上", "左下", "右下"][selectedQuadrant]}（タップで選択）／ 左右スワイプで回転（左↺・右↻）
          </div>
        )}
        {isRotate && (
          <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.9)" }}>
            {debugSwipe || "swipe: (no data yet)"}
          </div>
        )}
      </div>
    </div>
  );
}
