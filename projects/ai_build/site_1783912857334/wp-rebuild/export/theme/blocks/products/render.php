<?php
if (!defined('ABSPATH')) {
    exit;
}

$generated_style = <<<'GOODJOB_PRODUCTS_STYLE'
<style>#products{background:#091B39;color:#fff;padding:clamp(44px,6vw,72px) 20px;position:relative}#products .products-wrap{max-width:1280px;margin:0 auto}#products .products-head{text-align:center;margin:0 auto 22px;max-width:820px}#products .products-kicker{display:inline-block;padding:6px 10px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#F4F6FA;font-size:12px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:12px}#products h2{margin:0 0 10px;font-size:clamp(28px,4vw,42px);line-height:1.15;color:#fff}#products .products-head p{margin:0;color:#D7E0EE;font-size:15px;line-height:1.7}#products .products-tabs{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:26px 0 28px}#products .products-tab{border:1px solid rgba(255,255,255,.16);background:#143A7B;color:#fff;padding:11px 16px;font:inherit;font-size:14px;letter-spacing:.01em;cursor:pointer;transition:transform .2s ease,background .2s ease,border-color .2s ease}#products .products-tab.active{background:#C8161C;border-color:#C8161C;box-shadow:inset 0 -2px 0 rgba(255,255,255,.18)}#products .products-stage{position:relative;background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.1);padding:22px;border-radius:0}#products input[type=radio]{position:absolute;opacity:0;pointer-events:none}#products .products-pages{overflow:hidden}#products .products-track{display:flex;transition:transform .35s ease}#products .products-page{min-width:100%;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}#products .product-card{background:#F4F6FA;border:1px solid #E2E7EE;color:#16202E;text-decoration:none;display:flex;flex-direction:column;min-height:100%;transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease}#products .product-card:hover{transform:translateY(-3px);box-shadow:0 12px 28px rgba(6,19,41,.14);border-color:#C7D2E2}#products .product-media{aspect-ratio:1/1;background:#EAEEF4;overflow:hidden;border-bottom:1px solid #E2E7EE}#products .product-media img{width:100%;height:100%;object-fit:cover;display:block}#products .product-body{padding:16px 16px 18px;display:flex;flex-direction:column;gap:10px;flex:1}#products .product-name{margin:0;font-size:15px;font-weight:700;line-height:1.45;letter-spacing:.08em;text-transform:uppercase;color:#091B39}#products .product-copy{margin:0;color:#3C4858;font-size:13px;line-height:1.65}#products .product-meta{margin-top:auto;display:flex;align-items:center;justify-content:space-between;color:#6B7686;font-size:12px;text-transform:uppercase;letter-spacing:.08em}#products .product-arrow{width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;background:#143A7B;color:#fff;text-decoration:none;border:1px solid #143A7B;transition:background .2s ease,transform .2s ease}#products .product-arrow:hover{background:#C8161C;transform:translateX(2px)}#products .nav-arrow{position:absolute;top:50%;transform:translateY(-50%);width:42px;height:42px;border:1px solid rgba(255,255,255,.18);background:#143A7B;color:#fff;display:none;align-items:center;justify-content:center;cursor:pointer;transition:background .2s ease,border-color .2s ease}#products .nav-arrow:hover{background:#C8161C;border-color:#C8161C}#products .nav-prev{left:-8px}#products .nav-next{right:-8px}#products #products-page-1:checked~.products-stage .products-track{transform:translateX(0)}#products #products-page-2:checked~.products-stage .products-track{transform:translateX(-100%)}#products #products-page-1:checked~.products-stage .for-page-1,#products #products-page-2:checked~.products-stage .for-page-2{display:flex}#products .products-tab:focus-visible,#products .nav-arrow:focus-visible,#products .product-arrow:focus-visible{outline:2px solid #fff;outline-offset:2px}#products .product-card::after{content:"";display:block;height:3px;background:linear-gradient(90deg,#143A7B,#C8161C);opacity:.9}#products .stage-note{display:none}#products .active-category{display:inline-block;margin:0 0 14px;padding:7px 12px;background:#061329;border:1px solid rgba(255,255,255,.12);color:#F4F6FA;font-size:12px;letter-spacing:.12em;text-transform:uppercase}#products .products-stage-head{display:flex;justify-content:flex-start;align-items:center}#products .products-tab:not(.active):hover{background:#35568D}#products .product-card:hover .product-name{color:#143A7B}@media(max-width:760px){#products{padding:40px 16px}#products .products-page{grid-template-columns:1fr}#products .products-stage{padding:16px}#products .nav-arrow{display:none!important}#products .products-tabs{justify-content:flex-start}}</style>
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
$intro = function_exists('get_field') ? (get_field('intro') ?: "Explore export-ready industrial parts across core manufacturing families, with practical fit, stable quality, and direct inquiry access for sourcing teams.") : "Explore export-ready industrial parts across core manufacturing families, with practical fit, stable quality, and direct inquiry access for sourcing teams.";
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