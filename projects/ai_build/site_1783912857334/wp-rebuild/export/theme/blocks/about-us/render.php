<?php
if (!defined('ABSPATH')) {
    exit;
}

$default_html = <<<'GOODJOB_ABOUT_US_HTML'
<section id="about-us" class="ai-section about-us-capability-stack-and-quality-process"><style>#about-us{padding:clamp(44px,6vw,84px) 0;background:#F4F6FA;color:#16202E;font-family:Arial,sans-serif}#about-us *{box-sizing:border-box}#about-us .wrap{width:min(1180px,92%);margin:0 auto;display:grid;gap:clamp(18px,2.2vw,28px)}#about-us .title{padding:clamp(18px,2.5vw,28px) 0;border-top:3px solid #C8161C}#about-us .eyebrow{display:inline-block;padding:6px 10px;border:1px solid rgba(20,58,123,.18);background:#fff;color:#143A7B;font-size:12px;letter-spacing:.08em;text-transform:uppercase;font-weight:700}#about-us h2{margin:12px 0 10px;font-size:clamp(28px,4vw,42px);line-height:1.12;color:#091B39}#about-us .lead{max-width:820px;color:#3C4858;font-size:15px;line-height:1.7}#about-us .stack{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(280px,.95fr);gap:clamp(16px,2vw,24px);align-items:stretch}#about-us .panel{background:#061329;border:1px solid rgba(255,255,255,.08);padding:clamp(20px,2.5vw,30px);position:relative}#about-us .panel h3{margin:0 0 16px;color:#fff;font-size:clamp(20px,2.2vw,28px)}#about-us .cap-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}#about-us .cap{padding:14px;border:1px solid rgba(255,255,255,.12);background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.02));transition:transform .25s ease,border-color .25s ease}#about-us .cap:hover{transform:translateY(-3px);border-color:rgba(200,22,28,.55)}#about-us .cap strong{display:block;margin-bottom:6px;color:#fff;font-size:15px}#about-us .cap span{color:rgba(255,255,255,.82);font-size:13px;line-height:1.6}#about-us .proof{background:#fff;border:1px solid #E2E7EE;padding:clamp(18px,2.2vw,26px);box-shadow:0 12px 28px rgba(9,27,57,.06)}#about-us .proof h4{margin:0 0 12px;color:#091B39;font-size:20px}#about-us .proof ul{margin:0;padding-left:18px;color:#3C4858;line-height:1.7;font-size:14px}#about-us .note{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:center;padding:18px 20px;background:#143A7B;border-left:4px solid #C8161C}#about-us .note h4{margin:0 0 6px;color:#fff;font-size:18px}#about-us .note p{margin:0;color:rgba(255,255,255,.82);font-size:14px;line-height:1.7}#about-us .cta{display:inline-block;padding:12px 18px;background:linear-gradient(180deg,#C8161C,#a81217);color:#fff;text-decoration:none;font-weight:700;border:1px solid rgba(255,255,255,.16);white-space:nowrap}#about-us .cta:hover{filter:brightness(1.05)}#about-us .belt{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}#about-us .step{padding:18px;background:#EAEEF4;border:1px solid #E2E7EE;transition:transform .25s ease,box-shadow .25s ease}#about-us .step:hover{transform:translateY(-2px);box-shadow:0 10px 22px rgba(9,27,57,.08)}#about-us .num{display:inline-block;margin-bottom:10px;color:#C8161C;font-weight:800;font-size:12px;letter-spacing:.08em}#about-us .step h5{margin:0 0 8px;color:#091B39;font-size:16px}#about-us .step p{margin:0;color:#3C4858;font-size:13px;line-height:1.65}#about-us .divider{height:1px;background:linear-gradient(90deg,#143A7B,#C8161C)}@media(max-width:760px){#about-us .stack,#about-us .belt,#about-us .note,#about-us .cap-grid{grid-template-columns:1fr}#about-us .cta{width:100%;text-align:center}}</style><div class="wrap"><div class="title"><span class="eyebrow">About InquiryCloud</span><h2>Export-ready capability built for industrial manufacturers</h2><p class="lead">InquiryCloud supports CNC Machining Parts, Valve Components, Sheet Metal Fabrication, and Automation Hardware suppliers with a practical B2B growth system: stronger visibility, clearer proof, and better inquiry conversion for global buyers.</p></div><div class="stack"><div class="panel"><h3>Capability Stack</h3><div class="cap-grid"><div class="cap"><strong>Industry Positioning</strong><span>Clear category architecture and buyer-focused messaging for technical export markets.</span></div><div class="cap"><strong>Trust Content System</strong><span>Factory, quality, process, and application proof structured for RFQ confidence.</span></div><div class="cap"><strong>Inquiry Conversion</strong><span>Landing flows, CTA placement, and contact paths designed to reduce buyer hesitation.</span></div><div class="cap"><strong>Export Communication</strong><span>Documentation-ready presentation aligned with overseas sourcing expectations.</span></div></div></div><div class="proof"><h4>Documentation & Proof</h4><ul><li>Capability pages aligned to manufacturing categories and search intent</li><li>Quality and process proof blocks for audit-style buyer review</li><li>Export-oriented page structure for samples, lead time, MOQ, and response clarity</li><li>Consistent content governance to keep sales and web claims aligned</li></ul></div></div><div class="note"><div><h4>Long-term reliability, not short-term traffic</h4><p>We build institutional credibility that helps manufacturers earn repeat inquiries over time, with stable content foundations, practical proof modules, and a trustworthy digital face for international sourcing teams.</p></div><a class="cta" href="/contact-us/">Talk to Us</a></div><div class="divider"></div><div class="belt"><div class="step"><span class="num">01</span><h5>Audit</h5><p>Review categories, current pages, buyer objections, and export signals.</p></div><div class="step"><span class="num">02</span><h5>Structure</h5><p>Build capability, proof, and conversion content around priority products.</p></div><div class="step"><span class="num">03</span><h5>Validate</h5><p>Check clarity, trust markers, and inquiry paths before rollout.</p></div><div class="step"><span class="num">04</span><h5>Export Ready</h5><p>Publish a cleaner buyer journey for global traffic, RFQs, and follow-up.</p></div></div></div></section>
GOODJOB_ABOUT_US_HTML;
$html_source = function_exists('get_field') ? get_field('html_source') : '';
if (is_string($html_source) && trim($html_source) !== '') {
    echo $html_source; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    return;
}

