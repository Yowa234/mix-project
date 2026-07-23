<?php
if (!defined('ABSPATH')) {
    exit;
}

$default_html = <<<'GOODJOB_ABOUT_US_HTML'
<section id="about-us" class="ai-section about-us-capability-stack-and-quality-process"><style>#about-us{padding:clamp(56px,7vw,92px) 0;background:linear-gradient(180deg,#0C214E 0%,#112E6C 38%,#F8FAFC 100%);color:#16202E;position:relative;overflow:hidden}#about-us:before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(14,165,233,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(14,165,233,.08) 1px,transparent 1px);background-size:26px 26px;opacity:.28;pointer-events:none}#about-us .wrap{width:min(1180px,92%);margin:0 auto;position:relative;z-index:1;display:grid;gap:22px}#about-us .intro{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(260px,.7fr);gap:20px;align-items:stretch}#about-us .panel-dark,#about-us .panel-light{border:1px solid rgba(226,231,238,.18);padding:clamp(20px,3vw,30px);position:relative}#about-us .panel-dark{background:linear-gradient(180deg,rgba(12,33,78,.94),rgba(17,46,108,.92));color:rgba(255,255,255,.84)}#about-us .panel-light{background:#ffffff;border-color:#E2E7EE;box-shadow:0 14px 34px rgba(12,33,78,.08)}#about-us .eyebrow{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;background:rgba(14,165,233,.12);border:1px solid rgba(14,165,233,.34);color:#0EA5E9;font-size:12px;letter-spacing:.08em;text-transform:uppercase}#about-us h2,#about-us h3{margin:0 0 10px}#about-us h2{font-size:clamp(28px,4vw,44px);line-height:1.08;color:#fff}#about-us h3{font-size:clamp(18px,2.2vw,24px);color:#112E6C}#about-us .panel-dark p{margin:0;color:rgba(255,255,255,.82);max-width:58ch}#about-us .chips{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:16px}#about-us .chip{padding:12px 14px;border:1px solid rgba(14,165,233,.24);background:rgba(248,250,252,.06);color:#fff}#about-us .chip strong{display:block;font-size:13px;margin-bottom:4px}#about-us .proof-list{margin:0;padding:0;list-style:none;display:grid;gap:10px}#about-us .proof-list li{padding-left:18px;position:relative;color:#3C4858}#about-us .proof-list li:before{content:"";position:absolute;left:0;top:.62em;width:8px;height:8px;background:#0EA5E9;transform:rotate(45deg)}#about-us .timeline{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;position:relative;padding-top:18px}#about-us .timeline:before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:linear-gradient(90deg,#2563EB,#0EA5E9)}#about-us .step{background:#fff;border:1px solid #E2E7EE;padding:18px;position:relative;transition:transform .28s ease,border-color .28s ease}#about-us .step:hover{transform:translateY(-4px);border-color:#0EA5E9}#about-us .step:before{content:"";position:absolute;top:-9px;left:18px;width:14px;height:14px;background:#2563EB;border:3px solid #F8FAFC;transform:rotate(45deg)}#about-us .step em{display:block;font-style:normal;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#0EA5E9;margin-bottom:8px}#about-us .step h4{margin:0 0 8px;font-size:17px;color:#112E6C}#about-us .step p{margin:0;color:#3C4858}#about-us .metrics{display:grid;grid-template-columns:1.1fr .9fr;gap:20px}#about-us .metric-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}#about-us .metric{background:#fff;border:1px solid #E2E7EE;padding:18px}#about-us .metric b{display:block;font-size:28px;color:#2563EB;margin-bottom:6px}#about-us .metric span{color:#3C4858}#about-us .quality{display:flex;justify-content:space-between;gap:18px;align-items:center;background:linear-gradient(90deg,#F8FAFC,#ffffff);border:1px solid #E2E7EE;padding:22px}#about-us .quality p{margin:0;color:#3C4858;max-width:72ch}#about-us .cta{display:inline-flex;align-items:center;justify-content:center;padding:12px 18px;border-radius:999px;background:linear-gradient(90deg,#2563EB,#0EA5E9);color:#fff;text-decoration:none;white-space:nowrap;transition:transform .25s ease}#about-us .cta:hover{transform:translateY(-2px)}@media(max-width:760px){#about-us .intro,#about-us .metrics,#about-us .timeline,#about-us .chips,#about-us .metric-grid{grid-template-columns:1fr}#about-us .quality{flex-direction:column;align-items:flex-start}}</style><div class="wrap"><div class="intro"><div class="panel-dark"><span class="eyebrow">Ocean Research Capability</span><h2>Applied marine research with disciplined industrial delivery</h2><p>Ocean supports buyers across marine fish, marine plants, water quality, and marine resource programs with a structured operating system for sampling, analysis, documentation, and export coordination. Our capability stack is built for clear technical communication, traceable records, and dependable long-term cooperation.</p><div class="chips"><div class="chip"><strong>Field & Sampling</strong>Coastal collection, survey planning, controlled chain-of-custody</div><div class="chip"><strong>Laboratory Analysis</strong>Chemical, biological, and data-backed testing workflows</div><div class="chip"><strong>Technical Documentation</strong>COA, method records, labeling, packing files, export sets</div><div class="chip"><strong>Project Response</strong>Custom specifications, buyer updates, stable handoff control</div></div></div><div class="panel-light"><h3>Documentation & Proof</h3><ul class="proof-list"><li>Batch records linked to sample source, test stage, and release status</li><li>Inspection sheets, packing verification, and shipment document review</li><li>Specification alignment for research supply, pilot use, and export orders</li><li>Responsive support for buyer audits, technical clarification, and re-orders</li></ul></div></div><div class="timeline"><article class="step"><em>01</em><h4>Requirement Review</h4><p>Confirm species, parameter targets, handling method, and market document needs.</p></article><article class="step"><em>02</em><h4>Controlled Preparation</h4><p>Organize collection, processing, coding, and internal checkpoints with recorded status.</p></article><article class="step"><em>03</em><h4>Inspection & Release</h4><p>Verify specifications, packaging integrity, and file completeness before dispatch.</p></article><article class="step"><em>04</em><h4>Export Coordination</h4><p>Support labeling, shipping documents, schedule follow-up, and arrival communication.</p></article></div><div class="metrics"><div class="panel-light"><h3>Operational Proof Metrics</h3><div class="metric-grid"><div class="metric"><b>4</b><span>core marine categories served under one coordinated supply workflow</span></div><div class="metric"><b>1:1</b><span>buyer communication from technical confirmation to shipping handoff</span></div><div class="metric"><b>100%</b><span>document review before release against approved order details</span></div><div class="metric"><b>Long-term</b><span>reliability focus through repeatable controls, records, and steady response</span></div></div></div><div class="panel-dark"><span class="eyebrow">Reliability Note</span><h3 style="color:#fff">Built for institutional continuity</h3><p>We prioritize practical consistency over exaggerated claims: stable procedures, transparent evidence, and export-ready coordination that helps overseas buyers reduce uncertainty in technical purchasing.</p></div></div><div class="quality"><p>Our quality process combines marine research discipline with buyer-facing execution: every order moves through requirement confirmation, controlled preparation, inspection proof, and export document closure so product, data, and paperwork stay aligned.</p><a class="cta" href="/contact-us/">Contact Ocean</a></div></div></section>
GOODJOB_ABOUT_US_HTML;
$html_source = function_exists('get_field') ? get_field('html_source') : '';
if (is_string($html_source) && trim($html_source) !== '') {
    echo $html_source; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    return;
}

