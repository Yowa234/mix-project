<?php
if (!defined('ABSPATH')) {
    exit;
}

$default_html = <<<'GOODJOB_HERO_HTML'
<section id="home" class="ai-hero ai-photo-hero" data-hero-image-api="/api/ai-site-builder/projects/{projectId}/hero-backgrounds"><style>#home{position:relative;min-height:72vh;color:#ffffff;overflow:hidden;background:#0C214E;font-family:Inter,system-ui,sans-serif}#home .sr{position:absolute;opacity:0;pointer-events:none}#home .bg{position:absolute;inset:0;background-size:cover;background-position:center;opacity:0;transform:scale(1.03);transition:opacity .6s ease,transform .8s ease}#home .bg:before{content:"";position:absolute;inset:0;background:linear-gradient(110deg,rgba(17,46,108,.88) 0%,rgba(12,33,78,.72) 42%,rgba(14,165,233,.18) 100%),linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:auto,32px 32px,32px 32px}#home .bg1{background-image:url(https://images.unsplash.com/photo-1513828583688-c52646db42da?auto=format&fit=crop&w=1800&q=80)}#home .bg2{background-image:url(https://images.unsplash.com/photo-1565008447742-97f6f38c985c?auto=format&fit=crop&w=1800&q=80)}#home .bg3{background-image:url(https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=1800&q=80)}#home #s1:checked~.bg1,#home #s2:checked~.bg2,#home #s3:checked~.bg3{opacity:1;transform:scale(1)}#home .inner{position:relative;z-index:2;display:flex;align-items:flex-end;min-height:72vh;padding:clamp(88px,11vw,132px) clamp(20px,5vw,72px) clamp(40px,6vw,56px)}#home .copy{max-width:min(760px,92vw)}#home .eyebrow{display:inline-flex;align-items:center;gap:10px;padding:8px 14px;border:1px solid rgba(68,121,238,.45);background:linear-gradient(180deg,rgba(37,99,235,.24),rgba(14,165,233,.12));color:#F8FAFC;border-radius:999px;font-size:12px;letter-spacing:.14em;text-transform:uppercase}#home .eyebrow:before{content:"";width:8px;height:8px;border-radius:50%;background:#0EA5E9;box-shadow:0 0 0 4px rgba(14,165,233,.16)}#home h1{margin:16px 0 12px;max-width:11ch;font-size:clamp(2.2rem,5.6vw,5rem);line-height:1.02;letter-spacing:-.03em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-wrap:balance}#home .sub{max-width:62ch;margin:0 0 22px;color:rgba(248,250,252,.86);font-size:clamp(1rem,1.45vw,1.1rem);line-height:1.65}#home .actions{display:flex;gap:12px;flex-wrap:wrap}#home .btn{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 18px;border-radius:14px;text-decoration:none;font-weight:700;border:1px solid transparent;transition:.25s ease}#home .btn.primary{background:#2563EB;color:#ffffff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}#home .btn.secondary{background:rgba(248,250,252,.08);color:#ffffff;border-color:rgba(226,231,238,.28);backdrop-filter:blur(6px)}#home .btn:hover{transform:translateY(-1px)}#home .chips{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}#home .chip{padding:8px 12px;border-radius:999px;border:1px solid rgba(226,231,238,.18);background:rgba(22,32,46,.28);color:#F8FAFC;font-size:12px}#home .chip strong{color:#0EA5E9;font-weight:700}#home .controls{position:absolute;right:clamp(16px,3vw,30px);bottom:clamp(16px,3vw,24px);z-index:3;display:flex;align-items:center;gap:10px}#home .status{min-width:72px;padding:9px 12px;border-radius:12px;background:rgba(12,33,78,.52);border:1px solid rgba(68,121,238,.32);color:#F8FAFC;font-size:12px;letter-spacing:.18em;text-align:center}#home .arrowset{display:none;gap:8px}#home .arrow{width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;border-radius:12px;background:rgba(248,250,252,.08);border:1px solid rgba(226,231,238,.2);color:#ffffff;cursor:pointer;transition:.25s ease}#home .arrow:hover,#home .arrow:focus-visible{background:#2563EB;border-color:#0EA5E9;outline:none}#home .arrow:before{content:"";width:10px;height:10px;border-top:2px solid currentColor;border-right:2px solid currentColor;transform:rotate(225deg);margin-left:4px}#home .next:before{transform:rotate(45deg);margin-left:0;margin-right:4px}#home #s1:checked~.controls .for1,#home #s2:checked~.controls .for2,#home #s3:checked~.controls .for3{display:flex}#home #s1:checked~.controls .t1,#home #s2:checked~.controls .t2,#home #s3:checked~.controls .t3{display:block}#home .status span{display:none}#home .copy>*{animation:heroReveal .7s ease both}#home .copy>:nth-child(2){animation-delay:.08s}#home .copy>:nth-child(3){animation-delay:.14s}#home .copy>:nth-child(4){animation-delay:.2s}#home .copy>:nth-child(5){animation-delay:.26s}@keyframes heroReveal{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}@media(max-width:760px){#home .inner{padding:92px 18px 84px}#home h1{max-width:12ch;font-size:clamp(2rem,10vw,3.2rem)}#home .actions{flex-direction:column;align-items:stretch}#home .btn{width:100%}#home .controls{left:18px;right:18px;justify-content:space-between}#home .status{min-width:auto}}</style><input class="sr" type="radio" name="hero-slider" id="s1" checked><input class="sr" type="radio" name="hero-slider" id="s2"><input class="sr" type="radio" name="hero-slider" id="s3"><div class="bg bg1" data-upload-slot="hero-background-1"></div><div class="bg bg2" data-upload-slot="hero-background-2"></div><div class="bg bg3" data-upload-slot="hero-background-3"></div><div class="inner"><div class="copy"><div class="eyebrow">阿里云 服务器方案</div><h1>Scale Critical Workloads with<br>Alibaba Cloud Server Infrastructure</h1><p class="sub">Built for export-ready manufacturing and technical operations, 阿里云 delivers resilient server capacity, rapid deployment confidence, and enterprise-grade performance for demanding industrial workflows.</p><div class="actions"><a class="btn primary" href="/contact-us/">Request a Proposal</a><a class="btn secondary" href="/products/">Learn More</a></div><div class="chips"><span class="chip"><strong>Fast</strong> deployment support</span><span class="chip"><strong>Stable</strong> global delivery readiness</span><span class="chip"><strong>Secure</strong> infrastructure backbone</span></div></div></div><div class="controls"><div class="status"><span class="t1">01 / 03</span><span class="t2">02 / 03</span><span class="t3">03 / 03</span></div><div class="arrowset for1"><label class="arrow prev" for="s3" aria-label="Previous slide"></label><label class="arrow next" for="s2" aria-label="Next slide"></label></div><div class="arrowset for2"><label class="arrow prev" for="s1" aria-label="Previous slide"></label><label class="arrow next" for="s3" aria-label="Next slide"></label></div><div class="arrowset for3"><label class="arrow prev" for="s2" aria-label="Previous slide"></label><label class="arrow next" for="s1" aria-label="Next slide"></label></div></div></section>
GOODJOB_HERO_HTML;
$html_source = function_exists('get_field') ? get_field('html_source') : '';
if (is_string($html_source) && trim($html_source) !== '') {
    echo $html_source; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    return;
}

