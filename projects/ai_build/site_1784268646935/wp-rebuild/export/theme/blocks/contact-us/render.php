<?php
if (!defined('ABSPATH')) {
    exit;
}

$default_html = <<<'GOODJOB_CONTACT_US_HTML'
<section id="contact-us" class="ai-section contact-inquiry-section"><style>#contact-us{padding:clamp(28px,4vw,56px);background:linear-gradient(180deg,#0C214E 0%,#112E6C 52%,#F8FAFC 52%,#F8FAFC 100%);color:#16202E;position:relative;overflow:hidden}#contact-us:before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(14,165,233,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(14,165,233,.08) 1px,transparent 1px);background-size:28px 28px;pointer-events:none}#contact-us .wrap{position:relative;z-index:1;max-width:1180px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1.05fr) minmax(320px,520px);gap:clamp(18px,3vw,32px);align-items:start}#contact-us .trust{background:linear-gradient(180deg,rgba(12,33,78,.96),rgba(17,46,108,.94));color:#fff;border:1px solid rgba(68,121,238,.25);padding:clamp(20px,3vw,34px);clip-path:polygon(0 0,96% 0,100% 14%,100% 100%,4% 100%,0 86%)}#contact-us .eyebrow{display:inline-flex;align-items:center;gap:8px;padding:7px 12px;border:1px solid rgba(14,165,233,.35);background:rgba(14,165,233,.1);color:#BFE9FF;font-size:12px;letter-spacing:.14em;text-transform:uppercase}#contact-us h2{margin:14px 0 12px;font-size:clamp(28px,4.2vw,44px);line-height:1.08;color:#fff}#contact-us .lead{margin:0 0 18px;color:#D7E7FF;max-width:60ch}#contact-us .chips{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 18px}#contact-us .chip{padding:8px 12px;border:1px solid rgba(68,121,238,.28);background:rgba(255,255,255,.04);color:#EAF4FF;font-size:13px}#contact-us .channels{display:grid;gap:10px;margin:0 0 18px}#contact-us .channel{display:flex;align-items:flex-start;gap:12px;padding:12px 14px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#EAF4FF}#contact-us .icon{width:18px;height:18px;flex:0 0 18px;stroke:#0EA5E9;stroke-width:1.8;fill:none;margin-top:2px}#contact-us .muted{color:#9FB6DA}#contact-us .checklist{display:grid;gap:9px;margin-top:8px;padding-top:14px;border-top:1px solid rgba(255,255,255,.12)}#contact-us .item{display:flex;gap:10px;align-items:flex-start;color:#EAF4FF}#contact-us .item .icon{stroke:#7DD3FC}#contact-us .promise{margin-top:14px;color:#BFE9FF;font-size:13px}#contact-us .form-card{background:#ffffff;border:1px solid #E2E7EE;box-shadow:0 14px 34px rgba(12,33,78,.12);padding:clamp(18px,3vw,28px);animation:#contact-us-card .6s ease both}#contact-us h3{margin:0 0 6px;font-size:clamp(24px,3vw,30px);color:#112E6C}#contact-us .sub{margin:0 0 16px;color:#3C4858}#contact-us form{display:grid;gap:12px}#contact-us .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}#contact-us label{display:grid;gap:6px;font-size:13px;color:#112E6C;font-weight:600}#contact-us input,#contact-us textarea{width:100%;border:1px solid #D6E2F0;background:#F8FAFC;color:#16202E;padding:13px 14px;border-radius:12px;outline:none;transition:border-color .2s ease,transform .2s ease,background .2s ease}#contact-us input:focus,#contact-us textarea:focus{border-color:#0EA5E9;background:#fff;transform:translateY(-1px)}#contact-us textarea{min-height:132px;resize:vertical}#contact-us .submit{display:inline-flex;align-items:center;justify-content:center;gap:10px;border:none;border-radius:14px;padding:14px 18px;background:linear-gradient(90deg,#2563EB,#0EA5E9);color:#fff;font-weight:700;letter-spacing:.02em;cursor:pointer;transition:transform .2s ease,box-shadow .2s ease}#contact-us .submit:hover{transform:translateY(-2px);box-shadow:0 10px 22px rgba(37,99,235,.24)}#contact-us .fine{font-size:12px;color:#6B7686}#contact-us .wave{height:6px;margin:0 0 14px;background:linear-gradient(90deg,#2563EB,#0EA5E9,#2563EB);mask:radial-gradient(10px 6px at 10px 100%,#0000 98%,#000) 0 0/20px 100% repeat-x}@keyframes #contact-us-card{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}@media(max-width:980px){#contact-us{background:linear-gradient(180deg,#0C214E 0%,#112E6C 44%,#F8FAFC 44%,#F8FAFC 100%)}#contact-us .wrap{grid-template-columns:1fr}#contact-us .form-card{max-width:none}}@media(max-width:640px){#contact-us{padding:20px 14px}#contact-us .grid{grid-template-columns:1fr}#contact-us .trust,#contact-us .form-card{padding:18px}#contact-us h2{font-size:30px}}</style><div class="wrap"><div class="trust"><div class="eyebrow">START YOUR PROJECT</div><h2>Connect with Ocean research teams for marine science sourcing and project planning.</h2><p class="lead">Discuss marine fish, marine plants, water quality, and ocean resource programs with a buyer-ready inquiry flow. Share your specifications, target quantity, and application goals to receive a practical proposal for research cooperation, sample planning, or technical supply support.</p><div class="chips"><span class="chip">Marine Fish</span><span class="chip">Marine Plants</span><span class="chip">Water Quality</span><span class="chip">Ocean Resources</span></div><div class="channels"><div class="channel"><svg class="icon" viewBox="0 0 24 24" id="icon-phone"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.3 19.3 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.5 3a2 2 0 0 1-.6 1.8l-1.3 1.3a16 16 0 0 0 6.3 6.3l1.3-1.3a2 2 0 0 1 1.8-.6l3 .5A2 2 0 0 1 22 16.9z"/></svg><div><strong>Phone</strong><div class="muted">Available on request after inquiry review</div></div></div><div class="channel"><svg class="icon" viewBox="0 0 24 24" id="icon-mail"><path d="M4 5h16v14H4z"/><path d="m4 7 8 6 8-6"/></svg><div><strong>Email</strong><div class="muted">Submit the form for direct project routing</div></div></div><div class="channel"><svg class="icon" viewBox="0 0 24 24" id="icon-location"><path d="M12 21s-6-5.3-6-11a6 6 0 1 1 12 0c0 5.7-6 11-6 11z"/><circle cx="12" cy="10" r="2.5"/></svg><div><strong>Location</strong><div class="muted">Marine research coordination from China</div></div></div></div><div class="checklist"><div class="item"><svg class="icon" viewBox="0 0 24 24" id="icon-check"><path d="M20 6 9 17l-5-5"/></svg><span>Clear RFQ intake for research, sampling, and technical supply needs</span></div><div class="item"><svg class="icon" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg><span>Fast review of category, capacity, quantity, and project timeline</span></div><div class="item"><svg class="icon" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg><span>Practical response with next-step recommendations</span></div></div><div class="promise">Response promise: concise review and proposal follow-up after receiving complete project details.</div></div><div class="form-card"><div class="wave"></div><h3>Request a Free Proposal</h3><p class="sub">Tell us what you need and our team will route your inquiry to the right marine research category.</p><form action="#contact-us" method="post"><div class="grid"><label>Your name*<input type="text" name="name" required></label><label>Country<input type="text" name="country"></label></div><div class="grid"><label>Email*<input type="email" name="email" required></label><label>Product / project type<input type="text" name="project_type"></label></div><label>Target capacity / quantity<input type="text" name="capacity"></label><label>Project details<textarea name="details"></textarea></label><button class="submit" type="submit"><svg class="icon" viewBox="0 0 24 24" id="icon-send"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7Z"/></svg>SEND INQUIRY</button><div class="fine">By sending this inquiry, you help us prepare a more accurate marine project proposal.</div></form></div></div></section>
GOODJOB_CONTACT_US_HTML;
$html_source = function_exists('get_field') ? get_field('html_source') : '';
if (is_string($html_source) && trim($html_source) !== '') {
    echo $html_source; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    return;
}

