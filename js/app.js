(function () {
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
  const brandH1 = document.querySelector(".brand h1");

  const urls = Array(SIZE * SIZE).fill(null);
  const blobs = Array(SIZE * SIZE).fill(null);
  let pending = null;
  let toastTimer = 0;

  function fitBrandTitle() {
    if (!brandH1) return;
    const maxWidth = brandH1.parentElement.clientWidth;
    if (!maxWidth) return;

    let size = 12;
    const max = 280;
    brandH1.style.fontSize = size + "px";

    while (size < max) {
      size += 1;
      brandH1.style.fontSize = size + "px";
      if (brandH1.scrollWidth > maxWidth) {
        brandH1.style.fontSize = (size - 1) + "px";
        break;
      }
    }
  }

  let resizeTimer = 0;
  window.addEventListener("resize", function () {
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
    toastTimer = setTimeout(function () {
      toastEl.classList.remove("show");
    }, 1800);
  }

  function filledMap() {
    return blobs.map(Boolean);
  }

  function renderScore() {
    const score = scoreFromFilled(filledMap());
    ptsEl.textContent = pad2(score.total);
    sqEl.textContent = pad2(score.squares) + "/16";
    rowsEl.textContent = score.rows + "/4";

    for (let r = 0; r < SIZE; r++) {
      const complete = filledMap().slice(r * SIZE, r * SIZE + SIZE).every(Boolean);
      for (let c = 0; c < SIZE; c++) {
        const cell = boardEl.querySelector('[data-index="' + (r * SIZE + c) + '"]');
        if (cell) cell.classList.toggle("row-done", complete);
      }
    }
  }

  function setPhoto(index, blob) {
    if (urls[index]) URL.revokeObjectURL(urls[index]);
    blobs[index] = blob;
    urls[index] = blob ? URL.createObjectURL(blob) : null;
    const cell = boardEl.querySelector('[data-index="' + index + '"]');
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

    SQUARES.forEach(function (sq, i) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cell";
      btn.dataset.index = String(i);
      btn.setAttribute("role", "gridcell");
      btn.setAttribute("aria-label", coord(i) + ". " + (sq.tag ? "[" + sq.tag + "] " : "") + sq.text);

      btn.innerHTML =
        '<img class="photo" alt="" hidden />' +
        '<div class="cell-body">' +
          '<span class="prompt">' + sq.text + '</span>' +
          (sq.tag ? '<span class="tag">' + sq.tag + '</span>' : "") +
        '</div>';

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
    requestAnimationFrame(function () {
      sheetEl.classList.add("open");
    });
  }

  function ingestFile(file, index) {
    if (!file || !file.type.startsWith("image/")) {
      toast("Need an image file");
      return;
    }
    document.body.classList.add("busy");
    compressImage(file).then(function (blob) {
      return saveSquare({ id: index, blob: blob, ts: Date.now() }).then(function () {
        setPhoto(index, blob);
        toast("saved  " + coord(index));
      });
    }).catch(function (err) {
      console.error(err);
      toast("Could not save photo");
    }).finally(function () {
      document.body.classList.remove("busy");
    });
  }

  buildBoard();

  boardEl.addEventListener("click", function (e) {
    const cell = e.target.closest(".cell");
    if (!cell) return;
    const index = Number(cell.dataset.index);
    if (blobs[index]) openSheet(index);
    else openPicker(index);
  });

  boardEl.addEventListener("dragover", function (e) {
    if (e.target.closest(".cell")) e.preventDefault();
  });

  boardEl.addEventListener("drop", function (e) {
    const cell = e.target.closest(".cell");
    if (!cell) return;
    e.preventDefault();
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    ingestFile(file, Number(cell.dataset.index));
  });

  fileEl.addEventListener("change", function () {
    const file = fileEl.files && fileEl.files[0];
    const index = pending;
    closeSheet();
    if (index == null) return;
    ingestFile(file, index);
  });

  document.querySelector("#replace").addEventListener("click", function () {
    if (pending == null) return;
    openPicker(pending);
  });

  document.querySelector("#remove").addEventListener("click", function () {
    const index = pending;
    if (index == null) return;
    removeSquare(index).then(function () {
      setPhoto(index, null);
      toast("cleared  " + coord(index));
    }).catch(function () {
      toast("Could not remove");
    }).finally(closeSheet);
  });

  overlayEl.addEventListener("click", closeSheet);

  document.querySelector("#reset").addEventListener("click", function () {
    if (!confirm("Clear every square and photo?")) return;
    clearSquares().then(function () {
      blobs.forEach(function (_, i) { setPhoto(i, null); });
      toast("board reset");
    }).catch(function () {
      toast("Could not reset");
    });
  });

  document.querySelector("#export").addEventListener("click", function () {
    const btn = document.querySelector("#export");
    btn.disabled = true;
    btn.textContent = "Rendering…";
    exportBoard({
      filled: filledMap(),
      urls: urls,
      score: scoreFromFilled(filledMap()),
    }).then(function (blob) {
      const file = new File([blob], "innolaunch-bingo.png", { type: "image/png" });
      const canShare = navigator.canShare && navigator.canShare({ files: [file] });
      if (canShare) {
        return navigator.share({ files: [file], title: "InnoLaunch Bingo" });
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "innolaunch-bingo.png";
      a.click();
      URL.revokeObjectURL(a.href);
    }).then(function () {
      toast("board exported");
    }).catch(function (err) {
      if (!err || err.name !== "AbortError") {
        console.error(err);
        toast("Export failed");
      }
    }).finally(function () {
      btn.disabled = false;
      btn.textContent = "Export board";
    });
  });

  function init() {
    loadAll().then(function (saved) {
      saved.forEach(function (rec) {
        if (rec && rec.blob && rec.id >= 0 && rec.id < SIZE * SIZE) {
          setPhoto(rec.id, rec.blob);
        }
      });
      if (saved.length) toast("progress restored");
    }).catch(function (err) {
      console.error(err);
      toast("Storage unavailable");
    }).finally(function () {
      renderScore();
      document.fonts.ready.then(fitBrandTitle);
    });
  }

  init();
})();
