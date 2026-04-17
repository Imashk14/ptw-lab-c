let map = L.map('map').setView([53.430127, 14.564802], 18);
L.tileLayer.provider('Esri.WorldImagery').addTo(map);

const cols = 4;
const rows = 4;
const gap = 8;

const puzzleGrid = document.getElementById("mapGrid");

let tileOrder = [];
let tileImages = [];

let solutionOrder = Array(cols * rows).fill(null);
const solutionGrid = document.getElementById("solutionGrid");

function renderSolution() {
  if (!solutionGrid) {
    return;
  }

  solutionGrid.innerHTML = "";

  solutionOrder.forEach((tileId, slotIndex) => {
    const cell = document.createElement("div");
    cell.className = "solution-cell";
    cell.dataset.slotIndex = String(slotIndex);

    cell.addEventListener("dragover", (e) => {
      e.preventDefault();
    });

    cell.addEventListener("drop", (e) => {
      e.preventDefault();

      const draggedTileId = Number(e.dataTransfer.getData("tileId"));
      const from = e.dataTransfer.getData("from");
      const fromSlot = Number(e.dataTransfer.getData("fromSlot"));
      const toSlot = Number(cell.dataset.slotIndex);

      if (Number.isNaN(draggedTileId) || Number.isNaN(toSlot)) return;

      if (solutionOrder[toSlot] !== null) return;

      solutionOrder[toSlot] = draggedTileId;

      if (from === "puzzle" && !Number.isNaN(fromSlot)) {
        tileOrder[fromSlot] = null;
      } else if (from === "solution" && !Number.isNaN(fromSlot)) {
        solutionOrder[fromSlot] = null;
      }

      renderPuzzle();
      renderSolution();
      notifyWhenCorrect();
    });

    if (tileId !== null) {
      const img = document.createElement("img");
      img.className = "puzzle-tile";
      img.src = tileImages[tileId];
      img.draggable = true;
      cell.appendChild(img);

      img.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("from", "solution");
        e.dataTransfer.setData("fromSlot", String(slotIndex));
        e.dataTransfer.setData("tileId", String(tileId));
      })
    }

    solutionGrid.appendChild(cell);
  });
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function renderPuzzle() {
  if (!puzzleGrid) return;

  puzzleGrid.innerHTML = "";

  tileOrder.forEach((tileId, slotIndex) => {
    const cell = document.createElement("div");
    cell.className = "puzzle-cell";
    cell.dataset.slotIndex = String(slotIndex);

    cell.addEventListener("dragover", (e) => {
      e.preventDefault();
    });

    cell.addEventListener("drop", (e) => {
      e.preventDefault();

      const from = e.dataTransfer.getData("from");
      const fromSlot = Number(e.dataTransfer.getData("fromSlot"));
      const toSlot = Number(cell.dataset.slotIndex);

      if (Number.isNaN(fromSlot) || Number.isNaN(toSlot) || fromSlot === toSlot) return;

      [tileOrder[fromSlot], tileOrder[toSlot]] = [tileOrder[toSlot], tileOrder[fromSlot]];
      renderPuzzle();
      renderSolution();
      notifyWhenCorrect();
    });

    if (tileId !== null) {
      const img = document.createElement("img");
      img.className = "puzzle-tile";
      img.src = tileImages[tileId];
      img.draggable = true;
      img.dataset.slotIndex = String(slotIndex);

      img.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("tileId", String(tileId));
        e.dataTransfer.setData("from", "puzzle");
        e.dataTransfer.setData("fromSlot", String(slotIndex));
      });

      cell.appendChild(img);
    }

    puzzleGrid.appendChild(cell);
  });
}

document.getElementById("saveButton").addEventListener("click", function() {
  requestNotificationPermission();
  
  if (!puzzleGrid) {
    console.error("Puzzle grid element #mapGrid not found.");
    return;
  }

  leafletImage(map, function(err, canvas) {
    if (err) {
      console.error("Failed to export map image:", err);
      return;
    }

    const gridW = puzzleGrid.clientWidth || 512;
    const gridH = puzzleGrid.clientHeight || 512;
    const tileW = (gridW - gap * (cols - 1)) / cols;
    const tileH = (gridH - gap * (rows - 1)) / rows;

    const srcW = canvas.width / cols;
    const srcH = canvas.height / rows;


    tileImages = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const piece = document.createElement("canvas");
        piece.width = Math.round(tileW);
        piece.height = Math.round(tileH);
        const ctx = piece.getContext("2d");

        ctx.drawImage(
          canvas,
          x * srcW, y * srcH, srcW, srcH,
          0, 0, piece.width, piece.height
        );

        tileImages.push(piece.toDataURL("image/png"));
      }
    }

    tileOrder = Array.from({ length: cols * rows }, (_, i) => i);
    shuffle(tileOrder);
    solutionOrder = Array(cols * rows).fill(null);
    renderPuzzle();
    renderSolution();
  });
});

document.getElementById("getLocation").addEventListener("click", function() {
  if (!navigator.geolocation) {
    console.log("No geolocation.");
    return;
  }

  navigator.geolocation.getCurrentPosition(position => {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    console.log("Geolocation ok: ", {lat, lon});
    map.setView([lat, lon]);
  }, (err) => {
    console.log("Geolocation error: ", err.code, err.message);
  },{
    enableHighAccuracy: true,
    timeout: 5000,
    maximumAge: 0
  });
});

function checkIfCorrect() {
  if (solutionOrder.length !== cols * rows)  return false;

  for (let i = 0; i < solutionOrder.length; i++) {
    if (solutionOrder[i] === null) return false;
    if (solutionOrder[i] !== i) return false;
  }

  return true;
}

async function requestNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";

  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

function sendSystemNotification(title, body) {
  if (!("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;

  new Notification(title, {
    body
  });

  return true;
}

function notifyWhenCorrect() {
  if (!checkIfCorrect()) return;
  
  const sent = sendSystemNotification("Puzzle solved!", "You solved the puzzle!");
  if (!sent) {
    alert("You solved the puzzle!");
  }
}
