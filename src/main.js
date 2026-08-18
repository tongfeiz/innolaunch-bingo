import { SIZE, SQUARES, coord, scoreFromFilled } from "./data.js";
import {
  loadAll,
  saveSquare,
  removeSquare,
  clearSquares,
  compressImage,
} from "./db.js";
import { exportBoard } from "./export.js";

const boardEl = document.querySelector("#board");
const fileEl = document.querySelector("#file");
const ptsEl = document.querySelector("#pts");
const sqEl = document.querySelector("#sq");
const rowsEl = document.querySelector("#rows");
const toastEl = document.querySelector("#toast");
const overlayEl = document.querySelector("#overlay");
const sheetEl = document.querySelector("#sheet");
const sheetTitle = document.querySelector("#sheet-title");
const sheetCopy = document.querySelector("#sheet-copy");
const railEl = document.querySelector(".rail");
const hintEl = document.querySelector("#hint");
const brandH1 = document.querySelector(".brand h1");

const urls = Array(SIZE * SIZE).fill(null);
const blobs = Array(SIZE * SIZE).fill(null);
let pending = null;
let toastTimer = 0;

const ASCII = `+ SYS.READY
+ GRID 04x04
+ DITHER ON
+ ASCII HUD
|
> TAP SQ
> FIT PHOTO
> AUTOSAVE
|
++ PTS = SQ + ROW*5
++ EXPORT PNG
|
${new Date().toISOString().slice(0, 10)}
innod.bingo`;

railEl.textContent = ASCII;

function fitBrandTitle() {
  if (!brandH1) return;
  const maxWidth = brandH1.parentElement.clientWidth;
  if (!maxWidth) return;

  let size = 12;
  const max = 280;
  brandH1.style.fontSize = `${size}px`;

  while (size < max) {
    size += 1;
    brandH1.style.fontSize = `${size}px`;
    if (brandH1.scrollWidth > maxWidth) {
      brandH1.style.fontSize = `${size - 1}px`;
      break;
    }
  }
}

let resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(fitBrandTitle, 80);
});

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1800);
}

function filledMap() {
  return blobs.map(Boolean);
}

function renderScore() {
  const { squares, rows, total } = scoreFromFilled(filledMap());
  ptsEl.textContent = pad2(total);
  sqEl.textContent = `${pad2(squares)}/16`;
  rowsEl.textContent = `${rows}/4`;
  hintEl.textContent =
    squares === 16
      ? ">> board complete  //  export when ready"
      : ">> tap a square to upload a photo";

  for (let r = 0; r < SIZE; r++) {
    const complete = filledMap()
      .slice(r * SIZE, r * SIZE + SIZE)
      .every(Boolean);
    const label = boardEl.querySelector(`[data-row-label="${r}"]`);
    if (label) label.classList.toggle("row-done", complete);
    for (let c = 0; c < SIZE; c++) {
      const cell = boardEl.querySelector(`[data-index="${r * SIZE + c}"]`);
      if (cell) cell.classList.toggle("row-done", complete);
    }
  }
}

function setPhoto(index, blob) {
  if (urls[index]) URL.revokeObjectURL(urls[index]);
  blobs[index] = blob;
  urls[index] = blob ? URL.createObjectURL(blob) : null;
  const cell = boardEl.querySelector(`[data-index="${index}"]`);
  if (!cell) return;
  const img = cell.querySelector(".photo");
  if (blob) {
    cell.classList.add("filled");
    img.src = urls[index];
    img.hidden = false;
  } else {
    cell.classList.remove("filled");
    img.removeAttribute("src");
    img.hidden = true;
  }
  renderScore();
}

