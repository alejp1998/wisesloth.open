// ============================================================================
// WiseSloth.open — test export to PDF / DOCX
// Generates a clean, branded document: title banner, question list, answer key.
// API (kept stable): formatCorrectOptions, generateDateString,
// generateLastModifiedString, generatePDF(test), generateDOCX(test),
// downloadPDF(test), downloadDOCX(test)
// ============================================================================

// Brand palette (RGB 0..1 tuples for PDFLib)
const WS_BRAND = {
  blue: [0.1, 0.47, 0.78],      // #1A78C7
  dark: [0.13, 0.15, 0.18],
  grey: [0.45, 0.48, 0.52],
  lightGrey: [0.62, 0.64, 0.68],
  green: [0.1, 0.6, 0.35],
};

// Function to convert numerical options to letters
function formatCorrectOptions(correctOpts) {
  return correctOpts
    .split(",")
    .map((opt) => String.fromCharCode(64 + parseInt(opt.trim()))) // Convert '1' to 'A', '2' to 'B', etc.
    .join(", ");
}

// ============================================================================
// WINANSI SANITIZER
// pdf-lib's standard fonts (Helvetica etc.) use the WinAnsi encoding, which
// cannot represent Unicode math/typographic symbols (≥ ≤ ≠ ≈ √ ∞ π …). Math
// inside $...$ is rendered as images, but plain-text occurrences of these
// characters make widthOfTextAtSize/drawText throw. Map them to ASCII
// equivalents before drawing; anything else exotic falls back to '?'.
// ============================================================================
const WINANSI_MAP = {
  "\u2265": ">=", // ≥
  "\u2264": "<=", // ≤
  "\u2260": "!=", // ≠
  "\u2248": "~",  // ≈
  "\u2245": "~",  // ≅
  "\u221A": "sqrt", // √
  "\u221E": "inf",  // ∞
  "\u03C0": "pi",   // π
  "\u00D7": "x",    // ×
  "\u00F7": "/",    // ÷
  "\u00B1": "+/-",  // ±
  "\u2212": "-",    // − (minus)
  "\u2192": "->",   // →
  "\u2190": "<-",   // ←
  "\u21D2": "=>",   // ⇒
  "\u2026": "...",  // …
  "\u2014": "--",   // —
  "\u2013": "-",    // –
  "\u2018": "'",    // ‘
  "\u2019": "'",    // ’
  "\u201C": '"',    // “
  "\u201D": '"',    // ”
  "\u00A0": " ",    // nbsp
  "\u2009": " ",    // thin space
  "\u2022": "-",    // • (bullet; WinAnsi actually has it, but keep it simple)
  "\u00B0": "deg",  // °
  "\u00BC": "1/4",  // ¼
  "\u00BD": "1/2",  // ½
  "\u00BE": "3/4",  // ¾
  "\u20AC": "EUR",  // €
};

function sanitizeWinAnsi(str) {
  if (!str) return str;
  let out = "";
  for (const ch of String(str)) {
    out += WINANSI_MAP[ch] !== undefined ? WINANSI_MAP[ch] : ch;
  }
  return out;
}

