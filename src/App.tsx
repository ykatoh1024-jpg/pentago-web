// ① import
import { useEffect, useMemo, useState } from "react";
import type { CellValue, Phase, Player, Pos, Screen, GameMode } from "./types";
import Board from "./Board";

// ② ユーティリティ関数（← ここに回転関数を書く）
function createEmptyBoard(): CellValue[][] {
  return Array.from({ length: 6 }, () => Array<CellValue>(6).fill(null));
}

function rotateQuadrant(
  board: CellValue[][],
  quadrant: number,
  dir: "cw" | "ccw"
): CellValue[][] {
  // 元の盤面をコピー（破壊しない）
  const newBoard = board.map(row => row.slice());

  // quadrant: 0=左上, 1=右上, 2=左下, 3=右下
  const startX = quadrant % 2 === 0 ? 0 : 3;
  const startY = quadrant < 2 ? 0 : 3;

  // 3x3を一旦取り出す
  const temp: CellValue[][] = Array.from(
    { length: 3 },
    () => Array<CellValue>(3).fill(null)
  );

  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      temp[y][x] = newBoard[startY + y][startX + x];
    }
  }

  // 回転して書き戻す
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      if (dir === "cw") {
        newBoard[startY + y][startX + x] = temp[2 - x][y];
      } else {
        newBoard[startY + y][startX + x] = temp[x][2 - y];
      }
    }
  }

  return newBoard;
}

function checkWinner(board: CellValue[][]): Player | "draw" | null {
  const N = 6;

  const lines: { x: number; y: number }[][] = [];

  // 横
  for (let y = 0; y < N; y++) {
    const line = [];
    for (let x = 0; x < N; x++) line.push({ x, y });
    lines.push(line);
  }
  // 縦
  for (let x = 0; x < N; x++) {
    const line = [];
    for (let y = 0; y < N; y++) line.push({ x, y });
    lines.push(line);
  }
  // 斜め（右下）
  for (let sy = 0; sy < N; sy++) {
    const line = [];
    for (let x = 0, y = sy; x < N && y < N; x++, y++) line.push({ x, y });
    if (line.length >= 5) lines.push(line);
  }
  for (let sx = 1; sx < N; sx++) {
    const line = [];
    for (let x = sx, y = 0; x < N && y < N; x++, y++) line.push({ x, y });
    if (line.length >= 5) lines.push(line);
  }
  // 斜め（左下）
  for (let sy = 0; sy < N; sy++) {
    const line = [];
    for (let x = N - 1, y = sy; x >= 0 && y < N; x--, y++) line.push({ x, y });
    if (line.length >= 5) lines.push(line);
  }
  for (let sx = N - 2; sx >= 0; sx--) {
    const line = [];
    for (let x = sx, y = 0; x >= 0 && y < N; x--, y++) line.push({ x, y });
    if (line.length >= 5) lines.push(line);
  }

  let whiteWin = false;
  let blackWin = false;

  function hasFive(line: { x: number; y: number }[], player: Player): boolean {
    let run = 0;
    for (const p of line) {
      if (board[p.y][p.x] === player) {
        run++;
        if (run >= 5) return true;
      } else {
        run = 0;
      }
    }
    return false;
  }

  for (const line of lines) {
    if (!whiteWin && hasFive(line, "white")) whiteWin = true;
    if (!blackWin && hasFive(line, "black")) blackWin = true;
    if (whiteWin && blackWin) break;
  }

  if (whiteWin && blackWin) return "draw"; // ペンタゴは同時達成があり得るので引き分け扱い（後でルール調整可）
  if (whiteWin) return "white";
  if (blackWin) return "black";

  // 盤面が全部埋まっていたら引き分け
  const filled = board.every(row => row.every(cell => cell !== null));
  if (filled) return "draw";

  return null;
}

function applyMove(
  board: CellValue[][],
  player: Player,
  pos: Pos,
  quadrant: number,
  dir: "cw" | "ccw"
): { board: CellValue[][]; winner: Player | "draw" | null } {
  const placed = board.map(row => row.slice());
  placed[pos.y][pos.x] = player;

  const rotated = rotateQuadrant(placed, quadrant, dir);
  const w = checkWinner(rotated);

  return { board: rotated, winner: w };
}

