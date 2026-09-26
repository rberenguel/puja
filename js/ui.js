import {
  setSoundEnabled,
  isSoundEnabled,
  loadSoundPreference,
  setSound,
} from "./sound.js";

export const heightScoreElement = document.getElementById("height-score");
export const precisionScoreElement = document.getElementById("precision-score");
export const instructionsElement = document.getElementById("instructions");
export const specialPaletteToastElement = document.getElementById(
  "special-palette-toast",
);
export const muteToggleElement = document.getElementById("mute-toggle");

function renderMuteIcon() {
  if (!muteToggleElement) return;
  muteToggleElement.classList.remove("ph-speaker-high", "ph-speaker-slash");
  muteToggleElement.classList.add(
    isSoundEnabled() ? "ph-speaker-high" : "ph-speaker-slash",
  );
}

export function initMuteToggle() {
  if (!muteToggleElement) return;
  loadSoundPreference();
  renderMuteIcon();
  muteToggleElement.addEventListener("click", (e) => {
    e.stopPropagation();
    const next = !isSoundEnabled();
    setSoundEnabled(next);
    renderMuteIcon();
    if (next) setSound();
  });
  muteToggleElement.addEventListener("pointerdown", (e) => e.stopPropagation());
  muteToggleElement.addEventListener("pointerup", (e) => e.stopPropagation());
}

export function updateHeightScore(score) {
  heightScoreElement.innerText = score.toLocaleString();
}

export function updatePrecisionScore(score, color) {
  precisionScoreElement.innerText = score.toLocaleString();
  if (color) {
    precisionScoreElement.style.color = color;
  }
}

export function showInstructions(message) {
  instructionsElement.innerHTML = `<span>${message}</span>`;
  instructionsElement.style.display = "block";
}

export function hideInstructions() {
  instructionsElement.style.display = "none";
}

export function showEndGameMessage(message) {
  instructionsElement.innerHTML = `<span class="message">${message}</span><hr/><span class="restart">Click to restart.</span>`;
  instructionsElement.style.display = "block";
}

export function showSpecialPaletteToast(name) {
  specialPaletteToastElement.innerText = name;
  specialPaletteToastElement.style.display = "block";
  specialPaletteToastElement.classList.remove("fade-out");
  setTimeout(() => {
    specialPaletteToastElement.classList.add("fade-out");
  }, 100);
}

export function hideSpecialPaletteToast() {
  specialPaletteToastElement.style.display = "none";
}

export function saveAsImage(renderer, scene, camera, stack) {
  const towerHeight = stack.length * 2;
  const aspect = window.innerWidth / window.innerHeight;
  const capHeight = Math.max(40, towerHeight * 1.3);
  const capWidth = capHeight * aspect;

  const saved = { left: camera.left, right: camera.right, top: camera.top, bottom: camera.bottom };
  camera.left = capWidth / -2;
  camera.right = capWidth / 2;
  camera.top = capHeight / 2;
  camera.bottom = capHeight / -2;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = renderer.domElement.width;
  exportCanvas.height = renderer.domElement.height;
  const ctx = exportCanvas.getContext("2d");
  ctx.drawImage(renderer.domElement, 0, 0);

  Object.assign(camera, saved);
  camera.updateProjectionMatrix();

  ctx.font = "bold 48px monoidregular";
  ctx.fillStyle = "#FFFFFF";
  ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
  ctx.shadowBlur = 5;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${stack.length.toLocaleString()}`, exportCanvas.width / 2, exportCanvas.height - 50);

  exportCanvas.toBlob(async (blob) => {
    const file = new File([blob], `puja-tower-${Date.now()}.png`, { type: "image/png" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "Puja Tower" }); return; } catch {}
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = file.name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}
