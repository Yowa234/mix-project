<?php
if (!defined('ABSPATH')) {
    exit;
}

$post_id = get_the_ID();
$terms = get_the_terms($post_id, 'product_cat');
if (is_wp_error($terms) || !is_array($terms)) {
    $terms = array();
}
$primary_term = !empty($terms) ? $terms[0] : null;
$image_url = get_the_post_thumbnail_url($post_id, 'large');
if (!$image_url) {
    $image_url = (string) get_post_meta($post_id, 'goodjob_image', true);
}
if (!$image_url) {
    $image_url = 'https://placehold.co/900x720/f4f7fb/244aa5?text=' . rawurlencode(get_the_title());
}
$sku = (string) get_post_meta($post_id, 'goodjob_sku', true);
$material = (string) get_post_meta($post_id, 'goodjob_material', true);
$application = (string) get_post_meta($post_id, 'goodjob_application', true);
$lead_time = (string) get_post_meta($post_id, 'goodjob_lead_time', true);
$export_docs = (string) get_post_meta($post_id, 'goodjob_export_docs', true);
$specs = array(
    'SKU' => $sku ?: 'Confirm by drawing or sample',
    'Category' => $primary_term ? $primary_term->name : 'Industrial Product',
    'Material' => $material ?: 'Custom material available',
    'Application' => $application ?: 'Industrial fluid control and OEM supply',
    'Lead Time' => $lead_time ?: '15-35 days after confirmation',
    'Export Documents' => $export_docs ?: 'Invoice, packing list, certificate, inspection record',
);
$related_args = array(
    'post_type' => 'product',
    'post_status' => 'publish',
    'posts_per_page' => 3,
    'post__not_in' => array($post_id),
);
if ($primary_term) {
    $related_args['tax_query'] = array(array(
        'taxonomy' => 'product_cat',
        'field' => 'term_id',
        'terms' => (int) $primary_term->term_id,
    ));
}
$related = new WP_Query($related_args);
?>
<article class="goodjob-product-detail">
  <nav class="goodjob-product-detail__breadcrumb" aria-label="Breadcrumb">
    <a href="<?php echo esc_url(home_url('/')); ?>">Home</a>
    <span aria-hidden="true">/</span>
    <a href="<?php echo esc_url(get_post_type_archive_link('product')); ?>">Products</a>
    <span aria-hidden="true">/</span>
    <span><?php the_title(); ?></span>
  </nav>
  <section class="goodjob-product-detail__hero">
    <div class="goodjob-product-detail__media">
      <img src="<?php echo esc_url($image_url); ?>" alt="<?php the_title_attribute(); ?>" loading="eager" decoding="async">
    </div>
    <div class="goodjob-product-detail__summary">
      <div class="goodjob-product-detail__terms">
        <?php foreach ($terms as $term) :
          $term_link = get_term_link($term);
          if (is_wp_error($term_link)) {
              continue;
          }
        ?>
          <a href="<?php echo esc_url($term_link); ?>"><?php echo esc_html($term->name); ?></a>
        <?php endforeach; ?>
      </div>
      <h1><?php the_title(); ?></h1>
      <p><?php echo esc_html(get_the_excerpt() ?: wp_trim_words(wp_strip_all_tags(get_the_content()), 34)); ?></p>
      <div class="goodjob-product-detail__actions">
        <a class="goodjob-product-detail__primary" href="<?php echo esc_url(home_url('/contact-us/')); ?>">Request Price & Drawings</a>
        <a class="goodjob-product-detail__ghost" href="<?php echo esc_url(get_post_type_archive_link('product')); ?>">Back to Products</a>
      </div>
    </div>
  </section>
  <section class="goodjob-product-detail__body">
    <aside class="goodjob-product-detail__specs">
      <h2>Product Specifications</h2>
      <dl>
        <?php foreach ($specs as $label => $value) : ?>
          <div><dt><?php echo esc_html($label); ?></dt><dd><?php echo esc_html($value); ?></dd></div>
        <?php endforeach; ?>
      </dl>
      <div class="goodjob-product-detail__rfq">
        <strong>RFQ Checklist</strong>
        <ul>
          <li>Target model, drawing, or sample photo</li>
          <li>Quantity and destination market</li>
          <li>Material, pressure, size, and inspection needs</li>
        </ul>
      </div>
    </aside>
    <div class="goodjob-product-detail__content">
      <?php the_content(); ?>
    </div>
  </section>
  <?php if ($related->have_posts()) : ?>
  <section class="goodjob-product-detail__related">
    <div class="goodjob-product-detail__related-head">
      <span>Related Products</span>
      <h2>More options in this category</h2>
    </div>
    <div class="goodjob-product-detail__related-grid">
      <?php while ($related->have_posts()) : $related->the_post();
        $related_image = get_the_post_thumbnail_url(get_the_ID(), 'medium');
        if (!$related_image) {
            $related_image = (string) get_post_meta(get_the_ID(), 'goodjob_image', true);
        }
        if (!$related_image) {
            $related_image = 'https://placehold.co/420x320/f4f7fb/244aa5?text=' . rawurlencode(get_the_title());
        }
      ?>
        <article>
          <a href="<?php the_permalink(); ?>"><img src="<?php echo esc_url($related_image); ?>" alt="<?php the_title_attribute(); ?>" loading="lazy" decoding="async"></a>
          <h3><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h3>
        </article>
      <?php endwhile; wp_reset_postdata(); ?>
    </div>
  </section>
  <?php endif; ?>
</article>