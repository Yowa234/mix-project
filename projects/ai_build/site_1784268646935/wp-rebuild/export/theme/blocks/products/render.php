<?php
if (!defined('ABSPATH')) {
    exit;
}

$generated_style = <<<'GOODJOB_PRODUCTS_STYLE'
<style>#products{position:relative;padding:clamp(56px,7vw,92px) 0;background:linear-gradient(180deg,#0C214E 0%,#112E6C 34%,#F8FAFC 100%);color:#16202E;overflow:hidden}#products:before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.14;background-image:linear-gradient(rgba(14,165,233,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(14,165,233,.12) 1px,transparent 1px);background-size:28px 28px,28px 28px}#products .products-wrap{position:relative;z-index:1;max-width:1280px;margin:0 auto;padding:0 clamp(18px,4vw,34px)}#products .products-head{text-align:center;margin-bottom:26px}#products .eyebrow{display:inline-flex;align-items:center;gap:10px;padding:8px 14px;border:1px solid rgba(14,165,233,.34);background:linear-gradient(180deg,rgba(37,99,235,.14),rgba(14,165,233,.08));color:#EAF5FF;text-transform:uppercase;letter-spacing:.12em;font-size:12px}#products .eyebrow:after{content:"";width:34px;height:2px;background:linear-gradient(90deg,#2563EB,#0EA5E9)}#products h2{margin:14px 0 10px;color:#fff;font-size:clamp(28px,4vw,46px);letter-spacing:.04em;text-transform:uppercase}#products .intro{max-width:760px;margin:0 auto;color:#D9E7FF;line-height:1.7}#products .tabs{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin:28px 0 30px}#products .products-tab{border:1px solid rgba(14,165,233,.28);background:#F8FAFC;color:#112E6C;padding:12px 18px;border-radius:999px;font-weight:700;cursor:pointer;transition:transform .25s ease,background .25s ease,color .25s ease,border-color .25s ease}#products .products-tab.is-active,#products .products-tab:hover{background:linear-gradient(90deg,#2563EB,#0EA5E9);color:#fff;border-color:transparent;transform:translateY(-2px)}#products .slider{position:relative}#products .pager{position:absolute;opacity:0;pointer-events:none}#products .stage{position:relative}#products .page{display:none;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px}#products #products-page-1:checked~.stage .page-1,#products #products-page-2:checked~.stage .page-2{display:grid}#products .card{display:flex;flex-direction:column;background:#F8FAFC;border:1px solid #DCE6F3;box-shadow:0 16px 40px rgba(12,33,78,.08);transition:transform .28s ease,border-color .28s ease}#products .card:hover{transform:translateY(-5px);border-color:#0EA5E9}#products .media{aspect-ratio:1/1;position:relative;overflow:hidden;background:linear-gradient(180deg,#E8F5FF,#D8ECFA)}#products .media:after{content:"";position:absolute;left:0;right:0;bottom:0;height:26%;background:linear-gradient(180deg,transparent,rgba(14,165,233,.18))}#products .media img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .5s ease}#products .card:hover .media img{transform:scale(1.05)}#products .body{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:end;padding:18px}#products .name{margin:0;color:#0C214E;font-size:15px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;line-height:1.4}#products .chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}#products .chip{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:6px 9px;background:#EAEEF4;color:#2563EB;border:1px solid #D8E2EF}#products .arrow-link{display:inline-grid;place-items:center;width:42px;height:42px;border-radius:999px;text-decoration:none;background:linear-gradient(135deg,#2563EB,#0EA5E9);color:#fff;font-size:18px;transform:translateZ(0);transition:transform .25s ease}#products .card:hover .arrow-link{transform:translateX(2px)}#products .nav{display:flex;justify-content:space-between;align-items:center;margin-top:22px}#products .nav label{display:inline-grid;place-items:center;width:52px;height:52px;border-radius:999px;border:1px solid rgba(37,99,235,.22);background:#fff;color:#112E6C;cursor:pointer;font-size:22px;box-shadow:0 10px 24px rgba(12,33,78,.08);transition:transform .25s ease,background .25s ease,color .25s ease}#products .nav label:hover{transform:translateY(-2px);background:linear-gradient(135deg,#2563EB,#0EA5E9);color:#fff}#products .nav .set{display:none;gap:12px;width:100%;justify-content:space-between}#products #products-page-1:checked~.nav .set-1,#products #products-page-2:checked~.nav .set-2{display:flex}#products .wave-line{height:1px;margin:0 auto 18px;max-width:260px;background:linear-gradient(90deg,transparent,#0EA5E9,transparent)}@media(max-width:760px){#products{padding:48px 0}#products .page{grid-template-columns:1fr}#products .intro{font-size:14px}#products .tabs{gap:10px}#products .products-tab{width:calc(50% - 8px);justify-content:center}#products .nav{display:none}}</style>
<style data-goodjob-cpt-adapter="products">
#products.goodjob-cpt-products{overflow:hidden}
#products.goodjob-cpt-products .products-wrap{width:min(1280px,calc(100vw - clamp(32px,6vw,120px)))!important;max-width:none!important;margin-inline:auto!important}
#products.goodjob-cpt-products .products-stage{overflow:visible!important}
#products.goodjob-cpt-products .products-pages{overflow:visible!important}
#products.goodjob-cpt-products [data-product-category-panel][hidden]{display:none!important}
#products.goodjob-cpt-products [data-product-category-panel]{display:block!important;width:100%!important;min-width:0!important;transform:none!important}
#products.goodjob-cpt-products .products-track{display:block!important;width:100%!important;min-width:0!important;transform:none!important;transition:none!important}
#products.goodjob-cpt-products .products-page{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:clamp(18px,2vw,28px)!important;width:100%!important;min-width:0!important}
#products.goodjob-cpt-products .product-card{display:flex!important;flex-direction:column!important;min-width:0!important;height:100%!important;overflow:hidden!important}
#products.goodjob-cpt-products .product-media{display:block!important;width:100%!important;aspect-ratio:1/1!important;min-height:0!important;max-height:none!important;overflow:hidden!important;flex:0 0 auto!important}
#products.goodjob-cpt-products .product-media img{width:100%!important;height:100%!important;object-fit:contain!important;display:block!important}
#products.goodjob-cpt-products .product-body{display:flex!important;flex:1 1 auto!important;flex-direction:column!important;gap:10px!important;min-height:150px!important;padding:clamp(14px,1.7vw,22px)!important}
#products.goodjob-cpt-products .product-name{margin:0!important;overflow-wrap:anywhere}
#products.goodjob-cpt-products .product-name a{color:inherit!important;text-decoration:none!important}
#products.goodjob-cpt-products .product-copy{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
#products.goodjob-cpt-products .product-meta{margin-top:auto!important;min-width:0!important}
#products.goodjob-cpt-products .product-arrow{flex:0 0 auto}
#products.goodjob-cpt-products .products-empty{grid-column:1/-1;margin:0;padding:22px;background:rgba(255,255,255,.9);color:#344054}
@media(max-width:1100px){#products.goodjob-cpt-products .products-page{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
@media(max-width:640px){#products.goodjob-cpt-products .products-wrap{width:min(100% - 32px,680px)!important}#products.goodjob-cpt-products .products-page{grid-template-columns:1fr!important}#products.goodjob-cpt-products .product-media{aspect-ratio:4/3!important}}
</style>
GOODJOB_PRODUCTS_STYLE;
$html_source = function_exists('get_field') ? get_field('html_source') : '';
if (is_string($html_source) && trim($html_source) !== '') {
    echo $html_source; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    return;
}

$title = function_exists('get_field') ? (get_field('title') ?: "Product Category") : "Product Category";
$intro = function_exists('get_field') ? (get_field('intro') ?: "Explore research-ready marine product lines built for sourcing teams, labs, and industrial buyers seeking traceable quality, application clarity, and direct inquiry access.") : "Explore research-ready marine product lines built for sourcing teams, labs, and industrial buyers seeking traceable quality, application clarity, and direct inquiry access.";
$primary_label = function_exists('get_field') ? (get_field('primary_label') ?: 'View All Products') : 'View All Products';
$primary_url = function_exists('get_field') ? (get_field('primary_url') ?: get_post_type_archive_link('product')) : get_post_type_archive_link('product');
$terms = get_terms(array('taxonomy' => 'product_cat', 'hide_empty' => false, 'number' => 8));
if (is_wp_error($terms) || !is_array($terms)) {
    $terms = array();
}
$fallback_categories = array("Industrial Products", "OEM Components", "Export Assemblies", "Custom Parts");
$category_names = array();
foreach ($terms as $term) {
    if (!empty($term->name)) {
        $category_names[] = (string) $term->name;
    }
}
if (!$category_names) {
    $category_names = $fallback_categories;
}
$render_card = function ($category_label = '') {
    $image_url = get_the_post_thumbnail_url(get_the_ID(), 'large');
    if (!$image_url) {
        $image_url = (string) get_post_meta(get_the_ID(), 'goodjob_image', true);
    }
    if (!$image_url) {
        $image_url = 'https://placehold.co/640x520/f4f7fb/244aa5?text=' . rawurlencode(get_the_title());
    }
    $label = $category_label;
    if (!$label) {
        $post_terms = get_the_terms(get_the_ID(), 'product_cat');
        if (!is_wp_error($post_terms) && is_array($post_terms) && !empty($post_terms[0]->name)) {
            $label = (string) $post_terms[0]->name;
        }
    }
    ?>
    <article class="product-card products-card">
      <a class="product-media" href="<?php the_permalink(); ?>">
        <img src="<?php echo esc_url($image_url); ?>" alt="<?php the_title_attribute(); ?>" loading="lazy" decoding="async">
      </a>
      <div class="product-body">
        <h3 class="product-name"><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h3>
        <p class="product-copy"><?php echo esc_html(wp_trim_words(get_the_excerpt(), 18)); ?></p>
        <div class="product-meta">
          <?php if ($label) : ?><span><?php echo esc_html($label); ?></span><?php endif; ?>
          <a class="product-arrow" href="<?php the_permalink(); ?>" aria-label="<?php the_title_attribute(); ?>">&#8594;</a>
        </div>
      </div>
    </article>
    <?php
};
?>
<section id="products" class="ai-section products-category-showcase goodjob-cpt-products">
  <?php echo $generated_style; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
  <div class="products-wrap">
    <div class="products-head">
      <span class="products-kicker">Product Category</span>
      <h2><?php echo esc_html($title); ?></h2>
      <p><?php echo esc_html($intro); ?></p>
    </div>
    <div class="products-tabs" role="tablist">
      <?php foreach ($category_names as $index => $category_name) : ?>
        <button type="button" class="products-tab<?php echo $index === 0 ? ' is-active active' : ''; ?>" data-product-category="<?php echo esc_attr($category_name); ?>"><?php echo esc_html($category_name); ?></button>
      <?php endforeach; ?>
    </div>
    <div class="products-stage">
      <div class="products-pages">
        <?php foreach ($category_names as $index => $category_name) :
          $term = !empty($terms[$index]) ? $terms[$index] : null;
          $query_args = array(
              'post_type' => 'product',
              'post_status' => 'publish',
              'posts_per_page' => 4,
              'orderby' => 'menu_order date',
              'order' => 'DESC',
          );
          if ($term && !empty($term->term_id)) {
              $query_args['tax_query'] = array(array(
                  'taxonomy' => 'product_cat',
                  'field' => 'term_id',
                  'terms' => array((int) $term->term_id),
              ));
          }
          $products = new WP_Query($query_args);
          if (!$products->have_posts() && $index === 0) {
              wp_reset_postdata();
              $products = new WP_Query(array('post_type' => 'product', 'post_status' => 'publish', 'posts_per_page' => 4, 'orderby' => 'menu_order date', 'order' => 'DESC'));
          }
        ?>
          <div class="products-track<?php echo $index === 0 ? ' is-active' : ''; ?>" data-product-category-panel="<?php echo esc_attr($category_name); ?>"<?php echo $index === 0 ? '' : ' hidden'; ?>>
            <div class="products-page">
              <?php if ($products->have_posts()) : ?>
                <?php while ($products->have_posts()) : $products->the_post(); $render_card($category_name); endwhile; wp_reset_postdata(); ?>
              <?php else : ?>
                <p class="products-empty">No products are published for this category yet.</p>
              <?php endif; ?>
            </div>
          </div>
        <?php endforeach; ?>
      </div>
    </div>
    <div class="products-actions goodjob-home-products__actions">
      <a href="<?php echo esc_url($primary_url ?: get_post_type_archive_link('product')); ?>"><?php echo esc_html($primary_label); ?></a>
    </div>
  </div>
</section>