type Move = { pos: Pos; quadrant: number; dir: "cw" | "ccw" };

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

  // 2) 相手の即勝ち手を「減らす」手を選ぶ（0にできるならそれ）
  let best: Move = candidates[Math.floor(Math.random() * candidates.length)];
  let bestScore = -Infinity;

  for (const m of candidates) {
    const afterAi = applyMove(board, ai, m.pos, m.quadrant, m.dir);

    // この手で自分が勝ってたら上で拾われてるが念のため
    if (afterAi.winner === ai) return m;

    // 相手の「次の即勝ち数」を数える（少ないほど良い）
    const oppMoves = generateMoves(afterAi.board);
    let oppWinCount = 0;
    for (const om of oppMoves) {
      const afterOpp = applyMove(afterAi.board, opp, om.pos, om.quadrant, om.dir);
      if (afterOpp.winner === opp) oppWinCount++;
      // 早めに打ち切り（軽量化）
      if (oppWinCount > 5) break;
    }

    // スコア：相手の即勝ちが少ないほど良い + ちょいランダム
    const score = -oppWinCount + Math.random() * 0.01;

    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }

  return best;
}


function confirmRotation(
  board: CellValue[][],
  pendingMove: Pos | null,
  turn: Player,
  quadrant: number,
  dir: "cw" | "ccw",
  setBoard: (b: CellValue[][]) => void,
  setPendingMove: (p: Pos | null) => void,
  setPhase: (p: Phase) => void,
  setTurn: (t: Player) => void,
  setWinner: (w: Player | "draw" | null) => void
) {
  if (!pendingMove) return;

  // 仮置きを正式に反映
  const placed = board.map(row => row.slice());
  placed[pendingMove.y][pendingMove.x] = turn;

  // 回転
  const rotated = rotateQuadrant(placed, quadrant, dir);

  const w = checkWinner(rotated);
  if (w) {
    setBoard(rotated);
    setPendingMove(null);
    setPhase("place");
    setWinner(w);
    return; // 勝敗が決まったら手番交代しない
  }

  // state更新（ターン確定）
  setBoard(rotated);
  setPendingMove(null);
  setPhase("place");
  setTurn(turn === "white" ? "black" : "white");
}