// ============================================================================
// MATH RENDERING (frontend-only)
// Quiz text stores LaTeX math as $...$, $$...$$ or \(...\) (same delimiters
// MathJax uses on the site). For exports we typeset each formula with
// MathJax's SVG output inside a hidden iframe, rasterize it to a crisp 2x
// PNG (baseline-padded), and embed those images inline in the PDF/DOCX.
// Falls back to plain text if MathJax can't load.
// ============================================================================
const WSMath = (() => {
  let rendererPromise = null;
  const pngCache = new Map(); // latex -> { dataUrl, wPx, hPx, depthPx }

  function ensureRenderer() {
    if (rendererPromise) return rendererPromise;
    rendererPromise = new Promise((resolve, reject) => {
      try {
        const iframe = document.createElement("iframe");
        iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:10px;height:10px;border:0;";
        document.body.appendChild(iframe);
        const idoc = iframe.contentDocument;
        idoc.open();
        idoc.write(
          '<!DOCTYPE html><html><head>' +
          '<script>window.MathJax = { svg: { fontCache: "none" } };</script>' +
          '<script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>' +
          "</head><body></body></html>"
        );
        idoc.close();
        const check = () => {
          try {
            const w = iframe.contentWindow;
            if (w.MathJax && w.MathJax.startup && w.MathJax.startup.promise) {
              w.MathJax.startup.promise.then(() => resolve(iframe)).catch(reject);
              return;
            }
          } catch (e) { /* not ready yet */ }
          setTimeout(check, 60);
        };
        check();
      } catch (e) { reject(e); }
    });
    return rendererPromise;
  }

  // Render one LaTeX formula -> PNG data URL + dimensions at 16px em.
  // colorHex (#rrggbb) tints the glyphs to match surrounding text; the raster
  // canvas stays white so exports keep a clean background.
  // Returns depthPx = how far the formula's baseline sits above the PNG's bottom
  // edge (MathJax's vertical-align in ex, converted via the SVG's own px-per-ex).
  async function render(latex, colorHex = "#000000") {
    const cacheKey = latex + "|" + colorHex;
    if (pngCache.has(cacheKey)) return pngCache.get(cacheKey);
    const iframe = await ensureRenderer();
    const idoc = iframe.contentDocument;
    const mjx = iframe.contentWindow.MathJax.tex2svg(latex, { display: false });
    const svgEl = mjx.querySelector("svg");
    if (!svgEl) throw new Error("No SVG for: " + latex);

    // Tint glyphs (MathJax strokes/fills use currentColor)
    svgEl.setAttribute("color", colorHex);

    // Depth below the baseline: MathJax styles the svg with vertical-align: -X.XXXex.
    // Convert ex -> px using the svg's own width attribute (in ex) vs its rendered px.
    const style = svgEl.getAttribute("style") || "";
    const vaMatch = style.match(/vertical-align:\s*(-?[\d.]+)ex/);
    const vaEx = vaMatch ? parseFloat(vaMatch[1]) : 0;
    const widthAttrEx = parseFloat(svgEl.getAttribute("width")) || 1;

    // Measure at 16px em, then rasterize at 2x
    const container = idoc.createElement("div");
    container.style.cssText = "position:fixed;left:0;top:0;font-size:16px;line-height:0;";
    idoc.body.appendChild(container);
    container.appendChild(svgEl);
    const rect = svgEl.getBoundingClientRect();
    const pxPerEx = rect.width / widthAttrEx;
    const depthPx = Math.abs(vaEx) * pxPerEx;
    const scale = 2;
    svgEl.setAttribute("width", (rect.width * scale) + "px");
    svgEl.setAttribute("height", (rect.height * scale) + "px");
    const svgStr = new XMLSerializer().serializeToString(svgEl);
    container.removeChild(svgEl);
    container.remove();

    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = () => rej(new Error("SVG rasterize failed"));
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);
    });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(rect.width * scale);
    canvas.height = Math.ceil(rect.height * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Bottom-crop to ink for DOCX: find the lowest non-white row so the image's
    // bottom edge equals the formula baseline (descenders like "y" keep a tiny
    // margin, but fractions' denominators sit exactly on the baseline).
    let cropBottom = canvas.height;
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let y = canvas.height - 1; y >= 0; y--) {
      let hasInk = false;
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        if (imgData[i] < 240 || imgData[i + 1] < 240 || imgData[i + 2] < 240) {
          hasInk = true;
          break;
        }
      }
      if (hasInk) { cropBottom = y + 1; break; }
    }
    // Keep a 1px breathing room below the deepest ink (anti-aliasing).
    cropBottom = Math.min(canvas.height, cropBottom + 2 * scale);

    const result = {
      dataUrl: canvas.toDataURL("image/png"),
      wPx: Math.round(rect.width),
      hPx: Math.round(rect.height),
      depthPx,
      // DOCX: cropped to ink so the image's bottom edge = the formula baseline
      // (Word aligns inline image bottoms to the text baseline).
      cropDataUrl: null,
      cropHPx: 0,
    };
    if (cropBottom < canvas.height) {
      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = canvas.width;
      cropCanvas.height = cropBottom;
      const cctx = cropCanvas.getContext("2d");
      cctx.fillStyle = "#ffffff";
      cctx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
      cctx.drawImage(canvas, 0, 0);
      result.cropDataUrl = cropCanvas.toDataURL("image/png");
      result.cropHPx = Math.round(cropBottom / scale);
    }
    pngCache.set(cacheKey, result);
    return result;
  }

  // Split mixed text into runs: {type:'text', value} | {type:'math', value}
  function split(text) {
    const runs = [];
    const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)/g;
    let last = 0;
    let m;
    while ((m = re.exec(String(text ?? ""))) !== null) {
      if (m.index > last) runs.push({ type: "text", value: text.slice(last, m.index) });
      runs.push({ type: "math", value: (m[1] || m[2] || m[3] || "").trim() });
      last = m.index + m[0].length;
    }
    if (last < String(text ?? "").length) runs.push({ type: "text", value: text.slice(last) });
    return runs.length ? runs : [{ type: "text", value: String(text ?? "") }];
  }

  // dataUrl -> Uint8Array (for pdf-lib embedPng / docx ImageRun)
  function dataUrlToBytes(dataUrl) {
    const b64 = dataUrl.split(",")[1];
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  return { render, split, dataUrlToBytes };
})();

