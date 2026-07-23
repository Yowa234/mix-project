<?php
if (!defined('ABSPATH')) {
    exit;
}

$default_html = <<<'GOODJOB_APPLICATIONS_HTML'
<section id="applications" class="ai-section applications-horizontal-card-preview"><style>#applications{padding:clamp(40px,6vw,72px) 0;background:linear-gradient(180deg,#091B39 0,#061329 100%);color:#fff;position:relative}#applications *{box-sizing:border-box}#applications .wrap{width:min(1200px,92%);margin:0 auto}#applications .title{display:grid;gap:12px;margin-bottom:22px}#applications .eyebrow{display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid rgba(255,255,255,.16);background:#143A7B;color:#fff;font:700 12px/1.2 Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase}#applications h2{margin:0;font:700 clamp(28px,4vw,40px)/1.1 Arial,sans-serif}#applications .lede{max-width:760px;margin:0;color:#d9e3f2;font:400 15px/1.6 Arial,sans-serif}#applications .row{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(280px,1fr);gap:18px;overflow-x:auto;scroll-snap-type:x proximity;padding-bottom:8px}#applications article{scroll-snap-align:start;background:#F4F6FA;color:#16202E;border:1px solid #E2E7EE;border-top:3px solid #C8161C;padding:18px;display:grid;gap:14px;min-height:100%;transition:transform .22s ease,border-color .22s ease,box-shadow .22s ease;box-shadow:0 10px 24px rgba(0,0,0,.12)}#applications article:hover{transform:translateY(-3px);border-color:#143A7B;box-shadow:0 14px 30px rgba(0,0,0,.18)}#applications .scene{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-bottom:10px;border-bottom:1px solid #E2E7EE}#applications .scene strong{font:700 17px/1.3 Arial,sans-serif;color:#091B39}#applications .tag{padding:6px 9px;background:#EAEEF4;border:1px solid #E2E7EE;color:#143A7B;font:700 11px/1.2 Arial,sans-serif;text-transform:uppercase;letter-spacing:.06em}#applications .label{font:700 11px/1.2 Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#C8161C}#applications p{margin:0;color:#3C4858;font:400 14px/1.6 Arial,sans-serif}#applications .chips{display:flex;flex-wrap:wrap;gap:8px}#applications .chip{padding:7px 10px;background:#143A7B;color:#fff;font:700 12px/1.2 Arial,sans-serif;border:1px solid #091B39}#applications .outcome{padding:12px;background:#fff;border:1px solid #E2E7EE;color:#16202E}#applications .cta{display:inline-flex;align-items:center;justify-content:center;margin-top:8px;padding:12px 16px;background:linear-gradient(180deg,#C8161C 0,#a71016 100%);color:#fff;text-decoration:none;font:700 13px/1 Arial,sans-serif;text-transform:uppercase;letter-spacing:.04em;border:1px solid #7f0f14}#applications .cta:hover{filter:brightness(1.05)}#applications .row::-webkit-scrollbar{height:8px}#applications .row::-webkit-scrollbar-thumb{background:#35568D}#applications .row::-webkit-scrollbar-track{background:rgba(255,255,255,.08)}@media(max-width:760px){#applications{padding:34px 0}#applications .row{grid-auto-columns:minmax(86%,1fr)}#applications article{padding:16px}#applications .scene{align-items:flex-start;flex-direction:column}}</style><div class="wrap"><div class="title"><span class="eyebrow">Applications</span><h2>Export-ready parts matched to real operating environments</h2><p class="lede">InquiryCloud supports production buyers with practical fits for fluid control, machine builds, enclosures, and repeatable precision assemblies.</p></div><div class="row"><article><div class="scene"><strong>Process lines & valve skids</strong><span class="tag">Corrosion + sealing</span></div><div><div class="label">Pain point</div><p>Leak risk, unstable tolerances, and delayed replacement parts can stop throughput.</p></div><div><div class="label">Suitable product</div><div class="chips"><span class="chip">Valve Components</span><span class="chip">CNC Machining Parts</span></div></div><div class="outcome"><div class="label">Outcome</div><p>Reliable fit-up, faster maintenance planning, and steadier line uptime.</p></div><a class="cta" href="/contact-us/">Discuss Your Application</a></article><article><div class="scene"><strong>OEM machine assemblies</strong><span class="tag">Repeatability</span></div><div><div class="label">Pain point</div><p>Mixed suppliers create stack-up errors, drawing revisions, and assembly delays.</p></div><div><div class="label">Suitable product</div><div class="chips"><span class="chip">CNC Machining Parts</span><span class="chip">Automation Hardware</span></div></div><div class="outcome"><div class="label">Outcome</div><p>Cleaner integration, consistent batches, and shorter build cycles for export programs.</p></div><a class="cta" href="/products/">View Product Options</a></article><article><div class="scene"><strong>Control cabinets & enclosures</strong><span class="tag">Fit + finish</span></div><div><div class="label">Pain point</div><p>Poor panel accuracy and weak edge quality slow wiring, mounting, and inspection.</p></div><div><div class="label">Suitable product</div><div class="chips"><span class="chip">Sheet Metal Fabrication</span><span class="chip">Automation Hardware</span></div></div><div class="outcome"><div class="label">Outcome</div><p>Better installation speed, cleaner routing, and durable finished assemblies.</p></div><a class="cta" href="/contact-us/">Discuss Your Application</a></article><article><div class="scene"><strong>Conveying & motion stations</strong><span class="tag">Wear + alignment</span></div><div><div class="label">Pain point</div><p>High-cycle motion exposes weak brackets, misalignment, and inconsistent hardware quality.</p></div><div><div class="label">Suitable product</div><div class="chips"><span class="chip">Automation Hardware</span><span class="chip">Sheet Metal Fabrication</span></div></div><div class="outcome"><div class="label">Outcome</div><p>Stronger station stability, easier servicing, and more dependable production flow.</p></div><a class="cta" href="/contact-us/">Discuss Your Application</a></article></div></div></section>
GOODJOB_APPLICATIONS_HTML;
$html_source = function_exists('get_field') ? get_field('html_source') : '';
if (is_string($html_source) && trim($html_source) !== '') {
    echo $html_source; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    return;
}

