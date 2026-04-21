/// <reference types="node" />
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Admin User ─────────────────────────────────────────────────────────────
  const configuredAdminPassword = String(process.env.SEED_ADMIN_PASSWORD || '').trim();
  if (process.env.NODE_ENV === 'production' && !configuredAdminPassword) {
    throw new Error('SEED_ADMIN_PASSWORD is required when seeding production data.');
  }

  const generatedAdminPassword = configuredAdminPassword || crypto.randomBytes(18).toString('base64url');
  if (!configuredAdminPassword) {
    console.warn(`[seed] SEED_ADMIN_PASSWORD is not set. Generated admin password for this seed run: ${generatedAdminPassword}`);
  }

  const adminPassword = await bcrypt.hash(generatedAdminPassword, 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@nurfia.com' },
    update: {},
    create: {
      email: 'admin@nurfia.com',
      password: adminPassword,
      username: 'admin',
      fullName: 'Admin Nurfia',
      role: 'ADMIN',
    },
  });
  console.log(`✅ Admin user: ${admin.email}`);

  // ─── Product Attributes ────────────────────────────────────────────────────
  const sizeAttr = await prisma.productAttribute.upsert({
    where: { slug: 'size' },
    update: {},
    create: { name: 'Size', slug: 'size' },
  });

  const colorAttr = await prisma.productAttribute.upsert({
    where: { slug: 'color' },
    update: {},
    create: { name: 'Color', slug: 'color' },
  });

  // Size values
  const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const sizeValues: Record<string, number> = {};
  for (let i = 0; i < sizes.length; i++) {
    const sv = await prisma.productAttributeValue.upsert({
      where: { attributeId_value: { attributeId: sizeAttr.id, value: sizes[i] } },
      update: {},
      create: { attributeId: sizeAttr.id, value: sizes[i], sortOrder: i },
    });
    sizeValues[sizes[i]] = sv.id;
  }

  // Color values
  const colors = [
    { value: 'Black', hex: '#000000' },
    { value: 'White', hex: '#FFFFFF' },
    { value: 'Navy', hex: '#1B2A4A' },
    { value: 'Beige', hex: '#D4C5A9' },
    { value: 'Brown', hex: '#8B4513' },
    { value: 'Gray', hex: '#808080' },
    { value: 'Pink', hex: '#FFC0CB' },
    { value: 'Red', hex: '#C41E3A' },
    { value: 'Blue', hex: '#4169E1' },
    { value: 'Green', hex: '#2E8B57' },
    { value: 'Cream', hex: '#FFFDD0' },
    { value: 'Olive', hex: '#6B8E23' },
  ];
  const colorValues: Record<string, number> = {};
  for (let i = 0; i < colors.length; i++) {
    const cv = await prisma.productAttributeValue.upsert({
      where: { attributeId_value: { attributeId: colorAttr.id, value: colors[i].value } },
      update: {},
      create: { attributeId: colorAttr.id, value: colors[i].value, colorHex: colors[i].hex, sortOrder: i },
    });
    colorValues[colors[i].value] = cv.id;
  }
  console.log('✅ Product attributes created');

  // ─── Categories ────────────────────────────────────────────────────────────
  const catData = [
    { name: 'Women', slug: 'women', sortOrder: 1, children: [
      { name: 'Dresses', slug: 'dresses', sortOrder: 1 },
      { name: 'Blazers', slug: 'blazers', sortOrder: 2 },
      { name: 'Blouses', slug: 'blouses', sortOrder: 3 },
      { name: 'Jackets', slug: 'women-jackets', sortOrder: 4 },
      { name: 'T-Shirts', slug: 'women-tshirts', sortOrder: 5 },
      { name: 'Tops', slug: 'tops', sortOrder: 6 },
      { name: 'Pants', slug: 'women-pants', sortOrder: 7 },
      { name: 'Skirts', slug: 'skirts', sortOrder: 8 },
      { name: 'Jeans', slug: 'women-jeans', sortOrder: 9 },
      { name: 'Knit', slug: 'knit', sortOrder: 10 },
      { name: 'Suits', slug: 'suits', sortOrder: 11 },
    ]},
    { name: 'Men', slug: 'men', sortOrder: 2, children: [
      { name: 'Jackets', slug: 'men-jackets', sortOrder: 1 },
      { name: 'T-Shirts', slug: 'men-tshirts', sortOrder: 2 },
      { name: 'Jeans', slug: 'men-jeans', sortOrder: 3 },
      { name: 'Pants', slug: 'men-pants', sortOrder: 4 },
      { name: 'Hoodies', slug: 'hoodies', sortOrder: 5 },
    ]},
    { name: 'Accessories', slug: 'accessories', sortOrder: 3, children: [
      { name: 'Bags', slug: 'bags', sortOrder: 1 },
      { name: 'Jewelry', slug: 'jewelry', sortOrder: 2 },
      { name: 'Hats', slug: 'hats', sortOrder: 3 },
    ]},
  ];

  const categoryMap: Record<string, number> = {};
  for (const parent of catData) {
    const p = await prisma.category.upsert({
      where: { slug: parent.slug },
      update: {},
      create: { name: parent.name, slug: parent.slug, sortOrder: parent.sortOrder },
    });
    categoryMap[parent.slug] = p.id;
    if (parent.children) {
      for (const child of parent.children) {
        const c = await prisma.category.upsert({
          where: { slug: child.slug },
          update: {},
          create: { name: child.name, slug: child.slug, parentId: p.id, sortOrder: child.sortOrder },
        });
        categoryMap[child.slug] = c.id;
      }
    }
  }
  console.log('✅ Categories created');

  // ─── Brands ───────────────────────────────────────────────────────────────
  const requestedBrands = [
    'Calvin Klein',
    'lacoste',
    'Louis Vuitton',
    'Sportempt',
    'Tomy Hilfiger',
    'UCLA',
  ];

  const toSlug = (value: string) => value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

  const brandIdByName: Record<string, number> = {};
  for (let i = 0; i < requestedBrands.length; i++) {
    const brandName = requestedBrands[i];
    const brand = await prisma.brand.upsert({
      where: { slug: toSlug(brandName) },
      update: { name: brandName, isActive: true, sortOrder: i },
      create: {
        name: brandName,
        slug: toSlug(brandName),
        sortOrder: i,
        isActive: true,
      },
    });

    brandIdByName[brandName] = brand.id;
  }

  const brandIdsInOrder = requestedBrands
    .map((name) => brandIdByName[name])
    .filter((id): id is number => Number.isInteger(id) && id > 0);

  console.log('✅ Brands created');

  // ─── Products ──────────────────────────────────────────────────────────────
  const productsData = [
    // Women - Dresses
    { name: 'Floral Midi Wrap Dress', sku: 'NF-WD001', price: 189.00, salePrice: 149.00, category: 'dresses', featured: true, desc: 'Elegant floral midi wrap dress with a flattering silhouette. Perfect for both casual outings and formal occasions.', colors: ['Black', 'Beige'], sizes: ['XS', 'S', 'M', 'L'] },
    { name: 'Satin Slip Dress', sku: 'NF-WD002', price: 159.00, salePrice: null, category: 'dresses', featured: true, desc: 'Luxurious satin slip dress with adjustable straps. A timeless piece for any wardrobe.', colors: ['Black', 'Cream'], sizes: ['S', 'M', 'L'] },
    { name: 'Pleated Maxi Dress', sku: 'NF-WD003', price: 219.00, salePrice: 179.00, category: 'dresses', featured: false, desc: 'Flowing pleated maxi dress with an empire waistline. Elegant movement with every step.', colors: ['Navy', 'Beige'], sizes: ['XS', 'S', 'M', 'L', 'XL'] },
    { name: 'Knit Bodycon Dress', sku: 'NF-WD004', price: 139.00, salePrice: null, category: 'dresses', featured: false, desc: 'Form-fitting knit bodycon dress. Ribbed texture adds visual interest to this minimalist silhouette.', colors: ['Black', 'Gray'], sizes: ['S', 'M', 'L'] },
    { name: 'Linen Shirt Dress', sku: 'NF-WD005', price: 169.00, salePrice: 129.00, category: 'dresses', featured: true, desc: 'Relaxed linen shirt dress with button-down front. Effortless style for warm days.', colors: ['White', 'Beige', 'Olive'], sizes: ['XS', 'S', 'M', 'L', 'XL'] },

    // Women - Blazers
    { name: 'Oversized Double-Breasted Blazer', sku: 'NF-WB001', price: 259.00, salePrice: null, category: 'blazers', featured: true, desc: 'Oversized double-breasted blazer with peak lapels. A powerful statement piece for the modern woman.', colors: ['Black', 'Navy'], sizes: ['XS', 'S', 'M', 'L'] },
    { name: 'Cropped Tweed Blazer', sku: 'NF-WB002', price: 229.00, salePrice: 189.00, category: 'blazers', featured: false, desc: 'Cropped tweed blazer with fringe detail. Chanel-inspired elegance for your everyday wardrobe.', colors: ['Cream', 'Pink'], sizes: ['S', 'M', 'L'] },

    // Women - Blouses
    { name: 'Silk Bow-Tie Blouse', sku: 'NF-WBL01', price: 149.00, salePrice: null, category: 'blouses', featured: true, desc: 'Elegant silk blouse with a statement bow tie at the neckline. Perfect from boardroom to dinner.', colors: ['White', 'Black', 'Pink'], sizes: ['XS', 'S', 'M', 'L'] },
    { name: 'Lace Trim Camisole', sku: 'NF-WBL02', price: 89.00, salePrice: 69.00, category: 'blouses', featured: false, desc: 'Delicate camisole with intricate lace trim. Layer under blazers or wear as a standalone piece.', colors: ['Black', 'White', 'Cream'], sizes: ['S', 'M', 'L'] },

    // Women - Tops
    { name: 'Ribbed Tank Top', sku: 'NF-WT001', price: 59.00, salePrice: null, category: 'tops', featured: false, desc: 'Essential ribbed tank top in premium cotton. The foundation of any capsule wardrobe.', colors: ['Black', 'White', 'Gray', 'Beige'], sizes: ['XS', 'S', 'M', 'L', 'XL'] },
    { name: 'Off-Shoulder Crop Top', sku: 'NF-WT002', price: 79.00, salePrice: 59.00, category: 'tops', featured: true, desc: 'Trendy off-shoulder crop top with balloon sleeves. Perfect for summer evenings.', colors: ['White', 'Black'], sizes: ['S', 'M', 'L'] },

    // Women - Jackets
    { name: 'Leather Biker Jacket', sku: 'NF-WJ001', price: 349.00, salePrice: 289.00, category: 'women-jackets', featured: true, desc: 'Classic leather biker jacket with asymmetric zip. Timeless rebel chic.', colors: ['Black', 'Brown'], sizes: ['XS', 'S', 'M', 'L'] },
    { name: 'Quilted Puffer Jacket', sku: 'NF-WJ002', price: 199.00, salePrice: null, category: 'women-jackets', featured: false, desc: 'Lightweight quilted puffer jacket. Warmth without bulk for transitional seasons.', colors: ['Black', 'Cream', 'Olive'], sizes: ['S', 'M', 'L', 'XL'] },

    // Women - T-Shirts
    { name: 'Oversized Graphic Tee', sku: 'NF-WTS01', price: 69.00, salePrice: null, category: 'women-tshirts', featured: false, desc: 'Relaxed fit graphic t-shirt with artistic print. 100% organic cotton.', colors: ['White', 'Black'], sizes: ['S', 'M', 'L', 'XL'] },

    // Women - Pants
    { name: 'Wide-Leg Tailored Trousers', sku: 'NF-WP001', price: 169.00, salePrice: 139.00, category: 'women-pants', featured: true, desc: 'High-waisted wide-leg trousers with pressed creases. Effortlessly sophisticated.', colors: ['Black', 'Navy', 'Beige'], sizes: ['XS', 'S', 'M', 'L'] },
    { name: 'Cargo Pants', sku: 'NF-WP002', price: 129.00, salePrice: null, category: 'women-pants', featured: false, desc: 'Utility-inspired cargo pants with multiple pockets. Street-ready style.', colors: ['Olive', 'Black', 'Beige'], sizes: ['S', 'M', 'L'] },

    // Women - Skirts
    { name: 'Pleated Midi Skirt', sku: 'NF-WS001', price: 129.00, salePrice: null, category: 'skirts', featured: true, desc: 'Flowing pleated midi skirt with satin finish. Moves beautifully with every step.', colors: ['Black', 'Navy', 'Cream'], sizes: ['XS', 'S', 'M', 'L'] },
    { name: 'Leather Mini Skirt', sku: 'NF-WS002', price: 149.00, salePrice: 119.00, category: 'skirts', featured: false, desc: 'Edgy leather mini skirt with front zip detail. A wardrobe essential for night-outs.', colors: ['Black', 'Brown'], sizes: ['S', 'M', 'L'] },

    // Women - Jeans
    { name: 'High-Rise Straight Jeans', sku: 'NF-WJ101', price: 129.00, salePrice: null, category: 'women-jeans', featured: true, desc: 'Classic high-rise straight-leg jeans in premium denim. The perfect everyday jean.', colors: ['Blue', 'Black'], sizes: ['XS', 'S', 'M', 'L', 'XL'] },
    { name: 'Mom Jeans', sku: 'NF-WJ102', price: 119.00, salePrice: 99.00, category: 'women-jeans', featured: false, desc: 'Relaxed fit mom jeans with vintage wash. Comfortable and trendy.', colors: ['Blue', 'Black'], sizes: ['S', 'M', 'L'] },

    // Women - Knit
    { name: 'Cashmere V-Neck Sweater', sku: 'NF-WK001', price: 249.00, salePrice: null, category: 'knit', featured: true, desc: 'Luxuriously soft cashmere V-neck sweater. The ultimate cozy investment piece.', colors: ['Cream', 'Gray', 'Black'], sizes: ['XS', 'S', 'M', 'L'] },
    { name: 'Cable Knit Cardigan', sku: 'NF-WK002', price: 179.00, salePrice: 149.00, category: 'knit', featured: false, desc: 'Chunky cable knit cardigan with oversized buttons. Cozy meets chic.', colors: ['Cream', 'Brown'], sizes: ['S', 'M', 'L', 'XL'] },

    // Women - Suits
    { name: 'Power Suit Set', sku: 'NF-WSU01', price: 389.00, salePrice: 329.00, category: 'suits', featured: true, desc: 'Two-piece power suit with single-button blazer and matching trousers. Command the room.', colors: ['Black', 'Navy'], sizes: ['XS', 'S', 'M', 'L'] },

    // Men - Jackets
    { name: 'Wool Overcoat', sku: 'NF-MJ001', price: 399.00, salePrice: 339.00, category: 'men-jackets', featured: true, desc: 'Premium wool overcoat with notch lapels. A winter essential that elevates any outfit.', colors: ['Black', 'Navy', 'Gray'], sizes: ['S', 'M', 'L', 'XL'] },
    { name: 'Bomber Jacket', sku: 'NF-MJ002', price: 199.00, salePrice: null, category: 'men-jackets', featured: true, desc: 'Classic bomber jacket in nylon with rib-knit cuffs. Versatile for any casual occasion.', colors: ['Black', 'Navy', 'Olive'], sizes: ['S', 'M', 'L', 'XL'] },
    { name: 'Denim Trucker Jacket', sku: 'NF-MJ003', price: 169.00, salePrice: 139.00, category: 'men-jackets', featured: false, desc: 'Timeless denim trucker jacket with chest pockets. Gets better with age.', colors: ['Blue', 'Black'], sizes: ['S', 'M', 'L', 'XL'] },

    // Men - T-Shirts
    { name: 'Essential Crew Neck Tee', sku: 'NF-MT001', price: 49.00, salePrice: null, category: 'men-tshirts', featured: false, desc: 'Premium cotton crew neck t-shirt. The perfect fit for everyday wear.', colors: ['Black', 'White', 'Navy', 'Gray'], sizes: ['S', 'M', 'L', 'XL', 'XXL'] },
    { name: 'Striped Polo Shirt', sku: 'NF-MT002', price: 79.00, salePrice: 59.00, category: 'men-tshirts', featured: true, desc: 'Classic striped polo with contrast collar. Smart-casual perfection.', colors: ['Navy', 'White', 'Black'], sizes: ['S', 'M', 'L', 'XL'] },
    { name: 'Long Sleeve Henley', sku: 'NF-MT003', price: 69.00, salePrice: null, category: 'men-tshirts', featured: false, desc: 'Relaxed long-sleeve henley in waffle knit. Laid-back cool.', colors: ['White', 'Gray', 'Black'], sizes: ['S', 'M', 'L', 'XL'] },

    // Men - Jeans
    { name: 'Slim Fit Dark Wash Jeans', sku: 'NF-MJN01', price: 139.00, salePrice: null, category: 'men-jeans', featured: true, desc: 'Slim fit jeans in premium dark wash denim. A sharp, clean look for any occasion.', colors: ['Blue', 'Black'], sizes: ['S', 'M', 'L', 'XL'] },
    { name: 'Relaxed Fit Vintage Jeans', sku: 'NF-MJN02', price: 119.00, salePrice: 99.00, category: 'men-jeans', featured: false, desc: 'Relaxed fit jeans with vintage distressing. Effortless weekend style.', colors: ['Blue'], sizes: ['M', 'L', 'XL'] },

    // Men - Pants
    { name: 'Chino Pants', sku: 'NF-MP001', price: 109.00, salePrice: null, category: 'men-pants', featured: false, desc: 'Tapered chino pants in stretch cotton twill. Smart enough for the office, relaxed enough for the weekend.', colors: ['Beige', 'Navy', 'Black', 'Olive'], sizes: ['S', 'M', 'L', 'XL'] },
    { name: 'Linen Drawstring Pants', sku: 'NF-MP002', price: 99.00, salePrice: 79.00, category: 'men-pants', featured: false, desc: 'Lightweight linen pants with drawstring waist. Summer comfort at its finest.', colors: ['White', 'Beige', 'Navy'], sizes: ['S', 'M', 'L', 'XL'] },

    // Men - Hoodies
    { name: 'Heavyweight Pullover Hoodie', sku: 'NF-MH001', price: 119.00, salePrice: null, category: 'hoodies', featured: true, desc: 'Premium heavyweight hoodie in brushed fleece. Superior warmth and comfort.', colors: ['Black', 'Gray', 'Navy'], sizes: ['S', 'M', 'L', 'XL', 'XXL'] },
    { name: 'Zip-Up Track Hoodie', sku: 'NF-MH002', price: 99.00, salePrice: 79.00, category: 'hoodies', featured: false, desc: 'Sporty zip-up hoodie with contrast piping. Athleisure meets street style.', colors: ['Black', 'Navy'], sizes: ['S', 'M', 'L', 'XL'] },

    // Accessories - Bags
    { name: 'Leather Tote Bag', sku: 'NF-AB001', price: 279.00, salePrice: 229.00, category: 'bags', featured: true, desc: 'Spacious leather tote bag with interior pockets. The perfect carry-all for work and play.', colors: ['Black', 'Brown', 'Beige'], sizes: [] },
    { name: 'Crossbody Mini Bag', sku: 'NF-AB002', price: 149.00, salePrice: null, category: 'bags', featured: true, desc: 'Compact crossbody bag with chain strap. All the essentials, hands-free.', colors: ['Black', 'Cream'], sizes: [] },

    // Accessories - Jewelry
    { name: 'Gold Chain Necklace', sku: 'NF-AJ001', price: 89.00, salePrice: null, category: 'jewelry', featured: false, desc: 'Delicate gold-plated chain necklace. A subtle touch of luxury.', colors: [], sizes: [] },
    { name: 'Pearl Drop Earrings', sku: 'NF-AJ002', price: 69.00, salePrice: 49.00, category: 'jewelry', featured: false, desc: 'Elegant pearl drop earrings with gold-plated hooks. Classic feminine beauty.', colors: [], sizes: [] },

    // Accessories - Hats
    { name: 'Wool Fedora Hat', sku: 'NF-AH001', price: 79.00, salePrice: null, category: 'hats', featured: false, desc: 'Classic wool fedora hat with grosgrain ribbon. Top off any outfit with effortless style.', colors: ['Black', 'Beige'], sizes: [] },
    { name: 'Canvas Bucket Hat', sku: 'NF-AH002', price: 49.00, salePrice: 39.00, category: 'hats', featured: false, desc: 'Casual canvas bucket hat for sun protection with style. Beach-ready.', colors: ['Black', 'Cream', 'Olive'], sizes: [] },
  ];

  let productCount = 0;
  for (const [productIndex, p] of productsData.entries()) {
    const existing = await prisma.product.findUnique({ where: { sku: p.sku } });
    if (existing) continue;

    const selectedBrandId = brandIdsInOrder.length > 0
      ? brandIdsInOrder[productIndex % brandIdsInOrder.length]
      : null;

    const product = await prisma.product.create({
      data: {
        name: p.name,
        slug: p.sku.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        sku: p.sku,
        shortDescription: p.desc.substring(0, 100),
        description: `<p>${p.desc}</p><p>Crafted with premium materials for lasting comfort and style. Machine washable. Imported.</p>`,
        price: p.price,
        salePrice: p.salePrice,
        stock: Math.floor(Math.random() * 80) + 20,
        categoryId: categoryMap[p.category],
        brandId: selectedBrandId,
        isFeatured: p.featured,
        salesCount: Math.floor(Math.random() * 200),
        viewCount: Math.floor(Math.random() * 1000),
      },
    });

    // Create product images (placeholder — will be replaced with actual downloaded images)
    const imageColors = p.colors.length > 0 ? p.colors : ['default'];
    for (let i = 0; i < Math.min(imageColors.length, 3); i++) {
      await prisma.productImage.create({
        data: {
          productId: product.id,
          url: `/uploads/products/${p.sku.toLowerCase()}-${i + 1}.jpg`,
          alt: `${p.name} - ${imageColors[i]}`,
          sortOrder: i,
          isPrimary: i === 0,
        },
      });
    }

    // Create variants
    if (p.sizes.length > 0 && p.colors.length > 0) {
      for (const color of p.colors) {
        for (const size of p.sizes) {
          const variantSku = `${p.sku}-${color.substring(0, 3).toUpperCase()}-${size}`;
          const variant = await prisma.productVariant.create({
            data: {
              productId: product.id,
              sku: variantSku,
              price: p.price,
              salePrice: p.salePrice,
              stock: Math.floor(Math.random() * 15) + 3,
            },
          });
          // Link color attribute
          if (colorValues[color]) {
            await prisma.productVariantAttribute.create({
              data: { variantId: variant.id, attributeValueId: colorValues[color] },
            });
          }
          // Link size attribute
          if (sizeValues[size]) {
            await prisma.productVariantAttribute.create({
              data: { variantId: variant.id, attributeValueId: sizeValues[size] },
            });
          }
        }
      }
    } else if (p.colors.length > 0) {
      // Accessories with colors but no sizes
      for (const color of p.colors) {
        const variantSku = `${p.sku}-${color.substring(0, 3).toUpperCase()}`;
        const variant = await prisma.productVariant.create({
          data: {
            productId: product.id,
            sku: variantSku,
            price: p.price,
            salePrice: p.salePrice,
            stock: Math.floor(Math.random() * 20) + 5,
          },
        });
        if (colorValues[color]) {
          await prisma.productVariantAttribute.create({
            data: { variantId: variant.id, attributeValueId: colorValues[color] },
          });
        }
      }
    }

    productCount++;
  }
  console.log(`✅ ${productCount} products created with variants`);

  // Backfill brand assignment for products created before brands existed.
  if (brandIdsInOrder.length > 0) {
    const productsWithoutBrand = await prisma.product.findMany({
      where: { brandId: null },
      orderBy: { id: 'asc' },
      select: { id: true },
    });

    for (let i = 0; i < productsWithoutBrand.length; i++) {
      const nextBrandId = brandIdsInOrder[i % brandIdsInOrder.length];
      await prisma.product.update({
        where: { id: productsWithoutBrand[i].id },
        data: { brandId: nextBrandId },
      });
    }

    if (productsWithoutBrand.length > 0) {
      console.log(`✅ Backfilled brand for ${productsWithoutBrand.length} existing products`);
    }
  }

  // ─── Banners ───────────────────────────────────────────────────────────────
  await prisma.banner.createMany({
    data: [
      {
        title: 'SUMMER COLLECTION',
        subtitle: 'Discover The Latest Trends',
        imageUrl: '/uploads/banners/hero-1.jpg',
        buttonText: 'VIEW COLLECTION',
        linkUrl: '/category/women',
        position: 'homepage',
        sortOrder: 0,
      },
      {
        title: 'NEW ARRIVALS',
        subtitle: 'Effortless Style For Every Occasion',
        imageUrl: '/uploads/banners/hero-2.jpg',
        buttonText: 'SHOP NOW',
        linkUrl: '/category/men',
        position: 'homepage',
        sortOrder: 1,
      },
    ],
    skipDuplicates: true,
  });
  console.log('✅ Banners created');

  // ─── Shipping Methods ─────────────────────────────────────────────────────
  const standardShipping = await prisma.shippingMethod.create({
    data: {
      name: 'Standard Shipping',
      description: 'Delivered within 5-7 business days',
    },
  });
  await prisma.shippingZone.create({
    data: {
      shippingMethodId: standardShipping.id,
      zoneName: 'Nationwide',
      cost: 15.00,
      freeShipMinOrder: 500.00,
    },
  });

  const expressShipping = await prisma.shippingMethod.create({
    data: {
      name: 'Express Shipping',
      description: 'Delivered within 1-3 business days',
    },
  });
  await prisma.shippingZone.create({
    data: {
      shippingMethodId: expressShipping.id,
      zoneName: 'Nationwide',
      cost: 30.00,
      freeShipMinOrder: 800.00,
    },
  });
  console.log('✅ Shipping methods created');

  // ─── Coupons ───────────────────────────────────────────────────────────────
  await prisma.coupon.createMany({
    data: [
      {
        code: 'WELCOME10',
        type: 'PERCENTAGE',
        value: 10,
        minOrderValue: 100,
        maxDiscount: 50,
        usageLimit: 1000,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      },
      {
        code: 'SUMMER20',
        type: 'PERCENTAGE',
        value: 20,
        minOrderValue: 200,
        maxDiscount: 100,
        usageLimit: 500,
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-08-31'),
      },
      {
        code: 'FREESHIP',
        type: 'FIXED_AMOUNT',
        value: 15,
        minOrderValue: 150,
        usageLimit: 2000,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      },
    ],
    skipDuplicates: true,
  });
  console.log('✅ Coupons created');

  // ─── Blog Posts ────────────────────────────────────────────────────────────
  await prisma.blogPost.createMany({
    data: [
      {
        title: 'The Ultimate Guide to Summer Fashion 2026',
        slug: 'ultimate-guide-summer-fashion-2026',
        excerpt: 'Discover the hottest trends and must-have pieces for the summer season.',
        content: '<p>Summer 2026 brings a fresh wave of fashion trends that blend comfort with high style. From flowing linen dresses to bold statement accessories, this season is all about expressing your personal style with confidence.</p>',
        image: '/uploads/blog/blog-1.jpg',
        author: 'Nurfia Editorial',
        category: 'Fashion',
      },
      {
        title: 'How to Build a Capsule Wardrobe',
        slug: 'how-to-build-capsule-wardrobe',
        excerpt: 'Simplify your style with these expert tips on creating a versatile capsule wardrobe.',
        content: '<p>A capsule wardrobe is a curated collection of essential items that dont go out of style. Learn how to select the right pieces that maximize your outfit combinations while minimizing clutter.</p>',
        image: '/uploads/blog/blog-2.jpg',
        author: 'Nurfia Editorial',
        category: 'Style Tips',
      },
      {
        title: 'Sustainable Fashion: Making Conscious Choices',
        slug: 'sustainable-fashion-conscious-choices',
        excerpt: 'Learn how to make environmentally-friendly fashion choices without compromising on style.',
        content: '<p>Sustainable fashion is more than a trend—its a movement. Discover how to shop responsibly, care for your clothes, and invest in pieces that are both beautiful and kind to the planet.</p>',
        image: '/uploads/blog/blog-3.jpg',
        author: 'Nurfia Editorial',
        category: 'Sustainability',
      },
      {
        title: 'Street Style Inspiration from Fashion Week',
        slug: 'street-style-inspiration-fashion-week',
        excerpt: 'The best street style looks spotted outside the major fashion week venues.',
        content: '<p>Fashion Week isnt just about the runway—its about what happens outside the shows. Check out the most inspiring street style looks that are setting trends for the coming season.</p>',
        image: '/uploads/blog/blog-4.jpg',
        author: 'Nurfia Editorial',
        category: 'Fashion',
      },
    ],
    skipDuplicates: true,
  });
  console.log('✅ Blog posts created');

  // ─── Site Settings ─────────────────────────────────────────────────────────
  const settings = [
    { key: 'site_name', value: 'Nurfia', group: 'general' },
    { key: 'site_tagline', value: 'Fashion eCommerce', group: 'general' },
    { key: 'site_description', value: 'Premium fashion for women and men', group: 'seo' },
    { key: 'contact_email', value: 'contact@nurfia.com', group: 'contact' },
    { key: 'contact_phone', value: '+1 234 567 890', group: 'contact' },
    { key: 'contact_address', value: '123 Fashion Street, New York, NY 10001', group: 'contact' },
    { key: 'social_facebook', value: 'https://facebook.com/nurfia', group: 'social' },
    { key: 'social_instagram', value: 'https://instagram.com/nurfia', group: 'social' },
    { key: 'social_twitter', value: 'https://twitter.com/nurfia', group: 'social' },
    { key: 'social_pinterest', value: 'https://pinterest.com/nurfia', group: 'social' },
    { key: 'currency', value: 'USD', group: 'general' },
    { key: 'currency_symbol', value: '$', group: 'general' },
  ];

  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: s,
    });
  }
  console.log('✅ Settings created');

  console.log('\n🎉 Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
