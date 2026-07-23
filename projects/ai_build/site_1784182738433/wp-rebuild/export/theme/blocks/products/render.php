<?php
if (!defined('ABSPATH')) {
    exit;
}

$generated_style = <<<'GOODJOB_PRODUCTS_STYLE'
<style>#products{position:relative;padding:72px 20px;background:linear-gradient(180deg,#0c214e 0%,#15357b 38%,#f8fafc 100%);font-family:Arial,sans-serif;color:#16202e}#products *{box-sizing:border-box}#products .products-wrap{max-width:1320px;margin:0 auto;position:relative}#products .products-head{text-align:center;max-width:760px;margin:0 auto 24px}#products h2{margin:0 0 12px;color:#fff;font-size:clamp(30px,4vw,46px);letter-spacing:.06em;text-transform:uppercase}#products .products-head p{margin:0;color:#dbe7ff;font-size:15px;line-height:1.7}#products .products-tabs{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;margin:0 0 30px}#products .products-tab{border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.08);color:#fff;padding:12px 18px;border-radius:999px;text-transform:uppercase;letter-spacing:.05em;font-size:13px;cursor:pointer;transition:background .25s ease,border-color .25s ease,transform .25s ease}#products .products-tab.is-active{background:#2563eb;border-color:#0ea5e9}#products .products-tab:hover{transform:translateY(-2px);background:rgba(255,255,255,.14)}#products .products-stage{position:relative;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);padding:24px;border-radius:22px;backdrop-filter:blur(4px)}#products .products-page{display:none;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px}#products #products-page-1:checked~.products-wrap .page-1{display:grid}#products #products-page-2:checked~.products-wrap .page-2{display:grid}#products .product-card{display:flex;flex-direction:column;min-height:100%;background:#fff;border:1px solid #e2e7ee;border-radius:18px;overflow:hidden;box-shadow:0 14px 34px rgba(12,33,78,.08);transition:transform .25s ease,box-shadow .25s ease}#products .product-card:hover{transform:translateY(-4px);box-shadow:0 18px 38px rgba(12,33,78,.12)}#products .product-media{aspect-ratio:1/1;background:#eaeef4;overflow:hidden}#products .product-media img{width:100%;height:100%;display:block;object-fit:cover}#products .product-body{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;padding:18px 18px 16px}#products .product-name{margin:0;color:#16202e;font-size:15px;line-height:1.45;font-weight:700;letter-spacing:.08em;text-transform:uppercase}#products .product-link{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:999px;background:#0c214e;color:#fff;text-decoration:none;font-size:18px;flex:0 0 auto;transition:background .25s ease,transform .25s ease}#products .product-link:hover{background:#2563eb;transform:translateX(2px)}#products .products-nav{display:flex;justify-content:space-between;align-items:center;margin-top:18px}#products .nav-arrow{display:inline-flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:999px;background:#fff;color:#112e6c;border:1px solid #d8e2f0;cursor:pointer;box-shadow:0 10px 24px rgba(12,33,78,.08);transition:transform .25s ease,background .25s ease,color .25s ease}#products .nav-arrow:hover{transform:translateY(-2px);background:#2563eb;color:#fff}#products input[type=radio]{position:absolute;opacity:0;pointer-events:none}#products .page-2 .nav-prev-2,#products .page-1 .nav-next-1{visibility:visible}#products .products-note{color:#6b7686;font-size:12px;letter-spacing:.04em;text-transform:uppercase}#products .products-stage:before{content:"";display:block;position:absolute;inset:0;pointer-events:none;border-radius:22px;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:22px 22px;opacity:.28}#products .products-stage>*{position:relative;z-index:1}@media(max-width:760px){#products{padding:56px 16px}#products .products-stage{padding:16px}#products .products-page{grid-template-columns:1fr;gap:16px}#products .products-nav{display:none}#products .products-head p{font-size:14px}}</style>
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
$intro = function_exists('get_field') ? (get_field('intro') ?: "Explore deployment-ready cloud server options across Ubuntu, centOS, and Windows with practical configurations, stable performance, and direct inquiry access for faster procurement.") : "Explore deployment-ready cloud server options across Ubuntu, centOS, and Windows with practical configurations, stable performance, and direct inquiry access for faster procurement.";
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