$eyebrow = function_exists('get_field') ? (get_field('eyebrow') ?: "Contact Us") : "Contact Us";
$title = function_exists('get_field') ? (get_field('title') ?: "Connect with Ocean research teams for marine science sourcing and project planning.") : "Connect with Ocean research teams for marine science sourcing and project planning.";
$intro = function_exists('get_field') ? (get_field('intro') ?: "Discuss marine fish, marine plants, water quality, and ocean resource programs with a buyer-ready inquiry flow. Share your specifications, target quantity, and application goals to receive a practical proposal for research cooperation, sample planning, or tech") : "Discuss marine fish, marine plants, water quality, and ocean resource programs with a buyer-ready inquiry flow. Share your specifications, target quantity, and application goals to receive a practical proposal for research cooperation, sample planning, or tech";
$primary_label = function_exists('get_field') ? (get_field('primary_label') ?: "Send Inquiry") : "Send Inquiry";
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
    || $eyebrow !== "Contact Us"
    || $title !== "Connect with Ocean research teams for marine science sourcing and project planning."
    || $intro !== "Discuss marine fish, marine plants, water quality, and ocean resource programs with a buyer-ready inquiry flow. Share your specifications, target quantity, and application goals to receive a practical proposal for research cooperation, sample planning, or tech"
    || $primary_label !== "Send Inquiry"
    || $primary_url !== "/contact-us/";
if (!$has_structured_edits) {
    echo $default_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    return;
}
if (!$image_url) {
    $editable_html = $default_html;
    if ($eyebrow !== "Contact Us") {
        $editable_html = preg_replace_callback("/<(span|div)\\b([^>]*class=[\"'][^\"']*(?:eyebrow|badge|tag)[^\"']*[\"'][^>]*)>.*?<\\/\\1>/is", function ($matches) use ($eyebrow) {
            return '<' . $matches[1] . $matches[2] . '>' . esc_html($eyebrow) . '</' . $matches[1] . '>';
        }, $editable_html, 1) ?: $editable_html;
    }
    if ($title !== "Connect with Ocean research teams for marine science sourcing and project planning.") {
        $editable_html = preg_replace_callback('/<h([1-3])\b([^>]*)>.*?<\/h\1>/is', function ($matches) use ($title) {
            return '<h' . $matches[1] . $matches[2] . '>' . esc_html($title) . '</h' . $matches[1] . '>';
        }, $editable_html, 1) ?: $editable_html;
    }
    if ($intro !== "Discuss marine fish, marine plants, water quality, and ocean resource programs with a buyer-ready inquiry flow. Share your specifications, target quantity, and application goals to receive a practical proposal for research cooperation, sample planning, or tech") {
        $editable_html = preg_replace_callback('/<p\b([^>]*)>.*?<\/p>/is', function ($matches) use ($intro) {
            return '<p' . $matches[1] . '>' . esc_html($intro) . '</p>';
        }, $editable_html, 1) ?: $editable_html;
    }
    if ($primary_label !== "Send Inquiry" || $primary_url !== "/contact-us/") {
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
<section class="ai-section goodjob-acf-block goodjob-acf-block-<?php echo esc_attr('contact-us'); ?>" id="<?php echo esc_attr('contact-us'); ?>">
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
