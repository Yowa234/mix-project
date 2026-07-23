<?php
/**
 * Title: Blog
 * Slug: goodjob-ai-site/blog
 * Categories: goodjob-ai-site
 */
?>
<section id="blog" class="ai-section blog-industrial-editorial-digest">
  <style>
    #blog{padding:64px 0;background:linear-gradient(180deg,#ffffff 0%,#f7faff 100%);color:#16202E;overflow:hidden}
    #blog *{box-sizing:border-box}
    #blog .blog-industrial-editorial-digest__wrap{width:min(1440px,calc(100vw - clamp(32px,6vw,120px)));margin:auto;display:grid;gap:clamp(18px,3vw,32px)}
    #blog .blog-industrial-editorial-digest__head{display:grid;gap:10px;max-width:760px}
    #blog .blog-industrial-editorial-digest__eyebrow{font-size:.82rem;letter-spacing:.18em;text-transform:uppercase;color:#2563EB;font-weight:700}
    #blog .blog-industrial-editorial-digest__title{margin:0;font:700 clamp(30px,3.6vw,46px)/1.08 "Barlow Semi Condensed",Barlow,Arial,sans-serif}
    #blog .blog-industrial-editorial-digest__intro{margin:0;max-width:62ch;color:#6B7686;font:400 clamp(16px,1.2vw,17px)/1.72 Barlow,Inter,Arial,sans-serif}
    #blog .blog-industrial-editorial-digest__rail{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(280px,.9fr);gap:clamp(18px,3vw,32px);align-items:stretch}
    #blog .blog-industrial-editorial-digest__featured,#blog .blog-industrial-editorial-digest__list{border:1px solid #E2E7EE;background:linear-gradient(180deg,#ffffff 0%,#F8FAFC 100%);border-radius:2px;box-shadow:0 18px 40px rgba(17,46,108,.06)}
    #blog .blog-industrial-editorial-digest__featured{padding:clamp(18px,2.4vw,28px);display:grid;gap:16px;min-height:100%}
    #blog .blog-industrial-editorial-digest__chiprow{display:flex;flex-wrap:wrap;gap:8px}
    #blog .blog-industrial-editorial-digest__chip{padding:6px 10px;border:1px solid #D9E2F0;border-radius:999px;background:#fff;color:#112E6C;font-size:.78rem;font-weight:600;letter-spacing:.02em}
    #blog .blog-industrial-editorial-digest__featured-media{aspect-ratio:16/9;border-radius:2px;background:linear-gradient(135deg,rgba(37,99,235,.12),rgba(14,165,233,.08));border:1px solid #E2E7EE;position:relative;overflow:hidden}
    #blog .blog-industrial-editorial-digest__featured-media:after{content:"";position:absolute;inset:12% 8%;border:1px solid rgba(17,46,108,.12);background:repeating-linear-gradient(90deg,rgba(37,99,235,.08) 0 1px,transparent 1px 18px),repeating-linear-gradient(0deg,rgba(37,99,235,.06) 0 1px,transparent 1px 18px)}
    #blog .blog-industrial-editorial-digest__featured-title{margin:0;max-width:20ch;font:700 clamp(24px,2.4vw,34px)/1.12 "Barlow Semi Condensed",Barlow,Arial,sans-serif}
    #blog .blog-industrial-editorial-digest__featured-text{margin:0;color:#3C4858;max-width:60ch}
    #blog .blog-industrial-editorial-digest__cta{display:inline-flex;align-items:center;gap:10px;width:max-content;padding:12px 16px;border-radius:999px;background:#2563EB;color:#fff;text-decoration:none;font-weight:700;transition:transform .2s ease,background .2s ease}
    #blog .blog-industrial-editorial-digest__cta:hover{transform:translateY(-1px);background:#112E6C}
    #blog .blog-industrial-editorial-digest__list{padding:clamp(14px,1.8vw,20px);display:grid;gap:12px}
    #blog .blog-industrial-editorial-digest__listhead{display:flex;justify-content:space-between;align-items:center;gap:12px;padding-bottom:6px;border-bottom:1px solid #E2E7EE}
    #blog .blog-industrial-editorial-digest__listtitle{margin:0;font-size:1rem;letter-spacing:.08em;text-transform:uppercase;color:#112E6C}
    #blog .blog-industrial-editorial-digest__more{color:#2563EB;text-decoration:none;font-weight:700;white-space:nowrap}
    #blog .blog-industrial-editorial-digest__item{display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:start;padding:12px 0;border-top:1px solid #EAEFF6;text-decoration:none;color:inherit;transition:background .2s ease}
    #blog .blog-industrial-editorial-digest__item:first-of-type{border-top:0;padding-top:2px}
    #blog .blog-industrial-editorial-digest__date{font-size:.78rem;color:#6B7686;letter-spacing:.08em;text-transform:uppercase;min-width:76px}
    #blog .blog-industrial-editorial-digest__meta{display:grid;gap:6px}
    #blog .blog-industrial-editorial-digest__itemtitle{margin:0;font-size:1.02rem;line-height:1.34;color:#16202E}
    #blog .blog-industrial-editorial-digest__excerpt{margin:0;color:#6B7686;font-size:.95rem;line-height:1.55}
    #blog .blog-industrial-editorial-digest__item:hover .blog-industrial-editorial-digest__itemtitle,#blog .blog-industrial-editorial-digest__more:hover{text-decoration:underline}
    #blog .blog-industrial-editorial-digest__footer{display:flex;justify-content:flex-start}
    @media (max-width:760px){#blog{padding:64px 0}#blog .blog-industrial-editorial-digest__rail{grid-template-columns:1fr}#blog .blog-industrial-editorial-digest__item{grid-template-columns:1fr;gap:6px}#blog .blog-industrial-editorial-digest__date{min-width:0}}
  </style>
  <div class="blog-industrial-editorial-digest__wrap ai-wrap">
    <div class="blog-industrial-editorial-digest__head ai-section-head">
      <div class="blog-industrial-editorial-digest__eyebrow">RECENT BLOGS</div>
      <h2 class="blog-industrial-editorial-digest__title">Selection guides, maintenance notes, and market signals for industrial buyers.</h2>
      <p class="blog-industrial-editorial-digest__intro">Read concise technical articles on product knowledge, model selection, upkeep routines, troubleshooting, and demand trends across industrial applications.</p>
    </div>

    <div class="blog-industrial-editorial-digest__rail">
      <article class="blog-industrial-editorial-digest__featured ai-card">
        <div class="blog-industrial-editorial-digest__chiprow">
          <span class="blog-industrial-editorial-digest__chip">Selection Guide</span>
          <span class="blog-industrial-editorial-digest__chip">Product Knowledge</span>
          <span class="blog-industrial-editorial-digest__chip">Buyer's Checklist</span>
        </div>
        <div class="blog-industrial-editorial-digest__featured-media" aria-hidden="true"></div>
        <h3 class="blog-industrial-editorial-digest__featured-title">How to choose the right industrial component for throughput, durability, and serviceability</h3>
        <p class="blog-industrial-editorial-digest__featured-text">Compare specs, operating limits, and maintenance intervals before you buy. This guide helps engineers and sourcing teams shortlist the right series faster.</p>
        <a class="blog-industrial-editorial-digest__cta ai-btn" href="#" aria-label="Read featured guide">Read Guide <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><use href="#icon-arrow-right"></use></svg></a>
      </article>

      <aside class="blog-industrial-editorial-digest__list ai-card">
        <div class="blog-industrial-editorial-digest__listhead">
          <h3 class="blog-industrial-editorial-digest__listtitle">More Blogs</h3>
          <a class="blog-industrial-editorial-digest__more" href="#">Archive <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16"><use href="#icon-arrow-right"></use></svg></a>
        </div>
        <a class="blog-industrial-editorial-digest__item" href="#">
          <div class="blog-industrial-editorial-digest__date">2025-01-18</div>
          <div class="blog-industrial-editorial-digest__meta"><h4 class="blog-industrial-editorial-digest__itemtitle">Maintenance tips to extend service life in continuous-duty lines</h4><p class="blog-industrial-editorial-digest__excerpt">Practical checks, lubrication windows, and replacement cues for stable uptime.</p></div>
        </a>
        <a class="blog-industrial-editorial-digest__item" href="#">
          <div class="blog-industrial-editorial-digest__date">2025-01-09</div>
          <div class="blog-industrial-editorial-digest__meta"><h4 class="blog-industrial-editorial-digest__itemtitle">Troubleshooting abnormal noise, drift, and heat in field operations</h4><p class="blog-industrial-editorial-digest__excerpt">A fast diagnostic path for common failure modes and root-cause isolation.</p></div>
        </a>
        <a class="blog-industrial-editorial-digest__item" href="#">
          <div class="blog-industrial-editorial-digest__date">2024-12-28</div>
          <div class="blog-industrial-editorial-digest__meta"><h4 class="blog-industrial-editorial-digest__itemtitle">Industrial market insights: what buyers are prioritizing this quarter</h4><p class="blog-industrial-editorial-digest__excerpt">Lead times, compliance, and total cost of ownership are shaping procurement decisions.</p></div>
        </a>
      </aside>
    </div>
  </div>
</section>
