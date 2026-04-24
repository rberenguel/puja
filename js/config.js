export const nihilisticMessages = [
  "Don't wish it were easier, wish you were better",
  "Don't wish it were easier, wish you were better",
  "Look on my Works, ye Mighty, and… despair?",
  "You are the tower: transient and futile.",
  "Each block, perfectly placed for nothing.",
  "Your final block will fail. It is so.",
  "Each perfect placement is a step towards the void.",
  "This monument to vanity will crumble.",
  "The abyss doesn't care about your score.",
  "A perfect stack is just a prettier ruin.",
  "You build, it falls. The universe is indifferent.",
  "How many times will you keep trying this?",
  "Every click echoes in an empty universe.",
  "This tower is a monument to… What?",
  "There is no prize at the top.",
  "Another brick on the wall of pointlessness.",
  "Well done. You have achieved nothing of substance.",
  "And so, Sisyphus pushes his block.",
];

export const allPalettes = {
  default: {
    background: "#000015",
    colors: (layer) => `hsl(${30 + layer * 4}, 90%, 60%)`,
  },
};

// --- Seasonal palettes (not currently active) ---
// halloween: {
//   name: "Halloween!",
//   palette: {
//     background: "#775555",
//     colors: (layer) => {
//       const colors = ["#FF7F00", "#9932CC", "#000000", "#FDFD96"];
//       return colors[layer % colors.length];
//     },
//   },
// },
// christmas: {
//   name: "Christmas!",
//   palette: {
//     background: "#dcf0dc",
//     colors: (layer) => {
//       const colors = ["#D10000", "#008A00", "#FFFFFF", "#FFD700"];
//       return colors[layer % colors.length];
//     },
//   },
// },
