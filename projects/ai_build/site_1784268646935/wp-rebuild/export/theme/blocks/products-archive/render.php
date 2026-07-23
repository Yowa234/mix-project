<?php
if (!defined('ABSPATH')) {
    exit;
}

$current_term = is_tax('product_cat') ? get_queried_object() : null;
$current_term_id = ($current_term && !is_wp_error($current_term) && !empty($current_term->term_id)) ? (int) $current_term->term_id : 0;
$terms = get_terms(array('taxonomy' => 'product_cat', 'hide_empty' => false));
if (is_wp_error($terms) || !is_array($terms)) {
    $terms = array();
}
$query_args = array(
    'post_type' => 'product',
    'post_status' => 'publish',
    'posts_per_page' => 12,
    'orderby' => 'menu_order date',
    'order' => 'DESC',
);
if ($current_term_id) {
    $query_args['tax_query'] = array(array(
        'taxonomy' => 'product_cat',
        'field' => 'term_id',
        'terms' => $current_term_id,
    ));
}
$products = new WP_Query($query_args);
?>
<section class="goodjob-products-page">
  <div class="goodjob-products-page__wrap">
    <aside class="goodjob-products-sidebar" aria-label="Product categories">
      <h1>Products Categories</h1>
      <nav>
        <a class="<?php echo $current_term_id ? '' : 'is-active'; ?>" href="<?php echo esc_url(get_post_type_archive_link('product')); ?>">All Products</a>
        <?php foreach ($terms as $term) :
          $term_link = get_term_link($term);
          if (is_wp_error($term_link)) {
              continue;
          }
        ?>
          <a class="<?php echo ((int) $term->term_id === $current_term_id) ? 'is-active' : ''; ?>" href="<?php echo esc_url($term_link); ?>"><?php echo esc_html($term->name); ?></a>
        <?php endforeach; ?>
      </nav>
    </aside>
    <div class="goodjob-products-main">
      <div class="goodjob-products-main__head">
        <span>Product Center</span>
        <h2><?php echo esc_html($current_term_id && $current_term ? $current_term->name : 'Industrial Product Catalog'); ?></h2>
        <p>Browse product categories, compare typical models, and open a direct inquiry for drawings, pricing, and export documents.</p>
      </div>
      <?php if ($products->have_posts()) : ?>
        <div class="goodjob-product-grid">
          <?php while ($products->have_posts()) : $products->the_post();
            $image_url = get_the_post_thumbnail_url(get_the_ID(), 'large');
            if (!$image_url) {
                $image_url = (string) get_post_meta(get_the_ID(), 'goodjob_image', true);
            }
            if (!$image_url) {
                $image_url = 'https://placehold.co/640x520/f4f7fb/244aa5?text=' . rawurlencode(get_the_title());
            }
          ?>
            <article class="goodjob-product-card">
              <a class="goodjob-product-card__media" href="<?php the_permalink(); ?>">
                <img src="<?php echo esc_url($image_url); ?>" alt="<?php the_title_attribute(); ?>" loading="lazy" decoding="async">
                <span aria-hidden="true">→</span>
              </a>
              <h3><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h3>
            </article>
          <?php endwhile; wp_reset_postdata(); ?>
        </div>
      <?php else : ?>
        <p class="goodjob-products-empty">No products are published yet. Add Products in the WordPress admin panel.</p>
      <?php endif; ?>
    </div>
  </div>
</section>