$eyebrow = function_exists('get_field') ? (get_field('eyebrow') ?: "About Us") : "About Us";
$title = function_exists('get_field') ? (get_field('title') ?: "Export-ready capability built for industrial manufacturers") : "Export-ready capability built for industrial manufacturers";
$intro = function_exists('get_field') ? (get_field('intro') ?: "InquiryCloud supports CNC Machining Parts, Valve Components, Sheet Metal Fabrication, and Automation Hardware suppliers with a practical B2B growth system: stronger visibility, clearer proof, and better inquiry conversion for global buyers.") : "InquiryCloud supports CNC Machining Parts, Valve Components, Sheet Metal Fabrication, and Automation Hardware suppliers with a practical B2B growth system: stronger visibility, clearer proof, and better inquiry conversion for global buyers.";
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
    || $title !== "Export-ready capability built for industrial manufacturers"
    || $intro !== "InquiryCloud supports CNC Machining Parts, Valve Components, Sheet Metal Fabrication, and Automation Hardware suppliers with a practical B2B growth system: stronger visibility, clearer proof, and better inquiry conversion for global buyers."
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
    if ($title !== "Export-ready capability built for industrial manufacturers") {
        $editable_html = preg_replace_callback('/<h([1-3])\b([^>]*)>.*?<\/h\1>/is', function ($matches) use ($title) {
            return '<h' . $matches[1] . $matches[2] . '>' . esc_html($title) . '</h' . $matches[1] . '>';
        }, $editable_html, 1) ?: $editable_html;
    }
    if ($intro !== "InquiryCloud supports CNC Machining Parts, Valve Components, Sheet Metal Fabrication, and Automation Hardware suppliers with a practical B2B growth system: stronger visibility, clearer proof, and better inquiry conversion for global buyers.") {
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
