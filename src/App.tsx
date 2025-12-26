import { useEffect, useMemo, useState } from "react";
import Board from "./Board";
import type { CellValue, GameMode, Phase, Player, Pos, Screen } from "./types";

/* =========================
   Utility / Game Logic
========================= */

function createEmptyBoard(): CellValue[][] {
  return Array.from({ length: 6 }, () => Array<CellValue>(6).fill(null));
}

function cloneBoard(b: CellValue[][]): CellValue[][] {
  return b.map((row) => row.slice());
}

// quadrant: 0=左上,1=右上,2=左下,3=右下
function rotateQuadrant(board: CellValue[][], quadrant: number, dir: "cw" | "ccw"): CellValue[][] {
  const b = cloneBoard(board);
  const ox = quadrant % 2 === 0 ? 0 : 3;
  const oy = quadrant < 2 ? 0 : 3;

  const m: CellValue[][] = Array.from({ length: 3 }, (_, y) =>
    Array.from({ length: 3 }, (_, x) => b[oy + y][ox + x])
  );

  const r: CellValue[][] = Array.from({ length: 3 }, () => Array<CellValue>(3).fill(null));

  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      if (dir === "cw") r[x][2 - y] = m[y][x];
      else r[2 - x][y] = m[y][x];
    }
  }

  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      b[oy + y][ox + x] = r[y][x];
    }
  }
  return b;
}

function inBounds(x: number, y: number) {
  return x >= 0 && x < 6 && y >= 0 && y < 6;
}

function hasFive(board: CellValue[][], p: Player): boolean {
  const dirs = [
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 1, dy: 1 },
    { dx: 1, dy: -1 },
  ];

  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 6; x++) {
      if (board[y][x] !== p) continue;
      for (const { dx, dy } of dirs) {
        let ok = true;
        for (let k = 1; k < 5; k++) {
          const nx = x + dx * k;
          const ny = y + dy * k;
          if (!inBounds(nx, ny) || board[ny][nx] !== p) {
            ok = false;
            break;
          }
        }
        if (ok) return true;
      }
    }
  }
  return false;
}

function isFull(board: CellValue[][]): boolean {
  for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) if (board[y][x] === null) return false;
  return true;
}

function checkWinner(board: CellValue[][]): Player | "draw" | null {
  const w = hasFive(board, "white");
  const b = hasFive(board, "black");
  if (w && b) return "draw";
  if (w) return "white";
  if (b) return "black";
  if (isFull(board)) return "draw";
  return null;
}

/* ======= AI ======= */

type Move = { pos: Pos; quadrant: number; dir: "cw" | "ccw" };

function applyMove(
  board: CellValue[][],
  player: Player,
  pos: Pos,
  quadrant: number,
  dir: "cw" | "ccw"
): { board: CellValue[][]; winner: Player | "draw" | null } {
  const placed = cloneBoard(board);
  placed[pos.y][pos.x] = player;
  const rotated = rotateQuadrant(placed, quadrant, dir);
  const w = checkWinner(rotated);
  return { board: rotated, winner: w };
}

function generateMoves(board: CellValue[][]): Move[] {
  const moves: Move[] = [];
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 6; x++) {
      if (board[y][x] !== null) continue;
      for (let q = 0; q < 4; q++) {
        moves.push({ pos: { x, y }, quadrant: q, dir: "cw" });
        moves.push({ pos: { x, y }, quadrant: q, dir: "ccw" });
      }
    }
  }
  return moves;
}

function chooseAiMove(board: CellValue[][], ai: Player): Move {
  const opp: Player = ai === "white" ? "black" : "white";
  const candidates = generateMoves(board);

  // 1) 即勝ちがあればそれ
  for (const m of candidates) {
    const r = applyMove(board, ai, m.pos, m.quadrant, m.dir);
    if (r.winner === ai) return m;
  }

  // 2) 相手の即勝ちを減らす（簡易）
  let best = candidates[Math.floor(Math.random() * candidates.length)];
  let bestScore = -Infinity;

  for (const m of candidates) {
    const afterAi = applyMove(board, ai, m.pos, m.quadrant, m.dir);
    if (afterAi.winner === ai) return m;

    const oppMoves = generateMoves(afterAi.board);
    let oppWinCount = 0;
    for (const om of oppMoves) {
      const afterOpp = applyMove(afterAi.board, opp, om.pos, om.quadrant, om.dir);
      if (afterOpp.winner === opp) oppWinCount++;
      if (oppWinCount > 5) break;
    }

    const score = -oppWinCount + Math.random() * 0.01;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }

  return best;
}