// Function to generate date string like "DD-MM-YY_HH-MM"
function generateDateString() {
  const date = new Date(testToDownload.latestQuizUpdatedAt);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}-${month}-${year}_${hours}-${minutes}`;
}

// Generate last modified date string in natural format
function generateLastModifiedString() {
  const date = new Date(testToDownload.latestQuizUpdatedAt);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}-${month}-${year} ${hours}:${minutes}`;
}

// Helper: strip an "Answer: ..." prefix and/or the "[Exp]" explanation marker
// from opt6 (stored in either order, e.g. "[Exp] Answer: ..."). The web UI
// strips "[Exp]" with substring(5); exports must do the same.
function cleanExplanation(opt6) {
  if (typeof opt6 !== "string") return "";
  let s = opt6;
  const prefixRe = /^(?:\[Exp\]|Answer\s*:)\s*/i;
  let changed = true;
  while (changed && s) {
    changed = false;
    const m = s.match(prefixRe);
    if (m) {
      s = s.slice(m[0].length);
      changed = true;
    }
  }
  return s.trim();
}

// An option field whose value is an explanation rather than a real option
// (the AI stores explanations as "[Exp]..." in opt6 — and occasionally in an
// option slot). The web UI skips these; exports must too.
function isExplanationOption(value) {
  return typeof value === "string" && value.trim().startsWith("[Exp]");
}

