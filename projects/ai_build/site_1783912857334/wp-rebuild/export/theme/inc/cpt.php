<?php
if (!defined('ABSPATH')) {
    exit;
}

function goodjob_ai_site_collection_types() {
    return array(
        'product' => array('label' => 'Products', 'singular' => 'Product', 'taxonomy' => 'product_cat'),
        'service' => array('label' => 'Services', 'singular' => 'Service', 'taxonomy' => 'service_cat'),
        'case' => array('label' => 'Cases', 'singular' => 'Case', 'taxonomy' => 'case_cat'),
        'news' => array('label' => 'News', 'singular' => 'News', 'taxonomy' => 'news_cat'),
    );
}

function goodjob_ai_site_register_cpts() {
    foreach (goodjob_ai_site_collection_types() as $post_type => $config) {
        register_post_type($post_type, array(
            'labels' => array(
                'name' => $config['label'],
                'singular_name' => $config['singular'],
                'add_new_item' => 'Add New ' . $config['singular'],
                'edit_item' => 'Edit ' . $config['singular'],
            ),
            'public' => true,
            'show_in_rest' => true,
            'has_archive' => true,
            'menu_icon' => $post_type === 'product' ? 'dashicons-products' : 'dashicons-screenoptions',
            'supports' => array('title', 'editor', 'excerpt', 'thumbnail', 'custom-fields'),
            'rewrite' => array('slug' => $post_type === 'news' ? 'blog' : $post_type . 's'),
        ));
        register_taxonomy($config['taxonomy'], array($post_type), array(
            'labels' => array('name' => $config['label'] . ' Categories'),
            'public' => true,
            'hierarchical' => true,
            'show_in_rest' => true,
            'rewrite' => array('slug' => $config['taxonomy']),
        ));
    }
}
add_action('init', 'goodjob_ai_site_register_cpts');
