<?php
if (!defined('ABSPATH')) {
    exit;
}

$html_source = function_exists('get_field') ? get_field('html_source') : '';
if (is_string($html_source) && trim($html_source) !== '') {
    echo $html_source; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    return;
}

$title = function_exists('get_field') ? (get_field('title') ?: "Product Category") : "Product Category";
$intro = function_exists('get_field') ? (get_field('intro') ?: "Explore SENZ centrifuge ranges built for pilot batches, continuous production, and high-volume separation with practical capacity, stable operation, and direct inquiry entry points.") : "Explore SENZ centrifuge ranges built for pilot batches, continuous production, and high-volume separation with practical capacity, stable operation, and direct inquiry entry points.";
$primary_label = function_exists('get_field') ? (get_field('primary_label') ?: 'View All Products') : 'View All Products';
$primary_url = function_exists('get_field') ? (get_field('primary_url') ?: get_post_type_archive_link('product')) : get_post_type_archive_link('product');
$terms = get_terms(array('taxonomy' => 'product_cat', 'hide_empty' => false, 'number' => 8));
if (is_wp_error($terms) || !is_array($terms)) {
    $terms = array();
}
$products = new WP_Query(array(
    'post_type' => 'product',
    'post_status' => 'publish',
    'posts_per_page' => 8,
    'orderby' => 'menu_order date',
    'order' => 'DESC',
));
?>
<section id="products" class="ai-section goodjob-home-products goodjob-cpt-products">
  <style>
  #products.goodjob-home-products{background:#f5f7fb;padding:clamp(58px,7vw,96px) clamp(18px,4vw,54px);color:#101828}
  #products .goodjob-home-products__wrap{width:min(1440px,100%);margin:auto}
  #products .goodjob-home-products__head{text-align:center;margin:0 auto 26px;max-width:860px}
  #products .goodjob-home-products__head span{display:inline-flex;margin-bottom:10px;color:var(--blue,#244aa5);font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
  #products .goodjob-home-products__head h2{margin:0 0 12px;font-size:clamp(32px,4vw,52px);line-height:1.06;color:#101828}
  #products .goodjob-home-products__head p{margin:0;color:#667085;font-size:clamp(15px,1.2vw,18px);line-height:1.72}
  #products .goodjob-home-products__terms{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin:0 0 30px}
  #products .goodjob-home-products__terms a{display:inline-flex;align-items:center;min-height:40px;padding:0 16px;background:#fff;border:1px solid #d9e1ec;color:#101828;text-decoration:none;font-weight:800}
  #products .goodjob-home-products__terms a:hover{background:var(--blue,#244aa5);border-color:var(--blue,#244aa5);color:#fff}
  #products .goodjob-home-products__grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px}
  #products .goodjob-home-product{background:#fff;border:1px solid #d9e1ec;min-width:0;text-align:center;transition:transform .22s ease,box-shadow .22s ease}
  #products .goodjob-home-product:hover{transform:translateY(-3px);box-shadow:0 18px 34px rgba(16,32,60,.12)}
  #products .goodjob-home-product__media{position:relative;display:block;aspect-ratio:1/1;background:#f7f8fb;overflow:hidden}
  #products .goodjob-home-product__media img{width:100%;height:100%;object-fit:contain;display:block;transition:transform .32s ease}
  #products .goodjob-home-product:hover img{transform:scale(1.035)}
  #products .goodjob-home-product__arrow{position:absolute;right:18px;top:24%;width:56px;height:56px;border-radius:50%;background:var(--blue,#244aa5);color:#fff;display:grid;place-items:center;font-size:30px;box-shadow:0 0 0 7px rgba(255,255,255,.86);opacity:0;transform:translateX(10px);transition:.22s ease}
  #products .goodjob-home-product:hover .goodjob-home-product__arrow{opacity:1;transform:none}
  #products .goodjob-home-product h3{margin:0;min-height:78px;padding:16px 16px 18px;display:grid;place-items:center;font-size:18px;line-height:1.18;font-weight:700}
  #products .goodjob-home-product h3 a{color:#101828;text-decoration:none}
  #products .goodjob-home-products__actions{display:flex;justify-content:center;margin-top:30px}
  #products .goodjob-home-products__actions a{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 20px;background:var(--blue,#244aa5);color:#fff;text-decoration:none;font-weight:900}
  #products .goodjob-home-products__empty{padding:24px;background:#fff;border:1px dashed #cbd5e1;color:#667085;text-align:center}
  @media(max-width:1100px){#products .goodjob-home-products__grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  @media(max-width:640px){#products.goodjob-home-products{padding:42px 16px}#products .goodjob-home-products__grid{grid-template-columns:1fr}#products .goodjob-home-product__arrow{opacity:1;transform:none;width:48px;height:48px;font-size:26px}}
  </style>
  <div class="goodjob-home-products__wrap">
    <div class="goodjob-home-products__head">
      <span>Product Category</span>
      <h2><?php echo esc_html($title); ?></h2>
      <p><?php echo esc_html($intro); ?></p>
    </div>
    <?php if (!empty($terms)) : ?>
      <nav class="goodjob-home-products__terms" aria-label="Product categories">
        <?php foreach ($terms as $term) :
          $term_link = get_term_link($term);
          if (is_wp_error($term_link)) {
              continue;
          }
        ?>
          <a href="<?php echo esc_url($term_link); ?>"><?php echo esc_html($term->name); ?></a>
        <?php endforeach; ?>
      </nav>
    <?php endif; ?>
    <?php if ($products->have_posts()) : ?>
      <div class="goodjob-home-products__grid">
        <?php while ($products->have_posts()) : $products->the_post();
          $image_url = get_the_post_thumbnail_url(get_the_ID(), 'large');
          if (!$image_url) {
              $image_url = (string) get_post_meta(get_the_ID(), 'goodjob_image', true);
          }
          if (!$image_url) {
              $image_url = 'https://placehold.co/640x520/f4f7fb/244aa5?text=' . rawurlencode(get_the_title());
          }
        ?>
          <article class="goodjob-home-product">
            <a class="goodjob-home-product__media" href="<?php the_permalink(); ?>">
              <img src="<?php echo esc_url($image_url); ?>" alt="<?php the_title_attribute(); ?>" loading="lazy" decoding="async">
              <span class="goodjob-home-product__arrow" aria-hidden="true">&#8594;</span>
            </a>
            <h3><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h3>
          </article>
        <?php endwhile; wp_reset_postdata(); ?>
      </div>
    <?php else : ?>
      <p class="goodjob-home-products__empty">No products are published yet. Add Products in the WordPress admin panel.</p>
    <?php endif; ?>
    <div class="goodjob-home-products__actions">
      <a href="<?php echo esc_url($primary_url ?: get_post_type_archive_link('product')); ?>"><?php echo esc_html($primary_label); ?></a>
    </div>
  </div>
</section>