// ----------------------------------------------------------------------------
// INLINE MARKDOWN → STYLED SEGMENTS
// Quiz content is authored as Markdown (rendered client-side with marked.js).
// Exports used to ship the raw markers (** etc.) in PDFs/DOCX. This parser
// splits a text run into styled segments so exports can render real bold /
// italic instead of literal asterisks. Math $...$ runs are split FIRST by
// WSMath.split, so LaTeX content never passes through here.
//   **bold**  *italic*  `code`  ~~strike~~  [label](url)
// Underscore emphasis is deliberately NOT supported (breaks LaTeX subscripts).
// ----------------------------------------------------------------------------
const MD_STYLE_RE =
  /\*\*([^*]+?)\*\*|\*([^*\s][^*]*?)\*|`([^`]+?)`|~~([^~]+?)~~|\[([^\]]+?)\]\([^)]*?\)/g;

function splitMarkdownStyles(text) {
  const src = String(text ?? "");
  const out = [];
  let last = 0;
  MD_STYLE_RE.lastIndex = 0;
  let m;
  while ((m = MD_STYLE_RE.exec(src)) !== null) {
    if (m.index > last) out.push({ text: src.slice(last, m.index), bold: false, italics: false, strike: false, code: false });
    if (m[1] !== undefined) out.push({ text: m[1], bold: true, italics: false, strike: false, code: false });
    else if (m[2] !== undefined) out.push({ text: m[2], bold: false, italics: true, strike: false, code: false });
    else if (m[3] !== undefined) out.push({ text: m[3], bold: false, italics: false, strike: false, code: true });
    else if (m[4] !== undefined) out.push({ text: m[4], bold: false, italics: false, strike: true, code: false });
    else if (m[5] !== undefined) out.push({ text: m[5], bold: false, italics: false, strike: false, code: false });
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push({ text: src.slice(last), bold: false, italics: false, strike: false, code: false });
  return out;
}

// ============================================================================
// PDF GENERATION
// ============================================================================
async function generatePDF(test) {
  try {
    const pdfDoc = await PDFLib.PDFDocument.create();

    // Fonts
    const lightFont = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const italicFont = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaOblique);
    const boldItalicFont = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBoldOblique);

    // Map (base style, markdown segment style) -> font
    const pickFont = (base, seg) => {
      const b = base.bold || seg.bold;
      const i = base.italics || seg.italics;
      if (b && i) return boldItalicFont;
      if (b) return boldFont;
      if (i) return italicFont;
      return lightFont;
    };

    const PAGE_W = 612;   // US Letter
    const PAGE_H = 792;
    const MARGIN = 50;
    const CONTENT_W = PAGE_W - MARGIN * 2;

    let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    let yPosition = PAGE_H - MARGIN;

    // Cache of embedded math PNGs (pdf-lib image objects)
    const mathImageCache = new Map();

    // Render a math run to a pdf-lib image + metrics at the target font size.
    // png metrics are measured at 16px em = 12pt exactly (96dpi); PDF text is
    // drawn at fontSize pt, so scale = fontSize/12 (1px @96dpi = 0.75pt).
    // color: pdf-lib RGB object ({red,green,blue} in 0..1) -> hex for the glyphs.
    // depthPt = formula baseline's distance above the image bottom edge; the image
    // is drawn with its bottom at (textBaseline - depthPt) so the formula's own
    // baseline lands exactly on the text baseline (matches MathJax's inline layout).
    function colorToHex(color) {
      if (!color) return "#000000";
      const toHex = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0");
      return "#" + toHex(color.red) + toHex(color.green) + toHex(color.blue);
    }
    async function getMathImage(latex, fontSize, color) {
      const hex = colorToHex(color);
      const cacheKey = latex + "|" + fontSize + "|" + hex;
      if (mathImageCache.has(cacheKey)) return mathImageCache.get(cacheKey);
      const m = await WSMath.render(latex, hex);
      const pngBytes = WSMath.dataUrlToBytes(m.dataUrl);
      const img = await pdfDoc.embedPng(pngBytes);
      const scale = fontSize / 12;
      const entry = {
        img,
        wPt: m.wPx * 0.75 * scale,
        hPt: m.hPx * 0.75 * scale,
        depthPt: m.depthPx * 0.75 * scale,
      };
      mathImageCache.set(cacheKey, entry);
      return entry;
    }

    // --- run-based text drawing --------------------------------------------
    // Draws a string that may contain $...$ math inline AND markdown styles
    // (**bold**, *italic*, `code`, ~~strike~~, [label](url)). Returns new yPosition.
    const drawWrappedRuns = async (text, x, startingPosition, font, fontSize, color, lineHeight = 15, maxWidth = CONTENT_W, baseStyle) => {
      // Base style for this call: derived from the font argument unless overridden
      // (questions/answers pass boldFont, descriptions/explanations pass italicFont).
      const base = baseStyle || (font === boldFont ? { bold: true } : font === italicFont ? { italics: true } : {});
      const runs = WSMath.split(sanitizeWinAnsi(text));
      // Normalize literal "\n" (2-char backslash+n, from double-escaped AI JSON)
      // to real newlines in TEXT runs only — math runs are already separated,
      // so \nu / \nabla / \neq inside $...$ stay intact.
      for (const run of runs) {
        if (run.type === "text") run.value = String(run.value).replace(/\\n/g, "\n");
      }
      // Pre-resolve math images (tinted to match the surrounding text color)
      const resolved = [];
      for (const run of runs) {
        if (run.type === "math") {
          try { resolved.push({ type: "math", img: await getMathImage(run.value, fontSize, color) }); }
          catch (e) { resolved.push({ type: "text", value: run.value, seg: { bold: false, italics: false, strike: false, code: false } }); }
        } else {
          for (const seg of splitMarkdownStyles(run.value)) {
            resolved.push({ type: "text", value: seg.text, seg });
          }
        }
      }

      let y = startingPosition;
      let lineX = x;
      const words = [];
      for (const run of resolved) {
        if (run.type === "math") {
          words.push({ kind: "math", img: run.img });
        } else {
          const runFont = pickFont(base, run.seg);
          // keep words + spaces; split on spaces preserving them; a literal
          // newline (\n) becomes a forced line break
          const parts = String(run.value).split(/(\s+)/).filter((s) => s !== "");
          for (const p of parts) {
            if (p.includes("\n")) {
              const pieces = p.split("\n");
              for (let i = 0; i < pieces.length; i++) {
                if (pieces[i] !== "") {
                  words.push({ kind: "text", value: pieces[i], w: runFont.widthOfTextAtSize(pieces[i], fontSize), font: runFont });
                }
                if (i < pieces.length - 1) words.push({ kind: "break" });
              }
            } else {
              words.push({ kind: "text", value: p, w: runFont.widthOfTextAtSize(p, fontSize), font: runFont });
            }
          }
        }
      }

      const flushLine = () => {
        if (y < MARGIN) {
          page = pdfDoc.addPage([PAGE_W, PAGE_H]);
          y = PAGE_H - MARGIN;
        }
        let cursor = lineX;
        for (const w of lineWords) {
          if (w.kind === "text") {
            page.drawText(w.value, { x: cursor, y, size: fontSize, color, font: w.font });
            cursor += w.w;
          } else {
            // The formula's own baseline sits depthPt above the image's bottom edge;
            // draw with bottom at (textBaseline - depthPt) so it aligns with the text.
            page.drawImage(w.img.img, {
              x: cursor,
              y: y - w.img.depthPt,
              width: w.img.wPt,
              height: w.img.hPt,
            });
            cursor += w.img.wPt;
          }
        }
        y -= lineHeight;
        lineX = x;
      };

      let lineWords = [];
      let lineWidth = 0;
      for (const w of words) {
        if (w.kind === "break") {
          if (lineWords.length > 0) flushLine();
          lineWords = [];
          lineWidth = 0;
          continue;
        }
        const ww = w.kind === "math" ? w.img.wPt : w.w;
        if (lineWidth + ww > maxWidth && lineWords.length > 0) {
          flushLine();
          lineWords = [];
          lineWidth = 0;
          // trim leading space on a fresh line
          if (w.kind === "text" && /^\s+$/.test(w.value)) continue;
        }
        lineWords.push(w);
        lineWidth += ww;
      }
      if (lineWords.length > 0) flushLine();
      return y;
    };

    const ensureSpace = (needed) => {
      if (yPosition < needed) {
        page = pdfDoc.addPage([PAGE_W, PAGE_H]);
        yPosition = PAGE_H - MARGIN;
      }
    };

    // --- branded title banner -----------------------------------------------
    const bannerH = 92;
    page.drawRectangle({
      x: 0,
      y: PAGE_H - bannerH,
      width: PAGE_W,
      height: bannerH,
      color: PDFLib.rgb(...WS_BRAND.blue),
    });

    const titleFontSize = test.name.length > 60 ? 20 : 24;
    const titleLines = PDFLib.layoutMultilineText(sanitizeWinAnsi(String(test.name)), {
      alignment: "left",
      font: boldFont,
      fontSize: titleFontSize,
      lineHeight: titleFontSize + 6,
      bounds: { width: PAGE_W - MARGIN * 2, height: bannerH - 30 },
    });
    let bannerY = PAGE_H - 30;
    titleLines.lines.forEach((line) => {
      // Title supports markdown styles too: draw each segment with its own font
      let tx = MARGIN;
      for (const seg of splitMarkdownStyles(sanitizeWinAnsi(line.text).replace(/\\n/g, "\n"))) {
        const segFont = pickFont({ bold: true }, seg);
        page.drawText(seg.text, {
          x: tx,
          y: bannerY,
          size: titleFontSize,
          color: PDFLib.rgb(1, 1, 1),
          font: segFont,
        });
        tx += segFont.widthOfTextAtSize(seg.text, titleFontSize);
      }
      bannerY -= titleFontSize + 6;
    });

    // Meta line inside banner
    page.drawText(sanitizeWinAnsi(`By ${test.author?.username || "Unknown"}  •  Last modified: ${generateLastModifiedString()}`), {
      x: MARGIN,
      y: PAGE_H - bannerH + 16,
      size: 10,
      color: PDFLib.rgb(0.85, 0.92, 1),
      font: lightFont,
    });

    // Body starts under the banner
    yPosition = PAGE_H - bannerH - 24;

    // Watermark
    yPosition = await drawWrappedRuns(
      "Thoughtfully generated with WiseSloth.open, powered by AI.",
      MARGIN, yPosition, lightFont, 11, PDFLib.rgb(...WS_BRAND.grey), 15
    );
    yPosition -= 8;

    // Description (if any)
    if (test.desc) {
      ensureSpace(60);
      yPosition = await drawWrappedRuns(String(test.desc), MARGIN, yPosition, italicFont, 11, PDFLib.rgb(...WS_BRAND.dark), 15);
      yPosition -= 12;
    }

    // Separator line
    ensureSpace(30);
    page.drawRectangle({ x: MARGIN, y: yPosition + 4, width: CONTENT_W, height: 0.8, color: PDFLib.rgb(...WS_BRAND.lightGrey) });
    yPosition -= 16;

    // --- questions ----------------------------------------------------------
    for (const quiz of test.quizzes) {
      const index = test.quizzes.indexOf(quiz);
      ensureSpace(90);
      // Question number + text
      yPosition = await drawWrappedRuns(`${index + 1}. ${quiz.question}`, MARGIN, yPosition, boldFont, 12, PDFLib.rgb(...WS_BRAND.dark), 17);
      yPosition -= 6;

      // Options, indented (skip [Exp] explanation slots — parity with the UI)
      for (const [idx, opt] of ["opt1", "opt2", "opt3", "opt4", "opt5"].entries()) {
        if (quiz[opt] && !isExplanationOption(quiz[opt])) {
          yPosition = await drawWrappedRuns(`${String.fromCharCode(65 + idx)}.  ${quiz[opt]}`, MARGIN + 22, yPosition, lightFont, 11.5, PDFLib.rgb(0.15, 0.17, 0.2), 16, CONTENT_W - 22);
          yPosition -= 4;
        }
      }
      yPosition -= 14;
    }

    // --- answer key (new page) ----------------------------------------------
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    yPosition = PAGE_H - MARGIN;

    // Answer key header band
    page.drawRectangle({
      x: 0,
      y: PAGE_H - 46,
      width: PAGE_W,
      height: 46,
      color: PDFLib.rgb(...WS_BRAND.dark),
    });
    page.drawText("Answer Key", {
      x: MARGIN,
      y: PAGE_H - 33,
      size: 16,
      color: PDFLib.rgb(1, 1, 1),
      font: boldFont,
    });
    yPosition = PAGE_H - 46 - 20;

    for (const quiz of test.quizzes) {
      const index = test.quizzes.indexOf(quiz);
      const correctOptions = formatCorrectOptions(quiz.correct_opts);
      ensureSpace(60);

      // Answer letters in green
      yPosition = await drawWrappedRuns(`${index + 1}.  ${correctOptions}`, MARGIN, yPosition, boldFont, 12, PDFLib.rgb(...WS_BRAND.green), 16);

      // Explanation in grey italic
      const explanation = cleanExplanation(quiz.opt6);
      if (explanation) {
        yPosition = await drawWrappedRuns(explanation, MARGIN + 22, yPosition, italicFont, 10.5, PDFLib.rgb(...WS_BRAND.grey), 14, CONTENT_W - 22);
      }
      yPosition -= 12;
    }

    // --- page numbers on every page -----------------------------------------
    const pages = pdfDoc.getPages();
    pages.forEach((p, i) => {
      p.drawText(`${i + 1} / ${pages.length}`, {
        x: PAGE_W - MARGIN - 40,
        y: 28,
        size: 9,
        color: PDFLib.rgb(...WS_BRAND.lightGrey),
        font: lightFont,
      });
      p.drawText("WiseSloth.open", {
        x: MARGIN,
        y: 28,
        size: 9,
        color: PDFLib.rgb(...WS_BRAND.lightGrey),
        font: lightFont,
      });
    });

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
  } catch (error) {
    console.error("Error generating PDF:", error);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "Error generating PDF, please try generating DOCX instead.",
    });
    return null;
  }
}

// ============================================================================
// DOCX GENERATION
// ============================================================================
async function generateDOCX(test) {
  try {
    const BRAND_BLUE = "1A78C7";
    const BRAND_DARK = "212429";
    const BRAND_GREY = "737A80";
    const BRAND_GREEN = "1A9959";

    // DOCX default run font is 11pt = 14.67px @96dpi; math PNGs measured at 16px em
    const DOCX_SCALE = 14.67 / 16;

    // Build paragraph children for a string that may contain $...$ math AND
    // markdown styles (**bold**, *italic*, `code`, ~~strike~~, [label](url)).
    // Math glyphs are tinted to the run color (hex like "212429").
    async function runsToChildren(text, { bold = false, italics = false, color = BRAND_DARK, fontSize = 22 } = {}) {
      const children = [];
      const runs = WSMath.split(text);
      for (const run of runs) {
        if (run.type === "math") {
          try {
            const m = await WSMath.render(run.value, "#" + color);
            // Use the ink-cropped variant (bottom = formula baseline) so Word's
            // inline alignment puts the formula on the text baseline, not above it.
            const bytes = WSMath.dataUrlToBytes(m.cropDataUrl || m.dataUrl);
            const hPx = m.cropHPx || m.hPx;
            children.push(new docx.ImageRun({
              type: "png",
              data: bytes,
              transformation: {
                width: Math.round(m.wPx * DOCX_SCALE),
                height: Math.round(hPx * DOCX_SCALE),
              },
            }));
          } catch (e) {
            children.push(new docx.TextRun({ text: run.value, bold, italics, color, size: fontSize }));
          }
        } else {
          // Normalize literal "\n" (2-char backslash+n) to real newlines;
          // math runs are already separated so LaTeX \nu etc. stay intact.
          const normalized = String(run.value).replace(/\\n/g, "\n");
          for (const seg of splitMarkdownStyles(normalized)) {
            // A literal newline (\n) inside a segment becomes a line break
            // (<w:br/>): emit one TextRun per line, break on all but the last.
            const lines = seg.text.split("\n");
            lines.forEach((line, li) => {
              children.push(new docx.TextRun({
                text: line,
                bold: bold || seg.bold,
                italics: italics || seg.italics,
                strike: seg.strike,
                font: seg.code ? "Consolas" : undefined,
                color,
                size: fontSize,
                break: li < lines.length - 1 ? 1 : 0,
              }));
            });
          }
        }
      }
      return children;
    }

    // --- quiz paragraphs ----------------------------------------------------
    const quizParagraphs = [];
    for (const quiz of test.quizzes) {
      const index = test.quizzes.indexOf(quiz);
      quizParagraphs.push(
        // Question
        new docx.Paragraph({
          spacing: { before: 240, after: 80 },
          children: [
            new docx.TextRun({ text: `${index + 1}. `, bold: true, color: BRAND_BLUE }),
            ...(await runsToChildren(String(quiz.question), { bold: true, color: BRAND_DARK })),
          ],
        })
      );
      // Options (indented; skip [Exp] explanation slots — parity with the UI)
      for (const [idx, opt] of ["opt1", "opt2", "opt3", "opt4", "opt5"].entries()) {
        if (quiz[opt] && !isExplanationOption(quiz[opt])) {
          quizParagraphs.push(
            new docx.Paragraph({
              indent: { left: 720 },
              spacing: { after: 60 },
              children: [
                new docx.TextRun({ text: `${String.fromCharCode(65 + idx)}. `, bold: true, color: BRAND_BLUE }),
                ...(await runsToChildren(String(quiz[opt]), { color: BRAND_DARK })),
              ],
            })
          );
        }
      }
      // Small spacer
      quizParagraphs.push(new docx.Paragraph({ text: "", spacing: { after: 60 } }));
    }

    // --- answer key content -------------------------------------------------
    const answerKeyContent = [];
    for (const quiz of test.quizzes) {
      const index = test.quizzes.indexOf(quiz);
      const formattedCorrectOptions = formatCorrectOptions(quiz.correct_opts);
      const explanation = cleanExplanation(quiz.opt6);
      answerKeyContent.push(
        new docx.Paragraph({
          spacing: { before: 120, after: 60 },
          children: [
            new docx.TextRun({ text: `${index + 1}. `, bold: true, color: BRAND_BLUE }),
            new docx.TextRun({ text: formattedCorrectOptions, bold: true, color: BRAND_GREEN }),
          ],
        })
      );
      if (explanation) {
        answerKeyContent.push(
          new docx.Paragraph({
            indent: { left: 720 },
            spacing: { after: 40 },
            children: [
              ...(await runsToChildren(explanation, { italics: true, color: BRAND_GREY })),
            ],
          })
        );
      }
    }

    // --- document -----------------------------------------------------------
    const doc = new docx.Document({
      creator: "WiseSloth.open",
      title: `${test.name}`,
      description: "Test generated with WiseSloth.open, powered by AI.",
      properties: {
        language: "en-US",
      },
      styles: {
        default: {
          document: {
            run: {
              font: "Calibri",
              size: 22, // 11pt
              color: BRAND_DARK,
            },
            paragraph: {
              spacing: { after: 120 },
            },
          },
        },
      },
      sections: [
        {
          children: [
            // Title
            new docx.Paragraph({
              spacing: { after: 120 },
              children: splitMarkdownStyles(String(test.name).replace(/\\n/g, "\n")).map((seg) => new docx.TextRun({
                text: seg.text,
                bold: true || seg.bold,
                italics: seg.italics,
                strike: seg.strike,
                font: seg.code ? "Consolas" : undefined,
                size: 44, // 22pt
                color: BRAND_BLUE,
              })),
            }),
            // Author
            new docx.Paragraph({
              spacing: { after: 60 },
              children: [
                new docx.TextRun({ text: "By ", color: BRAND_DARK }),
                new docx.ExternalHyperlink({
                  children: [
                    new docx.TextRun({ text: String(test.author?.username || "Unknown"), style: "Hyperlink", bold: true }),
                  ],
                  link: window.location.origin + "/users/" + (test.author?.username || ""),
                }),
              ],
            }),
            // Watermark
            new docx.Paragraph({
              spacing: { after: 60 },
              children: [
                new docx.TextRun({ text: "Thoughtfully generated with ", color: BRAND_GREY }),
                new docx.ExternalHyperlink({
                  children: [
                    new docx.TextRun({ text: "WiseSloth.open", style: "Hyperlink", color: BRAND_BLUE }),
                  ],
                  link: window.location.origin,
                }),
                new docx.TextRun({ text: ", powered by AI.", color: BRAND_GREY }),
              ],
            }),
            // Last modified
            new docx.Paragraph({
              spacing: { after: 120 },
              children: [
                new docx.TextRun({ text: "Last modified: " + generateLastModifiedString(), color: BRAND_GREY, size: 20 }),
              ],
            }),
            // Description
            ...(test.desc
              ? [new docx.Paragraph({
                  spacing: { after: 200 },
                  children: splitMarkdownStyles(String(test.desc).replace(/\\n/g, "\n")).map((seg) => new docx.TextRun({
                    text: seg.text,
                    italics: true || seg.italics,
                    bold: seg.bold,
                    strike: seg.strike,
                    font: seg.code ? "Consolas" : undefined,
                    color: BRAND_DARK,
                  })),
                })]
              : []),
            // Horizontal rule (separator)
            new docx.Paragraph({
              border: { bottom: { style: docx.BorderStyle.SINGLE, size: 6, color: BRAND_BLUE } },
              spacing: { after: 200 },
              children: [],
            }),
            // Questions
            ...quizParagraphs,
          ],
        },
        // Answer key on its own section (starts on a new page)
        {
          properties: {},
          children: [
            new docx.Paragraph({
              spacing: { after: 200 },
              children: [
                new docx.TextRun({ text: "Answer Key", bold: true, size: 36, color: BRAND_BLUE }),
              ],
            }),
            ...answerKeyContent,
          ],
        },
      ],
    });

    return doc;
  } catch (error) {
    console.error("Error generating DOCX:", error);
    swal.fire({
      icon: "error",
      title: "Oops...",
      text: "Something went wrong exporting the test to a DOCX file :(",
    });
    return null;
  }
}

// ============================================================================
// DOWNLOAD HELPERS
// ============================================================================

// Download test as PDF
async function downloadPDF(test) {
  const pdfBytes = await generatePDF(test);
  if (pdfBytes === null || pdfBytes === undefined) {
    return;
  }

  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;

  // Test name should be test name without spaces if there are no special characters
  let testName;
  const testNameWithoutSpaces = test.name.replace(/\s+/g, "_");
  if (/[^a-zA-Z0-9]/.test(testNameWithoutSpaces)) {
    testName = testNameWithoutSpaces;
  } else {
    testName = test.id;
  }
  link.download = `${testName}_${generateDateString()}.pdf`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Download test as DOCX
async function downloadDOCX(test) {
  const doc = await generateDOCX(test);
  if (doc === null || doc === undefined) {
    return;
  }

  const blob = await docx.Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;

  let testName;
  const testNameWithoutSpaces = test.name.replace(/\s+/g, "_");
  if (/[^a-zA-Z0-9]/.test(testNameWithoutSpaces)) {
    testName = testNameWithoutSpaces;
  } else {
    testName = test.id;
  }
  link.download = `${testName}_${generateDateString()}.docx`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
