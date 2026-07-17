<?php
if (!defined('ABSPATH')) {
    exit;
}

$default_html = <<<'GOODJOB_CONTACT_US_HTML'
<section id="contact-us" class="ai-section contact-inquiry-section"><style>#contact-us{background:#fff;padding:clamp(32px,5vw,72px) 0;font-family:inherit;color:#16202E}#contact-us *{box-sizing:border-box}#contact-us .wrap{max-width:1180px;margin:0 auto;padding:0 20px;display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,520px);gap:clamp(20px,3vw,34px);align-items:start}#contact-us .trust{background:#F8FAFC;border:1px solid #E2E7EE;border-radius:24px;padding:clamp(24px,3vw,34px);box-shadow:0 8px 24px rgba(7,54,51,.04)}#contact-us .eyebrow{display:inline-block;padding:7px 12px;border-radius:999px;background:#EAF5EF;color:#0F766E;font-size:12px;letter-spacing:.12em;font-weight:700;text-transform:uppercase}#contact-us h2{margin:14px 0 12px;font-size:clamp(28px,4vw,44px);line-height:1.1;color:#073633}#contact-us .intro{margin:0 0 20px;color:#3C4858;max-width:58ch;line-height:1.65}#contact-us .channels{display:grid;gap:10px;margin:0 0 18px;padding-top:4px}#contact-us .channel{display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-top:1px solid #E2E7EE}#contact-us .channel:last-child{border-bottom:1px solid #E2E7EE}#contact-us .icon{width:18px;height:18px;flex:0 0 18px;color:#0F766E;margin-top:2px}#contact-us .channel strong{display:block;font-size:14px;color:#073633}#contact-us .channel span{display:block;font-size:14px;color:#3C4858;word-break:break-word}#contact-us .checklist{margin:18px 0 0;padding:16px 18px;border:1px solid #E2E7EE;border-radius:18px;background:#fff}#contact-us .checklist h3{margin:0 0 10px;font-size:16px;color:#073633}#contact-us .checklist ul{list-style:none;margin:0;padding:0;display:grid;gap:10px}#contact-us .checklist li{display:flex;gap:10px;align-items:flex-start;color:#3C4858;font-size:14px;line-height:1.5}#contact-us .form-panel{background:#fff;border:1px solid #E2E7EE;border-radius:24px;padding:clamp(22px,3vw,32px);box-shadow:0 16px 40px rgba(5,39,37,.08);animation:#contact-us-card-in .5s ease both}#contact-us .form-panel h3{margin:0 0 8px;font-size:clamp(24px,3vw,32px);color:#073633}#contact-us .form-panel p{margin:0 0 18px;color:#6B7686;line-height:1.6;font-size:14px}#contact-us form{display:grid;gap:14px}#contact-us .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}#contact-us label{display:block;font-size:13px;font-weight:600;color:#073633;margin:0 0 6px}#contact-us input,#contact-us textarea{width:100%;border:1px solid #E2E7EE;background:#F8FAFC;color:#16202E;border-radius:16px;padding:14px 15px;font:inherit;outline:none;transition:border-color .2s ease,box-shadow .2s ease,transform .2s ease}#contact-us textarea{min-height:122px;resize:vertical}#contact-us input:focus,#contact-us textarea:focus{border-color:#0F766E;box-shadow:0 0 0 4px rgba(15,118,110,.10);transform:translateY(-1px)}#contact-us .submit{display:inline-flex;align-items:center;justify-content:center;gap:10px;border:0;border-radius:16px;background:#0EA5E9;color:#fff;padding:15px 20px;font-weight:700;letter-spacing:.02em;cursor:pointer;transition:transform .2s ease,box-shadow .2s ease,background .2s ease;box-shadow:0 10px 24px rgba(14,165,233,.18)}#contact-us .submit:hover{transform:translateY(-2px);background:#0F766E;box-shadow:0 14px 30px rgba(15,118,110,.22)}#contact-us .fine{font-size:12px;color:#6B7686}#contact-us .sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}#contact-us svg{display:block}#contact-us .icon-send{width:16px;height:16px}#contact-us .proof{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}#contact-us .proof span{font-size:12px;color:#073633;background:#EEF7F3;border:1px solid #D8EAE3;padding:7px 10px;border-radius:999px}@keyframes #contact-us-card-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}@media(max-width:980px){#contact-us .wrap{grid-template-columns:1fr}#contact-us .grid{grid-template-columns:1fr 1fr}}@media(max-width:640px){#contact-us{padding:28px 0}#contact-us .wrap{padding:0 14px;gap:16px}#contact-us .trust,#contact-us .form-panel{border-radius:20px;padding:20px}#contact-us .grid{grid-template-columns:1fr}#contact-us h2{font-size:30px}}</style><div class="wrap"><div class="trust"><span class="eyebrow">START YOUR PROJECT</span><h2>Talk with SENZ about reliable centrifuge export supply.</h2><p class="intro">SENZ supports international buyers sourcing small, large, and ultra-large centrifuges. With long operating history and practical export experience, we help you match equipment to process targets, quantity planning, and application needs. Send your RFQ with capacity, material, and project details for a faster recommendation and quotation path.</p><div class="channels"><div class="channel"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true" id="icon-phone"><path fill="currentColor" d="M6.6 10.8a15.7 15.7 0 0 0 6.6 6.6l2.2-2.2a1.5 1.5 0 0 1 1.5-.36c1.2.4 2.5.61 3.81.61A1.29 1.29 0 0 1 22 16.74V20A2 2 0 0 1 20 22C10.06 22 2 13.94 2 4a2 2 0 0 1 2-2h3.26A1.29 1.29 0 0 1 8.5 3.29c0 1.31.21 2.61.61 3.81a1.5 1.5 0 0 1-.36 1.5Z"></path></svg><div><strong>Phone</strong><span>150x'x'x'x'x'x'x'x</span></div></div><div class="channel"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true" id="icon-mail"><path fill="currentColor" d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2m0 4-8 5-8-5V6l8 5 8-5Z"></path></svg><div><strong>Email</strong><span>Share your inquiry through the form for prompt routing.</span></div></div><div class="channel"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true" id="icon-location"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7m0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5"></path></svg><div><strong>Location</strong><span>China export supplier for industrial centrifuge projects.</span></div></div></div><div class="checklist"><h3>RFQ checklist</h3><ul><li><svg class="icon" viewBox="0 0 24 24" aria-hidden="true" id="icon-check"><path fill="currentColor" d="M9.55 18.3 3.8 12.55l1.4-1.4 4.35 4.35 9.25-9.25 1.4 1.4Z"></path></svg><span>Product family: small, large, or ultra-large centrifuge</span></li><li><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.55 18.3 3.8 12.55l1.4-1.4 4.35 4.35 9.25-9.25 1.4 1.4Z"></path></svg><span>Target capacity, quantity, or throughput requirement</span></li><li><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.55 18.3 3.8 12.55l1.4-1.4 4.35 4.35 9.25-9.25 1.4 1.4Z"></path></svg><span>Application details, material, and delivery expectation</span></li></ul></div><div class="proof"><span>Trusted long-established supplier</span><span>Buyer-focused RFQ support</span><span>Response with workable next steps</span></div></div><div class="form-panel"><h3>Request a Free Proposal</h3><p>Tell us your product type, capacity target, and project scope. Our team will review your inquiry and return a practical proposal path.</p><form action="#contact-us" method="post"><div class="grid"><div><label for="cu-name">Your name*</label><input id="cu-name" name="name" type="text" required></div><div><label for="cu-country">Country</label><input id="cu-country" name="country" type="text"></div></div><div class="grid"><div><label for="cu-email">Email*</label><input id="cu-email" name="email" type="email" required></div><div><label for="cu-product">Product / project type</label><input id="cu-product" name="product" type="text" placeholder="Small, large, or ultra-large centrifuge"></div></div><div><label for="cu-capacity">Target capacity / quantity</label><input id="cu-capacity" name="capacity" type="text"></div><div><label for="cu-details">Project details</label><textarea id="cu-details" name="details" placeholder="Share application, materials, specifications, quantity, destination, and timeline."></textarea></div><button class="submit" type="submit"><svg class="icon-send" viewBox="0 0 24 24" aria-hidden="true" id="icon-send"><path fill="currentColor" d="M3 20v-7l15-1-15-1V4l18 8Z"></path></svg><span>SEND INQUIRY</span></button><div class="fine">We use your inquiry details only to prepare a relevant response.</div></form></div></div></section>
GOODJOB_CONTACT_US_HTML;
$html_source = function_exists('get_field') ? get_field('html_source') : '';
if (is_string($html_source) && trim($html_source) !== '') {
    echo $html_source; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    return;
}

