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
  const isRotate = phase === "rotate";

  // ===== 見た目（深紅） =====
  const BOARD_COLOR_TOP = "#8B0000"; // 深紅
  const BOARD_COLOR_BOTTOM = "#5c0011";
  const LINE_COLOR = "rgba(255,255,255,0.40)";
  const HOLE_BG = "rgba(0,0,0,0.18)";
  const HOLE_BORDER = "rgba(255,255,255,0.18)";

  // ===== レスポンシブ寸法（iPad最適化の核）=====
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [wrapW, setWrapW] = useState<number>(0);

  useEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? 0;
      setWrapW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ボードの描画幅（iPadでは自然に大きく）
  const boardSize = useMemo(() => {
    // 画面に対してできるだけ大きく。ただしデカすぎ防止
    // iPad横でも気持ちよく：最大 720px くらいまで許可
    return clamp(wrapW, 280, 820);
  }, [wrapW]);

  // ギャップは少しだけスケール（iPadで気持ちよい）
  const GAP = useMemo(() => {
    // 560px以上なら少し広く
    return boardSize >= 560 ? 12 : 10;
  }, [boardSize]);

  // CELLは “boardSize から逆算”
  const CELL = useMemo(() => {
    const raw = (boardSize - GAP * 5) / 6;
    // 小さすぎ/大きすぎ防止
    return Math.round(clamp(raw, 38, 72));
  }, [boardSize, GAP]);

  // 実際のグリッド実寸（ピクセル誤差を消すため、CELLで再構成）
  const GRID_W = CELL * 6 + GAP * 5;
  const GRID_H = GRID_W;

  // 4分割線の位置（“真ん中のギャップの中心”）
  const MID_X = CELL * 3 + GAP * 2 + GAP / 2;
  const MID_Y = MID_X;

  return (
  // ★外側は“中央寄せ専用”。背景は持たない
  <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
    {/* ★この内側だけがボード本体（幅はGRIDにフィット） */}
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
      {/* ラッパー：幅計測したいので ref はここに付ける */}
      <div
        ref={wrapRef}
        style={{
          width: GRID_W,          // ★ボードの中身幅＝穴の幅
          height: GRID_H,
          position: "relative",
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
            touchAction: "manipulation",
          }}
        >
          {board.map((row, y) =>
            row.map((v, x) => {
              const q = quadrantFromCell(x, y);
              const isSelectedQ = isRotate && q === selectedQuadrant;

              const isPending = pendingMove && pendingMove.x === x && pendingMove.y === y;
              const renderVal: CellValue = isPending ? turn : v;

              const inset = Math.round(CELL * 0.15);

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
                  {renderVal && (
                    <div
                      aria-hidden
                      style={{
                        position: "absolute",
                        inset,
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
                        inset: Math.max(2, Math.round(CELL * 0.06)),
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

      {phase === "rotate" && (
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.92, color: "rgba(255,255,255,0.88)" }}>
          象限：{["左上", "右上", "左下", "右下"][selectedQuadrant]}（盤面タップで切替）
        </div>
      )}
    </div>
  </div>
);

}