function buildBoard() {
  const frag = document.createDocumentFragment();
  const corner = document.createElement("div");
  corner.className = "axis";
  corner.textContent = "+";
  frag.append(corner);

  for (const col of ["A", "B", "C", "D"]) {
    const el = document.createElement("div");
    el.className = "axis";
    el.textContent = col;
    frag.append(el);
  }

  SQUARES.forEach((sq, i) => {
    if (i % SIZE === 0) {
      const row = document.createElement("div");
      row.className = "axis";
      row.dataset.rowLabel = String(Math.floor(i / SIZE));
      row.textContent = String(Math.floor(i / SIZE) + 1);
      frag.append(row);
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cell";
    btn.dataset.index = String(i);
    btn.setAttribute("role", "gridcell");
    btn.setAttribute("aria-label", `${coord(i)}. ${sq.tag ? `[${sq.tag}] ` : ""}${sq.text}`);

    btn.innerHTML = `
      <img class="photo" alt="" hidden />
      <div class="cell-body">
        <span class="prompt">${sq.text}</span>
        ${sq.tag ? `<span class="tag">${sq.tag}</span>` : ""}
      </div>
    `;
    frag.append(btn);
  });

  boardEl.append(frag);
}

function openPicker(index) {
  pending = index;
  fileEl.value = "";
  fileEl.click();
}

function closeSheet() {
  sheetEl.classList.remove("open");
  overlayEl.classList.remove("open");
  sheetEl.hidden = true;
  pending = null;
}

function openSheet(index) {
  pending = index;
  sheetTitle.textContent = coord(index);
  sheetCopy.textContent = SQUARES[index].text;
  sheetEl.hidden = false;
  overlayEl.classList.add("open");
  requestAnimationFrame(() => sheetEl.classList.add("open"));
}

async function ingestFile(file, index) {
  if (!file || !file.type.startsWith("image/")) {
    toast("Need an image file");
    return;
  }
  document.body.classList.add("busy");
  try {
    const blob = await compressImage(file);
    await saveSquare({ id: index, blob, ts: Date.now() });
    setPhoto(index, blob);
    toast(`saved  ${coord(index)}`);
  } catch (err) {
    console.error(err);
    toast("Could not save photo");
  } finally {
    document.body.classList.remove("busy");
  }
}

buildBoard();

boardEl.addEventListener("click", (e) => {
  const cell = e.target.closest(".cell");
  if (!cell) return;
  const index = Number(cell.dataset.index);
  if (blobs[index]) openSheet(index);
  else openPicker(index);
});

boardEl.addEventListener("dragover", (e) => {
  if (e.target.closest(".cell")) e.preventDefault();
});

boardEl.addEventListener("drop", (e) => {
  const cell = e.target.closest(".cell");
  if (!cell) return;
  e.preventDefault();
  const file = e.dataTransfer.files?.[0];
  ingestFile(file, Number(cell.dataset.index));
});

fileEl.addEventListener("change", () => {
  const file = fileEl.files?.[0];
  const index = pending;
  closeSheet();
  if (index == null) return;
  ingestFile(file, index);
});

document.querySelector("#replace").addEventListener("click", () => {
  if (pending == null) return;
  openPicker(pending);
});

document.querySelector("#remove").addEventListener("click", async () => {
  const index = pending;
  if (index == null) return;
  try {
    await removeSquare(index);
    setPhoto(index, null);
    toast(`cleared  ${coord(index)}`);
  } catch {
    toast("Could not remove");
  }
  closeSheet();
});

overlayEl.addEventListener("click", closeSheet);

document.querySelector("#reset").addEventListener("click", async () => {
  if (!confirm("Clear every square and photo?")) return;
  try {
    await clearSquares();
    blobs.forEach((_, i) => setPhoto(i, null));
    toast("board reset");
  } catch {
    toast("Could not reset");
  }
});

document.querySelector("#export").addEventListener("click", async () => {
  const btn = document.querySelector("#export");
  btn.disabled = true;
  btn.textContent = "Rendering…";
  try {
    const blob = await exportBoard({
      filled: filledMap(),
      urls,
      score: scoreFromFilled(filledMap()),
    });
    const file = new File([blob], "innolaunch-bingo.png", { type: "image/png" });
    const canShare =
      navigator.canShare && navigator.canShare({ files: [file] });
    if (canShare) {
      await navigator.share({ files: [file], title: "InnoLaunch Bingo" });
    } else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "innolaunch-bingo.png";
      a.click();
      URL.revokeObjectURL(a.href);
    }
    toast("board exported");
  } catch (err) {
    if (err?.name !== "AbortError") {
      console.error(err);
      toast("Export failed");
    }
  } finally {
    btn.disabled = false;
    btn.textContent = "Export board";
  }
});

try {
  const saved = await loadAll();
  for (const rec of saved) {
    if (rec?.blob && rec.id >= 0 && rec.id < SIZE * SIZE) {
      setPhoto(rec.id, rec.blob);
    }
  }
  if (saved.length) toast("progress restored");
} catch (err) {
  console.error(err);
  toast("Storage unavailable");
}

renderScore();

document.fonts.ready.then(fitBrandTitle);
