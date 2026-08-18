const BG = "#EFEDE6";
const INK = "#0A0A0A";
const BLUE = "#0047FF";
const PAPER = "#F7F4EE";

function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const test = line ? line + " " + word : word;
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
  let sx, sy, sw, sh;
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
  const r = color[0], g = color[1], b = color[2];
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

function loadExportImage(url) {
  return new Promise(function (resolve, reject) {
    const img = new Image();
    img.onload = function () { resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

function fitTitleSize(ctx, maxWidth) {
  const launch = "INNOLAUNCH ";
  const bingo = "BINGO";
  for (let size = 220; size >= 24; size -= 1) {
    const spacing = Math.round(-size * 0.0625);
    ctx.font = "800 " + size + "px Archivo, sans-serif";
    ctx.letterSpacing = spacing + "px";
    const width = ctx.measureText(launch).width + ctx.measureText(bingo).width;
    if (width <= maxWidth) return { size: size, spacing: spacing };
  }
  return { size: 24, spacing: -1 };
}

function exportBoard(opts) {
  const filled = opts.filled;
  const urls = opts.urls;
  const score = opts.score;

  return document.fonts.ready.then(function () {
    const W = 1400;
    const pad = 72;
    const inner = W - pad * 2;
    const cell = inner / SIZE;

    const measureCtx = document.createElement("canvas").getContext("2d");
    const titleMax = W - pad * 2;
    const titleFit = fitTitleSize(measureCtx, titleMax);
    const titleSize = titleFit.size;
    const titleSpacing = titleFit.spacing;
    const headerH = titleSize + 80;
    const footerH = 180;
    const boardTop = pad + headerH;
    const H = boardTop + inner + footerH;

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

    ctx.font = "800 " + titleSize + "px Archivo, sans-serif";
    ctx.letterSpacing = titleSpacing + "px";
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
    ctx.fillText("PTS " + pts + "   SQ " + score.squares + "/16   LN " + score.lines + "/8", W - pad, pad + 10);
    ctx.textAlign = "left";

    const gx = pad;
    const gy = boardTop;

    ctx.fillStyle = PAPER;
    ctx.fillRect(gx, gy, inner, inner);

    function drawSquares(i) {
      if (i >= SIZE * SIZE) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3;
        ctx.strokeRect(gx + 1.5, gy + 1.5, inner - 3, inner - 3);
        ctx.lineWidth = 1.5;
        for (let j = 1; j < SIZE; j++) {
          ctx.beginPath();
          ctx.moveTo(gx + j * cell, gy);
          ctx.lineTo(gx + j * cell, gy + inner);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(gx, gy + j * cell);
          ctx.lineTo(gx + inner, gy + j * cell);
          ctx.stroke();
        }

        ctx.fillStyle = INK;
        ctx.font = "600 16px 'IBM Plex Mono', monospace";
        ctx.fillText("INSERT YOUR PICTURES ON THE SQUARES YOU COMPLETED.", pad, gy + inner + 56);
        ctx.fillText("SQUARE = 1 POINT, ROW/COLUMN = 5 POINTS", pad, gy + inner + 82);

        ctx.fillStyle = BLUE;
        ctx.fillRect(pad, gy + inner + 110, 12, 12);
        ctx.fillStyle = INK;
        ctx.fillText("TOTAL  " + pts + " PTS", pad + 24, gy + inner + 121);

        return new Promise(function (resolve, reject) {
          canvas.toBlob(function (blob) {
            if (!blob) reject(new Error("Could not export board"));
            else resolve(blob);
          }, "image/png");
        });
      }

      const c = i % SIZE;
      const r = Math.floor(i / SIZE);
      const x = gx + c * cell;
      const y = gy + r * cell;
      const sq = SQUARES[i];

      if (filled[i] && urls[i]) {
        return loadExportImage(urls[i]).then(function (img) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, cell, cell);
          ctx.clip();
          drawCover(ctx, img, x, y, cell, cell);
          ctx.restore();
        }).catch(function () {
          ctx.fillStyle = BLUE;
          ctx.fillRect(x, y, cell, cell);
        }).then(function () { return drawSquares(i + 1); });
      }

      ctx.fillStyle = INK;
      ctx.font = "700 22px Archivo, sans-serif";
      const lines = wrapText(ctx, sq.text, cell - 28);
      const startY = y + 24;
      for (let li = 0; li < Math.min(lines.length, 6); li++) {
        ctx.fillText(lines[li], x + 12, startY + li * 26);
      }

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

      return drawSquares(i + 1);
    }

    return drawSquares(0);
  });
}
