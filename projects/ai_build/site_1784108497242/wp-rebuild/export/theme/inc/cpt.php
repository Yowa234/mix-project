<?php
if (!defined('ABSPATH')) {
    exit;
}

function goodjob_ai_site_collection_types() {
    return array(
        'product' => array('label' => 'Products', 'singular' => 'Product', 'taxonomy' => 'product_cat', 'archive_slug' => 'products', 'taxonomy_slug' => 'product-category', 'icon' => 'dashicons-products'),
        'service' => array('label' => 'Services', 'singular' => 'Service', 'taxonomy' => 'service_cat', 'archive_slug' => 'services', 'taxonomy_slug' => 'service-category', 'icon' => 'dashicons-hammer'),
        'case' => array('label' => 'Cases', 'singular' => 'Case', 'taxonomy' => 'case_cat', 'archive_slug' => 'cases', 'taxonomy_slug' => 'case-category', 'icon' => 'dashicons-portfolio'),
        'news' => array('label' => 'News', 'singular' => 'News', 'taxonomy' => 'news_cat', 'archive_slug' => 'blog', 'taxonomy_slug' => 'news-category', 'icon' => 'dashicons-media-document'),
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
            'menu_icon' => $config['icon'],
            'supports' => array('title', 'editor', 'excerpt', 'thumbnail', 'custom-fields', 'revisions'),
            'rewrite' => array('slug' => $config['archive_slug']),
        ));
        register_taxonomy($config['taxonomy'], array($post_type), array(
            'labels' => array('name' => $config['label'] . ' Categories'),
            'public' => true,
            'hierarchical' => true,
            'show_in_rest' => true,
            'rewrite' => array('slug' => $config['taxonomy_slug']),
        ));
    }
}
add_action('init', 'goodjob_ai_site_register_cpts');
