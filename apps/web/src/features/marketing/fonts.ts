import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";

// Display con carácter (enérgico, vivo) + cuerpo neutro y legible. Pareja por
// eje de contraste (expresiva vs neutra), fuera de las fuentes-reflejo.
export const display = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
  variable: "--lp-font-display",
});

export const body = Hanken_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--lp-font-body",
});