$eyebrow = function_exists('get_field') ? (get_field('eyebrow') ?: "About Us") : "About Us";
$title = function_exists('get_field') ? (get_field('title') ?: "Applied marine research with disciplined industrial delivery") : "Applied marine research with disciplined industrial delivery";
$intro = function_exists('get_field') ? (get_field('intro') ?: "Ocean supports buyers across marine fish, marine plants, water quality, and marine resource programs with a structured operating system for sampling, analysis, documentation, and export coordination. Our capability stack is built for clear technical communicat") : "Ocean supports buyers across marine fish, marine plants, water quality, and marine resource programs with a structured operating system for sampling, analysis, documentation, and export coordination. Our capability stack is built for clear technical communicat";
$primary_label = function_exists('get_field') ? (get_field('primary_label') ?: "Request a Proposal") : "Request a Proposal";
$primary_url = function_exists('get_field') ? (get_field('primary_url') ?: "/contact-us/") : "/contact-us/";
$image = function_exists('get_field') ? get_field('image') : null;
$image_url = is_array($image) && !empty($image['url']) ? $image['url'] : '';
$hero_bg_urls = array();
foreach (array('hero_bg_1', 'hero_bg_2', 'hero_bg_3') as $hero_bg_field) {
    $hero_bg = function_exists('get_field') ? get_field($hero_bg_field) : null;
    $hero_bg_url = is_array($hero_bg) && !empty($hero_bg['url']) ? $hero_bg['url'] : (is_string($hero_bg) ? $hero_bg : '');
    if ($hero_bg_url) {
        $hero_bg_urls[] = $hero_bg_url;
    }
}
$has_structured_edits = $image_url
    || !empty($hero_bg_urls)
    || $eyebrow !== "About Us"
    || $title !== "Applied marine research with disciplined industrial delivery"
    || $intro !== "Ocean supports buyers across marine fish, marine plants, water quality, and marine resource programs with a structured operating system for sampling, analysis, documentation, and export coordination. Our capability stack is built for clear technical communicat"
    || $primary_label !== "Request a Proposal"
    || $primary_url !== "/contact-us/";
