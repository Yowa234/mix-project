<?php
if (!defined('ABSPATH')) {
    exit;
}

$generated_style = <<<'GOODJOB_BLOG_STYLE'
<style>
    #blog{padding:64px 0;background:linear-gradient(180deg,#ffffff 0%,#f7faff 100%);color:#16202E;overflow:hidden}
    #blog *{box-sizing:border-box}
    #blog .blog-industrial-editorial-digest__wrap{width:min(1440px,calc(100vw - clamp(32px,6vw,120px)));margin:auto;display:grid;gap:clamp(18px,3vw,32px)}
    #blog .blog-industrial-editorial-digest__head{display:grid;gap:10px;max-width:760px}
    #blog .blog-industrial-editorial-digest__eyebrow{font-size:.82rem;letter-spacing:.18em;text-transform:uppercase;color:#2563EB;font-weight:700}
    #blog .blog-industrial-editorial-digest__title{margin:0;font:700 clamp(30px,3.6vw,46px)/1.08 "Barlow Semi Condensed",Barlow,Arial,sans-serif}
    #blog .blog-industrial-editorial-digest__intro{margin:0;max-width:62ch;color:#6B7686;font:400 clamp(16px,1.2vw,17px)/1.72 Barlow,Inter,Arial,sans-serif}
    #blog .blog-industrial-editorial-digest__rail{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(280px,.9fr);gap:clamp(18px,3vw,32px);align-items:stretch}
    #blog .blog-industrial-editorial-digest__featured,#blog .blog-industrial-editorial-digest__list{border:1px solid #E2E7EE;background:linear-gradient(180deg,#ffffff 0%,#F8FAFC 100%);border-radius:2px;box-shadow:0 18px 40px rgba(17,46,108,.06)}
    #blog .blog-industrial-editorial-digest__featured{padding:clamp(18px,2.4vw,28px);display:grid;gap:16px;min-height:100%}
    #blog .blog-industrial-editorial-digest__chiprow{display:flex;flex-wrap:wrap;gap:8px}
    #blog .blog-industrial-editorial-digest__chip{padding:6px 10px;border:1px solid #D9E2F0;border-radius:999px;background:#fff;color:#112E6C;font-size:.78rem;font-weight:600;letter-spacing:.02em}
    #blog .blog-industrial-editorial-digest__featured-media{aspect-ratio:16/9;border-radius:2px;background:linear-gradient(135deg,rgba(37,99,235,.12),rgba(14,165,233,.08));border:1px solid #E2E7EE;position:relative;overflow:hidden}
    #blog .blog-industrial-editorial-digest__featured-media:after{content:"";position:absolute;inset:12% 8%;border:1px solid rgba(17,46,108,.12);background:repeating-linear-gradient(90deg,rgba(37,99,235,.08) 0 1px,transparent 1px 18px),repeating-linear-gradient(0deg,rgba(37,99,235,.06) 0 1px,transparent 1px 18px)}
    #blog .blog-industrial-editorial-digest__featured-title{margin:0;max-width:20ch;font:700 clamp(24px,2.4vw,34px)/1.12 "Barlow Semi Condensed",Barlow,Arial,sans-serif}
    #blog .blog-industrial-editorial-digest__featured-text{margin:0;color:#3C4858;max-width:60ch}
    #blog .blog-industrial-editorial-digest__cta{display:inline-flex;align-items:center;gap:10px;width:max-content;padding:12px 16px;border-radius:999px;background:#2563EB;color:#fff;text-decoration:none;font-weight:700;transition:transform .2s ease,background .2s ease}
    #blog .blog-industrial-editorial-digest__cta:hover{transform:translateY(-1px);background:#112E6C}
    #blog .blog-industrial-editorial-digest__list{padding:clamp(14px,1.8vw,20px);display:grid;gap:12px}
    #blog .blog-industrial-editorial-digest__listhead{display:flex;justify-content:space-between;align-items:center;gap:12px;padding-bottom:6px;border-bottom:1px solid #E2E7EE}
    #blog .blog-industrial-editorial-digest__listtitle{margin:0;font-size:1rem;letter-spacing:.08em;text-transform:uppercase;color:#112E6C}
    #blog .blog-industrial-editorial-digest__more{color:#2563EB;text-decoration:none;font-weight:700;white-space:nowrap}
    #blog .blog-industrial-editorial-digest__item{display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:start;padding:12px 0;border-top:1px solid #EAEFF6;text-decoration:none;color:inherit;transition:background .2s ease}
    #blog .blog-industrial-editorial-digest__item:first-of-type{border-top:0;padding-top:2px}
    #blog .blog-industrial-editorial-digest__date{font-size:.78rem;color:#6B7686;letter-spacing:.08em;text-transform:uppercase;min-width:76px}
    #blog .blog-industrial-editorial-digest__meta{display:grid;gap:6px}
    #blog .blog-industrial-editorial-digest__itemtitle{margin:0;font-size:1.02rem;line-height:1.34;color:#16202E}
    #blog .blog-industrial-editorial-digest__excerpt{margin:0;color:#6B7686;font-size:.95rem;line-height:1.55}
    #blog .blog-industrial-editorial-digest__item:hover .blog-industrial-editorial-digest__itemtitle,#blog .blog-industrial-editorial-digest__more:hover{text-decoration:underline}
    #blog .blog-industrial-editorial-digest__footer{display:flex;justify-content:flex-start}
    @media (max-width:760px){#blog{padding:64px 0}#blog .blog-industrial-editorial-digest__rail{grid-template-columns:1fr}#blog .blog-industrial-editorial-digest__item{grid-template-columns:1fr;gap:6px}#blog .blog-industrial-editorial-digest__date{min-width:0}}
  </style>
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

$title = function_exists('get_field') ? (get_field('title') ?: "Selection guides, maintenance notes, and market signals for industrial buyers.") : "Selection guides, maintenance notes, and market signals for industrial buyers.";
$intro = function_exists('get_field') ? (get_field('intro') ?: "Read concise technical articles on product knowledge, model selection, upkeep routines, troubleshooting, and demand trends across industrial applications.") : "Read concise technical articles on product knowledge, model selection, upkeep routines, troubleshooting, and demand trends across industrial applications.";
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