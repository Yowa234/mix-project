<?php
if (!defined('ABSPATH')) {
    exit;
}

$default_html = <<<'GOODJOB_ABOUT_US_HTML'
<section class="ai-section placeholder" id="about-us"><div class="ai-wrap"><div class="ai-section-head"><span class="ai-eyebrow">Blueprint</span><h2 class="ai-section-title">About Us</h2><p class="ai-section-sub">Introduce 未命名网站 with manufacturing capability, quality control, export service process, and long-term reliability.</p></div><div class="ai-grid"><article class="ai-card"><h3>About Us 1</h3><p>Introduce 未命名网站 with manufacturing capability, quality control, export service process, and long-term reliability.</p></article><article class="ai-card"><h3>About Us 2</h3><p>Introduce 未命名网站 with manufacturing capability, quality control, export service process, and long-term reliability.</p></article><article class="ai-card"><h3>About Us 3</h3><p>Introduce 未命名网站 with manufacturing capability, quality control, export service process, and long-term reliability.</p></article></div></div></section>
GOODJOB_ABOUT_US_HTML;
$html_source = function_exists('get_field') ? get_field('html_source') : '';
if (is_string($html_source) && trim($html_source) !== '') {
    echo $html_source; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    return;
}

$eyebrow = function_exists('get_field') ? (get_field('eyebrow') ?: "About Us") : "About Us";
$title = function_exists('get_field') ? (get_field('title') ?: "About Us") : "About Us";
$intro = function_exists('get_field') ? (get_field('intro') ?: "Introduce 未命名网站 with manufacturing capability, quality control, export service process, and long-term reliability.") : "Introduce 未命名网站 with manufacturing capability, quality control, export service process, and long-term reliability.";
$primary_label = function_exists('get_field') ? (get_field('primary_label') ?: 'Request a Proposal') : 'Request a Proposal';
$primary_url = function_exists('get_field') ? (get_field('primary_url') ?: '/contact-us/') : '/contact-us/';
$image = function_exists('get_field') ? get_field('image') : null;
$image_url = is_array($image) && !empty($image['url']) ? $image['url'] : '';
if (!$image_url) {
    echo $default_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    return;
}
?>
<section class="ai-section goodjob-acf-block goodjob-acf-block-<?php echo esc_attr('about-us'); ?>" id="<?php echo esc_attr('about-us'); ?>">
  <div class="ai-wrap goodjob-acf-block__inner">
    <div class="goodjob-acf-block__media"><img src="<?php echo esc_url($image_url); ?>" alt="<?php echo esc_attr($title); ?>" loading="lazy" decoding="async"></div>
    <div class="goodjob-acf-block__content">
      <span class="ai-eyebrow"><?php echo esc_html($eyebrow); ?></span>
      <h2><?php echo esc_html($title); ?></h2>
      <p><?php echo esc_html($intro); ?></p>
      <a class="ai-btn ai-btn-primary" href="<?php echo esc_url($primary_url); ?>"><?php echo esc_html($primary_label); ?></a>
    </div>
  </div>
</section>
