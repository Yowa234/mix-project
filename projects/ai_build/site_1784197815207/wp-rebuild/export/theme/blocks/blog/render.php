<?php
if (!defined('ABSPATH')) {
    exit;
}

$html_source = function_exists('get_field') ? get_field('html_source') : '';
if (is_string($html_source) && trim($html_source) !== '') {
    echo $html_source; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    return;
}

$title = function_exists('get_field') ? (get_field('title') ?: "Industrial knowledge for faster buying decisions") : "Industrial knowledge for faster buying decisions";
$intro = function_exists('get_field') ? (get_field('intro') ?: "Explore practical guides across three product families, from component selection and lifecycle maintenance to troubleshooting and market shifts shaping industrial sourcing.") : "Explore practical guides across three product families, from component selection and lifecycle maintenance to troubleshooting and market shifts shaping industrial sourcing.";
$primary_label = function_exists('get_field') ? (get_field('primary_label') ?: 'More Blogs') : 'More Blogs';
$primary_url = function_exists('get_field') ? (get_field('primary_url') ?: get_post_type_archive_link('news')) : get_post_type_archive_link('news');
$news_query = new WP_Query(array(
    'post_type' => 'news',
    'post_status' => 'publish',
    'posts_per_page' => 5,
    'orderby' => 'date',
    'order' => 'DESC',
));
$featured_id = 0;
?>
<section id="blog" class="ai-section goodjob-home-blog goodjob-cpt-blog">
  <style>
  #blog.goodjob-home-blog{background:#fff;padding:clamp(62px,8vw,108px) clamp(18px,5vw,72px);color:#101828}
  #blog .goodjob-home-blog__wrap{width:min(1440px,100%);margin:auto;display:grid;grid-template-columns:minmax(0,.9fr) minmax(360px,1fr);gap:clamp(30px,5vw,72px);align-items:start}
  #blog .goodjob-home-blog__intro span{display:inline-flex;margin-bottom:12px;color:var(--blue,#244aa5);font-weight:900;letter-spacing:.12em;text-transform:uppercase;font-size:12px}
  #blog .goodjob-home-blog__intro h2{margin:0 0 16px;color:#101828;font-size:clamp(34px,4.4vw,60px);line-height:1.02;text-transform:uppercase}
  #blog .goodjob-home-blog__intro p{margin:0 0 26px;color:#667085;font-size:clamp(15px,1.2vw,18px);line-height:1.74;max-width:620px}
  #blog .goodjob-featured-post{border:1px solid #d9e1ec;background:#f7f8fb;overflow:hidden}
  #blog .goodjob-featured-post__media{display:block;aspect-ratio:16/9;background:#eef2f7;overflow:hidden}
  #blog .goodjob-featured-post__media img{width:100%;height:100%;object-fit:cover;display:block}
  #blog .goodjob-featured-post__body{padding:clamp(20px,3vw,30px);background:#fff}
  #blog .goodjob-featured-post time,#blog .goodjob-blog-row time{display:block;color:#98a2b3;font-size:14px;margin-bottom:10px}
  #blog .goodjob-featured-post h3{margin:0 0 12px;font-size:clamp(24px,2.6vw,34px);line-height:1.12}
  #blog .goodjob-featured-post h3 a,#blog .goodjob-blog-row h3 a{color:var(--blue,#244aa5);text-decoration:none}
  #blog .goodjob-featured-post p,#blog .goodjob-blog-row p{margin:0;color:#344054;line-height:1.68}
  #blog .goodjob-blog-list__head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:18px}
  #blog .goodjob-blog-list__head h3{margin:0;color:#101828;font-size:clamp(24px,2.8vw,36px);line-height:1;text-transform:uppercase}
  #blog .goodjob-blog-list__head a{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 16px;background:var(--blue,#244aa5);color:#fff;text-decoration:none;font-weight:900}
  #blog .goodjob-blog-rows{display:grid;gap:0}
  #blog .goodjob-blog-row{display:grid;grid-template-columns:132px minmax(0,1fr);gap:18px;padding:22px 0;border-bottom:1px solid #e4e7ec}
  #blog .goodjob-blog-row__media{display:block;aspect-ratio:4/3;background:#f3f5f8;overflow:hidden;border:1px solid #e4e7ec}
  #blog .goodjob-blog-row__media img{width:100%;height:100%;object-fit:cover;display:block}
  #blog .goodjob-blog-row h3{margin:0 0 9px;font-size:21px;line-height:1.18}
  #blog .goodjob-home-blog__empty{grid-column:1/-1;padding:24px;background:#f7f9fc;border:1px dashed #cbd5e1;color:#667085}
  @media(max-width:980px){#blog .goodjob-home-blog__wrap{grid-template-columns:1fr}#blog .goodjob-blog-list__head{align-items:flex-start;flex-direction:column}}
  @media(max-width:560px){#blog.goodjob-home-blog{padding:42px 16px}#blog .goodjob-blog-row{grid-template-columns:1fr}#blog .goodjob-blog-list__head a{width:100%}}
  </style>
  <?php if ($news_query->have_posts()) : ?>
    <div class="goodjob-home-blog__wrap">
      <div class="goodjob-home-blog__intro">
        <span>Recent Blogs</span>
        <h2><?php echo esc_html($title); ?></h2>
        <p><?php echo esc_html($intro); ?></p>
        <?php $news_query->the_post(); $featured_id = get_the_ID();
          $image_url = get_the_post_thumbnail_url(get_the_ID(), 'large');
          if (!$image_url) {
              $image_url = (string) get_post_meta(get_the_ID(), 'goodjob_image', true);
          }
          if (!$image_url) {
              $image_url = 'https://placehold.co/960x540/f4f7fb/244aa5?text=' . rawurlencode(get_the_title());
          }
        ?>
        <article class="goodjob-featured-post">
          <a class="goodjob-featured-post__media" href="<?php the_permalink(); ?>">
            <img src="<?php echo esc_url($image_url); ?>" alt="<?php the_title_attribute(); ?>" loading="lazy" decoding="async">
          </a>
          <div class="goodjob-featured-post__body">
            <time datetime="<?php echo esc_attr(get_the_date('c')); ?>"><?php echo esc_html(get_the_date('Y-m-d')); ?></time>
            <h3><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h3>
            <p><?php echo esc_html(wp_trim_words(get_the_excerpt(), 28)); ?></p>
          </div>
        </article>
      </div>
      <div class="goodjob-home-blog__list">
        <div class="goodjob-blog-list__head">
          <h3>More Blogs</h3>
          <a href="<?php echo esc_url($primary_url ?: get_post_type_archive_link('news')); ?>"><?php echo esc_html($primary_label); ?></a>
        </div>
        <div class="goodjob-blog-rows">
          <?php while ($news_query->have_posts()) : $news_query->the_post();
            if (get_the_ID() === $featured_id) {
                continue;
            }
            $row_image = get_the_post_thumbnail_url(get_the_ID(), 'medium_large');
            if (!$row_image) {
                $row_image = (string) get_post_meta(get_the_ID(), 'goodjob_image', true);
            }
            if (!$row_image) {
                $row_image = 'https://placehold.co/420x300/f4f7fb/244aa5?text=' . rawurlencode(get_the_title());
            }
          ?>
            <article class="goodjob-blog-row">
              <a class="goodjob-blog-row__media" href="<?php the_permalink(); ?>">
                <img src="<?php echo esc_url($row_image); ?>" alt="<?php the_title_attribute(); ?>" loading="lazy" decoding="async">
              </a>
              <div>
                <time datetime="<?php echo esc_attr(get_the_date('c')); ?>"><?php echo esc_html(get_the_date('Y-m-d')); ?></time>
                <h3><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h3>
                <p><?php echo esc_html(wp_trim_words(get_the_excerpt(), 20)); ?></p>
              </div>
            </article>
          <?php endwhile; wp_reset_postdata(); ?>
        </div>
      </div>
    </div>
  <?php else : ?>
    <p class="goodjob-home-blog__empty">No blog posts are published yet. Add News items in the WordPress admin panel.</p>
  <?php endif; ?>
</section>