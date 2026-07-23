<?php
if (!defined('ABSPATH')) {
    exit;
}

function goodjob_ai_site_acf_json_load_paths($paths) {
    $paths[] = get_stylesheet_directory() . '/acf-json';
    return $paths;
}
add_filter('acf/settings/load_json', 'goodjob_ai_site_acf_json_load_paths');

function goodjob_ai_site_register_acf_field_groups() {
    if (!function_exists('acf_add_local_field_group')) {
        return;
    }
    foreach (glob(get_stylesheet_directory() . '/acf-json/group_*.json') as $file) {
        $group = json_decode(file_get_contents($file), true);
        if (is_array($group) && !empty($group['key'])) {
            acf_add_local_field_group($group);
        }
    }
}
add_action('acf/init', 'goodjob_ai_site_register_acf_field_groups', 5);

function goodjob_ai_site_block_categories($categories) {
    foreach ($categories as $category) {
        if (isset($category['slug']) && $category['slug'] === 'goodjob-ai-site') {
            return $categories;
        }
    }
    $categories[] = array(
        'slug' => 'goodjob-ai-site',
        'title' => 'GoodJob AI Site',
        'icon' => null,
    );
    return $categories;
}
add_filter('block_categories_all', 'goodjob_ai_site_block_categories', 10, 1);

function goodjob_ai_site_register_acf_blocks() {
    foreach (glob(get_stylesheet_directory() . '/blocks/*/block.json') as $file) {
        $dir = dirname($file);
        $metadata = json_decode(file_get_contents($file), true);
        if (!is_array($metadata) || empty($metadata['name'])) {
            continue;
        }
        $full_name = (string) $metadata['name'];
        if (strpos($full_name, 'acf/') !== 0) {
            continue;
        }
        $acf_name = preg_replace('#^acf/#', '', $full_name);
        if (!$acf_name) {
            continue;
        }
        if (class_exists('WP_Block_Type_Registry') && WP_Block_Type_Registry::get_instance()->is_registered($full_name)) {
            continue;
        }
        if (function_exists('acf_register_block_type')) {
            acf_register_block_type(array(
                'name' => $acf_name,
                'title' => $metadata['title'] ?? ucwords(str_replace('-', ' ', $acf_name)),
                'description' => $metadata['description'] ?? '',
                'category' => $metadata['category'] ?? 'goodjob-ai-site',
                'icon' => $metadata['icon'] ?? 'layout',
                'keywords' => $metadata['keywords'] ?? array('goodjob'),
                'mode' => $metadata['acf']['mode'] ?? 'preview',
                'render_template' => $dir . '/' . ($metadata['acf']['renderTemplate'] ?? 'render.php'),
                'supports' => $metadata['supports'] ?? array(),
            ));
            continue;
        }
        register_block_type($dir);
    }
}

function goodjob_ai_site_register_native_blocks() {
    foreach (glob(get_stylesheet_directory() . '/blocks/*/block.json') as $file) {
        $metadata = json_decode(file_get_contents($file), true);
        $full_name = is_array($metadata) && !empty($metadata['name']) ? (string) $metadata['name'] : '';
        if (!$full_name) {
            continue;
        }
        if (class_exists('WP_Block_Type_Registry') && WP_Block_Type_Registry::get_instance()->is_registered($full_name)) {
            continue;
        }
        register_block_type(dirname($file));
    }
}
add_action('acf/init', 'goodjob_ai_site_register_acf_blocks', 20);
add_action('init', 'goodjob_ai_site_register_native_blocks', 30);

function goodjob_ai_site_enqueue_block_styles() {
    foreach (glob(get_stylesheet_directory() . '/blocks/*/style.css') as $file) {
        $slug = basename(dirname($file));
        wp_enqueue_style(
            'goodjob-ai-site-block-' . $slug,
            get_stylesheet_directory_uri() . '/blocks/' . $slug . '/style.css',
            array('goodjob-ai-site-style'),
            filemtime($file)
        );
    }
}
add_action('enqueue_block_assets', 'goodjob_ai_site_enqueue_block_styles');
