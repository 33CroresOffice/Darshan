import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import type { GateEntry } from "@/types/database";

export interface PrintTokenOptions {
  includePhoto: boolean;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return "—";
  try {
    return new Date(timeStr).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return timeStr;
  }
}

async function generateQRSvg(text: string): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const QRCode = require("qrcode");
    const svg: string = await QRCode.toString(text, {
      type: "svg",
      width: 220,
      margin: 2,
    });
    return svg;
  } catch {
    // fall through to inline generator
  }
  return generateQRSvgInline(text);
}

function generateQRSvgInline(text: string): string {
  // Reed-Solomon GF(256) tables
  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x; LOG[x] = i;
    x = x < 128 ? x << 1 : (x << 1) ^ 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];

  function mul(a: number, b: number) { return a && b ? EXP[LOG[a] + LOG[b]] : 0; }
  function rsRemainder(data: number[], poly: number[]) {
    const res = new Array(poly.length).fill(0);
    for (const byte of data) {
      const f = byte ^ res.shift()!;
      for (let i = 0; i < res.length; i++) res[i] ^= mul(poly[i], f);
      res.push(mul(poly[poly.length - 1], f));
    }
    return res;
  }

  // Version 3, ECC level M — supports up to 77 bytes
  const version = 3;
  const size = version * 4 + 17; // 29
  const ECPoly = [42,159,74,221,218,124,134,129,169,1,
    70,238,39,34,116,244,160,49,126,56,155,100];
  const dataCapacity = 44; // data codewords for V3-M
  const ecCount = 22;

  const bytes: number[] = [];
  const encoded = encodeURIComponent(text) === text
    ? text.split("").map(c => c.charCodeAt(0))
    : Array.from(new TextEncoder().encode(text));

  // Byte mode header
  bytes.push(0x40 | (encoded.length >> 4));
  bytes.push(((encoded.length & 0xf) << 4) | (encoded[0] >> 4));
  for (let i = 0; i < encoded.length - 1; i++) {
    bytes.push(((encoded[i] & 0xf) << 4) | (encoded[i + 1] >> 4));
  }
  bytes.push((encoded[encoded.length - 1] & 0xf) << 4);
  // terminator already in last nibble; pad
  const padBytes = [0xec, 0x11];
  while (bytes.length < dataCapacity) bytes.push(padBytes[(bytes.length - (encoded.length + 2)) % 2 === 0 ? 0 : 1]);

  const ec = rsRemainder(bytes.slice(0, dataCapacity), ECPoly);
  const allData = [...bytes.slice(0, dataCapacity), ...ec];

  // Build bit stream
  let bits = "";
  for (const b of allData) bits += b.toString(2).padStart(8, "0");

  // Matrix
  const M: (0 | 1 | -1)[][] = Array.from({ length: size }, () => new Array(size).fill(-1));

  function setFinder(r: number, c: number) {
    for (let dr = -1; dr <= 7; dr++) for (let dc = -1; dc <= 7; dc++) {
      const R = r + dr, C = c + dc;
      if (R < 0 || R >= size || C < 0 || C >= size) continue;
      const onBorder = dr === -1 || dr === 7 || dc === -1 || dc === 7;
      const inner = dr >= 1 && dr <= 5 && dc >= 1 && dc <= 5;
      M[R][C] = (onBorder || inner) ? 1 : 0;
    }
  }
  setFinder(0, 0); setFinder(0, size - 7); setFinder(size - 7, 0);

  // Alignment pattern (version 3: at row/col 22)
  const ap = 22;
  for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
    const R = ap + dr, C = ap + dc;
    if (M[R][C] === -1) M[R][C] = (Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0)) ? 1 : 0;
  }

  // Timing
  for (let i = 8; i < size - 8; i++) {
    if (M[6][i] === -1) M[6][i] = i % 2 === 0 ? 1 : 0;
    if (M[i][6] === -1) M[i][6] = i % 2 === 0 ? 1 : 0;
  }

  // Dark module
  M[size - 8][8] = 1;

  // Format info (mask 0, ECL M = 0b00, mask 000 → raw 0b0000_0, apply mask 101010000010010)
  const fmtMask = 0b101010000010010;
  const fmtRaw = 0b00000; // ECL M (00) + mask 0 (000)
  // Generate BCH for format
  let rem = fmtRaw << 10;
  for (let i = 14; i >= 10; i--) if (rem & (1 << i)) rem ^= 0x537 << (i - 10);
  const fmtFull = ((fmtRaw << 10) | rem) ^ fmtMask;
  const fmtBits = fmtFull.toString(2).padStart(15, "0").split("").map(Number);
  const fmtPos1 = [0,1,2,3,4,5,7,8];
  const fmtPos2 = [size-1,size-2,size-3,size-4,size-5,size-6,size-7,size-8];
  for (let i = 0; i < 8; i++) {
    M[8][fmtPos1[i]] = fmtBits[i] as 0|1;
    M[fmtPos1[i]][8] = fmtBits[14 - i] as 0|1;
    M[8][fmtPos2[i]] = fmtBits[14 - i] as 0|1;
    M[fmtPos2[i]][8] = fmtBits[i] as 0|1;
  }

  // Data placement (zigzag, mask pattern 0: (r+c)%2==0)
  let bitIdx = 0;
  let up = true;
  for (let col = size - 1; col >= 0; col -= 2) {
    if (col === 6) col--;
    for (let row = up ? size - 1 : 0; up ? row >= 0 : row < size; up ? row-- : row++) {
      for (let dc = 0; dc <= 1; dc++) {
        const c = col - dc;
        if (M[row][c] !== -1) continue;
        const bit = bitIdx < bits.length ? parseInt(bits[bitIdx++]) : 0;
        const masked = (row + c) % 2 === 0 ? bit ^ 1 : bit;
        M[row][c] = masked as 0 | 1;
      }
    }
    up = !up;
  }

  // Render SVG
  const cell = 10;
  const quiet = 4;
  const total = (size + quiet * 2) * cell;
  let rects = "";
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (M[r][c] === 1) {
        const x = (c + quiet) * cell;
        const y = (r + quiet) * cell;
        rects += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="#000"/>`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="220" height="220" style="display:block">${rects}</svg>`;
}

