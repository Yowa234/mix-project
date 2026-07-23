<?php
if (!defined('ABSPATH')) {
    exit;
}

$default_html = <<<'GOODJOB_HERO_HTML'
<section id="home" class="ai-hero ai-photo-hero" data-hero-image-api="/api/ai-site-builder/projects/{projectId}/hero-backgrounds"><style>#home{position:relative;min-height:72vh;color:#fff;overflow:hidden;background:#0C214E;font-family:inherit}#home .sr{position:absolute;opacity:0;pointer-events:none}#home .slides{position:absolute;inset:0}#home .bg{position:absolute;inset:0;background-size:cover;background-position:center;opacity:0;transform:scale(1.03);transition:opacity .7s ease,transform 1.2s ease}#home .bg::before{content:"";position:absolute;inset:0;background:linear-gradient(110deg,rgba(12,33,78,.86) 0%,rgba(17,46,108,.76) 38%,rgba(14,165,233,.18) 100%)}#home .bg::after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 18% 78%,rgba(14,165,233,.22),transparent 28%),repeating-linear-gradient(90deg,rgba(248,250,252,.06) 0 1px,transparent 1px 42px),repeating-linear-gradient(0deg,rgba(248,250,252,.04) 0 1px,transparent 1px 42px);mix-blend-mode:screen}#home #s1:checked~.slides .b1,#home #s2:checked~.slides .b2,#home #s3:checked~.slides .b3{opacity:1;transform:scale(1)}#home .inner{position:relative;z-index:2;min-height:72vh;display:flex;align-items:center;padding:clamp(84px,10vw,132px) 6vw 88px}#home .content{max-width:760px}#home .badge{display:inline-flex;align-items:center;gap:10px;padding:8px 14px;border:1px solid rgba(14,165,233,.42);background:rgba(37,99,235,.14);color:#F8FAFC;border-radius:999px;font-size:12px;letter-spacing:.16em;text-transform:uppercase;backdrop-filter:blur(6px)}#home .badge::before{content:"";width:8px;height:8px;border-radius:50%;background:#0EA5E9;box-shadow:0 0 0 4px rgba(14,165,233,.16)}#home h1{margin:16px 0 12px;max-width:12ch;font-size:clamp(2.2rem,5.7vw,5rem);line-height:.98;letter-spacing:-.04em;text-wrap:balance;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}#home p{max-width:62ch;margin:0 0 22px;color:rgba(248,250,252,.88);font-size:clamp(1rem,1.5vw,1.1rem);line-height:1.7}#home .rule{width:92px;height:2px;margin:18px 0;background:linear-gradient(90deg,#0EA5E9,#2563EB)}#home .cta{display:flex;gap:14px;flex-wrap:wrap}#home .btn{display:inline-flex;align-items:center;justify-content:center;padding:14px 20px;border-radius:14px;text-decoration:none;font-weight:700;border:1px solid transparent;transition:transform .2s ease,background .2s ease,border-color .2s ease,color .2s ease}#home .btn:hover{transform:translateY(-1px)}#home .btn.primary{background:#2563EB;color:#fff;border-color:#4479EE;box-shadow:inset 0 1px 0 rgba(255,255,255,.14)}#home .btn.secondary{background:rgba(248,250,252,.08);color:#fff;border-color:rgba(248,250,252,.24)}#home .chips{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}#home .chip{padding:8px 12px;border:1px solid rgba(226,231,238,.2);background:rgba(248,250,252,.08);color:#F8FAFC;border-radius:999px;font-size:12px;letter-spacing:.04em}#home .controls{position:absolute;right:6vw;bottom:28px;z-index:3;display:flex;align-items:center;gap:10px}#home .status{min-width:62px;text-align:center;padding:10px 12px;border:1px solid rgba(14,165,233,.28);background:rgba(17,46,108,.5);color:#F8FAFC;border-radius:12px;font-variant-numeric:tabular-nums}#home .arrows{display:flex;gap:10px}#home .nav{display:none;width:46px;height:46px;align-items:center;justify-content:center;border-radius:12px;border:1px solid rgba(37,99,235,.45);background:rgba(248,250,252,.08);color:#fff;cursor:pointer;transition:background .2s ease,border-color .2s ease,transform .2s ease}#home .nav:hover,#home .nav:focus{background:#2563EB;border-color:#0EA5E9;transform:translateY(-1px)}#home .nav svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2.2}#home #s1:checked~.controls .st1,#home #s2:checked~.controls .st2,#home #s3:checked~.controls .st3{display:inline-block}#home .status span{display:none}#home #s1:checked~.controls .p1,#home #s1:checked~.controls .n1,#home #s2:checked~.controls .p2,#home #s2:checked~.controls .n2,#home #s3:checked~.controls .p3,#home #s3:checked~.controls .n3{display:flex}#home .wave{position:absolute;left:0;right:0;bottom:0;height:90px;z-index:2;background:linear-gradient(180deg,transparent,rgba(248,250,252,.06));clip-path:path('M0,48 C180,14 320,82 520,48 C720,16 880,84 1080,50 C1280,18 1440,84 1600,42 L1600,90 L0,90 Z')}@media(max-width:760px){#home .inner{padding:92px 20px 96px}#home h1{max-width:11ch;font-size:clamp(2rem,11vw,3.4rem)}#home p{max-width:100%}#home .controls{right:20px;bottom:18px}#home .status{min-width:56px}#home .nav{width:42px;height:42px}}</style><input class="sr" type="radio" name="hero-slide" id="s1" checked><input class="sr" type="radio" name="hero-slide" id="s2"><input class="sr" type="radio" name="hero-slide" id="s3"><div class="slides"><div class="bg b1" data-upload-slot="hero-background-1" style="background-image:url('https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1800&q=80');"></div><div class="bg b2" data-upload-slot="hero-background-2" style="background-image:url('https://images.unsplash.com/photo-1494412574643-ff11b0a5c1c3?auto=format&fit=crop&w=1800&q=80');"></div><div class="bg b3" data-upload-slot="hero-background-3" style="background-image:url('https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1800&q=80');"></div></div><div class="inner"><div class="content"><div class="badge">Ocean / Research-Grade Export Supply</div><h1>Marine Science Systems for Global Industrial Delivery</h1><div class="rule"></div><p>Ocean supports research-driven buyers with high-precision manufacturing, export-ready coordination, and dependable lead times for advanced marine and technical applications.</p><div class="cta"><a class="btn primary" href="/contact-us/">Request a Proposal</a><a class="btn secondary" href="/products/">Learn More</a></div><div class="chips"><span class="chip">Export Documentation Ready</span><span class="chip">Precision Production</span><span class="chip">Delivery Capability</span></div></div></div><div class="wave"></div><div class="controls"><div class="status"><span class="st1">01 / 03</span><span class="st2">02 / 03</span><span class="st3">03 / 03</span></div><div class="arrows"><label class="nav p1" for="s3" aria-label="Previous slide"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></label><label class="nav n1" for="s2" aria-label="Next slide"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></label><label class="nav p2" for="s1" aria-label="Previous slide"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></label><label class="nav n2" for="s3" aria-label="Next slide"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></label><label class="nav p3" for="s2" aria-label="Previous slide"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></label><label class="nav n3" for="s1" aria-label="Next slide"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></label></div></div></section>
GOODJOB_HERO_HTML;
$html_source = function_exists('get_field') ? get_field('html_source') : '';
if (is_string($html_source) && trim($html_source) !== '') {
    echo $html_source; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    return;
}

