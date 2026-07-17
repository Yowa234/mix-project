<?php
if (!defined('ABSPATH')) {
    exit;
}

$default_html = <<<'GOODJOB_APPLICATIONS_HTML'
<section id="applications" class="ai-section applications-horizontal-card-preview"><style>#applications{background:#fff;border-top:1px solid #E2E7EE;border-bottom:1px solid #E2E7EE;padding:clamp(42px,6vw,76px) 0;color:#16202E}#applications *{box-sizing:border-box}#applications .wrap{max-width:1200px;margin:0 auto;padding:0 20px}#applications .head{display:grid;gap:14px;margin-bottom:26px}#applications .eyebrow{display:inline-flex;align-items:center;gap:8px;color:#0F766E;background:#EEF8F4;border:1px solid #CFE7E1;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;width:max-content}#applications h2{margin:0;font-size:clamp(28px,4vw,42px);line-height:1.08;color:#073633}#applications .sub{max-width:760px;margin:0;color:#3C4858;font-size:15px;line-height:1.7}#applications .row{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(290px,1fr);gap:18px;overflow-x:auto;scroll-snap-type:x proximity;padding:4px 2px 8px}#applications .row::-webkit-scrollbar{height:8px}#applications .row::-webkit-scrollbar-thumb{background:#D7E8E5;border-radius:999px}#applications article{scroll-snap-align:start;background:#F8FAFC;border:1px solid #E2E7EE;border-radius:24px;padding:20px;display:grid;gap:14px;min-height:100%;box-shadow:0 8px 18px rgba(7,54,51,.04);transition:transform .22s ease,border-color .22s ease,box-shadow .22s ease}#applications article:hover{transform:translateY(-3px);border-color:#0F766E;box-shadow:0 14px 28px rgba(7,54,51,.08)}#applications .scene{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding-bottom:12px;border-bottom:1px solid #E2E7EE}#applications .scene strong{display:block;color:#073633;font-size:18px;line-height:1.3}#applications .env{font-size:12px;color:#0F766E;background:#EAF7F4;border:1px solid #D2EAE5;border-radius:999px;padding:7px 10px;white-space:nowrap}#applications .label{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#6B7686}#applications .pain p,#applications .outcome p{margin:5px 0 0;color:#3C4858;font-size:14px;line-height:1.65}#applications .chips{display:flex;flex-wrap:wrap;gap:8px}#applications .chip{display:inline-flex;align-items:center;padding:8px 12px;border-radius:999px;background:#fff;border:1px solid #CFE7E1;color:#073633;font-size:13px;font-weight:700}#applications .outcome{padding-top:2px}#applications .cta{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:10px;border-top:1px solid #E2E7EE}#applications .note{font-size:12px;color:#6B7686}#applications .btn{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;background:#0F766E;color:#fff;border:1px solid #0F766E;border-radius:999px;padding:11px 16px;font-weight:700;transition:background .2s ease,transform .2s ease}#applications .btn:hover{background:#073633;transform:translateY(-1px)}#applications .btn.alt{background:#fff;color:#0F766E}#applications .btn.alt:hover{background:#EEF8F4}#applications .band{background:linear-gradient(180deg,#fff 0%,#FCFEFD 100%);border-radius:28px;padding:clamp(18px,2.5vw,28px)}@media(max-width:760px){#applications .wrap{padding:0 16px}#applications .row{grid-auto-columns:minmax(86%,1fr);gap:14px}#applications article{padding:18px;border-radius:20px}#applications .cta{align-items:flex-start;flex-direction:column}}</style><div class="wrap"><div class="band"><div class="head"><span class="eyebrow">Applications • SENZ</span><h2>Match centrifuge size to the operating load, footprint, and throughput risk.</h2><p class="sub">Preview where small, large, and ultra-large centrifuges fit best. Each scenario links a real production environment to a buyer pain point, the right SENZ category, and the operational result teams usually want to secure.</p></div><div class="row"><article><div class="scene"><div><strong>Pilot lab & small-batch processing</strong></div><span class="env">Tight footprint</span></div><div class="pain"><div class="label">Pain point</div><p>You need stable separation for trials or specialty lots without overbuying capacity or giving up clean handling.</p></div><div><div class="label">Suitable product</div><div class="chips"><span class="chip">小型离心机</span></div></div><div class="outcome"><div class="label">Outcome</div><p>Faster validation, lower utility burden, and easier shift changeovers for compact production cells.</p></div><div class="cta"><span class="note">Best for flexible start-up volume</span><a class="btn alt" href="/products/">View products</a></div></article><article><div class="scene"><div><strong>Mainline industrial production</strong></div><span class="env">Balanced throughput</span></div><div class="pain"><div class="label">Pain point</div><p>Lines slow down when feed volume rises and manual handling starts to disrupt consistency across long runs.</p></div><div><div class="label">Suitable product</div><div class="chips"><span class="chip">大型离心机</span></div></div><div class="outcome"><div class="label">Outcome</div><p>Higher continuous output, steadier product quality, and fewer bottlenecks between upstream and downstream steps.</p></div><div class="cta"><span class="note">Built for routine factory demand</span><a class="btn" href="/contact-us/">Discuss your line</a></div></article><article><div class="scene"><div><strong>High-volume central processing</strong></div><span class="env">Heavy-duty duty cycle</span></div><div class="pain"><div class="label">Pain point</div><p>Large facilities cannot afford repeat stoppages, overflow risk, or capacity gaps during peak daily loads.</p></div><div><div class="label">Suitable product</div><div class="chips"><span class="chip">超大型离心机</span></div></div><div class="outcome"><div class="label">Outcome</div><p>Maximum batch handling, stronger site-wide efficiency, and better planning confidence for expansion.</p></div><div class="cta"><span class="note">For centralized large-scale operations</span><a class="btn" href="/contact-us/">Get sizing support</a></div></article></div></div></div></section>
GOODJOB_APPLICATIONS_HTML;
$html_source = function_exists('get_field') ? get_field('html_source') : '';
if (is_string($html_source) && trim($html_source) !== '') {
    echo $html_source; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    return;
}