$eyebrow = function_exists('get_field') ? (get_field('eyebrow') ?: "Applications") : "Applications";
$title = function_exists('get_field') ? (get_field('title') ?: "Export-ready parts matched to real operating environments") : "Export-ready parts matched to real operating environments";
$intro = function_exists('get_field') ? (get_field('intro') ?: "InquiryCloud supports production buyers with practical fits for fluid control, machine builds, enclosures, and repeatable precision assemblies.") : "InquiryCloud supports production buyers with practical fits for fluid control, machine builds, enclosures, and repeatable precision assemblies.";
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
    || $eyebrow !== "Applications"
    || $title !== "Export-ready parts matched to real operating environments"
    || $intro !== "InquiryCloud supports production buyers with practical fits for fluid control, machine builds, enclosures, and repeatable precision assemblies."
    || $primary_label !== "Request a Proposal"
    || $primary_url !== "/contact-us/";
if (!$has_structured_edits) {
    echo $default_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    return;
}
if (!$image_url) {
    $editable_html = $default_html;
    if ($eyebrow !== "Applications") {
        $editable_html = preg_replace_callback("/<(span|div)\\b([^>]*class=[\"'][^\"']*(?:eyebrow|badge|tag)[^\"']*[\"'][^>]*)>.*?<\\/\\1>/is", function ($matches) use ($eyebrow) {
            return '<' . $matches[1] . $matches[2] . '>' . esc_html($eyebrow) . '</' . $matches[1] . '>';
        }, $editable_html, 1) ?: $editable_html;
    }
    if ($title !== "Export-ready parts matched to real operating environments") {
        $editable_html = preg_replace_callback('/<h([1-3])\b([^>]*)>.*?<\/h\1>/is', function ($matches) use ($title) {
            return '<h' . $matches[1] . $matches[2] . '>' . esc_html($title) . '</h' . $matches[1] . '>';
        }, $editable_html, 1) ?: $editable_html;
    }
    if ($intro !== "InquiryCloud supports production buyers with practical fits for fluid control, machine builds, enclosures, and repeatable precision assemblies.") {
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
<section class="ai-section goodjob-acf-block goodjob-acf-block-<?php echo esc_attr('applications'); ?>" id="<?php echo esc_attr('applications'); ?>">
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
