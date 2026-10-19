/**
 * Seed product data + landing page registry for LadiPage integration.
 * Run: node scripts/seed-products.mjs
 *
 * Each LandingPage record maps a unique api_key to a Product.
 * All LadiPage pages share a single webhook URL:
 *   POST https://your-domain/api/webhook/ladipage?api_key=<api_key>
 */
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

/**
 * Generate a random api_key (URL-safe, 32 chars)
 */
function generateApiKey() {
  return crypto.randomBytes(24).toString('base64url');
}

async function main() {
  console.log('🌱 Seeding products + landing pages...\n');

  // ── Product 1 (Blue form) ──────────────────────────────────────────
  // No sizes, 3 package options
  const product1 = await prisma.product.upsert({
    where: { slug: 'product-1' },
    update: {},
    create: {
      name: 'Sản phẩm 1 (Trang xanh)',
      slug: 'product-1',
      xml_id: null, // Will be filled when partner sends xmlId
      has_sizes: false,
      active: true,
      variants: {
        create: [
          {
            label: '1 quti xarid qiling + 1 quti sovga – 299.000 UZS',
            quantity: 1,
            price: 299,        // 299,000 UZS → 299
            delivery_fee: 50,  // 50,000 UZS
            size: null,
          },
          {
            label: '2 quti xarid qiling + 2 quti sovga – 549.000 UZS',
            quantity: 2,
            price: 549,
            delivery_fee: 0,   // Bepul yetkazib berish
            size: null,
          },
          {
            label: '3 quti xarid qiling + 3 quti sovga – 749.000 UZS',
            quantity: 3,
            price: 749,
            delivery_fee: 0,
            size: null,
          },
        ],
      },
    },
  });

  console.log(`✅ Product 1: "${product1.name}" (slug: ${product1.slug})`);

  // ── Product 2 (White form) ─────────────────────────────────────────
  // Has sizes (S/M/L/XL/XXL), 2 package options
  const product2 = await prisma.product.upsert({
    where: { slug: 'product-2' },
    update: {},
    create: {
      name: 'Sản phẩm 2 (Trang trắng)',
      slug: 'product-2',
      xml_id: null,
      has_sizes: true,
      active: true,
      variants: {
        create: [
          // Package 1 × each size
          { label: '1 dona xarid qiling, 1 dona bepul oling – 299.000 UZS', quantity: 1, price: 299, delivery_fee: 50, size: 'S' },
          { label: '1 dona xarid qiling, 1 dona bepul oling – 299.000 UZS', quantity: 1, price: 299, delivery_fee: 50, size: 'M' },
          { label: '1 dona xarid qiling, 1 dona bepul oling – 299.000 UZS', quantity: 1, price: 299, delivery_fee: 50, size: 'L' },
          { label: '1 dona xarid qiling, 1 dona bepul oling – 299.000 UZS', quantity: 1, price: 299, delivery_fee: 50, size: 'XL' },
          { label: '1 dona xarid qiling, 1 dona bepul oling – 299.000 UZS', quantity: 1, price: 299, delivery_fee: 50, size: 'XXL' },
          // Package 2 × each size
          { label: '2 dona xarid qiling, 2 dona bepul oling – 529.000 UZS', quantity: 2, price: 529, delivery_fee: 0, size: 'S' },
          { label: '2 dona xarid qiling, 2 dona bepul oling – 529.000 UZS', quantity: 2, price: 529, delivery_fee: 0, size: 'M' },
          { label: '2 dona xarid qiling, 2 dona bepul oling – 529.000 UZS', quantity: 2, price: 529, delivery_fee: 0, size: 'L' },
          { label: '2 dona xarid qiling, 2 dona bepul oling – 529.000 UZS', quantity: 2, price: 529, delivery_fee: 0, size: 'XL' },
          { label: '2 dona xarid qiling, 2 dona bepul oling – 529.000 UZS', quantity: 2, price: 529, delivery_fee: 0, size: 'XXL' },
        ],
      },
    },
  });

  console.log(`✅ Product 2: "${product2.name}" (slug: ${product2.slug})`);

  // ── Landing Pages ──────────────────────────────────────────────────
  // Register each LadiPage page with a unique api_key

  const apiKey1 = generateApiKey();
  const landing1 = await prisma.landingPage.upsert({
    where: { api_key: apiKey1 },
    update: {},
    create: {
      name: 'Kem tẩy lông (Trang xanh)',
      api_key: apiKey1,
      product_id: product1.id,
      active: true,
    },
  });

  const apiKey2 = generateApiKey();
  const landing2 = await prisma.landingPage.upsert({
    where: { api_key: apiKey2 },
    update: {},
    create: {
      name: 'Áo giữ nhiệt (Trang trắng)',
      api_key: apiKey2,
      product_id: product2.id,
      active: true,
    },
  });

  console.log(`\n✅ Landing Page 1: "${landing1.name}" → api_key: ${apiKey1}`);
  console.log(`✅ Landing Page 2: "${landing2.name}" → api_key: ${apiKey2}`);

  console.log('\n─────────────────────────────────────────────────────');
  console.log('📋 Webhook URL duy nhất cho TẤT CẢ LadiPage:');
  console.log(`   POST https://your-domain/api/webhook/ladipage?api_key=<API_KEY>`);
  console.log('\n📋 Cấu hình trên LadiPage POS API:');
  console.log(`   Landing 1: https://your-domain/api/webhook/ladipage?api_key=${apiKey1}`);
  console.log(`   Landing 2: https://your-domain/api/webhook/ladipage?api_key=${apiKey2}`);
  console.log('\n📋 Field mapping trên LadiPage POS:');
  console.log('   name       ↔ bill_full_name');
  console.log('   phone      ↔ bill_phone_number');
  console.log('   address    ↔ shipping_address');
  console.log('   products   ↔ note (chứa thông tin gói sản phẩm)');
  console.log('─────────────────────────────────────────────────────');
  console.log('\n⚠️  xmlId chưa có — hãy cập nhật khi đối tác RetailCRM gửi!');
  console.log('💡 Khi thêm LadiPage mới: chỉ cần INSERT 1 record vào bảng landing_pages, KHÔNG cần thêm code!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
