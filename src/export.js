import { COLS, SIZE, SQUARES } from "./data.js";

const BG = "#EFEDE6";
const INK = "#0A0A0A";
const BLUE = "#0047FF";
const PAPER = "#F7F4EE";

function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawCover(ctx, img, x, y, w, h) {
  const ir = img.width / img.height;
  const cr = w / h;
  let sx;
  let sy;
  let sw;
  let sh;
  if (ir > cr) {
    sh = img.height;
    sw = sh * cr;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / cr;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function ditherBand(ctx, x, y, w, h, color) {
  const img = ctx.createImageData(w, h);
  const bayer = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];
  const [r, g, b] = color;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const t = py / Math.max(1, h - 1);
      const threshold = (bayer[py % 4][px % 4] + 0.5) / 16;
      const on = t > threshold;
      const i = (py * w + px) * 4;
      img.data[i] = on ? r : 239;
      img.data[i + 1] = on ? g : 237;
      img.data[i + 2] = on ? b : 230;
      img.data[i + 3] = on ? 255 : 0;
    }
  }
  ctx.putImageData(img, x, y);
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function fitTitleSize(ctx, maxWidth) {
  const launch = "INNOLAUNCH ";
  const bingo = "BINGO";
  for (let size = 220; size >= 24; size -= 1) {
    const spacing = Math.round(-size * 0.0625);
    ctx.font = `800 ${size}px Archivo, sans-serif`;
    ctx.letterSpacing = `${spacing}px`;
    const width = ctx.measureText(launch).width + ctx.measureText(bingo).width;
    if (width <= maxWidth) return { size, spacing };
  }
  return { size: 24, spacing: -1 };
}

export async function exportBoard({ filled, urls, score }) {
  await document.fonts.ready;

  const W = 1400;
  const pad = 72;
  const label = 36;
  const inner = W - pad * 2 - label;
  const cell = inner / SIZE;

  const measureCtx = document.createElement("canvas").getContext("2d");
  const titleMax = W - pad * 2;
  const { size: titleSize, spacing: titleSpacing } = fitTitleSize(measureCtx, titleMax);
  const headerH = titleSize + 80;
  const footerH = 180;
  const boardTop = pad + headerH;
  const H = boardTop + label + inner + footerH;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  ditherBand(ctx, 0, 0, W, 28, [0, 71, 255]);
  ditherBand(ctx, 0, H - 28, W, 28, [10, 10, 10]);

  ctx.save();
  ctx.strokeStyle = "rgba(10,10,10,0.08)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 28) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = BLUE;
  ctx.fillRect(pad, pad + 8, 18, 18);

  ctx.fillStyle = INK;
  ctx.font = "600 18px 'IBM Plex Mono', monospace";
  ctx.textBaseline = "top";
  ctx.fillText("#0047FF  //  F'26  //  INNOD", pad + 32, pad + 10);

  ctx.font = `800 ${titleSize}px Archivo, sans-serif`;
  ctx.letterSpacing = `${titleSpacing}px`;
  ctx.fillStyle = INK;
  ctx.fillText("INNOLAUNCH ", pad, pad + 48);
  const launchW = ctx.measureText("INNOLAUNCH ").width;
  ctx.fillStyle = BLUE;
  ctx.fillText("BINGO", pad + launchW, pad + 48);
  ctx.letterSpacing = "0px";

  const pts = String(score.total).padStart(2, "0");
  ctx.fillStyle = INK;
  ctx.font = "600 18px 'IBM Plex Mono', monospace";
  ctx.textAlign = "right";
  ctx.fillText(`PTS ${pts}   SQ ${score.squares}/16   ROW ${score.rows}/4`, W - pad, pad + 10);
  ctx.textAlign = "left";

  const gx = pad + label;
  const gy = boardTop + label;

  ctx.font = "600 16px 'IBM Plex Mono', monospace";
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let c = 0; c < SIZE; c++) {
    ctx.fillText(COLS[c], gx + cell * c + cell / 2, gy - 20);
  }
  for (let r = 0; r < SIZE; r++) {
    ctx.fillText(String(r + 1), gx - 20, gy + cell * r + cell / 2);
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = PAPER;
  ctx.fillRect(gx, gy, inner, inner);

  for (let i = 0; i < SIZE * SIZE; i++) {
    const c = i % SIZE;
    const r = Math.floor(i / SIZE);
    const x = gx + c * cell;
    const y = gy + r * cell;
    const sq = SQUARES[i];

    if (filled[i] && urls[i]) {
      try {
        const img = await loadImage(urls[i]);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, cell, cell);
        ctx.clip();
        drawCover(ctx, img, x, y, cell, cell);
        ctx.restore();
      } catch {
        ctx.fillStyle = BLUE;
        ctx.fillRect(x, y, cell, cell);
      }
    } else {
      ctx.fillStyle = INK;
      ctx.font = "700 22px Archivo, sans-serif";
      const lines = wrapText(ctx, sq.text, cell - 28);
      const startY = y + 24;
      lines.slice(0, 6).forEach((line, li) => {
        ctx.fillText(line, x + 12, startY + li * 26);
      });

      if (sq.tag) {
        ctx.fillStyle = BLUE;
        const tag = sq.tag;
        ctx.font = "700 12px 'IBM Plex Mono', monospace";
        const tw = ctx.measureText(tag).width + 16;
        const tagY = y + cell - 28;
        ctx.fillRect(x + 12, tagY, tw, 22);
        ctx.fillStyle = PAPER;
        ctx.fillText(tag, x + 20, tagY + 16);
      }
    }
  }

  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(gx + 1.5, gy + 1.5, inner - 3, inner - 3);
  ctx.lineWidth = 1.5;
  for (let i = 1; i < SIZE; i++) {
    ctx.beginPath();
    ctx.moveTo(gx + i * cell, gy);
    ctx.lineTo(gx + i * cell, gy + inner);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(gx, gy + i * cell);
    ctx.lineTo(gx + inner, gy + i * cell);
    ctx.stroke();
  }

  ctx.fillStyle = INK;
  ctx.font = "600 16px 'IBM Plex Mono', monospace";
  ctx.fillText("INSERT YOUR PICTURES ON THE SQUARES YOU COMPLETED.", pad, gy + inner + 56);
  ctx.fillText("EACH SQUARE IS 1 POINT.  EACH ROW COMPLETED IS 5 POINTS.", pad, gy + inner + 82);

  ctx.fillStyle = BLUE;
  ctx.fillRect(pad, gy + inner + 110, 12, 12);
  ctx.fillStyle = INK;
  ctx.fillText(`TOTAL  ${pts} PTS`, pad + 24, gy + inner + 121);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("Could not export board"));
      else resolve(blob);
    }, "image/png");
  });
}
