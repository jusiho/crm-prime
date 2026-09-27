import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";

// Una sola pareja tipográfica para toda la web: Bricolage Grotesque titula
// (display con carácter) y Hanken Grotesk trabaja (cuerpo neutro y legible).
// Contraste por eje expresiva/neutra, fuera de las fuentes-reflejo. Las
// variables las recoge globals.css (--font-display / --font-sans); si la
// descarga falla en el build, el CSS cae al stack del sistema.
export const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--font-display-face",
});

export const body = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-body-face",
});