$eyebrow = function_exists('get_field') ? (get_field('eyebrow') ?: "Hero") : "Hero";
$title = function_exists('get_field') ? (get_field('title') ?: "Scale Critical Workloads with Alibaba Cloud Server Infrastructure") : "Scale Critical Workloads with Alibaba Cloud Server Infrastructure";
$intro = function_exists('get_field') ? (get_field('intro') ?: "Built for export-ready manufacturing and technical operations, 阿里云 delivers resilient server capacity, rapid deployment confidence, and enterprise-grade performance for demanding industrial workflows.") : "Built for export-ready manufacturing and technical operations, 阿里云 delivers resilient server capacity, rapid deployment confidence, and enterprise-grade performance for demanding industrial workflows.";
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
    || $eyebrow !== "Hero"
    || $title !== "Scale Critical Workloads with Alibaba Cloud Server Infrastructure"
    || $intro !== "Built for export-ready manufacturing and technical operations, 阿里云 delivers resilient server capacity, rapid deployment confidence, and enterprise-grade performance for demanding industrial workflows."
    || $primary_label !== "Request a Proposal"
    || $primary_url !== "/contact-us/";
if (!$has_structured_edits) {
    echo $default_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    return;
}
if (!$image_url) {
    $editable_html = $default_html;
    if ($eyebrow !== "Hero") {
        $editable_html = preg_replace_callback("/<(span|div)\\b([^>]*class=[\"'][^\"']*(?:eyebrow|badge|tag)[^\"']*[\"'][^>]*)>.*?<\\/\\1>/is", function ($matches) use ($eyebrow) {
            return '<' . $matches[1] . $matches[2] . '>' . esc_html($eyebrow) . '</' . $matches[1] . '>';
        }, $editable_html, 1) ?: $editable_html;
    }
    if ($title !== "Scale Critical Workloads with Alibaba Cloud Server Infrastructure") {
        $editable_html = preg_replace_callback('/<h([1-3])\b([^>]*)>.*?<\/h\1>/is', function ($matches) use ($title) {
            return '<h' . $matches[1] . $matches[2] . '>' . esc_html($title) . '</h' . $matches[1] . '>';
        }, $editable_html, 1) ?: $editable_html;
    }
    if ($intro !== "Built for export-ready manufacturing and technical operations, 阿里云 delivers resilient server capacity, rapid deployment confidence, and enterprise-grade performance for demanding industrial workflows.") {
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
<section class="ai-section goodjob-acf-block goodjob-acf-block-<?php echo esc_attr('hero'); ?>" id="<?php echo esc_attr('home'); ?>">
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
