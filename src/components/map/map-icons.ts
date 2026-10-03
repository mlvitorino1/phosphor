import type { SpecialMarker } from "@/lib/domain/marker-utils";

export function iconName(kind: SpecialMarker, level: string) {
  return `gem-${kind}-${level || "none"}`;
}
export function drawMapIcon(kind: SpecialMarker, level: string): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 88;
  const ctx = canvas.getContext("2d")!;
  const colors: Record<SpecialMarker, string> = {
    tornado: "#ff6b69",
    hurricane: "#66b9ff",
    earthquake: "#6cddf6",
    volcano: "#ffb75c",
    flood: "#55bff1",
    wildfire: "#ff8b4f",
    storm: "#b796ff",
    news: "#78e9c3",
  };
  const color = colors[kind];
  ctx.shadowColor = color;
  ctx.shadowBlur = 20;
  ctx.fillStyle = "#0b1516";
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(42, 42, 27, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (kind === "news") {
    ctx.fillStyle = "#e9fff3";
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(23, 23, 38, 39, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#0b2520";
    ctx.font = "800 10px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("NEWS", 42, 36);
    ctx.fillRect(28, 40, 28, 2);
    ctx.fillRect(28, 46, 12, 10);
    ctx.fillRect(43, 46, 13, 2);
    ctx.fillRect(43, 51, 13, 2);
    ctx.fillRect(43, 56, 9, 2);
  } else if (kind === "tornado") {
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(21, 29);
    ctx.bezierCurveTo(31, 23, 52, 25, 62, 29);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(26, 37);
    ctx.bezierCurveTo(37, 33, 47, 35, 57, 38);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(32, 45);
    ctx.bezierCurveTo(38, 43, 46, 44, 51, 46);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(47, 51);
    ctx.quadraticCurveTo(40, 54, 39, 63);
    ctx.stroke();
  } else if (kind === "earthquake") {
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(18, 45);
    ctx.lineTo(27, 45);
    ctx.lineTo(33, 36);
    ctx.lineTo(39, 55);
    ctx.lineTo(46, 26);
    ctx.lineTo(52, 45);
    ctx.lineTo(66, 45);
    ctx.stroke();
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(25, 59);
    ctx.lineTo(59, 59);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (kind === "volcano") {
    ctx.beginPath();
    ctx.moveTo(17, 58);
    ctx.lineTo(31, 41);
    ctx.lineTo(37, 47);
    ctx.lineTo(45, 31);
    ctx.lineTo(66, 58);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#17202a";
    ctx.beginPath();
    ctx.moveTo(35, 45);
    ctx.lineTo(45, 31);
    ctx.lineTo(52, 42);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#ffe2a3";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(44, 33);
    ctx.quadraticCurveTo(45, 25, 49, 22);
    ctx.stroke();
  } else if (kind === "hurricane") {
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(42, 42, 20, -1.35, 1.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(42, 42, 14, 1.8, 4.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(42, 42, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(46, 22);
    ctx.lineTo(57, 24);
    ctx.lineTo(60, 32);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(38, 62);
    ctx.lineTo(27, 60);
    ctx.lineTo(24, 52);
    ctx.stroke();
  } else if (kind === "flood") {
    ctx.lineWidth = 4;
    for (const y of [31, 42, 53]) {
      ctx.beginPath();
      ctx.moveTo(20, y);
      ctx.bezierCurveTo(28, y - 6, 35, y + 6, 43, y);
      ctx.bezierCurveTo(51, y - 6, 58, y + 6, 65, y);
      ctx.stroke();
    }
  } else if (kind === "wildfire") {
    ctx.beginPath();
    ctx.moveTo(43, 18);
    ctx.bezierCurveTo(47, 31, 60, 35, 59, 48);
    ctx.bezierCurveTo(58, 62, 48, 66, 40, 64);
    ctx.bezierCurveTo(24, 60, 23, 47, 31, 37);
    ctx.bezierCurveTo(33, 43, 34, 47, 37, 49);
    ctx.bezierCurveTo(42, 42, 43, 32, 43, 18);
    ctx.fill();
    ctx.fillStyle = "#ffd284";
    ctx.beginPath();
    ctx.moveTo(43, 42);
    ctx.bezierCurveTo(44, 48, 50, 51, 48, 57);
    ctx.bezierCurveTo(45, 63, 36, 61, 36, 55);
    ctx.bezierCurveTo(36, 50, 40, 47, 43, 42);
    ctx.fill();
  } else {
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(26, 46);
    ctx.bezierCurveTo(17, 44, 19, 33, 29, 32);
    ctx.bezierCurveTo(32, 19, 50, 20, 54, 31);
    ctx.bezierCurveTo(68, 30, 70, 46, 57, 47);
    ctx.lineTo(26, 47);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(44, 46);
    ctx.lineTo(36, 58);
    ctx.lineTo(45, 56);
    ctx.lineTo(39, 67);
    ctx.stroke();
  }
  if (level) {
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 7;
    ctx.fillStyle = "#0a1112";
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(65, 64, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${level.length > 2 ? 13 : 16}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(level, 65, 65);
  }
  return ctx.getImageData(0, 0, 88, 88);
}
