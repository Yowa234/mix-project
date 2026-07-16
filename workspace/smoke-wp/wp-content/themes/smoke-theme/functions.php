<?php
if (!defined('ABSPATH')) {
    exit;
}

require_once get_stylesheet_directory() . '/inc/cpt.php';
require_once get_stylesheet_directory() . '/inc/acf.php';
require_once get_stylesheet_directory() . '/inc/installer.php';
require_once get_stylesheet_directory() . '/inc/admin.php';

function goodjob_ai_site_enqueue_assets() {
    $theme = wp_get_theme();
    wp_enqueue_style(
        'goodjob-ai-site-style',
        get_stylesheet_uri(),
        array(),
        $theme->get('Version')
    );
    wp_enqueue_script(
        'goodjob-ai-site-script',
        get_stylesheet_directory_uri() . '/assets/js/goodjob-site.js',
        array(),
        $theme->get('Version'),
        true
    );
}
add_action('wp_enqueue_scripts', 'goodjob_ai_site_enqueue_assets');

function goodjob_ai_site_enqueue_editor_assets() {
    $theme = wp_get_theme();
    wp_enqueue_style(
        'goodjob-ai-site-editor-style',
        get_stylesheet_uri(),
        array(),
        $theme->get('Version')
    );
}
add_action('enqueue_block_editor_assets', 'goodjob_ai_site_enqueue_editor_assets');

function goodjob_ai_site_theme_setup() {
    add_theme_support('post-thumbnails');
    add_theme_support('title-tag');
    add_theme_support('wp-block-styles');
    add_theme_support('align-wide');
}
add_action('after_setup_theme', 'goodjob_ai_site_theme_setup');
