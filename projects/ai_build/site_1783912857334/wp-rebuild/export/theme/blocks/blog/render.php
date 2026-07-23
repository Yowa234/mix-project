<?php
if (!defined('ABSPATH')) {
    exit;
}

$generated_style = <<<'GOODJOB_BLOG_STYLE'
<style>#blog{background:#F4F6FA;color:#061329;padding:clamp(56px,7vw,92px) 0;}#blog .blog-wrap{width:min(1440px,calc(100vw - clamp(32px,6vw,120px)));margin:auto;}#blog .blog-head{display:grid;grid-template-columns:minmax(0,1.2fr) auto;gap:20px;align-items:end;margin-bottom:28px;padding-bottom:18px;border-bottom:1px solid rgba(20,58,123,.14);}#blog .blog-eyebrow{display:inline-block;font-size:.78rem;letter-spacing:.16em;text-transform:uppercase;color:#143A7B;font-weight:700;margin-bottom:10px;padding:6px 10px;border:1px solid rgba(20,58,123,.18);background:#fff;}#blog h2{margin:0;font-size:clamp(2rem,4vw,3.3rem);line-height:1.04;color:#091B39;max-width:12ch;}#blog .blog-intro{margin:10px 0 0;max-width:62ch;color:rgba(6,19,41,.78);}#blog .blog-more{justify-self:end;display:inline-flex;align-items:center;gap:10px;padding:12px 16px;border:1px solid #143A7B;background:#fff;color:#143A7B;text-decoration:none;font-weight:700;transition:transform .2s ease,border-color .2s ease,color .2s ease;}#blog .blog-more svg{width:14px;height:14px;}#blog .blog-more:hover{transform:translateY(-1px);color:#C8161C;border-color:#C8161C;}#blog .blog-feature{display:grid;grid-template-columns:minmax(0,1.2fr);gap:0;margin-bottom:18px;}#blog .blog-feature-card{background:linear-gradient(180deg,#ffffff 0%,#f8faff 100%);border:1px solid rgba(20,58,123,.14);box-shadow:0 18px 40px rgba(9,27,57,.08);}#blog .blog-feature-media{aspect-ratio:16/7;background:linear-gradient(135deg,rgba(20,58,123,.95),rgba(9,27,57,.92));position:relative;overflow:hidden;border-bottom:1px solid rgba(255,255,255,.08);}#blog .blog-feature-media::after{content:"";position:absolute;inset:18px auto auto 18px;width:38%;height:1px;background:rgba(255,255,255,.26);}#blog .blog-feature-body{padding:clamp(22px,3vw,34px);}#blog .blog-meta{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:14px;color:rgba(6,19,41,.62);font-size:.95rem;}#blog .blog-tag{display:inline-flex;align-items:center;gap:8px;padding:7px 10px;background:#fff;border:1px solid rgba(20,58,123,.14);color:#143A7B;font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;}#blog .blog-tag svg{width:13px;height:13px;}#blog .blog-feature-title{margin:0 0 10px;font-size:clamp(1.5rem,2.3vw,2.15rem);line-height:1.15;color:#091B39;}#blog .blog-feature-text{margin:0;max-width:68ch;color:rgba(6,19,41,.78);}#blog .blog-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;}#blog .blog-row{background:#fff;border:1px solid rgba(20,58,123,.14);padding:18px 18px 16px;transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease;}#blog .blog-row:hover{transform:translateY(-2px);border-color:rgba(200,22,28,.35);box-shadow:0 14px 30px rgba(9,27,57,.06);}#blog .blog-date{display:block;margin-bottom:8px;color:rgba(6,19,41,.55);font-size:.86rem;}#blog .blog-row-title{display:inline-block;margin:0 0 10px;color:#091B39;text-decoration:none;font-weight:700;line-height:1.3;}#blog .blog-row-title:hover{text-decoration:underline;text-decoration-color:#C8161C;text-underline-offset:3px;}#blog .blog-row p{margin:0;color:rgba(6,19,41,.74);}#blog .blog-path{margin-top:18px;display:flex;flex-wrap:wrap;gap:10px;}#blog .blog-chip{padding:8px 12px;border:1px solid rgba(20,58,123,.16);background:rgba(255,255,255,.72);color:#143A7B;font-size:.82rem;font-weight:700;text-decoration:none;}@media (max-width:760px){#blog .blog-head{grid-template-columns:1fr;}#blog .blog-more{justify-self:start;}#blog .blog-feature-media{aspect-ratio:16/9;}#blog .blog-list{grid-template-columns:1fr;}#blog h2{max-width:none;}}</style>
<style data-goodjob-cpt-adapter="blog">
#blog.goodjob-cpt-blog{overflow:hidden}
#blog.goodjob-cpt-blog .blog-wrap{width:min(1280px,calc(100vw - clamp(32px,6vw,120px)))!important;max-width:none!important;margin-inline:auto!important}
#blog.goodjob-cpt-blog .blog-head{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:clamp(18px,3vw,36px)!important;align-items:end!important}
#blog.goodjob-cpt-blog .blog-content{display:grid!important;grid-template-columns:minmax(0,1.05fr) minmax(320px,.95fr)!important;gap:clamp(18px,2.6vw,34px)!important;align-items:start!important}
#blog.goodjob-cpt-blog .blog-feature{display:block!important;margin:0!important;min-width:0!important}
#blog.goodjob-cpt-blog .blog-feature-card{overflow:hidden!important;min-width:0!important}
#blog.goodjob-cpt-blog .blog-feature-media{display:block!important;width:100%!important;aspect-ratio:16/9!important;min-height:0!important;max-height:460px!important;overflow:hidden!important}
#blog.goodjob-cpt-blog .blog-feature-media img{width:100%!important;height:100%!important;object-fit:cover!important;display:block!important}
#blog.goodjob-cpt-blog .blog-feature-body{padding:clamp(20px,3vw,34px)!important}
#blog.goodjob-cpt-blog .blog-meta{display:flex!important;flex-wrap:wrap!important;gap:10px!important;align-items:center!important;margin-bottom:12px!important}
#blog.goodjob-cpt-blog .blog-list{display:grid!important;grid-template-columns:1fr!important;gap:12px!important;align-content:start!important;min-width:0!important}
#blog.goodjob-cpt-blog .blog-row{display:block!important;min-width:0!important;overflow:hidden!important;padding:clamp(14px,1.6vw,20px)!important}
#blog.goodjob-cpt-blog .blog-row-media{display:none!important}
#blog.goodjob-cpt-blog .blog-row-media img{width:100%!important;height:100%!important;object-fit:cover!important;display:block!important}
#blog.goodjob-cpt-blog .blog-row-title{color:inherit!important;text-decoration:none!important;overflow-wrap:anywhere}
#blog.goodjob-cpt-blog .blog-row p{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
@media(max-width:980px){#blog.goodjob-cpt-blog .blog-content{grid-template-columns:1fr!important}#blog.goodjob-cpt-blog .blog-list{grid-template-columns:1fr!important}}
@media(max-width:820px){#blog.goodjob-cpt-blog .blog-head{grid-template-columns:1fr!important}}
@media(max-width:560px){#blog.goodjob-cpt-blog .blog-wrap{width:min(100% - 32px,680px)!important}#blog.goodjob-cpt-blog .blog-row{grid-template-columns:1fr!important}#blog.goodjob-cpt-blog .blog-feature-media{aspect-ratio:16/9!important}}
</style>
GOODJOB_BLOG_STYLE;
$html_source = function_exists('get_field') ? get_field('html_source') : '';
if (is_string($html_source) && trim($html_source) !== '') {
    echo $html_source; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    return;
}

$title = function_exists('get_field') ? (get_field('title') ?: "Practical guides for industrial buyers") : "Practical guides for industrial buyers";
$intro = function_exists('get_field') ? (get_field('intro') ?: "Selection logic, maintenance routines, troubleshooting notes, and export market updates to help sourcing teams compare industrial product families with less risk.") : "Selection logic, maintenance routines, troubleshooting notes, and export market updates to help sourcing teams compare industrial product families with less risk.";
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
<section id="blog" class="ai-section blog-industrial-editorial-digest goodjob-cpt-blog" aria-labelledby="blog-title">
  <?php echo $generated_style; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
  <?php if ($news_query->have_posts()) : ?>
    <div class="blog-wrap ai-wrap">
      <div class="blog-head ai-section-head">
        <div>
          <span class="blog-eyebrow">Recent Blogs</span>
          <h2 id="blog-title"><?php echo esc_html($title); ?></h2>
          <p class="blog-intro"><?php echo esc_html($intro); ?></p>
        </div>
        <a class="blog-more ai-btn" href="<?php echo esc_url($primary_url ?: get_post_type_archive_link('news')); ?>"><?php echo esc_html($primary_label); ?> <span aria-hidden="true">&#8594;</span></a>
      </div>
      <div class="blog-content">
      <div class="blog-feature">
        <?php $news_query->the_post(); $featured_id = get_the_ID();
          $image_url = get_the_post_thumbnail_url(get_the_ID(), 'large');
          if (!$image_url) {
              $image_url = (string) get_post_meta(get_the_ID(), 'goodjob_image', true);
          }
          if (!$image_url) {
              $image_url = 'https://placehold.co/960x540/f4f7fb/244aa5?text=' . rawurlencode(get_the_title());
          }
        ?>
        <article class="blog-feature-card goodjob-featured-post ai-card">
          <a class="blog-feature-media goodjob-featured-post__media" href="<?php the_permalink(); ?>">
            <img src="<?php echo esc_url($image_url); ?>" alt="<?php the_title_attribute(); ?>" loading="lazy" decoding="async">
          </a>
          <div class="blog-feature-body goodjob-featured-post__body">
            <div class="blog-meta">
              <time datetime="<?php echo esc_attr(get_the_date('c')); ?>"><?php echo esc_html(get_the_date('Y-m-d')); ?></time>
              <span class="blog-tag">Buyer Guide</span>
            </div>
            <h3 class="blog-feature-title"><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h3>
            <p class="blog-feature-text"><?php echo esc_html(wp_trim_words(get_the_excerpt(), 28)); ?></p>
          </div>
        </article>
      </div>
      <div class="blog-list goodjob-home-blog__list" aria-label="Recent article list">
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
            <article class="blog-row goodjob-blog-row ai-card">
              <a class="blog-row-media goodjob-blog-row__media" href="<?php the_permalink(); ?>">
                <img src="<?php echo esc_url($row_image); ?>" alt="<?php the_title_attribute(); ?>" loading="lazy" decoding="async">
              </a>
              <div>
                <time class="blog-date" datetime="<?php echo esc_attr(get_the_date('c')); ?>"><?php echo esc_html(get_the_date('Y-m-d')); ?></time>
                <h3><a class="blog-row-title" href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h3>
                <p><?php echo esc_html(wp_trim_words(get_the_excerpt(), 20)); ?></p>
              </div>
            </article>
          <?php endwhile; wp_reset_postdata(); ?>
      </div>
      </div>
    </div>
  <?php else : ?>
    <div class="blog-wrap"><p class="goodjob-home-blog__empty">No blog posts are published yet. Add News items in the WordPress admin panel.</p></div>
  <?php endif; ?>
</section>