export async function buildTokenHTML(entry: GateEntry, options: PrintTokenOptions): Promise<string> {
  const sebayat = entry.sebayat as Record<string, unknown> | null | undefined;
  const slot = entry.slot as Record<string, unknown> | null | undefined;

  const sebayatName = (sebayat?.full_name as string | undefined) ?? "—";
  const slotName = (slot?.name as string | undefined) ?? null;
  const photoUrl = (sebayat?.photo_url as string | undefined) ?? null;

  const devotees = entry.verified_devotee_count ?? entry.declared_devotee_count;
  const date = formatDate(entry.entry_date);
  const westTime = formatTime(entry.west_gate_entry_time);
  const innerTime = entry.inner_gate_verification_time
    ? formatTime(entry.inner_gate_verification_time)
    : null;

  const validUntil = (() => {
    if (!entry.expires_at) return null;
    try {
      return new Date(entry.expires_at).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return null;
    }
  })();

  const qrSvg = await generateQRSvg(entry.entry_code);

  const photoHTML =
    options.includePhoto && photoUrl
      ? `<img src="${photoUrl}" class="photo" alt="" />`
      : "";

  const extraRows = [
    `<div class="row"><span class="label">Sebayat</span><span class="value name-val">${sebayatName}</span></div>`,
    entry.west_gate_entry_time ? `<div class="row"><span class="label">West Gate</span><span class="value">${westTime}</span></div>` : "",
    innerTime ? `<div class="row"><span class="label">Inner Gate</span><span class="value">${innerTime}</span></div>` : "",
    slotName ? `<div class="row"><span class="label">Slot</span><span class="value">${slotName}</span></div>` : "",
    `<div class="row"><span class="label">Date</span><span class="value">${date}</span></div>`,
  ].filter(Boolean).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Token ${entry.entry_code}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
      background: #f0f0f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: #fff;
      border-radius: 28px;
      padding: 36px 28px 28px;
      max-width: 360px;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-shadow: 0 8px 40px rgba(0,0,0,0.12);
    }
    .check-circle {
      width: 68px;
      height: 68px;
      border-radius: 50%;
      background: #DCFCE7;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 18px;
    }
    .photo {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid #E2E8F0;
      margin-bottom: 12px;
    }
    h1 {
      font-size: 22px;
      font-weight: 800;
      color: #0F172A;
      margin-bottom: 4px;
      text-align: center;
    }
    .subtitle {
      font-size: 14px;
      color: #64748B;
      margin-bottom: 24px;
      text-align: center;
    }
    .qr-wrap {
      width: 220px;
      height: 220px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
      background: #fff;
    }
    .code {
      font-size: 38px;
      font-weight: 900;
      color: #0F172A;
      letter-spacing: 7px;
      margin-bottom: 8px;
      text-align: center;
    }
    .devotees {
      font-size: 16px;
      color: #475569;
      margin-bottom: 4px;
      text-align: center;
    }
    .valid {
      font-size: 15px;
      font-weight: 700;
      color: #D97706;
      margin-bottom: 24px;
      text-align: center;
    }
    .divider {
      width: 100%;
      height: 1px;
      background: #F1F5F9;
      margin-bottom: 16px;
    }
    .rows { width: 100%; }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 9px 0;
      border-bottom: 1px solid #F8FAFC;
    }
    .label { font-size: 13px; color: #94A3B8; }
    .value { font-size: 13px; font-weight: 700; color: #0F172A; max-width: 200px; text-align: right; }
    .name-val { font-size: 14px; color: #1e7a6e; }
    @media print {
      body { background: #fff; padding: 0; }
      .card { box-shadow: none; border-radius: 0; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="check-circle">
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none"
           stroke="#16A34A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </div>
    ${photoHTML}
    <h1>Entry Token</h1>
    <p class="subtitle">Show this QR code at the ${slotName ? slotName : "Gate"}</p>

    <div class="qr-wrap">${qrSvg}</div>

    <div class="code">${entry.entry_code}</div>
    <div class="devotees">${devotees} devotee${devotees !== 1 ? "s" : ""}</div>
    ${validUntil ? `<div class="valid">Valid until ${validUntil}</div>` : `<div class="valid">${date}</div>`}

    <div class="divider"></div>
    <div class="rows">${extraRows}</div>
  </div>
</body>
</html>`;
}

export async function printGateToken(
  entry: GateEntry,
  options: PrintTokenOptions
): Promise<{ success: boolean; message: string }> {
  try {
    const html = await buildTokenHTML(entry, options);
    await Print.printAsync({ html });
    return { success: true, message: "Print dialog opened" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Print failed";
    return { success: false, message: msg };
  }
}

export async function shareGateTokenPDF(
  entry: GateEntry,
  options: PrintTokenOptions
): Promise<{ success: boolean; message: string }> {
  try {
    const html = await buildTokenHTML(entry, options);
    const { uri } = await Print.printToFileAsync({ html });

    if (Platform.OS === "web") {
      const link = document.createElement("a");
      link.href = uri;
      link.download = `token-${entry.entry_code}.pdf`;
      link.click();
    } else {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: `Share Entry Token — ${entry.entry_code}`,
        });
      } else {
        return { success: false, message: "Sharing is not available on this device" };
      }
    }
    return { success: true, message: "PDF shared" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Share failed";
    return { success: false, message: msg };
  }
}
