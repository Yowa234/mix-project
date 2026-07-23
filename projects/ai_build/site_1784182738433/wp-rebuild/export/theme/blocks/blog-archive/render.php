<?php
if (!defined('ABSPATH')) {
    exit;
}

$current_term = is_tax('news_cat') ? get_queried_object() : null;
$current_term_id = ($current_term && !is_wp_error($current_term) && !empty($current_term->term_id)) ? (int) $current_term->term_id : 0;
$query_args = array(
    'post_type' => 'news',
    'post_status' => 'publish',
    'posts_per_page' => 10,
    'orderby' => 'date',
    'order' => 'DESC',
);
if ($current_term_id) {
    $query_args['tax_query'] = array(array(
        'taxonomy' => 'news_cat',
        'field' => 'term_id',
        'terms' => $current_term_id,
    ));
}
$news_query = new WP_Query($query_args);
?>
<section class="goodjob-blog-page">
  <header class="goodjob-blog-hero">
    <div class="goodjob-blog-hero__shade"></div>
    <h1><?php echo is_tax('news_cat') ? esc_html(single_term_title('', false)) : 'Blog'; ?></h1>
  </header>
  <nav class="goodjob-blog-breadcrumb" aria-label="Breadcrumb">
    <a href="<?php echo esc_url(home_url('/')); ?>">Home</a>
    <span aria-hidden="true">›</span>
    <span>Blog</span>
  </nav>
  <div class="goodjob-blog-list">
    <?php if ($news_query->have_posts()) : ?>
      <?php while ($news_query->have_posts()) : $news_query->the_post();
        $image_url = get_the_post_thumbnail_url(get_the_ID(), 'large');
        if (!$image_url) {
            $image_url = (string) get_post_meta(get_the_ID(), 'goodjob_image', true);
        }
        if (!$image_url) {
            $image_url = 'https://placehold.co/640x360/f4f7fb/244aa5?text=' . rawurlencode(get_the_title());
        }
      ?>
        <article class="goodjob-blog-item">
          <a class="goodjob-blog-item__media" href="<?php the_permalink(); ?>">
            <img src="<?php echo esc_url($image_url); ?>" alt="<?php the_title_attribute(); ?>" loading="lazy" decoding="async">
          </a>
          <div class="goodjob-blog-item__body">
            <h2><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h2>
            <time datetime="<?php echo esc_attr(get_the_date('c')); ?>"><?php echo esc_html(get_the_date('Y-m-d')); ?></time>
            <p><?php echo esc_html(wp_trim_words(get_the_excerpt(), 26)); ?></p>
            <a class="goodjob-blog-item__button" href="<?php the_permalink(); ?>">View Detail</a>
          </div>
        </article>
      <?php endwhile; wp_reset_postdata(); ?>
    <?php else : ?>
      <p class="goodjob-blog-empty">No blog posts are published yet. Add News items in the WordPress admin panel.</p>
    <?php endif; ?>
  </div>
</section>