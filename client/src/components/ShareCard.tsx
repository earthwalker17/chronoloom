/**
 * Deterministic 1080×1440 share-card PNG drawn with Canvas2D — no html2canvas.
 */
import type { LifeReport } from "@shared/types";

const W = 1080;
const H = 1440;

function drawVertical(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, gap: number) {
  ctx.font = `${size}px STKaiti, KaiTi, "Noto Serif CJK SC", serif`;
  [...text].forEach((ch, i) => ctx.fillText(ch, x, y + i * (size + gap)));
}

export function renderShareCard(report: LifeReport, identityNameZh: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");

  // paper + noise
  ctx.fillStyle = "#f2ead8";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(90, 82, 72, 0.05)";
  for (let i = 0; i < 2600; i++) {
    // deterministic scatter (no Math.random)
    const x = (i * 73) % W;
    const y = (i * 137 + Math.floor(i / 14) * 31) % H;
    ctx.fillRect(x, y, 2, 2);
  }

  // double cinnabar border
  ctx.strokeStyle = "#a23e2e";
  ctx.lineWidth = 6;
  ctx.strokeRect(46, 46, W - 92, H - 92);
  ctx.lineWidth = 2;
  ctx.strokeRect(64, 64, W - 128, H - 128);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // header
  ctx.fillStyle = "#8a8073";
  ctx.font = '26px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText("长 安 浮 生 · 命 书", W / 2, 130);

  // vertical headline
  ctx.fillStyle = "#a23e2e";
  const headline = report.shareCard.headlineZh.slice(0, 8);
  drawVertical(ctx, headline, W / 2, 280, 110, 26);

  // subline
  ctx.fillStyle = "#5a5248";
  ctx.font = '34px STKaiti, KaiTi, "Noto Serif CJK SC", serif';
  ctx.fillText(report.shareCard.sublineZh, W / 2, 280 + headline.length * 136 + 60);

  // divider
  const dy = 280 + headline.length * 136 + 120;
  ctx.strokeStyle = "#d3c4a5";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(180, dy);
  ctx.lineTo(W - 180, dy);
  ctx.stroke();

  // stat highlights
  ctx.fillStyle = "#2b2620";
  ctx.font = '36px "Songti SC", SimSun, serif';
  report.shareCard.statHighlightsZh.forEach((line, i) => {
    ctx.fillText(line, W / 2, dy + 80 + i * 70);
  });

  // identity line
  ctx.fillStyle = "#8a8073";
  ctx.font = '28px "PingFang SC", sans-serif';
  ctx.fillText(`身份 · ${identityNameZh}`, W / 2, dy + 80 + 3 * 70 + 30);

  // 镜中人 decision-style line (wrapped to the card width)
  ctx.fillStyle = "#5a5248";
  ctx.font = '26px STKaiti, KaiTi, "Noto Serif CJK SC", serif';
  const style = report.mirror.decisionStyleZh;
  const maxChars = 26;
  const lines = [style.slice(0, maxChars), style.slice(maxChars, maxChars * 2)].filter(Boolean);
  lines.forEach((line, i) => {
    ctx.fillText(line, W / 2, dy + 80 + 3 * 70 + 95 + i * 42);
  });

  // seal
  const sx = W - 250;
  const sy = H - 290;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(-0.05);
  ctx.strokeStyle = "#a23e2e";
  ctx.lineWidth = 6;
  ctx.strokeRect(-70, -70, 140, 140);
  ctx.fillStyle = "#a23e2e";
  ctx.font = '52px STKaiti, KaiTi, serif';
  const seal = report.shareCard.sealZh.slice(0, 4).padEnd(4, "印");
  ctx.fillText(seal.slice(0, 2), 0, -32);
  ctx.fillText(seal.slice(2, 4), 0, 34);
  ctx.restore();

  // footer
  ctx.fillStyle = "#8a8073";
  ctx.font = '24px "PingFang SC", sans-serif';
  ctx.fillText("时织 ChronoLoom · 活成另一个人", W / 2, H - 120);

  return canvas.toDataURL("image/png");
}

export function downloadShareCard(report: LifeReport, identityNameZh: string): void {
  const url = renderShareCard(report, identityNameZh);
  const a = document.createElement("a");
  a.href = url;
  a.download = "长安命书.png";
  a.click();
}
