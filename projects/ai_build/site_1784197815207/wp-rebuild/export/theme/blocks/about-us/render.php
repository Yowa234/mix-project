<?php
if (!defined('ABSPATH')) {
    exit;
}

$default_html = <<<'GOODJOB_ABOUT_US_HTML'
<section id="about-us" class="ai-section about-us-capability-stack-and-quality-process"><style>#about-us{background:#fff;color:#16202E;padding:clamp(56px,7vw,92px) 0;font-family:inherit}#about-us *{box-sizing:border-box}#about-us .wrap{width:min(1120px,92%);margin:0 auto;display:grid;gap:clamp(18px,2.4vw,28px)}#about-us .title{display:grid;gap:12px;padding-bottom:18px;border-bottom:1px solid #E2E7EE}#about-us .eyebrow{display:inline-flex;align-items:center;gap:8px;color:#0F766E;font-size:.82rem;letter-spacing:.12em;text-transform:uppercase}#about-us .eyebrow:before{content:"";width:28px;height:1px;background:#0F766E}#about-us h2{margin:0;font-size:clamp(1.8rem,3.4vw,3rem);line-height:1.08;color:#073633}#about-us .lead{max-width:520px;margin:0;color:#3C4858;font-size:1rem;line-height:1.75}#about-us .stack{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,.9fr);gap:clamp(16px,2vw,24px);align-items:start}#about-us .panel{background:#052725;border:1px solid rgba(15,118,110,.18);border-radius:24px;padding:clamp(20px,3vw,28px);box-shadow:0 10px 26px rgba(7,54,51,.08)}#about-us .panel h3{margin:0 0 14px;color:#fff;font-size:1.12rem}#about-us .cap-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}#about-us .cap{padding:14px 14px 12px;border-radius:18px;background:rgba(248,250,252,.06);border:1px solid rgba(255,255,255,.09);transition:transform .28s ease,border-color .28s ease,background .28s ease}#about-us .cap:hover{transform:translateY(-3px);border-color:rgba(14,165,233,.42);background:rgba(248,250,252,.1)}#about-us .cap strong{display:block;margin-bottom:6px;color:#fff;font-size:.98rem}#about-us .cap span{display:block;color:rgba(255,255,255,.8);font-size:.93rem;line-height:1.6}#about-us .proof{background:#F8FAFC;border:1px solid #E2E7EE;border-radius:22px;padding:clamp(18px,2.6vw,24px)}#about-us .proof h3{margin:0 0 12px;color:#073633;font-size:1.06rem}#about-us .proof ul{list-style:none;padding:0;margin:0;display:grid;gap:10px}#about-us .proof li{display:flex;gap:10px;align-items:flex-start;padding:0 0 10px;border-bottom:1px solid #E2E7EE;color:#3C4858;font-size:.94rem;line-height:1.55}#about-us .proof li:last-child{padding-bottom:0;border-bottom:0}#about-us .dot{width:9px;height:9px;border-radius:50%;background:#0EA5E9;flex:0 0 9px;margin-top:.42rem}#about-us .reliability{background:#F8FAFC;border:1px solid #E2E7EE;border-radius:22px;padding:clamp(18px,2.8vw,24px);display:grid;gap:12px}#about-us .reliability h3{margin:0;color:#073633;font-size:1.08rem}#about-us .reliability p{margin:0;color:#3C4858;line-height:1.75}#about-us .cta{display:inline-flex;align-items:center;justify-content:center;width:max-content;padding:11px 18px;border-radius:999px;background:#0F766E;color:#fff;text-decoration:none;border:1px solid #0F766E;transition:transform .24s ease,background .24s ease}#about-us .cta:hover{transform:translateY(-2px);background:#073633}#about-us .belt{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;padding-top:6px}#about-us .step{background:#fff;border:1px solid #E2E7EE;border-radius:20px;padding:16px;transition:transform .26s ease,border-color .26s ease,box-shadow .26s ease}#about-us .step:hover{transform:translateY(-3px);border-color:#0F766E;box-shadow:0 8px 22px rgba(15,118,110,.08)}#about-us .num{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:999px;background:#EAF6F3;color:#0F766E;font-weight:700;margin-bottom:10px}#about-us .step h4{margin:0 0 6px;color:#073633;font-size:.98rem}#about-us .step p{margin:0;color:#6B7686;font-size:.92rem;line-height:1.6}#about-us .band{background:#FCFDFC;border-top:1px solid #E2E7EE;border-bottom:1px solid #E2E7EE;padding:clamp(14px,2vw,18px);border-radius:24px}@media(max-width:760px){#about-us .stack,#about-us .belt,#about-us .cap-list{grid-template-columns:1fr}#about-us .panel,#about-us .proof,#about-us .reliability,#about-us .band{border-radius:18px}#about-us .lead{max-width:none}}</style><div class="wrap"><div class="title"><div class="eyebrow">About SENZ</div><h2>Trusted centrifuge manufacturing for compact, large, and ultra-large duty separation.</h2><p class="lead">SENZ builds export-ready centrifuges with long-term operating reliability, disciplined process control, and responsive documentation support for industrial buyers who need stable supply and clear execution.</p></div><div class="stack"><div class="panel"><h3>Capability Stack</h3><div class="cap-list"><div class="cap"><strong>Multi-size production</strong><span>Small, large, and ultra-large centrifuge lines matched to varied throughput and installation demands.</span></div><div class="cap"><strong>Precision fabrication</strong><span>Controlled machining, balancing, assembly, and fit verification for stable operation and service life.</span></div><div class="cap"><strong>Application adaptation</strong><span>Configuration support for material characteristics, duty cycles, and plant-side operating conditions.</span></div><div class="cap"><strong>Export coordination</strong><span>Packing, shipment preparation, and document handling aligned with international project delivery.</span></div></div></div><div class="proof"><h3>Documentation & Proof</h3><ul><li><span class="dot"></span><span>Incoming material records, in-process inspection points, and final test confirmation.</span></li><li><span class="dot"></span><span>Dimensional, assembly, and running-condition checks before release.</span></li><li><span class="dot"></span><span>Export packing list, commercial paperwork, and shipment trace support.</span></li><li><span class="dot"></span><span>Clear communication for technical files, lead time updates, and after-sales follow-up.</span></li></ul></div></div><div class="reliability"><h3>Long-term reliability buyers can plan around</h3><p>Built on years of manufacturing experience, SENZ focuses on dependable process discipline rather than overstatement. We support procurement teams with consistent build quality, practical response speed, and equipment prepared for repeated industrial duty across export markets.</p><a class="cta" href="/contact-us/">Talk to SENZ</a></div><div class="band"><div class="belt"><div class="step"><div class="num">01</div><h4>Requirement Review</h4><p>Confirm capacity, media conditions, and model direction.</p></div><div class="step"><div class="num">02</div><h4>Production Control</h4><p>Execute fabrication, assembly, and checkpoint inspection.</p></div><div class="step"><div class="num">03</div><h4>Final Verification</h4><p>Complete testing, records, and release approval.</p></div><div class="step"><div class="num">04</div><h4>Export Dispatch</h4><p>Pack securely, issue documents, and coordinate shipment.</p></div></div></div></div></section>
GOODJOB_ABOUT_US_HTML;
$html_source = function_exists('get_field') ? get_field('html_source') : '';
if (is_string($html_source) && trim($html_source) !== '') {
    echo $html_source; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    return;
}

