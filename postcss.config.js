/*
 * Zonder dit bestand laat Next de @tailwind-regels ongemoeid staan: ze komen
 * dan letterlijk in de gebouwde CSS terecht en er wordt geen enkele utility
 * gegenereerd. Dat is de reden dat de POC alles met inline styles deed.
 */
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
