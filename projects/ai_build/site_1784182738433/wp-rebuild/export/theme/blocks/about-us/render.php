<?php
if (!defined('ABSPATH')) {
    exit;
}

$default_html = <<<'GOODJOB_ABOUT_US_HTML'
<section id="about-us" class="ai-section about-us-capability-stack-and-quality-process"><style>#about-us{background:radial-gradient(circle at top right,rgba(37,99,235,.08),transparent 28%),linear-gradient(180deg,#f8fafc 0%,#eef4fb 100%);padding:clamp(48px,7vw,88px) 18px;color:#16202E}#about-us *{box-sizing:border-box}#about-us .wrap{max-width:1180px;margin:0 auto;display:grid;gap:22px}#about-us .hero{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(280px,.75fr);gap:22px;align-items:start}#about-us .title{padding:clamp(22px,3vw,34px);background:#0C214E;border:1px solid rgba(255,255,255,.08)}#about-us .eyebrow{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.72);margin:0 0 10px}#about-us h2{margin:0 0 12px;font-size:clamp(28px,4vw,42px);line-height:1.08;color:#fff}#about-us .lead{margin:0;color:rgba(255,255,255,.82);font-size:15px;line-height:1.7}#about-us .proof-card{background:#fff;border:1px solid #E2E7EE;padding:22px;display:grid;gap:14px}#about-us .proof-card h3,#about-us .metrics h3{margin:0;font-size:18px;color:#16202E}#about-us .proof-list{margin:0;padding:0;list-style:none;display:grid;gap:10px}#about-us .proof-list li{color:#3C4858;padding-left:16px;position:relative;line-height:1.55}#about-us .proof-list li:before{content:"";position:absolute;left:0;top:.62em;width:7px;height:7px;background:#2563EB}#about-us .timeline{position:relative;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;padding:12px 0 0}#about-us .timeline:before{content:"";position:absolute;left:0;right:0;top:26px;height:2px;background:linear-gradient(90deg,#bfd4fb 0%,#2563EB 100%)}#about-us .step{position:relative;background:#fff;border:1px solid #E2E7EE;padding:46px 18px 18px;min-height:180px;transition:transform .28s ease,border-color .28s ease,box-shadow .28s ease}#about-us .step:hover{transform:translateY(-4px);border-color:#b8cdf8;box-shadow:0 12px 30px rgba(17,46,108,.08)}#about-us .dot{position:absolute;top:17px;left:18px;width:18px;height:18px;border-radius:50%;background:#2563EB;border:4px solid #dbe8ff;z-index:1}#about-us .step small{display:block;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#6B7686;margin-bottom:8px}#about-us .step h4{margin:0 0 8px;font-size:17px;color:#16202E}#about-us .step p{margin:0;color:#3C4858;line-height:1.62;font-size:14px}#about-us .metrics{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(260px,.85fr);gap:22px}#about-us .capability{background:#0C214E;border:1px solid rgba(255,255,255,.08);padding:22px}#about-us .capability h3{margin:0 0 14px;color:#fff;font-size:20px}#about-us .stack{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}#about-us .chip{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);padding:14px}#about-us .chip strong{display:block;color:#fff;margin-bottom:6px;font-size:15px}#about-us .chip span{display:block;color:rgba(255,255,255,.8);font-size:13px;line-height:1.55}#about-us .reliability{background:#fff;border:1px solid #E2E7EE;padding:22px;display:grid;gap:10px}#about-us .reliability p{margin:0;color:#3C4858;line-height:1.7}#about-us .belt{background:#0C214E;border:1px solid rgba(255,255,255,.08);padding:22px;display:grid;gap:14px}#about-us .belt h3{margin:0;color:#fff;font-size:20px}#about-us .belt p{margin:0;color:rgba(255,255,255,.82);line-height:1.7}#about-us .cta{display:inline-flex;align-items:center;justify-content:center;padding:11px 16px;border-radius:999px;background:#2563EB;color:#fff;text-decoration:none;font-weight:600;transition:transform .24s ease,background .24s ease}#about-us .cta:hover{transform:translateY(-2px);background:#112E6C}#about-us .note{font-size:13px;color:rgba(255,255,255,.78)}@media(max-width:760px){#about-us .hero,#about-us .metrics,#about-us .timeline,#about-us .stack{grid-template-columns:1fr}#about-us .timeline:before{left:8px;right:auto;top:0;bottom:0;width:2px;height:auto}#about-us .step{padding:18px 18px 18px 44px;min-height:auto}#about-us .dot{top:18px;left:0}}</style><div class="wrap"><div class="hero"><div class="title"><p class="eyebrow">About Aliyun Server</p><h2>Structured infrastructure delivery with documented control and export-ready service.</h2><p class="lead">阿里云服务器 supports buyer programs for Ubuntu, CentOS, and Windows environments with a disciplined operating model focused on configuration accuracy, deployment traceability, documentation response, and stable long-term service continuity for cross-border projects.</p></div><div class="proof-card"><h3>Documentation & Proof</h3><ul class="proof-list"><li>Configuration records aligned to ordered OS and resource scope</li><li>Delivery documents, service confirmations, and handover references</li><li>Issue tracking and response logs for after-sales coordination</li><li>Export communication support for buyer review and project filing</li></ul></div></div><div class="timeline"><article class="step"><span class="dot"></span><small>01</small><h4>Requirement Mapping</h4><p>Clarify workload, region, OS preference, and access policy before quotation and provisioning.</p></article><article class="step"><span class="dot"></span><small>02</small><h4>Controlled Setup</h4><p>Deploy Ubuntu, CentOS, or Windows resources against confirmed parameters and access rules.</p></article><article class="step"><span class="dot"></span><small>03</small><h4>Proof & Handover</h4><p>Prepare configuration evidence, deployment notes, and support references for buyer verification.</p></article><article class="step"><span class="dot"></span><small>04</small><h4>Ongoing Service</h4><p>Maintain continuity through response tracking, update coordination, and practical lifecycle support.</p></article></div><div class="metrics"><div class="capability"><h3>Capability Stack</h3><div class="stack"><div class="chip"><strong>Multi-OS Supply</strong><span>Ubuntu, CentOS, and Windows options aligned to project use.</span></div><div class="chip"><strong>Configuration Control</strong><span>Parameter confirmation, access checks, and delivery consistency.</span></div><div class="chip"><strong>Buyer Documentation</strong><span>Clear handover files and service records for procurement teams.</span></div><div class="chip"><strong>Export Coordination</strong><span>Compact communication flow for overseas review and execution.</span></div></div></div><div class="reliability"><h3>Long-Term Reliability</h3><p>We present capability through documented process rather than exaggerated claims. The service model is built to remain readable for technical buyers, procurement teams, and repeat orders where continuity, traceability, and response discipline matter more than promotional language.</p></div></div><div class="belt"><h3>Quality & Export Process</h3><p>Our 4-step belt covers requirement confirmation, controlled setup, proof-based handover, and post-delivery response management to reduce mismatch risk and keep cross-border projects easier to validate and repeat.</p><p class="note">For project discussion, documentation needs, or deployment planning, contact our team directly.</p><a class="cta" href="/contact-us/">Talk to Aliyun</a></div></div></section>
GOODJOB_ABOUT_US_HTML;
$html_source = function_exists('get_field') ? get_field('html_source') : '';
if (is_string($html_source) && trim($html_source) !== '') {
    echo $html_source; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    return;
}

$eyebrow = function_exists('get_field') ? (get_field('eyebrow') ?: "About Us") : "About Us";
$title = function_exists('get_field') ? (get_field('title') ?: "Structured infrastructure delivery with documented control and export-ready service.") : "Structured infrastructure delivery with documented control and export-ready service.";
$intro = function_exists('get_field') ? (get_field('intro') ?: "About Aliyun Server") : "About Aliyun Server";
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
    || $title !== "Structured infrastructure delivery with documented control and export-ready service."
    || $intro !== "About Aliyun Server"
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
    if ($title !== "Structured infrastructure delivery with documented control and export-ready service.") {
        $editable_html = preg_replace_callback('/<h([1-3])\b([^>]*)>.*?<\/h\1>/is', function ($matches) use ($title) {
            return '<h' . $matches[1] . $matches[2] . '>' . esc_html($title) . '</h' . $matches[1] . '>';
        }, $editable_html, 1) ?: $editable_html;
    }
    if ($intro !== "About Aliyun Server") {
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
