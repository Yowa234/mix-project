<?php
if (!defined('ABSPATH')) {
    exit;
}

$post_id = get_the_ID();
$terms = get_the_terms($post_id, 'news_cat');
if (is_wp_error($terms) || !is_array($terms)) {
    $terms = array();
}
$primary_term = !empty($terms) ? $terms[0] : null;
$image_url = get_the_post_thumbnail_url($post_id, 'large');
if (!$image_url) {
    $image_url = (string) get_post_meta($post_id, 'goodjob_image', true);
}
if (!$image_url) {
    $image_url = 'https://placehold.co/1200x640/f4f7fb/244aa5?text=' . rawurlencode(get_the_title());
}
$related_args = array(
    'post_type' => 'news',
    'post_status' => 'publish',
    'posts_per_page' => 3,
    'post__not_in' => array($post_id),
    'orderby' => 'date',
    'order' => 'DESC',
);
if ($primary_term) {
    $related_args['tax_query'] = array(array(
        'taxonomy' => 'news_cat',
        'field' => 'term_id',
        'terms' => (int) $primary_term->term_id,
    ));
}
$related = new WP_Query($related_args);
?>
<article class="goodjob-news-detail">
  <header class="goodjob-news-detail__hero">
    <div class="goodjob-news-detail__shade"></div>
    <div class="goodjob-news-detail__hero-inner">
      <nav class="goodjob-news-detail__breadcrumb" aria-label="Breadcrumb">
        <a href="<?php echo esc_url(home_url('/')); ?>">Home</a>
        <span aria-hidden="true">/</span>
        <a href="<?php echo esc_url(get_post_type_archive_link('news')); ?>">Blog</a>
      </nav>
      <div class="goodjob-news-detail__meta">
        <?php if ($primary_term) : ?><span><?php echo esc_html($primary_term->name); ?></span><?php endif; ?>
        <time datetime="<?php echo esc_attr(get_the_date('c')); ?>"><?php echo esc_html(get_the_date('Y-m-d')); ?></time>
      </div>
      <h1><?php the_title(); ?></h1>
      <p><?php echo esc_html(get_the_excerpt() ?: wp_trim_words(wp_strip_all_tags(get_the_content()), 28)); ?></p>
    </div>
  </header>
  <div class="goodjob-news-detail__layout">
    <main class="goodjob-news-detail__main">
      <figure class="goodjob-news-detail__image">
        <img src="<?php echo esc_url($image_url); ?>" alt="<?php the_title_attribute(); ?>" loading="eager" decoding="async">
      </figure>
      <div class="goodjob-news-detail__content">
        <?php the_content(); ?>
      </div>
    </main>
    <aside class="goodjob-news-detail__aside">
      <div class="goodjob-news-detail__panel">
        <strong>Need help with product selection?</strong>
        <p>Send your operating conditions, target market, and expected quantity. We will prepare a focused RFQ path.</p>
        <a href="<?php echo esc_url(home_url('/contact-us/')); ?>">Send Inquiry</a>
      </div>
      <?php if (!empty($terms)) : ?>
      <div class="goodjob-news-detail__panel">
        <strong>Topics</strong>
        <div class="goodjob-news-detail__tags">
          <?php foreach ($terms as $term) :
            $term_link = get_term_link($term);
            if (is_wp_error($term_link)) {
                continue;
            }
          ?>
            <a href="<?php echo esc_url($term_link); ?>"><?php echo esc_html($term->name); ?></a>
          <?php endforeach; ?>
        </div>
      </div>
      <?php endif; ?>
    </aside>
  </div>
  <?php if ($related->have_posts()) : ?>
  <section class="goodjob-news-detail__related">
    <div class="goodjob-news-detail__related-head">
      <span>More Blogs</span>
      <h2>Related reading</h2>
    </div>
    <div class="goodjob-news-detail__related-grid">
      <?php while ($related->have_posts()) : $related->the_post(); ?>
        <article>
          <time datetime="<?php echo esc_attr(get_the_date('c')); ?>"><?php echo esc_html(get_the_date('Y-m-d')); ?></time>
          <h3><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h3>
          <p><?php echo esc_html(wp_trim_words(get_the_excerpt(), 18)); ?></p>
        </article>
      <?php endwhile; wp_reset_postdata(); ?>
    </div>
  </section>
  <?php endif; ?>
</article>