/* =========================
   UI Helpers
========================= */

function MiniBoardDecorationBelow() {
  const size = 150;
  return (
    <div aria-hidden style={{ width: size, height: size, opacity: 0.16, pointerEvents: "none" }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 18,
          border: "1px solid rgba(17,24,39,0.28)",
          background: "linear-gradient(135deg, rgba(99,102,241,0.18), rgba(16,185,129,0.12))",
          boxShadow: "0 12px 22px rgba(0,0,0,0.08)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 10,
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: 6,
          }}
        >
          {Array.from({ length: 36 }).map((_, i) => (
            <div key={i} style={{ borderRadius: 999, background: "rgba(17,24,39,0.20)" }} />
          ))}
        </div>

        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 10,
            bottom: 10,
            width: 1,
            background: "rgba(17,24,39,0.30)",
            transform: "translateX(-0.5px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 10,
            right: 10,
            height: 1,
            background: "rgba(17,24,39,0.30)",
            transform: "translateY(-0.5px)",
          }}
        />
      </div>
    </div>
  );
}

/* =========================
   App
========================= */

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [mode, setMode] = useState<GameMode>("local");
  const [aiSide, setAiSide] = useState<Player | null>(null);

  const [board, setBoard] = useState<CellValue[][]>(createEmptyBoard());
  const [turn, setTurn] = useState<Player>("white");
  const [phase, setPhase] = useState<Phase>("place");
  const [pendingMove, setPendingMove] = useState<Pos | null>(null);
  const [winner, setWinner] = useState<Player | "draw" | null>(null);

  const [selectedQuadrant, setSelectedQuadrant] = useState<number>(0);
  const [lastMoveText, setLastMoveText] = useState<string>("");

  const isAiTurn = mode === "ai" && aiSide && turn === aiSide && !winner;

  function resetGame() {
    setBoard(createEmptyBoard());
    setTurn("white");
    setPhase("place");
    setPendingMove(null);
    setWinner(null);
    setSelectedQuadrant(0);
    setLastMoveText("");
  }

  function startLocal() {
    resetGame();
    setMode("local");
    setAiSide(null);
    setScreen("game");
  }

  function startAI(humanSide: Player) {
    resetGame();
    setMode("ai");
    setAiSide(humanSide === "white" ? "black" : "white");
    setScreen("game");
  }

  function onTapCell(pos: Pos) {
    if (winner) return;
    if (isAiTurn) return;
    if (phase !== "place") return;

    if (board[pos.y][pos.x] !== null) return;

    setPendingMove(pos);
  }

  function proceedToRotatePhase() {
    if (winner) return;
    if (isAiTurn) return;
    if (phase !== "place") return;
    if (!pendingMove) return;

    setPhase("rotate");
  }

  function cancelPending() {
    if (winner) return;
    if (isAiTurn) return;

    if (phase === "rotate") {
      setPhase("place");
      return;
    }
    setPendingMove(null);
  }

  function confirmRotation(dir: "cw" | "ccw") {
    if (winner) return;
    if (isAiTurn) return;
    if (phase !== "rotate") return;
    if (!pendingMove) return;

    const placed = cloneBoard(board);
    placed[pendingMove.y][pendingMove.x] = turn;
    const rotated = rotateQuadrant(placed, selectedQuadrant, dir);

    const w = checkWinner(rotated);
    setBoard(rotated);
    setPendingMove(null);
    setPhase("place");
    setWinner(w);

    if (!w) {
      setTurn(turn === "white" ? "black" : "white");
    }
  }

  const statusText = useMemo(() => {
    if (winner) {
      return winner === "draw"
        ? "引き分け！リセットで再戦"
        : `${winner === "white" ? "白" : "黒"}の勝ち！リセットで再戦`;
    }
    const who = turn === "white" ? "白" : "黒";
    if (mode === "ai" && aiSide && turn === aiSide) return `AI（${who}）の番…`;
    if (phase === "place") {
      return pendingMove ? `${who}：次へを押して回転へ` : `${who}の番：空マスをタップして仮置き`;
    }
    return `${who}の番：象限を選んで ↺/↻ 回転して確定`;
  }, [winner, turn, phase, mode, aiSide, pendingMove]);

  // AIの手番：自動で1手（置く＋回す）打つ
  useEffect(() => {
    if (mode !== "ai") return;
    if (!aiSide) return;
    if (winner) return;
    if (turn !== aiSide) return;
    if (phase !== "place") return;
    if (pendingMove) return;

    const t = window.setTimeout(() => {
      const m = chooseAiMove(board, aiSide);
      const r = applyMove(board, aiSide, m.pos, m.quadrant, m.dir);

      setBoard(r.board);
      setWinner(r.winner);
      setPhase("place");
      setPendingMove(null);

      setLastMoveText(
        `AI: (${m.pos.x + 1}, ${m.pos.y + 1}) に置いて、${["左上", "右上", "左下", "右下"][m.quadrant]}を${
          m.dir === "cw" ? "↻" : "↺"
        }`
      );

      if (!r.winner) setTurn(aiSide === "white" ? "black" : "white");
    }, 250);

    return () => window.clearTimeout(t);
  }, [mode, aiSide, winner, turn, phase, pendingMove, board]);

  /* ============ Screens ============ */

  if (screen === "home") {
    return (
      <div
        style={{
          minHeight: "100vh",
          paddingTop: 44,
          paddingLeft: "max(16px, env(safe-area-inset-left))",
          paddingRight: "max(16px, env(safe-area-inset-right))",
          paddingBottom: 16,
          background:
            "radial-gradient(900px 500px at 20% 10%, rgba(99,102,241,0.25), transparent 60%)," +
            "radial-gradient(800px 450px at 80% 20%, rgba(16,185,129,0.18), transparent 55%)," +
            "linear-gradient(180deg, rgba(249,250,251,1), rgba(243,244,246,1))",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
        }}
      >
        <div style={{ width: "100%", maxWidth: "100%" }}>
          <div
            style={{
              background: "rgba(255,255,255,0.88)",
              border: "1px solid rgba(17,24,39,0.12)",
              borderRadius: 24,
              padding: 20,
              boxShadow: "0 18px 50px rgba(0,0,0,0.10)",
              backdropFilter: "blur(10px)",
              overflow: "hidden",
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 16,
                  background: "linear-gradient(135deg, rgba(99,102,241,1), rgba(16,185,129,1))",
                  boxShadow: "0 12px 28px rgba(0,0,0,0.18)",
                }}
              />
              <div>
                <div style={{ fontSize: 26, fontWeight: 950, letterSpacing: 0.2 }}>Pentago</div>
                <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>置いて、回して、5つ揃えろ。</div>
              </div>
            </div>

            <div style={{ marginTop: 14, fontSize: 14, lineHeight: 1.6, opacity: 0.9 }}>
              同じ端末で友達とも、AIとも対戦できます。
            </div>

            <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
              <button
                onClick={startLocal}
                style={{
                  appearance: "none",
                  border: "1px solid rgba(17,24,39,0.14)",
                  borderRadius: 16,
                  height: 52,
                  padding: "0 14px",
                  fontSize: 16,
                  fontWeight: 950,
                  background: "white",
                  cursor: "pointer",
                  boxShadow: "0 10px 24px rgba(0,0,0,0.10)",
                  transition: "transform 0.06s ease",
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.99)")}
                onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                友達と対戦
              </button>

              <button
                onClick={() => setScreen("aiSetup")}
                style={{
                  appearance: "none",
                  border: "1px solid rgba(17,24,39,0.14)",
                  borderRadius: 16,
                  height: 52,
                  padding: "0 14px",
                  fontSize: 16,
                  fontWeight: 950,
                  background: "linear-gradient(135deg, rgba(99,102,241,0.14), rgba(16,185,129,0.10))",
                  cursor: "pointer",
                  boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
                  transition: "transform 0.06s ease",
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.99)")}
                onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                AIと対戦
              </button>
            </div>

            <div
              style={{
                marginTop: 14,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 12,
                opacity: 0.65,
              }}
            >
              <div>v0.1</div>
              <div>Made for mobile</div>
            </div>
          </div>

          {/* カード下の装飾ミニ盤面 */}
          <div style={{ marginTop: 24, display: "flex", justifyContent: "center" }}>
            <MiniBoardDecorationBelow />
          </div>
        </div>
      </div>
    );
  }

  if (screen === "aiSetup") {
    return (
      <div
        style={{
          minHeight: "100vh",
          paddingTop: 44,
          paddingLeft: "max(16px, env(safe-area-inset-left))",
          paddingRight: "max(16px, env(safe-area-inset-right))",
          paddingBottom: 16,
          background:
            "radial-gradient(900px 500px at 20% 10%, rgba(99,102,241,0.20), transparent 60%)," +
            "linear-gradient(180deg, rgba(249,250,251,1), rgba(243,244,246,1))",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
        }}
      >
        <div style={{ width: "100%", maxWidth: "100%" }}>
          <div
            style={{
              background: "rgba(255,255,255,0.88)",
              border: "1px solid rgba(17,24,39,0.12)",
              borderRadius: 24,
              padding: 20,
              boxShadow: "0 18px 50px rgba(0,0,0,0.10)",
              backdropFilter: "blur(10px)",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 12 }}>AIと対戦：先手を選ぶ</div>

            <div style={{ display: "grid", gap: 10 }}>
              <button
                onClick={() => startAI("white")}
                style={{
                  height: 52,
                  borderRadius: 16,
                  border: "1px solid rgba(17,24,39,0.14)",
                  background: "white",
                  fontWeight: 950,
                  fontSize: 16,
                  cursor: "pointer",
                }}
              >
                先手（白）
              </button>
              <button
                onClick={() => startAI("black")}
                style={{
                  height: 52,
                  borderRadius: 16,
                  border: "1px solid rgba(17,24,39,0.14)",
                  background: "white",
                  fontWeight: 950,
                  fontSize: 16,
                  cursor: "pointer",
                }}
              >
                後手（黒）
              </button>
              <button
                onClick={() => setScreen("home")}
                style={{
                  height: 44,
                  borderRadius: 16,
                  border: "1px solid rgba(17,24,39,0.12)",
                  background: "rgba(255,255,255,0.8)",
                  cursor: "pointer",
                }}
              >
                戻る
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ========= Game =========
  return (
    <div
      style={{
        minHeight: "100vh",
        paddingTop: 18,
        paddingLeft: "max(12px, env(safe-area-inset-left))",
        paddingRight: "max(12px, env(safe-area-inset-right))",
        paddingBottom: 0,
        background: "linear-gradient(180deg, rgba(249,250,251,1), rgba(243,244,246,1))",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 950 }}>Pentago</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setScreen("home")}
              style={{
                height: 40,
                padding: "0 12px",
                borderRadius: 12,
                border: "1px solid rgba(17,24,39,0.14)",
                background: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              ホーム
            </button>
            <button
              onClick={resetGame}
              style={{
                height: 40,
                padding: "0 12px",
                borderRadius: 12,
                border: "1px solid rgba(17,24,39,0.14)",
                background: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              リセット
            </button>
          </div>
        </div>

        {/* Status */}
        <div style={{ fontSize: 13, opacity: 0.82, marginTop: 10, marginBottom: 10 }}>
          {statusText}
        </div>

        {/* AI log */}
        {mode === "ai" && lastMoveText && (
          <div style={{ fontSize: 12, opacity: 0.72, marginBottom: 10 }}>{lastMoveText}</div>
        )}

        {/* Winner Banner */}
        {winner && (
          <div
            style={{
              marginTop: 8,
              marginBottom: 12,
              padding: 16,
              borderRadius: 16,
              background: "white",
              border: "2px solid rgba(17,24,39,0.2)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 950, marginBottom: 6 }}>
              {winner === "draw" ? "引き分け！" : winner === "white" ? "白の勝ち！" : "黒の勝ち！"}
            </div>
            <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 10 }}>リセットで再戦できます</div>
            <button
              onClick={resetGame}
              style={{
                height: 44,
                padding: "0 16px",
                borderRadius: 12,
                border: "1px solid rgba(17,24,39,0.18)",
                background: "white",
                fontWeight: 950,
                cursor: "pointer",
              }}
            >
              リセット
            </button>
          </div>
        )}

        {/* Board */}
        <Board board={board} turn={turn} phase={phase} pendingMove={pendingMove} onTapCell={onTapCell} />
      </div>

      {/* Bottom Controls (sticky) */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          zIndex: 10,
          marginTop: 14,
          background: "rgba(249,250,251,0.92)",
          backdropFilter: "blur(8px)",
          borderTop: "1px solid rgba(17,24,39,0.12)",
          padding: "10px 12px 12px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          {/* Place phase controls */}
          {phase === "place" && (
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={cancelPending}
                disabled={!pendingMove || !!winner || !!isAiTurn}
                style={{
                  flex: 1,
                  height: 46,
                  borderRadius: 14,
                  border: "1px solid rgba(17,24,39,0.14)",
                  background: "white",
                  fontWeight: 950,
                  opacity: !pendingMove || winner || isAiTurn ? 0.5 : 1,
                  cursor: !pendingMove || winner || isAiTurn ? "default" : "pointer",
                }}
              >
                キャンセル
              </button>

              <button
                onClick={proceedToRotatePhase}
                disabled={!pendingMove || !!winner || !!isAiTurn}
                style={{
                  flex: 1,
                  height: 46,
                  borderRadius: 14,
                  border: "1px solid rgba(17,24,39,0.14)",
                  background: "white",
                  fontWeight: 950,
                  opacity: !pendingMove || winner || isAiTurn ? 0.5 : 1,
                  cursor: !pendingMove || winner || isAiTurn ? "default" : "pointer",
                }}
              >
                次へ（回転）
              </button>
            </div>
          )}

          {/* Rotate phase controls */}
          {phase === "rotate" && (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontSize: 12, opacity: 0.75 }}>象限を選んで回転</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { q: 0, label: "左上" },
                  { q: 1, label: "右上" },
                  { q: 2, label: "左下" },
                  { q: 3, label: "右下" },
                ].map((it) => (
                  <button
                    key={it.q}
                    onClick={() => setSelectedQuadrant(it.q)}
                    style={{
                      height: 44,
                      borderRadius: 14,
                      border: "1px solid rgba(17,24,39,0.14)",
                      background: selectedQuadrant === it.q ? "rgba(99,102,241,0.14)" : "white",
                      fontWeight: 950,
                      cursor: "pointer",
                    }}
                  >
                    {it.label}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => confirmRotation("ccw")}
                  style={{
                    flex: 1,
                    height: 46,
                    borderRadius: 14,
                    border: "1px solid rgba(17,24,39,0.14)",
                    background: "white",
                    fontWeight: 950,
                    fontSize: 18,
                    cursor: "pointer",
                    transition: "transform 0.06s ease",
                  }}
                  onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
                  onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                >
                  ↺
                </button>

                <button
                  onClick={() => confirmRotation("cw")}
                  style={{
                    flex: 1,
                    height: 46,
                    borderRadius: 14,
                    border: "1px solid rgba(17,24,39,0.14)",
                    background: "white",
                    fontWeight: 950,
                    fontSize: 18,
                    cursor: "pointer",
                    transition: "transform 0.06s ease",
                  }}
                  onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
                  onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                >
                  ↻
                </button>

                <button
                  onClick={cancelPending}
                  style={{
                    height: 46,
                    padding: "0 14px",
                    borderRadius: 14,
                    border: "1px solid rgba(17,24,39,0.14)",
                    background: "white",
                    fontWeight: 950,
                    cursor: "pointer",
                  }}
                >
                  戻る
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