export default function App() {
  const [board, setBoard] = useState<CellValue[][]>(() => createEmptyBoard());
  const [turn, setTurn] = useState<Player>("white");
  const [phase, setPhase] = useState<Phase>("place");
  const [pendingMove, setPendingMove] = useState<Pos | null>(null);
  const [winner, setWinner] = useState<Player | "draw" | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [mode, setMode] = useState<GameMode>("local");
  const [lastMoveText, setLastMoveText] = useState<string>("");

  // AI用：AI側の色（humanはその逆）
  const [aiSide, setAiSide] = useState<Player | null>(null);


  const canCancel = pendingMove !== null && phase === "place";

  const statusText = useMemo(() => {
  if (winner)
    return winner === "draw"
      ? "引き分け！リセットで再戦"
      : `${winner === "white" ? "白" : "黒"}の勝ち！リセットで再戦`;

  const who = turn === "white" ? "白" : "黒";
  if (mode === "ai" && aiSide && turn === aiSide) return `AI（${who}）の番…`;
  if (phase === "place") return `${who}の番：空マスをタップして仮置き`;
  return `${who}の番：象限を選んで ↺/↻ 回転して確定`;
}, [winner, turn, phase, mode, aiSide]);

const headerText = useMemo(() => {
  const turnText = turn === "white" ? "白（先手）" : "黒（後手）";
  const phaseText = phase === "place" ? "置く" : "回す";
  return `${turnText}の手番｜${phaseText}`;
}, [turn, phase]);

useEffect(() => {
  if (mode !== "ai") return;
  if (!aiSide) return;
  if (winner) return;

  // AIの手番で、かつ人間が操作していない状態の時だけ
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
    setLastMoveText(`AI: (${m.pos.x + 1}, ${m.pos.y + 1}) に置いて、${["左上","右上","左下","右下"][m.quadrant]}を${m.dir === "cw" ? "↻" : "↺"}`);

    if (!r.winner) {
      setTurn(aiSide === "white" ? "black" : "white");
    }
  }, 250); // “考えてる感”だけ

  return () => window.clearTimeout(t);
}, [mode, aiSide, winner, turn, phase, pendingMove, board]);




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

  // AIが先手の場合は、開始直後にAIが打つ
  // resetGame() で turn は "white" なので、AI=white の時だけ動く
  }


  function resetGame() {
    setBoard(createEmptyBoard());
    setTurn("white");
    setPhase("place");
    setPendingMove(null);
    setWinner(null);
  }

  function onTapCell(pos: Pos) {
    const isAiTurn = mode === "ai" && aiSide && turn === aiSide;
    if (winner) return;
    if (isAiTurn) return;
    if (mode === "ai" && aiSide && turn === aiSide) return;
    if (phase !== "place") return;
    const cell = board[pos.y]?.[pos.x];
    if (cell !== null) return;
    if (winner) return;

    // 仮置き：まだ確定しない（回転を選ぶまで）
    setPendingMove(pos);
  }

  function cancelPending() {
    setPendingMove(null);
  }

  // ここは次ステップで「回転」ボタンに置き換える
  function proceedToRotatePhase() {
    const isAiTurn = mode === "ai" && aiSide && turn === aiSide;
    if (winner) return;
    if (isAiTurn) return;
    if (mode === "ai" && aiSide && turn === aiSide) return;
    if (!pendingMove) return;
    if (winner) return;
    setPhase("rotate");
  }

  if (screen === "home") {
    return (
      <div
        style={{
          minHeight: "100vh",
          paddingLeft: "max(16px, env(safe-area-inset-left))",
          paddingRight: "max(16px, env(safe-area-inset-right))",
          background:
            "radial-gradient(900px 500px at 20% 10%, rgba(99,102,241,0.25), transparent 60%)," +
            "radial-gradient(800px 450px at 80% 20%, rgba(16,185,129,0.18), transparent 55%)," +
            "linear-gradient(180deg, rgba(249,250,251,1), rgba(243,244,246,1))",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "flex-start",
          paddingTop: 48,
        }}
      >
        {/* カード下の装飾エリア */}
        <div
          style={{
            marginTop: 28,
            display: "flex",
            justifyContent: "center",
            opacity: 0.18,
            pointerEvents: "none",
          }}
        >
          <MiniBoardDecoration />

        </div>

        <div
          style={{
            width: "100%",
            maxWidth: "100%",   // ★ ここ
            padding: 20,        // ★ 内側に余白を持たせる
            boxSizing: "border-box",
          }}
        >

          {/* 白いカード */}
          <div
            style={{
              background: "rgba(255,255,255,0.86)",
              border: "1px solid rgba(17,24,39,0.12)",
              borderRadius: 24,
              padding: 20,
              boxShadow: "0 18px 50px rgba(0,0,0,0.10)",
              backdropFilter: "blur(10px)",
              position: "relative", 
              overflow: "hidden", 
            }}
          >

            {/* タイトル */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 16,
                  background:
                    "linear-gradient(135deg, rgba(99,102,241,1), rgba(16,185,129,1))",
                  boxShadow: "0 12px 28px rgba(0,0,0,0.18)",
                }}
              />
              <div>
                <div style={{ fontSize: 26, fontWeight: 950, letterSpacing: 0.2 }}>
                  Pentago
                </div>
              </div>
            </div>

            {/* ちょい説明 */}
            <div style={{ marginTop: 14, fontSize: 14, lineHeight: 1.6, opacity: 0.9 }}>
              置いて、回して、5つ揃えろ。<br />
              同じ端末で友達とも、AIとも対戦できます。
            </div>

            {/* ボタン */}
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
                友達と対戦（同じ端末）
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
                  background:
                    "linear-gradient(135deg, rgba(99,102,241,0.14), rgba(16,185,129,0.10))",
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

            {/* フッター小物 */}
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
        </div>
      </div>
    );
  }


  if (screen === "aiSetup") {
    return (
      <div style={{ padding: 16 }}>
        <h2>AIと対戦：先手を選ぶ</h2>
        <button onClick={() => startAI("white")}>先手（白）</button>
        <button onClick={() => startAI("black")}>後手（黒）</button>
        <button onClick={() => setScreen("home")}>戻る</button>
      </div>
    );
  }

  // screen === "game"
  return (
        <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, rgba(249,250,251,1), rgba(243,244,246,1))",
        padding: 16,
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#111827" }}>Pentago</div>
          <button
            onClick={resetGame}
            style={{
              appearance: "none",
              border: "1px solid rgba(17,24,39,0.18)",
              borderRadius: 12,
              height: 40,
              padding: "0 12px",
              fontSize: 14,
              fontWeight: 800,
              background: "white",
              color: "#111827",
              boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
              cursor: "pointer",
            }}
          >
            リセット
          </button>
        </div>

        {/* ← ヘッダー直下：ここに置く */}
        <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 10 }}>
          {statusText}
        </div>

        {/* 盤面 */}
        <Board
          board={board}
          turn={turn}
          phase={phase}
          pendingMove={pendingMove}
          onTapCell={onTapCell}
        />


          {/* AIの直前の手を表示（ヘッダーの下） */}
          {mode === "ai" && lastMoveText && (
            <div
              style={{
                fontSize: 12,
                opacity: 0.75,
                marginBottom: 8,
              }}
            >
              {lastMoveText}
            </div>
          )}


        {/* 勝敗表示 */}
        {winner && (
          <div
            style={{
              marginTop: 12,
              marginBottom: 12,
              padding: 16,
              borderRadius: 16,
              background: "white",
              border: "2px solid rgba(17,24,39,0.2)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>
              {winner === "draw"
                ? "引き分け！"
                : winner === "white"
                ? "白の勝ち！"
                : "黒の勝ち！"}
            </div>

            <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 10 }}>
              リセットで再戦できます
            </div>

            <button
              onClick={resetGame}
              style={{
                height: 44,
                padding: "0 16px",
                borderRadius: 12,
                border: "1px solid rgba(17,24,39,0.18)",
                background: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              リセット
            </button>
          </div>
        )}



        <div style={{ marginTop: 8, marginBottom: 12, fontSize: 14, opacity: 0.85 }}>
          {headerText}
        </div>

        {/* 下部操作：まずは「キャンセル」「次へ（回転へ）」だけ */}
        <div style={{ maxWidth: 520, margin: "12px auto 0", display: "flex", gap: 10 }}>
          <button
            onClick={cancelPending}
            disabled={!canCancel}
            style={{
              flex: 1,
              height: 48,
              borderRadius: 14,
              border: "1px solid rgba(17,24,39,0.18)",
              background: canCancel ? "white" : "rgba(17,24,39,0.06)",
              fontSize: 16,
              fontWeight: 900,
              cursor: canCancel ? "pointer" : "not-allowed",
              boxShadow: canCancel ? "0 2px 10px rgba(0,0,0,0.06)" : "none",
            }}
          >
            キャンセル
          </button>

          <button
            onClick={proceedToRotatePhase}
            disabled={!pendingMove || phase !== "place"}
            style={{
              flex: 1,
              height: 48,
              borderRadius: 14,
              border: "1px solid rgba(17,24,39,0.18)",
              background: pendingMove && phase === "place" ? "white" : "rgba(17,24,39,0.06)",
              fontSize: 16,
              fontWeight: 900,
              cursor: pendingMove && phase === "place" ? "pointer" : "not-allowed",
              boxShadow: pendingMove && phase === "place" ? "0 2px 10px rgba(0,0,0,0.06)" : "none",
            }}
          >
            次へ（回転）
          </button>
        </div>

        {phase === "rotate" && (
          <div
            style={{
              maxWidth: 520,
              margin: "10px auto 0",
              padding: 10,
              borderRadius: 16,
              border: "1px solid rgba(17,24,39,0.18)",
              background: "white",
              boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>
              回転する象限を選んでください
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              {[
                { q: 0, label: "左上" },
                { q: 1, label: "右上" },
                { q: 2, label: "左下" },
                { q: 3, label: "右下" },
              ].map(({ q, label }) => (
                <div key={q} style={{ border: "1px solid rgba(17,24,39,0.12)", borderRadius: 14, padding: 10 }}>
                  <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>{label}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() =>
                        confirmRotation(
                          board,
                          pendingMove,
                          turn,
                          q,
                          "ccw",
                          setBoard,
                          setPendingMove,
                          setPhase,
                          setTurn,
                          setWinner
                        )
                      }
                      style={{
                        flex: 1,
                        height: 44,
                        borderRadius: 12,
                        border: "1px solid rgba(17,24,39,0.18)",
                        background: "white",
                        fontSize: 18,
                        fontWeight: 900,
                        cursor: "pointer",
                        transition: "transform 0.06s ease", // ★ 追加
                      }}
                      onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")} // ★ 追加
                      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}      // ★ 追加
                      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}   // ★ 追加（はみ出し防止）
                    >
                      ↺
                    </button>
                    <button
                      onClick={() =>
                        confirmRotation(
                          board,
                          pendingMove,
                          turn,
                          q,
                          "cw",
                          setBoard,
                          setPendingMove,
                          setPhase,
                          setTurn,
                          setWinner
                        )
                      }
                      style={{
                        flex: 1,
                        height: 44,
                        borderRadius: 12,
                        border: "1px solid rgba(17,24,39,0.18)",
                        background: "white",
                        fontSize: 18,
                        fontWeight: 900,
                        cursor: "pointer",
                        transition: "transform 0.06s ease", // ★ 追加
                      }}
                      onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")} // ★ 追加
                      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}      // ★ 追加
                      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}   // ★ 追加（はみ出し防止）
                    >
                      ↻
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}


        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>
          いまは「仮置き」まで完成。次のステップで「回転↺↻」を実装してターン確定にします。
        </div>
      </div>
      {/* 下部操作ラッパー（★ここに書く） */}
      <div
        style={{
          position: "sticky",      // ★ 6) はここ
          bottom: 0,               // ★ 画面下に吸着
          zIndex: 10,
          background: "rgba(249,250,251,0.92)",
          backdropFilter: "blur(8px)",
          padding: "10px 12px 12px",
          borderTop: "1px solid rgba(17,24,39,0.12)",
        }}
      >
        {/* キャンセル / 次へ */}
        <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", gap: 10 }}>
          <button>キャンセル</button>
          <button>次へ（回転）</button>
        </div>

        {/* 回転UI */}
        {phase === "rotate" && (
          <div style={{ maxWidth: 520, margin: "10px auto 0" }}>
            {/* ↺ / ↻ ボタン群 */}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniBoardDecoration() {
  const size = 170; // 装飾の大きさ（好みで 150〜200）
  const cell = Math.floor(size / 6);

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: -18,
        right: -18,
        width: size,
        height: size,
        transform: "rotate(10deg)",
        opacity: 0.16,
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 18,
          border: "1px solid rgba(17,24,39,0.35)",
          background:
            "linear-gradient(135deg, rgba(99,102,241,0.20), rgba(16,185,129,0.16))",
          boxShadow: "0 18px 30px rgba(0,0,0,0.08)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* 6x6の薄いグリッド */}
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
            <div
              key={i}
              style={{
                width: cell - 6,
                height: cell - 6,
                borderRadius: 999,
                background: "rgba(17,24,39,0.22)",
                filter: "blur(0.1px)",
              }}
            />
          ))}
        </div>

        {/* 象限の仕切り（ペンタゴっぽさ） */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 10,
            bottom: 10,
            width: 1,
            background: "rgba(17,24,39,0.35)",
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
            background: "rgba(17,24,39,0.35)",
            transform: "translateY(-0.5px)",
          }}
        />
      </div>
    </div>
  );
}