$eyebrow = function_exists('get_field') ? (get_field('eyebrow') ?: "Applications") : "Applications";
$title = function_exists('get_field') ? (get_field('title') ?: "Match centrifuge size to the operating load, footprint, and throughput risk.") : "Match centrifuge size to the operating load, footprint, and throughput risk.";
$intro = function_exists('get_field') ? (get_field('intro') ?: "Preview where small, large, and ultra-large centrifuges fit best. Each scenario links a real production environment to a buyer pain point, the right SENZ category, and the operational result teams usually want to secure.") : "Preview where small, large, and ultra-large centrifuges fit best. Each scenario links a real production environment to a buyer pain point, the right SENZ category, and the operational result teams usually want to secure.";
$primary_label = function_exists('get_field') ? (get_field('primary_label') ?: "Request a Proposal") : "Request a Proposal";
$primary_url = function_exists('get_field') ? (get_field('primary_url') ?: "/contact-us/") : "/contact-us/";
$image = function_exists('get_field') ? get_field('image') : null;
$image_url = is_array($image) && !empty($image['url']) ? $image['url'] : '';
$has_structured_edits = $image_url
    || $eyebrow !== "Applications"
    || $title !== "Match centrifuge size to the operating load, footprint, and throughput risk."
    || $intro !== "Preview where small, large, and ultra-large centrifuges fit best. Each scenario links a real production environment to a buyer pain point, the right SENZ category, and the operational result teams usually want to secure."
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
    if ($title !== "Match centrifuge size to the operating load, footprint, and throughput risk.") {
        $editable_html = preg_replace_callback('/<h([1-3])\b([^>]*)>.*?<\/h\1>/is', function ($matches) use ($title) {
            return '<h' . $matches[1] . $matches[2] . '>' . esc_html($title) . '</h' . $matches[1] . '>';
        }, $editable_html, 1) ?: $editable_html;
    }
    if ($intro !== "Preview where small, large, and ultra-large centrifuges fit best. Each scenario links a real production environment to a buyer pain point, the right SENZ category, and the operational result teams usually want to secure.") {
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
