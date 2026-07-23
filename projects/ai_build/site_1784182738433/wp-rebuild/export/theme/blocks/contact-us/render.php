<?php
if (!defined('ABSPATH')) {
    exit;
}

$default_html = <<<'GOODJOB_CONTACT_US_HTML'
<section id="contact-us" class="ai-section contact-inquiry-section"><style>#contact-us{padding:clamp(24px,4vw,48px);background:linear-gradient(135deg,#0c214e 0%,#112e6c 52%,#f8fafc 52%,#f8fafc 100%);font-family:Arial,sans-serif;color:#16202e}#contact-us *{box-sizing:border-box}#contact-us .wrap{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:minmax(280px,1.02fr) minmax(320px,.98fr);gap:clamp(18px,2.4vw,30px);align-items:start}#contact-us .trust{background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.14);color:#fff;padding:clamp(20px,3vw,30px);position:relative;overflow:hidden}#contact-us .trust:before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px);background-size:22px 22px;opacity:.18;pointer-events:none}#contact-us .trust>*{position:relative;z-index:1}#contact-us .eyebrow{display:inline-block;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#8fd3ff;margin-bottom:10px;font-weight:700}#contact-us h2{margin:0 0 10px;font-size:clamp(28px,3.2vw,42px);line-height:1.08;color:#fff}#contact-us .intro{margin:0 0 16px;color:rgba(255,255,255,.86);max-width:58ch;line-height:1.6}#contact-us .channels{display:grid;gap:10px;margin:14px 0 16px}#contact-us .channel{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05)}#contact-us .icon{flex:0 0 18px;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;color:#8fd3ff;font-weight:700}#contact-us .channel strong{display:block;font-size:13px;color:#fff;margin-bottom:2px}#contact-us .channel span{font-size:14px;color:rgba(255,255,255,.84)}#contact-us .checklist{margin:12px 0 0;padding:0;list-style:none;display:grid;gap:8px}#contact-us .checklist li{display:flex;gap:10px;align-items:flex-start;color:rgba(255,255,255,.9);font-size:14px;line-height:1.5}#contact-us .form-card{background:#fff;border:1px solid #e2e7ee;padding:clamp(20px,3vw,30px);box-shadow:0 18px 44px rgba(12,33,78,.12);animation:#contact-us-card .55s ease both;max-width:520px;width:100%;justify-self:end}#contact-us .form-card h3{margin:0 0 8px;font-size:clamp(24px,2.2vw,32px);color:#112e6c}#contact-us .subtitle{margin:0 0 16px;color:#3c4858;line-height:1.55}#contact-us form{display:grid;gap:12px}#contact-us .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}#contact-us label{display:block;font-size:13px;font-weight:700;color:#16202e;margin-bottom:6px}#contact-us input,#contact-us textarea{width:100%;padding:12px 13px;border:1px solid #cfd8e3;background:#f8fafc;color:#16202e;outline:none;transition:border-color .2s ease,transform .2s ease,background .2s ease}#contact-us input:focus,#contact-us textarea:focus{border-color:#2563eb;background:#fff;transform:translateY(-1px)}#contact-us textarea{min-height:118px;resize:vertical}#contact-us .submit{display:inline-flex;align-items:center;justify-content:center;gap:10px;border:none;background:linear-gradient(90deg,#2563eb,#0ea5e9);color:#fff;padding:14px 18px;font-weight:700;letter-spacing:.02em;cursor:pointer;transition:transform .2s ease,box-shadow .2s ease;min-height:48px}#contact-us .submit:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(37,99,235,.28)}#contact-us .note{font-size:12px;color:#6b7686}#contact-us .muted-empty{opacity:.7}#contact-us .proof{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}#contact-us .proof span{padding:7px 10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);font-size:12px;color:#dcecff}#contact-us svg{display:block}#contact-us #icon-send,#contact-us #icon-check,#contact-us #icon-phone,#contact-us #icon-mail,#contact-us #icon-location{width:16px;height:16px}#contact-us .field-full{grid-column:1/-1}@keyframes #contact-us-card{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@media(max-width:980px){#contact-us{background:linear-gradient(180deg,#0c214e 0%,#112e6c 44%,#f8fafc 44%,#f8fafc 100%)}#contact-us .wrap{grid-template-columns:1fr}#contact-us .form-card{justify-self:stretch;max-width:none}}@media(max-width:640px){#contact-us{padding:20px 14px}#contact-us .grid{grid-template-columns:1fr}#contact-us .trust,#contact-us .form-card{padding:18px}#contact-us h2{font-size:28px}}</style><div class="wrap"><div class="trust"><span class="eyebrow">START YOUR PROJECT</span><h2>Plan your cloud server deployment with a faster, clearer RFQ path.</h2><p class="intro">Tell 阿里云 about your Ubuntu, CentOS, or Windows server needs and receive a practical proposal for configuration, quantity, and rollout scope. We keep the process buyer-friendly for international teams seeking dependable hosting options, clear project details, and a prompt response.</p><div class="channels"><div class="channel"><span class="icon"><svg id="icon-phone" viewBox="0 0 24 24" fill="none"><path d="M6.6 10.8c1.8 3.6 3 4.8 6.6 6.6l2.2-2.2c.3-.3.8-.4 1.2-.3 1 .3 2.1.5 3.2.5.7 0 1.2.5 1.2 1.2V20c0 .7-.5 1.2-1.2 1.2C10.2 21.2 2.8 13.8 2.8 4.8c0-.7.5-1.2 1.2-1.2H7.4c.7 0 1.2.5 1.2 1.2 0 1.1.2 2.2.5 3.2.1.4 0 .9-.3 1.2l-2.2 2.6Z" fill="currentColor"/></svg></span><div><strong>Phone</strong><span class="muted-empty">Available on request with your inquiry</span></div></div><div class="channel"><span class="icon"><svg id="icon-mail" viewBox="0 0 24 24" fill="none"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11Zm1.8.3 7.2 5.4 7.2-5.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span><div><strong>Email</strong><span class="muted-empty">Submit the form for direct sales follow-up</span></div></div><div class="channel"><span class="icon"><svg id="icon-location" viewBox="0 0 24 24" fill="none"><path d="M12 21s6-5.7 6-11a6 6 0 1 0-12 0c0 5.3 6 11 6 11Z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="10" r="2.2" fill="currentColor"/></svg></span><div><strong>Location</strong><span class="muted-empty">China-based cloud service supplier</span></div></div></div><ul class="checklist"><li><span class="icon"><svg id="icon-check" viewBox="0 0 24 24" fill="none"><path d="M5 12.5 9.2 17 19 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span>Share server OS, deployment target, and expected quantity in one RFQ.</span></li><li><span class="icon"><svg id="icon-check" viewBox="0 0 24 24" fill="none"><path d="M5 12.5 9.2 17 19 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span>Receive a concise proposal with suitable options for Ubuntu, CentOS, or Windows.</span></li><li><span class="icon"><svg id="icon-check" viewBox="0 0 24 24" fill="none"><path d="M5 12.5 9.2 17 19 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span>Response promise: your inquiry is reviewed quickly by the project team.</span></li></ul><div class="proof"><span>Alibaba Cloud Focus</span><span>3 Server Families</span><span>International Buyer Ready</span></div></div><div class="form-card"><h3>Request a Free Proposal</h3><p class="subtitle">Send your project scope and preferred server direction. We will review your requirements and reply with a tailored proposal.</p><form action="#contact-us" method="post"><div class="grid"><div><label for="cu-name">Your name*</label><input id="cu-name" name="name" type="text" required></div><div><label for="cu-country">Country</label><input id="cu-country" name="country" type="text"></div><div><label for="cu-email">Email*</label><input id="cu-email" name="email" type="email" required></div><div><label for="cu-type">Product / project type</label><input id="cu-type" name="project_type" type="text" placeholder="Ubuntu, CentOS, Windows server"></div><div class="field-full"><label for="cu-capacity">Target capacity / quantity</label><input id="cu-capacity" name="capacity" type="text" placeholder="Instances, users, regions, storage, or bandwidth"></div><div class="field-full"><label for="cu-details">Project details</label><textarea id="cu-details" name="details" placeholder="Describe application scenario, deployment timeline, technical needs, and any compliance or performance requirements."></textarea></div></div><button class="submit" type="submit"><svg id="icon-send" viewBox="0 0 24 24" fill="none"><path d="M3 11.8 20.5 4.5c.8-.3 1.5.4 1.2 1.2L14.4 23c-.3.8-1.4.8-1.7 0l-2-5.4-5.4-2c-.8-.3-.8-1.4 0-1.7L16.5 9 9 16.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span>SEND INQUIRY</span></button><div class="note">By sending this inquiry, you help us prepare a more accurate response for your server project.</div></form></div></div></section>
GOODJOB_CONTACT_US_HTML;
$html_source = function_exists('get_field') ? get_field('html_source') : '';
if (is_string($html_source) && trim($html_source) !== '') {
    echo $html_source; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    return;
}