$eyebrow = function_exists('get_field') ? (get_field('eyebrow') ?: "About Us") : "About Us";
$title = function_exists('get_field') ? (get_field('title') ?: "Trusted centrifuge manufacturing for compact, large, and ultra-large duty separation.") : "Trusted centrifuge manufacturing for compact, large, and ultra-large duty separation.";
$intro = function_exists('get_field') ? (get_field('intro') ?: "SENZ builds export-ready centrifuges with long-term operating reliability, disciplined process control, and responsive documentation support for industrial buyers who need stable supply and clear execution.") : "SENZ builds export-ready centrifuges with long-term operating reliability, disciplined process control, and responsive documentation support for industrial buyers who need stable supply and clear execution.";
$primary_label = function_exists('get_field') ? (get_field('primary_label') ?: "Request a Proposal") : "Request a Proposal";
$primary_url = function_exists('get_field') ? (get_field('primary_url') ?: "/contact-us/") : "/contact-us/";
$image = function_exists('get_field') ? get_field('image') : null;
$image_url = is_array($image) && !empty($image['url']) ? $image['url'] : '';
$has_structured_edits = $image_url
    || $eyebrow !== "About Us"
    || $title !== "Trusted centrifuge manufacturing for compact, large, and ultra-large duty separation."
    || $intro !== "SENZ builds export-ready centrifuges with long-term operating reliability, disciplined process control, and responsive documentation support for industrial buyers who need stable supply and clear execution."
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
    if ($title !== "Trusted centrifuge manufacturing for compact, large, and ultra-large duty separation.") {
        $editable_html = preg_replace_callback('/<h([1-3])\b([^>]*)>.*?<\/h\1>/is', function ($matches) use ($title) {
            return '<h' . $matches[1] . $matches[2] . '>' . esc_html($title) . '</h' . $matches[1] . '>';
        }, $editable_html, 1) ?: $editable_html;
    }
    if ($intro !== "SENZ builds export-ready centrifuges with long-term operating reliability, disciplined process control, and responsive documentation support for industrial buyers who need stable supply and clear execution.") {
        $editable_html = preg_replace_callback('/<p\b([^>]*)>.*?<\/p>/is', function ($matches) use ($intro) {
            return '<p' . $matches[1] . '>' . esc_html($intro) . '</p>';
        }, $editable_html, 1) ?: $editable_html;
    }
    if ($primary_label !== "Request a Proposal" || $primary_url !== "/contact-us/") {
        $editable_html = preg_replace_callback("/<a\\b([^>]*?)href=([\"']).*?\\2([^>]*)>.*?<\\/a>/is", function ($matches) use ($primary_label, $primary_url) {
            return '<a' . $matches[1] . 'href="' . esc_url($primary_url) . '"' . $matches[3] . '>' . esc_html($primary_label) . '</a>';
        }, $editable_html, 1) ?: $editable_html;
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