$eyebrow = function_exists('get_field') ? (get_field('eyebrow') ?: "Hero") : "Hero";
$title = function_exists('get_field') ? (get_field('title') ?: "Marine Science Systems for Global Industrial Delivery") : "Marine Science Systems for Global Industrial Delivery";
$intro = function_exists('get_field') ? (get_field('intro') ?: "Ocean supports research-driven buyers with high-precision manufacturing, export-ready coordination, and dependable lead times for advanced marine and technical applications.") : "Ocean supports research-driven buyers with high-precision manufacturing, export-ready coordination, and dependable lead times for advanced marine and technical applications.";
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
    || $title !== "Marine Science Systems for Global Industrial Delivery"
    || $intro !== "Ocean supports research-driven buyers with high-precision manufacturing, export-ready coordination, and dependable lead times for advanced marine and technical applications."
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
    if ($title !== "Marine Science Systems for Global Industrial Delivery") {
        $editable_html = preg_replace_callback('/<h([1-3])\b([^>]*)>.*?<\/h\1>/is', function ($matches) use ($title) {
            return '<h' . $matches[1] . $matches[2] . '>' . esc_html($title) . '</h' . $matches[1] . '>';
        }, $editable_html, 1) ?: $editable_html;
    }
    if ($intro !== "Ocean supports research-driven buyers with high-precision manufacturing, export-ready coordination, and dependable lead times for advanced marine and technical applications.") {
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