$eyebrow = function_exists('get_field') ? (get_field('eyebrow') ?: "Contact Us") : "Contact Us";
$title = function_exists('get_field') ? (get_field('title') ?: "Plan your cloud server deployment with a faster, clearer RFQ path.") : "Plan your cloud server deployment with a faster, clearer RFQ path.";
$intro = function_exists('get_field') ? (get_field('intro') ?: "Tell 阿里云 about your Ubuntu, CentOS, or Windows server needs and receive a practical proposal for configuration, quantity, and rollout scope. We keep the process buyer-friendly for international teams seeking dependable hosting options, clear project details, a") : "Tell 阿里云 about your Ubuntu, CentOS, or Windows server needs and receive a practical proposal for configuration, quantity, and rollout scope. We keep the process buyer-friendly for international teams seeking dependable hosting options, clear project details, a";
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
    || $title !== "Plan your cloud server deployment with a faster, clearer RFQ path."
    || $intro !== "Tell 阿里云 about your Ubuntu, CentOS, or Windows server needs and receive a practical proposal for configuration, quantity, and rollout scope. We keep the process buyer-friendly for international teams seeking dependable hosting options, clear project details, a"
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
    if ($title !== "Plan your cloud server deployment with a faster, clearer RFQ path.") {
        $editable_html = preg_replace_callback('/<h([1-3])\b([^>]*)>.*?<\/h\1>/is', function ($matches) use ($title) {
            return '<h' . $matches[1] . $matches[2] . '>' . esc_html($title) . '</h' . $matches[1] . '>';
        }, $editable_html, 1) ?: $editable_html;
    }
    if ($intro !== "Tell 阿里云 about your Ubuntu, CentOS, or Windows server needs and receive a practical proposal for configuration, quantity, and rollout scope. We keep the process buyer-friendly for international teams seeking dependable hosting options, clear project details, a") {
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