if (!$has_structured_edits) {
    echo $default_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    return;
}
if (!$image_url) {
    $editable_html = $default_html;
    if ($eyebrow !== "About Us") {
        $editable_html = preg_replace_callback("/<(span|div)\\b([^>]*class=[\"'][^\"']*(?:eyebrow|badge|tag)[^\"']*[\"'][^>]*)>.*?<\\/\\1>/is", function ($matches) use ($eyebrow) {
            return '<' . $matches[1] . $matches[2] . '>' . esc_html($eyebrow) . '</' . $matches[1] . '>';
        }, $editable_html, 1) ?: $editable_html;
    }
    if ($title !== "Applied marine research with disciplined industrial delivery") {
        $editable_html = preg_replace_callback('/<h([1-3])\b([^>]*)>.*?<\/h\1>/is', function ($matches) use ($title) {
            return '<h' . $matches[1] . $matches[2] . '>' . esc_html($title) . '</h' . $matches[1] . '>';
        }, $editable_html, 1) ?: $editable_html;
    }
    if ($intro !== "Ocean supports buyers across marine fish, marine plants, water quality, and marine resource programs with a structured operating system for sampling, analysis, documentation, and export coordination. Our capability stack is built for clear technical communicat") {
        $editable_html = preg_replace_callback('/<p\b([^>]*)>.*?<\/p>/is', function ($matches) use ($intro) {
            return '<p' . $matches[1] . '>' . esc_html($intro) . '</p>';
        }, $editable_html, 1) ?: $editable_html;
    }
    if ($primary_label !== "Request a Proposal" || $primary_url !== "/contact-us/") {
        $editable_html = preg_replace_callback("/<a\\b([^>]*?)href=([\"']).*?\\2([^>]*)>.*?<\\/a>/is", function ($matches) use ($primary_label, $primary_url) {
            return '<a' . $matches[1] . 'href="' . esc_url($primary_url) . '"' . $matches[3] . '>' . esc_html($primary_label) . '</a>';
        }, $editable_html, 1) ?: $editable_html;
    }
    if (!empty($hero_bg_urls)) {
        $hero_css = '<style data-goodjob-hero-acf-bg>';
        foreach ($hero_bg_urls as $index => $hero_bg_url) {
            $slide = $index + 1;
            $safe_url = esc_url($hero_bg_url);
            $hero_css .= '#home .bg' . $slide . ',#home [data-upload-slot="hero-background-' . $slide . '"],#home .hero-bg span:nth-child(' . $slide . '){background-image:url("' . $safe_url . '")!important;}';
        }
        $hero_css .= '</style>';
        $editable_html .= $hero_css;
    }
    echo $editable_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    return;
}
?>
<section class="ai-section goodjob-acf-block goodjob-acf-block-<?php echo esc_attr('about-us'); ?>" id="<?php echo esc_attr('about-us'); ?>">
  <div class="ai-wrap goodjob-acf-block__inner">
    <?php if ($image_url) : ?>
      <div class="goodjob-acf-block__media"><img src="<?php echo esc_url($image_url); ?>" alt="<?php echo esc_attr($title); ?>" loading="lazy" decoding="async"></div>
    <?php endif; ?>
    <div class="goodjob-acf-block__content">
      <span class="ai-eyebrow"><?php echo esc_html($eyebrow); ?></span>
      <h2><?php echo esc_html($title); ?></h2>
      <p><?php echo esc_html($intro); ?></p>
      <a class="ai-btn ai-btn-primary" href="<?php echo esc_url($primary_url); ?>"><?php echo esc_html($primary_label); ?></a>
    </div>
  </div>
</section>
