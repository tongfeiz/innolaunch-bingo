const COLS = ["A", "B", "C", "D"];
const SIZE = 4;

const SQUARES = [
  { tag: null, text: "Snipe an InnoMember on Campus and send to #irl" },
  { tag: "RETREAT", text: "Take a pic of a meal w/ your retreat car" },
  { tag: null, text: "Do a coffee chat w/ someone in your hex class" },
  { tag: "BONFIRE", text: "Take a selfie with your group's sandcastle" },
  { tag: "BONFIRE", text: "Take a pic of your group's Human Pictionary" },
  { tag: null, text: "Do a coffee chat and send to #irl" },
  { tag: "FIRST GM", text: "Take a pic w/ someone you sat next to at GM" },
  { tag: null, text: "Take a pic w/ a President or VP :p" },
  { tag: null, text: "Take a pic w/ a UI/UX Team GM" },
  { tag: "KICKBACK", text: "Take a pic w/ someone new you met at InnoKickback" },
  { tag: null, text: "Take a pic w/ a Media Team GM" },
  { tag: null, text: "Snipe an InnoMember on Campus and send to #irl" },
  { tag: "BONFIRE", text: "Take a pic w/ someone new you met at InnoBonfire" },
  { tag: null, text: "Do a coffee chat w/ someone in a different hex class" },
  { tag: "RETREAT", text: "Take a pic with your new fam" },
  { tag: null, text: "Take a pic w/ a Design Team GM" },
];

function coord(index) {
  return COLS[index % SIZE] + (Math.floor(index / SIZE) + 1);
}

function scoreFromFilled(filled) {
  const squares = filled.filter(Boolean).length;
  let lines = 0;
  for (let r = 0; r < SIZE; r++) {
    const start = r * SIZE;
    if (filled.slice(start, start + SIZE).every(Boolean)) lines += 1;
  }
  for (let c = 0; c < SIZE; c++) {
    let complete = true;
    for (let r = 0; r < SIZE; r++) {
      if (!filled[r * SIZE + c]) {
        complete = false;
        break;
      }
    }
    if (complete) lines += 1;
  }
  return { squares, lines, total: squares + lines * 5 };
}
