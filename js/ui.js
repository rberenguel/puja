export const heightScoreElement = document.getElementById("height-score");
export const precisionScoreElement = document.getElementById("precision-score");
export const instructionsElement = document.getElementById("instructions");
export const specialPaletteToastElement = document.getElementById(
  "special-palette-toast",
);

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

function triggerDownload(file) {
  const link = document.createElement("a");
  link.download = file.name;
  link.href = URL.createObjectURL(file);
  link.click();
  URL.revokeObjectURL(link.href);
}

export async function saveAsImage(renderer, stack) {
  let file;
  try {
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = renderer.domElement.width;
    exportCanvas.height = renderer.domElement.height;
    const ctx = exportCanvas.getContext("2d");

    ctx.drawImage(renderer.domElement, 0, 0);

    const height = stack.length;
    const scoreText = `${height.toLocaleString()}`;
    ctx.font = "bold 48px monoidregular";
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const textX = exportCanvas.width / 2;
    const textY = exportCanvas.height - 50;
    ctx.fillText(scoreText, textX, textY);

    const blob = await new Promise((resolve) =>
      exportCanvas.toBlob(resolve, "image/png"),
    );
    file = new File([blob], `puja-tower-${Date.now()}.png`, {
      type: "image/png",
    });

    const isMobile = "ontouchstart" in window || navigator.maxTouchPoints > 0;

    if (
      isMobile &&
      navigator.share &&
      navigator.canShare &&
      navigator.canShare({ files: [file] })
    ) {
      await navigator.share({
        files: [file],
        title: "Puja Tower",
      });
    } else {
      triggerDownload(file);
    }
  } catch (err) {
    if (err.name !== "AbortError") {
      console.error("Share API failed, attempting download fallback:", err);
      if (file) {
        triggerDownload(file);
      }
    }
  }
}