$eyebrow = function_exists('get_field') ? (get_field('eyebrow') ?: "Contact Us") : "Contact Us";
$title = function_exists('get_field') ? (get_field('title') ?: "Talk with SENZ about reliable centrifuge export supply.") : "Talk with SENZ about reliable centrifuge export supply.";
$intro = function_exists('get_field') ? (get_field('intro') ?: "SENZ supports international buyers sourcing small, large, and ultra-large centrifuges. With long operating history and practical export experience, we help you match equipment to process targets, quantity planning, and application needs. Send your RFQ with cap") : "SENZ supports international buyers sourcing small, large, and ultra-large centrifuges. With long operating history and practical export experience, we help you match equipment to process targets, quantity planning, and application needs. Send your RFQ with cap";
$primary_label = function_exists('get_field') ? (get_field('primary_label') ?: "Send Inquiry") : "Send Inquiry";
$primary_url = function_exists('get_field') ? (get_field('primary_url') ?: "/contact-us/") : "/contact-us/";
$image = function_exists('get_field') ? get_field('image') : null;
$image_url = is_array($image) && !empty($image['url']) ? $image['url'] : '';
$has_structured_edits = $image_url
    || $eyebrow !== "Contact Us"
    || $title !== "Talk with SENZ about reliable centrifuge export supply."
    || $intro !== "SENZ supports international buyers sourcing small, large, and ultra-large centrifuges. With long operating history and practical export experience, we help you match equipment to process targets, quantity planning, and application needs. Send your RFQ with cap"
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
    if ($title !== "Talk with SENZ about reliable centrifuge export supply.") {
        $editable_html = preg_replace_callback('/<h([1-3])\b([^>]*)>.*?<\/h\1>/is', function ($matches) use ($title) {
            return '<h' . $matches[1] . $matches[2] . '>' . esc_html($title) . '</h' . $matches[1] . '>';
        }, $editable_html, 1) ?: $editable_html;
    }
    if ($intro !== "SENZ supports international buyers sourcing small, large, and ultra-large centrifuges. With long operating history and practical export experience, we help you match equipment to process targets, quantity planning, and application needs. Send your RFQ with cap") {
        $editable_html = preg_replace_callback('/<p\b([^>]*)>.*?<\/p>/is', function ($matches) use ($intro) {
            return '<p' . $matches[1] . '>' . esc_html($intro) . '</p>';
        }, $editable_html, 1) ?: $editable_html;
    }
    if ($primary_label !== "Send Inquiry" || $primary_url !== "/contact-us/") {
        $editable_html = preg_replace_callback("/<a\\b([^>]*?)href=([\"']).*?\\2([^>]*)>.*?<\\/a>/is", function ($matches) use ($primary_label, $primary_url) {
            return '<a' . $matches[1] . 'href="' . esc_url($primary_url) . '"' . $matches[3] . '>' . esc_html($primary_label) . '</a>';
        }, $editable_html, 1) ?: $editable_html;
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
