<?php
if (!defined('ABSPATH')) {
    exit;
}

function goodjob_ai_site_read_json($relative) {
    $file = get_stylesheet_directory() . '/' . ltrim($relative, '/');
    if (!file_exists($file)) {
        return array();
    }
    $data = json_decode(file_get_contents($file), true);
    return is_array($data) ? $data : array();
}

function goodjob_ai_site_data_signature() {
    $files = array('_data/pages.json', '_data/collections.json', '_data/site-options.json', '_data/routes.json');
    $hashes = array();
    foreach ($files as $relative) {
        $file = get_stylesheet_directory() . '/' . $relative;
        $hashes[] = file_exists($file) ? md5_file($file) : '';
    }
    return md5(implode('|', $hashes));
}

function goodjob_ai_site_seed_pages($force = false) {
    $pages = goodjob_ai_site_read_json('_data/pages.json');
    foreach ($pages as $page) {
        $slug = sanitize_title($page['slug'] ?? $page['title'] ?? 'home');
        $existing = get_page_by_path($slug);
        $existing_content = $existing ? trim((string) $existing->post_content) : '';
        $is_legacy_generated_shell = $existing_content && strpos($existing_content, 'wp:template-part') !== false && strpos($existing_content, 'wp:acf/') !== false;
        if ($existing && !$force && $existing_content !== '' && !$is_legacy_generated_shell) {
            continue;
        }
        $postarr = array(
            'post_title' => sanitize_text_field($page['title'] ?? 'Home'),
            'post_name' => $slug,
            'post_status' => sanitize_key($page['status'] ?? 'publish'),
            'post_type' => 'page',
            'post_content' => $page['post_content'] ?? '',
        );
        $page_id = $existing ? wp_update_post(array_merge($postarr, array('ID' => $existing->ID))) : wp_insert_post($postarr);
        if (!is_wp_error($page_id) && $slug === 'home') {
            update_option('show_on_front', 'page');
            update_option('page_on_front', (int) $page_id);
        }
    }
}

function goodjob_ai_site_seed_collections($force = false) {
    $collections = goodjob_ai_site_read_json('_data/collections.json');
    foreach ($collections as $post_type => $collection) {
        if (!post_type_exists($post_type)) {
            continue;
        }
        $items = isset($collection['items']) && is_array($collection['items']) ? $collection['items'] : array();
        $taxonomy = '';
        $types = goodjob_ai_site_collection_types();
        if (isset($types[$post_type]['taxonomy'])) {
            $taxonomy = $types[$post_type]['taxonomy'];
        }
        foreach ($items as $item) {
            $title = sanitize_text_field($item['title'] ?? '');
            if (!$title) {
                continue;
            }
            $existing = get_page_by_title($title, OBJECT, $post_type);
            if ($existing && !$force) {
                continue;
            }
            $postarr = array(
                'post_title' => $title,
                'post_type' => $post_type,
                'post_status' => 'publish',
                'post_excerpt' => sanitize_textarea_field($item['desc'] ?? ''),
                'post_content' => wp_kses_post($item['content'] ?? $item['desc'] ?? ''),
                'post_date' => sanitize_text_field($item['date'] ?? current_time('mysql')),
            );
            $post_id = $existing ? wp_update_post(array_merge($postarr, array('ID' => $existing->ID))) : wp_insert_post($postarr);
            if (is_wp_error($post_id)) {
                continue;
            }
            foreach ($item as $meta_key => $meta_value) {
                if (in_array($meta_key, array('title', 'desc', 'content', 'category', 'date'), true)) {
                    continue;
                }
                $clean_key = sanitize_key('goodjob_' . $meta_key);
                if (is_array($meta_value)) {
                    update_post_meta($post_id, $clean_key, wp_json_encode($meta_value, JSON_UNESCAPED_UNICODE));
                } else {
                    update_post_meta($post_id, $clean_key, sanitize_text_field((string) $meta_value));
                }
            }
            if ($taxonomy && !empty($item['category'])) {
                $term = term_exists($item['category'], $taxonomy);
                if (!$term) {
                    $term = wp_insert_term($item['category'], $taxonomy);
                }
                if (!is_wp_error($term)) {
                    wp_set_object_terms($post_id, array((int) $term['term_id']), $taxonomy);
                }
            }
        }
    }
}

function goodjob_ai_site_write_htaccess() {
    $base = parse_url(home_url('/'), PHP_URL_PATH);
    $base = $base ? trailingslashit($base) : '/';
    $index = $base . 'index.php';
    $rules = "# BEGIN WordPress
";
    $rules .= "<IfModule mod_rewrite.c>
";
    $rules .= "RewriteEngine On
";
    $rules .= "RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]
";
    $rules .= "RewriteBase " . $base . "
";
    $rules .= "RewriteRule ^index\.php$ - [L]
";
    $rules .= "RewriteCond %{REQUEST_FILENAME} !-f
";
    $rules .= "RewriteCond %{REQUEST_FILENAME} !-d
";
    $rules .= "RewriteRule . " . $index . " [L]
";
    $rules .= "</IfModule>
";
    $rules .= "# END WordPress
";
    $file = ABSPATH . '.htaccess';
    if (!file_exists($file) || is_writable($file)) {
        file_put_contents($file, $rules);
    }
}

function goodjob_ai_site_write_nginx_rewrite() {
    $file = ABSPATH . 'nginx.htaccess';
    $rule = "try_files \$uri \$uri/ /index.php?\$args;
";
    if (!file_exists($file) || is_writable($file)) {
        file_put_contents($file, $rule);
    }
}

function goodjob_ai_site_configure_routes() {
    global $wp_rewrite;
    if (get_option('permalink_structure') !== '/%postname%/') {
        update_option('permalink_structure', '/%postname%/');
    }
    if ($wp_rewrite && method_exists($wp_rewrite, 'set_permalink_structure')) {
        $wp_rewrite->set_permalink_structure('/%postname%/');
    }
    goodjob_ai_site_write_htaccess();
    goodjob_ai_site_write_nginx_rewrite();
}

function goodjob_ai_site_seed_all($force = false) {
    goodjob_ai_site_register_cpts();
    goodjob_ai_site_configure_routes();
    goodjob_ai_site_seed_pages($force);
    goodjob_ai_site_seed_collections($force);
    update_option('goodjob_ai_site_options', goodjob_ai_site_read_json('_data/site-options.json'));
    update_option('goodjob_ai_site_seeded_at', current_time('mysql'));
    update_option('goodjob_ai_site_data_signature', goodjob_ai_site_data_signature());
    flush_rewrite_rules();
}
add_action('after_switch_theme', function () {
    if (!get_option('goodjob_ai_site_seeded_at') || get_option('goodjob_ai_site_data_signature') !== goodjob_ai_site_data_signature()) {
        goodjob_ai_site_seed_all(false);
    }
});
add_action('admin_init', function () {
    if (current_user_can('manage_options') && get_option('goodjob_ai_site_data_signature') !== goodjob_ai_site_data_signature()) {
        goodjob_ai_site_seed_all(false);
    }
});
