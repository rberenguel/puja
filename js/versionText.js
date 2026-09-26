// Fading "puja" + version overlay painted onto the top face of the foundation
// block. Self-contained: attachVersionText adorns a layer's material and stashes
// state on layer.versionText; updateVersionText advances the fade each frame
// and cleans up when done.

const W = 512;
const H = 100;

function makeCanvas(text, xRatio, yRatio, fontSize, colorHex) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  return {
    canvas,
    draw(alpha) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = colorHex;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#000000";
      ctx.font = `${fontSize}px monoidregular`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, W * xRatio, H * yRatio);
      ctx.globalAlpha = 1.0;
    },
  };
}

export function attachVersionText(layer, appVersion) {
  const colorHex = `#${layer.threejs.material.color.getHexString()}`;
  const ver = makeCanvas(appVersion, 0.5, 0.6, "35", colorHex);
  const name = makeCanvas("puja", 0.49, 0.55, "65", colorHex);
  ver.draw(1.0);
  name.draw(1.0);

  const verTex = new THREE.CanvasTexture(ver.canvas);
  const nameTex = new THREE.CanvasTexture(name.canvas);
  const verMat = new THREE.MeshPhongMaterial({ map: verTex });
  const nameMat = new THREE.MeshPhongMaterial({ map: nameTex });
  const baseMat = layer.threejs.material;

  layer.threejs.material = [nameMat, baseMat, baseMat, baseMat, verMat, baseMat];
  layer.versionText = {
    mats: [verMat, nameMat],
    textures: [verTex, nameTex],
    draws: [ver.draw, name.draw],
    life: 1.0,
  };
}

export function updateVersionText(layer, deltaTime) {
  const vt = layer?.versionText;
  if (!vt) return;
  vt.life -= deltaTime / 3;
  if (vt.life <= 0) {
    const baseMat = layer.threejs.material[1];
    vt.mats.forEach((m) => {
      m.map.dispose();
      m.dispose();
    });
    layer.threejs.material = baseMat;
    layer.versionText = null;
    return;
  }
  vt.draws.forEach((draw, i) => {
    draw(vt.life);
    vt.textures[i].needsUpdate = true;
  });
}

export function disposeVersionText(layer) {
  if (!layer?.versionText) return;
  layer.versionText.mats.forEach((m) => {
    m.map.dispose();
    m.dispose();
  });
  layer.versionText = null;
}
