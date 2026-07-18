// Propiedades geométricas que consume el solver: A, I33, I22, J.
// Convención SAP: I33 = eje fuerte (Ix), I22 = eje débil (Iy). Unidades base
// m/m²/m⁴. Esta fórmula se duplica en el frontend (types.ts) a propósito para
// no acoplar módulos front/back.
//
// NOTA: J en formas abiertas (ishape, channel, tee, angle) es una aproximación
// de pared delgada J ≈ (1/3)·Σ b·t³. En cajón cerrado (box) se usa Bredt.

// Torsión aproximada de un rectángulo macizo (a = lado mayor, c = lado menor).
function rectJ(b, h) {
  const a = Math.max(b, h);
  const c = Math.min(b, h);
  return a * c ** 3 * (1 / 3 - 0.21 * (c / a) * (1 - c ** 4 / (12 * a ** 4)));
}

// Compone una sección abierta a partir de rectángulos {w,h,cx,cy}: halla el
// centroide y aplica el teorema de ejes paralelos. Devuelve A, I33 (eje
// horizontal), I22 (eje vertical), todo respecto a los ejes centroidales.
function composite(rects) {
  const A = rects.reduce((s, r) => s + r.w * r.h, 0);
  const xbar = rects.reduce((s, r) => s + r.w * r.h * r.cx, 0) / A;
  const ybar = rects.reduce((s, r) => s + r.w * r.h * r.cy, 0) / A;
  let I33 = 0;
  let I22 = 0;
  for (const r of rects) {
    const a = r.w * r.h;
    I33 += (r.w * r.h ** 3) / 12 + a * (r.cy - ybar) ** 2;
    I22 += (r.h * r.w ** 3) / 12 + a * (r.cx - xbar) ** 2;
  }
  return { A, I33, I22 };
}

// Propiedades de una forma paramétrica por su `shape` + cotas.
function parametricProps(def) {
  switch (def.shape) {
    case "rectangular": {
      const { b, h } = def;
      return {
        A: b * h,
        I33: (b * h ** 3) / 12,
        I22: (h * b ** 3) / 12,
        J: rectJ(b, h),
      };
    }
    case "circular": {
      const { d } = def;
      const I = (Math.PI * d ** 4) / 64;
      return { A: (Math.PI * d ** 2) / 4, I33: I, I22: I, J: 2 * I };
    }
    case "pipe": {
      const { d, t } = def;
      const di = d - 2 * t;
      const I = (Math.PI * (d ** 4 - di ** 4)) / 64;
      return { A: (Math.PI * (d ** 2 - di ** 2)) / 4, I33: I, I22: I, J: 2 * I };
    }
    case "box": {
      const { b, h, t } = def;
      const bi = b - 2 * t;
      const hi = h - 2 * t;
      // Bredt (cajón cerrado de pared delgada), con dimensiones medias.
      const bm = b - t;
      const hm = h - t;
      return {
        A: b * h - bi * hi,
        I33: (b * h ** 3 - bi * hi ** 3) / 12,
        I22: (h * b ** 3 - hi * bi ** 3) / 12,
        J: (2 * t * bm ** 2 * hm ** 2) / (bm + hm),
      };
    }
    case "ishape": {
      const { d, bfTop, tfTop, tw, bfBot, tfBot } = def;
      const hw = d - tfTop - tfBot; // alma
      const rects = [
        { w: bfBot, h: tfBot, cx: 0, cy: tfBot / 2 },
        { w: tw, h: hw, cx: 0, cy: tfBot + hw / 2 },
        { w: bfTop, h: tfTop, cx: 0, cy: tfBot + hw + tfTop / 2 },
      ];
      const { A, I33, I22 } = composite(rects);
      const J = (bfTop * tfTop ** 3 + bfBot * tfBot ** 3 + hw * tw ** 3) / 3;
      return { A, I33, I22, J };
    }
    case "channel": {
      const { d, bf, tf, tw } = def;
      const flange = bf - tw; // parte del ala más allá del alma
      const rects = [
        { w: tw, h: d, cx: tw / 2, cy: d / 2 },
        { w: flange, h: tf, cx: tw + flange / 2, cy: d - tf / 2 },
        { w: flange, h: tf, cx: tw + flange / 2, cy: tf / 2 },
      ];
      const { A, I33, I22 } = composite(rects);
      const J = (2 * bf * tf ** 3 + (d - 2 * tf) * tw ** 3) / 3;
      return { A, I33, I22, J };
    }
    case "tee": {
      const { d, bf, tf, tw } = def;
      const stem = d - tf;
      const rects = [
        { w: bf, h: tf, cx: 0, cy: d - tf / 2 },
        { w: tw, h: stem, cx: 0, cy: stem / 2 },
      ];
      const { A, I33, I22 } = composite(rects);
      const J = (bf * tf ** 3 + stem * tw ** 3) / 3;
      return { A, I33, I22, J };
    }
    case "angle": {
      const { d, b, t } = def;
      const rects = [
        { w: t, h: d, cx: t / 2, cy: d / 2 },
        { w: b - t, h: t, cx: t + (b - t) / 2, cy: t / 2 },
      ];
      const { A, I33, I22 } = composite(rects);
      const J = (d * t ** 3 + (b - t) * t ** 3) / 3;
      return { A, I33, I22, J };
    }
    default:
      throw new Error(`unknown parametric shape: ${def.shape}`);
  }
}

// def: el documento/payload de la sección (source + shape/dims o valores).
// shape: perfil AISC ya resuelto (solo cuando source === "catalog").
function computeSectionProps(def, shape) {
  switch (def.source) {
    case "parametric":
      return parametricProps(def);
    case "catalog": {
      if (!shape) throw new Error("catalog section requires a resolved shape");
      return { A: shape.A, I33: shape.I33, I22: shape.I22, J: shape.J };
    }
    case "general":
      return { A: def.A, I33: def.I33, I22: def.I22, J: def.J };
    default:
      throw new Error(`unknown section source: ${def.source}`);
  }
}

module.exports = { computeSectionProps, composite, rectJ };
