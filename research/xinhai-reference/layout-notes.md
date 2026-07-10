# Xinhai Homepage Reference Notes

Source URL: https://xinhaiceshi.mktdrive.com/

## Layout pattern

- Topbar: dark navy strip, 42px desktop height, location/phone/email on the left, language/social icons on the right.
- Main header: white sticky nav, logo left, centered menu, contact CTA block right. Mobile switches to logo plus hamburger.
- Hero: full-bleed image slider, dark gradient overlay, left-aligned hero-card, red label, large condensed heading, paragraph, two CTAs, bottom dot/arrows.
- Hero stats: strong blue strip immediately below hero. Desktop uses four equal columns; mobile becomes a 2x2 grid.
- Sections: consistent section class with 96px desktop vertical rhythm, 64px mobile, max-width container, small red/blue eyebrow, large condensed title.
- Visual system: navy + red + steel gray, small radius, industrial card borders, uppercase action labels, repeated arrow icon.

## Assets observed

- No external SVG files found. Icons are inline SVG elements.
- Social icons present: LinkedIn, YouTube, Facebook.
- Instagram icon was not present on the observed homepage.
- Main CSS: /wp-content/themes/xinhai/assets/css/main.css?v=1.0.0
- Main images include hero-epcm.jpg, hero-aerial.jpg, hero-plant.jpg, product thumbnails, case images, and application images.

## Difference from current AI builder output

- Xinhai uses a site-level design system first, then sections inherit the same palette, type scale, button style, grid rhythm, and icon language.
- Our generated sections can still look like isolated blocks if the agent invents local visual systems per section.
- Xinhai has fixed structural modules: topbar, sticky nav, hero slider, stats strip, repeated section headers, card grids, CTA band, footer.
- Our future fixed prompt/template should make header, hero, stats, section head, card, CTA, footer reusable contracts rather than asking each section to design from scratch.
