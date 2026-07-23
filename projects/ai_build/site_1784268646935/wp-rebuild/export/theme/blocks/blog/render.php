<?php
if (!defined('ABSPATH')) {
    exit;
}

$generated_style = <<<'GOODJOB_BLOG_STYLE'
<style>#blog{background:linear-gradient(180deg,#0C214E 0%,#112E6C 36%,#F8FAFC 100%);color:#0C214E}#blog .blog-wrap{width:min(1440px,calc(100vw - clamp(32px,6vw,120px)));margin:auto;padding:clamp(28px,4vw,56px) 0;position:relative}#blog .blog-wrap:before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(14,165,233,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(14,165,233,.08) 1px,transparent 1px);background-size:28px 28px;mask-image:linear-gradient(180deg,rgba(0,0,0,.55),transparent 78%);pointer-events:none}#blog .blog-head{position:relative;z-index:1;max-width:760px;margin-bottom:clamp(20px,3vw,34px)}#blog .blog-eyebrow{display:inline-flex;align-items:center;gap:10px;padding:8px 12px;border:1px solid rgba(14,165,233,.28);background:rgba(248,250,252,.08);color:#BFE9FB;text-transform:uppercase;letter-spacing:.14em;font-size:.78rem}#blog h2{margin:14px 0 10px;color:#F8FAFC;font-size:clamp(2rem,4vw,3.4rem);line-height:1.05}#blog .blog-intro{margin:0;color:#D7E8FF;max-width:62ch}#blog .blog-stage{position:relative;z-index:1;display:grid;grid-template-columns:minmax(0,1.3fr) minmax(280px,.9fr);gap:clamp(18px,2vw,28px);align-items:start}#blog .blog-featured{display:grid;gap:14px;padding:clamp(18px,2.4vw,26px);border:1px solid rgba(37,99,235,.22);background:linear-gradient(180deg,rgba(248,250,252,.96),rgba(222,241,255,.92));box-shadow:0 18px 40px rgba(12,33,78,.08)}#blog .blog-feature-media{aspect-ratio:16/9;border:1px solid rgba(14,165,233,.2);background:linear-gradient(135deg,#112E6C,#2563EB 58%,#0EA5E9);position:relative;overflow:hidden}#blog .blog-feature-media:before,#blog .blog-feature-media:after{content:"";position:absolute;border-radius:999px;background:rgba(255,255,255,.18)}#blog .blog-feature-media:before{width:130%;height:48%;left:-8%;bottom:-14%;transform:rotate(-8deg)}#blog .blog-feature-media:after{width:88%;height:20%;right:-8%;top:18%;background:rgba(191,233,251,.22)}#blog .blog-meta{display:flex;flex-wrap:wrap;gap:10px 12px;align-items:center}#blog .blog-chip{padding:6px 10px;border:1px solid rgba(14,165,233,.24);background:#EFF8FF;color:#112E6C;font-size:.8rem}#blog .blog-date{color:#4B6B9E;font-size:.88rem}#blog .blog-featured h3{margin:0;font-size:clamp(1.35rem,2vw,1.9rem);line-height:1.15}#blog .blog-featured p{margin:0;color:#35527F;max-width:58ch}#blog .blog-cta{display:inline-flex;align-items:center;gap:10px;width:max-content;padding:12px 16px;border-radius:999px;background:linear-gradient(90deg,#2563EB,#0EA5E9);color:#fff;text-decoration:none;font-weight:600;transition:transform .25s ease,text-decoration-color .25s ease}#blog .blog-cta:hover{transform:translateY(-2px)}#blog .blog-side{display:grid;gap:14px}#blog .blog-more{display:flex;justify-content:flex-end}#blog .blog-more a{display:inline-flex;align-items:center;gap:8px;color:#F8FAFC;text-decoration:none;border-bottom:1px solid transparent;padding-bottom:2px}#blog .blog-more a:hover{border-color:#BFE9FB}#blog .blog-list{display:grid;gap:12px}#blog .blog-row{display:grid;grid-template-columns:110px minmax(0,1fr);gap:14px;padding:14px 16px;border-left:2px solid rgba(14,165,233,.28);border-top:1px solid rgba(255,255,255,.08);background:rgba(248,250,252,.08);text-decoration:none;transition:transform .22s ease,border-color .22s ease}#blog .blog-row:hover{transform:translateX(4px);border-left-color:#0EA5E9}#blog .blog-row time{color:#B8D2FF;font-size:.86rem}#blog .blog-row strong{display:block;color:#F8FAFC;font-size:1rem;line-height:1.3;margin-bottom:6px;text-decoration:underline;text-decoration-color:transparent;text-underline-offset:3px}#blog .blog-row:hover strong{text-decoration-color:#BFE9FB}#blog .blog-row span{color:#D7E8FF;font-size:.92rem}#blog .blog-knowledge{margin-top:16px;padding:16px;border:1px solid rgba(14,165,233,.22);background:rgba(248,250,252,.1)}#blog .blog-knowledge p{margin:0 0 10px;color:#D7E8FF}#blog .blog-knowledge a{display:inline-flex;align-items:center;gap:8px;color:#BFE9FB;text-decoration:none}#blog .blog-knowledge a:hover{text-decoration:underline}#blog svg{width:1em;height:1em;fill:currentColor}#blog .blog-wave{display:inline-block;transform:translateY(-1px);color:#0EA5E9}@media (max-width:760px){#blog .blog-stage{grid-template-columns:1fr}#blog .blog-row{grid-template-columns:1fr}#blog .blog-more{justify-content:flex-start}#blog .blog-featured p,#blog .blog-intro{max-width:none}}</style>
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

$title = function_exists('get_field') ? (get_field('title') ?: "Research-backed guides for valves, pumps, seals, and flow control systems.") : "Research-backed guides for valves, pumps, seals, and flow control systems.";
$intro = function_exists('get_field') ? (get_field('intro') ?: "Built for sourcing teams and plant engineers: selection logic, maintenance planning, troubleshooting paths, and market insight in one industrial knowledge center.") : "Built for sourcing teams and plant engineers: selection logic, maintenance planning, troubleshooting paths, and market insight in one industrial knowledge center.";
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