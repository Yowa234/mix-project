<?php
if (!defined('ABSPATH')) {
    exit;
}

$default_html = <<<'GOODJOB_APPLICATIONS_HTML'
<section id="applications" class="ai-section applications-horizontal-card-preview"><style>#applications{position:relative;padding:clamp(44px,6vw,78px) 0;background:linear-gradient(180deg,#0C214E 0%,#112E6C 18%,#F8FAFC 100%);color:#16202E;overflow:hidden}#applications:before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,rgba(14,165,233,.08) 1px,transparent 1px),linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px);background-size:26px 26px,26px 26px;opacity:.35}#applications .wrap{position:relative;z-index:1;max-width:1280px;margin:0 auto;padding:0 20px}#applications .head{display:grid;gap:12px;margin-bottom:24px}#applications .eyebrow{display:inline-flex;align-items:center;gap:10px;color:#fff;font-size:12px;letter-spacing:.14em;text-transform:uppercase}#applications .eyebrow:before{content:"";width:42px;height:2px;background:linear-gradient(90deg,#0EA5E9,#2563EB)}#applications h2{margin:0;color:#fff;font-size:clamp(28px,4vw,44px);line-height:1.08}#applications .intro{max-width:780px;color:#dbe7ff;font-size:15px}#applications .rail{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(290px,380px);gap:18px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:8px}#applications article{scroll-snap-align:start;display:grid;grid-template-rows:auto auto auto auto;height:100%;background:#F8FAFC;border:1px solid #E2E7EE;box-shadow:0 10px 24px rgba(12,33,78,.08)}#applications article:hover{transform:translateY(-3px);transition:transform .25s ease,border-color .25s ease;border-color:#0EA5E9}#applications .tabs{display:flex;flex-wrap:wrap;gap:8px;padding:16px 16px 10px;border-bottom:1px solid #E2E7EE;background:linear-gradient(180deg,#112E6C,#2563EB)}#applications .tab{padding:7px 10px;border:1px solid rgba(255,255,255,.24);color:#fff;font-size:12px;text-transform:uppercase;letter-spacing:.08em}#applications .tab.brand{background:linear-gradient(90deg,#0EA5E9,#2563EB);border-color:transparent}#applications .env{display:grid;gap:10px;padding:16px;border-bottom:1px solid #E2E7EE;background:linear-gradient(180deg,rgba(14,165,233,.08),rgba(37,99,235,.03))}#applications .row{display:grid;gap:6px;padding:10px 12px;border-left:3px solid #2563EB;background:#fff}#applications .k{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#112E6C}#applications .v{font-size:14px;color:#3C4858}#applications .pain{display:inline-block;padding:6px 10px;background:#0C214E;color:#fff;font-size:12px}#applications .products{display:flex;flex-wrap:wrap;gap:8px;padding:16px;border-bottom:1px solid #E2E7EE}#applications .chip{padding:7px 10px;border:1px solid #B9D7FB;background:#fff;color:#112E6C;font-size:12px}#applications .rfq{display:grid;gap:12px;padding:16px}#applications .note{font-size:14px;color:#3C4858}#applications .cta{display:inline-flex;align-items:center;justify-content:center;padding:11px 16px;border-radius:999px;background:linear-gradient(90deg,#2563EB,#0EA5E9);color:#fff;text-decoration:none;font-weight:600}#applications .cta:hover{filter:brightness(1.04)}#applications .wave{height:6px;background:linear-gradient(90deg,#0EA5E9,#2563EB,#0EA5E9);background-size:180% 100%;animation:#applications-wave 5s linear infinite}#applications .rail::-webkit-scrollbar{height:8px}#applications .rail::-webkit-scrollbar-thumb{background:#B9D7FB}#applications .rail::-webkit-scrollbar-track{background:transparent}@keyframes #applications-wave{to{background-position:180% 0}}@media(max-width:760px){#applications .rail{grid-auto-flow:row;grid-auto-columns:auto;grid-template-columns:minmax(0,1fr)}#applications .intro{font-size:14px}#applications .tabs{padding:14px}#applications article{min-width:0}}</style><div class="wrap"><div class="head"><div class="eyebrow">Industry Matrix / Ocean Applications</div><h2>Marine application scenarios built for research-grade decisions</h2><div class="intro">Explore operating environments, buyer pain points, recommended categories, and RFQ notes across marine fish, plants, water quality, and resource programs.</div></div><div class="rail"><article><div class="tabs"><span class="tab brand">Marine Fish</span><span class="tab">Industry Matrix</span></div><div class="env"><div class="row"><span class="k">Environment</span><span class="v">Offshore cages, hatcheries, coastal monitoring labs</span></div><span class="pain">Pain point: unstable survival and feeding data</span></div><div class="products"><span class="chip">海洋鱼类</span><span class="chip">sensor-ready sampling kits</span><span class="chip">monitoring modules</span></div><div class="rfq"><div class="note">Outcome: faster stock health checks and more consistent breeding decisions. RFQ note: share salinity range, tank volume, and monitoring frequency.</div><a class="cta" href="/contact-us/">Discuss Fish Project</a></div><div class="wave"></div></article><article><div class="tabs"><span class="tab brand">Marine Plants</span><span class="tab">Industry Matrix</span></div><div class="env"><div class="row"><span class="k">Environment</span><span class="v">Seaweed farms, algae culture rooms, pilot bioresearch plots</span></div><span class="pain">Pain point: uneven growth under changing light and nutrient loads</span></div><div class="products"><span class="chip">海洋植物</span><span class="chip">cultivation systems</span><span class="chip">lab analysis tools</span></div><div class="rfq"><div class="note">Outcome: clearer growth benchmarking and better harvest planning. RFQ note: send target species, lighting profile, and batch size.</div><a class="cta" href="/contact-us/">Discuss Plant Project</a></div><div class="wave"></div></article><article><div class="tabs"><span class="tab brand">Water Quality</span><span class="tab">Industry Matrix</span></div><div class="env"><div class="row"><span class="k">Environment</span><span class="v">Ports, recirculating systems, coastal survey stations</span></div><span class="pain">Pain point: delayed response to turbidity, oxygen, and contamination shifts</span></div><div class="products"><span class="chip">海洋水质</span><span class="chip">probe platforms</span><span class="chip">data logging units</span></div><div class="rfq"><div class="note">Outcome: tighter compliance control and fewer blind spots in field sampling. RFQ note: specify parameters, deployment depth, and reporting format.</div><a class="cta" href="/contact-us/">Discuss Water Project</a></div><div class="wave"></div></article><article><div class="tabs"><span class="tab brand">Marine Resources</span><span class="tab">Industry Matrix</span></div><div class="env"><div class="row"><span class="k">Environment</span><span class="v">Seabed survey programs, resource mapping, academic expeditions</span></div><span class="pain">Pain point: fragmented field data and low-confidence resource evaluation</span></div><div class="products"><span class="chip">海洋资源</span><span class="chip">survey packages</span><span class="chip">research instrumentation</span></div><div class="rfq"><div class="note">Outcome: stronger site comparison and cleaner evidence for investment or grant review. RFQ note: include mission duration, platform type, and sample objectives.</div><a class="cta" href="/contact-us/">Discuss Resource Project</a></div><div class="wave"></div></article></div></div></section>
GOODJOB_APPLICATIONS_HTML;
$html_source = function_exists('get_field') ? get_field('html_source') : '';
if (is_string($html_source) && trim($html_source) !== '') {
    echo $html_source; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    return;
}

$eyebrow = function_exists('get_field') ? (get_field('eyebrow') ?: "Applications") : "Applications";
$title = function_exists('get_field') ? (get_field('title') ?: "Marine application scenarios built for research-grade decisions") : "Marine application scenarios built for research-grade decisions";
$intro = function_exists('get_field') ? (get_field('intro') ?: "Applications section content generated by GoodJob AI Website Factory.") : "Applications section content generated by GoodJob AI Website Factory.";
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
    || $title !== "Marine application scenarios built for research-grade decisions"
    || $intro !== "Applications section content generated by GoodJob AI Website Factory."
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
    if ($title !== "Marine application scenarios built for research-grade decisions") {
        $editable_html = preg_replace_callback('/<h([1-3])\b([^>]*)>.*?<\/h\1>/is', function ($matches) use ($title) {
            return '<h' . $matches[1] . $matches[2] . '>' . esc_html($title) . '</h' . $matches[1] . '>';
        }, $editable_html, 1) ?: $editable_html;
    }
    if ($intro !== "Applications section content generated by GoodJob AI Website Factory.") {
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
